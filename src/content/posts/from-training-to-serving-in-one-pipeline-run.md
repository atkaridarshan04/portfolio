---
title: "From Training to Serving in One Pipeline Run"
deck: "ML CI with Argo Workflows"
description: "Most ML pipelines stop at the model registry. Train the model, log it to MLflow, register it, done. What happens after that — getting the new model actually serving traffic — is…"
date: 2026-10-26
tags: ["MLOps", "Argo Workflows", "Kubernetes", "MLflow", "GitOps"]
repo: "https://github.com/atkaridarshan04/mlops-platform-blueprint"
source: "Tech/LinkedIn Posts/MLOps/From Training to Serving in One Pipeline Run - ML CI with Argo Workflows.md"
---

Most ML pipelines stop at the model registry. Train the model, log it to MLflow, register it, done. What happens after that — getting the new model actually serving traffic — is usually a manual step someone does later.

The problem with that gap is that it's invisible. The model is "in production" in the registry, but the serving layer is still running the previous version. There's no broken build, no alert, just a quiet mismatch between what the registry says is production and what's actually serving.

The Argo Workflows pipeline here closes that loop entirely, and it does it in four steps that run sequentially, each one feeding the next.

The first step runs training — pulls the dataset via DVC, executes the training pipeline, logs the run to MLflow, and outputs the new model version number. The second step takes that version number and updates the `production` alias in the MLflow registry. The third step resolves that alias to a physical S3 path — because KServe needs a literal object storage URI, not a registry reference. The fourth step commits the resolved S3 path directly into the Kubernetes manifest in Git, updating the `storageUri` in the InferenceService spec.

That last step is the one that closes the loop. A Git commit is the artifact — the deployment config now reflects exactly what's serving, and any GitOps tooling watching that repo picks it up automatically. The serving layer doesn't move until the manifest changes, and the manifest only changes when the pipeline runs.

The result is that "promote to production" is one pipeline run, not a pipeline run followed by someone remembering to update a manifest. The registry, the artifact store, and the deployment config all stay in sync because the same workflow updates all three.

There's also an auditability benefit that's easy to miss: every promotion is a Git commit with a timestamp, a resolved S3 URI, and an implicit link back to the MLflow run that produced it. The full chain — training run → model version → S3 artifact → deployment config — is traceable after the fact, not just while the workflow is running.

Put together a full end-to-end MLOps platform with this pipeline wired up if anyone wants to see it end to end: https://github.com/atkaridarshan04/mlops-platform-blueprint

How are others handling the gap between model registration and serving — automated, manual, or something in between?

![mlops argo workflows train to serving pipeline](/writing/from-training-to-serving-in-one-pipeline-run/mlops-argo-workflows-train-to-serving-pipeline.png)
