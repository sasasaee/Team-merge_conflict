import json
import sys

import numpy as np

import export as E
import fix_labels as F
import sky
import terrain as T


def _stale_file(folder, site_id="s1"):
    p = folder / f"{site_id}.json"
    p.write_text(json.dumps({"id": site_id, "name": "Old Name", "lat": -80.0, "lon": 10.0, "keep": [1, 2, 3]}))
    return p


def test_export_overwrites_stale_coordinates(tmp_path):
    x0, y0 = T.site_xy(-88.0, 0.0, T.MOON_SOUTH_STERE)
    dem = T.Dem(np.zeros((400, 400), np.float32), x0 - 10_000, y0 + 10_000, 50.0, T.MOON_SOUTH_STERE)
    p = _stale_file(tmp_path)
    E.process_site({"id": "s1", "name": "New Name", "lat": -88.0, "lon": 0.0}, dem, tmp_path)
    d = json.loads(p.read_text())
    assert (d["name"], d["lat"], d["lon"]) == ("New Name", -88.0, 0.0)
    assert d["keep"] == [1, 2, 3] and len(d["grid"]) == 25


def test_sky_overwrites_stale_coordinates(tmp_path, monkeypatch):
    sites = tmp_path / "sites.yaml"
    sites.write_text("sites:\n  - {id: s1, name: New Name, lat: -86.0, lon: 3.0}\n")
    p = _stale_file(tmp_path)
    monkeypatch.setattr(sys, "argv", ["sky.py", "--sites", str(sites), "--out", str(tmp_path), "--hours", "48", "--force"])
    sky.main()
    d = json.loads(p.read_text())
    assert (d["name"], d["lat"], d["lon"]) == ("New Name", -86.0, 3.0) and d["n"] == 48


def test_fix_labels_changes_only_the_labels(tmp_path):
    p = _stale_file(tmp_path)
    (tmp_path / "sample-s1.json").write_text('{"id":"s1","lat":1}')
    sites = [{"id": "s1", "name": "New Name", "lat": -87.4, "lon": 113.7}]
    assert F.fix_dir(sites, tmp_path) == 1
    d = json.loads(p.read_text())
    assert (d["name"], d["lat"], d["lon"], d["keep"]) == ("New Name", -87.4, 113.7, [1, 2, 3])
    assert F.fix_dir(sites, tmp_path) == 0                      # idempotent
    assert json.loads((tmp_path / "sample-s1.json").read_text())["lat"] == 1   # sample files are left alone
