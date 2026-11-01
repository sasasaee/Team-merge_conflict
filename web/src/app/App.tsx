import { Home } from "@/pages/home/Home";
import { Planner } from "@/pages/planner/Planner";
import { usePage } from "./usePage";

export function App() {
  return usePage() === "plan" ? <Planner /> : <Home />;
}