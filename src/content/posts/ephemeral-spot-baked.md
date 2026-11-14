---
title: "Ephemeral, Spot, Baked"
deck: "Self-Hosted GitHub Actions Runners on AWS That Actually Make Sense"
description: "GitHub-hosted runners are easy to start with. They're also quietly expensive once you're past the free tier, and they have a queueing problem nobody talks about until it hits:…"
date: 2026-10-26
tags: ["GitHub Actions", "AWS", "Terraform", "CI/CD", "DevOps"]
repo: "https://github.com/atkaridarshan04/aws-github-runners"
source: "Tech/LinkedIn Posts/CI-CD & GitOps/Ephemeral, Spot, Baked - Self-Hosted GitHub Actions Runners on AWS That Actually Make Sense.md"
---

GitHub-hosted runners are easy to start with. They're also quietly expensive once you're past the free tier, and they have a queueing problem nobody talks about until it hits: push during a spike in traffic and your job sits waiting for a shared runner that isn't yours.

The obvious answer is self-hosted runners. The less obvious part is that "self-hosted" done naively just trades one problem for another — now you have a long-running EC2 instance sitting idle between jobs, whatever it installed for job #1 still present for job #47, and an always-on cost that doesn't go away when nothing's building.

The community-maintained *github-aws-runners/terraform-aws-github-runner*  module handles the heavy lifting here, but the decisions behind how you configure it are what actually determine whether it's cheaper and faster or just more infrastructure to maintain. Three of them compound.

𝗘𝗽𝗵𝗲𝗺𝗲𝗿𝗮𝗹 𝗼𝘃𝗲𝗿 𝗽𝗲𝗿𝘀𝗶𝘀𝘁𝗲𝗻𝘁.
Each runner is launched fresh for exactly one job — registers with GitHub, runs the job, deregisters, and terminates. Nothing survives between jobs. No idle fleet, no state accumulation, and you only pay for the minutes a job actually runs.

𝗦𝗽𝗼𝘁 𝗼𝘃𝗲𝗿 𝗼𝗻-𝗱𝗲𝗺𝗮𝗻𝗱.
Spot interruptions are normally risky because you lose a long-running process. An ephemeral runner flips that — it's already supposed to die when the job finishes. A Spot interruption just means one job retries on a fresh instance. There's no long-lived process to lose. That makes ephemeral CI the textbook-ideal Spot workload: short-lived, stateless, retry-safe — and routinely ~70% cheaper than on-demand.

𝗕𝗮𝗸𝗲𝗱 𝗔𝗠𝗜 𝗼𝘃𝗲𝗿 𝗯𝗼𝗼𝘁𝘀𝘁𝗿𝗮𝗽 𝘀𝗰𝗿𝗶𝗽𝘁.
The upstream module's own documentation puts it plainly: downloading the runner binary without a prebuilt AMI "can occasionally take more than 10 minutes." Every job waiting on a cold install is a job that shouldn't be. Packer bakes Docker, the runner binary, and your tools into the image ahead of time. What's left at boot is just EC2 launch time plus the registration handshake — seconds, not minutes — and every runner starts from an identical known-good environment.

The actual pipeline is: developer pushes → GitHub App webhook fires → API Gateway → webhook Lambda validates the signature → scale-up Lambda launches a Spot instance from the custom AMI → runner boots, registers, picks up the job, finishes, and self-terminates. Five components, each with one job, none of them doing more than that.

Put together a full Terraform + Packer blueprint for this if anyone wants to see it wired up end to end: https://github.com/atkaridarshan04/aws-github-runners

Anyone running self-hosted runners — ephemeral or persistent, and what finally pushed the decision?

![self hosted github runners aws overview](/writing/ephemeral-spot-baked/self-hosted-github-runners-aws-overview.png)
