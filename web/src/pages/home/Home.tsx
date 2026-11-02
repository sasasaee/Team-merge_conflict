import { SITES, VERDICT_LABEL, useMission, useSim } from "@/core";
import { Badge, NavBar } from "@/ui";

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
    <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
      <NavBar current="#/" />

      <section className="grid items-center gap-12 py-16 lg:grid-cols-[1.2fr_1fr] lg:py-24">
        <div>
          <h1 className="text-5xl leading-[1.05] font-extrabold tracking-tight md:text-7xl">Will your Moon landing survive?</h1>
          <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-text/80">
            MoonScope is a mission planner for the Moon&apos;s south pole. It checks, hour by hour, whether a lander gets enough sunlight
            for power and enough contact with Earth, tests the plan against delays, and tells you the smallest change that saves it.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#/plan" className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent/85">
              Open the planner
            </a>
            <a href="#/rescue" className="rounded-full border border-line px-6 py-3 text-sm font-semibold hover:border-muted">
              Try Rescue Mode
            </a>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-line bg-surface">
          <svg viewBox="0 0 400 300" className="block w-full" role="img" aria-label="Low Sun over the lunar south pole with Earth in the sky">
            <defs>
              <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#070b14" />
                <stop offset="1" stopColor="#1a2340" />
              </linearGradient>
              <radialGradient id="glow" cx="0.78" cy="0.68" r="0.5">
                <stop offset="0" stopColor="#f5a524" stopOpacity="0.55" />
                <stop offset="1" stopColor="#f5a524" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="400" height="300" fill="url(#sky)" />
            <rect width="400" height="300" fill="url(#glow)" />
            <circle cx="90" cy="80" r="16" fill="#3b82f6" />
            <circle cx="96" cy="76" r="16" fill="#070b14" opacity="0.5" />
            <circle cx="312" cy="200" r="9" fill="#fff4d6" />
            <path d="M0 230 Q60 205 120 222 T240 214 T330 196 T400 210 V300 H0 Z" fill="#11182c" />
            <path d="M120 222 Q180 206 240 214 T330 196 T400 210" fill="none" stroke="#f5a524" strokeWidth="2" opacity="0.9" />
            <path d="M0 255 Q80 238 170 252 T400 244 V300 H0 Z" fill="#0a0f1d" />
          </svg>
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4 text-sm">
            <span className="text-muted">
              Live check: 10-day mission at <b className="text-text">{SITES[siteIdx].name}</b>
            </span>
            <Badge tone={r.verdict}>{VERDICT_LABEL[r.verdict]}</Badge>
          </div>
        </div>
      </section>

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
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/20 font-bold text-accent-soft">{i + 1}</span>
              <p className="leading-relaxed text-text/80">{s}</p>
            </li>
          ))}
        </ol>
        <a href="#/plan" className="mt-12 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent/85">
          Start planning a mission
        </a>
      </section>
    </div>
  );
}