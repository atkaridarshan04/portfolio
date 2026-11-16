---
title: "From Training to Serving in One Pipeline Run"
deck: "ML CI with Argo Workflows"
description: "Four sequential Argo steps take a training run to a Git commit that rewrites the KServe manifest. What flows between the steps, and what the pipeline deliberately does not do."
date: 2026-10-26
updated: 2026-11-16
tags: ["MLOps", "Argo Workflows", "Kubernetes", "MLflow", "GitOps"]
repo: "https://github.com/atkaridarshan04/mlops-platform-blueprint"
files:
  - argo/template.yml
  - argo/workflow.yml
  - docs/argo-workflow.md
  - pipelines/train.py
  - k8s/security/rbac.yml
  - k8s/workloads/inference-service.yml
---

Most ML pipelines stop at the model registry. Train the model, log it to MLflow, register it, done. What happens after that — getting the new model actually serving traffic — is usually a manual step someone does later.

The problem with that gap is that it's invisible. The model is "in production" in the registry, but the serving layer is still running the previous version. There's no broken build, no alert, just a quiet mismatch between what the registry says is production and what's actually serving.

The Argo Workflows pipeline in the blueprint closes that gap in four steps that run one after another, each feeding the next, and ends with a Git commit. This is about the pipeline itself: the steps, how their outputs are wired, what one run looks like, and where I chose to stop automating.

