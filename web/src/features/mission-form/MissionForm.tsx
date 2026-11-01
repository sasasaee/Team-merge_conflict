import { MAX_DELAY_H, SITES, landingLabel, useMission } from "@/core";
import { Select, Slider } from "@/ui";

const delayText = (h: number) => (h === 0 ? `On time (${landingLabel(0)})` : `${landingLabel(h)}, +${Math.floor(h / 24)} d ${h % 24} h`);

export function MissionForm() {
  const p = useMission((s) => s.params);
  const set = useMission((s) => s.setParam);

  return (
    <div className="space-y-4">
      <Select
        label="Landing site"
        value={String(p.siteIdx)}
        options={SITES.map((s, i) => ({ value: String(i), label: s.name }))}
        onChange={(v) => set("siteIdx", Number(v))}
      />
      <Slider label="Landing date" value={p.delayH} min={0} max={MAX_DELAY_H} step={6} display={delayText(p.delayH)} onChange={(v) => set("delayH", v)} />
      <Slider label="Battery capacity" value={p.batteryKwh} min={40} max={200} step={10} display={`${p.batteryKwh} kWh`} onChange={(v) => set("batteryKwh", v)} />
      <Slider label="Power use" value={p.loadKw} min={0.5} max={4} step={0.1} display={`${p.loadKw.toFixed(1)} kW`} onChange={(v) => set("loadKw", v)} />
      <Slider label="Solar panel efficiency" value={p.panelEff} min={0.15} max={0.35} step={0.01} display={`${Math.round(p.panelEff * 100)} %`} onChange={(v) => set("panelEff", v)} />
      <Slider label="Earth contact needed" value={p.commHoursReq} min={0} max={12} display={`${p.commHoursReq} h/day`} onChange={(v) => set("commHoursReq", v)} />
      <Slider label="Mission length" value={p.durationDays} min={3} max={14} display={`${p.durationDays} days`} onChange={(v) => set("durationDays", v)} />
    </div>
  );
}