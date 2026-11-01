export type Verdict = "ok" | "warn" | "fail";
export type EarthLink = "ok" | "weak" | "lost";
export type Cause = "power" | "comm" | null;

// One landing site's hourly data (same shape the real NASA-based JSON will have)
export type SiteData = {
  horizon: number[]; // 360 values: mountain height (deg) in each compass direction
  sunAz: number[];
  sunEl: number[];
  earthAz: number[];
  earthEl: number[];
  lit: boolean[];
  earth: EarthLink[];
};

export type MissionParams = {
  siteIdx: number;
  delayH: number;
  batteryKwh: number;
  loadKw: number;
  panelEff: number;
  commHoursReq: number;
  durationDays: number;
};

export type SimResult = {
  soc: number[];
  minSoc: number;
  reserve: number;
  failHour: number | null;
  cause: Cause;
  litPct: number;
  earthOkPct: number;
  longestBlackoutH: number;
  verdict: Verdict;
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  ok: "FEASIBLE",
  warn: "AT RISK",
  fail: "INFEASIBLE",
};