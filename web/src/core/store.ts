import { useMemo } from "react";
import { create } from "zustand";
import { MAX_SCENARIOS, PRESETS, type Scenario } from "./scenarios";
import { simulate } from "./simulate";
import type { MissionParams } from "./types";

type MissionState = {
  params: MissionParams;
  timeH: number;
  playing: boolean;
  scenarios: Scenario[];
  setParam: <K extends keyof MissionParams>(key: K, value: MissionParams[K]) => void;
  patch: (changes: Partial<MissionParams>) => void;
  setTime: (h: number) => void;
  setPlaying: (playing: boolean) => void;
  addScenario: (sc: Scenario) => void;
  removeScenario: (id: string) => void;
};

const preset = (id: string) => PRESETS.find((p) => p.id === id)!;

// Shared mission state. Every brick reads from here; bricks never import each other.
export const useMission = create<MissionState>((set) => ({
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
  scenarios: [preset("early"), preset("delay5"), preset("panels")],
  setParam: (key, value) =>
    set((s) => {
      const params = { ...s.params, [key]: value };
      return { params, timeH: Math.min(s.timeH, params.durationDays * 24 - 1) };
    }),
  patch: (changes) =>
    set((s) => {
      const params = { ...s.params, ...changes };
      return { params, timeH: Math.min(s.timeH, params.durationDays * 24 - 1) };
    }),
  setTime: (h) => set({ timeH: h }),
  setPlaying: (playing) => set({ playing }),
  addScenario: (sc) =>
    set((s) =>
      s.scenarios.length >= MAX_SCENARIOS || s.scenarios.some((x) => x.id === sc.id) ? s : { scenarios: [...s.scenarios, sc] },
    ),
  removeScenario: (id) => set((s) => ({ scenarios: s.scenarios.filter((x) => x.id !== id) })),
}));

export function useSim() {
  const params = useMission((s) => s.params);
  return useMemo(() => simulate(params), [params]);
}