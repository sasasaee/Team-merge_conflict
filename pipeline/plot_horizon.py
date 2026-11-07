import json
import sys
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt

p = Path(sys.argv[1])
d = json.loads(p.read_text())
g = {(q["dx_km"], q["dy_km"]): np.array(q["horizon"]) for q in d["grid"]}
hz = g[(0, 0)]
print(f"{len(d['grid'])} grid points | centre horizon: min {hz.min():.2f}, mean {hz.mean():.2f}, max {hz.max():.2f} deg")
print(f"highest ridge toward azimuth {hz.argmax()} (0=N, 90=E)")
fig, ax = plt.subplots(figsize=(11, 4))
ax.fill_between(range(360), hz, min(hz.min(), 0) - 1, color="0.4")
ax.set(title=f"{d.get('name', p.stem)}: horizon (0=N, 90=E)", xlabel="azimuth (deg)", ylabel="elevation (deg)")
out = p.with_name(p.stem + "_horizon.png")
fig.savefig(out, dpi=110, bbox_inches="tight")
print("saved", out)