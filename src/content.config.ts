import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/* One collection: the field notes. Files land in src/content/posts, either
   written by hand or pulled out of the Obsidian vault by scripts/sync-posts.mjs,
   and the file name is the URL slug. */
const posts = defineCollection({
  loader: glob({ base: "./src/content/posts", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    /* the subtitle after the dash in the note's name, when there is one */
    deck: z.string().optional(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    /* the repository or doc the note came out of, and the files it cites */
    repo: z.string().url().optional(),
    files: z.array(z.string()).default([]),
    /* where the discussion happened, if it was posted */
    linkedin: z.string().url().optional(),
    /* drafts build in dev and are left out of the production site */
    draft: z.boolean().default(false),
    /* vault-relative path of the note this was synced from */
    source: z.string().optional(),
  }),
});

export const collections = { posts };
