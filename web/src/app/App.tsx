import { Calendar } from "@/pages/calendar/Calendar";
import { Home } from "@/pages/home/Home";
import { Kit } from "@/pages/kit/Kit";
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
  if (page === "#/kit") return <Kit />;
  return <Home />;
}