import { Panel } from "@/ui";
import { BLOCKS } from "./blocks";
import { Header } from "./Header";

export function App() {
  return (
    <div className="mx-auto flex min-h-full max-w-[1440px] flex-col gap-4 p-4 lg:p-6">
      <Header />
      <main className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
        {BLOCKS.map(({ id, title, icon: Icon, span, Component }) => (
          <Panel key={id} title={title} icon={<Icon size={16} />} className={span}>
            <Component />
          </Panel>
        ))}
      </main>
    </div>
  );
}