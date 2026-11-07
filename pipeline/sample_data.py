"""Fake data so you can test the whole pipeline before the real LOLA / SPICE files exist.
The Sun/Earth generator is a Python copy of web/src/core/sites.ts (same formulas). NOT real positions."""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np

from terrain import MOON_SOUTH_STERE, site_xy


def synthetic_dem_tif(path: str | Path, lat: float = -88.0, lon: float = 0.0, half_km: float = 80.0,
                      res: float = 100.0, seed: int = 0) -> None:
    """Write a fake south-pole style GeoTIFF: rolling terrain with a few ridges. For testing only."""
    import rasterio
    from rasterio.transform import from_origin

    rng = np.random.default_rng(seed)
    x0, y0 = site_xy(lat, lon, MOON_SOUTH_STERE)
    n = int(2 * half_km * 1000 / res)
    xs = x0 - half_km * 1000 + (np.arange(n) + 0.5) * res
    ys = y0 + half_km * 1000 - (np.arange(n) + 0.5) * res
    X, Y = np.meshgrid(xs, ys)
    z = np.zeros((n, n), dtype=np.float32)
    for _ in range(40):  # random hills / craters
        cx, cy = rng.uniform(xs[0], xs[-1]), rng.uniform(ys[-1], ys[0])
        amp, sig = rng.uniform(-300, 700), rng.uniform(2_000, 9_000)
        z += (amp * np.exp(-(((X - cx) ** 2 + (Y - cy) ** 2) / (2 * sig**2)))).astype(np.float32)
    z[np.hypot(X - x0, Y - y0) < 600] = 0.0  # keep the landing spot flat and valid
    with rasterio.open(path, "w", driver="GTiff", height=n, width=n, count=1, dtype="float32",
                       crs=MOON_SOUTH_STERE, transform=from_origin(xs[0] - res / 2, ys[0] + res / 2, res, res),
                       compress="deflate") as ds:
        ds.write(z, 1)


def sample_sun_earth(site_idx: int = 0, hours: int = 24 * 28) -> dict:
    """Same formulas as getSite() in web/src/core/sites.ts."""
    profiles = [(0.6, 7), (0.6, 7), (0.6, 6), (0.6, 7), (0.6, 7)]
    sun_mean, earth_mean = profiles[site_idx % 5]
    i = site_idx
    h = np.arange(hours)
    month = 2 * math.pi * h / (27.3 * 24)
    return {
        "t0": "2026-11-01T00:00:00Z", "step_h": 1, "n": hours,
        "sun_az": ((h / (29.5 * 24)) * 360 + i * 40) % 360,
        "sun_el": sun_mean + 1.2 * np.sin(month + i * 0.9) + 0.3 * np.sin(2 * math.pi * h / (5 * 24) + i),
        "earth_az": (180 + i * 12 + 8 * np.sin(month) + 360) % 360,
        "earth_el": earth_mean + 4.5 * np.sin(month + i * 0.7 + 1.2),
    }
