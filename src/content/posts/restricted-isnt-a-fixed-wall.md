---
title: "Restricted Isn't a Fixed Wall"
deck: "How Pod Security Admission Handles Containers That Need Root"
description: "The restricted profile no longer demands non-root from a pod in a user namespace. How namespace labels, the version pin and one Kyverno policy handle a root-only nginx."
date: 2026-10-03
updated: 2026-11-16
tags: ["Kubernetes", "Container Security", "DevSecOps", "Platform Engineering", "DevOps"]
repo: "https://github.com/atkaridarshan04/cloudnative-devops-blueprint/blob/main/docs/concepts/PodSecurityAdmission.md"
files:
  - "kubernetes/namespace.yml"
  - "kubernetes/frontend.yml"
  - "kubernetes/backend.yml"
  - "kubernetes/mongodb.yml"
  - "kyverno/policies/require-userns-or-nonroot.yaml"
  - "docs/concepts/PodSecurityHardening.md"
---

A container that genuinely needs root sounds incompatible with Kubernetes' strictest pod security level. It isn't anymore.

That's been the default assumption for a while: `restricted` requires every container to run as non-root, full stop — so the moment one workload needs real root, like an nginx container binding its own listening socket, the usual move is dropping the whole namespace down to `baseline` just for that one pod, or writing a standing exception into the policy. Either way, every other workload sharing that namespace loses restricted's protections along with it, because of one container with a different requirement. That is exactly what my blueprint repo's namespace does, and I went back to check whether it still had to.

## What restricted actually forbids

The Pod Security Standards define three cumulative profiles. The Kubernetes documentation describes `privileged` as the unrestricted one, `baseline` as "minimally restrictive policy which prevents known privilege escalations" that still "allows the default (minimally specified) Pod configuration", and `restricted` as "heavily restricted policy, following current Pod hardening best practices".[^1] The distinction that matters for this post is what each one asks of a plain, unannotated pod.

`baseline` is a list of things a pod must not do: share the host's network, PID or IPC namespaces, set `privileged: true`, mount `hostPath` volumes, or add capabilities beyond a short allowed set (`CHOWN`, `NET_BIND_SERVICE`, `SETUID` and so on). A pod that says nothing about any of this passes, because the forbidden fields are all off by default.

`restricted` flips that. On top of everything in `baseline`, it is a list of things a pod must explicitly say, per the same standard:

- `allowPrivilegeEscalation` must be `false` on every container.
- `runAsNonRoot` must be `true`, at the pod level or on every container.
- `runAsUser` must not be `0` wherever it is set.
- `seccompProfile.type` must be `RuntimeDefault` or `Localhost`; the absence of a profile is prohibited.
- `capabilities.drop` must include `ALL`, and the only capability allowed back is `NET_BIND_SERVICE`.

A pod with no `securityContext` at all fails `restricted` on four of those five counts. The standards table also tags most controls with the release that added them — `Seccomp (v1.19+)`, `Capabilities (v1.22+)`, `Running as Non-root user (v1.23+)` — so "restricted" has never been one fixed list.

## Labels, modes and the version pin

Pod Security Admission is the built-in admission controller that applies those profiles. It has been stable since Kubernetes v1.25, there is nothing to install, and its entire configuration surface is a set of labels on the namespace:[^2]

```yaml
pod-security.kubernetes.io/<MODE>: <LEVEL>
pod-security.kubernetes.io/<MODE>-version: <VERSION>
```

`MODE` is one of three independent things the controller can do with a violation. In the documentation's words, `enforce` means "policy violations will cause the pod to be rejected", `audit` means they "trigger the addition of an audit annotation to the event recorded in the audit log, but are otherwise allowed", and `warn` means they "trigger a user-facing warning, but are otherwise allowed". A namespace can set all three, each at a different level. One asymmetry matters later: `audit` and `warn` are also applied to workload resources like Deployments, so `kubectl apply` prints the warning immediately, but `enforce` applies only to the resulting Pod objects.

`VERSION` is the part the teaser was about. The label pins a mode to the policy that shipped with a given Kubernetes minor version — `v1.37`, say — or to `latest`. A namespace pinned to an older version is evaluated against that release's shorter list, on the same cluster, next to one on `latest`.

What PSA does not have is a per-workload exemption. The three it offers — authenticated usernames, RuntimeClass names and whole namespaces — are static configuration on the admission controller, not something a manifest can ask for.[^2]

