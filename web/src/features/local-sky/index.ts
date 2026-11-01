import { Sun } from "lucide-react";
import type { Block } from "@/ui";
import { LocalSky } from "./LocalSky";

export const localSky: Block = { id: "local-sky", title: "Local Sky", icon: Sun, span: "lg:col-span-4", Component: LocalSky };