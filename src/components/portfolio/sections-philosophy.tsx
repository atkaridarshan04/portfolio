import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { Reveal, SectionLabel, WordReveal, useSpotlight } from "./primitives";

/* ── Service Level Objectives ─────────────────────────────────
   Gauges, not a bullet list: each commitment carries a target and a
   bar that fills when you reach it. The prose underneath is one line
   now — six paragraphs stacked in a grid is a wall, not a statement. */
const OBJECTIVES = [
  { k: "Automate", target: "manual toil", value: "0%", fill: 1.0, t: "Every manual step is a future incident." },
  { k: "Reliable", target: "error budget", value: "99.9%", fill: 0.95, t: "Designed for failure, not around it." },
  { k: "Observable", target: "blind spots", value: "0", fill: 1.0, t: "You cannot operate what you cannot see." },
  { k: "Cloud Native", target: "vendor lock-in", value: "none", fill: 0.9, t: "Declarative, loosely coupled, elastic." },
  { k: "Resilient", target: "blast radius", value: "contained", fill: 0.85, t: "Self-healing workloads, bounded failure." },
  { k: "Operational", target: "recovery time", value: "<30min", fill: 0.8, t: "Runbooks, on-call hygiene, post-mortems." },
];

function Objective({ o, i }) {
  const reduce = useReducedMotion();
  const spot = useSpotlight();
  const [on, setOn] = useState(false);
  return (
    <motion.div
      {...spot}
      variants={{}}
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => setOn(false)}
      className={`spotlight group relative overflow-hidden rounded-xl panel p-5 transition-state sm:p-6 ${on ? "-translate-y-0.5 bg-surface-elevated" : "bg-surface/60"}`}
    >
      {/* top edge lights along its length */}
      <span className={`pointer-events-none absolute inset-x-0 top-0 h-px origin-left bg-gradient-to-r from-primary via-primary/60 to-transparent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${on ? "scale-x-100" : "scale-x-0"}`} />

      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] text-primary/70">{String(i + 1).padStart(2, "0")}</span>
        <span className="label-mono text-muted-foreground/60">{o.target}</span>
      </div>

      <h3 className="mt-4 heading-sans text-lg leading-tight">{o.k}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{o.t}</p>

      {/* the gauge */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="label-mono text-muted-foreground/50">measured</span>
          <span className="font-mono text-[13px] text-primary">{o.value}</span>
        </div>
        <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-hairline">
          <motion.div
            className="h-full origin-left rounded-full bg-gradient-to-r from-primary/50 to-primary"
            variants={reduce ? {} : { hidden: { scaleX: 0 }, shown: { scaleX: o.fill } }}
            style={{ transformOrigin: "left" }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export function Philosophy() {
  return (<section id="slo" className="section-pad relative overflow-hidden">
    {/* section texture: horizontal rack rails */}
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{
      backgroundImage: "linear-gradient(to bottom, rgba(245,166,35,0.045) 1px, transparent 1px)",
      backgroundSize: "100% 88px",
      maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 85%)",
      WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 85%)",
    }} />

    <div className="mx-auto max-w-6xl px-6">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <SectionLabel slug="slo" />
          <Reveal as="h2" className="mt-7 font-display display-section text-balance">
            Six commitments.<br />
            <span className="text-primary">Measured, not promised.</span>
          </Reveal>
        </div>
        <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground md:col-span-5">
          <WordReveal text="Software is no longer shipped, it is operated. These are the targets I hold every system to — commitments, not aspirations." />
        </p>
      </div>

      <motion.div
        initial="hidden"
        whileInView="shown"
        viewport={{ once: true, margin: "-12% 0px -12% 0px" }}
        variants={{ shown: { transition: { staggerChildren: 0.07 } } }}
        className="mt-14 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {OBJECTIVES.map((o, i) => <Objective key={o.k} o={o} i={i} />)}
      </motion.div>
    </div>
  </section>);
}

/* ── Engineering Domains ──────────────────────────────────────
   Numbered plates with depth. No icon on each one - the numeral and
   the lit edge carry the structure.                                */
