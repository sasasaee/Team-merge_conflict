"""
T-18 Test Suite: Data Validation for MoonScope Ephemeris Outputs.
Validates JSON structure, array lengths, finite numbers, bounds, and consistency.
"""

from __future__ import annotations
import json
import math
from pathlib import Path
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

REQUIRED_KEYS = [
    "id",
    "name",
    "lat",
    "lon",
    "t0",
    "step_h",
    "n",
    "sun_az",
    "sun_el",
    "earth_az",
    "earth_el",
]

FORBIDDEN_KEYS = [
    "grid",
    "horizon",
    "dna",
    "lit",
    "earth",
]


@pytest.fixture(scope="module")
def site_datasets():
    """Load all site JSON files from DATA_DIR."""
    datasets = {}
    for site_id in EXPECTED_SITES:
        json_path = DATA_DIR / f"{site_id}.json"
        assert json_path.exists(), f"Missing expected site JSON: {json_path}"
        with open(json_path, "r", encoding="utf-8") as f:
            datasets[site_id] = json.load(f)
    return datasets


def test_all_nine_sites_present(site_datasets):
    """Ensure all 9 candidate landing sites are generated."""
    assert len(site_datasets) == 9
    assert set(site_datasets.keys()) == set(EXPECTED_SITES)


@pytest.mark.parametrize("site_id", EXPECTED_SITES)
def test_json_schema_and_keys(site_datasets, site_id):
    """Ensure exact required snake_case keys are present and no terrain fields exist."""
    data = site_datasets[site_id]

    for key in REQUIRED_KEYS:
        assert key in data, f"Site {site_id} is missing required key '{key}'"

    for forbidden in FORBIDDEN_KEYS:
        assert forbidden not in data, f"Site {site_id} includes terrain-pipeline key '{forbidden}'"

    assert data["id"] == site_id
    assert isinstance(data["name"], str) and len(data["name"]) > 0
    assert -90.0 <= data["lat"] <= 90.0
    assert 0.0 <= data["lon"] < 360.0
    assert data["step_h"] == 1
    assert data["n"] == 8760
    assert data["t0"] == "2027-03-01T00:00:00Z"


@pytest.mark.parametrize("site_id", EXPECTED_SITES)
def test_array_lengths(site_datasets, site_id):
    """Verify that all four ephemeris arrays match length n."""
    data = site_datasets[site_id]
    n = data["n"]

    for arr_name in ["sun_az", "sun_el", "earth_az", "earth_el"]:
        arr = data[arr_name]
        assert isinstance(arr, list), f"{arr_name} is not a list in {site_id}"
        assert len(arr) == n, f"{arr_name} length ({len(arr)}) != n ({n}) in {site_id}"


@pytest.mark.parametrize("site_id", EXPECTED_SITES)
def test_values_are_finite_numbers(site_datasets, site_id):
    """Verify no NaN, Infinity, or null values exist in any array."""
    data = site_datasets[site_id]

    for arr_name in ["sun_az", "sun_el", "earth_az", "earth_el"]:
        for idx, val in enumerate(data[arr_name]):
            assert val is not None, f"Null found at {arr_name}[{idx}] in {site_id}"
            assert isinstance(val, (int, float)), f"Non-numeric found at {arr_name}[{idx}] in {site_id}"
            assert math.isfinite(val), f"Non-finite ({val}) at {arr_name}[{idx}] in {site_id}"


@pytest.mark.parametrize("site_id", EXPECTED_SITES)
def test_azimuth_elevation_bounds(site_datasets, site_id):
    """
    Verify Azimuth is in [0, 360) and Elevation is in [-90, +90].
    """
    data = site_datasets[site_id]

    # Sun azimuth & elevation
    for az in data["sun_az"]:
        assert 0.0 <= az < 360.0, f"Sun azimuth {az} out of range [0, 360) in {site_id}"
    for el in data["sun_el"]:
        assert -90.0 <= el <= 90.0, f"Sun elevation {el} out of range [-90, 90] in {site_id}"

    # Earth azimuth & elevation
    for az in data["earth_az"]:
        assert 0.0 <= az < 360.0, f"Earth azimuth {az} out of range [0, 360) in {site_id}"
    for el in data["earth_el"]:
        assert -90.0 <= el <= 90.0, f"Earth elevation {el} out of range [-90, 90] in {site_id}"


def test_epoch_consistency_across_all_sites(site_datasets):
    """Confirm all sites share the exact same t0, step_h, and n."""
    t0_values = {d["t0"] for d in site_datasets.values()}
    step_values = {d["step_h"] for d in site_datasets.values()}
    n_values = {d["n"] for d in site_datasets.values()}

    assert len(t0_values) == 1, f"Inconsistent t0 across sites: {t0_values}"
    assert len(step_values) == 1, f"Inconsistent step_h across sites: {step_values}"
    assert len(n_values) == 1, f"Inconsistent n across sites: {n_values}"

