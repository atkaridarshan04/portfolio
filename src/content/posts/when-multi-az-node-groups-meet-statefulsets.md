---
title: "When Multi-AZ Node Groups Meet StatefulSets"
deck: "A Real EKS Scheduling Conflict"
description: "A node cycle flipped a two-zone split under Vault HA and left one pod unschedulable: anti-affinity ruled out one node, its EBS volume's zone ruled out the other two."
date: 2026-09-30
updated: 2026-11-15
tags: ["Kubernetes", "EKS", "AWS", "SRE", "DevOps"]
---

A multi-AZ node group looks like pure upside: spread compute across every Availability Zone the VPC has and a single zone going down barely touches you. Put a StatefulSet on it, and the same setup can start working against you.

The part that's easy to miss: an EBS volume, the storage behind a PVC, is bound to a single Availability Zone, not the region — it can only attach to a node inside that exact zone. The node group's Auto Scaling group spans every zone you gave it. Compute is regional, the volume isn't, and nothing reconciles that gap for you.

![One Auto Scaling group spanning the zones, an EBS volume that can only attach in the zone it was created in, and the three-node Vault layout before and after the cycle that left the third pod with nowhere to go.](/writing/when-multi-az-node-groups-meet-statefulsets/multi-az-node-group-statefulset-conflict.png)

## What we saw after the node cycle

Vault runs in HA mode on an EKS cluster: three replicas, with pod anti-affinity so that no two Vault pods share a node. It lives on the cluster's primary node group, `t3.xlarge` instances, and at the time the group had exactly three nodes spread across two Availability Zones. Three nodes for three pods, one each. No spare capacity beyond what Vault needed one-for-one.

Before the cycle the layout was two nodes in AZ-A and one in AZ-B. Then the Auto Scaling group replaced a node — a routine, autoscaling-driven replacement, nothing anyone kicked off — and afterwards it was two nodes in AZ-B and one in AZ-A. The split had flipped.

Two of the three Vault pods rescheduled without fuss. The third sat in `Pending` with this:

```text
FailedScheduling
0/3 nodes are available: 1 node(s) didn't match pod anti-affinity rules, 2 node(s) didn't match PersistentVolume's node affinity.
no new claims to deallocate, preemption: 0/3 nodes are available: 1 No preemption victims found for incoming pod, 2 Preemption is not helpful for scheduling.
```

The first line is arithmetic. One node excluded by anti-affinity, two excluded by the volume's node affinity, and one plus two is every node in the group. The second line is the scheduler reporting that it tried evicting its way out and found nothing worth evicting. Nothing in that message is about CPU or memory; every node was ruled out by a placement rule before resources came into it.

## Two rules the scheduler can't both satisfy

Each of the two rules in that message is reasonable on its own. The incident is what happens when both are hard requirements and the node layout underneath them changes.

