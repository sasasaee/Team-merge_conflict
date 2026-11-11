import { SITES, VERDICT_LABEL, useMission, useSim } from "@/core";
import { motion } from "motion/react";
import { Badge } from "@/ui";
import { HeroSky } from "./HeroSky";

export function Home() {
  const siteIdx = useMission((s) => s.params.siteIdx);
  const r = useSim();

  return (
    <div>
      <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="grid gap-8 pt-10 pb-6 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:pt-16"
        >
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-text uppercase">Lunar south pole mission planner</p>
            <h1 className="mt-4 text-5xl leading-[1.02] font-bold tracking-tight md:text-7xl">Will your Moon landing survive?</h1>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-text/80">
              At the south pole the Sun never climbs high: it circles along the horizon. MoonScope checks every hour of your mission for
              sunlight, Earth contact and battery, and finds the smallest change that saves a failing plan.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="#/plan" className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent/85">
                Open the planner
              </a>
              <a href="#/rescue" className="rounded-full border border-line px-6 py-3 text-sm font-semibold hover:border-muted">
                Try Rescue Mode
              </a>
              <span className="flex items-center gap-2 text-xs text-muted">
                10-day plan at {SITES[siteIdx].name}: <Badge tone={r.verdict}>{VERDICT_LABEL[r.verdict]}</Badge>
              </span>
            </div>
          </div>
        </motion.section>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>
        <HeroSky />
      </motion.div>
    </div>
  );
}