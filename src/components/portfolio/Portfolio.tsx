import { AmbientTopology, ScrollRail, SectionConnector } from "./primitives";
import { Hero, Nav } from "./hero";
import { Domains, Philosophy } from "./sections-philosophy";
import { Projects } from "./sections-projects";
import { Stack } from "./sections-stack";
import { Certifications } from "./sections-certs";
import { Contact, Footer } from "./sections-contact-footer";

/* No boot screen: nothing is loading, so nothing stands in front of the
   page. The hero is the first paint and reveals itself on arrival. */
export default function Portfolio() {
  return (
    <main className="relative min-h-screen bg-background text-foreground antialiased">
      <AmbientTopology />
      <ScrollRail />
      <Nav />

      <Hero />
      <SectionConnector />
      <Domains />
      <SectionConnector />
      <Projects />
      <SectionConnector />
      <Philosophy />
      <SectionConnector />
      <Stack />
      <SectionConnector />
      <Certifications />
      <SectionConnector />
      <Contact />
      <Footer />
    </main>
  );
}
