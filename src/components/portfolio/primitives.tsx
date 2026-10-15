/**
 * Shared motion primitives, backgrounds, and micro-components.
 * Kept in one file to share SVG gradient IDs safely.
 *
 * Motion rules for the whole site:
 *   1. Entrances are rare. Only a headline earns one, and it wipes rather
 *      than fades-and-slides. Body copy is simply there when you arrive.
 *   2. Continuous, scroll- and pointer-linked motion does the real work:
 *      the rail, the topology, the project plates.
 *   3. State changes (hover, focus) are mechanical - ~140ms, no easing drama.
 */
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

/* ── Section registry — shared by the nav and the rail ───────── */
export const SECTIONS = [
  { id: "top", label: "Overview" },
  { id: "domains", label: "Domains" },
  { id: "projects", label: "Projects" },
  { id: "slo", label: "SLOs" },
  { id: "stack", label: "Stack" },
  { id: "certs", label: "Certifications" },
  { id: "contact", label: "Contact" },
];

/* ── Reveal — a clip wipe, the page's one entrance gesture ─────
   No fade-up. The headline is uncovered left-to-right, like a plotter
   drawing it, then nothing else on the page moves on arrival.        */
export function Reveal({ children, as = "div", delay = 0, trigger = "view", className = "" }) {
  const reduce = useReducedMotion();
  const Tag = motion[as] ?? motion.div;
  if (reduce) return <Tag className={className}>{children}</Tag>;
  const hidden = { clipPath: "inset(0 100% 0 0)" };
  const shown = { clipPath: "inset(0 0% 0 0)" };
  const timing = { duration: 0.95, delay, ease: [0.16, 1, 0.3, 1] };
  return trigger === "mount"
    ? <Tag className={className} initial={hidden} animate={shown} transition={timing}>{children}</Tag>
    : <Tag className={className} initial={hidden} whileInView={shown} viewport={{ once: true, margin: "-10% 0px -10% 0px" }} transition={timing}>{children}</Tag>;
}

/* ── useActiveSection — drives both nav and rail ─────────────── */
export function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id) setActive(visible.target.id);
    }, { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.6, 1] });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return active;
}

/* ── usePointerParallax — normalised pointer, spring-smoothed ──
   Returns two motion values in [-1, 1]. Layers multiply them by their
   own depth so the background has real parallax instead of sitting flat. */
