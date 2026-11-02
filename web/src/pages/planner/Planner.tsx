import { Panel } from "@/ui";
import { BLOCKS } from "./blocks";
import { Header } from "./Header";

export function Planner() {
  return (
    <div className="mx-auto flex min-h-full max-w-[1440px] flex-col gap-4 px-4 pt-4 pb-8 lg:px-6">
      <Header />
      <main className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
        {BLOCKS.map(({ id, title, icon: Icon, span, Component }, i) => (
          <Panel key={id} title={title} icon={<Icon size={16} />} className={span} delay={i * 0.05}>
            <Component />
          </Panel>
        ))}
      </main>
    </div>
  );
}