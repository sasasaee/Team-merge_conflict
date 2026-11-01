// Mission core: data, simulator and shared state. Features and pages import from "@/core" only.
export * from "./types";
export { HOURS, SITES, getSite, wrapHour } from "./sites";
export { RESERVE_FRACTION, SCENARIOS, simulate, findBestSite, findSmallestDelay } from "./simulate";
export { useMission, useSim } from "./store";
export { CALENDAR_DAYS, MAX_DELAY_H, PLANNED_LANDING, landingDate, landingLabel } from "./calendar";
export { siteDna, type Dna } from "./dna";
export { missionEvents, type MissionEvent } from "./events";
export { parseQuestion, type AskResult } from "./ask";
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