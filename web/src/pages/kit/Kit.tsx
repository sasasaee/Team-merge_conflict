import { useState, type ReactNode } from "react";
import { Gauge } from "lucide-react";
import { Badge, Button, NavBar, Panel, Select, Slider, StatTile, buttonClass, colors, type Tone } from "@/ui";

// UI kit: every shared piece on one page, so the team can copy the right one.
// Open it at #/kit. Not linked in the top menu on purpose.

const TOKENS: { name: keyof typeof colors; cls: string; use: string }[] = [
  { name: "bg", cls: "bg", use: "Page background" },
  { name: "surface", cls: "surface", use: "Panels and cards" },
  { name: "surface2", cls: "surface-2", use: "Inputs, tiles, hover" },
  { name: "line", cls: "line", use: "Borders and dividers" },
  { name: "text", cls: "text", use: "Main text" },
  { name: "muted", cls: "muted", use: "Labels and hints" },
  { name: "accent", cls: "accent", use: "Buttons, focus, active" },
  { name: "sun", cls: "sun", use: "Sunlight" },
  { name: "earth", cls: "earth", use: "Earth link" },
  { name: "moon", cls: "moon", use: "Moon surface" },
  { name: "ok", cls: "ok", use: "Feasible" },
  { name: "warn", cls: "warn", use: "At risk, weak link" },
  { name: "fail", cls: "fail", use: "Infeasible, signal lost" },
];

const TYPE = [
  ["Display", "text-5xl md:text-7xl font-extrabold tracking-tight", "Page hero"],
  ["H1", "text-4xl md:text-5xl font-extrabold tracking-tight", "Page title"],
  ["H2", "text-3xl font-bold", "Section title"],
  ["H3", "text-lg font-semibold", "Card title"],
  ["Body", "text-base leading-relaxed", "Paragraphs"],
  ["Small", "text-sm", "Panel text"],
  ["Label", "text-xs text-muted", "Form labels"],
  ["Number", "num text-3xl font-bold", "Values (JetBrains Mono)"],
] as const;

const TONES: Tone[] = ["ok", "warn", "fail", "accent", "sun", "earth", "muted"];

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-10">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{note}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return <code className="num rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-text/80">{children}</code>;
}

export function Kit() {
  const [slider, setSlider] = useState(120);
  const [select, setSelect] = useState("a");

  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-16 lg:px-8">
      <NavBar current="#/kit" />

      <header className="py-8">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">UI kit</h1>
        <p className="mt-3 max-w-[64ch] text-text/80">
          Every shared colour, text style and component in MoonScope. Import components from <Code>@/ui</Code> and use the Tailwind class
          names shown here instead of raw hex values.
        </p>
      </header>

      <Section title="Colours" note="Defined once in app/styles.css (@theme). ui/theme.ts mirrors them for SVG and charts.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {TOKENS.map((t) => (
            <div key={t.name} className="overflow-hidden rounded-xl border border-line">
              <div className="h-16" style={{ backgroundColor: colors[t.name] }} />
              <div className="space-y-1 bg-surface p-3 text-sm">
                <div className="font-semibold">{t.cls}</div>
                <div className="num text-xs text-muted">{colors[t.name]}</div>
                <div className="text-xs text-text/70">{t.use}</div>
                <Code>{`bg-${t.cls} text-${t.cls}`}</Code>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography" note="Inter for text, JetBrains Mono for numbers (add the num class).">
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {TYPE.map(([name, cls, use]) => (
            <div key={name} className="grid items-baseline gap-2 p-4 md:grid-cols-[120px_1fr_260px]">
              <span className="text-xs text-muted">{name}</span>
              <span className={cls}>{name === "Number" ? "48.2 kWh" : "Will your Moon landing survive?"}</span>
              <span className="flex flex-col gap-1 text-xs text-muted">
                {use}
                <Code>{cls}</Code>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons" note="<Button variant size> for actions. buttonClass(variant, size) for links that look like buttons.">
        <div className="space-y-4">
          {(["primary", "secondary", "ghost"] as const).map((v) => (
            <div key={v} className="flex flex-wrap items-center gap-3">
              <span className="w-24 text-xs text-muted">{v}</span>
              <Button variant={v} size="sm">Small</Button>
              <Button variant={v}>Medium</Button>
              <Button variant={v} size="lg">Large</Button>
              <Button variant={v} disabled>Disabled</Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-24 text-xs text-muted">link</span>
            <a href="#/plan" className={buttonClass("primary", "lg")}>Open the planner</a>
            <Code>{'<a className={buttonClass("primary", "lg")}>'}</Code>
          </div>
        </div>
      </Section>

      <Section title="Badges" note="<Badge tone> for verdicts and short status labels.">
        <div className="flex flex-wrap gap-3">
          {TONES.map((t) => (
            <Badge key={t} tone={t}>{t.toUpperCase()}</Badge>
          ))}
        </div>
      </Section>

      <Section title="Stat tiles" note="<StatTile label value unit tone hint> for one number with context.">
        <div className="grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile label="Lowest battery" value="48" unit="kWh" tone="ok" hint="Reserve 30 kWh" />
          <StatTile label="Earth contact" value="87" unit="%" tone="earth" />
          <StatTile label="Verdict" value="AT RISK" tone="warn" hint="Battery close to reserve" />
        </div>
      </Section>

      <Section title="Form controls" note="<Slider> and <Select> always show their label and current value.">
        <div className="grid max-w-2xl gap-6 md:grid-cols-2">
          <Slider label="Battery capacity" value={slider} min={40} max={200} step={10} display={`${slider} kWh`} onChange={setSlider} />
          <Select
            label="Landing site"
            value={select}
            options={[
              { value: "a", label: "Malapert Massif" },
              { value: "b", label: "Mons Mouton" },
            ]}
            onChange={setSelect}
          />
        </div>
      </Section>

      <Section title="Panel" note="<Panel title icon> wraps every planner brick. Width comes from blocks.ts.">
        <div className="grid gap-4 lg:grid-cols-12">
          <Panel title="Example brick" icon={<Gauge size={16} />} className="lg:col-span-6">
            <p className="text-sm text-text/80">Brick content goes here. Panels scroll inside if the content is tall.</p>
          </Panel>
        </div>
      </Section>

      <Section title="Shape and spacing" note="Keep to these so every page feels the same.">
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["rounded-full", "Buttons, badges, pills"],
            ["rounded-2xl", "Panels and cards"],
            ["rounded-xl", "Tiles inside panels"],
            ["rounded-lg", "Inputs"],
          ].map(([r, use]) => (
            <div key={r} className="flex items-center gap-3">
              <div className={`size-12 shrink-0 border border-accent bg-accent/15 ${r}`} />
              <div>
                <Code>{r}</Code>
                <div className="mt-1 text-xs text-muted">{use}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-text/80">
          Spacing: <Code>gap-4</Code> between panels, <Code>p-4</Code> inside panels, <Code>py-10</Code> to <Code>py-20</Code> between page
          sections.
        </p>
      </Section>
    </div>
  );
}