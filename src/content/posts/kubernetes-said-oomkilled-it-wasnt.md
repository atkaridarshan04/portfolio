---
title: "Kubernetes Said OOMKilled. It Wasn't."
deck: "Debugging a Disk-Pressure Eviction on EKS"
description: "A pod reported OOMKilled with clean memory graphs. The real cause was kubelet's eviction manager reclaiming disk after image GC crossed its 85% threshold."
date: 2026-09-30
updated: 2026-11-15
tags: ["Kubernetes", "EKS", "DevOps", "SRE"]
---

Kubernetes told us a pod was OOMKilled. It wasn't.

OOMKilled isn't a vague error, it's a specific claim: the container exceeded its memory limit and got killed for it. So the natural first move is to check memory — usage graphs, limits, anything unusual. We did. Everything was clean. No spike, no OOM counter increment, nothing.

![The whole incident in one picture: the pod said OOMKilled, memory was flat, the node's root disk was climbing toward kubelet's 85% image GC threshold, and kubelet's eviction manager did the killing.](/writing/kubernetes-said-oomkilled-it-wasnt/kubernetes-oomkilled-disk-pressure.png)

## What we saw, and what memory said

This wasn't a one-off page. It was a pattern the developers on one backend service had learned to live with: on every rolling update, the new pod would come up degraded — `OOMKilled`, exit code 137 — while the previous pod kept running fine next to it. After a while a replacement would come up healthy and things would settle. Then the next deploy would do it again.

That shape is already a strange story for a memory OOM. The old pod and the new pod run the same code with the same limits, and only the new one ever died. Whatever was wrong resolved itself in minutes without anyone changing anything. But the label said memory, so memory is where everyone had been looking, and because it kept recovering on its own nobody had traced one occurrence end to end. I picked one and did.

Two Prometheus series answer the OOM question directly. `container_memory_working_set_bytes` is the series kubelet watches for memory pressure, and `container_oom_events_total` increments each time the cgroup OOM killer fires for that container. For this pod, the first was flat and well under its limit and the second never moved. No spike, no increment.

Node-level memory told the same story. There were no `NodeHasInsufficientMemory` events on the node, which is what you'd see if it was the node rather than one container that had run out.

So there was no evidence for the thing the status said had happened, at either level. That's the point where the label stops being useful and you have to go looking for what actually killed the process.

## The real signal was disk

The next thing I checked was disk, and the data had been sitting on the Grafana node dashboard the whole time. It has a per-node disk panel; it just hadn't been the first place to look, because nothing in the pod's status pointed at it.

The panel showed the node's root volume climbing. At the time of the kill the root disk was at 80%, and the image filesystem — the part of that same 20GB volume where containerd's overlayfs snapshotter keeps image layers — was at 86%. Roughly 13GB of the 20GB was container image layers.

That 86% matters because kubelet runs its own image garbage collector with a high-water mark, and kubelet's logs from the minutes before the kill show exactly what happened when the image filesystem crossed it:

```text
13:01:22  image_gc_manager.go:391  "Disk usage on image filesystem is over the
          high threshold, trying to free bytes down to the low threshold"
          usage=86 highThreshold=85 amountToFree=1175035084 lowThreshold=80

13:04:50  eviction_manager.go:387  "Eviction manager: must evict pod(s) to reclaim"
          resourceName="ephemeral-storage"
13:05:03  kuberuntime_container.go:866  "Killing container with a grace period"
          gracePeriod=30
```

Read top to bottom, that is the whole incident. At 13:01 the image filesystem was at 86%, over the 85% high threshold, and image GC set out to free about 1.2GB to get back under the 80% low threshold. It couldn't free enough, fast enough: image GC only deletes images no running container uses (kubelet's image manager builds the in-use set from running containers and skips those when it orders candidates for deletion), and on a node where most of the disk was layers that something was still running from, there was little left to delete. Three and a half minutes later the eviction manager decided it had to evict pods to reclaim `ephemeral-storage`, and thirteen seconds after that it began killing a container.

