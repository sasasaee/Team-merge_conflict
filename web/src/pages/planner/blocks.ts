// THE LEGO BOARD.
// Every feature is one brick. To add, remove or reorder a panel, edit this list only.
import type { Block } from "@/ui";
import { moonMap } from "@/features/moon-map";
import { localSky } from "@/features/local-sky";
import { missionForm } from "@/features/mission-form";
import { metrics } from "@/features/metrics";
import { timeline } from "@/features/timeline";
import { landerView } from "@/features/lander-view";
import { compare } from "@/features/compare";
import { advice } from "@/features/advice";
import { alerts } from "@/features/alerts";
import { ask } from "@/features/ask";

export const BLOCKS: Block[] = [moonMap, localSky, missionForm, metrics, timeline, landerView, compare, advice, alerts, ask];