import { createElement, lazy, Suspense } from "react";
import { Globe } from "lucide-react";
import type { Block } from "@/ui";
import { MoonMap } from "@/features/moon-map/MoonMap";

// three.js is big, so the globe downloads only when the Planner opens. The flat map shows while it loads.
const Lazy = lazy(() => import("./MoonGlobe").then((m) => ({ default: m.MoonGlobe })));
const MoonGlobeBrick = () => createElement(Suspense, { fallback: createElement(MoonMap) }, createElement(Lazy));

export const moonGlobe: Block = { id: "moon-globe", title: "3D Moon", icon: Globe, span: "lg:col-span-5", Component: MoonGlobeBrick };