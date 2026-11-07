"""T-26 / T-27 / T-28: sunlit + Earth-link arrays, Shadow DNA, signal-loss forecast.

Rules are identical to the app prototype (web/src/core/sites.ts, dna.ts) so numbers match the UI.
"""
from __future__ import annotations

import numpy as np

RELIABLE_DEG = 2.5  # Earth this far above the ridge = reliable link
DNA_HOURS = 24 * 28  # 672 h, the window the app uses for Shadow DNA


def _look(horizon: np.ndarray, az: np.ndarray) -> np.ndarray:
    """Ridge height in the direction of az (degrees). Same rounding as the app: round(az) % 360."""
    return np.asarray(horizon)[np.rint(az).astype(int) % 360]


def lit_array(horizon, sun_az, sun_el) -> np.ndarray:
    return np.asarray(sun_el) > _look(horizon, np.asarray(sun_az))


def earth_margin(horizon, earth_az, earth_el) -> np.ndarray:
    return np.asarray(earth_el) - _look(horizon, np.asarray(earth_az))


def earth_state(margin: np.ndarray) -> np.ndarray:
    """'ok' (> 2.5 deg), 'weak' (0..2.5 deg), 'lost' (<= 0 deg)."""
    return np.where(margin > RELIABLE_DEG, "ok", np.where(margin > 0, "weak", "lost"))


def longest_run(mask: np.ndarray) -> int:
    best = run = 0
    for v in mask:
        run = run + 1 if v else 0
        best = max(best, run)
    return int(best)


def shadow_dna(lit: np.ndarray, earth: np.ndarray, hours: int = DNA_HOURS) -> dict:
    """Matches the contract: dna = {lit, comm, longest_day_h, longest_night_h, longest_blackout_h, transitions}."""
    lit = np.asarray(lit)[:hours]
    earth = np.asarray(earth)[:hours]
    n = len(lit)
    return {
        "lit": round(float(lit.sum()) / n, 4),                    # fraction of hours sunlit
        "comm": round(float((earth == "ok").sum()) / n, 4),      # fraction with a RELIABLE Earth link
        "longest_day_h": longest_run(lit),
        "longest_night_h": longest_run(~lit),
        "longest_blackout_h": longest_run(earth == "lost"),
        "transitions": int((lit[1:] != lit[:-1]).sum()),         # sun on/off switches
    }


def comm_forecast(earth: np.ndarray, t0_hour: int = 0) -> list[dict]:
    """List of {start, end, type} (hours, end exclusive) for every weak or lost stretch of Earth contact.
    The timeline draws amber for 'weak' and red for 'lost'."""
    out, start = [], 0
    earth = np.asarray(earth)
    for i in range(1, len(earth) + 1):
        if i == len(earth) or earth[i] != earth[start]:
            if earth[start] != "ok":
                out.append({"start": t0_hour + start, "end": t0_hour + i, "type": str(earth[start])})
            start = i
    return out
