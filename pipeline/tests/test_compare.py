import numpy as np
import rasterio
from rasterio.transform import from_origin

import compare_nasa as C
import terrain as T
import update_method as U


def make_map(path, lat, lon, value, scale=None, half_km=30.0, res=120.0, dtype=None):
    x0, y0 = T.site_xy(lat, lon, T.MOON_SOUTH_STERE)
    n = int(2 * half_km * 1000 / res)
    raw = np.full((n, n), value if scale is None else round(value / scale), dtype=dtype or ("int16" if scale else "float32"))
    with rasterio.open(path, "w", driver="GTiff", height=n, width=n, count=1, dtype=raw.dtype, crs=T.MOON_SOUTH_STERE,
                       transform=from_origin(x0 - half_km * 1000, y0 + half_km * 1000, res, res)) as ds:
        ds.write(raw, 1)
        if scale:
            ds.scales = (scale,)


def test_sample_map_percent_floats(tmp_path):
    make_map(tmp_path / "m.tif", -86.0, 3.0, 42.0)
    s, _ = C.sample_map(tmp_path / "m.tif", -86.0, 3.0)
    assert np.allclose(s, (42.0, 42.0, 42.0))


def test_sample_map_applies_scale_and_turns_fractions_into_percent(tmp_path):
    make_map(tmp_path / "m.tif", -86.0, 3.0, 0.37, scale=0.0001)      # 0-1 fractions stored as scaled int16
    s, _ = C.sample_map(tmp_path / "m.tif", -86.0, 3.0)
    assert abs(s[0] - 37.0) < 0.1


def test_sample_map_outside_returns_none(tmp_path):
    make_map(tmp_path / "m.tif", -86.0, 3.0, 42.0)
    assert C.sample_map(tmp_path / "m.tif", -80.0, 3.0)[0] is None


def test_update_method_block_counts_and_thresholds():
    rows = [{"name": "A", "mean_h": 1.0, "lit28": 50, "lit": 55, "ok28": 60, "ok": 65},
            {"name": "B", "mean_h": 5.0, "lit28": 0, "lit": 0, "ok28": 10, "ok": 20}]
    b = U.build_block(rows)
    assert "1 of 2 sites pass the sunlight threshold (below it: B)" in b
    assert "1 of 2 pass the Earth threshold (below it: B)" in b
    assert "best full-year sunlit value is 55%" in b


def test_units_hundredths_of_a_percent_without_scale_metadata(tmp_path):
    make_map(tmp_path / "m.tif", -86.0, 3.0, 4200, dtype="int16")       # 0-10000 integers, no scale tag
    s, _ = C.sample_map(tmp_path / "m.tif", -86.0, 3.0)
    assert abs(s[0] - 42.0) < 0.01


def test_units_8bit_map_is_rescaled(tmp_path):
    make_map(tmp_path / "m.tif", -86.0, 3.0, 128, dtype="uint8")        # 0-255 for 0-100 percent
    s, _ = C.sample_map(tmp_path / "m.tif", -86.0, 3.0)
    assert abs(s[0] - 50.2) < 0.2


def test_units_unknown_refuses_to_guess(tmp_path):
    import pytest
    make_map(tmp_path / "m.tif", -86.0, 3.0, 50000, dtype="int32")
    with pytest.raises(ValueError):
        C.sample_map(tmp_path / "m.tif", -86.0, 3.0)


def test_whole_run_reports_exact_point_stats_and_flags_big_gaps(tmp_path, monkeypatch, capsys):
    import json
    import sys

    make_map(tmp_path / "sun.tif", -86.0, 3.0, 70.0)        # NASA says 70%
    make_map(tmp_path / "earth.tif", -86.0, 3.0, 100.0)     # NASA says 100%
    d = tmp_path / "data"; d.mkdir()
    json.dump({"id": "x", "name": "Test Site", "lat": -86.0, "lon": 3.0,
               "grid": [{"dx_km": 0, "dy_km": 0, "horizon": [0.0] * 360}],
               "sun_az": [0.0] * 10, "sun_el": [1.0] * 10, "earth_az": [0.0] * 10, "earth_el": [5.0] * 10}, open(d / "x.json", "w"))
    monkeypatch.setattr(sys, "argv", ["compare_nasa.py", "--sun", str(tmp_path / "sun.tif"), "--earth", str(tmp_path / "earth.tif"), "--data", str(d)])
    C.main()
    out = capsys.readouterr().out
    assert "Test Site | 100% | 70% | +30 points" in out                    # ours always lit, NASA 70%
    assert "More than 10 points apart at the exact point. Sun: Test Site (+30). Earth: none." in out
    assert "Sun, exact point: mean absolute difference 30.0 points" in out
    assert "correlation 0.4" not in out and "against the" not in out         # the misleading 1 km correlation is gone