![Four Argo steps, train, promote, resolve and update Git, with the serving layer picking up from the committed manifest. The drawing's "fully automated" subtitle and its example URI are from the original note; the apply at the end is manual, and the real URI shape is in the resolve section below](/writing/from-training-to-serving-in-one-pipeline-run/mlops-argo-workflows-train-to-serving-pipeline.png)

## One run, but not one decision

Training in the blueprint knows nothing about deployment. The docstring at the top of `pipelines/train.py` says so in capitals: it "Registers model version in MLflow (NO promotion / deployment decision)". The script loads the dataset, fits the preprocessing and the regressor, logs metrics, and finishes with a single `log_model` call that also registers the version:

```python title="pipelines/train.py"
        mlflow.pyfunc.log_model(
            name="model",
            python_model=inference_pipeline,
            code_paths=["src"],
            pip_requirements="requirements.txt",
            registered_model_name=REGISTERED_MODEL_NAME,
            input_example=input_example,
            signature=signature,
        )
```

That is the same code the standalone `k8s/workloads/training-job.yml` runs, and on its own it produces a new version in the registry and nothing else. What the PyFunc contains and why `code_paths=["src"]` matters is covered in [The Model Isn't the Only Thing That Needs to Be Versioned](/writing/the-model-isnt-the-only-thing-that-needs-to-be-versioned/).

The promotion decision lives one layer up, in the workflow, and in this blueprint it is unconditional. Nothing between the training step and the promotion step reads a metric; every run that trains successfully promotes what it trained. I made that choice to keep the mechanics of the loop visible, but it means "one run" is a statement about plumbing, not judgement. The pipeline guarantees the registry, the artifact store and the manifest agree with each other. It does not guarantee the model is any good.

The reason to keep training and deployment in one workflow anyway is that the two things that drift apart, the alias in MLflow and the `storageUri` in Git, are written by different systems. They stay in sync only if one actor writes both, in order, with the second write derived from the first.

## Four steps and two parameters

The run is a `Workflow` whose single template is a list of `steps`. Each entry is double-nested (`- - name:`), which in Argo means one step per group, groups in sequence. Every step is a `templateRef` into a `WorkflowTemplate` called `mlops-lib`, so the workflow file is only wiring:

```yaml title="argo/workflow.yml"
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: housing-ci-pipeline-
spec:
  entrypoint: mlops-pipeline
  serviceAccountName: s3-sa

  arguments:
    parameters:
      - name: model-name
        value: CaliforniaHousingRegressor
      - name: repo-url
        value: https://github.com/atkaridarshan04/ml-from-scratch-to-prod.git
      - name: manifest-path
        value: k8s/workloads/inference-service.yml
```

That URL is the repository's name from before it was renamed. GitHub redirects the old name to the new one, so the clone and the push keep working, but the parameter is stale and the README clones the same old address.

Three workflow-level parameters, and two values that move between steps. `train` emits `model-version`, which `promote` consumes:

```yaml title="argo/workflow.yml"
      - - name: promote
          templateRef:
            name: mlops-lib
            template: promote-model-tmpl
          arguments:
            parameters:
              - name: model-version
                value: "{{steps.train.outputs.parameters.model-version}}"
              - name: model-name
                value: "{{workflow.parameters.model-name}}"
```

`resolve-uri` emits `model-uri`, which `update-git` consumes the same way through `{{steps.resolve-uri.outputs.parameters.model-uri}}`. That is the whole data flow, and the docs' own diagram draws it the same way: the train node feeds a model-version output node that feeds promote, and resolve feeds an S3 URI output node that feeds update-git. Notice what is missing. `promote` has no output, and `resolve-uri` takes no input from `promote`. The hand-off between steps two and three goes through MLflow itself: `promote` writes the `production` alias, and `resolve-uri` reads whatever the alias points at when it runs. In one sequential run that is the version promoted seconds earlier, but it is a read of shared state, not a parameter, and [MLflow Knows Where the Model Is. KServe Doesn't Care](/writing/mlflow-knows-where-the-model-is-kserve-doesnt-care/) spells out what that means when runs overlap.

An output parameter is a file. The container writes it, the template declares `valueFrom.path`, and Argo's executor reads it when the container exits and reports it to the controller. That reporting is why the workflow's service account needs more than S3 access:

```yaml title="k8s/security/rbac.yml"
rules:
  # Permissions to manage workflow tasks and results
  - apiGroups: ["argoproj.io"]
    resources: ["workflowtaskresults"]
    verbs: ["create", "patch", "get", "list", "update"]
  # Permissions to manage pods (creation/deletion)
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "watch", "list", "create", "patch", "update", "delete"]
```

The workflow runs as `s3-sa`, the same service account the training job and KServe use for the bucket, and this `Role` is bound to it. Without the `workflowtaskresults` verbs the executor can't report a step's outputs, and the step fails at that point rather than handing an empty value downstream.

## The templates

### Train

The training template is the standalone training job with a tail added. It clones the repository at runtime, pulls the dataset with DVC, runs `python -m pipelines.train`, then asks the registry what it just did:

```bash title="argo/template.yml"
            set -e
            git clone {{inputs.parameters.repo-url}} repo && cd repo

            dvc pull data/raw/housing.csv
            python -m pipelines.train

            MODEL_VERSION=$(python - <<'EOF'
            import mlflow
            from mlflow.tracking import MlflowClient
            client = MlflowClient("http://mlflow.mlflow.svc.cluster.local:5000")
            latest = client.get_latest_versions("{{inputs.parameters.model-name}}", stages=[])
            print(latest[-1].version)
            EOF
            )

            echo -n "$MODEL_VERSION" > /tmp/model_version.txt
```

Two details carry weight. `train.py` does not return the version it registered; the template discovers it afterwards by listing versions and taking the last one. And the number is written with `echo -n`, because a trailing newline in the file would become a trailing newline in the parameter.

> [!warning] "Latest" is a query, not a receipt
> The version that gets promoted is whichever one is newest when the query runs, not necessarily the one this pod registered. If anything else registers a version of `CaliforniaHousingRegressor` between `train.py` finishing and the lookup, including a second submission of this same workflow, the alias lands on the wrong model. Fine for one run on a quiet cluster; two overlapping runs is the case to think about before copying this.

This is also the only step that receives S3 credentials. `envFrom: secretRef: s3creds` is on the train template and nowhere else, because training is the only step that touches the bucket. Promote and resolve talk to MLflow; update-git talks to GitHub.

### Promote

Promotion is one registry call, run on the blueprint's custom MLflow server image because that image already has the client installed:

```yaml title="argo/template.yml"
      container:
        image: ghcr.io/atkaridarshan04/mlflow-server:v3.8.0
        env:
          - name: MODEL_VERSION
            value: "{{inputs.parameters.model-version}}"
          - name: MODEL_NAME
            value: "{{inputs.parameters.model-name}}"
          - name: MLFLOW_TRACKING_URI
            value: http://mlflow.mlflow.svc.cluster.local:5000
        command: ["python", "-c"]
        args:
          - |
            import os
            from mlflow.tracking import MlflowClient
            version = int(os.environ["MODEL_VERSION"].strip())
            client = MlflowClient(os.environ["MLFLOW_TRACKING_URI"])
            client.set_registered_model_alias(name=os.environ["MODEL_NAME"], alias="production", version=version)
```

The `.strip()` is the fix the docs call out as critical, the other half of the `echo -n` above. The `int()` is a free sanity check: if the training step wrote anything but a number, this step fails loudly instead of handing MLflow a string.

### Resolve

The third step turns the alias back into an S3 path with two registry calls and writes it to `/tmp/model_uri.txt`, which becomes `model-uri`. The calls, and why KServe needs a literal path, are in the KServe post. The only thing to add here is operational: the template runs on a bare `python:3.10` image and starts with `pip install mlflow -q`. That one line is why, in the run below, the step doing the least work takes the longest.

### Update Git

The last step is shell on `alpine/git`:

```bash title="argo/template.yml"
            set -e
            AUTH_URL=$(echo "{{inputs.parameters.repo-url}}" | sed "s|https://|https://x-access-token:${GITHUB_TOKEN}@|")
            git clone $AUTH_URL repo && cd repo
            sed -i "s|storageUri:.*|storageUri: \"{{inputs.parameters.model-uri}}\"|" {{inputs.parameters.manifest-path}}
            git config user.email "ci@mlops.local"
            git config user.name "mlops-ci"
            git add .
            git commit -m "chore: update production model uri"
            git push origin main
```

`GITHUB_TOKEN` comes from a `github-token` secret created from `k8s/security/gitub-auth.yml` with a token that has `Contents: Write` on the repository. The `sed` matches from `storageUri:` to the end of the line, which preserves the indentation in `inference-service.yml`: everything before the key is left alone, everything after it is replaced. The commit lands on `main` directly. No branch, no pull request, no review; the workflow is the reviewer.

> [!note] A no-op run fails at the commit
> With `set -e` in force, `git commit` exiting non-zero because there is nothing to commit kills the step. Today every run registers a new version with a new artifact path, so the manifest always changes. If you rework the pipeline so promotion can land on the version already serving, this is where it surfaces, and the failure is a feature: the workflow is telling you nothing moved.

## What a run looks like

The template library is applied once, and each run is a submission:

```bash
kubectl apply -f argo/template.yml
argo submit argo/workflow.yml --watch
```

`generateName` gives the run a unique suffix. `argo list` shows it, `argo get <workflow-name>` shows the step tree, and `argo logs <workflow-name> --follow` tails all four pods. The docs carry a screenshot of `argo get` on a successful run, transcribed here because the durations are the point:

```text
STEP                 TEMPLATE            DURATION
 ✔ mlops-ci-5f6mw    mlops-pipeline
 ├─✔ train           train-model         16s
 ├─✔ promote         promote-model       4s
 ├─✔ resolve-uri     resolve-model-uri   1m
 └─✔ update-git      update-git-config   9s
```

That capture predates a rename: today the run is generated as `housing-ci-pipeline-` and the templates carry a `-tmpl` suffix, but the steps and their order are the same.

Sixteen seconds to clone, pull, train and register. Four seconds to move the alias on an image that already has MLflow. One minute to resolve, almost all of it `pip install mlflow` on a bare Python image. Nine seconds to clone, edit one line, and push. Run the resolve step on the same `mlflow-server` image as promote and the whole run is about half a minute.

When the run is green, three systems have changed. MLflow has a new run under the `california_housing_price` experiment and a new version of `CaliforniaHousingRegressor` with the `production` alias on it. S3 has a new artifact directory under the MLflow artifact root. The Git repository has a new commit on `main`, authored `mlops-ci`, whose diff is one line of `k8s/workloads/inference-service.yml`:

```yaml title="k8s/workloads/inference-service.yml"
      storageUri: "s3://mlflow-artifact-store-123-da/1/models/m-8f9d92e4d921400fb6d51d6d60ed06ab/artifacts"
```

The cluster has not changed at all. The `InferenceService` still points where it pointed before the run.

## What is deliberately left manual

The repository stops at the push. Nothing in it applies the updated manifest; `kubectl apply -f k8s/workloads/inference-service.yml` is a step a person runs, exactly as in the manual path in `docs/k8s.md`. The bottom row of the diagram, a GitOps controller watching the repo and reconciling the change, is the intended way to close the last gap, but no Argo CD application or equivalent is checked in. The pipeline's job ends at making the manifest correct.

The trigger is manual too. There is no `CronWorkflow`, no event sensor, no webhook from a data push. A run happens because someone types `argo submit`, which fits unconditional promotion: if every run promotes, a human should decide when a run happens.

And there is no gate. Metrics are logged to MLflow during training and never read back by the workflow. Adding one is a fifth template between `train` and `promote` that reads a test metric and exits non-zero below a threshold. The step wiring makes that a small change, which is the main argument for parameter passing over one script.

Rollback falls out for free. Because the manifest is the source of truth for serving, reverting the `chore: update production model uri` commit and applying is a complete rollback. The alias in MLflow will disagree with serving until the next run, the same quiet mismatch the pipeline exists to prevent, but a known one.

## Takeaways

- Training registers; the workflow promotes. Keeping `train.py` ignorant of deployment is what lets the same code run as a bare Kubernetes Job and as step one of a pipeline.
- Two output parameters wire the four steps, `model-version` and `model-uri`, each a file written by the container and read by the executor. The `workflowtaskresults` RBAC is part of the pipeline, not a formality.
- The hand-off between promote and resolve goes through the registry, not a parameter, and the training step finds its version by querying for the newest one. Both are fine for one run at a time and wrong for two.
- A green run changes MLflow, S3 and Git, and does not change the cluster. The pipeline makes the manifest correct; applying it is a separate act, by a person or by a GitOps controller that is not in this repository.
- The slowest step is the one doing the least. Look at per-step durations before assuming the work is where the time goes.
