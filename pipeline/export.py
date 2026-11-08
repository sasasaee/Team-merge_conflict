"""Build web/public/data/<site>.json parts owned by R2: grid[25] horizons and dna.

Safe to run before AND after Atia's file exists: it only writes `grid` and `dna` (and id/name/lat/lon if missing)
and keeps every other field exactly as Atia wrote it.

  python pipeline/export.py --dem data/LDEM_80S_20MPP_ADJ.TIF --sites pipeline/sites.yaml
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np
import yaml

import illumination as ill
import terrain as T

ROOT = Path(__file__).resolve().parent.parent
SUN_KEYS = ("sun_az", "sun_el", "earth_az", "earth_el")


def load_sites(path: str | Path) -> list[dict]:
    raw = yaml.safe_load(Path(path).read_text())
    sites = raw["sites"] if isinstance(raw, dict) and "sites" in raw else raw
    out = []
    for s in sites:
        name = s.get("name") or s.get("id")
        sid = s.get("id") or re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        out.append({"id": sid, "name": name, "lat": float(s["lat"]), "lon": float(s["lon"])})
    return out


def analyse(horizon: list[float], atia: dict) -> dict | None:
    """DNA from the site's own horizon (grid centre) + Atia's Sun/Earth arrays. None if her arrays are missing."""
    if not all(k in atia for k in SUN_KEYS):
        return None
    hz = np.array(horizon)
    lit = ill.lit_array(hz, atia["sun_az"], atia["sun_el"])
    earth = ill.earth_state(ill.earth_margin(hz, atia["earth_az"], atia["earth_el"]))
    return {"lit": lit, "earth": earth, "dna": ill.shadow_dna(lit, earth)}


def process_site(site: dict, dem: T.Dem, out_dir: Path, sample: bool = False, observer_h: float = 0.0) -> None:
    path = out_dir / f"{site['id']}.json"
    data = json.loads(path.read_text()) if path.exists() else {}
    for k in ("id", "name", "lat", "lon"):
        data[k] = site[k]  # always the current point: a stale lat/lon from an older run must not survive

    grid = T.grid_horizons(dem, site["lat"], site["lon"], observer_h)
    data["grid"] = grid
    centre = next(g for g in grid if g["dx_km"] == 0 and g["dy_km"] == 0)["horizon"]

    res = analyse(centre, data)
    if res:
        data["dna"] = res["dna"]
        fc = ill.comm_forecast(res["earth"])
        fdir = ROOT / "pipeline" / "out" / "forecast"
        fdir.mkdir(parents=True, exist_ok=True)
        (fdir / f"{site['id']}.json").write_text(json.dumps(fc))
        print(f"  dna: {data['dna']}  | {len(fc)} weak/lost stretches")
    else:
        print("  (Atia's sun_az/sun_el/earth_az/earth_el not in this file yet, so no dna. Re-run once her JSON lands.)")

    out_dir.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":")))
    print(f"  wrote {path} ({path.stat().st_size / 1024:.0f} KB)")

    if sample:  # T-29: tiny file for Noshin's Local Sky view
        s = {"id": site["id"], "name": site["name"], "horizon": centre}
        for k in SUN_KEYS:
            if k in data:
                s[k] = [round(float(v), 2) for v in data[k][:24]]
        sp = out_dir / f"sample-{site['id']}.json"
        sp.write_text(json.dumps(s))
        print(f"  wrote {sp} (send this to Noshin)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dem", required=True, help="LOLA GeoTIFF (e.g. LDEM_80S_20MPP_ADJ.TIF)")
    ap.add_argument("--sites", required=True, help="Atia's sites.yaml (needs id/name/lat/lon)")
    ap.add_argument("--out", default=str(ROOT / "web" / "public" / "data"))
    ap.add_argument("--half-km", type=float, default=75.0, help="half-width of the crop around each site")
    ap.add_argument("--only", help="run just this site id")
    ap.add_argument("--sample", action="store_true", help="also write sample-<id>.json for Noshin (T-29)")
    ap.add_argument("--observer-h", type=float, default=0.0, help="lander/mast height in metres")
    ap.add_argument("--save-crops", action="store_true", help="save each crop to pipeline/cache/<id>.tif (T-24)")
    a = ap.parse_args()

    sites = load_sites(a.sites)
    if a.only:
        sites = [s for s in sites if s["id"] == a.only]
    for s in sites:
        print(f"[{s['id']}] {s['name']}  lat {s['lat']}, lon {s['lon']}")
        dem = T.crop_dem(a.dem, s["lat"], s["lon"], a.half_km)
        if a.save_crops:
            cp = ROOT / "pipeline" / "cache" / f"{s['id']}.tif"
            T.save_dem(dem, cp)
            print(f"  crop saved {cp} ({cp.stat().st_size / 1e6:.1f} MB)")
        process_site(s, dem, Path(a.out), a.sample, a.observer_h)


if __name__ == "__main__":
    main()
