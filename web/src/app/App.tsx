import { Calendar } from "@/pages/calendar/Calendar";
import { Home } from "@/pages/home/Home";
import { Planner } from "@/pages/planner/Planner";
import { Rescue } from "@/pages/rescue/Rescue";
import { Sites } from "@/pages/sites/Sites";
import { usePage } from "./usePage";

export function App() {
  const page = usePage();
  if (page === "#/plan") return <Planner />;
  if (page === "#/rescue") return <Rescue />;
  if (page === "#/calendar") return <Calendar />;
  if (page === "#/sites") return <Sites />;
  return <Home />;
}