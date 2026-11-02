import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RESERVE_FRACTION, VERDICT_LABEL, runScenario, simulate, useMission } from "@/core";
import { Badge, colors } from "@/ui";

// Slot colours: the plan first, then up to 4 scenarios in the order they were added
const LINE_COLORS = [colors.text, colors.earth, colors.sun, colors.accent, colors.fail];

export function Compare() {
  const params = useMission((s) => s.params);
  const scenarios = useMission((s) => s.scenarios);

  const results = useMemo(
    () => [
      { id: "plan", label: "Your plan", r: simulate(params) },
      ...scenarios.map((sc) => ({ id: sc.id, label: sc.label, r: runScenario(params, sc) })),
    ],
    [params, scenarios],
  );

  const data = useMemo(
    () =>
      results[0].r.soc.map((_, k) => {
        const row: Record<string, number> = { day: Number((k / 24).toFixed(2)) };
        results.forEach((x) => (row[x.id] = x.r.soc[k]));
        return row;
      }),
    [results],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={colors.line} strokeDasharray="3 3" />
            <XAxis dataKey="day" type="number" domain={[0, params.durationDays]} tickCount={params.durationDays + 1} stroke={colors.muted} fontSize={11} />
            <YAxis stroke={colors.muted} fontSize={11} domain={[0, params.batteryKwh]} unit=" kWh" width={70} />
            <Tooltip
              contentStyle={{ background: colors.surface, border: `1px solid ${colors.line}`, borderRadius: 8, fontSize: 12 }}
              labelFormatter={(d) => `Day ${Number(d).toFixed(1)}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine
              y={params.batteryKwh * RESERVE_FRACTION}
              stroke={colors.muted}
              strokeDasharray="4 4"
              label={{ value: "Minimum reserve", fill: colors.muted, fontSize: 10, position: "insideBottomLeft" }}
            />
            {results.map((x, i) => (
              <Line
                key={x.id}
                dataKey={x.id}
                name={x.label}
                stroke={LINE_COLORS[i]}
                dot={false}
                strokeWidth={i === 0 ? 2.5 : 2}
                strokeDasharray={i === 0 ? undefined : "6 3"}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table className="w-full text-left text-xs">
        <thead className="text-muted">
          <tr className="border-b border-line">
            <th className="py-2 font-medium">Scenario</th>
            <th className="py-2 font-medium">Verdict</th>
            <th className="py-2 text-right font-medium">Min battery</th>
            <th className="py-2 text-right font-medium">Earth link</th>
          </tr>
        </thead>
        <tbody>
          {results.map((x, i) => (
            <tr key={x.id} className="border-b border-line/60">
              <td className="py-2">
                <span className="flex items-center gap-2">
                  <i className="h-0.5 w-4 shrink-0 rounded" style={{ backgroundColor: LINE_COLORS[i] }} />
                  {i === 0 ? <b>{x.label}</b> : x.label}
                </span>
              </td>
              <td className="py-2">
                <Badge tone={x.r.verdict}>{VERDICT_LABEL[x.r.verdict]}</Badge>
              </td>
              <td className="num py-2 text-right">{x.r.minSoc.toFixed(0)} kWh</td>
              <td className="num py-2 text-right">{Math.round(x.r.earthOkPct * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}