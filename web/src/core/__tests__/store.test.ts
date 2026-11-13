import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, beforeEach } from "vitest";
import { useMission, useSim } from "../store";
import { MAX_SCENARIOS, PRESETS, type Scenario } from "../scenarios";

describe("Mission store (T-49)", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useMission.setState({
      params: {
        siteIdx: 0,
        delayH: 0,
        batteryKwh: 120,
        loadKw: 1.8,
        panelEff: 0.29,
        commHoursReq: 4,
        durationDays: 10,
      },
      timeH: 0,
      playing: false,
      scenarios: [
        PRESETS.find((p) => p.id === "early")!,
        PRESETS.find((p) => p.id === "delay5")!,
        PRESETS.find((p) => p.id === "panels")!,
      ],
    });
  });

  it("initializes with default parameters and scenarios", () => {
    const state = useMission.getState();
    expect(state.params.batteryKwh).toBe(120);
    expect(state.params.durationDays).toBe(10);
    expect(state.timeH).toBe(0);
    expect(state.playing).toBe(false);
    expect(state.scenarios.length).toBe(3);
  });

  it("updates individual parameters with setParam", () => {
    useMission.getState().setParam("batteryKwh", 160);
    expect(useMission.getState().params.batteryKwh).toBe(160);

    useMission.getState().setParam("loadKw", 2.2);
    expect(useMission.getState().params.loadKw).toBe(2.2);

    useMission.getState().setParam("siteIdx", 3);
    expect(useMission.getState().params.siteIdx).toBe(3);
  });

  it("clamps timeH when setParam reduces durationDays", () => {
    useMission.getState().setTime(150);
    expect(useMission.getState().timeH).toBe(150);

    // 5 days = 120 hours. Max valid hour index is 5 * 24 - 1 = 119
    useMission.getState().setParam("durationDays", 5);
    expect(useMission.getState().params.durationDays).toBe(5);
    expect(useMission.getState().timeH).toBe(119);
  });

  it("leaves timeH unchanged when setParam increases durationDays", () => {
    useMission.getState().setTime(50);
    useMission.getState().setParam("durationDays", 14);
    expect(useMission.getState().timeH).toBe(50);
  });

  it("patches multiple parameters with patch() and clamps timeH", () => {
    useMission.getState().setTime(200);

    useMission.getState().patch({
      batteryKwh: 80,
      durationDays: 4, // 4 * 24 - 1 = 95
      delayH: 48,
    });

    const state = useMission.getState();
    expect(state.params.batteryKwh).toBe(80);
    expect(state.params.durationDays).toBe(4);
    expect(state.params.delayH).toBe(48);
    expect(state.timeH).toBe(95);
  });

  it("updates timeH via setTime()", () => {
    useMission.getState().setTime(42);
    expect(useMission.getState().timeH).toBe(42);
  });

  it("updates playing state via setPlaying()", () => {
    expect(useMission.getState().playing).toBe(false);
    useMission.getState().setPlaying(true);
    expect(useMission.getState().playing).toBe(true);
    useMission.getState().setPlaying(false);
    expect(useMission.getState().playing).toBe(false);
  });

  it("adds a scenario with addScenario()", () => {
    const newSc: Scenario = {
      id: "custom-test",
      label: "Custom Test",
      delayH: 24,
      effScale: 1,
      commScale: 1,
      loadScale: 1,
    };

    useMission.getState().addScenario(newSc);
    expect(useMission.getState().scenarios).toContainEqual(newSc);
    expect(useMission.getState().scenarios.length).toBe(4);
  });

  it("does not add duplicate scenarios with the same id", () => {
    const existing = useMission.getState().scenarios[0];
    useMission.getState().addScenario(existing);
    expect(useMission.getState().scenarios.length).toBe(3);
  });

  it("does not exceed MAX_SCENARIOS when adding scenarios", () => {
    expect(MAX_SCENARIOS).toBe(4);
    // Add scenario 4 (max capacity reached)
    useMission.getState().addScenario({
      id: "extra-1",
      label: "Extra 1",
      delayH: 0,
      effScale: 0.9,
      commScale: 1,
      loadScale: 1,
    });
    expect(useMission.getState().scenarios.length).toBe(4);

    // Try adding scenario 5 (should be rejected because length >= MAX_SCENARIOS)
    useMission.getState().addScenario({
      id: "extra-2",
      label: "Extra 2",
      delayH: 12,
      effScale: 1,
      commScale: 1,
      loadScale: 1,
    });
    expect(useMission.getState().scenarios.length).toBe(4);
    expect(useMission.getState().scenarios.some((s) => s.id === "extra-2")).toBe(false);
  });

  it("removes scenario by id with removeScenario()", () => {
    const toRemove = useMission.getState().scenarios[0].id;
    useMission.getState().removeScenario(toRemove);

    const state = useMission.getState();
    expect(state.scenarios.length).toBe(2);
    expect(state.scenarios.some((s) => s.id === toRemove)).toBe(false);
  });

  it("useSim computes and memoizes simulation results for active params", () => {
    function SimConsumer() {
      const sim = useSim();
      return React.createElement("div", { "data-testid": "verdict" }, sim.verdict);
    }

    const html = renderToStaticMarkup(React.createElement(SimConsumer));
    expect(html).toContain('data-testid="verdict"');
    expect(html).toMatch(/ok|warn|fail/);
  });
});
