import { useEffect, useState } from "react";
import { RuntimeLoader, useRive, type Rive } from "@rive-app/react-canvas";
import riveWasm from "@rive-app/canvas/rive.wasm?url";
import riveFallbackWasm from "@rive-app/canvas/rive_fallback.wasm?url";

// Serve the Rive engine from our own build, so the loader works offline and does not depend on a CDN
RuntimeLoader.setWasmUrl(riveWasm);
RuntimeLoader.setWasmFallbackUrl(riveFallbackWasm);

const SRC = `${import.meta.env.BASE_URL}moon.riv`;
const norm = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");

// Sets a flag in the .riv file by name: a state machine input (boolean or trigger) or a data-binding (view model) boolean.
function setFlag(rive: Rive, name: string, value: boolean) {
  for (const sm of rive.stateMachineNames) {
    const input = rive.stateMachineInputs(sm)?.find((i) => norm(i.name) === norm(name));
    if (input) {
      if (typeof input.value === "boolean") input.value = value;
      else if (value) input.fire();
      return;
    }
  }
  const vm = rive.viewModelInstance?.boolean(name);
  if (vm) vm.value = value;
}

type Props = { sunSelected: boolean; size?: number };

// The moon.riv animation (web/public/moon.riv). "Hovered" follows the mouse, "Sun selected" turns on when loading is done.
// If the file or the Rive engine cannot load, a simple CSS moon is shown instead.
export function MoonLoader({ sunSelected, size = 240 }: Props) {
  const [failed, setFailed] = useState(false);
  const { rive, RiveComponent } = useRive({
    src: SRC,
    autoplay: true,
    autoBind: true,
    onLoad: () => undefined,
    onLoadError: () => setFailed(true),
  });

  // Run the file's state machine (if it has one) so its inputs react
  useEffect(() => {
    if (!rive) return;
    const sm = rive.stateMachineNames[0];
    if (sm) rive.play(sm);
  }, [rive]);

  useEffect(() => {
    if (rive) setFlag(rive, "Sun selected", sunSelected);
  }, [rive, sunSelected]);

  if (failed) {
    return <div aria-hidden className="size-32 animate-pulse rounded-full bg-gradient-to-br from-slate-200 to-slate-500 shadow-[0_0_60px_rgba(148,163,184,0.35)]" />;
  }

  return (
    <div
      aria-hidden
      style={{ width: size, height: size }}
      onPointerEnter={() => rive && setFlag(rive, "Hovered", true)}
      onPointerLeave={() => rive && setFlag(rive, "Hovered", false)}
    >
      <RiveComponent />
    </div>
  );
}