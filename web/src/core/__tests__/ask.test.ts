import { describe, it, expect } from "vitest";
import { parseQuestion } from "../ask";
import { MOCK_PARAMS } from "../schemas";
import { MAX_DELAY_H } from "../calendar";
import { SITES } from "../sites";

describe("Ask MoonScope parser (T-38)", () => {
  const defaultParams = { ...MOCK_PARAMS };

  describe("Landing delay parsing", () => {
    it("parses days late format", () => {
      const res = parseQuestion("what if we land 3 days late?", defaultParams);
      expect(res.changes.delayH).toBe(72);
      expect(res.understood).toContain("Landing delayed by 72 h");
    });

    it("parses fractional days late", () => {
      const res = parseQuestion("what if landing is 2.5 d delay", defaultParams);
      expect(res.changes.delayH).toBe(60);
      expect(res.understood).toContain("Landing delayed by 60 h");
    });

    it("parses delayed by X days format", () => {
      const res = parseQuestion("delayed by 4 days", defaultParams);
      expect(res.changes.delayH).toBe(96);
      expect(res.understood).toContain("Landing delayed by 96 h");
    });

    it("parses hours late format", () => {
      const res = parseQuestion("what if we arrive 12 hours later?", defaultParams);
      expect(res.changes.delayH).toBe(12);
      expect(res.understood).toContain("Landing delayed by 12 h");
    });

    it("parses combined days and hours late", () => {
      const res = parseQuestion("what if delayed by 1 day and 6 hours later", defaultParams);
      expect(res.changes.delayH).toBe(30);
      expect(res.understood).toContain("Landing delayed by 30 h");
    });

    it("caps delay at MAX_DELAY_H", () => {
      const res = parseQuestion("what if 70 days late", defaultParams);
      expect(res.changes.delayH).toBe(MAX_DELAY_H);
      expect(res.understood).toContain(`Landing delayed by ${MAX_DELAY_H} h`);
    });

    it("handles 'on time' or 'no delay'", () => {
      const res1 = parseQuestion("arrive on time", defaultParams);
      expect(res1.changes.delayH).toBe(0);
      expect(res1.understood).toContain("Landing on time");

      const res2 = parseQuestion("with no delay", defaultParams);
      expect(res2.changes.delayH).toBe(0);
      expect(res2.understood).toContain("Landing on time");
    });
  });

  describe("Solar panel efficiency parsing", () => {
    it("parses explicit percentage weaker", () => {
      const res = parseQuestion("what if panels are 20% weaker?", defaultParams);
      const expected = Math.max(0.15, Math.round(defaultParams.panelEff * 0.8 * 100) / 100);
      expect(res.changes.panelEff).toBe(expected);
      expect(res.understood).toContain("Solar panels 20% weaker");
    });

    it("defaults to 20% weaker on 'weaker panel' phrase", () => {
      const res = parseQuestion("what if we have weaker panels?", defaultParams);
      const expected = Math.max(0.15, Math.round(defaultParams.panelEff * 0.8 * 100) / 100);
      expect(res.changes.panelEff).toBe(expected);
      expect(res.understood).toContain("Solar panels 20% weaker");
    });

    it("defaults to 20% weaker on 'dust' phrase", () => {
      const res = parseQuestion("there is dust on the lander", defaultParams);
      const expected = Math.max(0.15, Math.round(defaultParams.panelEff * 0.8 * 100) / 100);
      expect(res.changes.panelEff).toBe(expected);
      expect(res.understood).toContain("Solar panels 20% weaker");
    });

    it("enforces minimum panel efficiency floor of 0.15", () => {
      const res = parseQuestion("90% weaker solar panels", defaultParams);
      expect(res.changes.panelEff).toBe(0.15);
      expect(res.understood).toContain("Solar panels 90% weaker");
    });
  });

  describe("Battery capacity parsing", () => {
    it("parses explicit kWh values", () => {
      const res = parseQuestion("install a 150 kwh battery", defaultParams);
      expect(res.changes.batteryKwh).toBe(150);
      expect(res.understood).toContain("Battery 150 kWh");
    });

    it("clamps battery kWh to minimum 40", () => {
      const res = parseQuestion("use 10 kwh battery", defaultParams);
      expect(res.changes.batteryKwh).toBe(40);
      expect(res.understood).toContain("Battery 40 kWh");
    });

    it("clamps battery kWh to maximum 200", () => {
      const res = parseQuestion("upgrade to 300 kwh battery", defaultParams);
      expect(res.changes.batteryKwh).toBe(200);
      expect(res.understood).toContain("Battery 200 kWh");
    });

    it("increases battery with 'bigger battery' or 'more battery'", () => {
      const res1 = parseQuestion("what with a bigger battery?", { ...defaultParams, batteryKwh: 100 });
      expect(res1.changes.batteryKwh).toBe(140);
      expect(res1.understood).toContain("Battery raised to 140 kWh");

      const res2 = parseQuestion("bring more battery to the site", { ...defaultParams, batteryKwh: 180 });
      expect(res2.changes.batteryKwh).toBe(200);
      expect(res2.understood).toContain("Battery raised to 200 kWh");
    });
  });

  describe("Power consumption (load) parsing", () => {
    it("parses explicit kW load without confusing with kWh", () => {
      const res = parseQuestion("operating at 2.5 kw power load", defaultParams);
      expect(res.changes.loadKw).toBe(2.5);
      expect(res.understood).toContain("Power use 2.5 kW");
    });

    it("does not match 'kwh' as 'kw'", () => {
      const res = parseQuestion("bring 100 kwh", defaultParams);
      expect(res.changes.loadKw).toBeUndefined();
      expect(res.changes.batteryKwh).toBe(100);
    });

    it("clamps power use between 0.5 kW and 4 kW", () => {
      const resLow = parseQuestion("run at 0.1 kw", defaultParams);
      expect(resLow.changes.loadKw).toBe(0.5);

      const resHigh = parseQuestion("draw 10 kw", defaultParams);
      expect(resHigh.changes.loadKw).toBe(4);
    });
  });

  describe("Mission duration parsing", () => {
    it("parses 'X-day mission' or 'X day mission'", () => {
      const res = parseQuestion("a 7-day mission", defaultParams);
      expect(res.changes.durationDays).toBe(7);
      expect(res.understood).toContain("Mission length 7 days");
    });

    it("parses 'mission for X days' or 'mission of X days'", () => {
      const res1 = parseQuestion("mission for 12 days", defaultParams);
      expect(res1.changes.durationDays).toBe(12);

      const res2 = parseQuestion("mission of 5 days", defaultParams);
      expect(res2.changes.durationDays).toBe(5);
    });

    it("clamps mission duration between 3 and 14 days", () => {
      const resShort = parseQuestion("1 day mission", defaultParams);
      expect(resShort.changes.durationDays).toBe(3);

      const resLong = parseQuestion("30 day mission", defaultParams);
      expect(resLong.changes.durationDays).toBe(14);
    });
  });

  describe("Communication requirements parsing", () => {
    it("parses explicit contact hours", () => {
      const res = parseQuestion("require 6 h of contact daily", defaultParams);
      expect(res.changes.commHoursReq).toBe(6);
      expect(res.understood).toContain("Earth contact 6 h/day");
    });

    it("clamps contact hours to at most 12", () => {
      const res = parseQuestion("need 18 hours of comm", defaultParams);
      expect(res.changes.commHoursReq).toBe(12);
      expect(res.understood).toContain("Earth contact 12 h/day");
    });

    it("parses 'twice as much contact' or 'double the contact'", () => {
      const res1 = parseQuestion("twice as much contact", { ...defaultParams, commHoursReq: 4 });
      expect(res1.changes.commHoursReq).toBe(8);
      expect(res1.understood).toContain("Earth contact doubled to 8 h/day");

      const res2 = parseQuestion("double the communication", { ...defaultParams, commHoursReq: 8 });
      expect(res2.changes.commHoursReq).toBe(12);
      expect(res2.understood).toContain("Earth contact doubled to 12 h/day");
    });
  });

  describe("Site detection", () => {
    it("recognizes full site name", () => {
      const res = parseQuestion("what if we land at Mons Mouton?", defaultParams);
      const idx = SITES.findIndex((s) => s.name === "Mons Mouton");
      expect(res.changes.siteIdx).toBe(idx);
      expect(res.understood).toContain("Site Mons Mouton");
    });

    it("recognizes first word of site name", () => {
      const res = parseQuestion("landing at Malapert instead", defaultParams);
      const idx = SITES.findIndex((s) => s.name.startsWith("Malapert"));
      expect(res.changes.siteIdx).toBe(idx);
      expect(res.understood).toContain(`Site ${SITES[idx].name}`);
    });

    it("recognizes Haworth", () => {
      const res = parseQuestion("plan for haworth", defaultParams);
      const idx = SITES.findIndex((s) => s.id === "haworth");
      expect(res.changes.siteIdx).toBe(idx);
      expect(res.understood).toContain("Site Haworth");
    });
  });

  describe("Comprehensive queries and edge cases", () => {
    it("parses multiple simultaneous questions correctly", () => {
      const query = "what if we land 3 days late with 20% weaker panels at Mons Mouton?";
      const res = parseQuestion(query, defaultParams);
      expect(res.changes.delayH).toBe(72);
      expect(res.changes.siteIdx).toBe(1);
      expect(res.changes.panelEff).toBeDefined();
      expect(res.understood.length).toBe(3);
    });

    it("returns empty changes and understood for irrelevant queries", () => {
      const res = parseQuestion("how is the weather in Tokyo?", defaultParams);
      expect(res.changes).toEqual({});
      expect(res.understood).toEqual([]);
    });

    it("handles empty query string", () => {
      const res = parseQuestion("", defaultParams);
      expect(res.changes).toEqual({});
      expect(res.understood).toEqual([]);
    });
  });
});
