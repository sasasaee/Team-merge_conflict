import { MessageSquareText } from "lucide-react";
import type { Block } from "@/ui";
import { Ask } from "./Ask";

export const ask: Block = { id: "ask", title: "Ask MoonScope", icon: MessageSquareText, span: "lg:col-span-6", Component: Ask };