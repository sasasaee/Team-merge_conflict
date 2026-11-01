import { Clock } from "lucide-react";
import type { Block } from "@/ui";
import { Timeline } from "./Timeline";

export const timeline: Block = { id: "timeline", title: "Timeline", icon: Clock, span: "lg:col-span-8", Component: Timeline };