import { useCallback, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { Tour } from "./Tour";
import type { Page } from "./usePage";

// "How it works" button in the top menu. Starts a guided tour that points at each part of the page.
// "All explanations" in the tour opens a guide with one card per panel or option (what it is, how it helps).
type Card = { title: string; what: string; helps: string };
type Section = { id: string; label: string; intro: string; cards: Card[] };

const SECTIONS: Section[] = [
  {
    id: "plan",
    label: "Planner",
    intro: "Plan a Moon landing and check, hour by hour, if the lander gets enough sunlight for power and can still talk to Earth.",
    cards: [
      { title: "Lunar Map (2D / 3D)", what: "9 possible landing places near the Moon's south pole. Dot colour shows if your mission works there: green yes, amber maybe, red no.", helps: "See at a glance which places are safe, and pick one with a click." },
      { title: "Custom landing point", what: "Type a position (latitude and longitude). If it is close to one we have worked out, the plan moves there.", helps: "At the pole, moving just a few hundred metres can change how much sunlight you get." },
      { title: "Mission settings", what: "Landing day, battery size, how much power the lander uses, how good the solar panels are, hours of Earth contact needed each day, and how many days the mission lasts.", helps: "Make the plan match your lander and see which setting breaks it." },
      { title: "The verdict", what: "Green FEASIBLE: it works with room to spare. Amber AT RISK: it only just works. Red INFEASIBLE: the battery runs too low or there is not enough time to talk to Earth.", helps: "One word that tells you: go, be careful, or change the plan." },
      { title: "Local Sky", what: "The sky as seen from the lander. Outer edge = horizon, middle = straight up. Grey = mountains, yellow dot = Sun, blue dot = Earth.", helps: "If the Sun is behind the grey there is no solar power; if Earth is, there is no radio." },
      { title: "Timeline", what: "The whole mission, hour by hour. Top bar: yellow when the Sun shines. Bottom bar: the radio link to Earth, blue good, yellow weak, red lost. Press play to watch it.", helps: "See exactly when the dark and silent times happen." },
      { title: "Key numbers", what: "How high the Sun is, how much of the time there is sunlight, how much of the time there is contact with Earth, the longest time with no signal, and the lowest battery level.", helps: "The numbers you need to say go or no-go." },
      { title: "What the lander sees", what: "A full circle view of the mountains around the lander, made from real NASA height maps, with the Sun and Earth moving along it.", helps: "See which mountain blocks the Sun, and when." },
      { title: "What-if tests", what: "Try changes like landing 5 days late, weaker panels, or landing 2 km away. Up to 4 at once.", helps: "Check the plan against things that often go wrong." },
      { title: "Compare", what: "Your plan and each what-if side by side, with their battery levels.", helps: "See which change helps and which hurts." },
      { title: "How to fix it", what: "Says why the plan fails and suggests the smallest change that saves it. One click applies it.", helps: "Turns a failing plan into a working one fast." },
      { title: "Mission alerts", what: "Simple messages like 'Earth goes behind the mountain'. Click one to jump to that moment.", helps: "An easy-to-read story of what will happen to the lander." },
      { title: "Ask MoonScope", what: "Type what you want in plain words, like 'land 3 days later with a bigger battery'.", helps: "Change several settings with one sentence." },
    ],
  },
  {
    id: "rescue",
    label: "Rescue Mode",
    intro: "A short game: something goes wrong after landing, and you must keep the lander alive for 3 days.",
    cards: [
      { title: "Pick a problem", what: "Dust on the solar panels, a late landing just before a long night, or a heater stuck on and wasting power.", helps: "These are real problems that mission teams plan for." },
      { title: "Battery and countdown", what: "The battery bar and 'Battery empty in X hours' change after every move you make.", helps: "Shows how much time each choice buys you." },
      { title: "Your moves", what: "Drive toward the sun, turn off the instruments, go to sleep for 6 hours, or tilt the panels toward the Sun.", helps: "Every move has a cost: less science, no radio, or using up time." },
      { title: "Win or lose", what: "You win if the battery lasts the full 3 days. You lose if it runs out.", helps: "Shows that where and when you land matters more than battery size." },
    ],
  },
  {
    id: "calendar",
    label: "Survival Calendar",
    intro: "Every possible landing day for the next 2 months, checked with your settings.",
    cards: [
      { title: "Colours", what: "Green = safe, amber = risky, red = fails. A small dot keeps the colour showing when a day is selected.", helps: "Find the safe days to land at a glance." },
      { title: "First bad day", what: "The first red day has a red ring and is named above the calendar.", helps: "Tells you how late the landing can slip before it fails." },
      { title: "Click a day", what: "Opens the planner for that landing day.", helps: "Go from 'which day?' to the full details." },
    ],
  },
  {
    id: "sites",
    label: "Shadow DNA",
    intro: "A light-and-signal fingerprint for every landing place, side by side.",
    cards: [
      { title: "Rings", what: "Outer ring = sunlight over a month, inner ring = contact with Earth. Gaps mean darkness or no signal.", helps: "Compare places without reading numbers." },
      { title: "Numbers", what: "How much of the time there is sunlight and Earth contact, the longest day, the longest night, and the longest time with no signal.", helps: "The longest night tells you how big the battery must be." },
      { title: "Plan a mission here", what: "Opens the planner at that place.", helps: "Go from comparing places to testing one in one click." },
    ],
  },
  {
    id: "terms",
    label: "Simple words",
    intro: "What the words in MoonScope mean.",
    cards: [
      { title: "Why the south pole is hard", what: "Near the pole the Sun never rises high. It moves around the sky just above the horizon, so a mountain can hide it for days.", helps: "That is why small changes in place or day matter so much." },
      { title: "Horizon", what: "The outline of the mountains around the lander, in every direction, made from NASA height maps of the Moon.", helps: "It decides when the Sun and Earth are hidden." },
      { title: "Height and direction", what: "Height = how many degrees something is above the ground line. Direction = which way to look, like a compass (0 = north, 90 = east).", helps: "Tells you where to look for the Sun or Earth." },
      { title: "Earth contact", what: "Good when Earth is clearly above the mountains, weak when it only just peeks over, lost when it is hidden.", helps: "No Earth in view means no radio." },
      { title: "Battery safety level", what: "A quarter of the battery is kept as a safety reserve. Going below it means the mission fails.", helps: "Real landers never plan to run their battery empty." },
      { title: "A Moon day", what: "About 29 and a half Earth days from one sunrise to the next.", helps: "That is why nights near the pole can last for days." },
    ],
  },
];

const TAB_FOR: Partial<Record<Page, string>> = { "#/plan": "plan", "#/rescue": "rescue", "#/calendar": "calendar", "#/sites": "sites" };

export function HowItWorks({ page }: { page: Page }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState("plan");
  const [touring, setTouring] = useState(false);
  const close = () => ref.current?.close();
  const endTour = useCallback(() => setTouring(false), []);
  const openGuide = () => {
    setTouring(false);
    setTab(TAB_FOR[page] ?? "plan");
    ref.current?.showModal();
  };
  const section = SECTIONS.find((s) => s.id === tab) ?? SECTIONS[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setTouring(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-muted transition"
      >
        <BookOpen size={15} /> How it works
      </button>

      <Tour page={page} open={touring} onClose={endTour} onGuide={openGuide} />

      <dialog
        ref={ref}
        aria-labelledby="how-title"
        onClick={(e) => e.target === ref.current && close()}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(980px,calc(100vw-2rem))] overflow-auto rounded-3xl border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">Guide</p>
              <h2 id="how-title" className="mt-1 text-2xl font-bold md:text-3xl">
                How MoonScope works
              </h2>
            </div>
            <button type="button" onClick={close} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted">
              <X size={16} />
            </button>
          </div>

          <div role="group" aria-label="Guide sections" className="mt-5 flex flex-wrap gap-1.5">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={tab === s.id}
                onClick={() => setTab(s.id)}
                className="rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-muted transition"
              >
                {s.label}
              </button>
            ))}
          </div>

          <p className="mt-5 max-w-[70ch] text-text/80">{section.intro}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.cards.map((c) => (
              <article key={c.title} className="rounded-2xl border border-line bg-surface-2/50 p-4">
                <h3 className="font-semibold text-sun">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text/80">{c.what}</p>
                <p className="mt-2 border-t border-line pt-2 text-sm leading-relaxed text-text/70">
                  <span className="font-semibold text-accent-soft">How it helps: </span>
                  {c.helps}
                </p>
              </article>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}