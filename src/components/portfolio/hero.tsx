import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import profileImg from "@/assets/profile.jpg";
import { Ext, Magnetic, Marquee, SECTIONS, StatusDot, useActiveSection } from "./primitives";

/* ── Arrival ──────────────────────────────────────────────────
   The first screen builds itself once, in a fixed order, and is done
   inside a second and a half. It is choreography rather than a blanket
   stagger: the portrait wipes in from the edge it bleeds off, the name
   is set letter by letter, the rule beside the paragraph draws itself,
   and one amber sweep crosses the whole thing on the way past.

   The moves are CSS animations with `backwards` fill, driven by nothing
   but an animation-delay. If they never run the elements are simply at
   their natural state - visible - so a missed frame can never strand
   the hero copy. Nothing below the fold waits on any of it.         */
const T = {
  nav: 0,
  portrait: 80,
  sweep: 120,
  eyebrow: 220,
  name: 300,
  surname: 420,
  tagline: 640,
  rule: 680,
  body: 720,
  cta: 820,
  marquee: 920,
  typist: 1000,
};
const ms = (n) => `${n}ms`;

/* Rise - the supporting move. Small and quick: 12px and 550ms, so it
   reads as the page settling rather than as everything floating up. */
function Rise({ children, delay = 0, className = "", as: Tag = "div" }) {
  return (
    <Tag className={`arrive-rise ${className}`} style={{ animationDelay: ms(delay) }}>
      {children}
    </Tag>
  );
}

/* LetterReveal - the name, set one letter at a time out of a clipped
   line. The condensed face is uppercase, so a tight mask is safe; the
   padding/margin pair keeps the cap-height from being shaved off. */
function LetterReveal({ text, delay = 0, stagger = 28, className = "" }) {
  return (
    <span
      className={`block overflow-hidden ${className}`}
      style={{ paddingBottom: "0.08em", marginBottom: "-0.08em" }}
    >
      {Array.from(text).map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className="arrive-letter"
          style={{ animationDelay: ms(delay + i * stagger) }}
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}

/* Writing - the body copy set word by word, left to right. A paragraph
   that simply switches on lands with a thud; staggering the words a few
   milliseconds apart reads the way a line is written, and because the
   unit is the word it wraps naturally instead of needing the line breaks
   known in advance.                                                    */
function Writing({ text, delay = 0, stagger = 14, className = "" }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="arrive-word" style={{ animationDelay: ms(delay + i * stagger) }}>
          {word}
          {i < words.length - 1 ? "\u00A0" : ""}
        </span>
      ))}
    </span>
  );
}

/* ── Typewriter role cycling ─────────────────────────────────── */
function RoleCycler() {
  const roles = ["Cloud Engineer", "DevOps Engineer", "SRE", "MLOps Engineer"];
  const [roleIdx, setRoleIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);
  /* hold the keyboard until the name has finished setting, so the two
     are not competing for attention in the first second */
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), T.typist);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!armed) return;
    const target = roles[roleIdx];
    if (!deleting && displayed.length < target.length) {
      const t = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 60);
      return () => clearTimeout(t);
    }
    if (!deleting && displayed.length === target.length) {
      const t = setTimeout(() => setDeleting(true), 1800);
      return () => clearTimeout(t);
    }
    if (deleting && displayed.length > 0) {
      const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 35);
      return () => clearTimeout(t);
    }
    if (deleting && displayed.length === 0) {
      setDeleting(false);
      setRoleIdx((p) => (p + 1) % roles.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayed, deleting, roleIdx, armed]);
  return (<span className="font-mono text-sm text-primary">
    {displayed}
    <span className="ml-0.5 inline-block h-4 w-px bg-primary align-middle caret-blink" />
  </span>);
}

/* ── Session uptime — the one number on the page that is measured ─
   Not a vanity stat: it is the real time this tab has been open,
   ticking, which is what a status page would actually show.        */
function SessionUptime() {
  const started = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return <span className="tabular-nums">{mm}:{ss}</span>;
}

/* ── Nav — a status bar, flat and opaque. No glass, no pill ───── */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const active = useActiveSection();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (<header className="arrive-rise fixed inset-x-0 top-0 z-50" style={{ animationDelay: ms(T.nav) }}>
    <div className={`flex items-center justify-between gap-4 border-b px-5 py-3 transition-state sm:px-8 ${scrolled ? "border-hairline bg-background/95" : "border-transparent bg-transparent"}`}>
      <a href="#top" className="group flex shrink-0 items-center gap-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-[3px] bg-primary font-display text-[13px] font-medium leading-none text-primary-foreground">DA</span>
        <span className="hidden label-mono text-muted-foreground transition-state group-hover:text-foreground sm:inline">darshan-atkari</span>
        <span className="hidden items-center gap-1.5 label-mono text-status-good md:inline-flex">
          <StatusDot /> operational
        </span>
      </a>

      {/* wayfinding below the rail's breakpoint */}
      <nav className="ml-4 flex min-w-0 flex-1 items-center justify-start gap-5 overflow-x-auto lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.slice(1).map((s) => (
          <a key={s.id} href={`#${s.id}`} className="relative py-1">
            <span className={`label-mono whitespace-nowrap transition-state ${active === s.id ? "text-primary" : "text-muted-foreground/70 hover:text-foreground"}`}>
              {s.label}
            </span>
            {active === s.id && (
              <motion.span layoutId="nav-underline" className="absolute -bottom-0.5 inset-x-0 h-px bg-primary"
                transition={{ type: "spring", stiffness: 420, damping: 36 }} />
            )}
          </a>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-4">
        <span className="hidden label-mono text-muted-foreground/60 lg:inline">
          session <SessionUptime />
        </span>
        <a href="#contact" className="group inline-flex items-center gap-1.5 rounded-[3px] bg-primary px-3.5 py-1.5 label-mono font-medium text-primary-foreground transition-state hover:brightness-110">
          Get in touch <Ext className="group-hover:-translate-y-px" />
        </a>
      </div>
    </div>
  </header>);
}

