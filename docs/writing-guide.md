# Writing guide

How a field note is written so the site renders it well. The short version of a note is the LinkedIn teaser; the long version lives here.

## Frontmatter

```yaml
---
title: "Synced Isn't Healthy"
deck: "Gating GitOps Promotions with Kargo and ArgoCD"   # subtitle, optional
description: "One or two sentences for previews and the feed, under 180 characters."
date: 2026-10-03            # first published
updated: 2026-11-14         # optional, when the long version landed
tags: ["GitOps", "ArgoCD", "Kargo", "Kubernetes"]
repo: https://github.com/atkaridarshan04/cloudnative-devops-blueprint   # optional
files: ["kargo/stages.yaml", "docs/Kargo.md"]                           # optional, repo-relative
linkedin: https://www.linkedin.com/feed/update/...                      # optional
draft: false
---
```

A post synced from the vault carries a `source:` line. Remove it once the post is expanded by hand: the sync script then leaves the file alone and the vault note stays the teaser.

## Shape

Between 1,200 and 2,000 words. The opening paragraph is the hook from the short note. Then H2 sections, four to six of them, in roughly this arc: what was seen or the problem, the mechanism with the precise technical detail, the fix or the design with real code from the repository, what it looks like running, and three to five takeaways. Incident write-ups and design write-ups weight these differently; skip a section rather than pad it.

Mechanism before advice. First person, direct, specific. No "in this post I will", no emoji, no closing question to the audience. Facts come from the repository or the notes, never from memory; anything unverified gets an HTML comment `<!-- TODO: verify ... -->` so it is found before publishing. No employer or client names, hostnames, account ids or anything that reads as one company's environment: "a nonprod EKS cluster" is enough.

## Syntax the site renders

- **Headings**: `##` and `###` only. They get anchors and feed the table of contents.
- **Code from a file**: fence with the language and a title, and keep excerpts short, 5 to 25 lines.

  ````markdown
  ```yaml title="kyverno/verify-images.yaml"
  apiVersion: kyverno.io/v1
  ```
  ````

- **Commands and output**: `bash` for the command, a separate `text` block for the output.
- **Callouts**: a quote whose first line is `[!note] Title`, `[!tip] Title` or `[!warning] Title`.

  ```markdown
  > [!warning] Grace period is the tell
  > A real memory-cgroup OOM kill is instant. This one had thirty seconds.
  ```

- **Figures**: an image on its own line; the alt text is the caption. Images live under `public/writing/<slug>/`.

  ```markdown
  ![Kargo's promotion pipeline, dev waiting on health before staging opens](/writing/synced-isnt-healthy/kargo-ui-promotion-pipeline-overview.png)
  ```

- **Links**: full GitHub URLs for the repository; `/writing/<slug>/` for another note.
- **Footnotes**: `[^1]` with the definition at the end.
- **Tables**: GitHub-style pipes.
