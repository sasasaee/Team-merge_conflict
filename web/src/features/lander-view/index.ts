import { Mountain } from "lucide-react";
import type { Block } from "@/ui";
import { LanderView } from "./LanderView";

export { Panorama } from "./Panorama";

export const landerView: Block = { id: "lander-view", title: "Lander's-eye view (360 degrees)", icon: Mountain, span: "lg:col-span-12", Component: LanderView };