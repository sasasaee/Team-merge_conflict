import { useEffect, useState } from "react";
import clsx from "clsx";
import { loadRealSites } from "@/core";
import { App } from "./App";
import { MoonLoader } from "./MoonLoader";

const MIN_SHOW_MS = 1200; // keep the loading screen up long enough to see the animation
const SUN_SELECTED_MS = 600; // time for the "Sun selected" state to play before the app appears

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// First screen: loads the real NASA site data behind the moon.riv animation, then shows the app.
export function Boot() {
  const [phase, setPhase] = useState<"loading" | "done" | "ready">("loading");

  useEffect(() => {
    let alive = true;
    const quick = reduceMotion();
    Promise.all([loadRealSites(import.meta.env.BASE_URL), wait(quick ? 0 : MIN_SHOW_MS)])
      .then(() => {
        if (!alive) return;
        setPhase("done");
        return wait(quick ? 0 : SUN_SELECTED_MS);
      })
      .then(() => alive && setPhase("ready"));
    return () => {
      alive = false;
    };
  }, []);

  if (phase === "ready") return <App />;

  return (
    <div data-theme="dark" className="fixed inset-0 grid place-items-center bg-bg text-text">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-6 px-6 text-center">
        <MoonLoader sunSelected={phase === "done"} />
        <div>
          <div className="font-display text-2xl font-bold">MoonScope</div>
          <p className="mt-2 text-sm text-muted">
            {phase === "done" ? "Ready. Opening the planner..." : "Loading NASA terrain and Sun/Earth data for 9 landing sites..."}
          </p>
        </div>
        <div className="h-1 w-56 overflow-hidden rounded-full bg-surface-2">
          <div className={clsx("h-full rounded-full bg-accent-soft transition-all duration-500", phase === "done" ? "w-full" : "skeleton w-full opacity-60")} />
        </div>
      </div>
    </div>
  );
}