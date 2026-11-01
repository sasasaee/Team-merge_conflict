import { SITES, VERDICT_LABEL, useMission, useSim } from "@/core";
import { Badge } from "@/ui";

export function Header() {
  const siteIdx = useMission((s) => s.params.siteIdx);
  const delayH = useMission((s) => s.params.delayH);
  const result = useSim();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/80 px-5 py-3">
      <a href="#/" className="flex items-center gap-3" aria-label="Back to home">
        <img src="/favicon.svg" alt="" className="size-8" />
        <div>
          <h1 className="text-base font-bold tracking-tight">MoonScope</h1>
          <p className="text-xs text-muted">Lunar landing site navigator</p>
        </div>
      </a>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
        <span>
          Site <b className="text-text">{SITES[siteIdx].name}</b>
        </span>
        <span className="num">Delay +{(delayH / 24).toFixed(1)} d</span>
        <Badge tone={result.verdict}>{VERDICT_LABEL[result.verdict]}</Badge>
      </div>
    </header>
  );
}