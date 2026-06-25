import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Github, Linkedin, FileText, ArrowRight, Terminal as TerminalIcon, Sun, Moon, } from "lucide-react";
import profileImg from "@/assets/profile.jpg";
import { fade, stagger, StatusDot, HeroBlueprint } from "./primitives";
/* ── Typewriter role cycling ─────────────────────────────────── */
function RoleCycler() {
  const roles = ["Cloud Engineer", "DevOps Engineer", "SRE", "MLOps Engineer"];
  const [roleIdx, setRoleIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
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
  }, [displayed, deleting, roleIdx]);
  return (<span className="font-mono text-sm text-primary">
    {displayed}
    <span className="ml-0.5 inline-block h-4 w-px bg-primary align-middle animate-pulse" />
  </span>);
}
/* ── Compact stats strip (replaces OpsPanel) ─────────────────── */
function StatsStrip() {
  const stats = [
    { label: "Projects", value: "5+" },
    { label: "Certs", value: "3" },
    { label: "Tools", value: "30+" },
    { label: "Commits", value: "∞" },
  ];
  return (<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.7, ease: [0.22, 1, 0.36, 1] }} className="grid grid-cols-4 divide-x divide-hairline overflow-hidden rounded-2xl hairline glass">
    {stats.map((s) => (<div key={s.label} className="flex flex-col items-center py-3 px-2">
      <span className="font-display text-lg font-semibold tracking-tight text-foreground">{s.value}</span>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{s.label}</span>
    </div>))}
  </motion.div>);
}
/* ── Floating labels around portrait ─────────────────────────── */
// Removed - kept code-paths clean
/* ── Nav ─────────────────────────────────────────────────────── */
export function Nav({ theme, onToggleTheme }) {
  const links = [
    { label: "Domains", href: "#domains" },
    { label: "Projects", href: "#projects" },
    { label: "Stack", href: "#stack" },
    { label: "Certs", href: "#certs" },
    { label: "GitHub", href: "#github" },
    { label: "Contact", href: "#contact" },
  ];
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("top");
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const ids = ["top", "domains", "projects", "stack", "certs", "github", "contact"];
    const els = ids.map((id) => document.getElementById(id)).filter((e) => !!e);
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target.id)
        setActive(visible.target.id);
    }, { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.6, 1] });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (<motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: "easeOut" }} className="fixed inset-x-0 top-0 z-50">
    <div className={`mx-auto mt-4 flex max-w-6xl items-center justify-between gap-4 rounded-full hairline px-4 py-2 transition-all duration-300 sm:px-5 ${scrolled ? "glass bg-background/70 shadow-[0_8px_40px_-20px_oklch(0_0_0/_60%)] [backdrop-filter:blur(22px)_saturate(160%)]" : "glass"}`}>
      <a href="#top" className="flex items-center gap-2.5 pl-1.5">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-primary font-display text-sm font-bold">DA</span>
        <span className="font-display text-sm font-semibold tracking-tight hidden sm:inline">Darshan Atkari</span>
      </a>
      <nav className="hidden items-center gap-1 md:flex">
        {links.map((l) => {
          const id = l.href.slice(1);
          const isActive = active === id;
          return (<a key={l.href} href={l.href} className={`relative rounded-full px-3 py-1.5 text-[13px] transition ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {isActive && (<motion.span layoutId="nav-active" className="absolute inset-0 -z-10 rounded-full bg-primary/15 ring-1 ring-inset ring-primary/25" transition={{ type: "spring", stiffness: 320, damping: 30 }} />)}
            {l.label}
          </a>);
        })}
      </nav>
      <div className="flex items-center gap-2">
        <button onClick={onToggleTheme} aria-label="Toggle theme" className="grid h-8 w-8 place-items-center rounded-full hairline bg-surface/60 text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground">
          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
        <a href="#contact" className="group inline-flex items-center gap-1.5 rounded-full bg-foreground/95 px-3.5 py-1.5 text-[13px] font-medium text-background transition hover:bg-foreground">
          Get in touch
          <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
      </div>
    </div>
  </motion.header>);
}
/* ── Hero ────────────────────────────────────────────────────── */
export function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 110]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.3]);
  return (<section id="top" ref={ref} className="relative isolate overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-24 grain">
    <motion.div style={{ y, opacity }} aria-hidden className="absolute inset-0 -z-10">
      <div className="absolute inset-0 grid-pattern opacity-60" />
      <div className="absolute left-1/2 top-0 h-[640px] w-[1200px] -translate-x-1/2 amber-glow" />
      <HeroBlueprint />
      <div className="absolute left-1/2 top-40 h-[1px] w-[80%] -translate-x-1/2 bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
      <div className="absolute -left-40 top-40 h-[28rem] w-[28rem] rounded-full bg-primary/12 blur-[140px]" />
      <div className="absolute -right-32 top-72 h-[26rem] w-[26rem] rounded-full bg-accent/8 blur-[160px]" />
    </motion.div>

    <div className="mx-auto max-w-6xl px-6">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.35fr_1fr] lg:gap-16">

        {/* LEFT */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col items-start gap-6">

          {/* name */}
          <motion.h1 variants={fade} className="font-display text-balance text-[clamp(2.6rem,6.5vw,5rem)] font-semibold leading-[1.0] tracking-tight">
            Darshan Atkari
          </motion.h1>

          {/* animated role */}
          <motion.div variants={fade} className="flex items-center gap-3">
            <StatusDot />
            <RoleCycler />
          </motion.div>

          {/* description */}
          <motion.p variants={fade} className="max-w-xl font-display text-xl italic leading-snug text-foreground/75 sm:text-2xl">
            Automating the present.{" "}
            <span className="text-primary not-italic font-normal">·</span>{" "}
            Scaling the future.
          </motion.p>

          <motion.p variants={fade} className="max-w-xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
            I build the unseen layer beneath modern software - cloud-native infrastructure,
            Kubernetes workloads, DevSecOps pipelines, and MLOps systems - engineered for
            reliability, observability, and automation at scale.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={fade} className="flex flex-wrap items-center gap-3 pt-1">
            <a href="#projects" className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-10px_oklch(0.72_0.19_155/_55%)] transition hover:brightness-110">
              View Projects
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </a>
            <a href="https://github.com/atkaridarshan04" target="_blank" rel="noreferrer" className="group inline-flex items-center gap-2 rounded-full hairline bg-surface px-5 py-3 text-sm font-medium text-foreground transition hover:bg-surface-elevated">
              <Github className="h-4 w-4" /> GitHub
            </a>
            <a href="https://www.linkedin.com/in/darshan-atkari/" target="_blank" rel="noreferrer" className="group inline-flex items-center gap-2 rounded-full hairline bg-surface px-5 py-3 text-sm font-medium text-foreground transition hover:bg-surface-elevated">
              <Linkedin className="h-4 w-4" /> LinkedIn
            </a>
            <a href="https://drive.google.com/file/d/1j7TD_B6cMMWz6VkXwYCfYubT49IjnLzy/view" target="_blank" className="group inline-flex items-center gap-2 rounded-full bg-transparent px-5 py-3 text-sm font-medium text-muted-foreground transition hover:text-foreground">
              <FileText className="h-4 w-4" /> Resumme
              <ArrowUpRight className="h-3.5 w-3.5 opacity-60 transition group-hover:opacity-100" />
            </a>
          </motion.div>
        </motion.div>

        {/* RIGHT */}
        <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }} className="relative mx-auto w-full max-w-xs lg:mx-0 lg:mt-2 flex flex-col gap-4">
          <div aria-hidden className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-primary/18 blur-3xl" />
          <div aria-hidden className="absolute -inset-1 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/30 via-accent/12 to-transparent blur-md" />

          {/* portrait */}
          <div className="relative rounded-[2rem] hairline glass p-2 shadow-[0_30px_80px_-30px_oklch(0_0_0/_65%)]">
            <div className="relative aspect-square overflow-hidden rounded-[1.6rem] bg-surface">
              <img src={profileImg} alt="Portrait of Darshan Atkari" width={640} height={800} className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/55 via-transparent to-transparent" />
              <div className="pointer-events-none absolute inset-0 rounded-[1.6rem] ring-1 ring-inset ring-white/5" />
            </div>
            <div className="absolute -bottom-3 left-6 flex items-center gap-2 rounded-full hairline glass px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              kubectl get engineer
            </div>
          </div>

          {/* stats strip */}
          <StatsStrip />
        </motion.div>
      </div>
    </div>

    {/* terminal interlude */}
    <div className="mx-auto mt-20 max-w-6xl px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="grid grid-cols-1 gap-8 md:grid-cols-12 md:items-center">
        <div className="md:col-span-5">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <TerminalIcon className="h-3.5 w-3.5 text-primary" /> live shell
          </div>
          <h3 className="mt-3 font-display text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
            The interface I think in.
          </h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Most of my craft happens in plain text, declarations, manifests, pipelines.
            Each command is a contract with production.
          </p>
        </div>
        <div className="md:col-span-7">
          <CommandTerminal />
        </div>
      </motion.div>
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
  return (<div className="relative overflow-hidden rounded-2xl hairline bg-[oklch(0.11_0.025_155)] shadow-[0_30px_80px_-30px_oklch(0_0_0/_70%)]">
    <div className="flex items-center gap-2 border-b border-white/8 px-4 py-2.5">
      <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
      <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
      <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
      <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.22em] text-white/35">
        ~/backstage · zsh
      </span>
    </div>
    <div className="space-y-2 p-5 font-mono text-[13px] leading-relaxed sm:text-sm">
      {lines.slice(0, idx).map((l, i) => (<div key={i} className="opacity-40">
        <div><span className="text-primary">❯</span> <span className="text-white/70">{l.cmd}</span></div>
        <div className="pl-3 text-white/40">{l.out}</div>
      </div>))}
      <div>
        <span className="text-primary">❯</span>{" "}<span className="text-white/85">{typed}</span>
        <span className="ml-0.5 inline-block h-4 w-1.5 -mb-0.5 animate-pulse bg-primary" />
      </div>
      {showOut && (<motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="pl-3 text-white/50">{lines[idx].out}</motion.div>)}
    </div>
  </div>);
}
