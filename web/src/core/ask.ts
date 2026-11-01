// Ask MoonScope: understands simple what-if questions without an AI service.
// Example: "what if we land 3 days late with 20% weaker panels at Mons Mouton?"
import { SITES } from "./sites";
import { MAX_DELAY_H } from "./calendar";
import type { MissionParams } from "./types";

export type AskResult = { changes: Partial<MissionParams>; understood: string[] };

const num = (m: RegExpMatchArray | null) => (m ? Number(m[1]) : null);

export function parseQuestion(text: string, p: MissionParams): AskResult {
  const q = text.toLowerCase();
  const changes: Partial<MissionParams> = {};
  const understood: string[] = [];

  const late = num(q.match(/(\d+(?:\.\d+)?)\s*(?:day|d)s?\s*(?:late|later|delay)/)) ?? num(q.match(/delay(?:ed)?\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*(?:day|d)/));
  const lateH = num(q.match(/(\d+)\s*(?:hour|h)s?\s*(?:late|later|delay)/));
  if (late !== null || lateH !== null) {
    changes.delayH = Math.min(MAX_DELAY_H, Math.round((late ?? 0) * 24 + (lateH ?? 0)));
    understood.push(`Landing delayed by ${changes.delayH} h`);
  }
  if (/on time|no delay/.test(q)) {
    changes.delayH = 0;
    understood.push("Landing on time");
  }

  const weaker = num(q.match(/(\d+)\s*%\s*weaker/)) ?? (/weaker panel|dust/.test(q) ? 20 : null);
  if (weaker !== null) {
    changes.panelEff = Math.max(0.15, Math.round(p.panelEff * (1 - weaker / 100) * 100) / 100);
    understood.push(`Solar panels ${weaker}% weaker`);
  }

  const battery = num(q.match(/(\d+)\s*kwh/));
  if (battery !== null) {
    changes.batteryKwh = Math.min(200, Math.max(40, battery));
    understood.push(`Battery ${changes.batteryKwh} kWh`);
  } else if (/bigger battery|more battery/.test(q)) {
    changes.batteryKwh = Math.min(200, p.batteryKwh + 40);
    understood.push(`Battery raised to ${changes.batteryKwh} kWh`);
  }

  const power = num(q.match(/(\d+(?:\.\d+)?)\s*kw(?!h)/));
  if (power !== null) {
    changes.loadKw = Math.min(4, Math.max(0.5, power));
    understood.push(`Power use ${changes.loadKw} kW`);
  }

  const length = num(q.match(/(\d+)\s*-?\s*day\s*mission/)) ?? num(q.match(/mission\s*(?:of|for)?\s*(\d+)\s*days?/));
  if (length !== null) {
    changes.durationDays = Math.min(14, Math.max(3, length));
    understood.push(`Mission length ${changes.durationDays} days`);
  }

  const contact = num(q.match(/(\d+)\s*(?:h|hours?)\s*(?:of\s*)?(?:contact|comm|earth)/));
  if (contact !== null) {
    changes.commHoursReq = Math.min(12, contact);
    understood.push(`Earth contact ${changes.commHoursReq} h/day`);
  } else if (/twice as much (?:contact|communication)|double (?:the )?(?:contact|communication)/.test(q)) {
    changes.commHoursReq = Math.min(12, p.commHoursReq * 2);
    understood.push(`Earth contact doubled to ${changes.commHoursReq} h/day`);
  }

  const site = SITES.findIndex((s) => q.includes(s.name.toLowerCase()) || q.includes(s.name.toLowerCase().split(" ")[0]));
  if (site >= 0) {
    changes.siteIdx = site;
    understood.push(`Site ${SITES[site].name}`);
  }

  return { changes, understood };
}