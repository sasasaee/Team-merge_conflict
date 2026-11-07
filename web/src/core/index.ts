// Mission core: data, simulator and shared state. Features and pages import from "@/core" only.
export { MissionParamsSchema, SimResultSchema, SiteDataSchema, MOCK_PARAMS, MOCK_PARAMS_RISKY, MOCK_SIM_RESULT } from "./schemas";
export * from "./types";
export { HOURS, SITES, getSite, wrapHour } from "./sites";
export { RESERVE_FRACTION, simulate, findBestSite, findSmallestDelay } from "./simulate";
export { MAX_SCENARIOS, PRESETS, customScenario, runScenario, type Scenario } from "./scenarios";
export { useMission, useSim } from "./store";
export { CALENDAR_DAYS, MAX_DELAY_H, PLANNED_LANDING, landingDate, landingLabel } from "./calendar";
export { dnaFromArrays, siteDna, type Dna } from "./dna";
export { DNA_HOURS, skyFromFile, useRealSky, type RealSky } from "./realSites";
export { missionEvents, type MissionEvent } from "./events";
export { parseQuestion, type AskResult } from "./ask";
export {
  stressTest,
  robustnessScore,
  smallestFix,
  type CandidateResult,
  type StressReport,
  type RobustnessReport,
  type RobustnessTier,
  type Fix,
  type FixKind,
} from "./stress";
export {
  getRecommendations,
  type Recommendation,
  type RecommendationCategory,
  type MissionAdvice,
} from "./recommendations";
export {
  CRISES,
  MOVES,
  RESCUE_HOURS,
  applyMove,
  canMove,
  hoursLeft,
  isLit,
  startRescue,
  tick,
  type Crisis,
  type LogLine,
  type Move,
  type RescueState,
} from "./rescue";
