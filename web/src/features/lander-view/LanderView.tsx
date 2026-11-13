import { siteFor, useMission } from "@/core";
import { Panorama } from "./Panorama";

export function LanderView() {
  const params = useMission((s) => s.params);
  const timeH = useMission((s) => s.timeH);
  return <Panorama siteIdx={params.siteIdx} site={siteFor(params)} hour={timeH + params.delayH} />;
}