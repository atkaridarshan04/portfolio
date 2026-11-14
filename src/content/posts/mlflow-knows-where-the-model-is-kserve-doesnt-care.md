---
title: "MLflow Knows Where the Model Is. KServe Doesn't Care"
deck: "Bridging the Registry to the Serving Layer"
description: "MLflow's model registry is genuinely useful. You register a model, assign an alias, and anywhere in your codebase you can reference it as…"
date: 2026-10-26
tags: ["MLOps", "MLflow", "KServe", "Kubernetes", "Machine Learning"]
repo: "https://github.com/atkaridarshan04/mlops-platform-blueprint"
source: "Tech/LinkedIn Posts/MLOps/MLflow Knows Where the Model Is. KServe Doesn't Care - Bridging the Registry to the Serving Layer.md"
---

MLflow's model registry is genuinely useful. You register a model, assign an alias, and anywhere in your codebase you can reference it as `models:/CaliforniaHousingRegressor@production`. Clean, human-readable, decoupled from the underlying version number. Promoting a new model is just moving the alias.

The problem is that KServe can't use that reference.

KServe needs to know exactly where the model artifact lives in object storage — a literal S3 path. Not a logical name, not an alias, a physical URI. So there's an explicit resolution step between the registry and the serving layer: take the alias, ask MLflow which version it currently points to, get the download URI for that version, hand the resolved S3 path to KServe's InferenceService manifest.

That resolution step is intentional, not a workaround. The design principle behind it is that inference runtimes should never talk to MLflow directly. MLflow is the control plane — experiment tracking, lineage, governance, the registry. S3 is where the actual artifacts live. KServe is the serving plane. Keeping those three separate means serving has no runtime dependency on MLflow being up. If the MLflow instance goes down, models already deployed to KServe keep serving — they're reading from S3, not from MLflow.

It also means the `storageUri` in a KServe manifest is an immutable pointer. It doesn't change when someone updates an alias or registers a new version. Promotion is a deliberate act: resolve the new alias, update the manifest, apply. Nothing in serving moves unless you move it.

The resolution itself is a small script — query the registry for the version behind the alias, get the artifact URI, write it out. The output goes into the InferenceService spec. It runs as part of the promotion workflow, not at serving time.

This separation — control plane, artifact store, serving plane, each with one job — is the pattern that makes the serving layer actually stable rather than implicitly coupled to the state of your experiment tracking system.

Put together a full end-to-end MLOps platform with this wired up — registry, resolution script, KServe serving — if anyone wants to see it end to end: https://github.com/atkaridarshan04/mlops-platform-blueprint

Has anyone else hit this when moving from MLflow batch inference to KServe online serving — how did you handle the registry-to-serving gap?

![mlflow registry to kserve resolution](/writing/mlflow-knows-where-the-model-is-kserve-doesnt-care/mlflow-registry-to-kserve-resolution.png)
