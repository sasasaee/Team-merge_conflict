import math

import numpy as np

import terrain as T


def flat_dem(lat, lon, half_km=30.0, res=50.0):
    x0, y0 = T.site_xy(lat, lon, T.MOON_SOUTH_STERE)
    n = int(2 * half_km * 1000 / res)
    return T.Dem(np.zeros((n, n), np.float32), x0 - half_km * 1000, y0 + half_km * 1000, res, T.MOON_SOUTH_STERE), x0, y0


def add_block(dem, x_c, y_c, half_w, height):
    """Raise a square block (map metres) to `height`."""
    xs = dem.x_min + (np.arange(dem.data.shape[1]) + 0.5) * dem.res
    ys = dem.y_max - (np.arange(dem.data.shape[0]) + 0.5) * dem.res
    mx = np.abs(xs - x_c) < half_w
    my = np.abs(ys - y_c) < half_w
    dem.data[np.ix_(my, mx)] = height


def expected(dist, height):
    return math.degrees(math.atan2(height - dist**2 / (2 * T.MOON_R), dist))


def test_local_axes_match_polar_stereographic_formula():
    # For lat_0 = -90, lon_0 = 0: direction at compass azimuth a is (sin(a + lon), cos(a + lon)).
    for lon in (0, 35, 120, 250):
        n, e = T.local_axes(-87.0, lon, T.MOON_SOUTH_STERE)
        L = math.radians(lon)
        assert np.allclose(n, [math.sin(L), math.cos(L)], atol=1e-3)
        assert np.allclose(e, [math.cos(L), -math.sin(L)], atol=1e-3)


def test_flat_ground_horizon_is_about_zero():
    dem, x0, y0 = flat_dem(-88, 0)
    hz = T.horizon_at(dem, x0, y0, -88, 0)
    assert hz.shape == (360,) and np.all(np.abs(hz) < 0.1)


def test_ridge_shows_up_in_the_right_compass_direction_for_any_longitude():
    for lon in (0, 77, 200, 330):
        dem, x0, y0 = flat_dem(-87.5, lon)
        n, e = T.local_axes(-87.5, lon, T.MOON_SOUTH_STERE)
        for az, vec in ((90, e), (0, n), (270, -e), (180, -n)):
            d2 = flat_dem(-87.5, lon)[0]
            add_block(d2, x0 + vec[0] * 10_000, y0 + vec[1] * 10_000, 400, 500.0)
            hz = T.horizon_at(d2, x0, y0, -87.5, lon)
            assert min((hz.argmax() - az) % 360, (az - hz.argmax()) % 360) <= 3, (lon, az, hz.argmax())
            assert abs(hz.max() - expected(9_600, 500.0)) < 0.35  # nearest face of the block is at ~9.6 km
            assert hz[(az + 180) % 360] < 0.1


def test_curvature_lowers_far_peaks():
    dem, x0, y0 = flat_dem(-88, 0, half_km=60)
    add_block(dem, x0 + 40_000, y0, 500, 500.0)
    far = T.horizon_at(dem, x0, y0, -88, 0)[90]
    assert abs(far - expected(39_500, 500.0)) < 0.2
    assert far < math.degrees(math.atan2(500, 39_500)) - 0.1  # a flat-Moon model would give a higher angle


def test_site_on_a_hilltop_looks_down():
    dem, x0, y0 = flat_dem(-88, 0)
    dem.data[:] = -300.0  # lowlands
    add_block(dem, x0, y0, 300, 0.0)  # site stands on a 300 m plateau
    hz = T.horizon_at(dem, x0, y0, -88, 0)
    assert hz.max() < 0  # everything is below you


def test_grid_has_25_points_centre_first_checked():
    dem, x0, y0 = flat_dem(-88, 0, half_km=30)
    g = T.grid_horizons(dem, -88, 0)
    assert len(g) == 25 and all(len(p["horizon"]) == 360 for p in g)
    assert {(p["dx_km"], p["dy_km"]) for p in g} == {(dx, dy) for dx in range(-2, 3) for dy in range(-2, 3)}


def test_moving_east_toward_a_ridge_raises_its_angle():
    dem, x0, y0 = flat_dem(-88, 0, half_km=40)
    n, e = T.local_axes(-88, 0, T.MOON_SOUTH_STERE)
    add_block(dem, x0 + e[0] * 8_000, y0 + e[1] * 8_000, 300, 400.0)
    g = {(p["dx_km"], p["dy_km"]): p["horizon"] for p in T.grid_horizons(dem, -88, 0)}
    assert g[(2, 0)][90] > g[(0, 0)][90] > g[(-2, 0)][90]
