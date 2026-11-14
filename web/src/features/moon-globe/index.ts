import { Globe } from "lucide-react";
import type { Block } from "@/ui";
import { MoonView } from "./MoonView";

// Planner brick: 2D map or 3D Moon, the user chooses (remembered in this browser).
export const moonGlobe: Block = { id: "moon-globe", title: "Lunar Map", icon: Globe, span: "lg:col-span-5", Component: MoonView };