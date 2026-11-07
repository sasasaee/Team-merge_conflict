//Zod schemas for MissionParams and SimResult.
// Pure logic – no UI imports. R1/R2 will swap getSite(); these schemas stay.
import { z } from "zod";

//  Primitive enums 

export const VerdictSchema = z.enum(["ok", "warn", "fail"]);
export const EarthLinkSchema = z.enum(["ok", "weak", "lost"]);
export const CauseSchema = z.union([z.literal("power"), z.literal("comm"), z.null()]);

//  SiteData 

export const SiteDataSchema = z.object({
  horizon: z.array(z.number()).length(360),
  sunAz: z.array(z.number()),
  sunEl: z.array(z.number()),
  earthAz: z.array(z.number()),
  earthEl: z.array(z.number()),
  lit: z.array(z.boolean()),
  earth: z.array(EarthLinkSchema),
});

//  MissionParams 

export const MissionParamsSchema = z.object({
  siteIdx: z.number().int().min(0).max(8), // 9 sites
  delayH: z.number().int().min(-240).max(240),
  batteryKwh: z.number().min(40).max(200),
  loadKw: z.number().min(0.5).max(4),
  panelEff: z.number().min(0.05).max(0.5),
  commHoursReq: z.number().int().min(0).max(24),
  durationDays: z.number().int().min(1).max(14),
});

//  SimResult 

export const SimResultSchema = z.object({
  soc: z.array(z.number()),
  minSoc: z.number().min(0),
  reserve: z.number().min(0),
  failHour: z.number().int().nullable(),
  cause: CauseSchema,
  litPct: z.number().min(0).max(1),
  earthOkPct: z.number().min(0).max(1),
  longestBlackoutH: z.number().int().min(0),
  verdict: VerdictSchema,
});

//  Mock data fixtures (used by tests and dev until R1/R2 deliver real JSON) 

export const MOCK_PARAMS: z.infer<typeof MissionParamsSchema> = {
  siteIdx: 0,
  delayH: 0,
  batteryKwh: 120,
  loadKw: 1.8,
  panelEff: 0.29,
  commHoursReq: 4,
  durationDays: 10,
};

export const MOCK_PARAMS_RISKY: z.infer<typeof MissionParamsSchema> = {
  siteIdx: 2,
  delayH: 120,         // 5-day delay → pushes into shadow
  batteryKwh: 60,      // small battery
  loadKw: 3.0,
  panelEff: 0.15,      // degraded panels
  commHoursReq: 8,
  durationDays: 14,
};

// Minimal valid SimResult fixture for schema tests
export const MOCK_SIM_RESULT: z.infer<typeof SimResultSchema> = {
  soc: [120, 118.2, 116.4],
  minSoc: 30,
  reserve: 30,
  failHour: null,
  cause: null,
  litPct: 0.6,
  earthOkPct: 0.75,
  longestBlackoutH: 12,
  verdict: "ok",
};

// Type aliases re-exported so the rest of the codebase can import from one place
export type MissionParamsInput = z.input<typeof MissionParamsSchema>;
export type SimResultOutput = z.infer<typeof SimResultSchema>;