Then there is the relaxation. The user-namespaces page is explicit that for a Linux pod with `spec.hostUsers: false`, the following fields "won't be constrained even in contexts that enforce the Baseline or Restricted pod security standard": `runAsNonRoot` and `runAsUser`, at pod, container, init-container and ephemeral-container level. The reason given is that root inside such a pod "is never mapped to a privileged user on the host".[^3] The other restricted controls — privilege escalation, capabilities, seccomp — are not on that list. The relaxation removes one wall, not the whole profile.

The documentation does not say which policy version first carried that relaxation, but the admission plugin's source does: its `runAsNonRoot` and `runAsUser` checks each have a `1_35` variant that relaxes the rule for a pod with `hostUsers: false`, and the older variants do not.[^userns-version] So the same pod is rejected under a pin of `v1.34` or earlier and accepted from `v1.35` on.

## The design in the repo

The blueprint's application namespace carries all six labels:

```yaml title="kubernetes/namespace.yml"
apiVersion: v1
kind: Namespace
metadata:
  name: mern-devops
  labels:
    # enforce blocks genuinely dangerous configs (privileged, host namespaces, hostPath, etc.)
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/enforce-version: latest
    # audit/warn at restricted surface exactly which workloads still run as root
    # (frontend, mongodb) without blocking them — they have a real reason to
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: latest
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest
```

`enforce: baseline` is the real floor: privileged containers, host namespaces and `hostPath` are categories nothing in this application needs, so rejecting them costs nothing. `audit` and `warn` at `restricted` make every `kubectl apply` print which restricted control each workload fails, without stopping the deploy. The comment was stale when it was written — `runAsUser: 999` on mongodb landed in the same commit — so frontend is the only workload the warnings still name.

