"""Run the WHOLE R2 pipeline on fake data (no downloads needed) to check your setup works.

  python pipeline/demo.py

Writes pipeline/demo_out/: a fake site JSON (with Atia-style sun/earth arrays), your grid + dna, and two plots.
Fake coordinates, fake terrain, fake Sun/Earth. Never copy demo_out into web/public/data.
"""
import json
import time
from pathlib import Path

import numpy as np

import export as E
import illumination as ill
import sample_data as S
import terrain as T

OUT = Path(__file__).resolve().parent / "demo_out"
OUT.mkdir(exist_ok=True)
tif = OUT / "fake_dem.tif"
S.synthetic_dem_tif(tif, lat=-88.0, lon=20.0, half_km=80, res=100)

site = {"id": "demo-site", "name": "Demo Site (fake)", "lat": -88.0, "lon": 20.0}
sun = S.sample_sun_earth(0)
atia = {"id": site["id"], "name": site["name"], "lat": site["lat"], "lon": site["lon"],
        **{k: (v if isinstance(v, (str, int)) else [round(float(x), 2) for x in v]) for k, v in sun.items()}}
(OUT / "demo-site.json").write_text(json.dumps(atia))  # pretend Atia already exported

t = time.time()
dem = T.crop_dem(tif, site["lat"], site["lon"], half_km=75)
E.process_site(site, dem, OUT, sample=True)
print(f"done in {time.time() - t:.1f}s")

# ---- plots (like the 'plot looks like a mountain outline' check in T-25)
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

d = json.loads((OUT / "demo-site.json").read_text())
hz = np.array(next(g for g in d["grid"] if g["dx_km"] == 0 and g["dy_km"] == 0)["horizon"])
fig, ax = plt.subplots(2, 1, figsize=(11, 7))
ax[0].fill_between(range(360), hz, min(hz.min(), -1), color="0.4")
ax[0].set(title="Horizon outline: height of mountains vs compass direction (0=N, 90=E)", xlabel="azimuth (deg)", ylabel="elevation (deg)")
h = np.arange(24 * 28)
ax[1].plot(h, d["sun_el"], label="Sun elevation", color="orange")
ax[1].plot(h, d["earth_el"], label="Earth elevation", color="tab:blue")
lit = ill.lit_array(hz, d["sun_az"], d["sun_el"])
ax[1].fill_between(h, -3, -2.5, where=lit, color="orange", alpha=.8, label="lit")
ax[1].set(title="Sun and Earth over one lunar month", xlabel="hour", ylabel="elevation (deg)")
ax[1].legend(ncol=3)
plt.tight_layout()
plt.savefig(OUT / "horizon_and_sky.png", dpi=110)
print("plot:", OUT / "horizon_and_sky.png")
