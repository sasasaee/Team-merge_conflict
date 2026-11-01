import { useMission } from "@/core";
import { Panorama } from "./Panorama";

export function LanderView() {
  const siteIdx = useMission((s) => s.params.siteIdx);
  const delayH = useMission((s) => s.params.delayH);
  const timeH = useMission((s) => s.timeH);
  return <Panorama siteIdx={siteIdx} hour={timeH + delayH} />;
}