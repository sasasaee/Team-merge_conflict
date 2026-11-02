import { MotionConfig, motion } from "motion/react";
import { Calendar } from "@/pages/calendar/Calendar";
import { Home } from "@/pages/home/Home";
import { Kit } from "@/pages/kit/Kit";
import { Planner } from "@/pages/planner/Planner";
import { Rescue } from "@/pages/rescue/Rescue";
import { Sites } from "@/pages/sites/Sites";
import { NavBar } from "@/ui";
import { usePage, type Page } from "./usePage";

function PageFor({ page }: { page: Page }) {
  if (page === "#/plan") return <Planner />;
  if (page === "#/rescue") return <Rescue />;
  if (page === "#/calendar") return <Calendar />;
  if (page === "#/sites") return <Sites />;
  if (page === "#/kit") return <Kit />;
  return <Home />;
}

export function App() {
  const page = usePage();
  // reducedMotion="user": animations switch off when the OS asks for reduced motion
  return (
    <MotionConfig reducedMotion="user">
      <NavBar current={page} />
      <motion.div key={page} className="min-h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <PageFor page={page} />
      </motion.div>
    </MotionConfig>
  );
}