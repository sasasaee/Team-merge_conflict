"""Rewrite the numbers in docs/METHOD.md (section 4, T-30) from the site JSONs, so they can never go stale.

  python pipeline/update_method.py --data web/public/data --doc docs/METHOD.md

It replaces the text between <!-- T30-AUTO-START --> and <!-- T30-AUTO-END -->. run_all.bat calls it for you.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

SUN_MIN, EARTH_MIN = 33.0, 50.0           # NASA screening thresholds (percent of time)
PUBLISHED_BEST = (77.1, 88.0)             # Glaeser et al. 2014 abstract: best points of a 50 x 50 km polar area
START, END = "<!-- T30-AUTO-START -->", "<!-- T30-AUTO-END -->"


def site_numbers(path: Path) -> dict:
    d = json.loads(path.read_text())
    hz = np.array(next(g for g in d["grid"] if g["dx_km"] == 0 and g["dy_km"] == 0)["horizon"])
    lit = np.array(d["sun_el"]) > hz[np.rint(d["sun_az"]).astype(int) % 360]
    margin = np.array(d["earth_el"]) - hz[np.rint(d["earth_az"]).astype(int) % 360]
    return {"name": d["name"], "mean_h": float(hz.mean()), "lit28": lit[:672].mean() * 100, "lit": lit.mean() * 100,
            "ok28": (margin[:672] > 2.5).mean() * 100, "ok": (margin > 2.5).mean() * 100}


def build_block(rows: list[dict]) -> str:
    rows = sorted(rows, key=lambda r: -r["lit"])
    out = ["| Site | Mean horizon | Sunlit, first 28 days (app DNA) | Sunlit, 1 year | Earth link OK, first 28 days | Earth link OK, 1 year | Sunlit at least 33% (1 yr) | Earth at least 50% (1 yr) |",
           "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        out.append(f"| {r['name']} | {r['mean_h']:.1f} deg | {r['lit28']:.0f}% | {r['lit']:.0f}% | {r['ok28']:.0f}% | {r['ok']:.2f}% | "
                   f"{'yes' if r['lit'] >= SUN_MIN else 'no'} | {'yes' if r['ok'] >= EARTH_MIN else 'no'} |")
    n = len(rows)
    sun_fail = [r["name"] for r in rows if r["lit"] < SUN_MIN]
    earth_fail = [r["name"] for r in rows if r["ok"] < EARTH_MIN]
    lit = [r["lit"] for r in rows if r["lit"] > 0]
    best, med = max(lit), float(np.median(lit))
    lo, hi = PUBLISHED_BEST
    vs = ("The best site reaches the published best-point range." if best >= lo else
          "Every site is below that range, as expected: the published values are the best points of a whole polar area.")
    out += ["",
            f"Result: {n - len(sun_fail)} of {n} sites pass the sunlight threshold" + (f" (below it: {', '.join(sun_fail)})" if sun_fail else "")
            + f"; {n - len(earth_fail)} of {n} pass the Earth threshold" + (f" (below it: {', '.join(earth_fail)})" if earth_fail else "") + ".",
            f"Our best full-year sunlit value is {best:.0f}% (median of the lit sites {med:.0f}%), against {lo}% to {hi}% published for the best points. {vs}"]
    return "\n".join(out)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", required=True)
    ap.add_argument("--doc", required=True)
    a = ap.parse_args()
    doc = Path(a.doc)
    if not doc.exists():
        print(f"{doc} not found, skipped")
        return
    raw = doc.read_bytes().decode("utf8")
    crlf = "\r\n" in raw
    text = raw.replace("\r\n", "\n")
    if text.count(START) != 1 or text.count(END) != 1:
        print(f"markers not found in {doc}, nothing changed")
        return
    rows = [site_numbers(p) for p in sorted(Path(a.data).glob("*.json")) if not p.name.startswith("sample-")]
    head, rest = text.split(START)
    tail = rest.split(END)[1]
    text = head + START + "\n" + build_block(rows) + "\n" + END + tail
    doc.write_bytes((text.replace("\n", "\r\n") if crlf else text).encode("utf8"))
    print(f"updated {doc} from {len(rows)} site files")


if __name__ == "__main__":
    main()
