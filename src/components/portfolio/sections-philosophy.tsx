import { motion } from "framer-motion";
import { useState } from "react";
import { Cloud, Container, ShieldCheck, Brain, Eye, Workflow, Zap, Boxes, } from "lucide-react";
import { SectionLabel, PillarHoverFx } from "./primitives";
/* ── Engineering Philosophy ──────────────────────────────────── */
export function Philosophy() {
  const pillars = [
    { icon: Workflow, k: "Automate", t: "Every manual step is a future incident - codified, versioned, repeatable." },
    { icon: ShieldCheck, k: "Reliable", t: "Designed for failure: SLOs, error budgets, graceful degradation by default." },
    { icon: Eye, k: "Observable", t: "Metrics, logs and traces unified - you cannot operate what you cannot see." },
    { icon: Cloud, k: "Cloud Native", t: "Loosely coupled, declarative, elastic - built to live on Kubernetes." },
    { icon: Boxes, k: "Resilient", t: "Self-healing workloads, autoscaling, blast-radius containment by design." },
    { icon: Zap, k: "Operational", t: "Runbooks, on-call hygiene, post-mortems - excellence is a daily practice." },
  ];
  const [hovered, setHovered] = useState(null);
  return (<section id="philosophy" className="section-pad relative overflow-hidden">
    <div className="mx-auto max-w-6xl px-6">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <SectionLabel index="◇" title="Engineering Philosophy" />
          <h2 className="mt-6 font-display text-balance text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl md:text-6xl">
            Six principles.<br />
            <span className="bg-gradient-to-r from-primary via-accent to-foreground bg-clip-text text-transparent">
              Every system I ship.
            </span>
          </h2>
        </div>
        <p className="md:col-span-5 max-w-md text-base text-muted-foreground">
          Software is no longer shipped, it is operated. These are the principles that
          guide every infrastructure decision I make.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-3xl hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
        {pillars.map((p, i) => {
          const isHovered = hovered === i;
          const isRelated = hovered !== null && Math.abs(hovered - i) === 1;
          return (<motion.div key={p.k} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: i * 0.05 }} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} className={`group relative overflow-hidden bg-background p-7 transition-all duration-400 ${isHovered ? "bg-surface/80 shadow-[inset_0_0_30px_-10px_oklch(0.72_0.19_155/_20%)]" :
            isRelated ? "bg-surface/40" : "hover:bg-surface/50"}`}>
            <PillarHoverFx />
            <div className="flex items-center gap-3">
              <div className={`relative grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary transition duration-300 ${isHovered ? "bg-primary/25 shadow-[0_0_20px_-4px_oklch(0.72_0.19_155/_70%)] scale-110" :
                isRelated ? "bg-primary/18 shadow-[0_0_12px_-4px_oklch(0.72_0.19_155/_40%)]" : "group-hover:bg-primary/20"}`}>
                <p.icon className="h-4 w-4" />
                <span className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-primary/30 opacity-0 transition group-hover:opacity-100" />
              </div>
              <span className="font-display text-lg font-semibold tracking-tight">{p.k}</span>
              <span className={`ml-auto h-1.5 w-1.5 rounded-full transition-all duration-300 ${isHovered ? "bg-primary shadow-[0_0_8px_oklch(0.72_0.19_155/_90%)] scale-125" : "bg-primary/40 group-hover:bg-primary"}`} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.t}</p>
            {/* connection line at bottom */}
            <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent transition-opacity duration-500 ${isHovered || isRelated ? "opacity-100" : "opacity-0"}`} />
            {/* grid response on hover */}
            {isHovered && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{
              backgroundImage: "linear-gradient(to right, oklch(0.72 0.19 155 / 5%) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.72 0.19 155 / 5%) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }} />)}
          </motion.div>);
        })}
      </div>
    </div>
  </section>);
}
/* ── Engineering Domains - 4 combined cards ──────────────────── */
export function Domains() {
  const domains = [
    {
      icon: Cloud,
      name: "Cloud & Infrastructure",
      desc: "Multi-cloud architecture, Terraform modules, GitOps workflows, and drift-free environments - from landing zones to production IaC.",
      tags: ["Cloud Architecture", "IaC", "Terraform", "GitOps"],
      accent: "from-primary/30",
    },
    {
      icon: Container,
      name: "Containers & Kubernetes",
      desc: "Kubernetes, Helm, service mesh, progressive delivery with Argo Rollouts - running workloads that self-heal and scale.",
      tags: ["Kubernetes", "Helm", "ArgoCD", "Service Mesh"],
      accent: "from-accent/25",
    },
    {
      icon: ShieldCheck,
      name: "DevSecOps & Observability",
      desc: "Shift-left security with SAST, SCA, secrets scanning, policy as code - unified with metrics, logs, and traces via OpenTelemetry.",
      tags: ["GitHub Actions", "Trivy", "OTel", "Grafana"],
      accent: "from-primary/30",
    },
    {
      icon: Brain,
      name: "MLOps & Reliability",
      desc: "Reproducible ML pipelines, model registries, container-based serving - backed by SLOs, error budgets, and incident management.",
      tags: ["MLflow", "KServe", "SLOs", "Chaos Eng"],
      accent: "from-accent/25",
    },
  ];
  const [active, setActive] = useState(null);
  return (<section id="domains" className="section-pad relative overflow-hidden">
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/4 blur-[160px]" />
    </div>
    <div className="mx-auto max-w-6xl px-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-end mb-12">
        <div className="md:col-span-5">
          <SectionLabel index="02" title="Engineering Domains" />
          <h2 className="mt-6 font-display text-balance text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl">
            Four domains.<br />
            <span className="text-muted-foreground">End to end.</span>
          </h2>
        </div>
        <p className="md:col-span-5 md:col-start-8 max-w-md text-sm text-muted-foreground">
          From infrastructure design to ML serving - every layer is connected and production-grade.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {domains.map((d, i) => {
          const isActive = active === i;
          return (<motion.div key={d.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.5, delay: i * 0.06 }} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} className={`group relative overflow-hidden rounded-2xl hairline bg-surface/60 p-6 transition-all duration-300 cursor-default ${isActive
            ? "bg-surface-elevated ring-1 ring-primary/40 shadow-[0_0_30px_-8px_oklch(0.72_0.19_155/_35%)]"
            : "hover:bg-surface/80"}`}>
            <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${d.accent} via-transparent to-transparent transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-50"}`} />

            <div className="flex items-start justify-between gap-3">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition duration-300 ${isActive ? "bg-primary/25 shadow-[0_0_16px_-2px_oklch(0.72_0.19_155/_60%)] scale-110" : "group-hover:bg-primary/18"}`}>
                <d.icon className="h-5 w-5" />
              </div>
            </div>

            <h3 className="mt-4 font-display text-lg font-semibold tracking-tight leading-snug">{d.name}</h3>
            <p className={`mt-2 text-sm leading-relaxed text-muted-foreground transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-75"}`}>
              {d.desc}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {d.tags.map(t => (<span key={t} className="rounded-full hairline bg-background/60 px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground">{t}</span>))}
            </div>
          </motion.div>);
        })}
      </div>
    </div>
  </section>);
}
