import clsx from "clsx";
import { motion } from "motion/react";
import { CountUp } from "./CountUp";
import { toneText, type Tone } from "./theme";

type Props = { label: string; value: string; unit?: string; tone?: Tone; hint?: string };

const NUMBER = /^-?\d+(\.\d+)?$/;

export function StatTile({ label, value, unit, tone = "muted", hint }: Props) {
  const isNumber = NUMBER.test(value);
  const decimals = value.split(".")[1]?.length ?? 0;

  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={clsx("num mt-1 text-xl font-semibold", tone === "muted" ? "text-text" : toneText[tone])}>
        {isNumber ? (
          <CountUp value={Number(value)} decimals={decimals} />
        ) : (
          // Words (like the verdict) flip in when they change
          <motion.span
            key={value}
            className="inline-block"
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {value}
          </motion.span>
        )}
        {unit && <span className="ml-0.5 text-sm text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}