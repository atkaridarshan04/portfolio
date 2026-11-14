---
title: "Synced Isn't Healthy"
deck: "Gating GitOps Promotions with Kargo and ArgoCD"
description: "The fastest way to ship to Kubernetes is to let CI run helm upgrade right after the build finishes. It's also the easiest way to lose track of what's actually running where."
date: 2026-10-03
tags: ["GitOps", "ArgoCD", "Kargo", "Kubernetes", "DevOps"]
repo: "https://github.com/atkaridarshan04/cloudnative-devops-blueprint/blob/main/docs/Kargo.md"
source: "Tech/LinkedIn Posts/CI-CD & GitOps/Synced Isn't Healthy - Gating GitOps Promotions with Kargo and ArgoCD.md"
---

The fastest way to ship to Kubernetes is to let CI run `helm upgrade` right after the build finishes. It's also the easiest way to lose track of what's actually running where.

That's how a lot of pipelines are wired: build, scan, push the image, then the same job applies it straight to the cluster — dev, staging, prod, one after another, no boundary in between. It holds up fine most weeks. It's release week where it breaks: a feature has to land before the sprint closes, dev's build finishes late in the day, and nobody has the time to sit and watch it come back up healthy before the next job fires off staging right behind it. "Check dev first" was never something the pipeline enforced — it was just whoever happened to be watching that day, and deadline week is exactly when no one is.

The fix wasn't adding an approval step to that same pipeline — it was taking deployment out of CI's hands completely. CI's job now ends at pushing a tag to the registry, nothing past that. A separate system — Kargo, here — watches the registry and turns every promotion into a PR instead of a live apply: it bumps the version wherever that environment's config actually lives — a kustomize overlay, a Helm values file, whatever the repo uses — opens a real pull request, and ArgoCD is the only thing left holding cluster credentials, syncing off git like any other change would.

Dev and staging both pick up a new build and open that PR on their own, but staging only ever requests the build that already went through dev — and dev only counts as "through" once ArgoCD reports it Healthy, not just Synced, so a build that applied but came back up broken never becomes available to promote further. Prod is the one exception on purpose: nothing there auto-opens, promotion has to be triggered manually, so the environment customers actually see never moves without someone deciding it's time. Together that's a clear, standing answer to "what's running where, and who decided to put it there" — not something you reconstruct from kubectl history after the fact.

Put together a working version of this promotion pipeline — Warehouse, Stage, Freight, the PromotionTask that opens the PR — if anyone wants to see it end to end: https://github.com/atkaridarshan04/cloudnative-devops-blueprint/blob/main/docs/Kargo.md

Anyone else moved off deploying straight from CI to a gated promotion model — what finally pushed you to make the switch?

![kargo ui promotion pipeline overview](/writing/synced-isnt-healthy/kargo-ui-promotion-pipeline-overview.png)
