import { motion } from "framer-motion";
import { fade, stagger, SectionLabel } from "./primitives";
export function About() {
  return (<section id="about" className="section-pad relative overflow-hidden">
    {/* distinct background: right-edge vertical accent bar */}
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute right-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
      <div className="absolute right-0 top-1/4 h-64 w-64 rounded-full bg-primary/6 blur-[120px]" />
    </div>

    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 md:grid-cols-12">
      <motion.div variants={fade} initial="hidden" whileInView="show" viewport={{ once: true }} className="md:col-span-4">
        <SectionLabel index="01" title="About" />
        {/* vertical rule accent */}
        <div className="mt-6 h-16 w-px bg-gradient-to-b from-primary/60 to-transparent ml-1" />
      </motion.div>
      <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} className="md:col-span-8 space-y-6">
        <motion.p variants={fade} className="font-display text-balance text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
          I design and ship the <span className="text-primary">unseen layer</span> beneath modern
          software - the infrastructure, pipelines and runtimes that turn ideas into production.
        </motion.p>
        <motion.p variants={fade} className="max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          My work lives at the intersection of <em className="not-italic text-foreground/90">Cloud Architecture,
            Infrastructure as Code, Kubernetes, DevSecOps, MLOps and Observability</em>.
          I build reference-grade systems - small enough to read end-to-end, serious enough to run real workloads.
        </motion.p>
        <motion.p variants={fade} className="max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          Lately I have been focused on reliability engineering: SLOs, error budgets, graceful
          degradation, and the operational discipline that keeps cloud-native systems healthy under load.
        </motion.p>
      </motion.div>
    </div>
  </section>);
}
