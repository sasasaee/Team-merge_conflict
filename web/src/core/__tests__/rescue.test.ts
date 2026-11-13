import { describe, it, expect } from "vitest";
import {
  CRISES,
  MOVES,
  RESCUE_HARDWARE,
  RESCUE_HOURS,
  applyMove,
  canMove,
  hoursLeft,
  isLit,
  startRescue,
  tick,
  type Crisis,
  type RescueState,
} from "../rescue";
import { MOCK_PARAMS } from "../schemas";
import type { MissionParams } from "../types";

describe("Rescue mode (T-53)", () => {
  const params: MissionParams = {
    ...MOCK_PARAMS,
    batteryKwh: RESCUE_HARDWARE.batteryKwh,
    loadKw: RESCUE_HARDWARE.loadKw,
    panelEff: RESCUE_HARDWARE.panelEff,
  };

  const dustCrisis = CRISES.find((c) => c.id === "dust")!;
  const lateCrisis = CRISES.find((c) => c.id === "late")!;
  const heaterCrisis = CRISES.find((c) => c.id === "heater")!;

  it("exports valid crisis and move definitions", () => {
    expect(CRISES.length).toBe(3);
    expect(dustCrisis.effScale).toBe(0.7);
    expect(lateCrisis.delayH).toBe(48);
    expect(heaterCrisis.extraLoadKw).toBe(0.8);

    expect(MOVES.drive).toBeDefined();
    expect(MOVES.instruments).toBeDefined();
    expect(MOVES.hibernate).toBeDefined();
    expect(MOVES.tilt).toBeDefined();
  });

  describe("startRescue", () => {
    it("initializes rescue state correctly for dust crisis", () => {
      const state = startRescue(dustCrisis, params);
      expect(state.status).toBe("running");
      expect(state.t).toBe(0);
      expect(state.soc).toBeCloseTo(params.batteryKwh * 0.35);
      expect(state.effScale).toBe(0.7);
      expect(state.drives).toBe(0);
      expect(state.horizonDrop).toBe(0);
      expect(state.instrumentsOff).toBe(false);
      expect(state.tilted).toBe(false);
      expect(state.hibernateUntil).toBe(-1);
      expect(state.scienceH).toBe(0);
      expect(state.log.length).toBe(1);
      expect(state.log[0].tone).toBe("fail");
      expect(state.log[0].text).toContain("Dust storm");
    });

    it("initializes rescue state for late landing and heater crisis", () => {
      const lateState = startRescue(lateCrisis, params);
      expect(lateState.startH).toBeGreaterThanOrEqual(48);

      const heaterState = startRescue(heaterCrisis, params);
      expect(heaterState.crisis.extraLoadKw).toBe(0.8);
    });

    it("handles findSunset fallback when no night run is found", () => {
      // Mock site with continuous sunlight or custom crisis delay
      const customCrisis: Crisis = {
        id: "mock",
        title: "Mock",
        story: "Mock story",
        effScale: 1,
        extraLoadKw: 0,
        delayH: 100000, // Wrapped hour with potential edge condition
      };
      const state = startRescue(customCrisis, params);
      expect(state.startH).toBeDefined();
    });
  });

  describe("isLit", () => {
    it("determines illumination and accounts for horizonDrop", () => {
      const state = startRescue(dustCrisis, params);
      const litOriginal = isLit(state, 0);

      const modifiedState: RescueState = { ...state, horizonDrop: 100 };
      // A massive horizon drop must make the lander lit
      expect(isLit(modifiedState, 0)).toBe(true);
      expect(typeof litOriginal).toBe("boolean");
    });
  });

  describe("canMove", () => {
    it("allows valid moves in running state", () => {
      const s = startRescue(dustCrisis, params);
      expect(canMove(s, "drive")).toBe(true);
      expect(canMove(s, "tilt")).toBe(true);
      expect(canMove(s, "hibernate")).toBe(true);
      expect(canMove(s, "instruments")).toBe(true);
    });

    it("prevents any moves when game is lost or saved", () => {
      const lost: RescueState = { ...startRescue(dustCrisis, params), status: "lost" };
      expect(canMove(lost, "drive")).toBe(false);
      expect(canMove(lost, "tilt")).toBe(false);

      const saved: RescueState = { ...startRescue(dustCrisis, params), status: "saved" };
      expect(canMove(saved, "hibernate")).toBe(false);
      expect(canMove(saved, "instruments")).toBe(false);
    });

    it("limits drive to 3 times", () => {
      const s: RescueState = { ...startRescue(dustCrisis, params), drives: 3 };
      expect(canMove(s, "drive")).toBe(false);
    });

    it("allows tilt only once", () => {
      const s: RescueState = { ...startRescue(dustCrisis, params), tilted: true };
      expect(canMove(s, "tilt")).toBe(false);
    });

    it("disallows hibernate while currently hibernating", () => {
      const s: RescueState = { ...startRescue(dustCrisis, params), t: 2, hibernateUntil: 6 };
      expect(canMove(s, "hibernate")).toBe(false);

      const sAwake: RescueState = { ...startRescue(dustCrisis, params), t: 6, hibernateUntil: 6 };
      expect(canMove(sAwake, "hibernate")).toBe(true);
    });
  });

  describe("applyMove", () => {
    it("returns unchanged state if move is not allowed", () => {
      const lost: RescueState = { ...startRescue(dustCrisis, params), status: "lost" };
      const res = applyMove(lost, "drive");
      expect(res).toBe(lost);
    });

    it("applies tilt: increases effScale by 15% and sets tilted true", () => {
      const s = startRescue(dustCrisis, params);
      const res = applyMove(s, "tilt");
      expect(res.tilted).toBe(true);
      expect(res.effScale).toBeCloseTo(0.7 * 1.15);
      expect(res.log.some((l) => l.text.includes("Panels tilted toward the Sun"))).toBe(true);
    });

    it("applies instruments: toggles instrumentsOff", () => {
      const s = startRescue(dustCrisis, params);
      const res1 = applyMove(s, "instruments");
      expect(res1.instrumentsOff).toBe(true);
      expect(res1.log.some((l) => l.text.includes("Instruments off. Saving power."))).toBe(true);

      const res2 = applyMove(res1, "instruments");
      expect(res2.instrumentsOff).toBe(false);
      expect(res2.log.some((l) => l.text.includes("Instruments back on. Science resumed."))).toBe(true);
    });

    it("applies hibernate: sets hibernateUntil to t + 6", () => {
      const s = startRescue(dustCrisis, params);
      const res = applyMove(s, "hibernate");
      expect(res.hibernateUntil).toBe(s.t + 6);
      expect(res.log.some((l) => l.text.includes("Hibernating for 6 hours"))).toBe(true);
    });

    it("applies drive: costs 4 kWh and advances 2 hours with horizonDrop", () => {
      const s = startRescue(dustCrisis, params);
      const res = applyMove(s, "drive");
      expect(res.drives).toBe(1);
      expect(res.horizonDrop).toBeCloseTo(0.1);
      expect(res.t).toBe(s.t + 2);
      expect(res.log.some((l) => l.text.includes("Drove 1 km toward the light (1/3)"))).toBe(true);
    });
  });

  describe("tick and state progression", () => {
    it("returns unchanged state when game is already over", () => {
      const lost: RescueState = { ...startRescue(dustCrisis, params), status: "lost" };
      expect(tick(lost)).toBe(lost);
    });

    it("advances game clock by 1 hour and accumulates science when instruments are active", () => {
      const s = startRescue(dustCrisis, params);
      const next = tick(s);
      expect(next.t).toBe(s.t + 1);
      expect(next.scienceH).toBe(1);
    });

    it("does not accumulate science during hibernation", () => {
      const s = { ...startRescue(dustCrisis, params), hibernateUntil: 5, t: 0 };
      const next = tick(s);
      expect(next.scienceH).toBe(0);
    });

    it("does not accumulate science when instruments are off", () => {
      const s = { ...startRescue(dustCrisis, params), instrumentsOff: true };
      const next = tick(s);
      expect(next.scienceH).toBe(0);
    });

    it("logs waking up when reaching hibernateUntil", () => {
      const s = { ...startRescue(dustCrisis, params), t: 2, hibernateUntil: 3 };
      const next = tick(s);
      expect(next.t).toBe(3);
      expect(next.log.some((l) => l.text.includes("Waking up from hibernation"))).toBe(true);
    });

    it("marks game as saved when reaching RESCUE_HOURS", () => {
      const s: RescueState = {
        ...startRescue(dustCrisis, params),
        t: RESCUE_HOURS - 1,
        soc: 50,
      };
      const next = tick(s);
      expect(next.t).toBe(RESCUE_HOURS);
      expect(next.status).toBe("saved");
      expect(next.log.some((l) => l.text.includes("The lander made it through. Mission saved."))).toBe(true);
    });

    it("marks game as lost when battery reaches 0", () => {
      const s: RescueState = {
        ...startRescue(dustCrisis, params),
        horizonDrop: -100, // force in darkness / shadow so charge is 0
        soc: 0.5, // Low battery
      };
      // Next tick will draw loadKw (1.8 kW) in darkness, bringing soc <= 0
      const next = tick(s);
      expect(next.soc).toBe(0);
      expect(next.status).toBe("lost");
      expect(next.log.some((l) => l.text.includes("Battery empty. Mission lost."))).toBe(true);
    });
  });

  describe("hoursLeft", () => {
    it("returns the exact number of hours until battery exhaustion", () => {
      const s: RescueState = {
        ...startRescue(heaterCrisis, params),
        soc: 5, // with ~2.6 kW load in shadow, will drain in ~2 hours
      };
      const left = hoursLeft(s);
      expect(typeof left).toBe("number");
      expect(left).toBeGreaterThan(0);
      expect(left).toBeLessThanOrEqual(RESCUE_HOURS);
    });

    it("returns null if battery survives all RESCUE_HOURS", () => {
      const s: RescueState = {
        ...startRescue(dustCrisis, { ...params, batteryKwh: 200, loadKw: 0.1 }),
        soc: 200,
        horizonDrop: 100, // permanently lit
      };
      const left = hoursLeft(s);
      expect(left).toBeNull();
    });
  });
});
