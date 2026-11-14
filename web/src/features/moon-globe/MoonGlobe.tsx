import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { SITES, siteFor, simulate, useMission, wrapHour } from "@/core";
import { PALETTE } from "@/ui";
import { SiteChips } from "@/features/moon-map/MoonMap";

// 3D Moon for the Planner (T-41/T-42). Same job as the flat MoonMap: show the 9 sites, colour them by verdict, click to pick one.
// Textures live in web/public (see the README for their source):
//   moon-color.jpg  = colour map (equirectangular, longitude -180 at the left edge)
//   moon-height.jpg = optional height map; without it the surface is smooth
// If a file is missing the Moon is drawn plain grey, so the brick never breaks.
const COLOR_URL = import.meta.env.BASE_URL + "moon-color.jpg";
const HEIGHT_URL = import.meta.env.BASE_URL + "moon-height.jpg";

// Planetocentric lat/lon of each site, from web/public/data/<id>.json
const COORDS: Record<string, [number, number]> = {
  malapert: [-85.9671, -2.2659],
  "mons-mouton": [-84.3884, 30.8775],
  "nobile-rim-1": [-85.2283, 36.5736],
  haworth: [-86.9338, -23.0496],
  "de-gerlache-rim-2": [-88.3732, -69.1712],
  "mons-mouton-plateau": [-84.1899, 28.9515],
  "nobile-rim-2": [-84.0506, 59.2629],
  "peak-near-cabeus-b": [-85.594, -67.0533],
  "slater-plain": [-87.4356, 113.6979],
};

// lat/lon -> point on a sphere, matching how three.js wraps an equirectangular texture (lon -180 at the left edge)
function toXYZ(latDeg: number, lonDeg: number, r = 1): [number, number, number] {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const phi = THREE.MathUtils.degToRad(lonDeg + 180);
  return [-r * Math.cos(phi) * Math.cos(lat), r * Math.sin(lat), r * Math.sin(phi) * Math.cos(lat)];
}

// Direction of the Sun in world space, from the selected site's Sun azimuth/elevation at the current timeline hour.
// The Sun is so far away that this direction is the same for the whole Moon, so one directional light along it
// gives the real day/night side, and the lit half turns around the pole as the hour changes.
function sunDirection(latDeg: number, lonDeg: number, azDeg: number, elDeg: number): [number, number, number] {
  const p = new THREE.Vector3(...toXYZ(latDeg, lonDeg));
  const up = p.clone().normalize();
  const north = new THREE.Vector3(...toXYZ(latDeg + 0.01, lonDeg)).sub(p).normalize();
  const east = new THREE.Vector3(...toXYZ(latDeg, lonDeg + 0.01)).sub(p).normalize();
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(elDeg);
  const d = north.multiplyScalar(Math.cos(el) * Math.cos(az)).add(east.multiplyScalar(Math.cos(el) * Math.sin(az))).add(up.multiplyScalar(Math.sin(el)));
  return [d.x * 10, d.y * 10, d.z * 10];
}

// "Fully lit" mode: a light that sits on the camera, so whatever side you turn to is lit (like a torch)
function CameraLight() {
  const light = useRef<THREE.DirectionalLight>(null);
  const { camera } = useThree();
  useFrame(() => {
    if (light.current) light.current.position.copy(camera.position);
  });
  return <directionalLight ref={light} intensity={2.2} />;
}

function useTexture(url: string, srgb: boolean) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    new THREE.TextureLoader().load(
      url,
      (t) => {
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        if (alive) setTex(t);
      },
      undefined,
      () => alive && setTex(null),
    );
    return () => {
      alive = false;
    };
  }, [url, srgb]);
  return tex;
}

