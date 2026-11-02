import type { ReactNode } from "react";
import clsx from "clsx";
import { motion } from "motion/react";

type Props = { title: string; icon?: ReactNode; className?: string; delay?: number; children?: ReactNode };

// Card around every planner brick. Fades up on first show; `delay` staggers a group of panels.
export function Panel({ title, icon, className, delay = 0, children }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={clsx("flex min-h-0 flex-col rounded-2xl border border-line bg-surface/80 backdrop-blur", className)}
    >
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        {icon && <span className="text-muted">{icon}</span>}
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
      </header>
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </motion.section>
  );
}