import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { Page } from "./usePage";

// Guided tour: dims the page, highlights one part at a time with a box, and points at it with a small card.
// Targets are elements with data-tour="<id>". A step whose target is not on the page is skipped.
type Step = { target: string; title: string; body: string };

const TOURS: Record<string, Step[]> = {
  plan: [
    { target: "verdict", title: "Will the mission survive?", body: "Green FEASIBLE means yes, with room to spare. Amber AT RISK means it only just makes it. Red INFEASIBLE means no: the battery runs too low, or the lander cannot talk to Earth for long enough." },
    { target: "moon-globe", title: "Choose where to land", body: "These are 9 places near the Moon's south pole. Each dot's colour shows if the mission works there: green yes, amber maybe, red no. Click a place to choose it. Use the buttons to switch between a flat map and a 3D Moon." },
    { target: "mission-form", title: "Set up your lander", body: "Pick the landing day, how big the battery is, how much power the lander uses, how good its solar panels are, how many hours a day it must talk to Earth, and how many days it must last. Change anything and the whole page updates." },
    { target: "local-sky", title: "The sky above the lander", body: "Imagine lying on the ground looking up. The outer edge is the horizon and the middle is straight up. Grey is the mountains. The yellow dot is the Sun and the blue dot is Earth. If the Sun is behind the grey, no solar power. If Earth is behind it, no radio." },
    { target: "timeline", title: "Day by day, hour by hour", body: "The top bar shows when the Sun is shining (yellow). The bottom bar shows the radio link to Earth: blue is good, yellow is weak, red is lost. Press play to watch the mission, or drag to jump to any hour." },
    { target: "metrics", title: "The key numbers", body: "How high the Sun is right now, how much of the time there is sunlight, how much of the time the lander can reach Earth, the longest time without a signal, and the lowest the battery gets. The battery must never drop below its safety level (a quarter of full)." },
    { target: "lander-view", title: "What the lander sees", body: "A full circle view around the lander, made from real NASA height maps of the Moon. Watch the Sun slip behind a mountain: that is when the battery starts to drain." },
    { target: "what-if", title: "What if something goes wrong?", body: "Try changes like landing 5 days late, weaker solar panels, or landing 2 km away. You can test up to 4 at once." },
    { target: "compare", title: "Compare the plans", body: "Your plan and each 'what if' side by side, with their battery levels. You can see straight away which change helps and which one hurts." },
    { target: "advice", title: "How to fix it", body: "If the plan fails, this says why and suggests the smallest change that saves it, like landing a bit later or picking another place. One click applies it." },
    { target: "alerts", title: "What will happen", body: "A simple list of events: sunrise, sunset, Earth going out of view, battery getting low. Click one to jump to that moment." },
    { target: "ask", title: "Just ask", body: "Type what you want in plain words, like 'land 3 days later with a bigger battery', and MoonScope changes the plan for you." },
  ],
  rescue: [
    { target: "rescue-site", title: "Pick a place", body: "The game uses the real sunlight and Earth view of the place you choose." },
    { target: "crises", title: "Pick a problem", body: "Something goes wrong after landing: dust on the panels, a late landing just before a long night, or a heater stuck on. Then choose what to do (drive toward the sun, turn things off, sleep, tilt the panels) to keep the battery alive for 3 days." },
  ],
  calendar: [
    { target: "calendar-grid", title: "Which days are safe to land?", body: "Every possible landing day for the next 2 months, checked with your settings. Green is safe, amber is risky, red fails. The first red day has a red ring. Click any day to see it in detail." },
  ],
  sites: [
    { target: "dna-cards", title: "Each place's light pattern", body: "One card for each place. The outer ring shows sunlight over a month, the inner ring shows contact with Earth. Gaps mean darkness or no signal. The longest dark gap tells you how big the battery needs to be." },
  ],
};

const TOUR_FOR: Partial<Record<Page, string>> = { "#/plan": "plan", "#/rescue": "rescue", "#/calendar": "calendar", "#/sites": "sites" };
const PAD = 8;
const CARD_W = 340;

