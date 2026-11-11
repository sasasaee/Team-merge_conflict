import { useRef } from "react";
import { HelpCircle, X } from "lucide-react";

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

// "?" button in the top menu. Opens a card that explains what MoonScope does and how to use it.
// Uses the native <dialog>: Esc closes it, focus stays inside while it is open.
export function AboutDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-label="What MoonScope does"
        title="What MoonScope does"
        className="grid size-8 place-items-center rounded-full border border-line text-accent-soft transition hover:border-accent-soft hover:bg-accent/20"
      >
        <HelpCircle size={17} />
      </button>

      <dialog
        ref={ref}
        aria-labelledby="about-title"
        onClick={(e) => e.target === ref.current && close()}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(760px,calc(100vw-2rem))] overflow-auto rounded-3xl border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">About</p>
              <h2 id="about-title" className="mt-1 text-2xl font-bold md:text-3xl">
                What MoonScope does
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted hover:text-text"
            >
              <X size={16} />
            </button>
          </div>

          <p className="mt-3 max-w-[60ch] text-text/80">
            A mission planner for the Moon&apos;s south pole. It checks, hour by hour, whether a lander gets enough sunlight for power and
            enough contact with Earth, tests the plan against delays, and finds the smallest change that saves it.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {FEATURES.map(([title, body, href]) => (
              <a
                key={title}
                href={href}
                onClick={close}
                className="rounded-2xl border border-line bg-surface-2/50 p-4 transition hover:border-accent-soft"
              >
                <h3 className="font-semibold text-sun">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-text/75">{body}</p>
              </a>
            ))}
          </div>

          <h3 className="mt-8 text-lg font-semibold">How to use it</h3>
          <ol className="mt-4 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent/25 text-sm font-bold text-accent-soft">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-text/80">{s}</p>
              </li>
            ))}
          </ol>

          <a
            href="#/plan"
            onClick={close}
            className="mt-8 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent/85"
          >
            Start planning a mission
          </a>
        </div>
      </dialog>
    </>
  );
}