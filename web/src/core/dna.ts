// Shadow DNA: a site's fingerprint of light and Earth contact over one lunar month.
import { HOURS, getSite } from "./sites";

export type Dna = {
  litPct: number;
  commPct: number;
  longestDayH: number;
  longestNightH: number;
  longestBlackoutH: number;
  switches: number;
};

function longestRun(values: boolean[]) {
  let best = 0;
  let run = 0;
  for (const v of values) {
    run = v ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function siteDna(siteIdx: number): Dna {
  const s = getSite(siteIdx);
  let switches = 0;
  for (let h = 1; h < HOURS; h++) if (s.lit[h] !== s.lit[h - 1]) switches++;
  return {
    litPct: s.lit.filter(Boolean).length / HOURS,
    commPct: s.earth.filter((e) => e === "ok").length / HOURS,
    longestDayH: longestRun(s.lit),
    longestNightH: longestRun(s.lit.map((v) => !v)),
    longestBlackoutH: longestRun(s.earth.map((e) => e === "lost")),
    switches,
  };
}