// THE LEGO BOARD.
// Every feature is one brick. To add, remove or reorder a panel, edit this list only.
import type { Block } from "@/ui";
import { moonMap } from "@/features/moon-map";
import { localSky } from "@/features/local-sky";
import { missionForm } from "@/features/mission-form";
import { metrics } from "@/features/metrics";
import { timeline } from "@/features/timeline";
import { compare } from "@/features/compare";
import { advice } from "@/features/advice";

export const BLOCKS: Block[] = [moonMap, localSky, missionForm, metrics, timeline, compare, advice];