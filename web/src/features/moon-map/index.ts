import { Globe } from "lucide-react";
import type { Block } from "@/ui";
import { MoonMap } from "./MoonMap";

export const moonMap: Block = { id: "moon-map", title: "Lunar Map", icon: Globe, span: "lg:col-span-5", Component: MoonMap };