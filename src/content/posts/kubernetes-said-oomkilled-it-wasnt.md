---
title: "Kubernetes Said OOMKilled. It Wasn't."
deck: "Debugging a Disk-Pressure Eviction on EKS"
description: "Kubernetes told us a pod was OOMKilled. It wasn't."
date: 2026-09-30
tags: ["Kubernetes", "EKS", "DevOps", "SRE"]
source: "Tech/LinkedIn Posts/Kubernetes/Kubernetes Said OOMKilled. It Wasn't. - Debugging a Disk-Pressure Eviction on EKS.md"
---

Kubernetes told us a pod was OOMKilled. It wasn't.

OOMKilled isn't a vague error, it's a specific claim: the container exceeded its memory limit and got killed for it. So the natural first move is to check memory — usage graphs, limits, anything unusual. We did. Everything was clean. No spike, no OOM counter increment, nothing.

The actual signal was sitting on a dashboard we already had, just not the one anyone thought to check first: disk. The node's root volume was climbing toward kubelet's image garbage-collection threshold. Once it crossed that, image GC couldn't free space fast enough, and kubelet's eviction manager stepped in and started killing pods to reclaim disk — not the kernel's OOM killer, a completely different mechanism that happens to also produce a dead container.

One detail in kubelet's own logs settled it: a real memory-cgroup OOM kill is instant, zero grace period, no exception. This kill had a 30-second grace period. That's not what an OOM kill looks like. That's what kubelet clearing disk space looks like.

It wasn't a one-off either. It kept happening on new deployments specifically, which makes sense once you see the mechanism: every rollout pulls a fresh image onto the node before the old pod is removed, adding more layers to a disk that was already sitting close to the threshold from every previous deploy. Disk climbs a little each time until one rollout tips it over.

The fix wasn't really about memory at all: slim the images, give the node more disk headroom to begin with, and give the pods actual resource requests instead of running BestEffort — which, it turns out, puts them first in line for eviction under any kind of pressure, not just this one.

A status label is a claim, not a conclusion. It's worth checking against the actual evidence before you trust it, especially when the fix it's pointing you toward doesn't touch the thing that's actually wrong.

Anyone else had a pod's reported failure reason turn out to be a completely different subsystem underneath?

![kubernetes oomkilled disk pressure](/writing/kubernetes-said-oomkilled-it-wasnt/kubernetes-oomkilled-disk-pressure.png)
