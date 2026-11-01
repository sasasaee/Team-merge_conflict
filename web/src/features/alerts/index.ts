import { Siren } from "lucide-react";
import type { Block } from "@/ui";
import { Alerts } from "./Alerts";

export const alerts: Block = { id: "alerts", title: "Mission alerts", icon: Siren, span: "lg:col-span-6", Component: Alerts };