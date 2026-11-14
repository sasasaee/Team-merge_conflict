import { Suspense, lazy } from "react";
import { MotionConfig, motion } from "motion/react";
import { Home } from "@/pages/home/Home";
import { NavBar } from "@/ui";
import { AboutDialog } from "./AboutDialog";
import { DataNotice } from "./DataNotice";
import { ErrorBoundary } from "./ErrorBoundary";
import { PageLoader } from "./PageLoader";
import { HowItWorks } from "./HowItWorks";
import { ThemeToggle } from "./ThemeToggle";
import { usePage, type Page } from "./usePage";

// Home loads with the app; every other page is downloaded only when it is first opened (smaller first load)
const Planner = lazy(() => import("@/pages/planner/Planner").then((m) => ({ default: m.Planner })));
const Rescue = lazy(() => import("@/pages/rescue/Rescue").then((m) => ({ default: m.Rescue })));
const Calendar = lazy(() => import("@/pages/calendar/Calendar").then((m) => ({ default: m.Calendar })));
const Sites = lazy(() => import("@/pages/sites/Sites").then((m) => ({ default: m.Sites })));
const Kit = lazy(() => import("@/pages/kit/Kit").then((m) => ({ default: m.Kit })));

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
      <NavBar current={page} extra={<AboutDialog />} end={<div className="flex items-center gap-2"><HowItWorks page={page} /><ThemeToggle /></div>} />
      <DataNotice />
      <motion.div key={page} className="min-h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        {/* key={page}: an error on one page is cleared when you open another */}
        <ErrorBoundary key={page}>
          <Suspense fallback={<PageLoader />}>
            <PageFor page={page} />
          </Suspense>
        </ErrorBoundary>
      </motion.div>
    </MotionConfig>
  );
}
