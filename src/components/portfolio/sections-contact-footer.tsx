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
            <SectionLabel index="07" title="Contact"/>
            <h2 className="mt-6 font-display text-balance text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
              Let&apos;s build something
              <br />
              <span className="bg-gradient-to-r from-primary via-primary/80 to-foreground bg-clip-text text-transparent">
                production-grade.
              </span>
            </h2>
            <p className="mt-5 max-w-md text-base text-muted-foreground">
              Interested in cloud, DevOps, SRE, or MLOps collaboration? The fastest way to reach me is email.
            </p>
          </div>

          {/* right: links stacked vertically */}
          <div className="flex flex-col items-start gap-3 md:items-end md:shrink-0">
            <a href="mailto:atkaridarshan04@gmail.com" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_8px_30px_-8px_oklch(0.62_0.20_250/_50%)] transition hover:brightness-110">
              <Mail className="h-4 w-4"/> atkaridarshan04@gmail.com
            </a>
            <div className="flex items-center gap-2">
              <a href="https://linkedin.com/in/darshan-atkari" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full hairline bg-surface px-4 py-2.5 text-sm transition hover:bg-surface-elevated">
                <Linkedin className="h-3.5 w-3.5"/> LinkedIn
              </a>
              <a href="https://github.com/atkaridarshan04" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full hairline bg-surface px-4 py-2.5 text-sm transition hover:bg-surface-elevated">
                <Github className="h-3.5 w-3.5"/> GitHub
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
        <div className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl hairline bg-hairline sm:grid-cols-4">
          {stats.map((s) => (<div key={s.label} className="flex flex-col items-center bg-surface/50 px-4 py-5">
              <span className="font-display text-2xl font-semibold tracking-tight text-foreground">{s.value}</span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground text-center">{s.label}</span>
            </div>))}
        </div>

        <div className="flex flex-col items-start justify-between gap-3 text-[11px] sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-primary font-display text-xs font-bold">DA</span>
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