export function usePointerParallax() {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const x = useSpring(px, { stiffness: 60, damping: 20, mass: 0.6 });
  const y = useSpring(py, { stiffness: 60, damping: 20, mass: 0.6 });
  useEffect(() => {
    if (reduce) return;
    const onMove = (e) => {
      px.set((e.clientX / window.innerWidth) * 2 - 1);
      py.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [px, py, reduce]);
  return { x, y };
}

/* ── ScrollRail — the site's wayfinding, as a rack unit list ───
   Lives in the left gutter from xl up, where there is margin to spare:
   a hairline that fills with scroll progress and one tick per section.
   Names stay hidden until you reach for it, so it never shouts over
   the page or collides with the column.                               */
export function ScrollRail() {
  const active = useActiveSection();
  const { scrollYProgress } = useScroll();
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const pct = useTransform(scrollYProgress, (v) => String(Math.round(v * 100)).padStart(2, "0"));
  return (
    <div className="group/rail fixed left-3 top-0 z-40 hidden h-screen w-10 flex-col justify-center xl:flex">
      <div className="relative flex gap-3 pl-2">
        {/* progress track */}
        <div className="relative w-px shrink-0 bg-hairline">
          <motion.div style={{ scaleY: fill }} className="absolute inset-x-0 top-0 h-full origin-top bg-primary/70" />
        </div>
        <ul className="flex flex-col gap-3.5 py-1">
          {SECTIONS.map((s) => {
            const on = active === s.id;
            return (
              <li key={s.id} className="relative flex items-center">
                <a href={`#${s.id}`} aria-label={s.label} className="flex items-center py-1">
                  <span className={`h-px transition-state ${on ? "w-4 bg-primary" : "w-2 bg-muted-foreground/40 group-hover/rail:bg-muted-foreground/70"}`} />
                  {/* the name only surfaces when the rail is reached for */}
                  <span className={`pointer-events-none absolute left-6 whitespace-nowrap rounded-[2px] bg-background/90 px-1.5 py-0.5 label-mono opacity-0 transition-state group-hover/rail:opacity-100 ${on ? "text-primary" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-6 pl-2 label-mono text-muted-foreground/40">
        <motion.span>{pct}</motion.span>%
      </div>
    </div>
  );
}

/* ── StatusDot ───────────────────────────────────────────────── */
export function StatusDot({ healthy = true }) {
  return (<span className="relative inline-flex h-1.5 w-1.5">
    <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${healthy ? "bg-status-good status-pulse" : "bg-destructive"}`} />
  </span>);
}

/* ── SectionLabel — a status-page "component" row ────────────── */
export function SectionLabel({ slug, state = "operational" }) {
  return (<div className="flex items-center gap-3">
    <span className="inline-flex items-center gap-1.5 label-mono text-status-good">
      <StatusDot />
      {state}
    </span>
    <div className="h-px w-8 bg-hairline" />
    <span className="label-mono text-muted-foreground">component / {slug}</span>
  </div>);
}

/* ── Ext — the one glyph the site uses for "this leaves the page" ─ */
export function Ext({ className = "" }) {
  return <span aria-hidden className={`inline-block translate-y-px transition-state ${className}`}>↗</span>;
}

/* ── Ambient topology background (fixed, full viewport) ─────── */
export function AmbientTopology() {
  const { x, y } = usePointerParallax();
  const tx = useTransform(x, [-1, 1], [26, -26]);
  const ty = useTransform(y, [-1, 1], [18, -18]);
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
  return (<div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ contain: "strict" }}>
    <motion.svg
      viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice"
      style={{
        x: tx, y: ty,
        maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 90%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 90%)",
      }}
      className="absolute -inset-8 text-primary opacity-[0.12]"
    >
      <defs>
        <radialGradient id="amb-node">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      {edges.map(([a, b], i) => (<line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.6" />))}
      {nodes.map((n, i) => (<g key={i}>
        <circle cx={n.x} cy={n.y} r={(n.r ?? 2) + 4} fill="url(#amb-node)" opacity="0.3" />
        <circle cx={n.x} cy={n.y} r={n.r ?? 2} fill="currentColor" />
      </g>))}
    </motion.svg>
  </div>);
}

/* ── Section connector ───────────────────────────────────────── */
export function SectionConnector() {
  return (<div aria-hidden className="pointer-events-none relative mx-auto flex max-w-6xl items-center justify-center px-6">
    <div className="h-px w-full bg-gradient-to-r from-transparent via-hairline to-transparent" />
    <span className="absolute h-1 w-1 rotate-45 bg-primary/60" />
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   Motion kit — the React half of the utilities in styles.css.
   ═══════════════════════════════════════════════════════════════ */

/* ── useSpotlight ─────────────────────────────────────────────
   Feeds pointer position into the `spotlight` utility as CSS custom
   properties. Writing straight to style skips a React render per
   mousemove, which matters when six cards are listening at once. */
export function useSpotlight() {
  return {
    onMouseMove: (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
      e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
    },
  };
}

/* ── Marquee ──────────────────────────────────────────────────
   The track is rendered twice and shifted by exactly half its width,
   so the loop is seamless. Pauses on hover and freezes entirely when
   the visitor has asked for reduced motion.                        */
export function Marquee({ children, duration = 42, reverse = false, className = "" }) {
  const reduce = useReducedMotion();
  return (
    <div className={`marquee-host marquee-mask relative overflow-hidden ${className}`}>
      <div
        className={reduce ? "flex w-max" : "marquee-track"}
        data-reverse={reverse ? "true" : undefined}
        style={{ "--marquee-duration": `${duration}s` }}
      >
        <div className="flex shrink-0 items-center">{children}</div>
        <div aria-hidden className="flex shrink-0 items-center">{children}</div>
      </div>
    </div>
  );
}

/* ── WordReveal ───────────────────────────────────────────────
   Each word rises out of its own clipped line. Not a blanket
   fade-up: there is no opacity ramp and no vertical drift on the
   block itself, so it reads as type being set, not as a card
   floating in.                                                   */
export function WordReveal({ text, className = "", delay = 0, stagger = 0.045 }) {
  const reduce = useReducedMotion();
  if (reduce) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {text.split(" ").map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "110%" }}
            whileInView={{ y: "0%" }}
            viewport={{ once: true, margin: "-12% 0px -12% 0px" }}
            transition={{ duration: 0.75, delay: delay + i * stagger, ease: [0.16, 1, 0.3, 1] }}
          >
            {word}
            {i < text.split(" ").length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/* ── Magnetic ─────────────────────────────────────────────────
   The element leans toward the cursor while it is nearby. Used on
   one control only - the primary call to action.                 */
export function Magnetic({ children, strength = 0.35, className = "" }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 220, damping: 18, mass: 0.4 });
  const y = useSpring(my, { stiffness: 220, damping: 18, mass: 0.4 });
  if (reduce) return <span className={className}>{children}</span>;
  return (
    <motion.span
      style={{ x, y }}
      className={`inline-block ${className}`}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - (r.left + r.width / 2)) * strength);
        my.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
    >
      {children}
    </motion.span>
  );
}
