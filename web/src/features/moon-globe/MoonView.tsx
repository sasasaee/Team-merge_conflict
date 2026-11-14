import { lazy, Suspense, useState } from "react";
import { MoonMap } from "@/features/moon-map/MoonMap";

// Lets the user switch between the flat 2D map and the 3D Moon. Both pick the same site in the shared store.
// three.js is big, so the 3D view downloads only the first time it is opened; the 2D map shows while it loads.
const MoonGlobe = lazy(() => import("./MoonGlobe").then((m) => ({ default: m.MoonGlobe })));

type Mode = "2d" | "3d";
const KEY = "moonscope-moon-view";

function readMode(): Mode {
  try {
    return localStorage.getItem(KEY) === "3d" ? "3d" : "2d";
  } catch {
    return "2d";
  }
}

export function MoonView() {
  const [mode, setMode] = useState<Mode>(readMode);
  const choose = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      // storage blocked (private window): the choice just isn't remembered
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div role="group" aria-label="Moon view" className="flex justify-center gap-1.5">
        {(["2d", "3d"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => choose(m)}
            className="rounded-full border border-line px-3.5 py-1 text-xs font-semibold text-muted transition"
          >
            {m === "2d" ? "2D map" : "3D Moon"}
          </button>
        ))}
      </div>
      <div className="flex-1">
        {mode === "2d" ? (
          <MoonMap />
        ) : (
          <Suspense fallback={<MoonMap />}>
            <MoonGlobe />
          </Suspense>
        )}
      </div>
    </div>
  );
}