"""Rewrite id/name/lat/lon inside existing site JSONs from a sites yaml, without touching anything else.

Older runs of export.py/sky.py kept the lat/lon of the FIRST run in each file, so after the points were re-chosen the stored
labels no longer matched the data. The data itself (horizons, Sun/Earth, DNA) was already computed for the new points.

  python pipeline/fix_labels.py --sites pipeline/sites.snapped.yaml --data data/final_out E:/tmc-clone/web/public/data
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from export import load_sites


def fix_dir(sites: list[dict], folder: Path) -> int:
    by_id = {s["id"]: s for s in sites}
    changed = 0
    for p in sorted(folder.glob("*.json")):
        if p.name.startswith("sample-"):
            continue
        d = json.loads(p.read_text())
        s = by_id.get(d.get("id"))
        if not s:
            continue
        new = {k: s[k] for k in ("id", "name", "lat", "lon")}
        if any(d.get(k) != v for k, v in new.items()):
            print(f"  {p.name}: lat/lon {d.get('lat')}, {d.get('lon')} -> {s['lat']}, {s['lon']}")
            d.update(new)
            p.write_text(json.dumps(d, separators=(",", ":")))
            changed += 1
    return changed


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sites", required=True)
    ap.add_argument("--data", required=True, nargs="+", help="one or more folders of site JSONs")
    a = ap.parse_args()
    sites = load_sites(a.sites)
    for folder in a.data:
        print(folder)
        print(f"  {fix_dir(sites, Path(folder))} file(s) updated")


if __name__ == "__main__":
    main()
