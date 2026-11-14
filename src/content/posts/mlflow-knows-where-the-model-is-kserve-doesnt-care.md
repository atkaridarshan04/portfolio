---
title: "MLflow Knows Where the Model Is. KServe Doesn't Care"
deck: "Bridging the Registry to the Serving Layer"
description: "KServe wants a literal S3 path, not a registry alias. How the blueprint resolves the production alias into a storageUri at promotion time so serving never depends on MLflow."
date: 2026-10-26
updated: 2026-11-14
tags: ["MLOps", "MLflow", "KServe", "Kubernetes", "Machine Learning"]
repo: "https://github.com/atkaridarshan04/mlops-platform-blueprint"
files:
  - scripts/resolve_model_artifact_uri.py
  - k8s/workloads/inference-service.yml
  - argo/template.yml
  - argo/workflow.yml
  - docs/mlflow.md
  - docs/workflows/inference-online.md
  - docs/k8s.md
---

MLflow's model registry is genuinely useful. You register a model, assign an alias, and anywhere in your codebase you can reference it as `models:/CaliforniaHousingRegressor@production`. Clean, human-readable, decoupled from the underlying version number. Promoting a new model is just moving the alias.

The problem is that KServe can't use that reference.

![MLflow registry alias resolved to an S3 path and handed to a KServe InferenceService](/writing/mlflow-knows-where-the-model-is-kserve-doesnt-care/mlflow-registry-to-kserve-resolution.png)

## A pointer is not a path

The alias works because MLflow is the thing reading it. In the blueprint, batch inference loads the model exactly the way the registry wants you to:

```python title="docs/workflows/inference-batch.md"
model = mlflow.pyfunc.load_model("models:/CaliforniaHousingRegressor@production")
predictions = model.predict(context=None, model_input=raw_data)
```

That call goes to the tracking server, asks which version `production` points at, asks where that version's artifacts live, downloads them, and loads the PyFunc. The indirection is resolved inside the MLflow client, so the batch job never has to know about S3 at all.

KServe doesn't have that client in the loop. An `InferenceService` has one field for where the model comes from, `storageUri`, and it expects a physical location that the storage initializer can fetch from — in this platform, an S3 prefix. A `models:/` URI is a logical name that only means something to a running MLflow server. Hand it to KServe and there is nothing on the other end to answer the question.

So there are two different kinds of reference in play. The registry alias is a pointer that MLflow dereferences at read time. The `storageUri` is the dereferenced value. Something has to do the dereferencing, and the question is where and when.

## What the alias actually resolves to

Walk through what the pointer chain looks like in the blueprint. Training registers a new version under one logical name, `CaliforniaHousingRegressor`, and deliberately stops there — `pipelines/train.py` says in its own docstring that it "registers model version in MLflow (NO promotion / deployment decision)". The artifacts for that version are uploaded by the training job under the server's S3 artifact root, `s3://mlflow-artifact-store-123-da/`. Promotion is a separate act: someone, or the pipeline, moves the `production` alias onto a version number.

Resolving the alias is two registry calls:

```python title="docs/mlflow.md"
mv = client.get_model_version_by_alias("CaliforniaHousingRegressor", "production")
uri = client.get_model_version_download_uri("CaliforniaHousingRegressor", mv.version)
```

The first turns the alias into a version. The second turns the version into the download URI MLflow recorded when it stored that version's artifacts. The result is a plain S3 path of the form `s3://mlflow-artifact-store-123-da/1/models/m-<id>/artifacts/`. That path is what KServe gets.

What makes this safe is that the thing at the end of the path is self-contained. The model is logged as a single PyFunc with `code_paths=["src"]`, so the fitted imputer, the encoder, the feature-engineering code and the regressor are all inside the artifact directory, along with the signature and the pip requirements. MLServer can load it from S3 with no further lookups. Nothing about serving needs the registry once the path is known.

