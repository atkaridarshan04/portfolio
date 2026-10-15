import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Ext, Reveal, SectionLabel, WordReveal, useSpotlight } from "./primitives";
import projAws from "@/assets/project-aws.png";
import projK8s from "@/assets/project-k8s.gif";
import projMlops from "@/assets/project-mlops.png";
import projDevsec from "@/assets/project-devsecops.png";

/* Two things the diagrams needed. First, they arrive at four different
   aspect ratios, and letting each set its own height made the alternating
   layout stagger — one plate twice the height of the next; every plate now
   sits in the same 16:10 window with the diagram contained inside it, so
   the rhythm holds and nothing is cropped. Second, `tone` marks the three
   that are drawn on white: those get a paper mat and are held back from
   full brightness until you hover, so they stop shouting over the page. */
const PROJECTS = [
  {
    num: "01", title: "CloudNative DevOps Blueprint", kicker: "Platform Engineering",
    summary: "End-to-end DevOps platform for a full-stack app: containerised with Docker, orchestrated on Kubernetes, delivered via GitOps with ArgoCD, observed with Prometheus and Grafana.",
    tech: ["Kubernetes", "ArgoCD", "Helm", "Argo Rollouts", "Prometheus", "Grafana", "Istio", "Kyverno", "Kustomize", "Jenkins"],
    outcomes: [
      "Every change flows through Git — no manual kubectl, ever",
      "Canary delivery with automated rollback via Argo Rollouts",
      "Metrics, logs and traces in a single Grafana dashboard",
    ],
    image: projK8s, tone: "light",
    github: "https://github.com/atkaridarshan04/cloudnative-devops-blueprint",
  },
  {
    num: "02", title: "AWS Cloud Portfolio", kicker: "Cloud Engineering",
    summary: "Twelve-plus production-inspired AWS builds across serverless, containers, AI workloads, event-driven architecture, networking and security — all provisioned with Terraform.",
    tech: ["Terraform", "AWS", "EKS", "Lambda", "Bedrock", "CloudFront", "GitHub Actions"],
    outcomes: [
      "12+ builds spanning distinct cloud architecture patterns",
      "Each one ships IaC, an architecture diagram and deploy docs",
      "Reusable patterns for security, scale and observability",
    ],
    image: projAws, tone: "dark",
    github: "https://github.com/atkaridarshan04/aws-cloud-portfolio",
  },
  {
    num: "03", title: "DevSecOps GitHub Actions", kicker: "Secure Software Delivery",
    summary: "A production-grade CI/CD pipeline with security at every stage — SAST via SonarCloud, container scanning via Trivy, secrets detection via Gitleaks, then signed Kubernetes delivery.",
    tech: ["GitHub Actions", "Trivy", "Gitleaks", "SonarCloud", "Kubernetes"],
    outcomes: [
      "Code quality, secrets, dependency and container scans as hard gates",
      "Images published to GHCR, GitOps manifests updated automatically",
    ],
    image: projDevsec, tone: "light",
    github: "https://github.com/atkaridarshan04/devsecops-github-actions",
  },
  {
    num: "04", title: "MLOps Platform Blueprint", kicker: "Machine Learning Operations",
    summary: "A cloud-native MLOps platform on Kubernetes: DVC for data versioning, MLflow for tracking, Argo Workflows for orchestration, KServe for scalable serving.",
    tech: ["MLflow", "DVC", "KServe", "Argo Workflows", "FastAPI", "Kubernetes"],
    outcomes: [
      "Reproducible training — same data, same code, same model every run",
      "Central model registry with experiment lineage in MLflow",
      "Autoscaling inference that scales to zero between calls",
    ],
    image: projMlops, tone: "light",
    github: "https://github.com/atkaridarshan04/mlops-platform-blueprint",
  },
];

/* ── Lightbox — solid, not frosted; closes on Escape ─────────── */
function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/97 p-4"
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label={alt}
    >
      <motion.div
        initial={{ scale: 0.97 }} animate={{ scale: 1 }} exit={{ scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative max-h-[90vh] max-w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={src} alt={alt} className="max-h-[90vh] max-w-[92vw] rounded-md object-contain hairline" />
      </motion.div>
      <button onClick={onClose} aria-label="Close"
        className="absolute right-5 top-5 inline-flex items-center gap-2 label-mono text-muted-foreground transition-state hover:text-foreground">
        close <span aria-hidden className="text-base leading-none">×</span>
      </button>
    </motion.div>
  );
}

