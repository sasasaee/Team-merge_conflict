import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

// The shape of one Lego brick (one dashboard panel).
export type Block = {
  id: string;
  title: string;
  icon: LucideIcon;
  span: string; // grid width on large screens, e.g. "lg:col-span-4"
  Component: ComponentType;
};