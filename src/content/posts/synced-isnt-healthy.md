---
title: "Synced Isn't Healthy"
deck: "Gating GitOps Promotions with Kargo and ArgoCD"
description: "Why ArgoCD's Synced is not a promotion gate, and how a Kargo Warehouse, Freight and Stage chain makes staging wait for a dev build that actually came up Healthy."
date: 2026-10-03
updated: 2026-11-14
tags: ["GitOps", "ArgoCD", "Kargo", "Kubernetes", "DevOps"]
repo: "https://github.com/atkaridarshan04/cloudnative-devops-blueprint/blob/main/docs/Kargo.md"
files: ["kargo/warehouse.yml", "kargo/stage-dev.yml", "kargo/stage-staging.yml", "kargo/stage-prod.yml", "kargo/project-config.yml", "kargo/promotion-task.yml", "argocd/application-dev.yml", "docs/Kargo.md"]
---

The fastest way to ship to Kubernetes is to let CI run `helm upgrade` right after the build finishes. It's also the easiest way to lose track of what's actually running where.

## The problem: the check nobody was enforcing

That's how a lot of pipelines are wired: build, scan, push the image, then the same job applies it straight to the cluster — dev, staging, prod, one after another, no boundary in between. It holds up fine most weeks. It's release week where it breaks: a feature has to land before the sprint closes, dev's build finishes late in the day, and nobody has the time to sit and watch it come back up healthy before the next job fires off staging right behind it. "Check dev first" was never something the pipeline enforced — it was whoever happened to be watching that day, and deadline week is exactly when no one is.

The tempting fix is an approval step in that same pipeline. It doesn't fix the actual problem, which is that CI holds cluster credentials and the ordering between environments lives in a person's head. What I did instead was take deployment out of CI's hands completely. CI's job ends at pushing a tag to the registry.[^1] A separate system — Kargo — watches the registry and turns every promotion into a pull request: it bumps the version wherever that environment's config lives (a kustomize overlay here, a Helm values file in another repo, whatever), opens a real PR, and ArgoCD is the only thing left holding cluster credentials, syncing off git like it would for any other commit.

## Why "synced" and "healthy" are different answers

ArgoCD reconciles whatever is in git into the cluster. That is its whole job, and it does it well. What it deliberately does not do is decide what should be in git next for each environment. Someone still has to answer "is this build ready to go from dev to staging," and in a CI-drives-everything setup the answer is implicitly "yes, immediately."

The reason that's wrong comes down to two statuses ArgoCD reports separately. `Synced` means the cluster matches git: the Deployment manifest with the new tag was applied. `Healthy` means the workload actually came up: the rollout finished, the pods are ready. A commit that bumps an image tag will go `Synced` almost instantly. Whether it ever goes `Healthy` is a different question with a different answer, and the gap between those two is exactly where a bad build lives. If the next environment's trigger is "dev was applied," a build that applied and then crashlooped is already on its way to staging.

Kargo's model makes "healthy upstream" the thing the next environment literally requests. Five objects do the work:

- A **Warehouse** watches artifact sources — container image tags here — and produces **Freight** whenever something new shows up.
- **Freight** is an immutable snapshot of a specific set of versions. It's generated, never hand-written, and it is the thing that moves through the pipeline.
- A **Stage** is one environment. It declares where its Freight is allowed to come from (`requestedFreight`) and the steps to run when eligible Freight appears.
- A **Promotion** is one concrete instance of "move this Freight into this Stage, run its steps." A **PromotionTask** is a reusable bundle of those steps so three Stages don't each repeat them.

The ordering isn't an explicit list anywhere. `dev` has `sources.direct: true`, so it takes any Freight the Warehouse produces, immediately. `staging` has `sources.stages: [dev]`, which means it will only request Freight that has already been promoted into `dev` and verified there. `prod` chains off `staging` the same way. That chain is the entire enforcement of "nothing reaches prod without going through staging first" — there's no place to skip ahead, because `prod` never sees Freight that `staging` hasn't verified.