That is the actual reason the blueprint draws a hard line here, and the docs say it bluntly: inference runtimes never talk to MLflow directly. MLflow is the control plane — tracking, lineage, registry, governance. S3 is the data plane holding immutable artifacts. KServe is the serving plane. If the resolution happened at pod startup, every inference pod would carry a runtime dependency on the tracking server being reachable, and a MLflow outage (or a Postgres outage behind it, since the backend store is an in-cluster Postgres) would turn into a serving outage on the next scale-up or restart. Resolving once at deploy time means the running model reads from S3 and only S3.

> [!note] Batch and online are allowed to differ
> Batch jobs in the blueprint load `models:/...@production` directly and let MLflow resolve it. That's fine for a job that runs with the tracking server in scope anyway. The rule is specifically about long-running inference runtimes: they get a resolved path and nothing else.

It also changes what the manifest means. The `storageUri` in `inference-service.yml` is an immutable pointer to one model's bytes. Moving the alias in MLflow does not move serving. A new registered version does not move serving. The only way serving changes is someone resolving the alias again and writing the new path into the manifest — which is the same promotion-as-a-pointer-move idea I lean on in [Synced Isn't Healthy](/writing/synced-isnt-healthy/), applied one layer down.

## The resolution step, in code

### The script

The standalone version is a handful of lines, and it is the whole of `scripts/resolve_model_artifact_uri.py`:

```python title="scripts/resolve_model_artifact_uri.py"
from mlflow.tracking import MlflowClient

client = MlflowClient()

model_name = "CaliforniaHousingRegressor"
alias = "production"

mv = client.get_model_version_by_alias(
    name=model_name,
    alias=alias
)

download_uri = client.get_model_version_download_uri(
    name=model_name,
    version=mv.version
)

print("Resolved artifact URI:", download_uri)
```

`MlflowClient()` with no arguments reads `MLFLOW_TRACKING_URI` from the environment, so the script runs anywhere the tracking server is reachable: on a laptop against a port-forward, or in-cluster against `http://mlflow.mlflow.svc.cluster.local:5000`. It needs no S3 credentials, because it never touches the bucket. It just asks the registry what it knows.

### The InferenceService

The manifest that consumes the output:

```yaml title="k8s/workloads/inference-service.yml"
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: housing-model
  annotations:
    serving.kserve.io/s3-endpoint: s3.ap-south-1.amazonaws.com
    serving.kserve.io/s3-usehttps: "1"
spec:
  predictor:
    serviceAccountName: s3-sa
    model:
      modelFormat:
        name: mlflow
      protocolVersion: v2
      runtime: kserve-mlserver
      storageUri: "s3://mlflow-artifact-store-123-da/1/models/m-8f9d92e4d921400fb6d51d6d60ed06ab/artifacts"
```

Three things to read off it. `modelFormat: mlflow` plus `runtime: kserve-mlserver` tells KServe to hand the downloaded directory to MLServer's MLflow runtime, which is what understands the PyFunc layout. `serviceAccountName: s3-sa` carries the same `s3creds` binding the training job and the MLflow server use for the bucket; the training job takes the credentials from `envFrom`, KServe's storage initializer reads them through the service account. Serving reaches the artifacts with the same credentials that wrote them, and those are bound to S3, not to MLflow. And `storageUri` is a literal string. There is no templating, no reference to a registry, nothing for the cluster to resolve later.

The `m-<id>` in the committed manifest is not the one in the docs' worked example. That's expected: the pipeline rewrites this line on every promotion, so the file in the repo is whatever the last run resolved.

### The pipeline step

In the Argo workflow the same two calls run as the third of four steps, between promotion and the Git update:

```yaml title="argo/template.yml"
    - name: resolve-uri-tmpl
      inputs:
        parameters:
          - name: model-name
      container:
        image: python:3.10
        command: ["sh", "-c"]
        args:
          - |
            pip install mlflow -q
            python -c '
            from mlflow.tracking import MlflowClient
            client = MlflowClient("http://mlflow.mlflow.svc.cluster.local:5000")
            mv = client.get_model_version_by_alias("{{inputs.parameters.model-name}}", "production")
            uri = client.get_model_version_download_uri("{{inputs.parameters.model-name}}", mv.version)
            with open("/tmp/model_uri.txt", "w") as f: f.write(uri)
            '
      outputs:
        parameters:
          - name: model-uri
            valueFrom:
              path: /tmp/model_uri.txt
```

