import { useState } from "react";
import { Plus, X } from "lucide-react";
import { MAX_SCENARIOS, PRESETS, customScenario, useMission } from "@/core";
import { Button, Select, Slider } from "@/ui";

// Builds the list of what-if scenarios. The Comparison brick draws them.
export function WhatIf() {
  const scenarios = useMission((s) => s.scenarios);
  const addScenario = useMission((s) => s.addScenario);
  const removeScenario = useMission((s) => s.removeScenario);
  const [delayDays, setDelayDays] = useState(2);
  const [panelPct, setPanelPct] = useState(100);
  const [commScale, setCommScale] = useState("1");
  const [moveEast, setMoveEast] = useState(0);
  const [moveNorth, setMoveNorth] = useState(0);

  const full = scenarios.length >= MAX_SCENARIOS;
  const custom = customScenario(delayDays, panelPct, Number(commScale), 1, moveEast, moveNorth);
  const has = (id: string) => scenarios.some((x) => x.id === id);

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-muted">
          <span>Your scenarios</span>
          <span className="num">
            {scenarios.length}/{MAX_SCENARIOS}
          </span>
        </div>
        {scenarios.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line p-3 text-xs text-muted">No scenarios yet. Add one below to compare it with the plan.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {scenarios.map((sc) => (
              <li key={sc.id} className="flex items-center gap-1 rounded-full border border-accent/50 bg-accent/10 py-1 pr-1 pl-3 text-xs">
                {sc.label}
                <button
                  type="button"
                  onClick={() => removeScenario(sc.id)}
                  aria-label={`Remove ${sc.label}`}
                  className="grid size-5 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 text-xs text-muted">Quick add</div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.id} variant="secondary" size="sm" disabled={full || has(p.id)} onClick={() => addScenario(p)}>
              <Plus size={12} /> {p.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-surface-2/40 p-3">
        <div className="text-xs font-semibold">Build your own</div>
        <Slider
          label="Landing time change"
          value={delayDays}
          min={-3}
          max={10}
          display={delayDays === 0 ? "No change" : `${delayDays > 0 ? "+" : ""}${delayDays} days`}
          onChange={setDelayDays}
        />
        <Slider label="Panel strength" value={panelPct} min={50} max={100} step={5} display={`${panelPct}%`} onChange={setPanelPct} />
        <Select
          label="Earth contact needed"
          value={commScale}
          options={[
            { value: "1", label: "Same as plan" },
            { value: "1.5", label: "1.5x" },
            { value: "2", label: "2x" },
            { value: "3", label: "3x" },
          ]}
          onChange={setCommScale}
        />
        <Slider
          label="Move east / west"
          value={moveEast}
          min={-2}
          max={2}
          display={moveEast === 0 ? "No move" : `${Math.abs(moveEast)} km ${moveEast > 0 ? "east" : "west"}`}
          onChange={setMoveEast}
        />
        <Slider
          label="Move north / south"
          value={moveNorth}
          min={-2}
          max={2}
          display={moveNorth === 0 ? "No move" : `${Math.abs(moveNorth)} km ${moveNorth > 0 ? "north" : "south"}`}
          onChange={setMoveNorth}
        />
        <Button size="sm" className="w-full" disabled={full || has(custom.id)} onClick={() => addScenario(custom)}>
          <Plus size={12} /> Add &quot;{custom.label}&quot;
        </Button>
        {full && <p className="text-[11px] text-muted">Remove a scenario to add another (max {MAX_SCENARIOS}).</p>}
      </div>
    </div>
  );
}