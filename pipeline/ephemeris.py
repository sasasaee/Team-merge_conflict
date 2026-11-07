"""Sun and Earth az/el seen from a lunar site, hour by hour (what Atia's T-15..T-17 would give us).

No downloads: uses the ERFA planetary theory (Earth and Moon positions) and the IAU 2009 lunar orientation
model (the same series NAIF's IAU_MOON frame uses). Accuracy is far better than the 2.5 deg margin that matters here:
well under 0.1 deg for Earth and the Sun. Directions are to the centre of each disc, like the app (no refraction on the Moon).

Conventions: azimuth 0 = north, 90 = east; elevation above the local horizontal; lat = planetocentric, lon = east-positive.
"""
from __future__ import annotations

from datetime import datetime, timezone

import erfa
import numpy as np

TT_MINUS_UTC_S = 69.184  # 37 leap seconds + 32.184 s (no leap second is scheduled before 2027)
AU_KM = 149_597_870.7
MOON_R_KM = 1737.4  # sphere radius used by LOLA and by the DEM code


def _jd_utc(t0: datetime) -> float:
    t0 = t0.astimezone(timezone.utc)
    return 2440587.5 + t0.timestamp() / 86400.0


def moon_orientation(d: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """IAU 2009 pole RA, Dec and prime-meridian angle W (radians). d = days since J2000.0 (TDB)."""
    T = d / 36525.0
    r = np.radians
    E = [None,
         r(125.045 - 0.0529921 * d), r(250.089 - 0.1059842 * d), r(260.008 + 13.0120009 * d),
         r(176.625 + 13.3407154 * d), r(357.529 + 0.9856003 * d), r(311.589 + 26.4057084 * d),
         r(134.963 + 13.0649930 * d), r(276.617 + 0.3287146 * d), r(34.226 + 1.7484877 * d),
         r(15.134 - 0.1589763 * d), r(119.743 + 0.0036096 * d), r(239.961 + 0.1643573 * d),
         r(25.053 + 12.9590088 * d)]
    s, c = np.sin, np.cos
    ra = (269.9949 + 0.0031 * T - 3.8787 * s(E[1]) - 0.1204 * s(E[2]) + 0.0700 * s(E[3]) - 0.0172 * s(E[4])
          + 0.0072 * s(E[6]) - 0.0052 * s(E[10]) + 0.0043 * s(E[13]))
    dec = (66.5392 + 0.0130 * T + 1.5419 * c(E[1]) + 0.0239 * c(E[2]) - 0.0278 * c(E[3]) + 0.0068 * c(E[4])
           - 0.0029 * c(E[6]) + 0.0009 * c(E[7]) + 0.0008 * c(E[10]) - 0.0009 * c(E[13]))
    w = (38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.5610 * s(E[1]) + 0.1208 * s(E[2]) - 0.0642 * s(E[3])
         + 0.0158 * s(E[4]) + 0.0252 * s(E[5]) - 0.0066 * s(E[6]) - 0.0047 * s(E[7]) - 0.0046 * s(E[8])
         + 0.0028 * s(E[9]) + 0.0052 * s(E[10]) + 0.0040 * s(E[11]) + 0.0019 * s(E[12]) - 0.0044 * s(E[13]))
    return r(ra), r(dec), r(w % 360.0)


def _rot_matrices(ra, dec, w):
    """ICRF -> Moon body-fixed rotation matrices, shape (N, 3, 3): R3(W) R1(90-dec) R3(90+ra)."""
    n = len(ra)
    def r3(a):
        m = np.zeros((n, 3, 3)); c, s = np.cos(a), np.sin(a)
        m[:, 0, 0] = c; m[:, 0, 1] = s; m[:, 1, 0] = -s; m[:, 1, 1] = c; m[:, 2, 2] = 1
        return m
    def r1(a):
        m = np.zeros((n, 3, 3)); c, s = np.cos(a), np.sin(a)
        m[:, 0, 0] = 1; m[:, 1, 1] = c; m[:, 1, 2] = s; m[:, 2, 1] = -s; m[:, 2, 2] = c
        return m
    return r3(w) @ r1(np.pi / 2 - dec) @ r3(np.pi / 2 + ra)


def body_fixed_directions(t0: datetime, hours: int, step_h: float = 1.0, km: bool = False):
    """Moon centre -> Sun and Moon centre -> Earth in the Moon body-fixed frame, shape (N, 3) each.
    Unit vectors by default; km=True gives vectors in km (needed for the site-based sky, because Earth is only
    ~400,000 km away and the site is 1737 km from the Moon's centre)."""
    jd = _jd_utc(t0) + np.arange(hours) * step_h / 24.0
    tt1 = np.full(hours, 2400000.5)
    tt2 = (jd - 2400000.5) + TT_MINUS_UTC_S / 86400.0
    d = (tt1 - 2451545.0) + tt2
    sun_from_moon = np.empty((hours, 3)); earth_from_moon = np.empty((hours, 3))
    for i in range(hours):
        pvh, _ = erfa.epv00(tt1[i], tt2[i])          # Earth wrt Sun, AU, BCRS axes
        moon = erfa.moon98(tt1[i], tt2[i])[0]        # Moon wrt Earth, AU, GCRS axes
        sun_from_moon[i] = -pvh[0] - moon
        earth_from_moon[i] = -moon
    R = _rot_matrices(*moon_orientation(d))
    def to_body(v):
        v = v * AU_KM
        if not km:
            v = v / np.linalg.norm(v, axis=1, keepdims=True)
        return np.einsum("nij,nj->ni", R, v)
    return to_body(sun_from_moon), to_body(earth_from_moon)


def az_el(vec_body: np.ndarray, lat_deg: float, lon_deg: float) -> tuple[np.ndarray, np.ndarray]:
    """Azimuth/elevation (deg) of body-fixed vectors (km, from the Moon's centre) seen from (lat, lon) on the surface.
    The site's own position is subtracted first (topocentric), which lowers Earth by about 0.25 deg like SPICE does."""
    la, lo = np.radians(lat_deg), np.radians(lon_deg)
    up = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    vec_body = vec_body - MOON_R_KM * up
    vec_body = vec_body / np.linalg.norm(vec_body, axis=1, keepdims=True)
    east = np.array([-np.sin(lo), np.cos(lo), 0.0])
    north = np.array([-np.sin(la) * np.cos(lo), -np.sin(la) * np.sin(lo), np.cos(la)])
    el = np.degrees(np.arcsin(np.clip(vec_body @ up, -1, 1)))
    az = np.degrees(np.arctan2(vec_body @ east, vec_body @ north)) % 360.0
    return az, el


def sun_earth_azel(lat: float, lon: float, t0: datetime, hours: int, step_h: float = 1.0) -> dict:
    sun, earth = body_fixed_directions(t0, hours, step_h, km=True)
    sun_az, sun_el = az_el(sun, lat, lon)
    earth_az, earth_el = az_el(earth, lat, lon)
    return {"sun_az": sun_az, "sun_el": sun_el, "earth_az": earth_az, "earth_el": earth_el}