The first is pod anti-affinity. The [Kubernetes docs](https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/#inter-pod-affinity-and-anti-affinity) describe affinity as "this Pod should (or, in the case of anti-affinity, should not) run in an X if that X is already running one or more Pods that meet rule Y", where X is a topology domain picked by `topologyKey`. For an HA Vault, X is the node and Y is "another Vault pod", which is how you get one replica per node. Under the `requiredDuringSchedulingIgnoredDuringExecution` form that is a hard constraint, the same shape as required node affinity, where the docs are blunt that the scheduler can't schedule the pod unless the rule is met — and it is checked at scheduling time, which is exactly when a replaced node forces a pod to be placed again.

The second is the PersistentVolume's node affinity. Per the [docs](https://kubernetes.io/docs/concepts/storage/persistent-volumes/#node-affinity), a PV "can specify node affinity to define constraints that limit what nodes this volume can be accessed from", and pods using it "will only be scheduled to nodes that are selected by the node affinity." For an EBS-backed PV that constraint is a `topology.kubernetes.io/zone` match, because an EBS volume and the instance it attaches to [must be in the same Availability Zone](https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volumes.html). The zone is fixed the moment the volume is created. With a `WaitForFirstConsumer` storage class that is wherever the pod happened to land the first time; with `Immediate` binding the [storage class docs](https://kubernetes.io/docs/concepts/storage/storage-classes/#volume-binding-mode) say the volume is provisioned "without knowledge of the Pod's scheduling requirements" at all. Either way, the pod's zone is decided once, by whichever node was free on day one, and it never moves again.

Now put the two rules on the post-cycle layout. This pod's volume was pinned to AZ-A. There was exactly one AZ-A node left, and a different Vault pod was already on it, so anti-affinity ruled it out. The other two nodes were in AZ-B, the wrong zone for the volume, so PV affinity ruled them out. The same two rules that keep Vault HA and keep its data attached combined, on this layout, into a pod with zero valid nodes.

> [!note] Why only one pod failed
> The other Vault pod on that AZ-A node could only be there if its own volume was in AZ-A too. So after the flip there were two volumes pinned to AZ-A and one node in AZ-A. Two pods needed the same node; one got it. The one that didn't is the one in the event.

Preemption can't rescue this, and the message says so in two different ways. The scheduler's preemption logic, [per the docs](https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/#preemption), "tries to find a Node where removal of one or more Pods with lower priority than P would enable P to be scheduled on that Node" — it works one node at a time, and it only removes lower-priority pods. On the AZ-A node the only candidate was another Vault pod from the same StatefulSet, which carries the same priority, so by my reading that is the "No preemption victims found". On the two AZ-B nodes, evicting anything at all leaves the node in AZ-B, so "Preemption is not helpful for scheduling". No amount of evicting frees a second AZ-A node, and nothing in the scheduler can move a volume across zones.

## Why a node group change is what exposes it

This isn't the first time the volume's zone had to be thought about on this cluster. A while earlier Vault had been moved onto this `t3.xlarge` group from a smaller tainted `t3.medium` group it shared with CI runners. That move was planned, and the plan had the zone in it: confirm the target group already has a node in the same AZ as Vault's EBS volume, then cordon and drain the old node.

```bash
kubectl cordon <t3.medium node>
kubectl drain <t3.medium node> --ignore-daemonsets --delete-emptydir-data
```

The scheduler placed the evicted pod on a `t3.xlarge` node in the matching zone, the EBS CSI driver detached the volume from the old node and attached it to the new one, and Vault came back. "Somewhere in the new group" wasn't enough; it had to be a node in the right zone, and someone checked that before touching anything.

A planned move gets to pick its moment. An Auto Scaling group replacement doesn't. The managed node group's Auto Scaling group [spans every subnet you gave it](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html#managed-node-group-concepts), and which zone the replacement instance lands in is the group's decision, not the scheduler's. The node that cycled out took one zone's capacity with it; the node that came back added capacity to a different zone. From the group's point of view it still had three healthy nodes. From the volume's point of view, its zone had just lost a seat.

Zero slack is what turned a lopsided layout into a dead end. With three nodes for three one-per-node replicas, any rebalance that leaves a zone with fewer nodes than it has Vault volumes strands a pod. The fleet-level mechanism, zonal EBS against a regional Auto Scaling group, was already understood here; the failure mode being watched for was the volume failing to reattach. Anti-affinity was the one that actually fired, and it only fired because there was no fourth node for it to fall back on. The same no-slack node group is also where the [disk-pressure eviction](/writing/kubernetes-said-oomkilled-it-wasnt/) happened; both are reschedule-triggered failures on a group that had nothing to absorb a reschedule.

## The fix, and what it costs

AWS already documents the standard answer, on the same managed node groups page: if you run a stateful application across multiple Availability Zones backed by EBS volumes and use the Cluster Autoscaler, "you should configure multiple node groups, each scoped to a single Availability Zone", and "you should enable the `--balance-similar-node-groups` feature." One Auto Scaling group per zone means a scale-up or replacement in that group always lands in that zone, so a volume's zone is always reachable by scaling the group that owns it, and the balancing flag, per the Cluster Autoscaler's own FAQ, keeps the per-zone groups from drifting apart.

> [!warning] The per-AZ split alone doesn't close this one
> Split this cluster into one node group per zone and you get one node per zone and three HA replicas that each need their own node. That is the same zero slack with different labels. The next replacement in any zone still leaves that zone's pod with nowhere to be until the new node joins, and anti-affinity will fire again the moment two volumes end up wanting the same zone. The fix is the per-AZ split plus a fourth node of spare capacity, not the split on its own.

What that trades away is real. The single multi-AZ group was cheap and simple: one Auto Scaling group, one place to set a desired count, and zone balance for free. Per-AZ groups mean one group per zone to size and update, Cluster Autoscaler configured to balance them, and a fourth `t3.xlarge` sitting mostly idle so that one node can leave without a Vault pod losing its seat. Where that spare should live, and whether the node group is worth splitting for a workload with three volumes, hadn't been decided when I wrote this up; the problem was understood before the budget was.

## Takeaways

- An EBS-backed PV is a hard node constraint, not a storage detail. Its zone is chosen once, by wherever the pod first landed, and from then on every reschedule of that pod is a search for a node in that zone.
- Two independently sensible hard rules can leave a pod with zero nodes. Anti-affinity and PV zone affinity each did their job here; the layout underneath them is what changed.
- Preemption can't fix a topology problem. It removes lower-priority pods from one node at a time, and no eviction changes which zone a node is in or moves a volume across zones.
- A node group with no slack turns every routine replacement into a scheduling event. Three nodes for three one-per-node replicas meant a zone rebalance was enough.
- AWS's per-AZ node group guidance is the right shape, but it answers "which zone will the next node be in", not "is there a spare node at all". For a tight HA set you need both.
