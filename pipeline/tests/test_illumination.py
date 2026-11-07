import numpy as np

import illumination as ill


def test_lit_and_earth_states():
    hz = np.zeros(360)
    hz[90] = 3.0
    assert list(ill.lit_array(hz, [90, 90, 10], [4.0, 2.0, 0.1])) == [True, False, True]
    st = ill.earth_state(ill.earth_margin(hz, [90, 90, 90], [6.0, 4.0, 2.0]))  # margins 3, 1, -1
    assert list(st) == ["ok", "weak", "lost"]


def test_dna_and_forecast():
    lit = np.array([1, 1, 0, 0, 0, 1], bool)
    earth = np.array(["ok", "weak", "lost", "lost", "ok", "ok"])
    d = ill.shadow_dna(lit, earth, hours=6)
    assert d == {"lit": 0.5, "comm": 0.5, "longest_day_h": 2, "longest_night_h": 3,
                 "longest_blackout_h": 2, "transitions": 2}
    assert ill.comm_forecast(earth) == [{"start": 1, "end": 2, "type": "weak"}, {"start": 2, "end": 4, "type": "lost"}]
