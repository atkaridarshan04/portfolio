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
/* ── SectionLabel ────────────────────────────────────────────── */
export function SectionLabel({ index, title }) {
    return (<div className="flex items-baseline gap-4">
      <span className="font-mono text-xs text-primary">{index}</span>
      <div className="h-px w-10 bg-primary/40"/>
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{title}</span>
    </div>);
}
/* ── SectionMini ─────────────────────────────────────────────── */
export function SectionMini({ label }) {
    return (<div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
      <span className="h-1 w-1 rounded-full bg-primary"/>
      {label}
    </div>);
}
/* ── StatusDot ───────────────────────────────────────────────── */
export function StatusDot({ healthy = true }) {
    return (<span className="relative inline-flex h-2 w-2">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${healthy ? "bg-primary" : "bg-destructive"}`}/>
      <span className={`relative inline-flex h-2 w-2 rounded-full ${healthy ? "bg-primary status-pulse" : "bg-destructive"}`}/>
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
            <stop offset="0" stopColor="currentColor" stopOpacity="0.9"/>
            <stop offset="1" stopColor="currentColor" stopOpacity="0"/>
          </radialGradient>
        </defs>
        {edges.map(([a, b], i) => (<line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.6"/>))}
        {flowing.map((idx, i) => {
            const [a, b] = edges[idx % edges.length];
            return (<circle key={`pkt-${i}`} cx={nodes[a].x} cy={nodes[a].y} r="1.5" fill="currentColor" opacity={0.15 + (i % 4) * 0.08}/>);
        })}
        {nodes.map((n, i) => (<g key={i}>
            <circle cx={n.x} cy={n.y} r={(n.r ?? 2) + 4} fill="url(#amb-node)" opacity="0.3"/>
            <circle cx={n.x} cy={n.y} r={n.r ?? 2} fill="currentColor"/>
          </g>))}
      </svg>
    </div>);
}
/* ── FlowField — static only, no animation ───────────────────── */
export function FlowField({ className = "" }) {
    return (<svg aria-hidden viewBox="0 0 800 400" preserveAspectRatio="none" className={`pointer-events-none absolute inset-0 -z-10 h-full w-full text-primary ${className}`}>
      <defs>
        <linearGradient id="ff-ln" x1="0" x2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0"/>
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0.35"/>
          <stop offset="1" stopColor="currentColor" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[80, 160, 240, 320].map((y) => (<path key={y} d={`M0 ${y} C200 ${y - 28} 600 ${y + 28} 800 ${y}`} fill="none" stroke="url(#ff-ln)" strokeWidth="0.9"/>))}
    </svg>);
}
/* ── Section connector ───────────────────────────────────────── */
export function SectionConnector() {
    return (<div aria-hidden className="relative flex items-center justify-center py-6 pointer-events-none">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent"/>
      <div className="absolute h-1.5 w-1.5 rotate-45 bg-primary/40 ring-1 ring-primary/25"/>
    </div>);
}
/* ── PillarHoverFx ───────────────────────────────────────────── */
export function PillarHoverFx() {
    return (<svg aria-hidden viewBox="0 0 300 200" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full text-primary opacity-0 transition-opacity duration-500 group-hover:opacity-100">
      <defs>
        <linearGradient id="ph-ln" x1="0" x2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0"/>
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0.45"/>
          <stop offset="1" stopColor="currentColor" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path id="ph-p" d="M20 170 C 90 140 180 60 280 30" fill="none" stroke="url(#ph-ln)" strokeWidth="1"/>
      <circle r="2" fill="currentColor">
        <animateMotion dur="3.2s" repeatCount="indefinite"><mpath href="#ph-p"/></animateMotion>
      </circle>
      {[[40, 160], [120, 110], [220, 60]].map(([x, y], idx) => (<g key={idx}>
          <circle cx={x} cy={y} r="2.5" fill="currentColor" opacity="0.85"/>
          <circle cx={x} cy={y} r="6" fill="none" stroke="currentColor" strokeOpacity="0.5">
            <animate attributeName="r" values="2.5;10;2.5" dur="2.6s" begin={`${idx * 0.4}s`} repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.6;0;0.6" dur="2.6s" begin={`${idx * 0.4}s`} repeatCount="indefinite"/>
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
          <stop offset="0" stopColor="currentColor" stopOpacity="0"/>
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0.55"/>
          <stop offset="1" stopColor="currentColor" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <rect x="200" y="140" width="900" height="380" rx="28" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="6 6"/>
      <text x="220" y="132" fill="currentColor" opacity="0.45" fontSize="11" fontFamily="ui-monospace, monospace" letterSpacing="2">CLUSTER · region-1</text>
      <rect x="430" y="160" width="240" height="100" rx="14" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.8"/>
      <text x="450" y="180" fill="currentColor" opacity="0.5" fontSize="10" fontFamily="ui-monospace, monospace" letterSpacing="1.5">control-plane</text>
      <circle cx={cp.x} cy={cp.y} r="6" fill="currentColor"/>
      <circle cx={cp.x} cy={cp.y} r="14" fill="currentColor" opacity="0.12"/>
      <circle cx={ingress.x} cy={ingress.y} r="5" fill="currentColor"/>
      <text x={ingress.x - 30} y={ingress.y + 24} fill="currentColor" opacity="0.5" fontSize="9" fontFamily="ui-monospace, monospace">ingress</text>
      <path id="hb-in" d={`M${ingress.x} ${ingress.y} C 300 260 380 220 ${cp.x} ${cp.y}`} fill="none" stroke="url(#hb-edge)" strokeWidth="1"/>
      {workers.map((w, i) => (<g key={i}>
          <path id={`hb-w-${i}`} d={`M${cp.x} ${cp.y} C ${cp.x} 300 ${w.x} 320 ${w.x} ${w.y}`} fill="none" stroke="url(#hb-edge)" strokeWidth="0.9"/>
          <rect x={w.x - 26} y={w.y - 16} width="52" height="32" rx="6" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8"/>
          <text x={w.x} y={w.y + 4} textAnchor="middle" fill="currentColor" opacity="0.55" fontSize="9" fontFamily="ui-monospace, monospace">node-{i + 1}</text>
          {[0, 1, 2].map((p) => (<circle key={p} cx={w.x - 12 + p * 12} cy={w.y + 24} r="2" fill="currentColor" opacity="0.7"/>))}
        </g>))}
      <circle r="2.2" fill="currentColor">
        <animateMotion dur="5s" repeatCount="indefinite"><mpath href="#hb-in"/></animateMotion>
        <animate attributeName="opacity" values="0;1;0" dur="5s" repeatCount="indefinite"/>
      </circle>
      {workers.map((_, i) => (<circle key={`p-${i}`} r="2" fill="currentColor">
          <animateMotion dur={`${4 + i * 0.6}s`} begin={`${i * 0.8}s`} repeatCount="indefinite">
            <mpath href={`#hb-w-${i}`}/>
          </animateMotion>
          <animate attributeName="opacity" values="0;1;0" dur={`${4 + i * 0.6}s`} begin={`${i * 0.8}s`} repeatCount="indefinite"/>
        </circle>))}
      <g transform="translate(960,470)" opacity="0.45">
        {Array.from({ length: 24 }).map((_, i) => {
            const h = 4 + ((i * 37) % 22);
            return <rect key={i} x={i * 7} y={-h} width="3" height={h} fill="currentColor" opacity={0.35 + (i % 5) * 0.08}/>;
        })}
        <text x="0" y="14" fill="currentColor" opacity="0.55" fontSize="8" fontFamily="ui-monospace, monospace" letterSpacing="1.5">p99 · req/s</text>
      </g>
    </svg>);
}
/* ── BootSequence ────────────────────────────────────────────── */
export function BootSequence({ onDone }) {
    const steps = [
        "Initializing infrastructure",
        "Loading configuration",
        "Starting control plane",
        "Scheduling workloads",
        "Provisioning runtime",
        "Deploying services",
        "Collecting telemetry",
        "Cluster ready",
    ];
    const [i, setI] = useState(0);
    useEffect(() => {
        const id = setInterval(() => {
            setI((p) => {
                if (p >= steps.length - 1) {
                    clearInterval(id);
                    return p;
                }
                return p + 1;
            });
        }, 260);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if (i === steps.length - 1) {
            const t = setTimeout(onDone, 700);
            return () => clearTimeout(t);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [i]);
    const progress = ((i + 1) / steps.length) * 100;
    return (<motion.div initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.5 } }} className="fixed inset-0 z-[100] grid place-items-center bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[140px]"/>
        {/* mini topology during boot */}
        <svg viewBox="0 0 600 400" className="absolute inset-0 h-full w-full text-primary opacity-[0.12]" preserveAspectRatio="xMidYMid slice">
          {[[100, 200], [250, 120], [250, 280], [400, 200], [550, 150], [550, 250]].map(([x, y], idx) => (<g key={idx}>
              <circle cx={x} cy={y} r="3" fill="currentColor" opacity={0.4 + idx * 0.08}/>
              <animate attributeName="opacity" values="0.4;0.9;0.4" dur={`${2 + idx * 0.3}s`} repeatCount="indefinite"/>
            </g>))}
          {[[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [3, 5]].map(([a, b], idx) => {
            const pts = [[100, 200], [250, 120], [250, 280], [400, 200], [550, 150], [550, 250]];
            return <line key={idx} x1={pts[a][0]} y1={pts[a][1]} x2={pts[b][0]} y2={pts[b][1]} stroke="currentColor" strokeOpacity="0.2" strokeWidth="0.8"/>;
        })}
        </svg>
      </div>
      <div className="relative w-full max-w-sm px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary font-display text-sm font-bold">DA</span>
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            cluster · bootstrap
          </div>
        </div>
        <div className="mt-8 h-px w-full overflow-hidden rounded-full bg-hairline">
          <motion.div className="h-full bg-primary shadow-[0_0_16px_oklch(0.7_0.18_240/_70%)]" animate={{ width: `${progress}%` }} transition={{ duration: 0.35, ease: "easeOut" }}/>
        </div>
        <ul className="mt-6 space-y-1.5 font-mono text-[12px] leading-relaxed">
          {steps.slice(0, i + 1).map((s, idx) => {
            const done = idx < i || i === steps.length - 1;
            return (<motion.li key={s} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2.5">
                <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300 ${done ? "bg-primary shadow-[0_0_6px_oklch(0.7_0.18_240/_80%)]" : "bg-primary/35"}`}/>
                <span className={done ? "text-foreground/85" : "text-muted-foreground"}>
                  {s}
                  {!done && idx === i && <span className="ml-1 animate-pulse text-primary">…</span>}
                  {done && idx === steps.length - 1 && <span className="ml-2 text-primary">✓</span>}
                </span>
              </motion.li>);
        })}
        </ul>
      </div>
    </motion.div>);
}
