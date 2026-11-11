# Method: terrain, shadow and Earth-contact data (R2)

How `pipeline/` turns NASA's Moon height map into the `grid` and `dna` fields of `web/public/data/<site>.json`.

## 1. Inputs

| What | Source |
|---|---|
| Height map | LOLA south-pole DEM, 20 m/pixel (`LDEM_80S_20MPP_ADJ`), NASA PGDA product 90. Polar stereographic, Moon sphere R = 1,737,400 m. |
| Sun and Earth directions | `pipeline/ephemeris.py` and `sky.py`: ERFA planetary positions plus the IAU 2009 Moon orientation model, computed from the site's own position (Earth is only ~400,000 km away, so ignoring the site's offset from the Moon's centre would put Earth about 0.25 degrees too high). Hourly, from 1 March 2027 00:00 UTC (the app's planned landing), for one year (8,760 hours). Checked against NASA SPICE (DE440), see section 4. |
| Site points | `pipeline/sites.snapped.yaml` (see section 5), starting from NASA's region centres in `pipeline/sites.nasa9.yaml` (Atia, T-16). |

## 2. Horizon (T-24, T-25)

1. The site's lat/lon is projected to x/y with pyproj, and a 150 km square window of the DEM is read around it (`crop_dem`).
2. From the site, rays are cast across the DEM in 360 directions, one per compass degree (0 = north, 90 = east). Each ray steps pixel by pixel and keeps the largest elevation angle. This is `horizon[360]` (`horizon_at`, Numba).
3. Local north and east are taken from pyproj at each site, so the result does not depend on how the DEM grid is oriented.
4. **Curvature correction:** at distance d the ground drops by d²/(2R) because the Moon is round, so that amount is subtracted from each sample before taking the angle.
5. This is repeated for a 5x5 grid of points 1 km apart (`grid_horizons`). That gives 25 horizons per site, which powers the "Move N km" what-ifs in the app.
6. **Near-field cut and lander height.** Rays start 200 m from the lander (`min_dist_m`) and the lander is 2 m above the ground (`--observer-h 2`). An earlier version started at the nearest 20 m pixel at ground level. A DEM pixel a few metres higher next to the site then read as a 10 degree mountain, and because rays in a whole 45-degree sector hit the same neighbouring pixel, the horizon came out as flat steps (at Malapert: exactly 10.2 degrees for 67 degrees of azimuth, then exactly 11.6 degrees for 72 degrees). On flat ground with only 2 m of noise the old code gave a mean horizon of 2.8 degrees; the new code gives 0.3 degrees. This matters because the Sun is only a few degrees above the horizon at the pole.

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
| Sun elevation range vs. physics | Sub-solar latitude stays within about +/-1.55 degrees (the Moon's axial tilt). The highest Sun at a site is about 91.5 degrees minus the site's southern latitude, e.g. 7.5 degrees at 84S. Our values stay at or below that ceiling (e.g. Mons Mouton at 84.4S: Sun up to 7.1 degrees over the year, right at the 7.1 degree ceiling). |
| Earth libration | Sub-Earth point swings about +/-6.8 degrees in latitude and +/-7.8 degrees in longitude, matching the known libration of about +/-6.7 and +/-7.7 degrees. |
| Horizon on flat noisy ground | Flat ground with 2 m of random noise gives a mean horizon of 0.3 degrees and no step-shaped plateaus (the old code: 2.8 degrees and plateaus up to 90 degrees wide). Tested in `test_terrain.py`. |
| Code tests | 23 pytest tests pass (synthetic ridge with a known angle, wrap-around at north, near-field handling, DNA rules, ephemeris sanity, NASA-map reader). |
| Python and TypeScript DNA agree | Identical on a synthetic site. |
| Sun/Earth sky against NASA SPICE (DE440 ephemeris and lunar principal-axis orientation, Atia's method) | At five sites over 74 days: Sun elevation within 0.002 degrees, Earth elevation within 0.003 degrees, azimuths within 0.004 degrees. An earlier version ignored the parallax of the site on the Moon's surface and put Earth 0.25 degrees too high; that was found by this comparison and fixed. |

**Comparison with NASA's published values (T-30).** Sunlit and Earth-link fractions for each site, over the first 28 days (what the Shadow DNA page shows) and over the full year of data, with NASA's screening thresholds applied to the full-year figures. This block is rewritten from the site files by `pipeline/update_method.py` (run_all.bat does it), so it always matches the data in the repo:

<!-- T30-AUTO-START -->
| Site | Mean horizon | Sunlit, first 28 days (app DNA) | Sunlit, 1 year | Earth link OK, first 28 days | Earth link OK, 1 year | Sunlit at least 33% (1 yr) | Earth at least 50% (1 yr) |
|---|---|---|---|---|---|---|---|
| Malapert Massif | -2.7 deg | 82% | 84% | 84% | 87.73% | yes | yes |
| de Gerlache Rim 2 | -0.9 deg | 59% | 64% | 45% | 47.26% | yes | no |
| Haworth | -0.6 deg | 43% | 63% | 42% | 44.09% | yes | no |
| Nobile Rim 1 | -1.6 deg | 63% | 63% | 58% | 61.58% | yes | yes |
| Slater Plain | -0.9 deg | 50% | 61% | 30% | 31.43% | yes | no |
| Nobile Rim 2 | 0.6 deg | 54% | 52% | 57% | 59.87% | yes | yes |
| Mons Mouton Plateau | -0.2 deg | 53% | 51% | 76% | 80.25% | yes | yes |
| Mons Mouton | 0.4 deg | 48% | 48% | 85% | 86.96% | yes | yes |
| Peak near Cabeus B | 1.7 deg | 39% | 45% | 49% | 51.48% | yes | yes |

Result: 9 of 9 sites pass the sunlight threshold; 6 of 9 pass the Earth threshold (below it: de Gerlache Rim 2, Haworth, Slater Plain).
Our best full-year sunlit value is 84% (median of the lit sites 61%), against 77.1% to 88.0% published for the best points. The best site reaches the published best-point range.
<!-- T30-AUTO-END -->

How to read it:

- **NASA screening thresholds.** The NASA abstracts we found (LPSC 2024 abstract 1695, LPSC 2025 abstract 2655, LPSC 2026 abstract 1901) give thresholds, not per-site tables: a site should be sunlit at least 33% of the time and see Earth at least 50% of the time. The table checks our values against those rules; it is not a comparison with NASA's measured values.
- **Published illumination values.** Glaeser et al. (2014, Icarus 243, 78-90) computed illumination from LOLA terrain for the south pole. Their abstract gives average illumination of 77.1% to 88.0% at the best points of a 50 x 50 km region, highest on the ridge between Shackleton and de Gerlache craters. Those are the best points of a whole polar area, while ours are one point per 15 km region.
- **Why the Sun alone gives about 50%.** Over a year the Sun's elevation at a polar site averages about 0 degrees, so a site whose horizon sits near 0 degrees is lit about half the time. Only a point whose horizon is negative in the Sun's directions, a high peak looking down on its surroundings, can approach 80%.
- **Why the numbers are not directly comparable.** NASA reports long-term averages over the 18.6-year lunar cycle at a stated height above ground; ours cover one year from a fixed date (1 March 2027) with the lander 2 m above ground, and treat the Sun as a point. The first 28 days differ from the full year by a few points because the Sun's path changes through the year.

**Direct comparison with NASA's illumination maps (PGDA product 69, Mazarico et al. 2011).** These are 18.6-year averages of the Sun's visibility (and of Earth's visibility) at 60 to 240 m per pixel. `pipeline/compare_nasa.py` reads them at each of our points. NASA counts Earth as visible if any part of its disc is above the horizon, so the Earth column compares with our margin above 0 degrees, not the stricter 2.5 degree rule.

<!-- NASA69-START -->
| Site | Ours: sunlit (1 yr) | NASA: at our point | Ours minus NASA (point) | NASA: mean within 1 km | NASA: max within 1 km | Ours: Earth visible (1 yr) | NASA Earth: at our point | Ours minus NASA (Earth) |
|---|---|---|---|---|---|---|---|---|
| de Gerlache Rim 2 | 64% | 57% | +6 points | 45% | 74% | 58% | 62% | -3 points |
| Haworth | 63% | 60% | +3 points | 32% | 63% | 56% | 61% | -5 points |
| Malapert Massif | 84% | 85% | -0 points | 44% | 85% | 100% | 71% | +29 points |
| Mons Mouton Plateau | 51% | 50% | +1 points | 41% | 54% | 100% | 100% | +0 points |
| Mons Mouton | 48% | 49% | -1 points | 35% | 54% | 100% | 100% | +0 points |
| Nobile Rim 1 | 63% | 62% | +1 points | 43% | 68% | 76% | 86% | -10 points |
| Nobile Rim 2 | 52% | 54% | -2 points | 42% | 54% | 74% | 80% | -6 points |
| Peak near Cabeus B | 45% | 40% | +6 points | 37% | 42% | 64% | 57% | +8 points |
| Slater Plain | 61% | 66% | -5 points | 37% | 66% | 45% | 49% | -4 points |

Sun, exact point: mean absolute difference 2.7 points, 9 of 9 sites within 10 points, correlation 0.96.
Earth, exact point: mean absolute difference 7.1 points, 8 of 9 sites within 10 points, correlation 0.84.
More than 10 points apart at the exact point. Sun: none. Earth: Malapert Massif (+29).
The NASA mean and max within 1 km are shown for context only: each of our points is the best-lit spot found in its region, so it sits above the average of its surroundings (illumination changes a lot over a few hundred metres). The exact-point columns are the fair comparison.
<!-- NASA69-END -->

What the comparison shows (figures from the run above, full-year data):

- **Sunlight matches NASA.** At the exact point of every site, our one-year sunlit fraction is within 6 points of NASA's 18.6-year average (mean difference about 3 points; the largest gaps are de Gerlache Rim 2 and Peak near Cabeus B at +6 and Slater Plain at -5). Nothing in our pipeline was tuned or fitted to NASA's maps: we use LOLA terrain and our own Sun positions, and the point-selection step ranks candidates with our own model.
- **Why NASA's 1 km mean is much lower.** Each of our points is the best-lit spot found in its region, so it sits above the average of its surroundings (for example Malapert: 84% at the point, 44% averaged over 1 km, NASA 85% at the same point). The exact-point columns are the fair comparison; the 1 km columns only show how local the bright spots are.
- **Earth contact matches at 8 of 9 sites, with one clear exception.** Nobile Rim 1 is about 10 points lower than NASA (76% against 86%); every other site except Malapert is within 8 points. At **Malapert our Earth visibility is 100% while NASA's map says 71%**. We have not tested why. Possible reasons: (1) our horizon ignores terrain within 200 m of the lander and puts the lander 2 m above ground, while NASA's map is computed per 120 m pixel at ground level, so small summit features that block a low Earth are invisible to us; (2) NASA may average how much of Earth's disc is visible, while we count Earth as visible whenever its centre is above the ridge; (3) NASA averages 18.6 years and we cover one. Until this is tested, read our Malapert Earth figure as an upper bound.
- **Limits of this test.** It compares one 120 m NASA pixel with one exact point of ours (we work at 20 m), one year with 18.6 years, and a Sun treated as a point with a Sun treated as a disc. Agreement within about 6 points under those differences is a good sign, not a proof that every number is right.

## 5. Choosing the site points

NASA's regions are about 15 km wide and only small parts of them are well lit, so a rough coordinate can land in shadow. `snap_sites.py` searches a circle around each start point (7.5 km; 25 km for Haworth), skips ground steeper than 10 degrees, and keeps the point with the best score `lit + 0.5 * Earth ok` over the first 672 hours. It ranks candidates with a coarser, faster horizon, and the final numbers are recomputed with the full pipeline, so they differ slightly.

The chosen points for all nine sites are in `pipeline/sites.snapped.yaml`, and the NASA region centres they started from are in `pipeline/sites.nasa9.yaml`.

The start points are NASA region centres, so the chosen points are best-scoring spots within a few km of them, not NASA's exact landing sites. Sites that move a long way or score low (see the printout of `snap_sites.py`) should be treated as weaker candidates. Slater Plain shows why the start point matters. NASA describes it as the plain north of Slater crater, which an LPSC 2025 abstract (no. 2401) places at about 88S, 111E. Our first start point (88.08S, 111.29E) was within about 5 km of that crater centre and came out 0% sunlit, and the best point found beside it was no better. Starting about 20 km farther north (87.4S, 111.0E) gives a chosen point of 87.44S, 113.70E that is sunlit about 61% of the year but has reliable Earth contact only about 31% of the time, so it passes the sunlight threshold and fails the Earth threshold. The crater position in the abstract is rounded, so this start point is our best reading of "north of the crater", not a NASA coordinate.

## 6. Known limits

- The lander is assumed to stand on a flat pad: ground within 200 m is ignored and the lander is 2 m above the surface. A boulder or rim closer than 200 m would block more sky than we model.
- The 20 m DEM can miss small boulders and craters near the site. LOLA 5 m maps exist for some sites.
- The 150 km crop ignores terrain farther than about 75 km, which matters little for a Sun a few degrees above the horizon.
- Sun and Earth are treated as points (disc centre). The Sun is about 0.5 degrees wide, so edge cases are lit slightly less often than in reality.
- No secondary illumination (light scattered off other terrain) is modelled.
- DNA covers only the first 28 days after the planned landing. Other start dates will differ.
- The app reads the real files through `web/src/core/sites.ts` (`loadRealSites`). It falls back to the sample data if any site file is missing.

## 7. Re-running everything

```
pip install -r pipeline/requirements.txt
python pipeline/snap_sites.py --dem data/LDEM_80S_20MPP_ADJ.tiff --sites pipeline/sites.nasa9.yaml --observer-h 2
python pipeline/sky.py    --sites pipeline/sites.snapped.yaml --out web/public/data --hours 8760 --force
python pipeline/export.py --dem data/LDEM_80S_20MPP_ADJ.tiff --sites pipeline/sites.snapped.yaml --out web/public/data --observer-h 2
python pipeline/update_method.py --data web/public/data --doc docs/METHOD.md
python -m pytest pipeline/tests -q
```
(`pipeline/run_all.bat` runs all of this on Windows.) Use `--force` for the sky step whenever the site points moved, because the Sun and Earth directions depend on the exact position.
