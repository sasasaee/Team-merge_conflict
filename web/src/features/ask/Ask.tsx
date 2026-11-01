import { useState } from "react";
import { parseQuestion, useMission, type AskResult } from "@/core";

const EXAMPLES = [
  "What if we land 3 days late?",
  "20% weaker panels and a 150 kWh battery",
  "Move to Mons Mouton with 6 hours of Earth contact",
];

export function Ask() {
  const params = useMission((s) => s.params);
  const patch = useMission((s) => s.patch);
  const [text, setText] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);

  const ask = (q: string) => {
    const r = parseQuestion(q, params);
    setResult(r);
    if (r.understood.length) patch(r.changes);
  };

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask a what-if question"
          aria-label="Ask a what-if question"
          className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/85">
          Ask
        </button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              setText(q);
              ask(q);
            }}
            className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted hover:text-text"
          >
            {q}
          </button>
        ))}
      </div>
      {result && (
        <p className="text-sm text-muted">
          {result.understood.length ? (
            <>
              Applied: <span className="text-text">{result.understood.join(", ")}</span>. Check the verdict and charts above.
            </>
          ) : (
            "I couldn't find a change in that. Try a delay in days, a battery size in kWh, weaker panels or a site name."
          )}
        </p>
      )}
    </div>
  );
}