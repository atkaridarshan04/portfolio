import { useState } from "react";
import { Ext, Reveal, SectionLabel, WordReveal } from "./primitives";

/* ── Stack ────────────────────────────────────────────────────
   The whole stack, laid out the way you would draw a platform on a
   whiteboard: cloud at the bottom, languages at the top, one home per
   tool so nothing is counted twice. Rows rather than a grid of logos —
   the names are the content, and a name is readable at a glance in a
   way a wall of tiny marks is not.                                   */
const LAYERS = [
  {
    name: "Cloud Platform",
    note: "AWS, end to end",
    tools: ["AWS", "EC2", "EKS", "ECS / Fargate", "Lambda", "API Gateway", "VPC", "Route 53", "CloudFront", "S3", "RDS", "DynamoDB", "EventBridge", "IAM", "CloudWatch", "Bedrock"],
  },
  {
    name: "Infrastructure as Code",
    note: "nothing clicked by hand",
    tools: ["Terraform", "Pulumi", "Ansible", "Helm", "Kustomize"],
  },
  {
    name: "Containers & Orchestration",
    note: "where the workloads live",
    tools: ["Docker", "Kubernetes", "Istio", "Argo Rollouts"],
  },
  {
    name: "Delivery & GitOps",
    note: "git is the only way in",
    tools: ["GitHub Actions", "Jenkins", "ArgoCD", "Argo Workflows", "GHCR"],
  },
  {
    name: "Security & Policy",
    note: "gates, not suggestions",
    tools: ["Trivy", "Gitleaks", "SonarCloud", "Checkov", "OPA", "Kyverno", "Vault"],
  },
  {
    name: "Observability",
    note: "metrics, logs, traces",
    tools: ["Prometheus", "Grafana", "Loki", "OpenTelemetry", "Jaeger"],
  },
  {
    name: "MLOps",
    note: "models shipped like software",
    tools: ["MLflow", "DVC", "KServe", "FastAPI"],
  },
  {
    name: "Languages & Systems",
    note: "what it is written in",
    tools: ["Python", "Bash", "HCL", "YAML", "Java", "C++", "Git", "Linux"],
  },
];

const TOTAL = LAYERS.reduce((n, l) => n + l.tools.length, 0);

const REPOS = [
  ["CloudNative DevOps Blueprint", "https://github.com/atkaridarshan04/cloudnative-devops-blueprint"],
  ["AWS Cloud Portfolio", "https://github.com/atkaridarshan04/aws-cloud-portfolio"],
  ["DevSecOps GitHub Actions", "https://github.com/atkaridarshan04/devsecops-github-actions"],
  ["MLOps Platform Blueprint", "https://github.com/atkaridarshan04/mlops-platform-blueprint"],
];

function Layer({ layer, i }) {
  const [on, setOn] = useState(false);
  return (
    <div
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => setOn(false)}
      className={`group relative grid grid-cols-1 gap-x-8 gap-y-4 border-b border-hairline px-3 py-7 transition-state md:grid-cols-12 ${on ? "bg-surface/50" : ""}`}
    >
      {/* the row lights along its leading edge */}
      <span aria-hidden className={`absolute inset-y-0 left-0 w-px origin-center bg-primary transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${on ? "scale-y-100" : "scale-y-0"}`} />

      <div className="md:col-span-4 lg:col-span-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] tabular-nums text-primary/70">{String(i + 1).padStart(2, "0")}</span>
          <h3 className={`heading-sans text-[1.05rem] leading-tight transition-state ${on ? "text-primary" : "text-foreground"}`}>
            {layer.name}
          </h3>
        </div>
        <p className="mt-2 pl-7 label-mono text-muted-foreground/55">{layer.note}</p>
      </div>

      <div className="md:col-span-8 lg:col-span-9">
        <div className="flex flex-wrap gap-1.5">
          {layer.tools.map((t) => <span key={t} className="chip">{t}</span>)}
        </div>
      </div>

      <span aria-hidden className="absolute right-3 top-7 font-mono text-[11px] tabular-nums text-muted-foreground/30">
        {String(layer.tools.length).padStart(2, "0")}
      </span>
    </div>
  );
}

export function Stack() {
  return (<section id="stack" className="section-pad relative overflow-hidden">
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 dot-matrix opacity-25" style={{
      maskImage: "radial-gradient(ellipse 75% 60% at 50% 45%, black 10%, transparent 80%)",
      WebkitMaskImage: "radial-gradient(ellipse 75% 60% at 50% 45%, black 10%, transparent 80%)",
    }} />

    <div className="mx-auto max-w-6xl px-6">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <SectionLabel slug="stack" />
          <Reveal as="h2" className="mt-7 font-display display-section text-balance">
            The whole stack.<br />
            <span className="text-muted-foreground">Bottom to top.</span>
          </Reveal>
        </div>
        <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground md:col-span-5">
          <WordReveal text="Grouped the way a platform is actually built — cloud at the base, languages at the surface. Every tool here is one I have shipped with." />
        </p>
      </div>

      <div className="mt-12 flex items-baseline justify-between gap-4 border-b border-hairline pb-3">
        <span className="label-mono text-muted-foreground/50">layer / tooling</span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground/50">
          {TOTAL} tools · {LAYERS.length} layers
        </span>
      </div>

      <div>
        {LAYERS.map((layer, i) => <Layer key={layer.name} layer={layer} i={i} />)}
      </div>

      {/* traceability, kept to one line instead of a column on every row */}
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:gap-8">
        <span className="label-mono shrink-0 text-muted-foreground/50">in use across</span>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {REPOS.map(([name, url]) => (
            <a key={name} href={url} target="_blank" rel="noreferrer"
              className="group inline-flex items-baseline gap-1.5 font-mono text-[12px] text-muted-foreground transition-state hover:text-primary">
              {name} <Ext className="opacity-50 group-hover:opacity-100" />
            </a>
          ))}
        </div>
      </div>
    </div>
  </section>);
}