function ProjectCard({ p, i, onOpen }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const spot = useSpotlight();
  const flip = i % 2 === 1;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  /* The plate and the copy travel at different speeds: depth without
     cropping the architecture diagrams, and nothing has to fade in. */
  const plateY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [40, -40]);
  const copyY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-12, 12]);

  return (
    <article ref={ref} className="grid grid-cols-1 items-center gap-10 md:grid-cols-12 md:gap-14">
      <motion.div style={{ y: plateY }} className={`md:col-span-7 ${flip ? "md:order-2" : ""}`}>
        <button
          {...spot}
          onClick={() => onOpen(p)}
          aria-label={`Enlarge ${p.title} architecture diagram`}
          className="spotlight group relative block w-full cursor-zoom-in overflow-hidden rounded-xl panel bg-surface/70 text-left"
        >
          <div className="flex items-center justify-between border-b border-hairline bg-background/40 px-3.5 py-2.5">
            <span className="label-mono text-muted-foreground">architecture · {p.num}</span>
            <span className="label-mono text-muted-foreground/50 transition-state group-hover:text-primary">enlarge ⤢</span>
          </div>
          {/* fixed window + contained diagram: uniform plate heights,
              and no diagram ever loses its edges to a crop */}
          <div className="relative aspect-[16/10] overflow-hidden bg-[#0a0c0f]">
            <div className={`diagram-sheet absolute inset-3 sm:inset-4 ${p.tone === "light" ? "rounded-md bg-[#f2f0ea] p-2 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.9)] ring-1 ring-foreground/10" : ""}`}>
              <img
                src={p.image}
                alt={`${p.title} architecture`}
                loading="lazy"
                className="h-full w-full object-contain transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.015]"
              />
            </div>
            {/* an amber scan passes over the diagram on hover */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-1/2 h-1/2 bg-gradient-to-b from-transparent via-primary/15 to-transparent opacity-0 transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-[300%] group-hover:opacity-100"
            />
          </div>
        </button>
      </motion.div>

      <motion.div style={{ y: copyY }} className={`md:col-span-5 ${flip ? "md:order-1" : ""}`}>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-primary">{p.num}</span>
          <span className="h-px w-6 bg-hairline" />
          <span className="label-mono text-muted-foreground">{p.kicker}</span>
        </div>

        <h3 className="mt-4 heading-sans text-[clamp(1.5rem,2.6vw,1.95rem)] leading-[1.1]">
          <WordReveal text={p.title} />
        </h3>
        <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">{p.summary}</p>

        <ul className="mt-6 space-y-2.5 border-l border-hairline pl-4">
          {p.outcomes.map((o) => (
            <li key={o} className="relative text-[13.5px] leading-relaxed text-foreground/80">
              <span aria-hidden className="absolute -left-4 top-[0.6em] h-px w-2.5 bg-primary/70" />
              {o}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap gap-1.5">
          {p.tech.map((t) => <span key={t} className="chip">{t}</span>)}
        </div>

        <a href={p.github} target="_blank" rel="noreferrer"
          className="group relative mt-7 inline-flex items-center gap-2 pb-1 font-mono text-[13px] text-foreground transition-state hover:text-primary">
          Read the repository <Ext className="opacity-60 group-hover:opacity-100" />
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-foreground/25" />
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" />
        </a>
      </motion.div>
    </article>
  );
}

export function Projects() {
  const [lightbox, setLightbox] = useState(null);
  return (<section id="projects" className="section-pad relative overflow-hidden">
    <AnimatePresence>
      {lightbox && (
        <Lightbox key="lightbox" src={lightbox.image} alt={`${lightbox.title} architecture`} onClose={() => setLightbox(null)} />
      )}
    </AnimatePresence>

    <div className="mx-auto max-w-6xl px-6">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div>
          <SectionLabel slug="projects" />
          <Reveal as="h2" className="mt-7 font-display display-section text-balance">
            Four systems.<br />
            <span className="text-muted-foreground">Built to be operated.</span>
          </Reveal>
        </div>
        <p className="max-w-xs pb-2 text-sm leading-relaxed text-muted-foreground">
          <WordReveal text="Each one written up the way I would hand it over: what it does, what it proves, what it runs on." />
        </p>
      </div>

      <div className="mt-20 space-y-28">
        {PROJECTS.map((p, i) => <ProjectCard key={p.num} p={p} i={i} onOpen={setLightbox} />)}
      </div>

      <div className="mt-24 flex flex-wrap items-baseline justify-between gap-4 border-t border-hairline pt-6">
        <p className="max-w-md text-sm text-muted-foreground">
          Every blueprint, pipeline and module lives on GitHub — readable, forkable, production-shaped.
        </p>
        <a href="https://github.com/atkaridarshan04" target="_blank" rel="noreferrer"
          className="group inline-flex items-center gap-2 font-mono text-sm text-foreground transition-state hover:text-primary">
          github.com/atkaridarshan04 <Ext className="opacity-60 group-hover:opacity-100" />
        </a>
      </div>
    </div>
  </section>);
}