type Rect = { top: number; left: number; width: number; height: number };

export function Tour({ page, open, onClose, onGuide }: { page: Page; open: boolean; onClose: () => void; onGuide: () => void }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardH, setCardH] = useState(220);
  const card = useRef<HTMLDivElement>(null);

  // On open: go to the Planner if this page has no tour, then keep only steps whose target exists
  useEffect(() => {
    if (!open) return;
    const key = TOUR_FOR[page];
    if (!key) {
      window.location.hash = "#/plan";
      return;
    }
    let tries = 0;
    const id = window.setInterval(() => {
      const found = TOURS[key].filter((s) => document.querySelector(`[data-tour="${s.target}"]`));
      if (found.length || ++tries > 30) {
        window.clearInterval(id);
        if (!found.length) onClose();
        setSteps(found);
        setI(0);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [open, page, onClose]);

  const step = steps[i];

  // Scroll the target into view, then follow it while the page scrolls or resizes
  useEffect(() => {
    if (!open || !step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    let raf = 0;
    const track = () => {
      const r = el?.getBoundingClientRect();
      if (r) setRect((old) => (old && old.top === r.top && old.left === r.left && old.width === r.width && old.height === r.height ? old : { top: r.top, left: r.left, width: r.width, height: r.height }));
      raf = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(raf);
  }, [open, step]);

  useLayoutEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight);
    card.current?.focus();
  }, [step]);

  const next = useCallback(() => (i < steps.length - 1 ? setI(i + 1) : onClose()), [i, steps.length, onClose]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, back, onClose]);

  if (!open || !step || !rect) return null;

  // Place the card below the highlight, else above, else pinned at the bottom of the screen (tall panels)
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - 32);
  const below = rect.top + rect.height + PAD + 14 + cardH < vh;
  const above = rect.top - PAD - 14 - cardH > 0;
  const top = below ? rect.top + rect.height + PAD + 14 : above ? rect.top - PAD - 14 - cardH : vh - cardH - 16;
  const centre = rect.left + rect.width / 2;
  const left = Math.min(Math.max(16, centre - w / 2), vw - w - 16);
  const arrowLeft = Math.min(Math.max(18, centre - left - 7), w - 32);
  const last = i === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[60]" aria-live="polite">
      {/* Click outside the card does nothing, so a mis-click does not end the tour */}
      <div className="absolute inset-0" />
      <div
        className="pointer-events-none absolute rounded-2xl border-2 border-accent-soft transition-all duration-300"
        style={{
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          boxShadow: "0 0 0 9999px rgba(3,5,10,0.72)",
        }}
      />
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        className="absolute rounded-2xl border border-line bg-surface p-4 text-text shadow-2xl outline-none transition-all duration-300"
        style={{ top, left, width: w }}
      >
        {(below || above) && (
          <span
            aria-hidden
            className="absolute size-3.5 rotate-45 border-line bg-surface"
            style={below ? { top: -7, left: arrowLeft, borderLeftWidth: 1, borderTopWidth: 1 } : { bottom: -7, left: arrowLeft, borderRightWidth: 1, borderBottomWidth: 1 }}
          />
        )}
        <div className="flex items-start justify-between gap-3">
          <p className="num text-[11px] text-muted">
            {i + 1} / {steps.length}
          </p>
          <button type="button" onClick={onClose} aria-label="End the tour" className="-mt-1 -mr-1 grid size-7 place-items-center rounded-full text-muted">
            <X size={14} />
          </button>
        </div>
        <h2 id="tour-title" className="mt-0.5 font-semibold text-sun">
          {step.title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-text/85">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={onGuide} className="rounded-full px-1 text-xs text-muted underline-offset-2 hover:underline">
            All explanations
          </button>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={back}
              disabled={i === 0}
              className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted transition disabled:opacity-40"
            >
              <ArrowLeft size={13} /> Back
            </button>
            <button type="button" onClick={next} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white transition">
              {last ? "Done" : "Next"} {!last && <ArrowRight size={13} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}