const DOMAINS = [
  {
    name: "Cloud & Infrastructure",
    desc: "Multi-cloud architecture, Terraform modules, GitOps workflows and drift-free environments — landing zones through to production IaC.",
    tags: ["Cloud Architecture", "IaC", "Terraform", "GitOps"],
  },
  {
    name: "Containers & Kubernetes",
    desc: "Kubernetes, Helm, service mesh and progressive delivery with Argo Rollouts — workloads that self-heal and scale.",
    tags: ["Kubernetes", "Helm", "ArgoCD", "Service Mesh"],
  },
  {
    name: "DevSecOps & Observability",
    desc: "Shift-left security with SAST, SCA, secrets scanning and policy as code — unified with metrics, logs and traces via OpenTelemetry.",
    tags: ["GitHub Actions", "Trivy", "OTel", "Grafana"],
  },
  {
    name: "MLOps & Reliability",
    desc: "Reproducible ML pipelines, model registries and container-based serving — backed by SLOs, error budgets and incident management.",
    tags: ["MLflow", "KServe", "SLOs", "Chaos Eng"],
  },
];

function DomainPlate({ d, i }) {
  const spot = useSpotlight();
  const [on, setOn] = useState(false);
  return (
    <div
      {...spot}
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => setOn(false)}
      className={`spotlight group relative overflow-hidden rounded-xl panel p-7 transition-state sm:p-8 ${on ? "-translate-y-0.5 bg-surface-elevated" : "bg-surface/60"}`}
    >
      <span className={`pointer-events-none absolute inset-x-0 top-0 h-px origin-left bg-gradient-to-r from-primary via-primary/50 to-transparent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${on ? "scale-x-100" : "scale-x-0"}`} />
      {/* the numeral is the ornament */}
      <span aria-hidden className={`pointer-events-none absolute right-5 top-3 font-display text-[5.5rem] leading-none tabular-nums transition-state ${on ? "text-primary/12" : "text-foreground/[0.05]"}`}>
        {String(i + 1).padStart(2, "0")}
      </span>

      <div className="relative flex items-center gap-3">
        <span className="h-px w-6 bg-primary/50" />
        <span className={`label-mono transition-state ${on ? "text-primary" : "text-muted-foreground/60"}`}>
          domain {String(i + 1).padStart(2, "0")}
        </span>
      </div>

      <h3 className="relative mt-4 heading-sans text-[1.3rem] leading-tight sm:text-[1.45rem]">{d.name}</h3>
      <p className={`relative mt-3 max-w-sm text-[13.5px] leading-relaxed transition-state ${on ? "text-foreground/80" : "text-muted-foreground"}`}>
        {d.desc}
      </p>
      <div className="relative mt-5 flex flex-wrap gap-1.5">
        {d.tags.map((t) => <span key={t} className="chip">{t}</span>)}
      </div>
    </div>
  );
}

export function Domains() {
  return (<section id="domains" className="section-pad relative overflow-hidden">
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/6 blur-[160px]" />
      <div className="absolute inset-0 dot-matrix opacity-35" style={{
        maskImage: "radial-gradient(ellipse 60% 55% at 50% 50%, black 15%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(ellipse 60% 55% at 50% 50%, black 15%, transparent 80%)",
      }} />
    </div>

    <div className="mx-auto max-w-6xl px-6">
      <div className="mb-14 grid grid-cols-1 gap-6 md:grid-cols-12 md:items-end">
        <div className="md:col-span-6">
          <SectionLabel slug="domains" />
          <Reveal as="h2" className="mt-7 font-display display-section text-balance">
            Four domains.<br />
            <span className="text-muted-foreground">End to end.</span>
          </Reveal>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground md:col-span-5 md:col-start-8">
          <WordReveal text="From infrastructure design to ML serving — every layer connected, every layer production-grade." />
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {DOMAINS.map((d, i) => <DomainPlate key={d.name} d={d} i={i} />)}
      </div>
    </div>
  </section>);
}
