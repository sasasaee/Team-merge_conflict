import { FlaskConical } from "lucide-react";
import type { Block } from "@/ui";
import { WhatIf } from "./WhatIf";

export const whatIf: Block = { id: "what-if", title: "What-if scenarios", icon: FlaskConical, span: "lg:col-span-4", Component: WhatIf };