import { Reveal, SectionLabel, WordReveal, useSpotlight } from "./primitives";

/* ── Writing ──────────────────────────────────────────────────
   The newest field notes, in the same ledger grammar as the certs:
   numeral, title, a log line. The notes themselves are static pages
   under /writing, built from Markdown; this section only receives
   their summaries as props, so the island carries no content.      */
export type WritingPost = {
  slug: string;
  title: string;
  deck?: string;
  description: string;
  date: string;
  tags: string[];
  minutes: number;
};

export function Writing({ posts, total }: { posts: WritingPost[]; total: number }) {
  if (!posts.length) return null;
  return (<section id="writing" className="section-pad relative overflow-hidden">
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute left-0 top-1/4 h-[420px] w-[520px] rounded-full bg-primary/5 blur-[150px]" />
    </div>
    <div className="mx-auto max-w-6xl px-6">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-12 md:items-end">
        <div className="md:col-span-7">
          <SectionLabel slug="writing" state="published" />
          <Reveal as="h2" className="mt-7 font-display display-section text-balance">
            Field notes.<br />
            <span className="text-muted-foreground">Incidents, decisions, fixes.</span>
          </Reveal>
        </div>
        <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground md:col-span-5">
          <WordReveal text="Short write-ups of things that broke or needed deciding, each tied to the repository it came from. The mechanism first, then what was done about it." />
        </p>
      </div>

      <ul className="mt-14 border-t border-hairline">
        {posts.map((p, i) => <PostRow key={p.slug} p={p} i={i} />)}
      </ul>

      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-4">
        <p className="max-w-md text-sm text-muted-foreground">
          {total > posts.length
            ? `${total - posts.length} more in the archive, with an RSS feed.`
            : "Every note is in the archive, with an RSS feed."}
        </p>
        <a href="/writing/"
          className="group relative inline-flex items-center gap-2 pb-1 font-mono text-[13px] text-foreground transition-state hover:text-primary">
          All field notes <span aria-hidden className="transition-state group-hover:translate-x-0.5">→</span>
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-foreground/25" />
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" />
        </a>
      </div>
    </div>
  </section>);
}

function PostRow({ p, i }: { p: WritingPost; i: number }) {
  const spot = useSpotlight();
  return (
    <li className="border-b border-hairline">
      <a {...spot} href={`/writing/${p.slug}/`}
        className="spotlight group grid grid-cols-[2rem_1fr] gap-x-4 gap-y-2 rounded-lg px-3 py-6 transition-state hover:bg-surface/40 md:grid-cols-[2rem_1fr_auto] md:items-baseline">
        <span className="font-mono text-[11px] text-primary/70">{String(i + 1).padStart(2, "0")}</span>
        <div className="min-w-0">
          <h3 className="heading-sans text-[clamp(1.1rem,1.9vw,1.35rem)] leading-snug text-foreground transition-state group-hover:text-primary">{p.title}</h3>
          {p.deck && <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{p.deck}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.tags.slice(0, 4).map((t) => <span key={t} className="chip">{t}</span>)}
          </div>
        </div>
        <span className="col-start-2 font-mono text-[11px] text-muted-foreground md:col-start-3 md:text-right">
          {p.date} · {p.minutes} min
        </span>
      </a>
    </li>
  );
}
