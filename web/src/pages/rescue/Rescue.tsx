import { useEffect, useState } from "react";
import clsx from "clsx";
import { Pause, Play, RotateCcw } from "lucide-react";
import {
  CRISES,
  MOVES,
  RESCUE_HOURS,
  SITES,
  applyMove,
  canMove,
  hoursLeft,
  isLit,
  startRescue,
  tick,
  useMission,
  type Crisis,
  type Move,
  type RescueState,
} from "@/core";
import { Panorama } from "@/features/lander-view";
import { NavBar, Select, toneText } from "@/ui";

const TICK_MS = 450; // one mission hour every 0.45 s, so 72 h is about 30 s plus your moves

function Intro({ onStart }: { onStart: (c: Crisis) => void }) {
  const siteIdx = useMission((s) => s.params.siteIdx);
  const setParam = useMission((s) => s.setParam);
  return (
    <section className="py-10">
      <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">Rescue Mode</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-text/80">
        Your lander has just touched down and something has gone wrong. Night is falling. Keep the battery alive for 72 hours until help
        arrives. Every move you make re-runs the mission simulator.
      </p>
      <div className="mt-8 max-w-xs">
        <Select
          label="Landing site"
          value={String(siteIdx)}
          options={SITES.map((s, i) => ({ value: String(i), label: s.name }))}
          onChange={(v) => setParam("siteIdx", Number(v))}
        />
      </div>
      <h2 className="mt-10 text-xl font-semibold">Choose what goes wrong</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {CRISES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onStart(c)}
            className="rounded-2xl border border-line bg-surface p-5 text-left transition hover:border-accent"
          >
            <div className="text-lg font-semibold text-fail">{c.title}</div>
            <p className="mt-2 text-sm text-text/75">{c.story}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-accent">Start the rescue</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Game({ game, setGame }: { game: RescueState; setGame: (g: RescueState | null) => void }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || game.status !== "running") return;
    const id = window.setTimeout(() => setGame(tick(game)), TICK_MS);
    return () => window.clearTimeout(id);
  }, [game, paused, setGame]);

  const left = hoursLeft(game);
  const pct = Math.max(0, game.soc / game.params.batteryKwh);
  const lit = isLit(game, game.t);
  const move = (m: Move) => setGame(applyMove(game, m));

  return (
    <section className="grid gap-5 py-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <div className="rounded-2xl border border-fail/40 bg-fail/10 px-5 py-3 text-sm">
          <b className="text-fail">{game.crisis.title}.</b> {game.crisis.story}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-xs text-muted">Mission clock</div>
            <div className="num mt-1 text-3xl font-bold">
              T+{game.t}h <span className="text-base text-muted">/ {RESCUE_HOURS}h</span>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-xs text-muted">Battery</div>
            <div className={clsx("num mt-1 text-3xl font-bold", pct < 0.2 ? "text-fail" : pct < 0.4 ? "text-warn" : "text-ok")}>
              {game.soc.toFixed(0)} <span className="text-base text-muted">kWh</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-surface-2">
              <div className={clsx("h-2 rounded-full transition-all", pct < 0.2 ? "bg-fail" : pct < 0.4 ? "bg-warn" : "bg-ok")} style={{ width: `${pct * 100}%` }} />
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-xs text-muted">Forecast</div>
            <div className={clsx("mt-1 text-xl font-bold", left === null ? "text-ok" : left < 12 ? "text-fail" : "text-warn")}>
              {left === null ? "Battery lasts to the end" : `Battery empty in ${left} h`}
            </div>
            <div className="mt-1 text-xs text-muted">{lit ? "Panels charging" : "In shadow, running on battery"}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4">
          <Panorama siteIdx={game.params.siteIdx} hour={game.startH + game.t} horizonDrop={game.horizonDrop} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(MOVES) as Move[]).map((m) => (
            <button
              key={m}
              type="button"
              disabled={!canMove(game, m)}
              onClick={() => move(m)}
              className="rounded-2xl border border-line bg-surface p-4 text-left transition enabled:hover:border-accent disabled:opacity-40"
            >
              <div className="font-semibold">
                {m === "instruments" && game.instrumentsOff ? "Switch instruments back on" : MOVES[m].label}
              </div>
              <div className="mt-1 text-xs text-muted">{MOVES[m].detail}</div>
            </button>
          ))}
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPaused(!paused)}
            disabled={game.status !== "running"}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-line py-2 text-sm font-semibold disabled:opacity-40"
          >
            {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => setGame(null)}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-line py-2 text-sm font-semibold"
          >
            <RotateCcw size={14} /> New rescue
          </button>
        </div>

        {game.status !== "running" && (
          <div className={clsx("rounded-2xl border p-5", game.status === "saved" ? "border-ok/50 bg-ok/10" : "border-fail/50 bg-fail/10")}>
            <div className={clsx("text-2xl font-bold", game.status === "saved" ? "text-ok" : "text-fail")}>
              {game.status === "saved" ? "Mission saved" : "Mission lost"}
            </div>
            <p className="mt-2 text-sm text-text/80">
              {game.status === "saved"
                ? `The lander survived ${RESCUE_HOURS} hours with ${game.soc.toFixed(0)} kWh left and ${game.scienceH} hours of science.`
                : `The battery ran out at T+${game.t}h. Try driving toward the light earlier, or cut power before the shadow falls.`}
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold">Mission log</h2>
          <ol className="mt-3 max-h-96 space-y-1.5 overflow-auto text-sm">
            {[...game.log].reverse().map((l, i) => (
              <li key={i} className="flex gap-3">
                <span className="num w-12 shrink-0 text-muted">T+{l.t}h</span>
                <span className={l.tone === "muted" ? "text-text/80" : toneText[l.tone]}>{l.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </section>
  );
}

export function Rescue() {
  const params = useMission((s) => s.params);
  const [game, setGame] = useState<RescueState | null>(null);

  return (
    <div className="mx-auto max-w-[1300px] px-5 pb-12 lg:px-8">
      <NavBar current="#/rescue" />
      {game ? <Game game={game} setGame={setGame} /> : <Intro onStart={(c) => setGame(startRescue(c, params))} />}
    </div>
  );
}