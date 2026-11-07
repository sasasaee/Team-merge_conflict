"""Write hourly Sun/Earth az/el into each site JSON (what T-15..T-17 would provide), so DNA can be computed now.

  python pipeline/sky.py --sites pipeline/sites.r2.yaml --out data/real_out

Starts at the app's planned landing, 1 March 2027 00:00 UTC, and covers 60 days of possible delay + 14 mission days.
Only fills a file's Sun/Earth fields if they are missing (so Atia's real arrays are never overwritten) unless --force.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import ephemeris as eph
from export import load_sites

ROOT = Path(__file__).resolve().parent.parent
KEYS = ("sun_az", "sun_el", "earth_az", "earth_el")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sites", required=True)
    ap.add_argument("--out", default=str(ROOT / "web" / "public" / "data"))
    ap.add_argument("--start", default="2027-03-01T00:00:00+00:00", help="UTC start (planned landing in the app)")
    ap.add_argument("--hours", type=int, default=24 * 74)
    ap.add_argument("--force", action="store_true", help="overwrite existing Sun/Earth arrays")
    a = ap.parse_args()

    t0 = datetime.fromisoformat(a.start).astimezone(timezone.utc)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for s in load_sites(a.sites):
        p = out / f"{s['id']}.json"
        data = json.loads(p.read_text()) if p.exists() else {}
        if all(k in data for k in KEYS) and not a.force:
            print(f"[{s['id']}] already has Sun/Earth arrays, left alone (use --force to replace)")
            continue
        for k in ("id", "name", "lat", "lon"):
            data.setdefault(k, s[k])
        r = eph.sun_earth_azel(s["lat"], s["lon"], t0, a.hours)
        data.update({"t0": t0.strftime("%Y-%m-%dT%H:%M:%SZ"), "step_h": 1, "n": a.hours})
        data.update({k: [round(float(v), 2) for v in r[k]] for k in KEYS})
        p.write_text(json.dumps(data, separators=(",", ":")))
        print(f"[{s['id']}] sun el {r['sun_el'].min():.1f}..{r['sun_el'].max():.1f} deg, "
              f"earth el {r['earth_el'].min():.1f}..{r['earth_el'].max():.1f} deg -> {p}")


if __name__ == "__main__":
    main()
