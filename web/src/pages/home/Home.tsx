import { SITES, VERDICT_LABEL, useMission, useSim } from "@/core";
import { motion } from "motion/react";
import { Badge } from "@/ui";
import { HeroSky } from "./HeroSky";

const FEATURES = [
  ["Mission planner", "Set a site, date, battery and power use. See sunlight, Earth contact and the battery hour by hour.", "#/plan"],
  ["Rescue Mode", "Something goes wrong after touchdown. Make the right moves in 60 seconds to keep the lander alive.", "#/rescue"],
  ["Survival Calendar", "Sixty landing dates coloured by result, with the earliest date the mission fails.", "#/calendar"],
  ["Shadow DNA", "A fingerprint of light and signal for every site, side by side.", "#/sites"],
];

const STEPS = [
  "Pick a landing site at the lunar south pole and a landing date.",
  "Set battery size, power use, mission length and daily Earth-contact time.",
  "Read the verdict, watch the timeline, and apply a fix if the plan fails.",
];

export function Home() {
  const siteIdx = useMission((s) => s.params.siteIdx);
  const r = useSim();

  return (
    <div>
      <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="grid gap-8 pt-10 pb-6 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:pt-16"
        >
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-text uppercase">Lunar south pole mission planner</p>
            <h1 className="mt-4 text-5xl leading-[1.02] font-bold tracking-tight md:text-7xl">Will your Moon landing survive?</h1>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-text/80">
              At the south pole the Sun never climbs high: it circles along the horizon. MoonScope checks every hour of your mission for
              sunlight, Earth contact and battery, and finds the smallest change that saves a failing plan.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="#/plan" className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent/85">
                Open the planner
              </a>
              <a href="#/rescue" className="rounded-full border border-line px-6 py-3 text-sm font-semibold hover:border-muted">
                Try Rescue Mode
              </a>
              <span className="flex items-center gap-2 text-xs text-muted">
                10-day plan at {SITES[siteIdx].name}: <Badge tone={r.verdict}>{VERDICT_LABEL[r.verdict]}</Badge>
              </span>
            </div>
          </div>
        </motion.section>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>
        <HeroSky />
      </motion.div>

      <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
        <section id="what" className="border-t border-line py-20">
          <h2 className="text-3xl font-bold md:text-4xl">What MoonScope does</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            {FEATURES.map(([title, body, href]) => (
              <a key={title} href={href} className="rounded-2xl border border-line bg-surface/60 p-6 transition hover:border-accent">
                <h3 className="text-lg font-semibold text-sun">{title}</h3>
                <p className="mt-2 leading-relaxed text-text/75">{body}</p>
                <span className="mt-4 inline-block text-sm font-semibold text-accent-soft">Open {title}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="border-t border-line py-20">
          <h2 className="text-3xl font-bold md:text-4xl">How to use it</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent-soft">
                  {i + 1}
                </span>
                <p className="leading-relaxed text-text/80">{s}</p>
              </li>
            ))}
          </ol>
          <a
            href="#/plan"
            className="mt-12 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent/85"
          >
            Start planning a mission
          </a>
        </section>
      </div>
    </div>
  );
}