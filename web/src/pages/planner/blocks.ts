// THE LEGO BOARD.
// Every feature is one brick. To add, remove, reorder or resize a panel, edit this list only.
// span(brick, "lg:col-span-N") sets a panel's width: 12 columns = full row on laptop.
// Write the full class name so Tailwind can find it.
import type { Block } from "@/ui";
import { moonGlobe } from "@/features/moon-globe";
import { localSky } from "@/features/local-sky";
import { missionForm } from "@/features/mission-form";
import { metrics } from "@/features/metrics";
import { timeline } from "@/features/timeline";
import { landerView } from "@/features/lander-view";
import { compare } from "@/features/compare";
import { whatIf } from "@/features/what-if";
import { advice } from "@/features/advice";
import { alerts } from "@/features/alerts";
import { ask } from "@/features/ask";

const span = (b: Block, cls: string): Block => ({ ...b, span: cls });

export const BLOCKS: Block[] = [
  // Row 1: where, sky, settings
  span(moonGlobe, "lg:col-span-5"),
  span(localSky, "lg:col-span-4"),
  span(missionForm, "lg:col-span-3"),
  // Row 2: the whole mission at a glance
  span(timeline, "lg:col-span-12"),
  // Row 3: numbers + what the lander sees
  span(metrics, "lg:col-span-4"),
  span(landerView, "lg:col-span-8"),
  // Row 4: build what-if scenarios, compare them with the plan
  span(whatIf, "lg:col-span-4"),
  span(compare, "lg:col-span-8"),
  // Row 5: verdict, events, questions
  span(advice, "lg:col-span-4"),
  span(alerts, "lg:col-span-4"),
  span(ask, "lg:col-span-4"),
];