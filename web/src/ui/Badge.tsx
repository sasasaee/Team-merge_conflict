import type { ReactNode } from "react";
import clsx from "clsx";
import { motion } from "motion/react";
import { toneText, type Tone } from "./theme";

// Coloured status text (no background). Flips in whenever its tone changes, so red -> green is easy to notice
export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <motion.span
      key={tone}
      initial={{ rotateX: -90, opacity: 0 }}
      animate={{ rotateX: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={clsx("inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide", toneText[tone])}
    >
      {children}
    </motion.span>
  );
}