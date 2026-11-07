import { describe, it, expect } from "vitest";
import {
  MissionParamsSchema,
  SimResultSchema,
  SiteDataSchema,
  MOCK_PARAMS,
  MOCK_PARAMS_RISKY,
  MOCK_SIM_RESULT,
} from "../schemas";
import { getSite } from "../sites";
import { simulate } from "../simulate";

//MissionParams

describe("MissionParamsSchema", () => {
  it("accepts valid default params", () => {
    expect(() => MissionParamsSchema.parse(MOCK_PARAMS)).not.toThrow();
  });

  it("accepts risky (but valid) params", () => {
    expect(() => MissionParamsSchema.parse(MOCK_PARAMS_RISKY)).not.toThrow();
  });

  it("rejects siteIdx out of range", () => {
    expect(() => MissionParamsSchema.parse({ ...MOCK_PARAMS, siteIdx: 9 })).toThrow();
    expect(() => MissionParamsSchema.parse({ ...MOCK_PARAMS, siteIdx: -1 })).toThrow();
  });

  it("rejects batteryKwh below minimum", () => {
    expect(() => MissionParamsSchema.parse({ ...MOCK_PARAMS, batteryKwh: 10 })).toThrow();
  });

  it("rejects batteryKwh above maximum", () => {
    expect(() => MissionParamsSchema.parse({ ...MOCK_PARAMS, batteryKwh: 300 })).toThrow();
  });

  it("rejects loadKw below minimum", () => {
    expect(() => MissionParamsSchema.parse({ ...MOCK_PARAMS, loadKw: 0.1 })).toThrow();
  });

  it("rejects panelEff above maximum", () => {
    expect(() => MissionParamsSchema.parse({ ...MOCK_PARAMS, panelEff: 0.99 })).toThrow();
  });

  it("rejects durationDays above 14", () => {
    expect(() => MissionParamsSchema.parse({ ...MOCK_PARAMS, durationDays: 15 })).toThrow();
  });

  it("rejects durationDays below 1", () => {
    expect(() => MissionParamsSchema.parse({ ...MOCK_PARAMS, durationDays: 0 })).toThrow();
  });

  it("rejects non-integer durationDays", () => {
    expect(() => MissionParamsSchema.parse({ ...MOCK_PARAMS, durationDays: 2.5 })).toThrow();
  });

  it("rejects commHoursReq above 24", () => {
    expect(() => MissionParamsSchema.parse({ ...MOCK_PARAMS, commHoursReq: 25 })).toThrow();
  });

  it("rejects missing required field", () => {
    const { loadKw: _, ...incomplete } = MOCK_PARAMS;
    expect(() => MissionParamsSchema.parse(incomplete)).toThrow();
  });
});

//SimResult

describe("SimResultSchema", () => {
  it("accepts mock sim result fixture", () => {
    expect(() => SimResultSchema.parse(MOCK_SIM_RESULT)).not.toThrow();
  });

  it("accepts result with failHour and cause set", () => {
    expect(() =>
      SimResultSchema.parse({ ...MOCK_SIM_RESULT, failHour: 42, cause: "power", verdict: "fail" }),
    ).not.toThrow();
  });

  it("accepts comm failure cause", () => {
    expect(() =>
      SimResultSchema.parse({ ...MOCK_SIM_RESULT, failHour: 100, cause: "comm", verdict: "fail" }),
    ).not.toThrow();
  });

  it("rejects invalid verdict", () => {
    expect(() => SimResultSchema.parse({ ...MOCK_SIM_RESULT, verdict: "maybe" })).toThrow();
  });

  it("rejects invalid cause", () => {
    expect(() => SimResultSchema.parse({ ...MOCK_SIM_RESULT, cause: "solar" })).toThrow();
  });

  it("rejects negative litPct", () => {
    expect(() => SimResultSchema.parse({ ...MOCK_SIM_RESULT, litPct: -0.1 })).toThrow();
  });

  it("rejects litPct > 1", () => {
    expect(() => SimResultSchema.parse({ ...MOCK_SIM_RESULT, litPct: 1.5 })).toThrow();
  });
});

//SiteData

describe("SiteDataSchema", () => {
  it("validates all 9 generated mock sites", () => {
    for (let i = 0; i < 9; i++) {
      const site = getSite(i);
      expect(() => SiteDataSchema.parse(site)).not.toThrow();
    }
  });

  it("rejects horizon array that is not 360 entries", () => {
    const site = getSite(0);
    expect(() => SiteDataSchema.parse({ ...site, horizon: site.horizon.slice(0, 100) })).toThrow();
  });
});

//simulate() output roundtrip

describe("simulate() output passes SimResultSchema", () => {
  it("default params → valid result", () => {
    const result = simulate(MOCK_PARAMS);
    expect(() => SimResultSchema.parse(result)).not.toThrow();
  });

  it("risky params → valid result (possibly fail verdict)", () => {
    const result = simulate(MOCK_PARAMS_RISKY);
    expect(() => SimResultSchema.parse(result)).not.toThrow();
  });

  it("every site produces a valid result", () => {
    for (let i = 0; i < 9; i++) {
      const result = simulate({ ...MOCK_PARAMS, siteIdx: i });
      expect(() => SimResultSchema.parse(result)).not.toThrow();
    }
  });
});

