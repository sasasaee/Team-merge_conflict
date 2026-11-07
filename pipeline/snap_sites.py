"""Check our approximate site coordinates against the real DEM and move each one to the best nearby spot.

For every site it
  1. prints the DEM height at the point we gave (compare with NASA's descriptions: Malapert ~ +5 km, Mons Mouton ~ +5-6 km,
     Nobile Rim 1 ~ +3 km). Wildly different = the point or the map orientation is wrong.
  2. searches a circle around it (NASA regions are ~15 km wide, so default radius 7.5 km), skipping steep ground,
     and keeps the point with the best mix of sunlight and Earth contact over the first 672 h after landing.
  3. writes pipeline/sites.snapped.yaml with the improved lat/lon.

  python pipeline/snap_sites.py --dem data/LDEM_80S_20MPP_ADJ.tiff --sites pipeline/sites.r2.yaml
"""
from __future__ import annotations

import os

for _v in ("PROJ_LIB", "PROJ_DATA"):
    os.environ.pop(_v, None)

import argparse
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from numba import njit, prange
from pyproj import CRS, Transformer

import ephemeris as eph
import terrain as T
from export import load_sites

RELIABLE_DEG = 2.5


@njit(parallel=True, cache=True, fastmath=True)
def _coarse_horizon(data, res, r0, c0, dx, dy, h0, nsteps, stride, moon_r):
    """Fast, rough horizon: few azimuths, steps of `stride` pixels. For ranking candidates only."""
    n = dx.shape[0]
    out = np.empty(n)
    for a in prange(n):
        best = -90.0
        for k in range(1, nsteps + 1):
            kk = k * stride
            d = kk * res
            r = r0 - dy[a] * kk
            c = c0 + dx[a] * kk
            ri = int(r + 0.5); ci = int(c + 0.5)
            if r < -0.5 or c < -0.5 or ri >= data.shape[0] or ci >= data.shape[1]:
                continue
            z = data[ri, ci]
            if np.isnan(z):
                continue
            ang = math.degrees(math.atan2(z - h0 - d * d / (2.0 * moon_r), d))
            if ang > best:
                best = ang
        out[a] = best
    return out


def _height(dem: T.Dem, x: float, y: float) -> float:
    r, c = dem.xy_to_rc(x, y)
    return float(T._sample(dem.data, r, c))


def _slope_deg(dem: T.Dem, x: float, y: float, base_m: float = 100.0) -> float:
    zx = (_height(dem, x + base_m, y) - _height(dem, x - base_m, y)) / (2 * base_m)
    zy = (_height(dem, x, y + base_m) - _height(dem, x, y - base_m)) / (2 * base_m)
    return math.degrees(math.atan(math.hypot(zx, zy)))


def evaluate(dem, x, y, lat, lon, sun_b, earth_b, n_az=72, max_dist=40_000.0, stride=2):
    """(lit fraction, Earth-ok fraction, mean horizon deg) for one point."""
    north, east = T.local_axes(lat, lon, dem.crs)
    az = np.radians(np.arange(n_az) * 360.0 / n_az)
    d = np.cos(az)[:, None] * north[None, :] + np.sin(az)[:, None] * east[None, :]
    r0, c0 = dem.xy_to_rc(x, y)
    h0 = T._sample(dem.data, r0, c0)
    if np.isnan(h0):
        return None
    nsteps = int(max_dist / (dem.res * stride))
    hz = _coarse_horizon(dem.data, dem.res, r0, c0, d[:, 0].copy(), d[:, 1].copy(), float(h0), nsteps, stride, T.MOON_R)
    def look(vec_b):
        a, e = eph.az_el(vec_b, lat, lon)
        return e, hz[np.rint(a / (360.0 / n_az)).astype(int) % n_az]
    se, sh = look(sun_b)
    ee, eh = look(earth_b)
    return float((se > sh).mean()), float((ee - eh > RELIABLE_DEG).mean()), float(hz.mean())


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dem", required=True)
    ap.add_argument("--sites", required=True)
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent / "sites.snapped.yaml"))
    ap.add_argument("--radius-km", type=float, default=7.5)
    ap.add_argument("--step-m", type=float, default=300.0)
    ap.add_argument("--max-slope", type=float, default=10.0, help="skip candidates steeper than this (deg, 100 m baseline)")
    ap.add_argument("--comm-weight", type=float, default=0.5, help="score = lit + weight * Earth-ok")
    ap.add_argument("--start", default="2027-03-01T00:00:00+00:00")
    ap.add_argument("--hours", type=int, default=672)
    ap.add_argument("--only")
    a = ap.parse_args()

    t0 = datetime.fromisoformat(a.start).astimezone(timezone.utc)
    sun_b, earth_b = eph.body_fixed_directions(t0, a.hours, km=True)
    sites = load_sites(a.sites)
    if a.only:
        sites = [s for s in sites if s["id"] == a.only]

    lines = ["# Output of snap_sites.py: each point moved to the best nearby spot (see script docstring).", "sites:"]
    for s in sites:
        dem = T.crop_dem(a.dem, s["lat"], s["lon"], half_km=a.radius_km + 45)
        x0, y0 = T.site_xy(s["lat"], s["lon"], dem.crs)
        h_here = _height(dem, x0, y0)
        base = evaluate(dem, x0, y0, s["lat"], s["lon"], sun_b, earth_b)
        print(f"\n[{s['id']}] {s['name']}  start point {s['lat']:.4f}, {s['lon']:.4f}")
        print(f"  DEM height here {h_here / 1000:+.2f} km | start point: lit {base[0]:.0%}, Earth ok {base[1]:.0%}, mean horizon {base[2]:.1f} deg")

        inv = Transformer.from_crs(CRS.from_user_input(dem.crs), CRS.from_user_input(T.MOON_GEO), always_xy=True)
        offs = np.arange(-a.radius_km * 1000, a.radius_km * 1000 + 1, a.step_m)
        best, n_ok, hmax = None, 0, h_here
        for oy in offs:
            for ox in offs:
                if math.hypot(ox, oy) > a.radius_km * 1000:
                    continue
                x, y = x0 + ox, y0 + oy
                z = _height(dem, x, y)
                if np.isnan(z):
                    continue
                hmax = max(hmax, z)
                if _slope_deg(dem, x, y) > a.max_slope:
                    continue
                lon, lat = inv.transform(x, y)
                m = evaluate(dem, x, y, lat, lon, sun_b, earth_b)
                if m is None:
                    continue
                n_ok += 1
                score = m[0] + a.comm_weight * m[1]
                if best is None or score > best[0]:
                    best = (score, lat, lon, m, z, math.hypot(ox, oy))
        print(f"  highest ground within {a.radius_km} km: {hmax / 1000:+.2f} km | {n_ok} gentle-slope candidates checked")
        if best is None:
            print("  no candidate found, keeping the start point")
            lat, lon = s["lat"], s["lon"]
        else:
            _, lat, lon, m, z, dist = best
            print(f"  BEST {lat:.4f}, {lon:.4f}  ({dist / 1000:.1f} km away, height {z / 1000:+.2f} km): "
                  f"lit {m[0]:.0%}, Earth ok {m[1]:.0%}, mean horizon {m[2]:.1f} deg")
        lines.append(f"  - {{id: {s['id']}, name: {s['name']}, lat: {lat:.4f}, lon: {lon:.4f}}}")

    Path(a.out).write_text("\n".join(lines) + "\n")
    print(f"\nwrote {a.out}")


if __name__ == "__main__":
    main()