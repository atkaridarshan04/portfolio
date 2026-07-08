import { motion, AnimatePresence } from "framer-motion";
import { Github, ArrowUpRight, X, ZoomIn } from "lucide-react";
import { useState } from "react";
import { SectionLabel } from "./primitives";
/* ── Lightbox ─────────────────────────────────────────────────── */
function Lightbox({ src, alt, onClose }) {
  return (<AnimatePresence>
    <motion.div key="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl object-contain" />
        <button onClick={onClose} className="absolute -top-3 -right-3 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-foreground shadow-lg ring-1 ring-hairline transition hover:bg-surface">
          <X className="h-4 w-4" />
        </button>
      </motion.div>
    </motion.div>
  </AnimatePresence>);
}
import projAws from "@/assets/project-aws.png";
import projK8s from "@/assets/project-k8s.gif";
import projMlops from "@/assets/project-mlops.png";
import projDevsec from "@/assets/project-devsecops.png";
const PROJECTS = [
  {
    num: "01", title: "CloudNative DevOps Blueprint", kicker: "Platform Engineering",
    summary: "End-to-end DevOps platform for a full-stack app - containerised with Docker, orchestrated on Kubernetes, delivered via GitOps with ArgoCD, and monitored with Prometheus, and Grafana.",
    tech: ["Kubernetes", "ArgoCD", "Helm", "Argo Rollouts", "Prometheus", "Grafana", "Kyverno", "Jenkins", "Istio", "Kustomize"],
    outcomes: [
      "GitOps-driven deployments - every change flows through Git, never manual kubectl",
      "Canary progressive delivery with automated rollback via Argo Rollouts",
      "Full observability stack: metrics, logs, and traces in a single Grafana dashboard",
    ],
    image: projK8s,
    github: "https://github.com/atkaridarshan04/cloudnative-devops-blueprint",
  },
  {
    num: "02", title: "AWS Cloud Portfolio", kicker: "Cloud Engineering",
    summary: "A curated portfolio of production-inspired AWS projects covering serverless, cloud-native infrastructure, containers, AI workloads, event-driven architectures, networking, security, and Infrastructure as Code with Terraform.",
    tech: ["Terraform", "AWS", "EKS", "Lambda", "Bedrock", "GitHub Actions", "CloudFront", "Storage", "Many more"],
    outcomes: [
      "12+ production-inspired AWS projects spanning diverse cloud architecture patterns.",
      "Each repository includes Terraform infrastructure, architecture diagrams, deployment documentation and production best practices.",
      "Demonstrates reusable cloud architecture patterns across security, scalability, observability and Infrastructure as Code."
    ],
    image: projAws,
    github: "https://github.com/atkaridarshan04/aws-cloud-portfolio",
  },
  {
    num: "03", title: "DevSecOps GitHub Actions", kicker: "Secure Software Delivery",
    summary: "Production-grade CI/CD pipeline integrating security at every stage - SAST with SonarCloud, container scanning with Trivy, secrets detection with Gitleaks, and signed Kubernetes delivery.",
    tech: ["GitHub Actions", "Trivy", "Gitleaks", "SonarCloud", "K8s"],
    outcomes: [
      "Integrated SonarCloud, Gitleaks and Trivy to perform code quality analysis, secrets detection, dependency, filesystem and container vulnerability scanning",
      "Automated Docker image publishing to GitHub Container Registry and GitOps-ready Kubernetes manifest updates for continuous deployment workflows"
    ],
    image: projDevsec,
    github: "https://github.com/atkaridarshan04/devsecops-github-actions",
  },
  {
    num: "04", title: "MLOps Platform Blueprint", kicker: "Machine Learning Operations",
    summary: "Cloud-native MLOps platform built on Kubernetes - DVC for data versioning, MLflow for experiment tracking, Argo Workflows for pipeline orchestration, and KServe for scalable model serving.",
    tech: ["MLflow", "DVC", "KServe", "Argo Workflows", "FastAPI", "K8s"],
    outcomes: [
      "Fully reproducible training pipelines - same data, same code, same model every run",
      "Centralised model registry with experiment lineage and artifact tracking via MLflow",
      "Autoscaling inference with KServe",
    ],
    image: projMlops,
    github: "https://github.com/atkaridarshan04/mlops-platform-blueprint",
  },
];
function ProjectCard({ p, i }) {
  const flip = i % 2 === 1;
  const [lightbox, setLightbox] = useState(null);
  const imgSrc = p.archImage ?? p.image;
  return (<>
    {lightbox && <Lightbox src={lightbox} alt={`${p.title} architecture`} onClose={() => setLightbox(null)} />}
    <motion.article initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="grid grid-cols-1 items-center gap-10 md:grid-cols-12 md:gap-14">
      <div className={`md:col-span-7 ${flip ? "md:order-2" : ""}`}>
        <div className="group relative overflow-hidden rounded-lg hairline bg-surface cursor-zoom-in" onClick={() => setLightbox(imgSrc)}>
          <div className="relative overflow-hidden">
            <img src={imgSrc} alt={`${p.title} architecture`} loading="lazy" className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.02]" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
            {/* zoom hint overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/20">
              <div className="flex items-center gap-2 rounded-md bg-background/80 px-4 py-2 text-xs font-medium opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                <ZoomIn className="h-3.5 w-3.5" /> Click to enlarge
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={`md:col-span-5 ${flip ? "md:order-1" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-status-good/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-status-good ring-1 ring-status-good/25">
            <span className="h-1 w-1 rounded-full bg-status-good" /> resolved
          </span>
          <span className="rounded-sm bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hairline">{p.kicker}</span>
        </div>
        <h3 className="mt-3 font-display text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{p.title}</h3>
        <p className="mt-3 text-balance text-sm text-muted-foreground sm:text-base">{p.summary}</p>
        <div className="mt-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">resolution</div>
          <ul className="mt-2 space-y-1.5">
            {p.outcomes.map((o) => (<li key={o} className="flex items-start gap-2 text-sm text-foreground/80">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />{o}
            </li>))}
          </ul>
        </div>
        <div className="mt-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">services involved</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.tech.map((t) => (<span key={t} className="rounded-sm hairline bg-surface px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">{t}</span>))}
          </div>
        </div>
        <div className="mt-6">
          <a href={p.github} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-foreground/95 px-4 py-2 text-xs font-semibold text-background transition hover:bg-foreground">
            <Github className="h-3.5 w-3.5" /> View on GitHub <ArrowUpRight className="h-3 w-3 opacity-60" />
          </a>
        </div>
      </div>
    </motion.article>
  </>);
}
export function Projects() {
  return (<section id="projects" className="section-pad relative overflow-hidden">
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{
      backgroundImage: "linear-gradient(to bottom, rgba(245,166,35,0.04) 1px, transparent 1px)",
      backgroundSize: "100% 80px",
    }} />
    <div className="mx-auto max-w-6xl px-6">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div>
          <SectionLabel slug="postmortems" title="Featured Projects" />
          <h2 className="mt-6 font-display text-balance text-4xl font-bold leading-[0.98] tracking-tight sm:text-5xl">
            Every incident, resolved in production.
          </h2>
        </div>
      </div>
      <div className="mt-20 space-y-28">
        {PROJECTS.map((p, i) => <ProjectCard key={p.num} p={p} i={i} />)}
      </div>
    </div>
  </section>);
}
