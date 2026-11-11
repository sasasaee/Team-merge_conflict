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


def map_units(ds):
    """(factor to percent, note, coarse array). Decides from the scale metadata, dtype and the map's maximum, and refuses to guess."""
    scale = ds.scales[0] if ds.scales else 1.0
    offset = ds.offsets[0] if ds.offsets else 0.0
    step = max(1, int(max(ds.shape) // 1500))
    coarse = ds.read(1, out_shape=(ds.shape[0] // step, ds.shape[1] // step), out_dtype="float32") * scale + offset
    if ds.nodata is not None and not np.isnan(ds.nodata):
        coarse[coarse == ds.nodata * scale + offset] = np.nan
    vmax = float(np.nanmax(coarse))
    if vmax <= 1.5:
        return 100.0, f"max value {vmax:.3f}: treated as a 0-1 fraction, multiplied by 100", coarse
    if vmax <= 100.5:
        return 1.0, f"max value {vmax:.1f}: treated as percent", coarse
    if ds.dtypes[0] == "uint8" and vmax <= 255.5:
        return 100.0 / 255.0, f"8-bit map, max value {vmax:.0f}: rescaled from 0-255 to percent", coarse
    if vmax <= 10050:
        return 0.01, f"max value {vmax:.0f}: treated as hundredths of a percent", coarse
    raise ValueError(f"cannot tell the units of this map (maximum value {vmax}); check the file's description on the PGDA page")


def sample_map(path, lat: float, lon: float, half_km: float = 1.0):
    """(value at the point, mean within half_km, max within half_km) in percent, or None outside the map / on no-data."""
    import rasterio
    from rasterio.windows import Window

    with rasterio.open(path) as ds:
        crs = ds.crs.to_wkt() if ds.crs else T.MOON_SOUTH_STERE
        x, y = T.site_xy(lat, lon, crs)
        scale = ds.scales[0] if ds.scales else 1.0
        offset = ds.offsets[0] if ds.offsets else 0.0
        factor, _, _ = map_units(ds)
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
        vals = (float(centre) * factor, float(np.nanmean(win)) * factor, float(np.nanmax(win)) * factor)
        if not (-0.5 <= vals[0] <= 100.5):
            raise ValueError(f"NASA value {vals[0]:.1f} at ({lat}, {lon}) is not a percentage; the units are not what the script assumed")
        return vals, factor


def our_numbers(path: Path) -> dict:
    d = json.loads(path.read_text())
    hz = np.array(next(g for g in d["grid"] if g["dx_km"] == 0 and g["dy_km"] == 0)["horizon"])
    lit = np.array(d["sun_el"]) > hz[np.rint(d["sun_az"]).astype(int) % 360]
    margin = np.array(d["earth_el"]) - hz[np.rint(d["earth_az"]).astype(int) % 360]
    return {"name": d["name"], "lat": d["lat"], "lon": d["lon"], "lit": lit.mean() * 100, "vis": (margin > 0).mean() * 100}


def stats_line(label: str, ours, nasa) -> str:
    if not ours:
        return f"{label}: no sites inside the map."
    d = np.array(ours) - np.array(nasa)
    r = np.corrcoef(ours, nasa)[0, 1] if len(ours) >= 3 and np.std(ours) > 0 and np.std(nasa) > 0 else float("nan")
    return (f"{label}, exact point: mean absolute difference {np.abs(d).mean():.1f} points, "
            f"{int((np.abs(d) <= 10).sum())} of {len(d)} sites within 10 points, correlation {r:.2f}.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sun", required=True)
    ap.add_argument("--earth")
    ap.add_argument("--data", required=True)
    ap.add_argument("--doc")
    ap.add_argument("--window-km", type=float, default=1.0)
    a = ap.parse_args()

    import rasterio
    for label, path in (("Sun", a.sun), ("Earth", a.earth)):
        if path:
            with rasterio.open(path) as ds:
                print(f"{label} map {Path(path).name}: {ds.shape[1]} x {ds.shape[0]} px, {abs(ds.transform.a):.0f} m/px, crs {'present' if ds.crs else 'MISSING (assuming south polar stereographic)'}, {map_units(ds)[1]}")
    files = [p for p in sorted(Path(a.data).glob("*.json")) if not p.name.startswith("sample-")]
    head = "| Site | Ours: sunlit (1 yr) | NASA: at our point | Ours minus NASA (point) | NASA: mean within %.0f km | NASA: max within %.0f km |" % (a.window_km, a.window_km)
    sep = "|---|---|---|---|---|---|"
    if a.earth:
        head += " Ours: Earth visible (1 yr) | NASA Earth: at our point | Ours minus NASA (Earth) |"
        sep += "---|---|---|"
    lines = [head, sep]
    sun_o, sun_n, earth_o, earth_n, far_sun, far_earth = [], [], [], [], [], []
    for p in files:
        o = our_numbers(p)
        s, _ = sample_map(a.sun, o["lat"], o["lon"], a.window_km)
        if s:
            row = f"| {o['name']} | {o['lit']:.0f}% | {s[0]:.0f}% | {o['lit'] - s[0]:+.0f} points | {s[1]:.0f}% | {s[2]:.0f}% |"
            sun_o.append(o["lit"]); sun_n.append(s[0])
            if abs(o["lit"] - s[0]) > 10:
                far_sun.append(f"{o['name']} ({o['lit'] - s[0]:+.0f})")
        else:
            row = f"| {o['name']} | {o['lit']:.0f}% | outside map | - | - | - |"
        if a.earth:
            e, _ = sample_map(a.earth, o["lat"], o["lon"], a.window_km)
            if e:
                row += f" {o['vis']:.0f}% | {e[0]:.0f}% | {o['vis'] - e[0]:+.0f} points |"
                earth_o.append(o["vis"]); earth_n.append(e[0])
                if abs(o["vis"] - e[0]) > 10:
                    far_earth.append(f"{o['name']} ({o['vis'] - e[0]:+.0f})")
            else:
                row += f" {o['vis']:.0f}% | outside map | - |"
        lines.append(row)
    summary = [stats_line("Sun", sun_o, sun_n)]
    if a.earth:
        summary.append(stats_line("Earth", earth_o, earth_n))
    summary.append("More than 10 points apart at the exact point. Sun: " + (", ".join(far_sun) or "none")
                   + (". Earth: " + (", ".join(far_earth) or "none") if a.earth else "") + ".")
    summary.append(f"The NASA mean and max within {a.window_km:.0f} km are shown for context only: each of our points is the best-lit spot found in its "
                   "region, so it sits above the average of its surroundings (illumination changes a lot over a few hundred metres). "
                   "The exact-point columns are the fair comparison.")
    block = "\n".join(lines + [""] + summary)
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
