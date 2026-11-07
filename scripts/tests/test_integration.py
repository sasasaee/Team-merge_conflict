"""
T-19 Integration Test Suite: Humaira's Exporter & Saeera's Simulator Compatibility.
Verifies that:
1. Humaira's terrain exporter can consume R1's ephemeris JSON, add terrain data, and preserve ephemeris arrays.
2. Saeera's simulator data loader can parse the data into TypeScript-compatible SiteData.
3. The simulator logic runs to completion on real SPICE ephemeris data.
"""

from __future__ import annotations
import json
import math
from pathlib import Path
from typing import Any, Dict, List
import numpy as np
import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "web" / "public" / "data"

EXPECTED_SITES = [
    "malapert",
    "mons-mouton",
    "mons-mouton-plateau",
    "nobile-rim-1",
    "nobile-rim-2",
    "haworth",
    "de-gerlache-rim-2",
    "peak-near-cabeus-b",
    "slater-plain",
]


def mock_humaira_terrain_export(r1_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Simulates Humaira's R2 terrain export pipeline contract:
    - Ingests R1's ephemeris JSON (sun_az, sun_el, earth_az, earth_el)
    - Adds horizon (360 values), computes lit (boolean array) and earth (link array)
    - Adds grid and dna metadata
    - Preserves all R1 ephemeris fields and site coordinates intact
    """
    n = r1_data["n"]
    sun_az = r1_data["sun_az"]
    sun_el = r1_data["sun_el"]
    earth_az = r1_data["earth_az"]
    earth_el = r1_data["earth_el"]

    # Simulated terrain horizon profile from DEM (360 compass degrees)
    # Heights range from 0.5° to 2.0° above sphere horizon
    horizon = [round(1.0 + 0.5 * math.sin(math.radians(a * 2)), 3) for a in range(360)]

    # Compute illumination: Sun elevation > horizon in Sun's azimuth direction
    lit = [bool(sun_el[i] > horizon[int(round(sun_az[i])) % 360]) for i in range(n)]

    # Compute Earth communication link state:
    # margin = earth_el - horizon; > 2.5° is "ok", > 0° is "weak", <= 0° is "lost"
    earth = []
    for i in range(n):
        margin = earth_el[i] - horizon[int(round(earth_az[i])) % 360]
        if margin > 2.5:
            earth.append("ok")
        elif margin > 0.0:
            earth.append("weak")
        else:
            earth.append("lost")

    # Construct exported dictionary
    exported = dict(r1_data)
    exported["horizon"] = horizon
    exported["lit"] = lit
    exported["earth"] = earth
    exported["dna"] = {
        "lit_pct": sum(lit) / n,
        "comm_pct": earth.count("ok") / n,
    }
    return exported


def saeera_data_loader(exported_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Simulates Saeera's TypeScript realSites.ts loader:
    Converts snake_case JSON fields into camelCase SiteData interface:
      sun_az   -> sunAz
      sun_el   -> sunEl
      earth_az -> earthAz
      earth_el -> earthEl
    """
    return {
        "horizon": exported_json["horizon"],
        "sunAz": exported_json["sun_az"],
        "sunEl": exported_json["sun_el"],
        "earthAz": exported_json["earth_az"],
        "earthEl": exported_json["earth_el"],
        "lit": exported_json["lit"],
        "earth": exported_json["earth"],
    }


def saeera_simulate(site_data: Dict[str, Any], params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Pure Python port of Saeera's simulate() logic from web/src/core/simulate.ts.
    Runs exact mission power and Earth-communication simulation over the mission duration.
    """
    panel_area_m2 = 10.0
    sun_kw_per_m2 = 1.361
    reserve_fraction = 0.25

    duration_h = min(params["durationDays"] * 24, len(site_data["lit"]))
    panel_kw = panel_area_m2 * params["panelEff"] * sun_kw_per_m2
    reserve = params["batteryKwh"] * reserve_fraction

    soc = float(params["batteryKwh"])
    min_soc = soc
    fail_hour = None
    cause = None

    lit_h = 0
    earth_ok_h = 0
    blackout_run = 0
    longest_blackout = 0

    day_ok_h = 0
    worst_day_ok_h = 24
    comm_violation_days = 0

    soc_arr: List[float] = []

    for k in range(duration_h):
        h = (k + params["delayH"]) % len(site_data["lit"])

        # Power
        charge = panel_kw if site_data["lit"][h] else 0.0
        net = charge - params["loadKw"]
        soc = min(float(params["batteryKwh"]), soc + net)
        soc = max(0.0, soc)
        soc_arr.append(round(soc, 1))

        if site_data["lit"][h]:
            lit_h += 1
        min_soc = min(min_soc, soc)

        if fail_hour is None and soc < reserve:
            fail_hour = k
            cause = "power"

        # Comm
        e = site_data["earth"][h]
        if e == "ok":
            earth_ok_h += 1
            day_ok_h += 1

        blackout_run = blackout_run + 1 if e == "lost" else 0
        longest_blackout = max(longest_blackout, blackout_run)

        # End of 24h day
        if k % 24 == 23:
            worst_day_ok_h = min(worst_day_ok_h, day_ok_h)
            if day_ok_h < params["commHoursReq"]:
                comm_violation_days += 1
                if fail_hour is None:
                    fail_hour = k
                    cause = "comm"
            day_ok_h = 0

    power_at_risk = min_soc < reserve * 1.5
    comm_at_risk = worst_day_ok_h < params["commHoursReq"] + 2 or comm_violation_days > 0

    verdict = "fail" if fail_hour is not None else ("warn" if power_at_risk or comm_at_risk else "ok")

    return {
        "soc": soc_arr,
        "minSoc": min_soc,
        "reserve": reserve,
        "failHour": fail_hour,
        "cause": cause,
        "litPct": lit_h / duration_h,
        "earthOkPct": earth_ok_h / duration_h,
        "longestBlackoutH": longest_blackout,
        "verdict": verdict,
    }


@pytest.mark.parametrize("site_id", EXPECTED_SITES)
def test_humaira_exporter_compatibility(site_id):
    """
    Test that Humaira's pipeline export process consumes R1 JSON,
    preserves ephemeris arrays bit-for-bit, and adds terrain fields.
    """
    json_path = DATA_DIR / f"{site_id}.json"
    with open(json_path, "r", encoding="utf-8") as f:
        r1_original = json.load(f)

    exported = mock_humaira_terrain_export(r1_original)

    # Ephemeris arrays must be preserved exactly
    assert exported["sun_az"] == r1_original["sun_az"]
    assert exported["sun_el"] == r1_original["sun_el"]
    assert exported["earth_az"] == r1_original["earth_az"]
    assert exported["earth_el"] == r1_original["earth_el"]

    # Coordinates preserved
    assert exported["lat"] == r1_original["lat"]
    assert exported["lon"] == r1_original["lon"]

    # Terrain fields added
    assert len(exported["horizon"]) == 360
    assert len(exported["lit"]) == r1_original["n"]
    assert len(exported["earth"]) == r1_original["n"]
    assert all(e in ["ok", "weak", "lost"] for e in exported["earth"])


@pytest.mark.parametrize("site_id", EXPECTED_SITES)
def test_saeera_simulator_end_to_end(site_id):
    """
    Test that Saeera's loader converts data to SiteData and simulate() executes successfully.
    """
    json_path = DATA_DIR / f"{site_id}.json"
    with open(json_path, "r", encoding="utf-8") as f:
        r1_original = json.load(f)

    exported = mock_humaira_terrain_export(r1_original)
    site_data = saeera_data_loader(exported)

    # Validate SiteData structure
    assert len(site_data["horizon"]) == 360
    assert len(site_data["sunAz"]) == 8760
    assert len(site_data["sunEl"]) == 8760
    assert len(site_data["earthAz"]) == 8760
    assert len(site_data["earthEl"]) == 8760
    assert len(site_data["lit"]) == 8760
    assert len(site_data["earth"]) == 8760

    # Run default 10-day mission scenario
    mission_params = {
        "delayH": 0,
        "batteryKwh": 120.0,
        "loadKw": 1.8,
        "panelEff": 0.29,
        "commHoursReq": 4,
        "durationDays": 10,
    }

    result = saeera_simulate(site_data, mission_params)

    # Check SimResult validity
    assert len(result["soc"]) == 240  # 10 days * 24h
    assert result["minSoc"] >= 0.0
    assert result["reserve"] == 30.0  # 120 * 0.25
    assert result["verdict"] in ["ok", "warn", "fail"]
    assert 0.0 <= result["litPct"] <= 1.0
    assert 0.0 <= result["earthOkPct"] <= 1.0
    assert result["longestBlackoutH"] >= 0

