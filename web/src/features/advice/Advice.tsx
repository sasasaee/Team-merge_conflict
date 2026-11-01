import { useMemo } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, MapPin, type LucideIcon } from "lucide-react";
import { SITES, VERDICT_LABEL, findBestSite, findSmallestDelay, simulate, useMission, useSim, type SimResult } from "@/core";
import { Badge } from "@/ui";

const DELAY_TESTS = [24, 72, 120];

function FixRow({ icon: Icon, text, result, onApply }: { icon: LucideIcon; text: string; result: SimResult; onApply: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-line/60 bg-bg/40 p-3">
      <span className="flex items-center gap-2 text-xs">
        <Icon size={16} className="text-accent" />
        {text}
        <Badge tone={result.verdict}>{VERDICT_LABEL[result.verdict]}</Badge>
      </span>
      <button type="button" onClick={onApply} className="rounded-full bg-sun px-3 py-1 text-xs font-semibold text-bg hover:bg-[#FFD58F]">
        Apply
      </button>
    </div>
  );
}

export function Advice() {
  const params = useMission((s) => s.params);
  const setParam = useMission((s) => s.setParam);
  const r = useSim();

  const robust = useMemo(() => DELAY_TESTS.filter((d) => simulate(params, d).verdict !== "fail").length, [params]);
  const delayFix = useMemo(() => (r.verdict === "fail" ? findSmallestDelay(params) : null), [params, r.verdict]);
  const siteFix = useMemo(() => (r.verdict === "fail" ? findBestSite(params) : null), [params, r.verdict]);

  if (r.verdict !== "fail") {
    return (
      <div className="space-y-3 text-sm">
        <p className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 shrink-0 text-ok" size={18} />
          <span>
            <b>This plan works.</b> Battery never drops below {r.minSoc.toFixed(0)} kWh and Earth is reachable{" "}
            {Math.round(r.earthOkPct * 100)}% of the time.
          </span>
        </p>
        <p className="text-xs text-muted">
          Stress test: survives <b className="text-text">{robust} of 3</b> launch delays (1, 3 and 5 days).
          {robust < 3 && " Keep a backup date or site ready."}
        </p>
      </div>
    );
  }

  const day = Math.floor((r.failHour ?? 0) / 24) + 1;
  const why =
    r.cause === "power"
      ? `The battery drops below the safe reserve on day ${day}. The site stays in shadow too long to recharge.`
      : `Earth contact falls below ${params.commHoursReq} h/day on day ${day}. Earth is hidden behind the terrain.`;

  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 shrink-0 text-fail" size={18} />
        <span>
          <b>Mission fails ({r.cause === "power" ? "power" : "communication"}).</b> {why}
        </span>
      </p>
      {delayFix && (
        <FixRow
          icon={CalendarClock}
          text={`Land ${delayFix.delayH / 24} day${delayFix.delayH > 24 ? "s" : ""} later`}
          result={delayFix.result}
          onApply={() => setParam("delayH", Math.min(240, params.delayH + delayFix.delayH))}
        />
      )}
      {siteFix && (
        <FixRow
          icon={MapPin}
          text={`Switch to ${SITES[siteFix.siteIdx].name}`}
          result={siteFix.result}
          onApply={() => setParam("siteIdx", siteFix.siteIdx)}
        />
      )}
      {!delayFix && !siteFix && <p className="text-xs text-muted">No simple fix found. Try a bigger battery.</p>}
    </div>
  );
}