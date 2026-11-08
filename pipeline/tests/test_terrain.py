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


# ---- near-field handling: the lander sits on a flat pad, so ground within min_dist_m is ignored ----

def _longest_identical_run(hz):
    best = run = 1
    for i in range(1, len(hz)):
        run = run + 1 if hz[i] == hz[i - 1] else 1
        best = max(best, run)
    return best


def test_a_pixel_next_to_the_lander_is_not_a_mountain():
    dem, x0, y0 = flat_dem(-88, 0, half_km=10, res=20.0)
    r0, c0 = (int(round(v)) for v in dem.xy_to_rc(x0, y0))
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr or dc:
                dem.data[r0 + dr, c0 + dc] = 4.0           # all 8 neighbours 4 m higher: ~11 degrees at 20 m
    legacy = T.horizon_at(dem, x0, y0, -88, 0, min_dist_m=0.0)
    assert legacy.max() > 8.0                              # the old behaviour: a fake 10-degree wall
    assert T.horizon_at(dem, x0, y0, -88, 0).max() < 0.5   # default: ignored


def test_real_ridges_beyond_the_cut_are_kept():
    dem, x0, y0 = flat_dem(-88, 0, half_km=30)
    n, e = T.local_axes(-88, 0, T.MOON_SOUTH_STERE)
    add_block(dem, x0 + e[0] * 10_000, y0 + e[1] * 10_000, 400, 500.0)
    assert abs(T.horizon_at(dem, x0, y0, -88, 0)[90] - expected(9_600, 500.0)) < 0.35


def test_lander_height_lowers_a_nearby_ridge():
    dem, x0, y0 = flat_dem(-88, 0, half_km=10, res=20.0)
    n, e = T.local_axes(-88, 0, T.MOON_SOUTH_STERE)
    add_block(dem, x0 + e[0] * 400, y0 + e[1] * 400, 30, 6.0)     # a 6 m rise about 400 m away
    ground = T.horizon_at(dem, x0, y0, -88, 0, observer_h=0.0)[90]
    on_legs = T.horizon_at(dem, x0, y0, -88, 0, observer_h=2.0)[90]
    assert 0.15 < ground - on_legs < 0.5                           # 6 m vs 4 m of rise: about 0.3 degrees


def test_dem_noise_does_not_make_step_shaped_horizons():
    rng = np.random.default_rng(1)
    n = int(2 * 20_000 / 20.0)
    x0, y0 = T.site_xy(-86.0, 0.0, T.MOON_SOUTH_STERE)
    dem = T.Dem(rng.normal(0, 2.0, (n, n)).astype(np.float32), x0 - 20_000, y0 + 20_000, 20.0, T.MOON_SOUTH_STERE)
    legacy = T.horizon_at(dem, x0, y0, -86.0, 0.0, min_dist_m=0.0)
    fixed = T.horizon_at(dem, x0, y0, -86.0, 0.0)
    assert _longest_identical_run(legacy) >= 30            # the staircase we saw at Malapert (67-72 degrees wide)
    assert _longest_identical_run(fixed) < 10
    assert fixed.mean() < 1.0 < legacy.mean()


def test_grid_horizons_pass_the_near_field_options_through():
    dem, x0, y0 = flat_dem(-88, 0, half_km=30)
    assert T.grid_horizons(dem, -88, 0, observer_h=2.0, min_dist_m=300.0)[12]["horizon"] != []
