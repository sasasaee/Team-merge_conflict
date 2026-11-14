import { useMemo } from "react";
import clsx from "clsx";
import { CALENDAR_DAYS, SITES, VERDICT_LABEL, landingDate, landingLabel, simulate, useMission } from "@/core";
import { Select } from "@/ui";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COLOR = { ok: "bg-ok/25 border-ok/50", warn: "bg-warn/25 border-warn/50", fail: "bg-fail/25 border-fail/50" } as const;
// Small dot keeps the verdict visible while a day is hovered or selected (both turn the cell teal)
const DOT = { ok: "bg-ok", warn: "bg-warn", fail: "bg-fail" } as const;

export function Calendar() {
  const params = useMission((s) => s.params);
  const setParam = useMission((s) => s.setParam);

  const days = useMemo(
    () =>
      Array.from({ length: CALENDAR_DAYS }, (_, d) => {
        const r = simulate({ ...params, delayH: d * 24 });
        return { d, verdict: r.verdict, minSoc: r.minSoc, date: landingDate(d * 24) };
      }),
    [params],
  );

  const firstFail = days.find((x) => x.verdict === "fail");
  const counts = { ok: 0, warn: 0, fail: 0 };
  days.forEach((x) => counts[x.verdict]++);
  const lead = (days[0].date.getUTCDay() + 6) % 7; // empty cells before the first day (weeks start on Monday)

  const pick = (d: number) => {
    setParam("delayH", d * 24);
    window.location.hash = "#/plan";
  };

  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-12 lg:px-8">
      <section className="py-8">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Survival Calendar</h1>
        <p className="mt-3 max-w-[62ch] text-text/80">
          Every possible landing date for the next {CALENDAR_DAYS} days, tested with your current mission settings. Click a day to open it
          in the planner.
        </p>

        <div className="mt-6 flex flex-wrap items-end gap-6">
          <div className="w-64">
            <Select
              label="Landing site"
              value={String(params.siteIdx)}
              options={SITES.map((s, i) => ({ value: String(i), label: s.name }))}
              onChange={(v) => setParam("siteIdx", Number(v))}
            />
          </div>
          <p className="text-sm">
            {firstFail ? (
              <>
                Earliest date the mission fails: <b className="text-fail">{landingLabel(firstFail.d * 24)}</b>
              </>
            ) : (
              <b className="text-ok">The mission works on every date in this window.</b>
            )}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
          <span><i className="mr-1.5 inline-block size-3 rounded-sm bg-ok/60" />{VERDICT_LABEL.ok}: {counts.ok} days</span>
          <span><i className="mr-1.5 inline-block size-3 rounded-sm bg-warn/60" />{VERDICT_LABEL.warn}: {counts.warn} days</span>
          <span><i className="mr-1.5 inline-block size-3 rounded-sm bg-fail/60" />{VERDICT_LABEL.fail}: {counts.fail} days</span>
        </div>

        <div data-tour="calendar-grid" className="mt-6 grid grid-cols-7 gap-1.5 sm:gap-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-center text-xs text-muted">{w}</div>
          ))}
          {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} />)}
          {days.map((x) => {
            const selected = params.delayH === x.d * 24;
            return (
              <button
                key={x.d}
                type="button"
                onClick={() => pick(x.d)}
                aria-pressed={selected}
                title={`${landingLabel(x.d * 24)}: ${VERDICT_LABEL[x.verdict]}, lowest battery ${x.minSoc.toFixed(0)} kWh`}
                className={clsx(
                  "relative h-14 rounded-lg border p-1.5 text-left transition hover:scale-105 sm:h-16 sm:p-2",
                  COLOR[x.verdict],
                  !selected && firstFail?.d === x.d && "ring-2 ring-fail",
                )}
              >
                <div className="num text-sm font-semibold">{x.date.getUTCDate()}</div>
                <div className="hidden text-[10px] opacity-75 sm:block">{x.date.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}</div>
                <i aria-hidden className={clsx("absolute top-1.5 right-1.5 size-2 rounded-full", DOT[x.verdict], selected && "ring-1 ring-white")} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}