function Moon() {
  const map = useTexture(COLOR_URL, true);
  const bump = useTexture(HEIGHT_URL, false);
  return (
    <mesh>
      <sphereGeometry args={[1, 192, 192]} />
      <meshStandardMaterial
        key={`${!!map}-${!!bump}`}
        color={map ? "#ffffff" : "#8b8f98"}
        map={map}
        bumpMap={bump}
        bumpScale={6}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

function Marker({ idx, name, color, active, onPick }: { idx: number; name: string; color: string; active: boolean; onPick: (i: number) => void }) {
  const [hover, setHover] = useState(false);
  const id = SITES[idx].id;
  const pos = toXYZ(COORDS[id][0], COORDS[id][1], 1.002);
  return (
    <group position={pos}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onPick(idx);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[active ? 0.012 : hover ? 0.011 : 0.008, 16, 16]} />
        <meshBasicMaterial color={active ? PALETTE.accentSoft.dark : color} />
      </mesh>
      {(active || hover) && (
        <Html center distanceFactor={1} style={{ pointerEvents: "none" }}>
          <div className="-translate-y-5 whitespace-nowrap rounded-full border border-accent-soft bg-bg/85 px-2 py-0.5 text-[11px] text-text">{name}</div>
        </Html>
      )}
    </group>
  );
}

export function MoonGlobe() {
  const params = useMission((s) => s.params);
  const setParam = useMission((s) => s.setParam);
  const verdicts = useMemo(() => SITES.map((_, i) => simulate({ ...params, siteIdx: i }).verdict), [params]);
  const [still] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const timeH = useMission((s) => s.timeH);
  const site = siteFor(params);
  const h = wrapHour(timeH + params.delayH);
  const [lat, lon] = COORDS[SITES[params.siteIdx].id];
  const sunPos = sunDirection(lat, lon, site.sunAz[h], site.sunEl[h]);
  const [light, setLight] = useState<"sun" | "full">("sun");

  return (
    <div className="flex h-full flex-col gap-3">
      <div data-theme="dark" className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#03050a]">
        {/* Camera looks up at the south pole from below, tilted a little so the rims and craters show */}
        <Canvas camera={{ position: [0, -2.3, 1.1], fov: 35, near: 0.01, far: 20 }} dpr={[1, 2]}>
          {light === "sun" ? (
            <>
              {/* Faint fill so the night side is not pure black */}
              <ambientLight intensity={0.08} />
              {/* The real Sun direction for the selected site and timeline hour: press play on the timeline to watch day and night move */}
              <directionalLight position={sunPos} intensity={2.8} />
            </>
          ) : (
            <>
              <ambientLight intensity={0.35} />
              <CameraLight />
            </>
          )}
          <Moon />
          {SITES.map((s, i) => (
            <Marker key={s.id} idx={i} name={s.name} color={PALETTE[verdicts[i]].dark} active={i === params.siteIdx} onPick={(k) => setParam("siteIdx", k)} />
          ))}
          <OrbitControls enablePan={false} minDistance={0.4} maxDistance={4} autoRotate={!still} autoRotateSpeed={0.25} target={[0, -0.85, 0]} />
        </Canvas>
        <div role="group" aria-label="Lighting" className="absolute top-2 right-2 flex gap-1">
          {(["sun", "full"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={light === m}
              onClick={() => setLight(m)}
              title={m === "sun" ? "Light the Moon from the real Sun position at this hour" : "Light whatever side you are looking at"}
              className="rounded-full border border-line bg-bg/70 px-2.5 py-0.5 text-[11px] font-semibold text-muted"
            >
              {m === "sun" ? "Real sunlight" : "Fully lit"}
            </button>
          ))}
        </div>
        <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted">Drag to turn, scroll to zoom</p>
        {light === "sun" && <p className="num pointer-events-none absolute right-3 bottom-2 text-[11px] text-sun">
          Sun {site.sunEl[h].toFixed(1)}{"\u00B0"} up, from {Math.round(site.sunAz[h])}{"\u00B0"}
        </p>}
      </div>
      <SiteChips />
      <p className="text-center text-[11px] text-muted">Real sunlight: the dark side stays dark until the Sun moves (press play on the Timeline). Fully lit: see every side.</p>
    </div>
  );
}