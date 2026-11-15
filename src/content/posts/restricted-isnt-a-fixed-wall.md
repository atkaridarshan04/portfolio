---
title: "Restricted Isn't a Fixed Wall"
deck: "How Pod Security Admission Handles Containers That Need Root"
description: "A container that genuinely needs root sounds incompatible with Kubernetes' strictest pod security level. It isn't anymore."
date: 2026-10-03
tags: ["Kubernetes", "Container Security", "DevSecOps", "Platform Engineering", "DevOps"]
source: "Tech/LinkedIn Posts/Kubernetes/Restricted Isn't a Fixed Wall - How Pod Security Admission Handles Containers That Need Root.md"
---

A container that genuinely needs root sounds incompatible with Kubernetes' strictest pod security level. It isn't anymore.

That's been the default assumption for a while: `restricted` requires every container to run as non-root, full stop — so the moment one workload needs real root, like an nginx container binding its own listening socket, the usual move is dropping the whole namespace down to `baseline` just for that one pod, or writing a manual exception into the policy. Either way, every other workload sharing that namespace loses restricted's protections along with it, because of one container with a different requirement.

What's actually changed: Pod Security Admission now checks for Linux user namespaces before deciding whether to enforce non-root at all. Set `hostUsers: false` on that one pod, and root inside the container gets remapped to a random, unprivileged UID on the node — being "root" there no longer means anything on the host. PSA was updated to recognize exactly this: when it sees `hostUsers: false`, it skips the non-root requirement for that pod specifically, because enforcing it on top of an already-neutralized root wouldn't make anything safer, just redundant.

That relaxation isn't something that was always there, and it isn't automatic everywhere — it's versioned. It shipped as part of a specific Pod Security Admission policy revision tied to user namespaces reaching general availability, and PSA policy versions are pinned independently of your cluster version. A namespace enforcing an older pinned policy instead of `latest` won't have this relaxation at all, and will reject the exact same pod that a newer policy version accepts without complaint.

Before downgrading a namespace's security level or writing a standing exception for a workload that needs root, it's worth checking whether the policy version actually enforcing that namespace already has a path to keep it fully `restricted`. It isn't a fixed wall — it's a versioned, still-evolving set of checks, and assuming it hasn't moved is how a namespace ends up carrying a permanent exception for something the platform already resolved on its own.

Anyone else running a root-requiring workload under `restricted` via user namespaces instead of a namespace-wide exception?
