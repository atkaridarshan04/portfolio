---
title: "When Multi-AZ Node Groups Meet StatefulSets"
deck: "A Real EKS Scheduling Conflict"
description: "A multi-AZ node group looks like pure upside: spread compute across three Availability Zones and a single zone going down barely touches you. Put a StatefulSet on it, and the same…"
date: 2026-09-30
tags: ["Kubernetes", "EKS", "AWS", "SRE", "DevOps"]
source: "Tech/LinkedIn Posts/Kubernetes/When Multi-AZ Node Groups Meet StatefulSets - A Real EKS Scheduling Conflict.md"
---

A multi-AZ node group looks like pure upside: spread compute across three Availability Zones and a single zone going down barely touches you. Put a StatefulSet on it, and the same setup can start working against you.

The part that's easy to miss: an EBS volume, the storage behind a PVC, is bound to a single Availability Zone, not the region — it can only attach to a node inside that exact zone. The node group's Auto Scaling Group spans every zone you gave it. Compute is regional, the volume isn't, and nothing reconciles that gap for you.

The first time a StatefulSet pod claims its volume, that volume gets created in whichever zone the pod happened to land in, and it stays pinned there. Later, when that pod needs to move — a node cycling out, a drain, a scale event — the scheduler needs a node in that same zone again. With one Auto Scaling Group spread across every zone, there's no guarantee the next available node is in the right one.

I ran into a version of this running Vault in HA on a 3-node group split across two zones. A routine node cycle flipped which zone held two nodes and which held one. Vault needs one pod per node for HA, and with exactly 3 nodes for 3 pods there was no spare capacity to absorb the shift. Two pods rescheduled fine. The third couldn't — the one node with room conflicted with pod anti-affinity, the other two were the wrong zone for its volume. All three nodes ruled out, for three different reasons.

The fix, once you see the pattern: split the node group by zone, one Auto Scaling Group per Availability Zone instead of one spanning all of them, with Cluster Autoscaler's `--balance-similar-node-groups` turned on so the per-AZ groups stay roughly even instead of one zone quietly drifting ahead of the others. That way a scale-up always lands where the volume actually is.

The instinct to spread everything across zones for resilience is right almost everywhere. A zone-locked volume is the one place it quietly works against you instead.

Has anyone else run into this with StatefulSets on EKS, curious how others have structured around it.

Read more in AWS's docs: https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html

![multi az node group statefulset conflict](/writing/when-multi-az-node-groups-meet-statefulsets/multi-az-node-group-statefulset-conflict.png)