The resolved URI leaves the step as an Argo output parameter, and the workflow wires it straight into the next one:

```yaml title="argo/workflow.yml"
      - - name: update-git
          templateRef:
            name: mlops-lib
            template: update-git-tmpl
          arguments:
            parameters:
              - name: repo-url
                value: "{{workflow.parameters.repo-url}}"
              - name: model-uri
                value: "{{steps.resolve-uri.outputs.parameters.model-uri}}"
              - name: manifest-path
                value: "{{workflow.parameters.manifest-path}}"
```

The update step clones the repo with a GitHub token, runs `sed -i "s|storageUri:.*|storageUri: \"<uri>\"|"` against `k8s/workloads/inference-service.yml`, commits with the message `chore: update production model uri`, and pushes. The whole ordering is train, promote, resolve, update — the alias is moved first, then read back, then the read-back value is committed. Serving changes only when that commit lands and the manifest is applied. I walk through the full four-step run in [From Training to Serving in One Pipeline Run](/writing/from-training-to-serving-in-one-pipeline-run/).

> [!warning] The resolve step reads the alias as it is right now
> Nothing pins the resolve step to the version the promote step just set. It asks for whatever `production` points at the moment it runs. In a single sequential workflow that is the version promoted one step earlier, but if two runs overlap, or someone moves the alias by hand mid-run, the committed `storageUri` is whichever version won. The manifest is the source of truth for serving; the alias is only the input.

## What it looks like running

The manual path in the docs is the clearest way to see the seam. With MLflow port-forwarded to `localhost:5000` and the `production` alias assigned in the UI:

```bash
export MLFLOW_TRACKING_URI=http://localhost:5000
python scripts/resolve_model_artifact_uri.py
```

```text
Resolved artifact URI: s3://mlflow-artifact-store-123-da/1/models/m-7065bfbb8b9f436fb9eafdcb97e192a9/artifacts/
```

That string goes into `storageUri`, the manifest is applied, and KServe (installed in `RawDeployment` mode via the Helm charts, v0.16.0) creates the predictor. At pod startup the storage initializer downloads the artifact directory from S3 using `s3-sa`, MLServer loads the PyFunc, and the model signature is enforced on incoming requests. The tracking server is not in that sequence at any point.

```bash
kubectl get inferenceservice housing-model
```

```text
READY=True
```

From there inference is the V2 protocol — `POST /v2/models/housing-model/infer` through a port-forward to `svc/housing-model-predictor`, with each feature sent as a named tensor. V1's `:predict` endpoint is not available with the MLServer runtime, which is the only serving-side surprise in the setup.

The automated path, `argo submit argo/workflow.yml --watch`, runs the same chain as four pods: a new version in the registry, the alias moved, the URI resolved, and a commit on `main` that changes exactly one line of the manifest. It stops at the push. Nothing in the repository applies that commit to the cluster, so the `kubectl apply` is still a manual step, or the hook for whatever GitOps controller you put in front of it.

## Takeaways

- A registry alias is a pointer that only MLflow can dereference. KServe needs the dereferenced value, a literal `storageUri`, so something has to resolve the alias before the manifest is written.
- Do the resolution at promotion time, not at serving time. Then inference pods depend on S3 alone, and the tracking server (and the database behind it) can go down without touching serving.
- Resolution is cheap because the artifact is self-contained. Bundling preprocessing and `src/` into the PyFunc is what lets MLServer load it from a bare S3 prefix with no registry lookups — the packaging decision and the serving decision are the same decision, which is why I treat the artifact as the thing to version in [The Model Isn't the Only Thing That Needs to Be Versioned](/writing/the-model-isnt-the-only-thing-that-needs-to-be-versioned/).
- Treat the `storageUri` as immutable and the manifest as the source of truth for what is serving. Promotion is: move the alias, resolve it, commit the path. Nothing in serving moves unless you move it.
- Keep the resolve step dumb. Two registry calls and a file write. The moment it starts making decisions, the control plane and the serving plane are coupled again, just through a different door.