/* ── Hero ─────────────────────────────────────────────────────
   The portrait used to be a framed card parked in the right column,
   which left a column of dead black between it and the type and made
   the whole first screen read as two unrelated boxes. It is a bleed
   now: full height, hard against the right edge of the viewport, and
   dissolved leftward into the background so the type sits on top of
   it rather than beside it. One picture, one block of type, no gap
   in the middle for the eye to fall into.                          */
export function Hero() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const portraitY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -60]);
  const fade = useTransform(scrollYProgress, [0, 0.9], [1, 0.25]);

  return (<section id="top" ref={ref} className="relative isolate overflow-hidden grain">
    <div
      aria-hidden
      className="arrive-sweep pointer-events-none absolute inset-x-0 top-0 z-30 h-[28vh]"
      style={{
        animationDelay: ms(T.sweep),
        background: "linear-gradient(to bottom, transparent, rgba(245,166,35,0.07) 45%, rgba(245,166,35,0.13) 55%, transparent)",
      }}
    />
    {/* atmosphere */}
    <motion.div style={{ y: bgY, opacity: fade }} aria-hidden className="absolute inset-0 -z-10">
      <div className="absolute inset-0 dot-matrix opacity-40" style={{
        maskImage: "radial-gradient(ellipse 70% 60% at 35% 40%, black 10%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 35% 40%, black 10%, transparent 75%)",
      }} />
      <div className="absolute -left-32 top-32 h-[32rem] w-[32rem] rounded-full bg-primary/12 blur-[150px]" />
      <div className="absolute left-1/3 -top-24 h-[26rem] w-[40rem] rounded-full bg-accent/6 blur-[170px]" />
    </motion.div>

    <div className="relative flex flex-col lg:block lg:min-h-screen">
      {/* ── the portrait, bleeding off the right edge ───────────── */}
      <motion.div
        style={{ y: portraitY }}
        className="relative order-2 h-[56vh] w-full lg:absolute lg:inset-y-0 lg:right-0 lg:order-none lg:h-full lg:w-[44%] xl:w-[42%]"
      >
       <div className="arrive-wipe absolute inset-0" style={{ animationDelay: ms(T.portrait) }}>
        <img
          src={profileImg}
          alt="Portrait of Darshan Atkari"
          width={535} height={1024}
          className="arrive-zoom duotone h-full w-full object-cover object-[center_18%] lg:object-[center_22%]"
          style={{ animationDelay: ms(T.portrait) }}
        />
        {/* dissolve: downward on a phone, leftward on a wide screen */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/10 lg:hidden" />
        <div aria-hidden className="absolute inset-0 hidden lg:block" style={{
          background: "linear-gradient(90deg, #0b0e11 0%, rgba(11,14,17,0.92) 22%, rgba(11,14,17,0.45) 48%, rgba(11,14,17,0.12) 78%, rgba(11,14,17,0) 100%)",
        }} />
        <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent lg:h-56" />
        {/* holds the pale studio backdrop down so the face is the brightest thing */}
        <div aria-hidden className="absolute inset-0" style={{
          background: "radial-gradient(ellipse 58% 48% at 62% 40%, transparent 28%, rgba(11,14,17,0.38) 68%, rgba(11,14,17,0.85) 100%)",
        }} />
       </div>
      </motion.div>

      {/* ── the type ─────────────────────────────────────────────── */}
      <div className="relative order-1 mx-auto flex w-full max-w-6xl flex-col justify-center px-6 pb-10 pt-32 lg:min-h-screen lg:pb-28 lg:pt-28">
        <div className="max-w-[38rem]">
          <Rise delay={T.eyebrow} className="flex flex-wrap items-center gap-x-3 gap-y-1 label-mono text-muted-foreground">
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <StatusDot />
              currently deployed as
            </span>
            <RoleCycler />
          </Rise>

          <h1 className="mt-7 font-display display-hero">
            <LetterReveal text="Darshan" delay={T.name} />
            <LetterReveal text="Atkari" delay={T.surname} className="text-primary" />
          </h1>

          <Rise as="p" delay={T.tagline} className="mt-6 font-mono text-sm tracking-tight">
            <span className="text-shine">automating the present</span>
            <span className="px-2 text-muted-foreground/50">·</span>
            <span className="text-shine">scaling the future</span>
          </Rise>

          {/* the rule draws itself down before the copy arrives beside it */}
          <div className="relative mt-6 w-full max-w-xl pl-5">
            <span
              aria-hidden
              className="arrive-draw absolute left-0 top-0 h-full w-px bg-hairline"
              style={{ animationDelay: ms(T.rule) }}
            />
            <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              <Writing
                delay={T.body}
                text="I build the unseen layer beneath modern software — cloud-native infrastructure, Kubernetes workloads, DevSecOps pipelines, and MLOps systems — engineered for reliability, observability, and automation at scale."
              />
            </p>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Magnetic>
              <a href="#projects" style={{ animationDelay: ms(T.cta) }} className="arrive-left group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-state hover:brightness-110">
                View the work
                <span aria-hidden className="transition-state group-hover:translate-x-0.5">→</span>
              </a>
            </Magnetic>
            {[
              { label: "GitHub", href: "https://github.com/atkaridarshan04" },
              { label: "LinkedIn", href: "https://www.linkedin.com/in/darshan-atkari/" },
              { label: "Résumé", href: "https://drive.google.com/file/d/1j7TD_B6cMMWz6VkXwYCfYubT49IjnLzy/view" },
            ].map((l, i) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                style={{ animationDelay: ms(T.cta + 150 + i * 90) }}
                className="arrive-left group relative inline-flex items-center gap-1.5 pb-1 font-mono text-sm text-muted-foreground transition-state hover:text-foreground">
                {l.label} <Ext className="opacity-50 group-hover:opacity-100" />
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-hairline" />
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* the stack, running past */}
    <Rise delay={T.marquee} className="relative border-y border-hairline bg-surface/30 py-3.5">
      <Marquee duration={54}>
        {["Kubernetes", "Terraform", "ArgoCD", "AWS", "Docker", "Helm", "Prometheus", "Grafana", "GitHub Actions", "Istio", "Trivy", "MLflow", "KServe", "Argo Workflows", "Kyverno", "OpenTelemetry", "Vault", "Ansible"].map((t) => (
          <span key={t} className="flex items-center gap-7 px-3.5 font-mono text-[13px] text-muted-foreground/70">
            {t}
            <span aria-hidden className="h-1 w-1 rotate-45 bg-primary/40" />
          </span>
        ))}
      </Marquee>
    </Rise>

    {/* terminal interlude */}
    <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:items-center">
        <div className="md:col-span-5">
          <div className="label-mono text-muted-foreground">live shell</div>
          <h2 className="mt-4 font-display display-sub text-balance">
            The interface I think in.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Most of my craft happens in plain text — declarations, manifests, pipelines.
            Each command is a contract with production.
          </p>
        </div>
        <div className="md:col-span-7">
          <CommandTerminal />
        </div>
      </div>
    </div>
  </section>);
}

/* ── CommandTerminal ─────────────────────────────────────────── */
function CommandTerminal() {
  const lines = [
    { cmd: "terraform apply -auto-approve", out: "Apply complete! 37 added, 0 changed, 0 destroyed." },
    { cmd: "kubectl get pods -n argocd", out: "argocd-server-7c9f   1/1   Running   0   12d" },
    { cmd: "argocd app sync platform", out: "Synced  →  Healthy" },
    { cmd: "docker build -t platform/api:1.4.2 .", out: "Successfully tagged platform/api:1.4.2" },
    { cmd: "gh workflow run release.yml", out: "✓ release.yml queued on main" },
  ];
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [showOut, setShowOut] = useState(false);
  useEffect(() => {
    const cmd = lines[idx].cmd;
    setTyped("");
    setShowOut(false);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setTyped(cmd.slice(0, i));
      if (i >= cmd.length) {
        clearInterval(t);
        setTimeout(() => setShowOut(true), 250);
        setTimeout(() => setIdx((p) => (p + 1) % lines.length), 2600);
      }
    }, 45);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);
  return (<div className="relative overflow-hidden rounded-xl hairline bg-[#07090b] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]">
    <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5">
      <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
      <span className="ml-1 label-mono text-white/35">~/backstage · zsh</span>
    </div>
    <div className="min-h-[13.5rem] space-y-2 p-5 font-mono text-[13px] leading-relaxed sm:text-sm">
      {lines.slice(0, idx).map((l, i) => (<div key={i} className="opacity-40">
        <div><span className="text-primary">❯</span> <span className="text-white/70">{l.cmd}</span></div>
        <div className="pl-3 text-white/40">{l.out}</div>
      </div>))}
      <div>
        <span className="text-primary">❯</span>{" "}<span className="text-white/85">{typed}</span>
        <span className="ml-0.5 inline-block h-4 w-1.5 -mb-0.5 bg-primary caret-blink" />
      </div>
      {showOut && (<div className="pl-3 text-white/50">{lines[idx].out}</div>)}
    </div>
  </div>);
}
