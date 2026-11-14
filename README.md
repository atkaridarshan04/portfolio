# Darshan Atkari Portfolio

- [Portfolio](https://atkaridarshan.online)
- [GitHub](https://github.com/atkaridarshan04)
- [LinkedIn](https://linkedin.com/in/darshan-atkari)

## Stack

Astro renders the site to static HTML. The home page is the React portfolio (`src/components/portfolio`), server-rendered and hydrated as one island; the field notes under `/writing` are Markdown pages built from a content collection. Tailwind v4 carries the look, defined in `src/styles.css`. Every push to `main` builds and deploys to Cloudflare Pages.

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
npm run lint
```

## Field notes

Posts live in `src/content/posts/*.md`. The file name is the URL slug, and the frontmatter is checked against the schema in `src/content.config.ts`:

```yaml
---
title: "Kubernetes Said OOMKilled. It Wasn't."
deck: "Debugging a Disk-Pressure Eviction on EKS"   # optional subtitle
description: "One-paragraph summary used for previews and the feed."
date: 2026-09-30
updated: 2026-10-02                                   # optional
tags: ["Kubernetes", "EKS", "SRE"]
repo: https://github.com/atkaridarshan04/...          # optional
linkedin: https://www.linkedin.com/feed/update/...    # optional
draft: true                                           # shown in dev only
---
```

Images referenced from a post go under `public/writing/<slug>/` and are linked as `/writing/<slug>/name.png`.

### Writing in Obsidian

Notes are drafted in the vault and pulled in with:

```bash
npm run sync:posts            # VAULT_DIR or --vault override the vault path
npm run sync:posts -- --dry-run
```

Every note under `Tech/LinkedIn Posts` tagged `LinkedIn` is a post; any other note becomes one with `Publish: true` in its frontmatter, and `Publish: false` opts out. Optional frontmatter: `Slug`, `Title`, `Description`, `Repo`, `Updated`, `Draft`. The note name is the title, with anything after ` - ` used as the deck; image embeds are copied across, wikilinks become plain text or a link to another published note, and the trailing hashtag line becomes tags. A note that mentions an internal name is written as a draft and reported, so check the output before committing.
