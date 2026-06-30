import { motion } from "framer-motion";
import { Award, ArrowUpRight, GitBranch } from "lucide-react";
import { SectionLabel, SectionMini } from "./primitives";
/* ── Certifications ──────────────────────────────────────────── */
export function Certifications() {
  const certs = [
    { name: "AWS Cloud Technology Consultant Professional Certificate", issuer: "AWS + Coursera", year: "2026", url: "https://www.coursera.org/account/accomplishments/specialization/BG2RKH0B5PQ1?utm_source=link&utm_medium=certificate&utm_content=cert_image&utm_campaign=sharing_cta&utm_product=prof" },
    // { name: "Certified Kubernetes Administrator (CKA)", issuer: "CNCF / Linux Foundation", year: "2025", url: "#" },
    { name: "MLOps Zero To Hero", issuer: "Udemy", year: "2026", url: "https://www.udemy.com/certificate/UC-1ae8fdcf-aafb-468a-b7a4-f85708ceb74c/", },
    { name: "Docker Foundational Professional Certificate", issuer: "Docker + LinkedIn", year: "2024", url: "https://www.linkedin.com/learning/certificates/87f4ada6b8a512bca8033acb7d6ac8f84e655e3a9d5b240500c94a36dd953f63?lipi=urn%3Ali%3Apage%3Ad_flagship3_profile_view_base_certifications_details%3BETDKcTzCTomn4IIK6KyJqA%3D%3D" },
  ];
  return (<section id="certs" className="section-pad relative overflow-hidden">
    {/* distinct background: diagonal stripe accent */}
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{
      backgroundImage: "repeating-linear-gradient(135deg, oklch(0.72 0.19 155 / 3%) 0px, oklch(0.72 0.19 155 / 3%) 1px, transparent 1px, transparent 40px)",
    }} />
    <div className="mx-auto max-w-6xl px-6">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <SectionLabel index="05" title="Certifications" />
          <h2 className="mt-6 font-display text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Verified by the<br />
            <span className="text-muted-foreground">vendors I build on.</span>
          </h2>
          {/* cert count badge */}
          <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 ring-1 ring-primary/25">
            <Award className="h-4 w-4 text-primary" />
            <span className="font-mono text-sm font-medium text-primary">{certs.length} active certifications</span>
          </div>
        </div>
        <div className="md:col-span-8">
          <ul className="space-y-3">
            {certs.map((c, i) => (
              <motion.li key={c.name} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.06 }}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-4 rounded-2xl hairline bg-surface/60 px-5 py-4 transition hover:bg-surface-elevated hover:ring-1 hover:ring-primary/30"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary/20 group-hover:shadow-[0_0_16px_-2px_oklch(0.72_0.19_155/_60%)]">
                    <Award className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-base font-medium tracking-tight sm:text-lg">{c.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{c.issuer} · <span className="font-mono">{c.year}</span></div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition group-hover:text-primary">
                    Verify <ArrowUpRight className="h-3.5 w-3.5" />
                  </div>
                </a>
              </motion.li>))}
          </ul>
        </div>
      </div>
    </div>
  </section>);
}
export function GitHubSection() {
  const USER = "atkaridarshan04";
  // Pinned repos from atkaridarshan04 (kept for future re-enable)
  // const pinnedRepos: GHRepo[] = [ ... ];
  return (<section id="github" className="section-pad relative overflow-hidden">
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -left-40 top-0 h-[600px] w-[600px] rounded-full bg-primary/5 blur-[160px]" />
      <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(oklch(0.72 0.19 155 / 8%) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
    </div>

    <div className="mx-auto max-w-6xl px-6">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
        {/* left */}
        <div className="md:col-span-4 md:sticky md:top-28 md:self-start">
          <SectionLabel index="06" title="GitHub" />
          <h2 className="mt-6 font-display text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">Built in<br />the open.</h2>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            Every blueprint, pipeline and module lives on GitHub - readable, forkable, production-shaped.
          </p>
        </div>

        {/* right */}
        <div className="md:col-span-8 space-y-4">
          {/* contribution calendar */}
          <div>
            <SectionMini label="Contribution activity · last 52 weeks" />
            <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mt-3 overflow-hidden rounded-2xl hairline bg-surface/60 p-4">
              <img src={`https://ghchart.rshah.org/3b82f6/${USER}`} alt={`${USER} GitHub contribution chart`} className="w-full rounded" loading="lazy" />
            </motion.div>
          </div>

          {/* profile */}
          <div className="flex flex-wrap gap-3">
            <a href={`https://github.com/${USER}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-foreground/95 px-5 py-2.5 text-sm font-semibold text-background transition hover:bg-foreground">
              <GitBranch className="h-4 w-4" /> @{USER}
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>);
}
