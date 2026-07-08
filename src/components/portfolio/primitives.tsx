/**
 * Shared motion primitives, backgrounds, and micro-components.
 * Kept in one file to share SVG gradient IDs safely.
 */
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
/* ── shared motion presets ───────────────────────────────────── */
export const fade = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
/* ── SectionLabel — a status-page "component" row ────────────── */
export function SectionLabel({ slug, title }) {
  return (<div className="flex items-center gap-3">
    <span className="inline-flex items-center gap-1.5 rounded-sm bg-status-good/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-status-good ring-1 ring-status-good/25">
      <StatusDot />
      operational
    </span>
    <div className="h-px w-6 bg-hairline" />
    <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
      component / {slug}
    </span>
    {title ? <span className="sr-only">{title}</span> : null}
  </div>);
}
/* ── SectionMini ─────────────────────────────────────────────── */
export function SectionMini({ label }) {
  return (<div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
    <span className="h-1 w-1 rounded-full bg-primary" />
    {label}
  </div>);
}
/* ── StatusDot ───────────────────────────────────────────────── */
export function StatusDot({ healthy = true }) {
  return (<span className="relative inline-flex h-1.5 w-1.5">
    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${healthy ? "bg-status-good" : "bg-destructive"}`} />
    <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${healthy ? "bg-status-good status-pulse" : "bg-destructive"}`} />
  </span>);
}
/* ── Ambient topology background (fixed, full viewport) ─────── */
export function AmbientTopology() {
  const nodes = [
    { x: 60, y: 120 }, { x: 60, y: 300 }, { x: 60, y: 480 },
    { x: 260, y: 80 }, { x: 260, y: 220 }, { x: 260, y: 380 }, { x: 260, y: 520 },
    { x: 500, y: 140, r: 3 }, { x: 500, y: 300, r: 3 }, { x: 500, y: 460, r: 3 },
    { x: 740, y: 100 }, { x: 740, y: 240 }, { x: 740, y: 380 }, { x: 740, y: 520 },
    { x: 940, y: 200 }, { x: 940, y: 400 },
  ];
  const edges = [
    [0, 3], [0, 4], [1, 4], [1, 5], [2, 5], [2, 6],
    [3, 7], [4, 7], [4, 8], [5, 8], [5, 9], [6, 9],
    [7, 10], [7, 11], [8, 11], [8, 12], [9, 12], [9, 13],
    [10, 14], [11, 14], [12, 15], [13, 15],
  ];
  const flowing = [1, 4, 6, 9, 12, 15, 18, 21];
  return (<div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ contain: "strict" }}>
    <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full text-primary opacity-[0.12]" style={{
      maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 90%)",
      WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 90%)",
    }}>
      <defs>
        <radialGradient id="amb-node">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      {edges.map(([a, b], i) => (<line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.6" />))}
      {flowing.map((idx, i) => {
        const [a] = edges[idx % edges.length];
        return (<circle key={`pkt-${i}`} cx={nodes[a].x} cy={nodes[a].y} r="1.5" fill="currentColor" opacity={0.15 + (i % 4) * 0.08} />);
      })}
      {nodes.map((n, i) => (<g key={i}>
        <circle cx={n.x} cy={n.y} r={(n.r ?? 2) + 4} fill="url(#amb-node)" opacity="0.3" />
        <circle cx={n.x} cy={n.y} r={n.r ?? 2} fill="currentColor" />
      </g>))}
    </svg>
  </div>);
}
/* ── FlowField - static only, no animation ───────────────────── */
export function FlowField({ className = "" }) {
  return (<svg aria-hidden viewBox="0 0 800 400" preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 -z-10 h-full w-full text-primary ${className}`}>
    <defs>
      <linearGradient id="ff-ln" x1="0" x2="1">
        <stop offset="0" stopColor="currentColor" stopOpacity="0" />
        <stop offset="0.5" stopColor="currentColor" stopOpacity="0.35" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </linearGradient>
    </defs>
    {[80, 160, 240, 320].map((y) => (<path key={y} d={`M0 ${y} C200 ${y - 28} 600 ${y + 28} 800 ${y}`} fill="none" stroke="url(#ff-ln)" strokeWidth="0.9" />))}
  </svg>);
}
/* ── Section connector ───────────────────────────────────────── */
export function SectionConnector() {
  return (<div aria-hidden className="relative flex items-center justify-center py-6 pointer-events-none">
    <div className="h-px w-full bg-hairline" />
    <div className="absolute h-1.5 w-2.5 bg-background px-px">
      <div className="h-full w-full bg-primary/50" />
    </div>
  </div>);
}
/* ── PillarHoverFx ───────────────────────────────────────────── */
export function PillarHoverFx() {
  return (<svg aria-hidden viewBox="0 0 300 200" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full text-primary opacity-0 transition-opacity duration-500 group-hover:opacity-100">
    <defs>
      <linearGradient id="ph-ln" x1="0" x2="1">
        <stop offset="0" stopColor="currentColor" stopOpacity="0" />
        <stop offset="0.5" stopColor="currentColor" stopOpacity="0.45" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path id="ph-p" d="M20 170 C 90 140 180 60 280 30" fill="none" stroke="url(#ph-ln)" strokeWidth="1" />
    <circle r="2" fill="currentColor">
      <animateMotion dur="3.2s" repeatCount="indefinite"><mpath href="#ph-p" /></animateMotion>
    </circle>
    {[[40, 160], [120, 110], [220, 60]].map(([x, y], idx) => (<g key={idx}>
      <circle cx={x} cy={y} r="2.5" fill="currentColor" opacity="0.85" />
      <circle cx={x} cy={y} r="6" fill="none" stroke="currentColor" strokeOpacity="0.5">
        <animate attributeName="r" values="2.5;10;2.5" dur="2.6s" begin={`${idx * 0.4}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0;0.6" dur="2.6s" begin={`${idx * 0.4}s`} repeatCount="indefinite" />
      </circle>
    </g>))}
  </svg>);
}
/* ── HeroBlueprint (hero midground) ─────────────────────────── */
export function HeroBlueprint() {
  const workers = [{ x: 280, y: 380 }, { x: 460, y: 420 }, { x: 640, y: 400 }, { x: 820, y: 430 }];
  const cp = { x: 550, y: 200 };
  const ingress = { x: 120, y: 300 };
  return (<svg aria-hidden viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full text-primary opacity-[0.18]" style={{
    maskImage: "linear-gradient(180deg, black 10%, black 60%, transparent 95%)",
    WebkitMaskImage: "linear-gradient(180deg, black 10%, black 60%, transparent 95%)",
  }}>
    <defs>
      <linearGradient id="hb-edge" x1="0" x2="1">
        <stop offset="0" stopColor="currentColor" stopOpacity="0" />
        <stop offset="0.5" stopColor="currentColor" stopOpacity="0.55" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </linearGradient>
    </defs>
    <rect x="200" y="140" width="900" height="380" rx="28" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="6 6" />
    <text x="220" y="132" fill="currentColor" opacity="0.45" fontSize="11" fontFamily="ui-monospace, monospace" letterSpacing="2">CLUSTER · region-1</text>
    <rect x="430" y="160" width="240" height="100" rx="14" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.8" />
    <text x="450" y="180" fill="currentColor" opacity="0.5" fontSize="10" fontFamily="ui-monospace, monospace" letterSpacing="1.5">control-plane</text>
    <circle cx={cp.x} cy={cp.y} r="6" fill="currentColor" />
    <circle cx={cp.x} cy={cp.y} r="14" fill="currentColor" opacity="0.12" />
    <circle cx={ingress.x} cy={ingress.y} r="5" fill="currentColor" />
    <text x={ingress.x - 30} y={ingress.y + 24} fill="currentColor" opacity="0.5" fontSize="9" fontFamily="ui-monospace, monospace">ingress</text>
    <path id="hb-in" d={`M${ingress.x} ${ingress.y} C 300 260 380 220 ${cp.x} ${cp.y}`} fill="none" stroke="url(#hb-edge)" strokeWidth="1" />
    {workers.map((w, i) => (<g key={i}>
      <path id={`hb-w-${i}`} d={`M${cp.x} ${cp.y} C ${cp.x} 300 ${w.x} 320 ${w.x} ${w.y}`} fill="none" stroke="url(#hb-edge)" strokeWidth="0.9" />
      <rect x={w.x - 26} y={w.y - 16} width="52" height="32" rx="6" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" />
      <text x={w.x} y={w.y + 4} textAnchor="middle" fill="currentColor" opacity="0.55" fontSize="9" fontFamily="ui-monospace, monospace">node-{i + 1}</text>
      {[0, 1, 2].map((p) => (<circle key={p} cx={w.x - 12 + p * 12} cy={w.y + 24} r="2" fill="currentColor" opacity="0.7" />))}
    </g>))}
    <circle r="2.2" fill="currentColor">
      <animateMotion dur="5s" repeatCount="indefinite"><mpath href="#hb-in" /></animateMotion>
      <animate attributeName="opacity" values="0;1;0" dur="5s" repeatCount="indefinite" />
    </circle>
    {workers.map((_, i) => (<circle key={`p-${i}`} r="2" fill="currentColor">
      <animateMotion dur={`${4 + i * 0.6}s`} begin={`${i * 0.8}s`} repeatCount="indefinite">
        <mpath href={`#hb-w-${i}`} />
      </animateMotion>
      <animate attributeName="opacity" values="0;1;0" dur={`${4 + i * 0.6}s`} begin={`${i * 0.8}s`} repeatCount="indefinite" />
    </circle>))}
    <g transform="translate(960,470)" opacity="0.45">
      {Array.from({ length: 24 }).map((_, i) => {
        const h = 4 + ((i * 37) % 22);
        return <rect key={i} x={i * 7} y={-h} width="3" height={h} fill="currentColor" opacity={0.35 + (i % 5) * 0.08} />;
      })}
      <text x="0" y="14" fill="currentColor" opacity="0.55" fontSize="8" fontFamily="ui-monospace, monospace" letterSpacing="1.5">p99 · req/s</text>
    </g>
  </svg>);
}
/* ── BootSequence — amber-phosphor journalctl boot log ───────── */
const BOOT_LINES = [
  { t: "0.000000", msg: "darshan-atkari kernel: booting portfolio.img" },
  { t: "0.041823", msg: "systemd[1]: starting cloud-init@career.service" },
  { t: "0.183921", msg: "NetworkManager[512]: link up: eth-experience" },
  { t: "0.402117", msg: "kubelet[1022]: node darshan-atkari joined cluster" },
  { t: "0.618554", msg: "argocd-server: synced desired state → production" },
  { t: "0.891230", msg: "observability: metrics + logs + traces attached" },
  { t: "1.144902", msg: "compliance-agent: 3 certifications verified" },
  { t: "1.402318", msg: "darshan-atkari.service: reached target production-ready", ok: true },
];
export function BootSequence({ onDone }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= BOOT_LINES.length - 1) return;
    const delay = 140 + ((i * 53) % 130);
    const t = setTimeout(() => setI((p) => p + 1), delay);
    return () => clearTimeout(t);
  }, [i]);
  useEffect(() => {
    if (i === BOOT_LINES.length - 1) {
      const t = setTimeout(onDone, 420);
      return () => clearTimeout(t);
    }
  }, [i, onDone]);
  return (<motion.div initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12, ease: "easeIn" } }} className="fixed inset-0 z-[100] overflow-hidden bg-background">
    {/* scanlines + vignette, CRT feel */}
    <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.5]" style={{
      backgroundImage: "repeating-linear-gradient(to bottom, rgba(255,184,77,0.05) 0px, rgba(255,184,77,0.05) 1px, transparent 1px, transparent 3px)",
    }} />
    <div aria-hidden className="pointer-events-none absolute inset-0" style={{
      background: "radial-gradient(ellipse 70% 60% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)",
    }} />
    <div className="relative flex h-full w-full items-center justify-center px-6">
      <div className="w-full max-w-lg">
        <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-primary/50">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
          console · ttyAMA0
        </div>
        <ul className="space-y-1.5">
          {BOOT_LINES.slice(0, i + 1).map((l) => (<li key={l.t} className="font-mono text-[12px] leading-relaxed sm:text-[13px]">
            <span className="text-primary/40">[{l.t}]</span>{" "}
            <span className={l.ok ? "text-status-good" : "phosphor"}>{l.msg}</span>
          </li>))}
        </ul>
        <div className="mt-2 flex items-center gap-1 font-mono text-[13px]">
          <span className="text-primary/40">❯</span>
          <span className="inline-block h-4 w-2 animate-pulse bg-primary/70" />
        </div>
      </div>
    </div>
  </motion.div>);
}
