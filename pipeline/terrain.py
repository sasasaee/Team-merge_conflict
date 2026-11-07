"""R2 terrain pipeline: LOLA DEM -> crop around a site -> horizon[360] for the site and a 5x5 grid.

Compass convention everywhere: azimuth 0 = north, 90 = east (clockwise). Elevation in degrees.
Works with any projected DEM (it asks pyproj for local north/east), so it does not depend on
how PGDA oriented the polar-stereographic grid.
"""
from __future__ import annotations

import os

for _v in ("PROJ_LIB", "PROJ_DATA"):
    os.environ.pop(_v, None)  # PostgreSQL/PostGIS sets these and confuses PROJ

import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from numba import njit, prange
from pyproj import CRS, Transformer


MOON_R = 1_737_400.0  # metres, IAU sphere used by LOLA
# Used only if the GeoTIFF has no CRS. PGDA south-pole polar stereographic:
MOON_SOUTH_STERE = f"+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R={MOON_R} +units=m +no_defs"
MOON_GEO = f"+proj=longlat +R={MOON_R} +no_defs"


@dataclass
class Dem:
    data: np.ndarray  # float32 2D, metres, NaN = no data. Row 0 = top (north-up in map x/y)
    x_min: float  # left edge (map metres)
    y_max: float  # top edge (map metres)
    res: float  # metres per pixel
    crs: str  # proj string / WKT

    def xy_to_rc(self, x: float, y: float) -> tuple[float, float]:
        return (self.y_max - y) / self.res - 0.5, (x - self.x_min) / self.res - 0.5


def _crs_of(ds) -> str:
    return ds.crs.to_wkt() if ds.crs else MOON_SOUTH_STERE


def site_xy(lat: float, lon: float, crs: str) -> tuple[float, float]:
    """Latitude/longitude (degrees, east-positive) -> map x/y in metres."""
    t = Transformer.from_crs(CRS.from_user_input(MOON_GEO), CRS.from_user_input(crs), always_xy=True)
    x, y = t.transform(lon, lat)
    return float(x), float(y)


def local_axes(lat: float, lon: float, crs: str) -> tuple[np.ndarray, np.ndarray]:
    """Unit vectors (in map x/y) pointing local north and local east at the site."""
    t = Transformer.from_crs(CRS.from_user_input(MOON_GEO), CRS.from_user_input(crs), always_xy=True)
    x0, y0 = t.transform(lon, lat)
    eps = 0.001  # degrees
    xn, yn = t.transform(lon, lat + eps if lat < 89.9 else lat - eps)
    xe, ye = t.transform(lon + eps, lat)
    n = np.array([xn - x0, yn - y0])
    e = np.array([xe - x0, ye - y0])
    if lat >= 89.9:
        n = -n
    return n / np.linalg.norm(n), e / np.linalg.norm(e)


# ---------------------------------------------------------------- T-23 / T-24: read + crop

def crop_dem(tif_path: str | Path, lat: float, lon: float, half_km: float = 75.0) -> Dem:
    """Read a square window (2*half_km wide) of the DEM around the site. Pads with NaN at the DEM edge."""
    import rasterio
    from rasterio.windows import Window

    with rasterio.open(tif_path) as ds:
        crs = _crs_of(ds)
        x, y = site_xy(lat, lon, crs)
        res = abs(ds.transform.a)
        if ds.transform.e > 0:
            raise ValueError("DEM is south-up; flip it first (gdal_translate / rasterio) so rows go north to south")
        half_px = int(round(half_km * 1000 / res))
        col = int(round((x - ds.transform.c) / ds.transform.a))
        row = int(round((y - ds.transform.f) / ds.transform.e))
        win = Window(col - half_px, row - half_px, 2 * half_px, 2 * half_px)
        arr = ds.read(1, window=win, boundless=True, fill_value=np.nan, out_dtype="float32")
        scale = ds.scales[0] if ds.scales else 1.0
        offset = ds.offsets[0] if ds.offsets else 0.0
        if scale != 1.0 or offset != 0.0:
            arr = arr * scale + offset
        if ds.nodata is not None and not np.isnan(ds.nodata):
            arr[arr == ds.nodata] = np.nan
        x_min = ds.transform.c + (col - half_px) * ds.transform.a
        y_max = ds.transform.f + (row - half_px) * ds.transform.e
    nan_frac = float(np.isnan(arr).mean())
    if nan_frac > 0.05:
        print(f"WARNING: {nan_frac:.0%} of the crop around ({lat}, {lon}) has no data (DEM edge?). Horizon far away may be missing.")
    return Dem(arr, x_min, y_max, res, crs)


