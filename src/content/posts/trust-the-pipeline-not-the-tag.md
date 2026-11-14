---
title: "Trust the Pipeline, Not the Tag"
deck: "Enforcing Image Provenance with Sigstore and Kyverno"
description: "An image tag tells Kubernetes what to pull. It says nothing about who built the thing being pulled."
date: 2026-10-03
tags: ["Sigstore", "Kyverno", "Supply Chain Security", "Kubernetes", "DevOps"]
repo: "https://github.com/atkaridarshan04/cloudnative-devops-blueprint/blob/main/docs/GitHubActions.md"
source: "Tech/LinkedIn Posts/Kubernetes/Trust the Pipeline, Not the Tag - Enforcing Image Provenance with Sigstore and Kyverno.md"
---

An image tag tells Kubernetes what to pull. It says nothing about who built the thing being pulled.

Most pipelines treat that as enough: build it, scan it for CVEs, push it, and from then on the cluster trusts anything carrying that tag. The scan tells you what's inside the image. It never tells you whether what's actually running under that tag is still the thing the pipeline produced — nothing stops a quick local `docker build` and a push straight to that same tag to test a hotfix under pressure, or a stale image getting re-pushed by mistake. Kubernetes has no opinion either way. It pulls whatever that tag currently points to and runs it.

Closing that gap means answering a different question at build time — not "does this have vulnerabilities" but "can I prove this exact artifact came from this exact pipeline run." Sigstore does that with short-lived, identity-bound certificates instead of a long-lived key: GitHub Actions mints an OIDC token asserting this exact workflow is running right now, Fulcio exchanges it for a certificate valid for about 10 minutes, and cosign uses it to sign the image's digest. Rekor logs that signing event publicly while the cert is still valid, so even after the certificate expires, a check run months later can still confirm the signature was genuine at the moment it was made.

Signing on its own is still just paperwork until something checks it before a Pod runs. Kyverno's `verifyImages` sits in the same admission path already enforcing tag and label rules, and adds one more check: before it admits a Pod, it pulls the attached signature, confirms it chains back to Sigstore's root of trust, and compares the certificate's identity against one specific expected workflow — not "is this signed by somebody," but "is this signed by this exact repo, this exact pipeline." A perfectly valid signature from anywhere else still gets denied.

Trusting the pipeline that builds your images is the easy part — most teams already do, implicitly. What's usually missing is making the cluster itself check that trust at the one point it can't be skipped, instead of everyone just assuming whatever's running came from where it was supposed to.

Put together the full signing + SBOM + verification walkthrough end to end, signed and unsigned cases both tested against the policy: https://github.com/atkaridarshan04/cloudnative-devops-blueprint/blob/main/docs/GitHubActions.md

Anyone else enforcing image provenance at admission, or is CVE scanning before deploy still where most pipelines stop?

![unsigned test failure](/writing/trust-the-pipeline-not-the-tag/unsigned-test-failure.png)
