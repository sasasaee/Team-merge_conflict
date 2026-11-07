from datetime import datetime, timezone

import numpy as np

import ephemeris as eph

T0 = datetime(2027, 3, 1, tzinfo=timezone.utc)


def test_pole_maps_to_body_z_axis():
    d = np.array([100.0, 5000.0, 9000.0])
    ra, dec, w = eph.moon_orientation(d)
    R = eph._rot_matrices(ra, dec, w)
    pole = np.stack([np.cos(dec) * np.cos(ra), np.cos(dec) * np.sin(ra), np.sin(dec)], axis=1)
    out = np.einsum("nij,nj->ni", R, pole)
    assert np.allclose(out, [0, 0, 1], atol=1e-9)


def test_libration_keeps_earth_near_the_mean_sub_earth_point():
    # Over a year the sub-Earth point wobbles by ~ +-7.5 deg in latitude and ~ +-8 deg in longitude.
    sun, earth = eph.body_fixed_directions(T0, 365 * 4, 6.0)
    lat = np.degrees(np.arcsin(earth[:, 2])); lon = np.degrees(np.arctan2(earth[:, 1], earth[:, 0]))
    assert abs(lat).max() < 8.5 and abs(lon).max() < 10.0
    assert abs(lat).max() > 5.0 and abs(lon).max() > 5.0          # libration really is there
    assert abs(lat.mean()) < 1.0 and abs(lon.mean()) < 1.0       # centred on (0, 0)


def test_subsolar_latitude_stays_within_the_moon_axial_tilt():
    sun, _ = eph.body_fixed_directions(T0, 365 * 4, 6.0)
    lat = np.degrees(np.arcsin(sun[:, 2]))
    assert abs(lat).max() < 1.7 and abs(lat).max() > 1.3          # +-1.54 deg


def test_sun_goes_round_once_per_synodic_month():
    sun, _ = eph.body_fixed_directions(T0, 60 * 4, 6.0)
    lon = np.unwrap(np.arctan2(sun[:, 1], sun[:, 0]))
    cycles = abs(lon[-1] - lon[0]) / (2 * np.pi)
    assert abs(cycles - 60 / 29.53) < 0.1


def test_polar_site_geometry():
    r = eph.sun_earth_azel(-86.0, 3.0, T0, 24 * 74)
    assert -6.5 < r["sun_el"].min() and r["sun_el"].max() < 7.0   # Sun never far from the horizon near 86 S
    assert r["earth_el"].max() - r["earth_el"].min() > 8          # libration swings Earth by ~13 deg
    assert r["earth_el"].min() < 0 < r["earth_el"].max()          # Earth rises and sets from here
    assert np.all((r["sun_az"] >= 0) & (r["sun_az"] < 360))
