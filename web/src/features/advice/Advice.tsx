import { useMemo } from "react";
import { AlertTriangle, Battery, CalendarClock, CheckCircle2, MapPin, Sun, Zap, type LucideIcon } from "lucide-react";
import { VERDICT_LABEL, getRecommendations, simulate, useMission, useSim, type RecommendationCategory, type SimResult } from "@/core";
import { Badge } from "@/ui";

const DELAY_TESTS = [24, 72, 120];

const CATEGORY_ICON: Record<RecommendationCategory, LucideIcon> = {
  date: CalendarClock,
  site: MapPin,
  battery: Battery,
  power: Zap,
  panel: Sun,
};

function FixRow({ icon: Icon, text, result, onApply }: { icon: LucideIcon; text: string; result: SimResult; onApply: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/60 p-3">
      <span className="flex items-center gap-2 text-xs">
        <Icon size={16} className="text-accent-soft shrink-0" />
        <span>{text}</span>
        <Badge tone={result.verdict}>{VERDICT_LABEL[result.verdict]}</Badge>
      </span>
      <button type="button" onClick={onApply} className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:bg-accent/80">
        Apply
      </button>
    </div>
  );
}

export function Advice() {
  const params = useMission((s) => s.params);
  const patch = useMission((s) => s.patch);
  const r = useSim();

  const robust = useMemo(() => DELAY_TESTS.filter((d) => simulate(params, d).verdict !== "fail").length, [params]);
  const advice = useMemo(() => getRecommendations(params, r), [params, r]);

  if (advice.isSafe) {
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
        {advice.recommendations.map((rec) => {
          const Icon = CATEGORY_ICON[rec.category] ?? Zap;
          return (
            <FixRow
              key={rec.id}
              icon={Icon}
              text={`${rec.title} (${rec.improvement})`}
              result={rec.result}
              onApply={() => patch(rec.changes)}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 shrink-0 text-fail" size={18} />
        <span>
          <b>Mission fails ({r.cause === "power" ? "power" : "communication"}).</b> {advice.message}
        </span>
      </p>

      {advice.recommendations.map((rec) => {
        const Icon = CATEGORY_ICON[rec.category] ?? Zap;
        return (
          <FixRow
            key={rec.id}
            icon={Icon}
            text={`${rec.title}: ${rec.improvement}`}
            result={rec.result}
            onApply={() => patch(rec.changes)}
          />
        );
      })}

      {advice.recommendations.length === 0 && (
        <p className="text-xs text-muted">No simple fix found. Try a larger battery or a different landing site.</p>
      )}
    </div>
  );
}
