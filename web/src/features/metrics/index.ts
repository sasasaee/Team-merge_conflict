import { Gauge } from "lucide-react";
import type { Block } from "@/ui";
import { Metrics } from "./Metrics";

export const metrics: Block = { id: "metrics", title: "Mission Metrics", icon: Gauge, span: "lg:col-span-4", Component: Metrics };