import { Ext, Reveal, SectionLabel, WordReveal, useSpotlight } from "./primitives";

/* ── Certifications ───────────────────────────────────────────
   Same ledger grammar as the SLOs and the evidence list: numeral,
   name, issuer, a link that leaves the page. No badge icons.     */
const CERTS = [
  {
    name: "AWS Cloud Technology Consultant Professional Certificate",
    issuer: "AWS + Coursera", year: "2026",
    url: "https://www.coursera.org/account/accomplishments/specialization/BG2RKH0B5PQ1?utm_source=link&utm_medium=certificate&utm_content=cert_image&utm_campaign=sharing_cta&utm_product=prof",
  },
  {
    name: "MLOps Zero To Hero",
    issuer: "Udemy", year: "2026",
    url: "https://www.udemy.com/certificate/UC-1ae8fdcf-aafb-468a-b7a4-f85708ceb74c/",
  },
  {
    name: "Docker Foundational Professional Certificate",
    issuer: "Docker + LinkedIn", year: "2024",
    url: "https://www.linkedin.com/learning/certificates/87f4ada6b8a512bca8033acb7d6ac8f84e655e3a9d5b240500c94a36dd953f63?lipi=urn%3Ali%3Apage%3Ad_flagship3_profile_view_base_certifications_details%3BETDKcTzCTomn4IIK6KyJqA%3D%3D",
  },
];

export function Certifications() {
  return (<section id="certs" className="section-pad relative overflow-hidden">
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute right-0 top-1/3 h-[420px] w-[520px] rounded-full bg-status-good/5 blur-[150px]" />
    </div>
    <div className="mx-auto max-w-6xl px-6">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <SectionLabel slug="compliance" state="audited" />
          <Reveal as="h2" className="mt-7 font-display display-section text-balance">
            Verified by the<br />
            <span className="text-muted-foreground">vendors I build on.</span>
          </Reveal>
        </div>
        <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground md:col-span-5">
          <WordReveal text="Each one links to the issuer's own record — check them rather than take my word." />
        </p>
      </div>

      <ul className="mt-14 border-t border-hairline">
        {CERTS.map((c, i) => <CertRow key={c.name} c={c} i={i} />)}
      </ul>
    </div>
  </section>);
}

/* Each row lights where the pointer is, so the list reads as hardware
   rather than as a stack of links. */
function CertRow({ c, i }) {
  const spot = useSpotlight();
  return (
    <li className="border-b border-hairline">
      <a {...spot} href={c.url} target="_blank" rel="noreferrer"
        className="spotlight group grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg px-3 py-6 transition-state hover:bg-surface/40 md:grid-cols-12 md:items-baseline">
        <span className="grid h-8 w-8 place-items-center rounded-md border border-status-good/25 bg-status-good/10 font-mono text-[11px] text-status-good transition-state group-hover:bg-status-good/20 md:col-span-1">
          {String(i + 1).padStart(2, "0")}
        </span>
        <h3 className="heading-sans text-[clamp(1.05rem,1.8vw,1.3rem)] leading-snug md:col-span-7">{c.name}</h3>
        <span className="font-mono text-[12px] text-muted-foreground md:col-span-2">{c.issuer}</span>
        <span className="inline-flex w-fit items-baseline gap-1.5 rounded-sm border border-hairline bg-background/60 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-state group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary md:col-span-2 md:ml-auto">
          {c.year} · verify <Ext className="opacity-60 group-hover:opacity-100" />
        </span>
      </a>
    </li>
  );
}
