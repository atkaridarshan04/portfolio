import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { AmbientTopology, BootSequence, SectionConnector } from "./primitives";
import { Nav, Hero } from "./hero";
import { Philosophy, Domains } from "./sections-philosophy";
import { Projects } from "./sections-projects";
import { Stack } from "./sections-stack";
import { Certifications, GitHubSection } from "./sections-certs-github";
import { Contact } from "./sections-contact-footer";
export default function Portfolio() {
    const [booting, setBooting] = useState(() => {
        if (typeof window === "undefined")
            return true;
        return !sessionStorage.getItem("da:boot");
    });
    // Theme state: default dark, persisted in localStorage
    const [theme, setTheme] = useState(() => {
        if (typeof window === "undefined")
            return "dark";
        return localStorage.getItem("da:theme") ?? "dark";
    });
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove("dark", "light");
        root.classList.add(theme);
        localStorage.setItem("da:theme", theme);
    }, [theme]);
    function handleDone() {
        sessionStorage.setItem("da:boot", "1");
        setBooting(false);
    }
    return (<main className="relative min-h-screen bg-background text-foreground antialiased">
      <AnimatePresence>
        {booting && <BootSequence onDone={handleDone}/>}
      </AnimatePresence>

      {/* fixed ambient topology layer */}
      <AmbientTopology />

      <Nav theme={theme} onToggleTheme={() => setTheme(t => t === "dark" ? "light" : "dark")}/>

      <Hero />
      <SectionConnector />
      <Domains />
      <SectionConnector />
      <Philosophy />
      <SectionConnector />
      <Projects />
      <Stack />
      <SectionConnector />
      <Certifications />
      <SectionConnector />
      <GitHubSection />
      <SectionConnector />
      <Contact />
    </main>);
}
