"""
MoonScope R1: Generate Sun and Earth Position Data using SPICE.

Calculates hourly topocentric azimuth and elevation of the Sun and Earth
from candidate landing sites on the lunar surface.

Output Format:
  web/public/data/<site-id>.json
  {
    "id": "site-id",
    "name": "Site Name",
    "lat": -85.99,
    "lon": 359.70,
    "t0": "2027-03-01T00:00:00Z",
    "step_h": 1,
    "n": 8760,
    "sun_az": [...],
    "sun_el": [...],
    "earth_az": [...],
    "earth_el": [...]
  }
"""

from __future__ import annotations
import argparse
import json
import math
import os
from pathlib import Path
from typing import Any, Dict, List
import numpy as np
import spiceypy as spice

# Avoid matplotlib / font cache warnings if imported elsewhere
os.environ.setdefault("MPLCONFIGDIR", str(Path(__file__).resolve().parent / ".cache"))

PROJECT_ROOT = Path(__file__).resolve().parents[1]
KERNEL_DIR = PROJECT_ROOT / "kernels"
DEFAULT_SITES_PATH = PROJECT_ROOT / "pipeline" / "sites.yaml"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "web" / "public" / "data"

# Standard kernels required for Moon body-fixed topocentric calculations
KERNEL_FILES = [
    KERNEL_DIR / "lsk" / "naif0012.tls",
    KERNEL_DIR / "spk" / "de440s.bsp",
    KERNEL_DIR / "pck" / "pck00011.tpc",
    KERNEL_DIR / "pck" / "moon_pa_de440_200625.bpc",
    KERNEL_DIR / "fk" / "moon_de440_250416.tf",
]

# Lunar reference frame:
# MOON_ME is the Mean Earth / Polar Axis frame associated with DE440
# (alias for MOON_ME_DE440_ME421 defined in moon_de440_250416.tf).
# This frame matches the standard cartographic coordinate system used
# by NASA lunar DEMs (such as LOLA) and planetocentric coordinates.
LUNAR_FRAME = "MOON_ME"

# Aberration correction:
# Geometric state ("NONE") represents the true instantaneous geometric position
# relative to the Moon center, which is standard for topocentric ephemeris generation.
ABCORR = "NONE"

# Default time configuration: 1 full year starting at planned Artemis mission epoch
DEFAULT_T0 = "2027-03-01T00:00:00Z"
DEFAULT_STEP_H = 1
DEFAULT_N = 8760  # 365 days * 24 hours


def load_kernels(kernel_paths: List[Path] | None = None) -> None:
    """Load all necessary SPICE kernels."""
    paths = kernel_paths or KERNEL_FILES
    for path in paths:
        if not path.exists():
            raise FileNotFoundError(f"SPICE kernel not found: {path}")
        spice.furnsh(str(path))


def unload_kernels() -> None:
    """Unload all SPICE kernels from memory."""
    spice.kclear()


