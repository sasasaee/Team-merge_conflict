import type { ReactNode } from "react";
import clsx from "clsx";
import { toneBg, toneText, type Tone } from "./theme";

export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide", toneBg[tone], toneText[tone])}>
      {children}
    </span>
  );
}