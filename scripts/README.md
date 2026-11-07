# MoonScope — R1: Sun and Earth Ephemeris Pipeline

This component is responsible for generating high-precision astronomical position data for the Sun and Earth as observed from candidate Artemis III landing sites on the lunar surface. It forms the astronomical foundation of **MoonScope** (NASA Space Apps Challenge 2026), connecting directly to Humaira's terrain visibility pipeline (R2) and Saeera's mission simulator (R3).

---

## 1. What the R1 Pipeline Does

At the lunar South Pole, the Sun never climbs more than ~1.5° above or below the horizontal plane, while the Earth remains nearly stationary in the sky, librating within a window of ~6° to 9°. A lander's survival depends on:
1. When solar panels receive sunlight.
2. When the Earth is in line-of-sight for direct communication.

The R1 pipeline computes the topocentric (site-level) direction vectors toward the Sun and Earth from every candidate landing site for every hour of the mission observation window using NASA's official SPICE toolkit (`spiceypy`).

---

## 2. Environment and Requirements

### System Requirements
- OS: Windows (PowerShell / Command Prompt)
- Python: 3.10+ (tested on Python 3.13)
- No WSL, Anaconda, or Unix-specific dependencies required.

### Required Python Packages
```text
spiceypy >= 6.0.0
numpy >= 1.24.0
matplotlib >= 3.7.0
pytest >= 7.0.0
```

All required packages are standard and already installed in the Python environment.

---

## 3. SPICE Kernels and Locations

All kernels reside in `kernels/` and are resolved dynamically relative to the project root:

| Kernel Path | NAIF Type | Description & Purpose |
|---|---|---|
| `kernels/lsk/naif0012.tls` | LSK (Leapseconds) | Maps UTC epochs to Ephemeris Time (ET / TDB seconds past J2000). |
| `kernels/spk/de440s.bsp` | SPK (Ephemeris) | JPL DE440 planetary ephemeris, providing high-precision orbits of Sun, Earth, and Moon. |
| `kernels/pck/pck00011.tpc` | PCK (Text Constants) | IAU standard physical constants, including the Moon's reference radius (1,737.4 km). |
| `kernels/pck/moon_pa_de440_200625.bpc` | PCK (Binary Orientation) | High-accuracy DE440 lunar physical libration and orientation time series. |
| `kernels/fk/moon_de440_250416.tf` | FK (Frame Kernel) | Defines lunar body-fixed reference frames (`MOON_ME`, `MOON_PA`) aligned with DE440. |

---

## 4. Landing Site Configuration (`pipeline/sites.yaml`)

Sites are configured in `pipeline/sites.yaml`. The file includes all **nine Artemis III candidate landing sites** based on official NASA Artemis III announcements and Lunar Reconnaissance Orbiter (LRO LOLA/LROC) cartographic data:

```yaml
sites:
  - id: malapert
    name: Malapert Massif
    lat: -85.99
    lon: 359.70
    source: NASA Artemis III Candidate Region centroid (85.99 S, 0.30 W / 359.70 E)

  - id: mons-mouton
    name: Mons Mouton
    lat: -84.60
    lon: 31.00
    source: NASA Artemis III Candidate Region centroid (84.60 S, 31.00 E)

  - id: mons-mouton-plateau
    name: Mons Mouton Plateau
    lat: -84.30
    lon: 30.60
    source: NASA Artemis III Candidate Region / LRO LOLA plateau reference (84.30 S, 30.60 E)

  - id: nobile-rim-1
    name: Nobile Rim 1
    lat: -85.40
    lon: 37.40
    source: NASA Artemis III Candidate Region centroid (85.40 S, 37.40 E)

  - id: nobile-rim-2
    name: Nobile Rim 2
    lat: -83.90
    lon: 58.70
    source: NASA Artemis III Candidate Region centroid (83.90 S, 58.70 E)

  - id: haworth
    name: Haworth
    lat: -86.80
    lon: 337.20
    source: NASA Artemis III Candidate Region centroid (86.80 S, 22.80 W / 337.20 E)

  - id: de-gerlache-rim-2
    name: de Gerlache Rim 2
    lat: -88.20
    lon: 296.60
    source: NASA Artemis III Candidate Region centroid (88.20 S, 63.40 W / 296.60 E)

  - id: peak-near-cabeus-b
    name: Peak near Cabeus B
    lat: -85.40
    lon: 291.00
    source: NASA Artemis III Candidate Region / Cabeus ridge high ground (85.40 S, 69.00 W / 291.00 E)

  - id: slater-plain
    name: Slater Plain
    lat: -88.08
    lon: 111.29
    source: NASA Artemis III Candidate Region / Slater crater northern plain (88.08 S, 111.29 E)
```

