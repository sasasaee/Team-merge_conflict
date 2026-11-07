# Method: terrain, shadow and Earth-contact data (R2)

How `pipeline/` turns NASA's Moon height map into the `grid` and `dna` fields of `web/public/data/<site>.json`.

## 1. Inputs

| What | Source |
|---|---|
| Height map | LOLA south-pole DEM, 20 m/pixel (`LDEM_80S_20MPP_ADJ`), NASA PGDA product 90. Polar stereographic, Moon sphere R = 1,737,400 m. |
| Sun and Earth directions | `pipeline/ephemeris.py` and `sky.py`: ERFA planetary positions plus the IAU 2009 Moon orientation model, computed from the site's own position (Earth is only ~400,000 km away, so ignoring the site's offset from the Moon's centre would put Earth about 0.25 degrees too high). Hourly, from 1 March 2027 00:00 UTC (the app's planned landing), 74 days. Checked against NASA SPICE (DE440), see section 4. |
| Site points | `pipeline/sites.snapped.yaml` (see section 5), starting from NASA's region centres in `pipeline/sites.nasa9.yaml` (Atia, T-16). |

## 2. Horizon (T-24, T-25)

1. The site's lat/lon is projected to x/y with pyproj, and a 150 km square window of the DEM is read around it (`crop_dem`).
2. From the site, rays are cast across the DEM in 360 directions, one per compass degree (0 = north, 90 = east). Each ray steps pixel by pixel and keeps the largest elevation angle. This is `horizon[360]` (`horizon_at`, Numba).
3. Local north and east are taken from pyproj at each site, so the result does not depend on how the DEM grid is oriented.
4. **Curvature correction:** at distance d the ground drops by d²/(2R) because the Moon is round, so that amount is subtracted from each sample before taking the angle.
5. This is repeated for a 5x5 grid of points 1 km apart (`grid_horizons`). That gives 25 horizons per site, which powers "move 2 km east" in the app.

Negative horizon values are normal on a high spot: the ground falls away below the flat plane in that direction.

## 3. Sunlit, Earth contact and Shadow DNA (T-26, T-27)

For every hour, with `ridge(az) = horizon[round(az) mod 360]`:

- **Sunlit** if `sun_el > ridge(sun_az)`. The Sun's centre is used, like the app.
- **Earth link** from `margin = earth_el - ridge(earth_az)`:
  - `ok` if margin > 2.5 degrees (reliable)
  - `weak` if 0 < margin <= 2.5 degrees (unreliable, amber in the UI)
  - `lost` if margin <= 0 (signal loss, red in the UI)

The 2.5 degree rule gives some safety against small errors in the DEM and in antenna pointing.

`dna` is computed over the first 672 hours (28 days) after landing:

| Field | Meaning |
|---|---|
| `lit` | fraction of hours sunlit |
| `comm` | fraction of hours with a reliable (`ok`) Earth link |
| `longest_day_h` / `longest_night_h` | longest unbroken run of lit / unlit hours |
| `longest_blackout_h` | longest unbroken run of `lost` |
| `transitions` | number of sun on/off switches |

The signal-loss forecast (T-28, `comm_forecast`) lists every `weak` and `lost` stretch as `{start, end, type}` in hours. `commForecast.ts` is its TypeScript port. The Shadow DNA page (T-54) recomputes the same numbers in TypeScript from the JSON; the TypeScript and Python results were checked against each other on test data and match exactly.

## 4. Validation (T-30)

What has been checked so far:

