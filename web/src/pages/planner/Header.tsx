import { SITES, VERDICT_LABEL, landingLabel, useMission, useSim } from "@/core";
import { Badge } from "@/ui";

// Mission summary line shown above the planner bricks
export function Header() {
  const siteIdx = useMission((s) => s.params.siteIdx);
  const delayH = useMission((s) => s.params.delayH);
  const result = useSim();

  return (
    <header data-tour="verdict" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/80 px-5 py-3 text-sm">
      <span className="text-muted">
        Landing at <b className="text-text">{SITES[siteIdx].name}</b> on <b className="text-text">{landingLabel(delayH)} 2027</b>
      </span>
      <Badge tone={result.verdict}>{VERDICT_LABEL[result.verdict]}</Badge>
    </header>
  );
}