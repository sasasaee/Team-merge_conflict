"""
T-18 Test Suite: Physical Sanity Checks for Lunar South Pole Ephemerides.
Verifies astronomical plausibility, libration cycles, solar diurnal motion, and continuity.
"""

from __future__ import annotations
import json
from pathlib import Path
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


@pytest.fixture(scope="module")
def site_datasets():
    datasets = {}
    for site_id in EXPECTED_SITES:
        with open(DATA_DIR / f"{site_id}.json", "r", encoding="utf-8") as f:
            datasets[site_id] = json.load(f)
    return datasets


@pytest.mark.parametrize("site_id", EXPECTED_SITES)
def test_sun_and_earth_not_identical(site_datasets, site_id):
    """Verify Sun and Earth vectors are distinct and not coincident."""
    data = site_datasets[site_id]
    sun_az = np.array(data["sun_az"])
    sun_el = np.array(data["sun_el"])
    earth_az = np.array(data["earth_az"])
    earth_el = np.array(data["earth_el"])

    # Difference in elevation and azimuth
    az_diff = np.abs((sun_az - earth_az + 180) % 360 - 180)
    el_diff = np.abs(sun_el - earth_el)

    # Angular separation proxy
    angular_sep = np.hypot(az_diff * np.cos(np.radians((sun_el + earth_el) / 2)), el_diff)

    # Sun and Earth should never be identical across the year (except during rare eclipse alignments,
    # where their angular separation is still non-zero in azimuth/elevation precision)
    # The mean separation across the year should be large (~90 deg or more)
    assert np.mean(angular_sep) > 30.0, f"Mean separation too low in {site_id}"


@pytest.mark.parametrize("site_id", EXPECTED_SITES)
def test_sun_elevation_range_lunar_south_pole(site_datasets, site_id):
    """
    At the lunar south pole (lat -83.9 to -88.2), the Moon's 1.54° obliquity
    constrains the Sun's elevation to graze the horizon: [-8°, +6°].
    """
    data = site_datasets[site_id]
    sun_el = np.array(data["sun_el"])

    min_el = np.min(sun_el)
    max_el = np.max(sun_el)

    assert min_el >= -10.0, f"Sun elevation dropped too low ({min_el:.2f} deg) at {site_id}"
    assert max_el <= 8.0, f"Sun elevation climbed too high ({max_el:.2f} deg) at {site_id}"


@pytest.mark.parametrize("site_id", EXPECTED_SITES)
def test_sun_azimuth_steady_progression(site_datasets, site_id):
    """
    At the lunar south pole (southern hemisphere), the apparent motion of the Sun
    circles from East (90°) -> North (0°) -> West (270°) -> South (180°).
    Therefore, clockwise azimuth (0=N, 90=E) decreases steadily at ~0.508°/hour
    (-360° per synodic month ~708.7 h).
    Over 8760 hours (365 days), it completes approximately -12.36 revolutions.
    """
    data = site_datasets[site_id]
    sun_az = np.array(data["sun_az"])

    # Unwrap azimuth (in degrees)
    unwrapped = np.unwrap(np.radians(sun_az))
    total_rot_deg = np.degrees(unwrapped[-1] - unwrapped[0])

    expected_rot_deg = -8760.0 * (360.0 / 708.73)  # ~ -4447 degrees
    revolutions = total_rot_deg / 360.0

    # Total rotations should be between -13.0 and -11.5 full turns
    assert -13.0 <= revolutions <= -11.5, (
        f"Unexpected solar revolutions ({revolutions:.2f}) over 1 year at {site_id}"
    )

    # Hourly rate of change should be negative (decreasing azimuth) at ~ -0.5 deg/hr
    hourly_diff = np.diff(unwrapped)
    hourly_diff_deg = np.degrees(hourly_diff)
    assert np.all(hourly_diff_deg < 0.0), f"Solar azimuth reversed unexpectedly at {site_id}"
    assert np.all(hourly_diff_deg > -2.0), f"Solar azimuth rate jump at {site_id}"


@pytest.mark.parametrize("site_id", EXPECTED_SITES)
def test_earth_libration_bounded(site_datasets, site_id):
    """
    Because the Moon is tidally locked to Earth, Earth stays in roughly the same part of the sky
    at each site, oscillating (librating) with an amplitude of ~6° to 9° around a central point.
    """
    data = site_datasets[site_id]
    earth_az = np.array(data["earth_az"])
    earth_el = np.array(data["earth_el"])

    # Earth elevation range should span around 10° to 16° peak-to-peak
    el_range = np.ptp(earth_el)
    assert 5.0 <= el_range <= 20.0, f"Earth elevation range unexpected ({el_range:.2f} deg) at {site_id}"

    # Earth azimuth oscillation peak-to-peak should be bounded
    # Unwrapping around mean
    rad = np.radians(earth_az)
    unwrapped_az = np.degrees(np.unwrap(rad))
    az_range = np.ptp(unwrapped_az)
    assert az_range < 50.0, f"Earth azimuth variation too large ({az_range:.2f} deg) at {site_id}"


@pytest.mark.parametrize("site_id", EXPECTED_SITES)
def test_hourly_continuity_no_large_jumps(site_datasets, site_id):
    """Verify that hourly changes are smooth with no discontinuous data jumps."""
    data = site_datasets[site_id]

    sun_el = np.array(data["sun_el"])
    earth_el = np.array(data["earth_el"])

    # Maximum change in Sun elevation in 1 hour is < 0.1 deg
    max_d_sun_el = np.max(np.abs(np.diff(sun_el)))
    assert max_d_sun_el < 0.1, f"Sun elevation jumped {max_d_sun_el:.3f} deg/hr at {site_id}"

    # Maximum change in Earth elevation in 1 hour is < 0.1 deg
    max_d_earth_el = np.max(np.abs(np.diff(earth_el)))
    assert max_d_earth_el < 0.1, f"Earth elevation jumped {max_d_earth_el:.3f} deg/hr at {site_id}"
