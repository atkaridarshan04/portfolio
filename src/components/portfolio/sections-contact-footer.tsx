import { useEffect, useState } from "react";
import { Ext, Magnetic, Reveal, SectionLabel, StatusDot, WordReveal, useSpotlight } from "./primitives";

const EMAIL = "atkaridarshan04@gmail.com";

/* ── Contact ──────────────────────────────────────────────────
   The address is the headline, and it can be taken in one click. */
export function Contact() {
  const spot = useSpotlight();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
    } catch {
      window.location.href = `mailto:${EMAIL}`;
    }
  }

  return (<section id="contact" className="section-pad relative overflow-hidden">
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute left-1/2 top-1/2 h-[700px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-[180px]" />
    </div>

    <div className="mx-auto max-w-6xl px-6">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <SectionLabel slug="escalation" state="monitored" />
          <Reveal as="h2" className="mt-7 font-display display-section text-balance">
            Let&apos;s build something<br />
            <span className="text-primary">production-grade.</span>
          </Reveal>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            <WordReveal text="Interested in cloud, DevOps, SRE or MLOps collaboration? Email is the fastest path — it reaches me directly, no triage queue." />
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a href={`mailto:${EMAIL}`}
              className="group font-mono text-[clamp(1rem,2.6vw,1.6rem)] text-foreground underline decoration-hairline decoration-1 underline-offset-[6px] transition-state hover:decoration-primary hover:text-primary">
              {EMAIL}
            </a>
            <Magnetic strength={0.28}>
              <button onClick={copy}
                className="rounded-[3px] border border-hairline px-2.5 py-1.5 label-mono text-muted-foreground transition-state hover:border-primary/40 hover:bg-primary/10 hover:text-primary">
                {copied ? <span className="text-status-good">copied ✓</span> : "copy address"}
              </button>
            </Magnetic>
          </div>
        </div>

        {/* escalation tiers */}
        <div {...spot} className="spotlight w-full overflow-hidden rounded-xl panel bg-surface/60 md:col-span-5">
          <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
            <StatusDot />
            <span className="label-mono text-muted-foreground">direct channels</span>
          </div>
          <div className="flex flex-col divide-y divide-hairline">
            {[
              { label: "Email", tier: "primary", href: `mailto:${EMAIL}`, ext: false },
              { label: "LinkedIn", tier: "secondary", href: "https://www.linkedin.com/in/darshan-atkari/", ext: true },
              { label: "GitHub", tier: "tertiary", href: "https://github.com/atkaridarshan04", ext: true },
            ].map((c) => (
              <a key={c.label} href={c.href} {...(c.ext ? { target: "_blank", rel: "noreferrer" } : {})}
                className="group flex items-center justify-between gap-3 px-4 py-3.5 transition-state hover:bg-primary/10">
                <span className="inline-flex items-baseline gap-1.5 text-sm text-foreground/90">
                  {c.label} {c.ext && <Ext className="opacity-0 group-hover:opacity-60" />}
                </span>
                <span className={`label-mono ${c.tier === "primary" ? "text-primary" : "text-muted-foreground"}`}>{c.tier}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>);
}

/* ── Footer ──────────────────────────────────────────────────── */
export function Footer() {
  return (<footer className="border-t border-hairline">
    <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-6 py-10 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-[3px] bg-primary font-display text-[13px] font-medium leading-none text-primary-foreground">DA</span>
        <span className="label-mono text-muted-foreground">
          Darshan Atkari · © {new Date().getFullYear()}
        </span>
      </div>
      <span className="label-mono text-muted-foreground/60">
        Designed &amp; engineered with intent.
      </span>
    </div>
  </footer>);
}