def parse_sites_yaml(file_path: Path) -> List[Dict[str, Any]]:
    """
    Parse landing sites from a YAML configuration file.
    Uses PyYAML if available, otherwise falls back to a lightweight built-in parser
    to avoid hard dependencies.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"Sites configuration file not found: {file_path}")

    try:
        import yaml  # type: ignore
        with open(file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            return data.get("sites", [])
    except ImportError:
        pass

    # Built-in lightweight YAML parser for site configurations
    sites: List[Dict[str, Any]] = []
    current_site: Dict[str, Any] = {}
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("- id:"):
                if current_site and "id" in current_site:
                    sites.append(current_site)
                current_site = {"id": line.split(":", 1)[1].strip()}
            elif current_site:
                if line.startswith("id:"):
                    current_site["id"] = line.split(":", 1)[1].strip()
                elif line.startswith("name:"):
                    current_site["name"] = line.split(":", 1)[1].strip()
                elif line.startswith("lat:"):
                    current_site["lat"] = float(line.split(":", 1)[1].strip())
                elif line.startswith("lon:"):
                    current_site["lon"] = float(line.split(":", 1)[1].strip())
                elif line.startswith("source:"):
                    current_site["source"] = line.split(":", 1)[1].strip()

        if current_site and "id" in current_site:
            sites.append(current_site)

    if not sites:
        raise ValueError(f"No sites could be parsed from {file_path}")

    return sites


def get_lunar_radius_km() -> float:
    """
    Retrieve Moon mean radius in kilometers from PCK kernel.
    Falls back to standard 1737.4 km if query fails.
    """
    try:
        radii = spice.bodvrd("MOON", "RADII", 3)[1]
        return float(radii[0])
    except Exception:
        return 1737.4


def compute_site_ephemeris(
    site: Dict[str, Any],
    ets: np.ndarray,
    sun_pos_me: np.ndarray,
    earth_pos_me: np.ndarray,
    r_moon_km: float,
) -> Dict[str, Any]:
    """
    Calculate topocentric Sun and Earth azimuth and elevation for a given site.

    Site coordinates:
      - lat: Planetocentric latitude (-90 to +90 degrees)
      - lon: East-positive longitude (0 to 360 degrees)

    Topocentric coordinate frame:
      - Up (u): Unit normal outward from sphere surface
      - North (n): Tangent unit vector pointing North
      - East (e): Tangent unit vector pointing East
      Orthonormality: e x n = u

    Conventions:
      - Azimuth: Measured clockwise from North (0° North, 90° East, 180° South, 270° West).
      - Elevation: Angle above local horizontal plane (-90° to +90°).
    """
    lat_deg = float(site["lat"])
    lon_deg = float(site["lon"]) % 360.0

    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)

    cos_lat = math.cos(lat)
    sin_lat = math.sin(lat)
    cos_lon = math.cos(lon)
    sin_lon = math.sin(lon)

    # Site position vector in lunar body-fixed frame MOON_ME (km)
    # Using spherical reference surface consistent with DEM radius
    r_site = r_moon_km * np.array([cos_lat * cos_lon, cos_lat * sin_lon, sin_lat])

    # Local topocentric unit vectors (East, North, Up)
    e_hat = np.array([-sin_lon, cos_lon, 0.0])
    n_hat = np.array([-sin_lat * cos_lon, -sin_lat * sin_lon, cos_lat])
    u_hat = np.array([cos_lat * cos_lon, cos_lat * sin_lon, sin_lat])

    # Topocentric target vectors: rho = pos_target - r_site (shape: N x 3)
    rho_sun = sun_pos_me - r_site
    rho_earth = earth_pos_me - r_site

    # Project onto local basis
    # Sun
    sun_east = np.dot(rho_sun, e_hat)
    sun_north = np.dot(rho_sun, n_hat)
    sun_up = np.dot(rho_sun, u_hat)
    sun_horiz = np.hypot(sun_east, sun_north)

    # Azimuth: clockwise from North toward East in [0, 360)
    sun_az = (np.degrees(np.arctan2(sun_east, sun_north)) + 360.0) % 360.0
    # Elevation: angle above horizon in [-90, +90]
    sun_el = np.degrees(np.arctan2(sun_up, sun_horiz))

    # Earth
    earth_east = np.dot(rho_earth, e_hat)
    earth_north = np.dot(rho_earth, n_hat)
    earth_up = np.dot(rho_earth, u_hat)
    earth_horiz = np.hypot(earth_east, earth_north)

    earth_az = (np.degrees(np.arctan2(earth_east, earth_north)) + 360.0) % 360.0
    earth_el = np.degrees(np.arctan2(earth_up, earth_horiz))

    # Round to 4 decimal places for compact, high-precision storage
    return {
        "sun_az": [round(float(v), 4) for v in sun_az],
        "sun_el": [round(float(v), 4) for v in sun_el],
        "earth_az": [round(float(v), 4) for v in earth_az],
        "earth_el": [round(float(v), 4) for v in earth_el],
    }


def generate_all(
    sites_path: Path = DEFAULT_SITES_PATH,
    output_dir: Path = DEFAULT_OUTPUT_DIR,
    t0_str: str = DEFAULT_T0,
    step_h: int = DEFAULT_STEP_H,
    n_obs: int = DEFAULT_N,
) -> List[Path]:
    """
    Generate astronomical position data for all configured landing sites.
    Saves JSON files into output_dir/<site_id>.json.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    sites = parse_sites_yaml(sites_path)

    print(f"Loading SPICE kernels from {KERNEL_DIR}...")
    load_kernels()

    try:
        r_moon_km = get_lunar_radius_km()
        print(f"Lunar reference radius: {r_moon_km:.2f} km")
        print(f"Frame: {LUNAR_FRAME}, Aberration: {ABCORR}")
        print(f"Epoch t0: {t0_str}, Step: {step_h} h, Count: {n_obs}")

        # Convert epoch string to Ephemeris Time (ET seconds past J2000 TDB)
        t0_et = spice.str2et(t0_str)
        step_sec = step_h * 3600.0
        ets = t0_et + np.arange(n_obs) * step_sec

        print(f"Calculating Moon-centered Sun and Earth positions ({n_obs} hours)...")
        # Vectorized call: spkpos accepts array of ETs
        sun_pos_me, _ = spice.spkpos("SUN", ets, LUNAR_FRAME, ABCORR, "MOON")
        earth_pos_me, _ = spice.spkpos("EARTH", ets, LUNAR_FRAME, ABCORR, "MOON")

        written_files: List[Path] = []
        for site in sites:
            site_id = site["id"]
            site_name = site["name"]
            lat = float(site["lat"])
            lon = float(site["lon"])

            print(f"Processing site: {site_name} (ID: {site_id}, lat={lat:.2f}, lon={lon:.2f})...")
            ephem = compute_site_ephemeris(site, ets, sun_pos_me, earth_pos_me, r_moon_km)

            data = {
                "id": site_id,
                "name": site_name,
                "lat": lat,
                "lon": lon,
                "t0": t0_str,
                "step_h": step_h,
                "n": n_obs,
                "sun_az": ephem["sun_az"],
                "sun_el": ephem["sun_el"],
                "earth_az": ephem["earth_az"],
                "earth_el": ephem["earth_el"],
            }

            out_file = output_dir / f"{site_id}.json"
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)

            written_files.append(out_file)
            print(f"  -> Saved {out_file.name} ({len(ephem['sun_az'])} samples)")

        print(f"\nSuccessfully generated {len(written_files)} site ephemeris files in {output_dir}.")
        return written_files

    finally:
        unload_kernels()


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate MoonScope Sun and Earth ephemeris via SPICE.")
    parser.add_argument("--sites", type=Path, default=DEFAULT_SITES_PATH, help="Path to sites.yaml")
    parser.add_argument("--outdir", type=Path, default=DEFAULT_OUTPUT_DIR, help="Output directory for JSON")
    parser.add_argument("--t0", type=str, default=DEFAULT_T0, help="Initial UTC observation epoch")
    parser.add_argument("--step", type=int, default=DEFAULT_STEP_H, help="Observation step in hours")
    parser.add_argument("--n", type=int, default=DEFAULT_N, help="Number of hourly observation points")

    args = parser.parse_args()
    generate_all(
        sites_path=args.sites,
        output_dir=args.outdir,
        t0_str=args.t0,
        step_h=args.step,
        n_obs=args.n,
    )


if __name__ == "__main__":
    main()

