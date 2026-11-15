---
title: "The Model Isn't the Only Thing That Needs to Be Versioned"
deck: "Training-Serving Skew in MLOps"
description: "Why a model file, a fitted encoder and API-side feature code drift apart, and how bundling them into one MLflow PyFunc artifact with code_paths makes a version mean all three."
date: 2026-10-26
updated: 2026-11-14
tags: ["MLOps", "Machine Learning", "MLflow", "Python", "Kubernetes"]
repo: "https://github.com/atkaridarshan04/mlops-platform-blueprint"
files:
  - pipelines/train.py
  - src/inference/pipeline.py
  - src/preprocessing/encoding.py
  - src/preprocessing/feature_engineering.py
  - argo/template.yml
  - k8s/workloads/inference-service.yml
---

Most ML projects start the same way: train a model, save it, load it in an API, done. It works for a while.

Mine did too. The early serving layer in [mlops-platform-blueprint](https://github.com/atkaridarshan04/mlops-platform-blueprint) loaded a trained model, a fitted imputer and a fitted encoder as three separate artifacts, and ran the feature engineering in the API's own code. The README still keeps that stage around as the `api-baseline` branch. Nothing about it was wrong on the day it shipped. The problem was what it allowed to happen on every day after.

## Where the skew comes from

A model never sees raw rows. It sees the output of a chain: fill `total_bedrooms` with a median, one-hot encode `ocean_proximity`, derive a few ratios. Every step in that chain has two parts — state that was fitted on the training data (the median, the list of categories) and code that applies it. The trained weights only make sense relative to that exact chain. Change any link and the numbers landing in the model mean something slightly different from what it learned.

Training-serving skew is what you get when the chain that ran at training time and the chain that runs at request time stop being the same chain. In the original layout they were one package, `src/preprocessing`, imported from two places: the training script and the API image. Same code in the repo, two deployments of it, and the API image was built from whatever commit was checked out at build time, with nothing tying that to the training run. [docs/codebase/model-packaging.md](https://github.com/atkaridarshan04/mlops-platform-blueprint/blob/main/docs/codebase/model-packaging.md) lists what that invited — preprocessing logic in the API diverging from training, version mismatches between the preprocessing artifacts and the model on retrain or rollback, and inference code tightly coupled to preprocessing internals.

The nasty part is that nothing fails loudly. The encoder is built with `handle_unknown='ignore'`:

```python title="src/preprocessing/encoding.py"
def fit_one_hot_encoder(df: pd.DataFrame, column: str) -> OneHotEncoder:
    # Fit OneHotEncoder on a single categorical column.
    ohe = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
    ohe.fit(df[[column]])
    return ohe
```

That is the right setting for a serving path — a category the encoder never saw should not take the API down. It also means that if the API is holding an encoder fitted on a different run than the model, a mismatched category does not raise. It encodes to zeros and the model predicts on it. The request returns 200 with a number in it. There is no stack trace for this; there are only metrics that look slightly off and no obvious cause.

## Why separate artifacts drift

Count the moving parts in the old layout: a model file, an imputer file, an encoder file, and the feature engineering functions compiled into the API image. Four things, each with its own lifecycle, and nothing describing them together: training saved the three fitted objects to `artifacts/production/` and the API loaded them from that directory, so a version was whatever happened to be in a folder.

Retraining regenerates all three fitted objects. If the deploy step copies the new model and forgets the encoder — or copies both but the API image was built last week from a different `src/` — the chain is broken and nothing tells you. The feature code is the worst of the four, because it is not an artifact at all. It ships on the API's release cadence. A one-line change to a ratio is invisible to every artifact:

```python title="src/preprocessing/feature_engineering.py"
def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    # Add domain-specific engineered features.
    df = df.copy()

    # Avoid division by zero
    df["rooms_per_household"] = df["total_rooms"] / df["households"].replace(0, np.nan)
    df["bedrooms_per_room"] = df["total_bedrooms"] / df["total_rooms"].replace(0, np.nan)
    df["population_per_household"] = df["population"] / df["households"].replace(0, np.nan)

    return df
```

Edit that `replace(0, np.nan)` guard, or the order of operations, in the API only, and every model it serves is now being fed features it was not trained on. Rollback makes it worse rather than better. Put the previous `model.joblib` back and you have rolled back the weights. The encoder in the API is still the new one. The feature code is still the new one. A rollback that only covers one of four coupled parts is not a rollback; it is a different, untested combination.

The fix is not more discipline in the deploy checklist. It is removing the possibility of the parts being on different versions.

## One artifact, one version

Everything the model needs at inference time now lives in one object. The class is small:

```python title="src/inference/pipeline.py"
from src.preprocessing.imputation import apply_imputer_transformation
from src.preprocessing.encoding import apply_one_hot_encoder
from src.preprocessing.feature_engineering import add_engineered_features

class HousingInferencePipeline(mlflow.pyfunc.PythonModel):
    def __init__(self, imputer, encoder, model):
        self.imputer = imputer
        self.encoder = encoder
        self.model = model

    def preprocess(self, df: pd.DataFrame) -> pd.DataFrame:
        df = apply_imputer_transformation(df, "total_bedrooms", self.imputer)
        df = apply_one_hot_encoder(df, "ocean_proximity", self.encoder)
        df = add_engineered_features(df)
        return df

    def predict(self, context, model_input: pd.DataFrame, params=None):
        X = self.preprocess(model_input)
        return self.model.predict(X)
```

The fitted imputer, the fitted encoder and the trained regressor are attributes, so they are serialized with the object. The feature engineering is imported from `src`, which is the same module the training script uses. The `predict(self, context, model_input, params=None)` signature is the canonical PyFunc contract; the packaging doc calls it out as mandatory for MLServer and the KServe V2 protocol, which matters later.

The training pipeline fits each transformer on the training split, applies it, trains the model, then hands the fitted pieces to the wrapper and logs it:

```python title="pipelines/train.py"
inference_pipeline = HousingInferencePipeline(
    imputer=imputer,
    encoder=encoder,
    model=model,
)

input_example = X_raw_train.iloc[:3].copy()
pred_example = inference_pipeline.predict(None, input_example)
signature = infer_signature(input_example, pred_example)

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

Three arguments do the work.

`code_paths=["src"]` copies the whole `src/` directory into the logged artifact. That is where `add_engineered_features` and the encoder helpers live, so the artifact carries the exact source that was imported when the model was trained — not whatever `src/` looks like on the serving host, and not a copy deployed separately. The code cannot drift while the model sits in the registry waiting for promotion because the code is inside the thing being promoted.

`signature` is inferred from `X_raw_train.iloc[:3]` — the raw columns, before any preprocessing. The contract the artifact enforces at the boundary is therefore the raw input schema. Callers send `ocean_proximity` as a string, not as encoded columns. The artifact is responsible for everything after that.

`pip_requirements="requirements.txt"` pins the environment the fitted objects were pickled under alongside them. The training image runs Python 3.10 specifically because that matches serving, per the training workflow doc, so the serialized transformers unpickle under the same versions they were written with.

> [!note] Absolute imports are not optional here
> Every import inside the bundle is written as `from src.preprocessing...`, never relative. The packaging doc enforces this because the artifact is loaded by a runtime that knows nothing about the repository layout — `src` has to resolve as a top-level package from inside the artifact.

The packaging doc states what a single model version now represents: the exact fitted preprocessing, the exact feature engineering logic, the exact trained parameters and the exact code dependencies. There is no "which encoder goes with model version 7" question because they were never separate.

![MLflow PyFunc inference pipeline bundle: fitted imputer, fitted encoder, trained model and the src/ code packaged as one registered artifact](/writing/the-model-isnt-the-only-thing-that-needs-to-be-versioned/mlflow-pyfunc-inference-pipeline-bundle.png)

## What it looks like running

Training runs as an ephemeral Kubernetes Job, or as the first step of the Argo workflow. Either way the container clones the repo, runs `dvc pull data/raw/housing.csv`, then `python -m pipelines.train`. The run lands under the `california_housing_price` experiment and registers a new version of `CaliforniaHousingRegressor`. [docs/mlflow.md](https://github.com/atkaridarshan04/mlops-platform-blueprint/blob/main/docs/mlflow.md) lists what each run logs: the unified PyFunc model, its signature, the bundled source, the environment spec, and the DVC dataset hash, which `pipelines/train.py` sets as a `data_dvc_md5` tag so the version traces back to the exact data too.

Promotion is one registry call. In the Argo pipeline it is the entire promote step:

```yaml title="argo/template.yml"
import os
from mlflow.tracking import MlflowClient
version = int(os.environ["MODEL_VERSION"].strip())
client = MlflowClient(os.environ["MLFLOW_TRACKING_URI"])
client.set_registered_model_alias(name=os.environ["MODEL_NAME"], alias="production", version=version)
```

Rollback is the same call with an earlier version number. Because the version is the whole bundle, pointing `production` at version 6 brings back version 6's imputer, encoder and feature code along with version 6's weights — in one operation, with no second system to keep in step.

KServe cannot read an alias, so the next step resolves it to the physical S3 path the artifact was uploaded to:

```bash
export MLFLOW_TRACKING_URI=http://localhost:5000
python scripts/resolve_model_artifact_uri.py
```

```text
Resolved artifact URI: s3://mlflow-artifact-store-123-da/1/models/m-7065bfbb8b9f436fb9eafdcb97e192a9/artifacts/
```

That path goes into the InferenceService — by hand, or committed by the workflow's last step. I wrote up the resolution step on its own in [MLflow knows where the model is, KServe doesn't care](/writing/mlflow-knows-where-the-model-is-kserve-doesnt-care/), and the full train-promote-resolve-commit chain in [From training to serving in one pipeline run](/writing/from-training-to-serving-in-one-pipeline-run/).

```yaml title="k8s/workloads/inference-service.yml"
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

At startup KServe downloads that prefix from S3 and MLServer loads the PyFunc model out of it, bundled `src/` included. The inference pod never talks to MLflow — it only reads S3. Registry outages do not affect serving, and a serving pod cannot be running code from anywhere other than the artifact it was pointed at.

A request carries raw columns, including the categorical one as bytes:

```bash
curl -X POST http://127.0.0.1:8000/v2/models/housing-model/infer \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": [
      { "name": "longitude", "shape": [1], "datatype": "FP64", "data": [-122.23] },
      { "name": "latitude", "shape": [1], "datatype": "FP64", "data": [37.88] },
      { "name": "housing_median_age", "shape": [1], "datatype": "FP64", "data": [41] },
      { "name": "total_rooms", "shape": [1], "datatype": "FP64", "data": [880] },
      { "name": "total_bedrooms", "shape": [1], "datatype": "FP64", "data": [129] },
      { "name": "population", "shape": [1], "datatype": "FP64", "data": [322] },
      { "name": "households", "shape": [1], "datatype": "FP64", "data": [126] },
      { "name": "median_income", "shape": [1], "datatype": "FP64", "data": [8.3252] },
      { "name": "ocean_proximity", "shape": [1], "datatype": "BYTES", "data": ["NEAR BAY"] }
    ]
  }'
```

MLServer validates the V2 tensors, converts them to a DataFrame, and calls `predict`. Imputation, encoding and the ratio features all happen inside the artifact, with the transformers that were fitted in the same run as the weights. The caller has no preprocessing to get wrong.

Batch inference uses the identical artifact through the registry indirection instead — `mlflow.pyfunc.load_model("models:/CaliforniaHousingRegressor@production")` and `model.predict(df)` on the raw CSV. One bundle, two consumers, zero duplicated feature code.

> [!warning] The bundle moves the contract, it does not remove it
> The signature is on raw input. Rename a raw column upstream and the artifact will reject the request at the boundary instead of silently producing garbage — which is the point — but it means the raw schema is now the interface you version against, not the engineered one.

## Takeaways

- The deployable unit is the function from raw input to prediction, not the weights. Fitted transformers and feature code are part of that function and must share its version.
- `code_paths` is what makes the version honest. Without it the artifact pins the state but not the code that applies it, and code is the part that changes on a different cadence.
- Infer the signature from raw rows, before preprocessing. That pushes the contract to the edge of the bundle and keeps preprocessing out of every caller.
- A rollback is only atomic if everything it needs to undo lives in the thing being rolled back. Re-pointing an alias is atomic for the bundle; it was never atomic for a model file plus an API.
- Serving should read the resolved artifact, not the registry. The registry decides what is current; the artifact is what runs.
