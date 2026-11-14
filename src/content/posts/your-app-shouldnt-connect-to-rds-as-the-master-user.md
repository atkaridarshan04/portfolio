---
title: "Your App Shouldn't Connect to RDS as the Master User"
deck: "A Proper Credential Pattern on EKS"
description: "Most apps on EKS connect to RDS with either the master credential or a single shared password that's been copy-pasted into every service's config and never rotated. Both mean the…"
date: 2026-10-26
tags: ["AWS", "EKS", "Postgres", "Terraform", "DevOps", "Security"]
repo: "https://github.com/atkaridarshan04/eks-rds-credential-patterns"
source: "Tech/LinkedIn Posts/AWS/Your App Shouldn't Connect to RDS as the Master User - A Proper Credential Pattern on EKS.md"
---

Most apps on EKS connect to RDS with either the master credential or a single shared password that's been copy-pasted into every service's config and never rotated. Both mean the same thing in practice — a leaked secret is full database access, no scope, no blast radius boundary.

The pattern that actually holds up has a few moving parts, and the interesting ones are not the obvious choices.

𝗦𝗽𝗹𝗶𝘁 𝘁𝗵𝗲 𝗺𝗶𝗴𝗿𝗮𝘁𝗼𝗿 𝗿𝗼𝗹𝗲 𝗳𝗿𝗼𝗺 𝘁𝗵𝗲 𝗮𝗽𝗽 𝗿𝗼𝗹𝗲.
The app role gets DML only — SELECT, INSERT, UPDATE, DELETE, including future tables via `ALTER DEFAULT PRIVILEGES`. It cannot create or drop a table. A leaked app credential lets an attacker read and write rows, not restructure the schema. The migrator role owns DDL and only runs at deploy time. Most teams use the master credential for both indefinitely, which means a compromised app has the same access as the person who provisioned the database.

𝗞𝗲𝗲𝗽 𝘁𝗵𝗲 𝗽𝗹𝗮𝗶𝗻𝘁𝗲𝘅𝘁 𝗽𝗮𝘀𝘀𝘄𝗼𝗿𝗱 𝗼𝘂𝘁 𝗼𝗳 𝘁𝘄𝗼 𝗽𝗹𝗮𝗰𝗲𝘀 𝗮𝘁 𝗼𝗻𝗰𝗲.
Terraform generates the credential using an ephemeral `random_password` that can't be persisted, then writes it to Secrets Manager through a write-only argument — state holds a version number, never the value. The bootstrap Job fetches the password from Secrets Manager and computes a SCRAM-SHA-256 verifier before sending it to Postgres, so `ALTER ROLE` receives a pre-hashed verifier, never the plaintext. The password never appears in Terraform state or in Postgres logs.

𝗧𝗵𝗲 "𝗼𝗯𝘃𝗶𝗼𝘂𝘀" 𝗿𝗼𝘁𝗮𝘁𝗶𝗼𝗻 𝗮𝗽𝗽𝗿𝗼𝗮𝗰𝗵 𝗶𝘀 𝗯𝗿𝗼𝗸𝗲𝗻.
Secrets Manager has native scheduled rotation via Lambda, and that seems like the right tool. The problem is that a rotation Lambda runs its own staged `AWSPENDING → AWSCURRENT` protocol — and if Terraform also writes the same secret, a version bump mid-rotation pulls the rug out from under the Lambda's test step. Two owners of one secret don't compose safely. So Terraform stays the only writer, and "scheduled" comes from a GitHub Actions workflow that increments a counter, regenerates the rotation variable, applies, and commits both back. The committed files are the source of truth — no drift between what's in state and what's checked in.

The rest of the chain — EKS Pod Identity for IAM-scoped access (no OIDC provider, no JWT audience string to maintain), ESO to mirror the secret into a Kubernetes Secret, Reloader to restart annotated workloads when it changes — is what gets a rotated credential into a running pod with no manual step.

Put together a full reference implementation of this — Terraform modules, bootstrap Job, the rotation workflow — if anyone wants to see it end to end: https://github.com/atkaridarshan04/eks-rds-credential-patterns

How are others handling RDS credentials on EKS — still on the master credential, or something more scoped?

![rds credential pattern eks architecture](/writing/your-app-shouldnt-connect-to-rds-as-the-master-user/rds-credential-pattern-eks-architecture.png)