### Coordinate Conventions
- **Latitude ($\phi$):** Planetocentric latitude in degrees $[-90, +90]$, with South negative.
- **Longitude ($\lambda$):** East-positive longitude in degrees $[0, 360)$, measured eastward from the lunar Prime Meridian ($0^\circ$).

---

## 5. Coordinate Frame Selection and Geometry

### Selected Lunar Body-Fixed Frame: `MOON_ME`
The pipeline uses the **`MOON_ME`** (Mean Earth / Polar Axis) frame specified by `moon_de440_250416.tf` (alias for `MOON_ME_DE440_ME421`).

**Why `MOON_ME`?**
1. Standard cartographic DEMs (including NASA LRO LOLA) use the Mean Earth / Polar Axis reference coordinate system, where the $+Z$ axis is the mean lunar rotation axis and the $+X$ axis aligns with the mean Earth direction ($0^\circ$ longitude).
2. The alternative `MOON_PA` (Principal Axes) frame is rotated by $\approx 0.029^\circ$ ($\approx 875\text{ m}$ on the lunar surface) from the cartographic grid; using `MOON_PA` with DEM coordinates would introduce a systematic angular and positional offset.
3. The legacy `IAU_MOON` frame uses an analytical truncation with errors up to $\approx 155\text{ m}$. In contrast, `MOON_ME` uses the high-precision DE440 numerical integration from `moon_pa_de440_200625.bpc`.

### Geometric Calculation Steps
1. **Target Position:** Calculate Moon-centered Sun and Earth position vectors in `MOON_ME` at ephemeris time $t$:
   $$\vec{r}_{\text{target}}(t) = \text{spkpos}(\text{target}, t, \text{"MOON\_ME"}, \text{"NONE"}, \text{"MOON"})$$
2. **Site Position:** Express site location on the reference sphere ($R = 1737.4\text{ km}$):
   $$\vec{r}_{\text{site}} = R \cdot [\cos\phi \cos\lambda, \; \cos\phi \sin\lambda, \; \sin\phi]$$
3. **Topocentric Vector:** Subtract site position to calculate the true observer-to-target vector:
   $$\vec{\rho} = \vec{r}_{\text{target}} - \vec{r}_{\text{site}}$$
   *(This correctly accounts for topocentric lunar parallax, up to $0.26^\circ$ for Earth).*
4. **Local Topocentric Basis:** Construct local orthonormal basis $(\hat{e}, \hat{n}, \hat{u})$:
   $$\hat{u} = [\cos\phi \cos\lambda, \; \cos\phi \sin\lambda, \; \sin\phi] \quad (\text{Local Zenith / Up})$$
   $$\hat{n} = [-\sin\phi \cos\lambda, \; -\sin\phi \sin\lambda, \; \cos\phi] \quad (\text{Local North})$$
   $$\hat{e} = [-\sin\lambda, \; \cos\lambda, \; 0] \quad (\text{Local East})$$
   where $\hat{e} \times \hat{n} = \hat{u}$.
5. **Projection:**
   $$x_{\text{east}} = \vec{\rho} \cdot \hat{e}, \quad y_{\text{north}} = \vec{\rho} \cdot \hat{n}, \quad z_{\text{up}} = \vec{\rho} \cdot \hat{u}$$
6. **Azimuth and Elevation:**
   $$\text{az} = \text{atan2}(x_{\text{east}}, y_{\text{north}}) \pmod{360^\circ} \in [0, 360^\circ)$$
   $$\text{el} = \text{atan2}(z_{\text{up}}, \sqrt{x_{\text{east}}^2 + y_{\text{north}}^2}) \in [-90^\circ, +90^\circ]$$

### Compass Convention
| Compass Direction | Azimuth |
|---|---:|
| North | $0^\circ$ |
| East | $90^\circ$ |
| South | $180^\circ$ |
| West | $270^\circ$ |

- Elevation: $0^\circ = \text{local horizontal plane}$, $+90^\circ = \text{zenith}$, negative = below horizontal.

---

## 6. How to Generate Ephemeris Data

Run the generator from the repository root:

```powershell
python scripts/generate_ephemeris.py
```

### CLI Arguments
- `--sites <path>`: Path to site configuration (default: `pipeline/sites.yaml`).
- `--outdir <path>`: Output directory (default: `web/public/data`).
- `--t0 <iso-utc>`: Start time in UTC (default: `2027-03-01T00:00:00Z`).
- `--step <hours>`: Sampling step in hours (default: `1`).
- `--n <count>`: Number of hourly observations (default: `8760` for 1 full year).

Example custom run (e.g. 74 days / 1,776 hours):
```powershell
python scripts/generate_ephemeris.py --n 1776
```

---

## 7. Output JSON Schema (`web/public/data/<site-id>.json`)

