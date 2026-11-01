import { SlidersHorizontal } from "lucide-react";
import type { Block } from "@/ui";
import { MissionForm } from "./MissionForm";

export const missionForm: Block = { id: "mission-form", title: "Mission Parameters", icon: SlidersHorizontal, span: "lg:col-span-3", Component: MissionForm };