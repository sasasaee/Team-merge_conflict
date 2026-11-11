import { useEffect, useMemo, useRef } from "react";
import clsx from "clsx";
import { missionEvents, useMission } from "@/core";
import { toneText } from "@/ui";

export function Alerts() {
  const params = useMission((s) => s.params);
  const timeH = useMission((s) => s.timeH);
  const setTime = useMission((s) => s.setTime);
  const events = useMemo(() => missionEvents(params), [params]);
  const listRef = useRef<HTMLOListElement>(null);
  const nextIdx = events.findIndex((e) => e.hour > timeH);

  // Keep the next event in view by scrolling the list itself (never the page)
  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>("[data-next='true']");
    if (!list || !el) return;
    const top = el.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: Math.max(0, top - list.clientHeight / 2), behavior: "smooth" });
    }
  }, [nextIdx]);

  return (
    <ol ref={listRef} className="max-h-64 space-y-1 overflow-auto pr-2 text-sm">
      {events.map((e, i) => (
        <li key={`${e.hour}-${i}`} data-next={i === nextIdx}>
          <button
            type="button"
            onClick={() => setTime(e.hour)}
            className={clsx(
              "flex w-full gap-3 rounded-md px-2 py-1 text-left hover:bg-surface-2",
              i === nextIdx && "bg-surface-2",
            )}
          >
            <span className="num w-14 shrink-0 text-muted">T+{e.hour}h</span>
            <span className={e.hour > timeH && i !== nextIdx ? "text-muted" : e.tone === "muted" ? "text-text" : toneText[e.tone]}>{e.text}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}