These are two separate kubelet subsystems with two separate jobs. [Image garbage collection](https://kubernetes.io/docs/concepts/architecture/garbage-collection/) is housekeeping: when the image filesystem goes over `imageGCHighThresholdPercent`, delete unused images until it is back under `imageGCLowThresholdPercent`. The [eviction manager](https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/) is the thing that kills workloads when a node resource is under pressure, and the image and node filesystems are among the signals it watches. GC runs first and is supposed to make eviction unnecessary. Here it lost the race.

What none of this involves is the kernel's OOM killer. There was no memory pressure anywhere on the node. A disk-space mechanism produced a dead container, and the dead container got a memory label.

## The tell: a grace period

The line that settles it is the last one: `gracePeriod=30`. (A hard threshold breached at 86% usage should have meant a `0s` kill by the documented rule; the note records the 30 seconds and not the reason, so that loose end stays loose.)

A real memory-cgroup OOM kill is the kernel acting directly on a process. It's a SIGKILL, it's instant, and there is no grace period — the kernel doesn't consult kubelet or give the process thirty seconds to tidy up. A container that was killed with a thirty-second grace period was not killed by the memcg OOM killer. Something above the kernel decided to terminate it and went through the normal graceful-termination path.

> [!warning] A grace period rules out OOM. It doesn't define eviction.
> Kubelet's node-pressure eviction isn't always graceful. When a hard eviction threshold is breached, pods are killed immediately with a `0s` grace period, so a graceful kill doesn't prove "this is what eviction looks like." It proves something narrower and more useful: this specific kill was not a real memory OOM, whatever the status said.

Exit code 137 doesn't contradict any of this. 137 means the process ended on SIGKILL, and both paths end there — when the grace period expires with the container still running, the runtime sends SIGKILL too. The exit code tells you how the process died, not who decided it should.

One loose end I didn't chase. Whether the `OOMKilled` reason string was the container runtime's literal detection of a memcg event, or Kubernetes surfacing a generic label on this eviction path, is a smaller question the pattern doesn't fully settle. `kubectl describe pod` and `crictl inspect` on the container would answer it, but by the time anyone looked the pod was gone, and its logs with it. It doesn't change the fix. It does change what evidence survives next time, which is one of the follow-ups below.

## Why it kept happening on deploys

The timing wasn't random. Every rolling update pulls a fresh image onto the node before the old pod is removed — that's the point of a rolling update, the new pod has to be running before the old one goes away — so for the duration of the rollout the node holds both image versions, plus whatever older ones GC hasn't collected yet. Each deploy adds layers to a disk that was already sitting close to the threshold from the previous deploy. Usage climbs a little per rollout until one of them tips it over 85%, GC can't claw back enough, and the eviction manager fires.

Which pod it lands on is the other half of the pattern. For memory and PID pressure, kubelet ranks pods for eviction by whether their usage exceeds their requests, then by priority, then by how far over their requests they are. For disk pressure on the image filesystem it ranks by how much writable-layer space each pod's containers are using. This service's pods had no resource requests at all, which makes them BestEffort — with requests of zero, "usage exceeds requests" is trivially true under memory pressure, and their writable layers were among the largest on the node under disk pressure. Either way they sat near the front of the line, and the pod mid-rollout was the one that got picked.

Put those together and you get exactly what the developers had been seeing: new pod dies, old pod fine, and eventually a replacement sticks once GC has freed enough for the node to drop back under the threshold. The recurrence across deployments with the same graceful-kill signature each time is itself strong evidence that this is the mechanism and not a coincidence with a genuine memory OOM.

## The fix

The immediate fix is to free disk on the affected node, either by removing unused images directly or by cordoning and draining it and letting the managed node group replace it cleanly:

```bash
crictl rmi --prune
ctr -n k8s.io images rm <ref>
```

That buys a few deploys. The things that stop it coming back:

- **Slim the images.** Multi-stage builds, smaller base images, and don't bake large model weights or ML dependencies into the image — pull them at runtime or mount them from a volume or PVC. This node group runs workloads with heavy ML dependencies, which is most of why 13GB of a 20GB disk was image layers.
- **Give the node headroom.** The node group's root EBS volume has since been increased; 20GB was tight for what runs there. This is the one that has been applied, and it reduces how often a deploy tips the disk over. It does not remove the accumulation, so the rest still apply.
- **Tune GC if it can't keep up with your deploy rate.** Lower `imageGCHighThresholdPercent` and `imageGCLowThresholdPercent` so cleanup starts earlier, and reduce how many old image tags stay reachable in the registry and in ArgoCD's history.
- **Alert on the image filesystem.** The panel already existed; the alert didn't. An alert at a level below the GC threshold pages before eviction instead of after.
- **Ship logs off-node.** `kubectl logs --previous` doesn't survive a deleted pod, which is why the `OOMKilled` label's origin is still a loose end.
- **Set resource requests.** See below.

> [!tip] Requests are eviction protection, not just scheduling input
> A pod with no requests isn't just hard to schedule sensibly. It is first in line the next time memory or PIDs get tight on the node, because its usage exceeds its requests by definition, and disk pressure ranks by writable-layer usage regardless. Setting honest requests on this service's pods moves them behind everything that declared what it needs, and slim images shrink what disk pressure ranks them by.

## Takeaways

- A status label is a claim, not a conclusion. `OOMKilled` pointed at memory, memory said no, and the fix it was steering us toward wouldn't have touched the disk that was actually full.
- Image GC and the eviction manager are different subsystems with different jobs, even though the default lines sit at the same 85%. GC is housekeeping; eviction is what happens when housekeeping loses.
- The grace period is the fastest way to tell the kernel's OOM killer from kubelet. The kernel never waits thirty seconds.
- Rolling updates cost disk. Every rollout holds two image versions at once, and the old ones only leave when GC gets to them.
- Pods with no requests go first under any pressure. That has nothing to do with this incident's cause and everything to do with who it landed on.
