import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://atkaridarshan.online",
  integrations: [react(), sitemap()],
  markdown: {
    /* Vesper is amber on near-black: the code blocks wear the same
       indicator colour as the rest of the page instead of a second palette. */
    shikiConfig: {
      theme: "vesper",
      transformers: [
        {
          /* keep the fence's title="path" so the page can label the block */
          name: "code-title",
          pre(node) {
            const raw = this.options.meta?.__raw ?? "";
            const title = raw.match(/title="([^"]+)"/)?.[1];
            if (title) node.properties["data-title"] = title;
          },
        },
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