And "verified" is where ArgoCD's health status comes back in. The last step of the promotion is `argocd-update`, and it does more than force a sync: it registers the health check Kargo waits on before it marks that Freight verified in that Stage. Without it, a Promotion could report success the instant the commit was pushed, and the "only promote what's verified" premise would be fake. With it, dev counts as "through" only once ArgoCD says the app is Healthy, not Synced.

> [!note] Two different gates, two different questions
> `autoPromotionEnabled` in the `ProjectConfig` controls whether a Promotion *starts* on its own when eligible Freight shows up. The PR step inside the PromotionTask controls whether a *running* Promotion is allowed to finish. dev and staging auto-start; prod doesn't. All three still need a merged PR before ArgoCD sees anything.

## The design, from the repo

Everything below is from [cloudnative-devops-blueprint](https://github.com/atkaridarshan04/cloudnative-devops-blueprint), where the app is a small book store with a frontend and backend image, deployed through three kustomize overlays — `kustomize/overlays/{dev,staging,prod}` — each watched by its own ArgoCD `Application` and synced into its own namespace.

The Warehouse subscribes to both image repos. The `>=1.0.0` constraint means it resolves to the semantically greatest tag on every reconcile:

```yaml title="kargo/warehouse.yml"
apiVersion: kargo.akuity.io/v1alpha1
kind: Warehouse
metadata:
  name: book-store
  namespace: book-store
spec:
  subscriptions:
    - image:
        repoURL: ghcr.io/atkaridarshan04/cloudnative-devops-blueprint/bookstore-frontend
        constraint: ">=1.0.0"
    - image:
        repoURL: ghcr.io/atkaridarshan04/cloudnative-devops-blueprint/bookstore-backend
        constraint: ">=1.0.0"
```

The staging Stage is where the dependency on dev is written down. Compare `sources.stages: [dev]` here with `sources.direct: true` in `stage-dev.yml`; that one line is the difference between "take anything new" and "take only what dev has already verified":

```yaml title="kargo/stage-staging.yml"
spec:
  requestedFreight:
    - origin:
        kind: Warehouse
        name: book-store
      sources:
        stages:
          - dev

  promotionTemplate:
    spec:
      vars:
        - name: overlayPath
          value: kustomize/overlays/staging
        - name: appName
          value: book-store-staging
        - name: branch
          value: main
      steps:
        - task:
            name: promote-overlay
          as: promote
```

Auto-promotion is off by default. Without this `ProjectConfig`, Freight just sits there "available" and nothing ever creates a Promotion for it, even for dev. Prod is the one Stage left off on purpose:

```yaml title="kargo/project-config.yml"
spec:
  promotionPolicies:
    - stageSelector:
        name: dev
      autoPromotionEnabled: true
    - stageSelector:
        name: staging
      autoPromotionEnabled: true
    - stageSelector:
        name: prod
      autoPromotionEnabled: false
```

All three Stages share one `PromotionTask`. It clones the repo, runs `kustomize-set-image` against the Stage's overlay path, commits, pushes to a generated branch instead of straight to `main`, opens a PR into `main`, blocks until that PR is merged (a PR closed without merging fails the Promotion), then runs `argocd-update`:

```yaml title="kargo/promotion-task.yml"
    - uses: git-push
      as: push
      config:
        path: ./repo
        generateTargetBranch: true

    - uses: git-open-pr
      as: open-pr
      config:
        repoURL: ${{ vars.repoURL }}
        provider: github
        sourceBranch: ${{ task.outputs.push.branch }}
        targetBranch: ${{ vars.branch }}
        # ... title and description, templated from the Freight

    - uses: git-wait-for-pr
      as: wait-for-pr
      if: ${{ status('open-pr') != 'Skipped' }}
      config:
        repoURL: ${{ vars.repoURL }}
        provider: github
        prNumber: ${{ task.outputs['open-pr'].pr.id }}

    - uses: argocd-update
      as: sync
      config:
        apps:
          - name: ${{ vars.appName }}
```

The `if:` guard on `git-wait-for-pr` exists because of a real failure mode. When Freight is re-promoted to a Stage already at that exact state, `kustomize-set-image` has nothing to change, `git-commit` and `git-open-pr` both report `Skipped`, and without the guard `wait-for-pr` would try to read a PR id that was never created and error with `cannot fetch id from <nil>`.

The ArgoCD side needs one annotation per `Application`. Without it, Kargo refuses to manage the Application at all, so no Stage can touch an app it wasn't explicitly given:

```yaml title="argocd/application-dev.yml"
metadata:
  name: book-store-dev
  namespace: argocd
  annotations:
    kargo.akuity.io/authorized-stage: book-store:dev
    # ...
spec:
  project: book-store
  source:
    repoURL: https://github.com/atkaridarshan04/CloudNative-DevOps-Blueprint.git
    targetRevision: main
    path: kustomize/overlays/dev
  # ... destination
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

> [!tip] Why keep argocd-update when selfHeal is already on
> These Applications would eventually notice the merged commit and sync on their own. The explicit step forces the sync now instead of waiting on ArgoCD's poll interval, and, more importantly, it's what ties the Stage's verification to the Application's health. Dropping it to "simplify" quietly removes the gate.

One thing worth being honest about: the overlays in this repo were originally a kustomize demo with a permanently different version per environment (`1.0.0` blue, `2.0.0` red, `3.0.0` purple). That is the opposite of Kargo's model, where the same Freight flows through all three. The resolution was to let the theme color mean "whatever was most recently promoted here" — which turned out to be a better demo, because you can watch the color change environment by environment as a build moves through.

## What a promotion looks like running

The full run in the repo goes from `1.0.0` to `3.0.0`. All three tags already existed in the registry, so widening the Warehouse constraint from an exact `1.0.0` to `>=1.0.0` made it resolve to `3.0.0` on the next reconcile and skip `2.0.0` entirely — the same thing a real registry does when a newer version shows up.

```bash
kubectl apply -f kargo/warehouse.yml
kubectl get freight -n book-store -w
```

Once Freight exists, applying the PromotionTask and the three Stages is enough for dev to start a Promotion on its own:

```bash
kubectl apply -f kargo/promotion-task.yml
kubectl apply -f kargo/stage-dev.yml
kubectl apply -f kargo/stage-staging.yml
kubectl apply -f kargo/stage-prod.yml
kubectl get promotions -n book-store -w
```

This is the watch from the first, pinned run, where nothing had to change in git; only the empty `SHARD` column is trimmed. Each Promotion finishes in seconds because the PR steps skipped themselves, and staging's Promotion only appears after dev's reaches `Succeeded`. Prod starts on its own here because this capture predates the prod policy; with today's `autoPromotionEnabled: false` the watch stops at staging until someone promotes from the dashboard:

```text
NAME                                       STAGE     FREIGHT                                    PHASE       AGE
dev.01ky6nk6js60acxrtps1mdnxyj.7575b14     dev       7575b14a286595a77ad6e0db8cf6fdfcd46265c7   Running     2s
dev.01ky6nk6js60acxrtps1mdnxyj.7575b14     dev       7575b14a286595a77ad6e0db8cf6fdfcd46265c7   Running     9s
dev.01ky6nk6js60acxrtps1mdnxyj.7575b14     dev       7575b14a286595a77ad6e0db8cf6fdfcd46265c7   Succeeded   10s
staging.01ky6nkgc9se61bn1ycpp3gcn5.7575b14 staging   7575b14a286595a77ad6e0db8cf6fdfcd46265c7               0s
staging.01ky6nkgc9se61bn1ycpp3gcn5.7575b14 staging   7575b14a286595a77ad6e0db8cf6fdfcd46265c7   Pending     0s
staging.01ky6nkgc9se61bn1ycpp3gcn5.7575b14 staging   7575b14a286595a77ad6e0db8cf6fdfcd46265c7   Running     0s
staging.01ky6nkgc9se61bn1ycpp3gcn5.7575b14 staging   7575b14a286595a77ad6e0db8cf6fdfcd46265c7   Running     8s
staging.01ky6nkgc9se61bn1ycpp3gcn5.7575b14 staging   7575b14a286595a77ad6e0db8cf6fdfcd46265c7   Succeeded   9s
prod.01ky6nm6fnqm168evy0pqab97j.7575b14    prod      7575b14a286595a77ad6e0db8cf6fdfcd46265c7               0s
prod.01ky6nm6fnqm168evy0pqab97j.7575b14    prod      7575b14a286595a77ad6e0db8cf6fdfcd46265c7   Pending     0s
prod.01ky6nm6fnqm168evy0pqab97j.7575b14    prod      7575b14a286595a77ad6e0db8cf6fdfcd46265c7   Running     0s
prod.01ky6nm6fnqm168evy0pqab97j.7575b14    prod      7575b14a286595a77ad6e0db8cf6fdfcd46265c7   Running     8s
prod.01ky6nm6fnqm168evy0pqab97j.7575b14    prod      7575b14a286595a77ad6e0db8cf6fdfcd46265c7   Succeeded   9s
```

The run with a real diff is the interesting one. dev starts immediately, `git-open-pr` opens a PR titled `chore(dev): bump frontend to 3.0.0, backend to 3.0.0`, and the Promotion parks on `git-wait-for-pr` in `Running`. The PR diff is exactly two `newTag` lines in `kustomize/overlays/dev/kustomization.yml`, and the PR body states the Stage, the Freight name and both tags, so the reviewer is looking at the promotion itself rather than reconstructing it from a commit message. Merging unblocks the step, `argocd-update` runs, `book-store-dev` goes Healthy, and only then does staging become eligible and open its own PR with the same two-line diff against its own overlay.

Prod never starts on its own. It has to be triggered from the Kargo dashboard (Freight, then Promote), and it goes through the same open-PR, wait, merge, verify sequence. The end state is all three Stages on the same Freight:

![Kargo project view after the full run: the Warehouse feeding dev, staging and prod in a chain, all three Stages Ready and Healthy on the 3.0.0 Freight.](/writing/synced-isnt-healthy/kargo-ui-promotion-pipeline-overview.png)

> [!warning] The git credential is the thing that fails first
> `git-push` goes over HTTPS, and anonymous HTTPS can't authenticate a push. Without a Secret in the Project's namespace labelled `kargo.akuity.io/cred-type: git` whose `repoURL` matches the repo, the Stage fails at `promote::step-4` with `could not read Username for 'https://github.com'`. Create that before the Stages, not after.

## Takeaways

- `Synced` is a statement about git and the cluster agreeing. `Healthy` is a statement about the workload. A promotion gate built on the first one promotes broken builds.
- Make the dependency a property of the environment, not a step in a pipeline. `sources.stages: [dev]` on the staging Stage can't be skipped on a busy day because there is no other way for staging to get Freight.
- Keep CI out of the cluster. Ending CI at "push a tag" means one system holds cluster credentials, and every change to a running environment is a merged PR you can read later.
- Separate "may this start" from "may this finish." Auto-start for dev and staging keeps the loop fast; the PR gate on all three keeps a human in it; manual start for prod means the customer-facing environment never moves without someone deciding it's time.
- Guard the steps that can legitimately skip. A re-promotion with no diff is normal, and a task that errors on it will train people to ignore failures.

[^1]: Ending CI at the registry also makes the image the thing to trust, which is its own problem — see [Trust the Pipeline, Not the Tag](/writing/trust-the-pipeline-not-the-tag/) for signing and verifying it at admission.
