"""
MoonScope R1: Generate Validation Plots for Sun and Earth Ephemeris.
Outputs publication-quality figures into results/validation/.
"""

from __future__ import annotations
import json
import os
from pathlib import Path
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "web" / "public" / "data"
RESULTS_DIR = PROJECT_ROOT / "results" / "validation"


def setup_style():
    plt.rcParams.update({
        "figure.facecolor": "#0b0f19",
        "axes.facecolor": "#111827",
        "axes.edgecolor": "#374151",
        "axes.labelcolor": "#e5e7eb",
        "text.color": "#f9fafb",
        "xtick.color": "#9ca3af",
        "ytick.color": "#9ca3af",
        "grid.color": "#1f2937",
        "grid.linestyle": "--",
        "grid.alpha": 0.6,
        "font.size": 10,
    })


def plot_site_overview(site_id: str, data: dict, output_dir: Path):
    """Plot 1-month and 1-year elevation & azimuth profiles for a landing site."""
    n = data["n"]
    time_days = np.arange(n) / 24.0

    sun_el = np.array(data["sun_el"])
    earth_el = np.array(data["earth_el"])
    sun_az = np.array(data["sun_az"])
    earth_az = np.array(data["earth_az"])

    # Figure 1: 1-Year Overview
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), sharex=True)

    ax1.plot(time_days, sun_el, color="#f59e0b", label="Sun Elevation", lw=1.2)
    ax1.plot(time_days, earth_el, color="#38bdf8", label="Earth Elevation", lw=1.2)
    ax1.axhline(0, color="#ef4444", ls=":", lw=1, alpha=0.8, label="Local Horizon (0°)")
    ax1.set_ylabel("Elevation (°)")
    ax1.set_title(f"MoonScope Ephemeris (1-Year) — {data['name']} ({site_id})\nLat: {data['lat']}°, Lon: {data['lon']}° | Epoch: {data['t0']}")
    ax1.grid(True)
    ax1.legend(loc="upper right", facecolor="#1f2937", edgecolor="#374151")

    ax2.plot(time_days, sun_az, color="#d97706", label="Sun Azimuth (0°=N, 90°=E)", lw=0.8, alpha=0.9)
    ax2.plot(time_days, earth_az, color="#0284c7", label="Earth Azimuth", lw=1.2)
    ax2.set_xlabel("Days from 2027-03-01T00:00:00Z")
    ax2.set_ylabel("Azimuth (°)")
    ax2.set_ylim(-5, 365)
    ax2.grid(True)
    ax2.legend(loc="upper right", facecolor="#1f2937", edgecolor="#374151")

    fig.tight_layout()
    fig.savefig(output_dir / f"{site_id}_1year_overview.png", dpi=200)
    plt.close(fig)

    # Figure 2: First Lunar Month (672 hours / 28 days) Zoom
    m_hours = min(672, n)
    hours = np.arange(m_hours)

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), sharex=True)

    ax1.plot(hours, sun_el[:m_hours], color="#f59e0b", lw=2, label="Sun Elevation")
    ax1.plot(hours, earth_el[:m_hours], color="#38bdf8", lw=2, label="Earth Elevation")
    ax1.axhline(0, color="#ef4444", ls=":", lw=1.2, label="Local Horizon (0°)")
    ax1.set_ylabel("Elevation (°)")
    ax1.set_title(f"First Lunar Month (28 Days) — {data['name']} ({site_id})")
    ax1.grid(True)
    ax1.legend(loc="upper right", facecolor="#1f2937", edgecolor="#374151")

    ax2.plot(hours, sun_az[:m_hours], color="#d97706", lw=1.5, label="Sun Azimuth")
    ax2.plot(hours, earth_az[:m_hours], color="#0284c7", lw=1.8, label="Earth Azimuth")
    ax2.set_xlabel("Hours from 2027-03-01T00:00:00Z")
    ax2.set_ylabel("Azimuth (°)")
    ax2.set_ylim(-5, 365)
    ax2.grid(True)
    ax2.legend(loc="upper right", facecolor="#1f2937", edgecolor="#374151")

    fig.tight_layout()
    fig.savefig(output_dir / f"{site_id}_first_month.png", dpi=200)
    plt.close(fig)


def plot_all_sites_comparison(datasets: dict, output_dir: Path):
    """Comparative plot showing Sun & Earth elevation ranges across all 9 candidate sites."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

    site_names = [d["name"] for d in datasets.values()]
    sun_min = [np.min(d["sun_el"]) for d in datasets.values()]
    sun_max = [np.max(d["sun_el"]) for d in datasets.values()]
    earth_min = [np.min(d["earth_el"]) for d in datasets.values()]
    earth_max = [np.max(d["earth_el"]) for d in datasets.values()]

    y_pos = np.arange(len(site_names))

    # Sun elevation ranges
    ax1.barh(y_pos, [mx - mn for mn, mx in zip(sun_min, sun_max)], left=sun_min, color="#f59e0b", alpha=0.8, height=0.5)
    ax1.axvline(0, color="#ef4444", ls="--", lw=1.2, label="Local Horizon")
    ax1.set_yticks(y_pos)
    ax1.set_yticklabels(site_names)
    ax1.invert_yaxis()
    ax1.set_xlabel("Sun Elevation Range (°)")
    ax1.set_title("Annual Sun Elevation Range Across All 9 Sites")
    ax1.grid(True)
    ax1.legend(facecolor="#1f2937", edgecolor="#374151")

    # Earth elevation ranges
    ax2.barh(y_pos, [mx - mn for mn, mx in zip(earth_min, earth_max)], left=earth_min, color="#38bdf8", alpha=0.8, height=0.5)
    ax2.axvline(0, color="#ef4444", ls="--", lw=1.2, label="Local Horizon")
    ax2.set_yticks(y_pos)
    ax2.set_yticklabels([])
    ax2.invert_yaxis()
    ax2.set_xlabel("Earth Elevation Range (°)")
    ax2.set_title("Annual Earth Elevation Range (Libration Window)")
    ax2.grid(True)
    ax2.legend(facecolor="#1f2937", edgecolor="#374151")

    fig.tight_layout()
    fig.savefig(output_dir / "all_sites_elevation_comparison.png", dpi=200)
    plt.close(fig)


def main():
    setup_style()
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    json_files = sorted(DATA_DIR.glob("*.json"))
    if not json_files:
        print(f"No JSON ephemeris files found in {DATA_DIR}. Run generate_ephemeris.py first.")
        return

    datasets = {}
    print(f"Generating validation plots for {len(json_files)} sites...")
    for jf in json_files:
        with open(jf, "r", encoding="utf-8") as f:
            d = json.load(f)
            datasets[d["id"]] = d
            plot_site_overview(d["id"], d, RESULTS_DIR)
            print(f"  -> Generated plots for {d['name']}")

    plot_all_sites_comparison(datasets, RESULTS_DIR)
    print(f"  -> Generated comparative plot: all_sites_elevation_comparison.png")
    print(f"\nAll validation plots saved successfully in {RESULTS_DIR}")


if __name__ == "__main__":
    main()

