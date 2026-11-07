import { useMemo } from "react";
import { DNA_HOURS, SITES, getSite, siteDna, useMission, usingRealData } from "@/core";
import { colors } from "@/ui";

const R_OUT = 70;
const R_IN = 54;

// Ring fingerprint: outer ring = sunlight over 28 days, inner ring = Earth contact
function DnaRing({ siteIdx }: { siteIdx: number }) {
  const full = getSite(siteIdx);
  const HOURS = DNA_HOURS; // ring = first 28 days after landing
  const s = { lit: full.lit.slice(0, HOURS), earth: full.earth.slice(0, HOURS) };
  const seg = (i: number, r: number, width: number, color: string) => {
    const a0 = (i / HOURS) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1.2) / HOURS) * Math.PI * 2 - Math.PI / 2;
    return (
      <path
        key={`${r}-${i}`}
        d={`M ${80 + r * Math.cos(a0)} ${80 + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${80 + r * Math.cos(a1)} ${80 + r * Math.sin(a1)}`}
        stroke={color}
        strokeWidth={width}
        fill="none"
      />
    );
  };
  const link = { ok: colors.earth, weak: colors.warn, lost: colors.fail } as const;
  return (
    <svg viewBox="0 0 160 160" className="mx-auto size-44" role="img" aria-label={`${SITES[siteIdx].name} light and contact fingerprint`}>
      {s.lit.map((on, i) => seg(i, R_OUT, 12, on ? colors.sun : colors.surface2))}
      {s.earth.map((e, i) => seg(i, R_IN, 6, link[e]))}
      <circle cx={80} cy={80} r={38} fill={colors.surface} />
    </svg>
  );
}

export function Sites() {
  const setParam = useMission((s) => s.setParam);
  const cards = useMemo(() => SITES.map((site, i) => ({ site, i, dna: siteDna(i) })), []);
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div className="mx-auto max-w-[1300px] px-5 pb-12 lg:px-8">
      <section className="py-8">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Shadow DNA</h1>
        <p className="mt-3 max-w-[64ch] text-text/80">
          Every landing site has its own pattern of light and shadow. Each ring shows one lunar month: the outer ring is sunlight, the inner
          ring is contact with Earth (blue good, orange weak, red lost).
        </p>

        {!usingRealData() && <p className="mt-4 text-sm text-muted">Showing sample data (real site files not found).</p>}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ site, i, dna }) => (
            <article key={site.id} className="rounded-3xl border border-line bg-gradient-to-b from-surface to-bg p-5">
              <DnaRing siteIdx={i} />
              <h2 className="mt-3 text-center text-xl font-bold">{site.name}</h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted">Sunlit</dt>
                <dd className="num text-right text-sun">{pct(dna.litPct)}</dd>
                <dt className="text-muted">Earth contact</dt>
                <dd className="num text-right text-earth">{pct(dna.commPct)}</dd>
                <dt className="text-muted">Longest day</dt>
                <dd className="num text-right">{dna.longestDayH} h</dd>
                <dt className="text-muted">Longest night</dt>
                <dd className="num text-right">{dna.longestNightH} h</dd>
                <dt className="text-muted">Longest signal loss</dt>
                <dd className="num text-right">{dna.longestBlackoutH} h</dd>
                <dt className="text-muted">Light changes</dt>
                <dd className="num text-right">{dna.switches}</dd>
              </dl>
              <button
                type="button"
                onClick={() => {
                  setParam("siteIdx", i);
                  window.location.hash = "#/plan";
                }}
                className="mt-5 w-full rounded-full bg-accent py-2 text-sm font-semibold text-white hover:bg-accent/85"
              >
                Plan a mission here
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}