# R2 pipeline (Humaira): terrain, horizon, Shadow DNA

Covers T-23 to T-28, T-29 and the data side of T-54. Everything is tested; run `python pipeline/demo.py` to prove your setup works with no downloads.

## 0. Setup (once, ~5 min). VS Code or PyCharm is enough.

Open the **repo root** (the folder that contains `web/` and `docs/`) in the IDE, then in its terminal:

```bash
# Python 3.11 or 3.12 recommended
python -m venv .venv
# Windows:   .venv\Scripts\activate        macOS/Linux:   source .venv/bin/activate
pip install -r pipeline/requirements.txt     # or the team's: uv pip install ... (Tech Stack tab)
python -m pytest pipeline/tests -q           # expect: 9 passed
python pipeline/demo.py                      # makes pipeline/demo_out/horizon_and_sky.png
```

Add to the repo `.gitignore`: `.venv/`, `pipeline/cache/`, `pipeline/demo_out/`, `pipeline/out/`, `data/` (big NASA files must not be committed).

## 1. T-23: download the height map

PGDA product 90: https://pgda.gsfc.nasa.gov/products/90 . Get the **20 m/px south-pole DEM** (a `.TIF`, named something like `LDEM_80S_20MPP_ADJ.TIF`, 80S to the pole). Put it in `data/`. Check it opens:

```bash
python -c "import rasterio; d=rasterio.open('data/YOUR_FILE.TIF'); print(d.crs, d.res, d.shape, d.dtypes)"
```
Done when this prints without an error. If you only get `.IMG` + `.LBL`, rasterio/GDAL can usually open the `.LBL` directly.

## 2. T-24 + T-25 + T-26 + T-27 + T-28: one command

You need Atia's `sites.yaml` (T-16) with `id, name, lat, lon` per site (a list, or `sites: [...]`). Lat is negative at the south pole, lon is east-positive.

```bash
python pipeline/export.py --dem data/YOUR_FILE.TIF --sites pipeline/sites.yaml --save-crops --sample
```

Per site this does the crop (T-24), 25 horizons (T-25), and writes `grid` + `dna` into `web/public/data/<id>.json`. It **keeps every field Atia wrote** and only adds `grid`/`dna`, so run it again whenever her file changes. `dna` appears only once her `sun_az, sun_el, earth_az, earth_el` are in the file. `--sample` writes `sample-<id>.json` for Noshin (T-29). Weak/lost periods go to `pipeline/out/forecast/<id>.json` (T-28). Useful flags: `--only <id>`, `--half-km 50`, `--observer-h 2`.

Speed: about 3 s per site at 20 m/px, so all sites take well under a minute.

## 3. What each file is

| File | Task |
|---|---|
| `terrain.py` | crop (T-24), Numba ray-casting `horizon_at`, 5x5 `grid_horizons` (T-25) |
| `illumination.py` | lit / Earth state (T-26), `shadow_dna` (T-27), `comm_forecast` (T-28) |
| `export.py` | writes the data contract fields `grid[]` and `dna` |
| `commForecast.ts` | TypeScript port of the forecast for Saeera (T-28) |
| `tests/` | pytest: compass directions, curvature, grid, DNA |
| `sample_data.py`, `demo.py` | fake data to test before the real files arrive |

Rules used (identical to the app prototype): lit when `sun_el > horizon[round(sun_az) % 360]`; Earth `ok` above 2.5 deg, `weak` 0 to 2.5, `lost` at or below 0. DNA covers the first 672 h; `comm` counts only reliable (`ok`) hours; transitions are sun on/off switches. Horizon includes Moon curvature (`d^2 / 2R`). Grid is 5x5, 1 km apart, `dx` = east, `dy` = north, centre = (0, 0).

## 4. Checks before you tell the team "done"

1. `python -m pytest pipeline/tests -q` passes.
2. T-25: plot `grid[12].horizon` (see `demo.py`). It should look like a mountain outline, values mostly 0 to 5 deg, not all the same number.
3. T-23/T-24: `--save-crops` prints each crop size. If a crop is over 50 MB use `--half-km 50`.
4. If you see `WARNING: x% ... no data`, that site is near the edge of the 80S map. Tell Atia/the team.

## 5. Things to tell the team (short messages)

- **Atia:** need `sites.yaml` (T-16) and the Sun/Earth arrays (T-17) so `dna` can be computed. Both are late on the plan.
- **Saeera:** `core/types.ts` `SiteData` has `lit[]`/`earth[]`, but the data contract on the Architecture sheet has only `grid[]` and `dna`. Agree who derives lit/earth in the app. `commForecast.ts` is ready for T-28.
- **Noshin:** `grid[]` has 25 horizons (index 12 is the site); `sample-<id>.json` is the T-29 file.
