import { Lightbulb } from "lucide-react";
import type { Block } from "@/ui";
import { Advice } from "./Advice";

export const advice: Block = { id: "advice", title: "Recommendations", icon: Lightbulb, span: "lg:col-span-4", Component: Advice };