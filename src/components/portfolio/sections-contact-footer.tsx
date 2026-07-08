import { Mail, Github, Linkedin } from "lucide-react";
import { SectionLabel } from "./primitives";
/* ── Contact ─────────────────────────────────────────────────── */
export function Contact() {
    return (<section id="contact" className="section-pad relative overflow-hidden">
      {/* distinct background: center-radial warm glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[700px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-[180px]"/>
      </div>

      <div className="mx-auto max-w-5xl px-6">
        <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
          {/* left: heading + description */}
          <div className="max-w-xl">
            <SectionLabel slug="escalation" title="Contact"/>
            <h2 className="mt-6 font-display text-balance text-5xl font-bold leading-[0.98] tracking-tight sm:text-6xl">
              Let&apos;s build something
              <br />
              <span className="text-primary">production-grade.</span>
            </h2>
            <p className="mt-5 max-w-md text-base text-muted-foreground">
              Interested in cloud, DevOps, SRE, or MLOps collaboration? The fastest way to reach me is email.
            </p>
          </div>

          {/* right: escalation tiers */}
          <div className="w-full max-w-xs shrink-0 overflow-hidden rounded-md hairline bg-surface/60">
            <div className="flex items-center gap-1.5 border-b border-hairline px-3 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-status-good status-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">on-call · new opportunities</span>
            </div>
            <div className="flex flex-col divide-y divide-hairline">
              <a href="mailto:atkaridarshan04@gmail.com" className="group flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-primary/10">
                <span className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                  <Mail className="h-4 w-4 text-primary"/> Email
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">primary</span>
              </a>
              <a href="https://linkedin.com/in/darshan-atkari" target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface-elevated">
                <span className="flex items-center gap-2.5 text-sm text-foreground/85">
                  <Linkedin className="h-4 w-4 text-muted-foreground"/> LinkedIn
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">secondary</span>
              </a>
              <a href="https://github.com/atkaridarshan04" target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface-elevated">
                <span className="flex items-center gap-2.5 text-sm text-foreground/85">
                  <Github className="h-4 w-4 text-muted-foreground"/> GitHub
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">tertiary</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>);
}
/* ── Footer ──────────────────────────────────────────────────── */
export function Footer() {
    const stats = [
        { value: "4+", label: "Certifications" },
        { value: "5+", label: "Production projects" },
        { value: "30+", label: "Tools & technologies" },
        { value: "100%", label: "Open source" },
    ];
    return (<footer className="border-t border-hairline">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* social proof stat strip */}
        <div className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-md hairline bg-hairline sm:grid-cols-4">
          {stats.map((s) => (<div key={s.label} className="flex flex-col items-center bg-surface/50 px-4 py-5">
              <span className="font-display text-2xl font-bold tracking-tight text-foreground">{s.value}</span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground text-center">{s.label}</span>
            </div>))}
        </div>

        <div className="flex flex-col items-start justify-between gap-3 text-[11px] sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-[3px] bg-primary text-primary-foreground font-display text-xs font-bold">DA</span>
            <span className="font-mono uppercase tracking-[0.22em] text-muted-foreground">
              Darshan Atkari · © {new Date().getFullYear()}
            </span>
          </div>
          <div className="font-mono uppercase tracking-[0.22em] text-muted-foreground">
            Designed &amp; engineered with intent.
          </div>
        </div>
      </div>
    </footer>);
}
