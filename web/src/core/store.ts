import { useMemo } from "react";
import { create } from "zustand";
import { simulate } from "./simulate";
import type { MissionParams } from "./types";

type MissionState = {
  params: MissionParams;
  timeH: number;
  playing: boolean;
  setParam: <K extends keyof MissionParams>(key: K, value: MissionParams[K]) => void;
  patch: (changes: Partial<MissionParams>) => void;
  setTime: (h: number) => void;
  setPlaying: (playing: boolean) => void;
};

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
}));

export function useSim() {
  const params = useMission((s) => s.params);
  return useMemo(() => simulate(params), [params]);
}