| Check | Result |
|---|---|
| Georeferencing: DEM height at the starting points against NASA's region descriptions | Malapert +5.12 km, Mons Mouton +4.95 km, Nobile Rim 1 +6.07 km. Malapert and Mons Mouton agree with the roughly +5 km usually quoted for these massifs. Nobile Rim 1 is higher than the rough +3 km we expected; that reference was approximate and should be checked against a NASA source. |
| Projection: the DEM's CRS against the CRS the code assumes | Identical positions. |
| Sun elevation range vs. physics | Sub-solar latitude stays within about +/-1.55 degrees (the Moon's axial tilt). The highest Sun at a site is about 91.5 degrees minus the site's southern latitude, e.g. 7.5 degrees at 84S. Our values stay below that ceiling (e.g. Mons Mouton at 84.1S: Sun up to 4.9 degrees over the 74 days). |
| Earth libration | Sub-Earth point swings about +/-6.8 degrees in latitude and +/-7.8 degrees in longitude, matching the known libration of about +/-6.7 and +/-7.7 degrees. |
| Code tests | 14 pytest tests pass (synthetic ridge with a known angle, wrap-around at north, DNA rules, ephemeris sanity). |
| Python and TypeScript DNA agree | Identical on a synthetic site. |
| Sun/Earth sky against NASA SPICE (DE440 ephemeris and lunar principal-axis orientation, Atia's method) | At five sites over 74 days: Sun elevation within 0.002 degrees, Earth elevation within 0.003 degrees, azimuths within 0.004 degrees. An earlier version ignored the parallax of the site on the Moon's surface and put Earth 0.25 degrees too high; that was found by this comparison and fixed. |

**Still open:** a comparison of our sunlit and Earth-visibility fractions against NASA's published per-region numbers. The NASA papers we found (LPSC 2024 abstract 1695, LPSC 2025 abstract 2655, LPSC 2026 abstract 1901) give screening thresholds and maps, not tables of numbers: for instance, a site should be sunlit at least 33% of the time and see Earth at least 50% of the time. The per-region values are in figures that must be read from the papers. Our own per-site values are in the `dna` field of each `web/public/data/<site>.json` (`lit` = sunlit fraction, `comm` = reliable Earth-link fraction).

Differences are expected: NASA reports long-term averages over the 18.6-year lunar cycle, at specific heights above ground, while our numbers cover 28 days from a fixed date.

## 5. Choosing the site points

NASA's regions are about 15 km wide and only small parts of them are well lit, so a rough coordinate can land in shadow. `snap_sites.py` searches a circle around each start point (7.5 km; 25 km for Haworth), skips ground steeper than 10 degrees, and keeps the point with the best score `lit + 0.5 * Earth ok` over the first 672 hours. It ranks candidates with a coarser, faster horizon, and the final numbers are recomputed with the full pipeline, so they differ slightly.

The chosen points for all nine sites are in `pipeline/sites.snapped.yaml`, and the NASA region centres they started from are in `pipeline/sites.nasa9.yaml`.

The start points are NASA region centres, so the chosen points are best-scoring spots within a few km of them, not NASA's exact landing sites. Sites that move a long way or score low (see the printout of `snap_sites.py`) should be treated as weaker candidates.

## 6. Known limits

- The horizon is computed from a height point at ground level (observer height 0), which is slightly pessimistic for a lander.
- The 20 m DEM can miss small boulders and craters near the site. LOLA 5 m maps exist for some sites.
- The 150 km crop ignores terrain farther than about 75 km, which matters little for a Sun a few degrees above the horizon.
- Sun and Earth are treated as points (disc centre). The Sun is about 0.5 degrees wide, so edge cases are lit slightly less often than in reality.
- No secondary illumination (light scattered off other terrain) is modelled.
- DNA covers only the first 28 days after the planned landing. Other start dates will differ.
- The app reads the real files through `web/src/core/sites.ts` (`loadRealSites`). It falls back to the sample data if any site file is missing.

## 7. Re-running everything

```
pip install -r pipeline/requirements.txt
python pipeline/snap_sites.py --dem data/LDEM_80S_20MPP_ADJ.tiff --sites pipeline/sites.nasa9.yaml
python pipeline/sky.py    --sites pipeline/sites.snapped.yaml --out web/public/data
python pipeline/export.py --dem data/LDEM_80S_20MPP_ADJ.tiff --sites pipeline/sites.snapped.yaml --out web/public/data
python -m pytest pipeline/tests -q
```
