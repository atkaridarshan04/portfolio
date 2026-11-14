---
title: "The Model Isn't the Only Thing That Needs to Be Versioned"
deck: "Training-Serving Skew in MLOps"
description: "Most ML projects start the same way: train a model, save it, load it in an API, done. It works for a while."
date: 2026-10-26
tags: ["MLOps", "Machine Learning", "MLflow", "Python", "Kubernetes"]
repo: "https://github.com/atkaridarshan04/mlops-platform-blueprint"
source: "Tech/LinkedIn Posts/MLOps/The Model Isn't the Only Thing That Needs to Be Versioned - Training-Serving Skew in MLOps.md"
---

Most ML projects start the same way: train a model, save it, load it in an API, done. It works for a while.

The problem shows up later, usually quietly. The model was trained with a specific imputer, a specific encoder, specific feature engineering logic. But all of that lived separately — the API loaded the model file, ran its own preprocessing, and hoped the two stayed in sync. Retrain the model, forget to update the encoder. Roll back a model version, but the preprocessing in the API doesn't roll back with it. Nothing throws an error. The predictions just silently degrade.

This is training-serving skew, and it's one of those bugs that's genuinely hard to catch because there's no stack trace — just metrics that look slightly wrong and no obvious cause.

The fix is treating the model as a single deployable unit. Instead of separate artifacts that have to be kept in sync manually, everything — the trained model, the fitted imputer, the fitted encoder, and the actual preprocessing source code — gets bundled into one MLflow PyFunc artifact using `code_paths`. One version number covers all of it.

When a new version gets promoted to production, that promotion covers the exact preprocessing steps, the exact feature engineering logic, and the exact trained weights together. A rollback is a registry alias update — point `@production` at the previous version and everything rolls back atomically. There's no "which encoder version goes with which model version" question because they were never separate.

The other thing this solves quietly: the code running at serving time is provably the same code that ran at training time. It's packaged inside the artifact, not deployed separately, not something that can drift while the model sits in the registry waiting to be promoted.

This pattern is part of a larger end-to-end MLOps platform — DVC for data versioning, Argo Workflows for training pipelines, MLflow for experiment tracking and the model registry, KServe for Kubernetes-native serving: https://github.com/atkaridarshan04/mlops-platform-blueprint

Have you run into training-serving skew before — what was the first sign something was wrong?

![mlflow pyfunc inference pipeline bundle](/writing/the-model-isnt-the-only-thing-that-needs-to-be-versioned/mlflow-pyfunc-inference-pipeline-bundle.png)