def save_dem(dem: Dem, path: str | Path) -> None:
    """Save a cropped DEM as a compressed GeoTIFF (cache, do not commit)."""
    import rasterio
    from rasterio.transform import from_origin
    Path(path).parent.mkdir(parents=True, exist_ok=True)

    h, w = dem.data.shape
    with rasterio.open(
        path, "w", driver="GTiff", height=h, width=w, count=1, dtype="float32",
        crs=dem.crs if dem.crs else None, transform=from_origin(dem.x_min, dem.y_max, dem.res, dem.res),
        compress="deflate", predictor=3, nodata=float("nan"), tiled=True,
    ) as ds:
        ds.write(dem.data, 1)


def load_dem(path: str | Path) -> Dem:
    import rasterio

    with rasterio.open(path) as ds:
        return Dem(ds.read(1).astype("float32"), ds.transform.c, ds.transform.f, abs(ds.transform.a), _crs_of(ds))


# ---------------------------------------------------------------- T-25: horizon by ray casting

@njit(cache=True, fastmath=True)
def _sample(data, r, c):
    """Nearest-pixel height, NaN outside the array."""
    ri = int(r + 0.5)
    ci = int(c + 0.5)
    if r < -0.5 or c < -0.5 or ri >= data.shape[0] or ci >= data.shape[1]:
        return np.nan
    return data[ri, ci]


@njit(parallel=True, cache=True, fastmath=True)
def _horizon_kernel(data, res, r0, c0, dirs_x, dirs_y, h0, max_dist, moon_r):
    """For each of the 360 azimuths march outward and keep the largest looking-up angle (degrees)."""
    out = np.empty(360, dtype=np.float64)
    nsteps = int(max_dist / res)
    for a in prange(360):
        best = -90.0
        for k in range(1, nsteps + 1):
            d = k * res
            # map x grows to the right (cols), map y grows up (rows go down)
            r = r0 - dirs_y[a] * k
            c = c0 + dirs_x[a] * k
            z = _sample(data, r, c)
            if np.isnan(z):
                continue
            drop = d * d / (2.0 * moon_r)  # the Moon curves away: far ground sits lower
            ang = math.degrees(math.atan2(z - h0 - drop, d))
            if ang > best:
                best = ang
        out[a] = best
    return out


def horizon_at(dem: Dem, x: float, y: float, lat: float, lon: float,
               observer_h: float = 0.0, max_dist_m: float | None = None) -> np.ndarray:
    """horizon[360] in degrees at map position (x, y). Index = compass azimuth (0 = north, 90 = east)."""
    north, east = local_axes(lat, lon, dem.crs)
    az = np.radians(np.arange(360))
    d = np.cos(az)[:, None] * north[None, :] + np.sin(az)[:, None] * east[None, :]  # map-space unit vectors
    r0, c0 = dem.xy_to_rc(x, y)
    h0 = _sample(dem.data, r0, c0)
    if np.isnan(h0):
        raise ValueError("site falls on a no-data pixel of the DEM")
    if max_dist_m is None:
        max_dist_m = min(dem.data.shape) * dem.res / 2.0 - 2 * dem.res
    return _horizon_kernel(dem.data, dem.res, r0, c0, d[:, 0].copy(), d[:, 1].copy(),
                           float(h0) + observer_h, max_dist_m, MOON_R)


# 5x5 grid, 1 km apart, centre = the site itself (index 12). dx = east, dy = north.
GRID_OFFSETS_KM = [(dx, dy) for dy in (-2, -1, 0, 1, 2) for dx in (-2, -1, 0, 1, 2)]


def grid_horizons(dem: Dem, lat: float, lon: float, observer_h: float = 0.0) -> list[dict]:
    """25 horizons: the site and 24 neighbours. Output matches the data contract: grid[] = {dx_km, dy_km, horizon[360]}."""
    x0, y0 = site_xy(lat, lon, dem.crs)
    north, east = local_axes(lat, lon, dem.crs)
    out = []
    for dx, dy in GRID_OFFSETS_KM:
        x = x0 + (dx * east[0] + dy * north[0]) * 1000.0
        y = y0 + (dx * east[1] + dy * north[1]) * 1000.0
        hz = horizon_at(dem, x, y, lat, lon, observer_h)
        out.append({"dx_km": dx, "dy_km": dy, "horizon": [round(float(v), 2) for v in hz]})
    return out
