import { Columns3 } from "lucide-react";
import type { Block } from "@/ui";
import { Compare } from "./Compare";

export const compare: Block = { id: "compare", title: "Comparison (what-if)", icon: Columns3, span: "lg:col-span-8", Component: Compare };