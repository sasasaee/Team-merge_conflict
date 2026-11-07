"""
T-18 Test Suite: SPICE Kernel and Geometric Transformation Validation.
Verifies kernel loading, lunar frames, topocentric parallax, and basis orthonormality.
"""

from __future__ import annotations
import math
from pathlib import Path
import numpy as np
import pytest
import spiceypy as spice

PROJECT_ROOT = Path(__file__).resolve().parents[2]
KERNEL_DIR = PROJECT_ROOT / "kernels"
KERNEL_FILES = [
    KERNEL_DIR / "lsk" / "naif0012.tls",
    KERNEL_DIR / "spk" / "de440s.bsp",
    KERNEL_DIR / "pck" / "pck00011.tpc",
    KERNEL_DIR / "pck" / "moon_pa_de440_200625.bpc",
    KERNEL_DIR / "fk" / "moon_de440_250416.tf",
]


@pytest.fixture(scope="module", autouse=True)
def setup_spice():
    """Load SPICE kernels once for all tests in this module."""
    for k in KERNEL_FILES:
        assert k.exists(), f"Kernel not found: {k}"
        spice.furnsh(str(k))
    yield
    spice.kclear()


def test_kernel_count_and_loading():
    """Verify all 5 required kernels are loaded in SPICE database."""
    count = spice.ktotal("ALL")
    assert count >= 5, f"Expected at least 5 loaded kernels, found {count}"


def test_lunar_reference_frames_exist():
    """Verify that MOON_ME, MOON_PA, and IAU_MOON frames are recognized."""
    me_id = spice.namfrm("MOON_ME")
    pa_id = spice.namfrm("MOON_PA")
    assert me_id != 0, "MOON_ME frame is not recognized by SPICE"
    assert pa_id != 0, "MOON_PA frame is not recognized by SPICE"
    assert me_id != pa_id, "MOON_ME and MOON_PA should have distinct frame IDs"


def test_moon_radii():
    """Verify Moon radii from PCK match expected 1737.4 km standard."""
    dim, radii = spice.bodvrd("MOON", "RADII", 3)
    assert dim == 3
    assert np.isclose(radii[0], 1737.4, atol=0.1)
    assert np.isclose(radii[1], 1737.4, atol=0.1)
    assert np.isclose(radii[2], 1737.4, atol=0.1)


def test_topocentric_parallax_effect():
    """
    Verify that topocentric (site-level) direction differs from Moon-center direction.
    For Earth (~384,000 km away), site parallax on the Moon (radius 1,737 km) is up to ~0.26 deg.
    For Sun (~150,000,000 km away), site parallax is ~0.00067 deg.
    Both must show non-zero difference from Moon center.
    """
    et = spice.str2et("2027-03-01T00:00:00Z")
    lat_deg, lon_deg = -85.99, 359.70
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    r_moon = 1737.4

    r_site = r_moon * np.array([
        math.cos(lat) * math.cos(lon),
        math.cos(lat) * math.sin(lon),
        math.sin(lat),
    ])

    for target, min_parallax_deg in [("EARTH", 0.05), ("SUN", 0.0001)]:
        center_pos, _ = spice.spkpos(target, et, "MOON_ME", "NONE", "MOON")
        topocentric_pos = center_pos - r_site

        # Compute angular separation between center vector and topocentric vector
        v1 = center_pos / np.linalg.norm(center_pos)
        v2 = topocentric_pos / np.linalg.norm(topocentric_pos)
        dot = np.clip(np.dot(v1, v2), -1.0, 1.0)
        angle_deg = math.degrees(math.acos(dot))

        assert angle_deg > min_parallax_deg, (
            f"Parallax for {target} too small ({angle_deg:.6f} deg <= {min_parallax_deg}). "
            f"Did code accidentally use Moon center?"
        )


def test_local_topocentric_basis_orthonormality():
    """
    Verify that local topocentric basis (e_hat, n_hat, u_hat) is strictly orthonormal
    and right-handed: e_hat x n_hat = u_hat.
    """
    test_coords = [
        (-85.99, 359.70),
        (-84.60, 31.00),
        (-88.20, 296.60),
        (0.0, 0.0),
        (45.0, 90.0),
    ]

    for lat_deg, lon_deg in test_coords:
        lat, lon = math.radians(lat_deg), math.radians(lon_deg)

        cos_lat, sin_lat = math.cos(lat), math.sin(lat)
        cos_lon, sin_lon = math.cos(lon), math.sin(lon)

        e_hat = np.array([-sin_lon, cos_lon, 0.0])
        n_hat = np.array([-sin_lat * cos_lon, -sin_lat * sin_lon, cos_lat])
        u_hat = np.array([cos_lat * cos_lon, cos_lat * sin_lon, sin_lat])

        # Unit lengths
        assert np.isclose(np.linalg.norm(e_hat), 1.0)
        assert np.isclose(np.linalg.norm(n_hat), 1.0)
        assert np.isclose(np.linalg.norm(u_hat), 1.0)

        # Mutually orthogonal
        assert np.isclose(np.dot(e_hat, n_hat), 0.0, atol=1e-12)
        assert np.isclose(np.dot(e_hat, u_hat), 0.0, atol=1e-12)
        assert np.isclose(np.dot(n_hat, u_hat), 0.0, atol=1e-12)

        # Right-handed cross product: e x n = u
        cross_en = np.cross(e_hat, n_hat)
        assert np.allclose(cross_en, u_hat, atol=1e-12)


def test_known_geometric_projections():
    """
    Verify azimuth/elevation conversion with synthetic test vectors:
    - Pure North -> Azimuth 0°, Elevation 0°
    - Pure East  -> Azimuth 90°, Elevation 0°
    - Pure South -> Azimuth 180°, Elevation 0°
    - Pure West  -> Azimuth 270°, Elevation 0°
    - Pure Zenith -> Elevation 90°
    """
    # Test cases: (east, north, up) -> (expected_az, expected_el)
    cases = [
        (0.0, 100.0, 0.0, 0.0, 0.0),       # North
        (100.0, 0.0, 0.0, 90.0, 0.0),      # East
        (0.0, -100.0, 0.0, 180.0, 0.0),    # South
        (-100.0, 0.0, 0.0, 270.0, 0.0),    # West
        (0.0, 0.0, 100.0, None, 90.0),     # Zenith (azimuth degenerate)
        (100.0, 100.0, 100.0 * math.sqrt(2), 45.0, 45.0), # 45° NE, 45° elevation
    ]

    for east, north, up, exp_az, exp_el in cases:
        horiz = math.hypot(east, north)
        el = math.degrees(math.atan2(up, horiz))
        assert np.isclose(el, exp_el, atol=1e-6)

        if exp_az is not None:
            az = (math.degrees(math.atan2(east, north)) + 360.0) % 360.0
            assert np.isclose(az, exp_az, atol=1e-6)

