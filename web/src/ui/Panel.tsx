import type { ReactNode } from "react";
import clsx from "clsx";

type Props = { title: string; icon?: ReactNode; className?: string; children?: ReactNode };

export function Panel({ title, icon, className, children }: Props) {
  return (
    <section className={clsx("flex min-h-0 flex-col rounded-2xl border border-line bg-surface/80 backdrop-blur", className)}>
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        {icon && <span className="text-muted">{icon}</span>}
        <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
      </header>
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </section>
  );
}