The output strictly contains the required 11 snake_case fields:

```json
{
  "id": "malapert",
  "name": "Malapert Massif",
  "lat": -85.99,
  "lon": 359.7,
  "t0": "2027-03-01T00:00:00Z",
  "step_h": 1,
  "n": 8760,
  "sun_az": [265.8679, 265.3618, ...],
  "sun_el": [-0.8609, -0.8971, ...],
  "earth_az": [4.3391, 4.2902, ...],
  "earth_el": [-2.2539, -2.225, ...]
}
```

### Rules Followed
- No terrain-pipeline keys (`grid`, `horizon`, `dna`, `lit`, `earth`).
- Array lengths are strictly equal to $n$.
- All values are finite floating-point numbers rounded to 4 decimal places.
- No `NaN`, `Infinity`, or nulls.

---

## 8. Validation and Testing (T-18)

Run the full pytest suite:

```powershell
pytest scripts/tests -v
```

### Test Coverage (107 Tests)
1. **`test_data_validation.py` (42 tests):**
   - Validates all 9 site JSON files.
   - Enforces snake_case keys and verifies absence of forbidden keys.
   - Ensures array lengths equal $n = 8760$.
   - Confirms all values are finite and within bounds: $\text{az} \in [0, 360)$, $\text{el} \in [-90, +90]$.
   - Checks epoch consistency across all sites.
2. **`test_spice_validation.py` (6 tests):**
   - Kernel loading and SPICE database integrity.
   - Distinct existence of `MOON_ME` and `MOON_PA` frames.
   - Moon radii matching $1737.4\text{ km}$.
   - Topocentric parallax verification ($> 0.05^\circ$ for Earth).
   - Local basis orthonormality and right-handedness ($\hat{e} \times \hat{n} = \hat{u}$).
   - Known geometric test vectors (North, East, South, West, Zenith).
3. **`test_physical_sanity.py` (41 tests):**
   - Sun and Earth directions are never coincident.
   - Sun elevation constrained to $[-10^\circ, +8^\circ]$ at polar latitudes.
   - Solar diurnal revolution rate: $-0.508^\circ/\text{hr}$ (decreases clockwise in southern hemisphere, completing $\approx -12.36$ turns/year).
   - Earth libration boundedness: peak-to-peak elevation range $\approx 10^\circ \text{--} 16^\circ$.
   - Hourly continuity: $\Delta \text{el} < 0.1^\circ/\text{hr}$.
4. **`test_integration.py` (18 tests):**
   - Compatibility with Humaira's R2 exporter (preserves R1 ephemeris arrays bit-for-bit).
   - Compatibility with Saeera's TypeScript loader and `simulate()` function.

### Generating Validation Plots
```powershell
python scripts/plot_validation.py
```
Outputs saved in `results/validation/`:
- `all_sites_elevation_comparison.png`
- `<site-id>_1year_overview.png` (Sun & Earth elevation/azimuth over 365 days)
- `<site-id>_first_month.png` (28-day zoom)

---

## 9. Pipeline Connections

```text
       [R1: SPICE Ephemeris]
                 │
                 ▼
       web/public/data/<site>.json
       (sun_az, sun_el, earth_az, earth_el)
                 │
                 ▼
       [R2: Humaira's Terrain Pipeline]
       Adds: horizon (360), lit, earth, grid, dna
                 │
                 ▼
       [R3: Saeera's Mission Simulator]
       realSites.ts converts to camelCase SiteData:
       (sunAz, sunEl, earthAz, earthEl, horizon, lit, earth)
                 │
                 ▼
       SimResult (soc, minSoc, verdict, litPct, earthOkPct)
```

---

## 10. Known Limitations and Assumptions

1. **Reference Sphere vs Topography:**
   - Topocentric site vectors are computed on a sphere of radius $R = 1,737.4\text{ km}$.
   - Local topographic elevation differences ($\pm 3\text{ km}$) alter the site position vector by $< 0.17\%$, introducing an angular parallax variation of $< 0.0004^\circ$ for Earth and negligible for Sun. This effect is negligible compared to terrain horizon masking ($> 1^\circ$).
2. **Atmospheric Refraction:**
   - The Moon has no atmosphere; no atmospheric refraction correction is applied.
3. **Aberration:**
   - Geometric position (`NONE`) is used consistently for both Sun and Earth. Light-time from Earth ($\approx 1.28\text{ s}$) produces a negligible displacement ($\approx 0.0003^\circ$) compared to the hourly sampling interval.
4. **Coordination with R2:**
   - Coordinates currently use official NASA Artemis III region reference points. When Humaira's pixel-snapped coordinates (`sites.snapped.yaml`) are merged, `pipeline/sites.yaml` should be updated to ensure identical coordinates.

