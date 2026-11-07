// Shadow DNA: a site's fingerprint of light and Earth contact over one lunar month.
import { DNA_HOURS } from "./realSites";
import { getSite } from "./sites";

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
  // Shadow DNA covers the first 28 days after landing (same window as the pipeline's dna)
  const lit = s.lit.slice(0, DNA_HOURS);
  const earth = s.earth.slice(0, DNA_HOURS);
  const n = lit.length;
  let switches = 0;
  for (let h = 1; h < n; h++) if (lit[h] !== lit[h - 1]) switches++;
  return {
    litPct: lit.filter(Boolean).length / n,
    commPct: earth.filter((e) => e === "ok").length / n,
    longestDayH: longestRun(lit),
    longestNightH: longestRun(lit.map((v) => !v)),
    longestBlackoutH: longestRun(earth.map((e) => e === "lost")),
    switches,
  };
}