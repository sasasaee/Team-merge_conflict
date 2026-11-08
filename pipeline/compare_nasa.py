"""Compare our sunlit and Earth-visible fractions with NASA's published maps (PGDA product 69, Mazarico et al. 2011).

NASA's maps are averages over 18.6 years of hourly Sun (or Earth) positions. Download (GeoTIFF):
  Sun:   https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608.TIF        (75S-90S, 120 m/px, covers all 9 sites)
  Earth: https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608_EARTH.TIF   (optional)
  (the 85S-90S 60 m/px versions cover only sites poleward of 85S)

  python pipeline/compare_nasa.py --sun data/AVGVISIB_75S_120M_201608.TIF --earth data/AVGVISIB_75S_120M_201608_EARTH.TIF --data web/public/data [--doc docs/METHOD.md]

With --doc it fills the block between <!-- NASA69-START --> and <!-- NASA69-END --> in METHOD.md.
Notes: NASA counts Earth as visible if ANY part of its disc is above the horizon, so we compare with our margin > 0
(ok + weak), not with the stricter 2.5 degree rule. NASA's Sun value is a disc fraction, ours is the disc centre.
"""
from __future__ import annotations

import os

for _v in ("PROJ_LIB", "PROJ_DATA"):
    os.environ.pop(_v, None)

import argparse
import json
from pathlib import Path

import numpy as np

import terrain as T

START, END = "<!-- NASA69-START -->", "<!-- NASA69-END -->"


def sample_map(path, lat: float, lon: float, half_km: float = 1.0):
    """(value at the point, mean within half_km, max within half_km) in percent, or None outside the map / on no-data."""
    import rasterio
    from rasterio.windows import Window

    with rasterio.open(path) as ds:
        crs = ds.crs.to_wkt() if ds.crs else T.MOON_SOUTH_STERE
        x, y = T.site_xy(lat, lon, crs)
        scale = ds.scales[0] if ds.scales else 1.0
        offset = ds.offsets[0] if ds.offsets else 0.0
        step = max(1, int(max(ds.shape) // 1500))                       # decimated read to find the map's units
        coarse = ds.read(1, out_shape=(ds.shape[0] // step, ds.shape[1] // step), out_dtype="float32") * scale + offset
        if ds.nodata is not None and not np.isnan(ds.nodata):
            coarse[coarse == ds.nodata * scale + offset] = np.nan
        factor = 100.0 if np.nanmax(coarse) <= 1.5 else 1.0               # 0-1 fractions become percent
        row, col = ds.index(x, y)
        r = max(1, int(round(half_km * 1000 / abs(ds.transform.a))))
        if not (0 <= row < ds.height and 0 <= col < ds.width):
            return None, factor
        win = ds.read(1, window=Window(col - r, row - r, 2 * r + 1, 2 * r + 1), boundless=True, fill_value=np.nan, out_dtype="float32")
        win = win * scale + offset
        if ds.nodata is not None and not np.isnan(ds.nodata):
            win[win == ds.nodata * scale + offset] = np.nan
        centre = win[r, r]
        if np.isnan(centre):
            return None, factor
        return (float(centre) * factor, float(np.nanmean(win)) * factor, float(np.nanmax(win)) * factor), factor


def our_numbers(path: Path) -> dict:
    d = json.loads(path.read_text())
    hz = np.array(next(g for g in d["grid"] if g["dx_km"] == 0 and g["dy_km"] == 0)["horizon"])
    lit = np.array(d["sun_el"]) > hz[np.rint(d["sun_az"]).astype(int) % 360]
    margin = np.array(d["earth_el"]) - hz[np.rint(d["earth_az"]).astype(int) % 360]
    return {"name": d["name"], "lat": d["lat"], "lon": d["lon"], "lit": lit.mean() * 100, "vis": (margin > 0).mean() * 100}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sun", required=True)
    ap.add_argument("--earth")
    ap.add_argument("--data", required=True)
    ap.add_argument("--doc")
    ap.add_argument("--window-km", type=float, default=1.0)
    a = ap.parse_args()

    files = [p for p in sorted(Path(a.data).glob("*.json")) if not p.name.startswith("sample-")]
    head = "| Site | Ours: sunlit (1 yr) | NASA: at our point | NASA: mean within %.0f km | NASA: max within %.0f km |" % (a.window_km, a.window_km)
    sep = "|---|---|---|---|---|"
    if a.earth:
        head += " Ours: Earth visible (1 yr) | NASA Earth: at our point |"
        sep += "---|---|"
    lines, pairs = [head, sep], []
    for p in files:
        o = our_numbers(p)
        s, _ = sample_map(a.sun, o["lat"], o["lon"], a.window_km)
        row = f"| {o['name']} | {o['lit']:.0f}% | " + (f"{s[0]:.0f}% | {s[1]:.0f}% | {s[2]:.0f}% |" if s else "outside map | - | - |")
        if a.earth:
            e, _ = sample_map(a.earth, o["lat"], o["lon"], a.window_km)
            row += f" {o['vis']:.0f}% | " + (f"{e[0]:.0f}% |" if e else "outside map |")
        lines.append(row)
        if s:
            pairs.append((o["lit"], s[0], s[1]))
    summary = []
    if len(pairs) >= 3:
        ours, pt, win = (np.array(c) for c in zip(*pairs))
        summary += [f"Across {len(pairs)} sites: mean absolute difference {np.abs(ours - pt).mean():.0f} points at the exact point and "
                    f"{np.abs(ours - win).mean():.0f} points against the {a.window_km:.0f} km mean; correlation {np.corrcoef(ours, win)[0, 1]:.2f} "
                    f"(1.0 = same ranking of sites)."]
    block = "\n".join(lines + ([""] + summary if summary else []))
    print(block)
    if a.doc:
        doc = Path(a.doc)
        raw = doc.read_bytes().decode("utf8"); crlf = "\r\n" in raw; text = raw.replace("\r\n", "\n")
        if text.count(START) == 1 and text.count(END) == 1:
            h, rest = text.split(START); tail = rest.split(END)[1]
            text = h + START + "\n" + block + "\n" + END + tail
            doc.write_bytes((text.replace("\n", "\r\n") if crlf else text).encode("utf8"))
            print(f"\nupdated {doc}")
        else:
            print("\nmarkers not found in the doc, nothing written")


if __name__ == "__main__":
    main()
