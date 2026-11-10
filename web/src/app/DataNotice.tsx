import { useState } from "react";
import { AlertTriangle, ChevronDown, X } from "lucide-react";
import { dataProblems } from "@/core";

// Banner under the menu when the real NASA site files could not be used: which files, why, and how to fix them.
export function DataNotice() {
  const problems = dataProblems();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  if (!problems.length || hidden) return null;

  return (
    <div role="status" className="border-b border-warn/40 bg-warn/10">
      <div className="mx-auto max-w-[1440px] px-5 py-3 text-sm lg:px-8">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" />
          <p className="flex-1">
            <b>Showing sample data, not the real NASA data.</b> {problems.length} site file{problems.length > 1 ? "s" : ""} could not be
            used.{" "}
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex items-center gap-1 font-semibold text-warn underline-offset-2 hover:underline">
              {open ? "Hide" : "Show"} causes and fixes <ChevronDown size={14} className={open ? "rotate-180" : ""} />
            </button>
          </p>
          <button type="button" onClick={() => setHidden(true)} aria-label="Dismiss" className="text-muted hover:text-text">
            <X size={16} />
          </button>
        </div>
        {open && (
          <ul className="mt-3 space-y-2 pl-8">
            {problems.map((p) => (
              <li key={p.file} className="rounded-lg border border-line bg-surface/70 p-3">
                <div className="font-semibold">
                  {p.site} <span className="num text-xs font-normal text-muted">({p.file})</span>
                </div>
                <div className="mt-1 text-text/80">
                  <b>Cause:</b> {p.cause}
                </div>
                <div className="text-text/80">
                  <b>Fix:</b> {p.fix}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}