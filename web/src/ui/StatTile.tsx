import clsx from "clsx";
import { toneText, type Tone } from "./theme";

type Props = { label: string; value: string; unit?: string; tone?: Tone; hint?: string };

export function StatTile({ label, value, unit, tone = "muted", hint }: Props) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={clsx("num mt-1 text-xl font-semibold", tone === "muted" ? "text-text" : toneText[tone])}>
        {value}
        {unit && <span className="ml-0.5 text-sm text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}