Three workloads live there, and they split cleanly. The Node.js backend will run as any UID, so it gets the direct fix in [`backend.yml`](https://github.com/atkaridarshan04/cloudnative-devops-blueprint/blob/main/kubernetes/backend.yml):

```yaml title="kubernetes/backend.yml"
      securityContext:
        runAsUser: 1000   # Non-root UID - prevents container breakout attacks
        runAsGroup: 3000  # Dedicated group for file system permissions
        fsGroup: 2000     # Ensures volume mounts have correct group ownership
        runAsNonRoot: true # Kubernetes validation - blocks root containers
        seccompProfile:
          type: RuntimeDefault # required by the "restricted" Pod Security Standard
      containers:
        - name: backend
          # ...
          securityContext:
            runAsUser: 1000                    # Must match pod-level setting
            runAsGroup: 3000
            allowPrivilegeEscalation: false    # Prevents sudo/setuid attacks
            readOnlyRootFilesystem: true       # Immutable container filesystem
            capabilities:
              drop:
                - ALL                          # Remove all Linux capabilities
```

That is every restricted control, satisfied. [`mongodb.yml`](https://github.com/atkaridarshan04/cloudnative-devops-blueprint/blob/main/kubernetes/mongodb.yml) takes the same shape with `runAsUser: 999`, the built-in `mongodb` user the `mongo:4.4` image ships, instead of starting as root and dropping privilege through `gosu`; `fsGroup: 999` makes the kubelet chown the PVC on mount.

The frontend is the one that can't follow. nginx's master process starts as root and forks its workers as a low-privilege user; that is baked into how it drops privilege internally, so `runAsNonRoot: true` would stop the pod from starting at all. The manifest in [`frontend.yml`](https://github.com/atkaridarshan04/cloudnative-devops-blueprint/blob/main/kubernetes/frontend.yml) reaches for the other layer:

```yaml title="kubernetes/frontend.yml"
  template:
    metadata:
      name: frontend
      labels:
        app: frontend
        version: v2
    spec:
      hostUsers: false # maps container root to an unprivileged host UID (K8s 1.36+)
      serviceAccountName: frontend
      containers:
        - name: frontend
          image: ghcr.io/atkaridarshan04/cloudnative-devops-blueprint/bookstore-frontend:2.0.0
```

`hostUsers: false` puts the pod in its own Linux user namespace. The kubelet picks a host UID/GID range for it, guaranteed not to overlap any other pod on the node and by default above 0–65535, so it never overlaps the host's own users either.[^3] Inside the container nothing changes; on the host, container UID 0 is a high, unprivileged number. The check I ran on a kind node, same manifest, only `hostUsers` toggled:

```text
$ kubectl exec -n mern-devops deploy/frontend-deployment -- id
uid=0(root) gid=0(root) ...

$ docker exec kind-control-plane ps -eo pid,uid,cmd | grep nginx
2535   840368128   nginx: master process nginx -g daemon off;
2553   840368229   nginx: worker process
```

Without `hostUsers: false`, the same two processes show host UIDs `0` and `101`. With it, the master lands on `840368128` and the worker on `840368229` — exactly `840368128 + 101`. It is a fixed offset over the container's ID space, not a per-process randomisation. User namespaces are stable since v1.36 and need containerd 2.0 or later, runc 1.2 or crun 1.9 or later, and a Linux 6.3 kernel for idmap mounts on tmpfs.[^3]

> [!note] My own concept doc states this too strongly
> [`PodSecurityAdmission.md`](https://github.com/atkaridarshan04/cloudnative-devops-blueprint/blob/main/docs/concepts/PodSecurityAdmission.md) says the Pod Security Standards "have no concept of Linux user namespaces at all". The user-namespaces page says otherwise for the non-root checks specifically. What stays true, and what the Kyverno policy below is actually for, is the other direction: PSA never *requires* `hostUsers: false`, and at `baseline` it never looks at root at all.

## What a rejection and a warning look like

The namespace's `enforce: baseline` has to be proven to block something, not just warn, so the concept doc has a deliberately privileged pod:

```bash
kubectl run privileged-test -n mern-devops --image=nginx --restart=Never \
  --overrides='{"spec":{"containers":[{"name":"privileged-test","image":"nginx","securityContext":{"privileged":true}}]}}'
```

```text
Error from server (Forbidden): ... violates PodSecurity "baseline:latest": privileged (container "privileged-test" must not set securityContext.privileged=true)
```

No Pod object is created. The message names the level and version, `baseline:latest`, and the one control that failed.

The warn mode's output is more interesting because of what else is in the chain. Comment `hostUsers: false` out of `frontend.yml` and re-apply, and two signals arrive from the same command:

```text
serviceaccount/frontend created
Warning: would violate PodSecurity "restricted:latest": allowPrivilegeEscalation != false
(container "frontend" must set securityContext.allowPrivilegeEscalation=false), unrestricted
capabilities (container "frontend" must set securityContext.capabilities.drop=["ALL"]),
runAsNonRoot != true (pod or container "frontend" must set securityContext.runAsNonRoot=true),
seccompProfile (pod or container "frontend" must set securityContext.seccompProfile.type to
"RuntimeDefault" or "Localhost")
service/frontend-service created
Error from server: error when creating "kubernetes/frontend.yml": admission webhook
"validate.kyverno.svc-fail" denied the request:

resource Deployment/mern-devops/frontend-deployment was blocked due to the following policies

require-userns-or-nonroot:
  autogen-require-userns-or-nonroot: 'validation error: Pod must either set spec.hostUsers:
    false ... or run as non-root ... rule autogen-require-userns-or-nonroot[0] failed at path
    /spec/template/spec/hostUsers/ rule autogen-require-userns-or-nonroot[1] failed at path
    /spec/template/spec/securityContext/runAsNonRoot/ rule autogen-require-userns-or-nonroot[2]
    failed at path /spec/template/spec/containers/0/securityContext/'
```

Three things in that output are the whole mechanism in one screen.

The `Warning:` line is PSA's warn mode: all four restricted controls the frontend fails, phrased as `would violate`, evaluated against the Deployment's pod template so it fires at apply time, and the object is let through.

The `ServiceAccount` and `Service` were created and only the `Deployment` was refused. `kubectl apply` on a multi-document file applies each object independently, and the Kyverno policy's `match` names only Pod kinds, so the other two objects were never in scope.

And the PSA warning printed even though the request failed. `warn` and `audit` report regardless of what happens later in the chain; Kyverno's validating webhook is a separate, later stage, and it is what blocked the write. The `autogen-` prefix is Kyverno expanding a Pod policy onto the Deployment's `spec.template`, the same template-level evaluation PSA does for warn.

With `hostUsers: false` restored, the Kyverno denial goes away. What the relaxation removes from the warning is narrower than the teaser implies: `runAsNonRoot != true` should drop, because PSA no longer constrains that field for a user-namespaced pod, but `allowPrivilegeEscalation`, `capabilities` and `seccompProfile` are still restricted controls and `frontend.yml` sets none of them. Adding those three and confirming nginx still binds port 80 with every capability dropped is the follow-up this namespace is waiting on before `enforce` can move up.

The repo only records the warning with `hostUsers` commented out; the narrower warning with it in place follows from the policy source above, not from a captured run.

## Where Kyverno sits next to it

The gap the Kyverno policy closes is not "PSA ignores user namespaces". It is that `enforce: baseline` never looks at root: a pod running as root with `hostUsers` at its default of `true` is real root on the node, and `baseline` has no opinion about it, because `runAsNonRoot` is a restricted control and restricted is only warning here. Enforce can't move up without blocking nginx and PSA has no per-workload exemption, so one rule in [`require-userns-or-nonroot.yaml`](https://github.com/atkaridarshan04/cloudnative-devops-blueprint/blob/main/kyverno/policies/require-userns-or-nonroot.yaml) brings just that check into enforce:

```yaml title="kyverno/policies/require-userns-or-nonroot.yaml"
spec:
  validationFailureAction: Enforce
  background: true
  rules:
    - name: require-userns-or-nonroot
      match:
        any:
          - resources:
              kinds:
                - Pod
              namespaces:
                - mern-devops
      validate:
        # ...
        anyPattern:
          - spec:
              hostUsers: false
          - spec:
              securityContext:
                runAsNonRoot: true
          - spec:
              containers:
                - securityContext:
                    runAsNonRoot: true
```

The `anyPattern` has the same shape as PSA's relaxed non-root check — a user namespace or a non-root user — with the one difference that this rejects, in a namespace whose PSA enforce level does not. It started at `Enforce` because every workload already satisfied it, frontend through `hostUsers: false` and the other two through `runAsNonRoot: true`, so there was no migration period to run. `background: true` makes Kyverno report on existing pods too.

PSA is in-tree, costs nothing, and has one coarse knob per mode per namespace. Kyverno is a webhook later in the same chain, with per-resource `match` and arbitrary patterns, and it already sits in this cluster's path for `disallow-latest-tag`, `require-labels`, and the image signature check from [Trust the Pipeline, Not the Tag](/writing/trust-the-pipeline-not-the-tag/). PSA sets the floor; Kyverno enforces the specific controls the floor can't express yet. Once the frontend is fully restricted-clean and `enforce` moves up, the rule is redundant with PSA's own relaxed non-root check and can go.

## Takeaways

- `restricted` is a versioned list, not a fixed wall. The standards tag controls by the release that added them, the `-version` label picks which list applies, and the user-namespace relaxation is one more entry a pin older than `v1.35` won't have. Check what the version actually enforcing a namespace does before carrying a permanent exception.
- `hostUsers: false` is a kernel-level answer to "this image needs root", and PSA honours it: `runAsNonRoot` and `runAsUser` are no longer constrained for that pod under `baseline` or `restricted`. The other restricted controls are untouched, so the container still has to drop capabilities, refuse privilege escalation and set a seccomp profile.
- Split the modes. `enforce` at the level every workload meets today, `audit` and `warn` at the level you want, and the apply output tells you how far each manifest is from it without blocking a deploy.
- PSA's only exemptions are static admission-controller config, never per workload. When one workload holds the namespace's enforce level down, a narrowly matched Kyverno rule brings the one control you care about back into enforce without lowering anything else.
- Prove enforce with a rejection. The privileged test pod refused with `baseline:latest` in the error is evidence the floor exists; the warnings on the frontend are evidence of the gap, not of the control.

[^1]: [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/), Kubernetes documentation. The profile descriptions, the Baseline and Restricted control tables and their version tags are quoted from there.
[^2]: [Pod Security Admission](https://kubernetes.io/docs/concepts/security/pod-security-admission/), Kubernetes documentation: the three modes, the label and version-label format, the note that `enforce` applies only to Pod objects while `audit` and `warn` also cover workload resources, and the three exemption dimensions.
[^3]: [User Namespaces](https://kubernetes.io/docs/concepts/workloads/pods/user-namespaces/), Kubernetes documentation, including the "Integration with Pod security admission checks" section that lists the `runAsNonRoot` and `runAsUser` fields PSA stops constraining for a pod with `hostUsers: false`, the kubelet's mapping behaviour, and the runtime and kernel requirements.

[^userns-version]: Kubernetes pod-security-admission, [`policy/check_runAsNonRoot.go`](https://github.com/kubernetes/pod-security-admission/blob/master/policy/check_runAsNonRoot.go) and `policy/check_runAsUser.go`: the `1_35` checks call the user-namespace relaxation; the `1_0` and `1_23` checks do not.
