import { motion } from "framer-motion";
import { useState } from "react";
import { Cloud, Boxes, Container, ShieldCheck, Brain, Activity, GitBranch, Zap } from "lucide-react";
import { SectionLabel } from "./primitives";
const GROUPS = [
    { icon: Cloud, name: "Cloud", items: ["AWS", "Multi-Cloud", "Networking", "Scaling", "Cost Optimisation"] },
    { icon: Boxes, name: "IaC", items: ["Terraform", "Ansible", "Helm", "Pulumi"] },
    { icon: Container, name: "Containers", items: ["Docker", "Kubernetes", "Containerd", "OCI"] },
    { icon: GitBranch, name: "GitOps & CI/CD", items: ["ArgoCD", "Argo Rollouts", "GitHub Actions", "Flux"] },
    { icon: Activity, name: "Observability", items: ["Prometheus", "Grafana", "Loki", "OpenTelemetry", "Jaeger"] },
    { icon: ShieldCheck, name: "Security", items: ["Trivy", "Gitleaks", "Vault", "Checkov", "OPA", "SonarCloud"] },
    { icon: Brain, name: "MLOps", items: ["MLflow", "DVC", "KServe", "FastAPI", "Argo Workflows"] },
    { icon: Zap, name: "Languages", items: ["Python", "Bash", "HCL", "YAML", "Go"] },
];
const RELATED = {
    "Kubernetes": ["Docker", "Containerd", "OCI", "Helm", "ArgoCD", "Argo Rollouts", "KServe"],
    "Terraform": ["Ansible", "Helm", "Checkov", "OPA", "GitHub Actions", "Pulumi"],
    "Prometheus": ["Grafana", "Loki", "OpenTelemetry", "Jaeger"],
    "MLflow": ["DVC", "KServe", "FastAPI", "Argo Workflows"],
    "Trivy": ["Gitleaks", "Vault", "Checkov", "OPA", "SonarCloud"],
    "ArgoCD": ["Argo Rollouts", "Kubernetes", "Helm", "Flux", "GitHub Actions"],
    "GitHub Actions": ["ArgoCD", "Trivy", "Gitleaks", "Checkov", "Terraform"],
};
export function Stack() {
    const [hoveredItem, setHoveredItem] = useState(null);
    const related = hoveredItem ? (RELATED[hoveredItem] ?? []) : [];
    return (<section id="stack" className="section-pad relative border-t border-hairline overflow-hidden">
      {/* distinct background: inverted grid — white lines on dark, denser than hero */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{
            backgroundImage: "linear-gradient(to right, oklch(0.72 0.19 155 / 4%) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.72 0.19 155 / 4%) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
        }}/>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-background/60 to-background pointer-events-none"/>
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          <div className="md:col-span-4">
            <SectionLabel index="04" title="Tech Stack"/>
            <h2 className="mt-6 font-display text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              The tools I reach for,
              <br />
              <span className="text-muted-foreground">grouped by intent.</span>
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Hover any technology to see related tools light up across the ecosystem.
            </p>
          </div>

          <div className="md:col-span-8 space-y-5">
            {GROUPS.map((g, gi) => (<motion.div key={g.name} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: gi * 0.05, ease: [0.22, 1, 0.36, 1] }}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">
                    <g.icon className="h-3.5 w-3.5"/>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{g.name}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((it) => {
                const isHov = hoveredItem === it;
                const isRel = related.includes(it);
                return (<motion.span key={it} whileHover={{ y: -1 }} onMouseEnter={() => setHoveredItem(it)} onMouseLeave={() => setHoveredItem(null)} className={`cursor-default rounded-full px-3 py-1 font-mono text-[12px] hairline transition-all duration-200 ${isHov ? "bg-primary/20 text-primary shadow-[0_0_14px_-4px_oklch(0.72_0.19_155/_60%)] ring-1 ring-primary/40"
                        : isRel ? "bg-primary/10 text-primary/80 ring-1 ring-primary/25"
                            : "bg-surface text-muted-foreground hover:bg-surface-elevated hover:text-foreground"}`}>
                        {it}
                      </motion.span>);
            })}
                </div>
              </motion.div>))}
          </div>
        </div>
      </div>
    </section>);
}
