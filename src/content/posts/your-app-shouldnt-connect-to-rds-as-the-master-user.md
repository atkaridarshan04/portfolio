---
title: "Your App Shouldn't Connect to RDS as the Master User"
deck: "A Proper Credential Pattern on EKS"
description: "A migrator/app role split on RDS Postgres, passwords that never sit in Terraform state or a SQL statement, and the Pod Identity, ESO and Reloader chain that gets a rotation into a running pod."
date: 2026-10-26
updated: 2026-11-14
tags: ["AWS", "EKS", "Postgres", "Terraform", "DevOps", "Security"]
repo: "https://github.com/atkaridarshan04/eks-rds-credential-patterns"
files:
  - "terraform/modules/db-credentials/main.tf"
  - "terraform/modules/db-credentials/scripts/bootstrap.py"
  - "terraform/main.tf"
  - "k8s/demo-app/external-secret-app.yaml"
  - "k8s/demo-app/deployment.yaml"
  - ".github/workflows/rotate-credentials.yml"
---

Most apps on EKS connect to RDS with either the master credential or a single shared password that's been copy-pasted into every service's config and never rotated. Both mean the same thing in practice — a leaked secret is full database access, no scope, no blast radius boundary. The pattern that actually holds up has a few moving parts, and the interesting ones are not the obvious choices. I built a reference implementation to pin them down; this is a walk through the decisions in it.

![The credential chain on EKS: RDS master used once by a bootstrap Job, migrator and app roles in Secrets Manager, ESO and Reloader delivering the app credential to the Deployment](/writing/your-app-shouldnt-connect-to-rds-as-the-master-user/rds-credential-pattern-eks-architecture.png)

## The master user is the person who provisioned the database

The master user is not an application identity. It owns every database on the instance and can create and drop roles. When an app connects as it, a compromised pod has the same reach as the engineer who ran the first `terraform apply` — not because anyone decided that, but because nobody decided anything else. A shared app user that owns its own schema is only a little better: it can still `DROP TABLE` with the same credential it uses to `SELECT`.

In the implementation the master credential exists, but nothing in application config ever holds it. `manage_master_user_password = true` on the `aws_db_instance` hands the secret to RDS, which owns it and rotates it every seven days through its own control plane. Terraform never reads or writes it. The only reader is a bootstrap Job, and it reads it once, at apply time, to create the roles the applications will actually use.

## Two roles, because migrations and queries are different jobs

Each logical database gets a pair of roles. The migrator owns the database and runs DDL; migration tooling connects as it, at deploy time, for seconds. The app role gets DML only — `SELECT`, `INSERT`, `UPDATE`, `DELETE` — and is what the running service connects as, continuously, exposed to whatever the service is exposed to. The privilege each one holds matches when it runs. A leaked app credential lets an attacker read and write rows; it cannot create or drop a table.

The grants live in the bootstrap Job's script, run once per database as the master user.

```python title="terraform/modules/db-credentials/scripts/bootstrap.py"
        cur.execute(sql.SQL("GRANT ALL ON SCHEMA public TO {}").format(sql.Identifier(migrator_role)))
        cur.execute(sql.SQL("REVOKE CREATE ON SCHEMA public FROM PUBLIC"))

        cur.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(sql.Identifier(db_name), sql.Identifier(app_role)))
        cur.execute(sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(sql.Identifier(app_role)))
        cur.execute(
            sql.SQL("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {}").format(sql.Identifier(app_role))
        )
        cur.execute(
            sql.SQL("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {}").format(sql.Identifier(app_role))
        )
        # Covers tables the migrator creates later, with no re-run needed.
        cur.execute(
            sql.SQL("ALTER DEFAULT PRIVILEGES FOR ROLE {} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {}").format(
                sql.Identifier(migrator_role), sql.Identifier(app_role)
            )
        )
```

The `ALTER DEFAULT PRIVILEGES FOR ROLE <migrator>` line is the one that makes the split survive contact with a real codebase. Without it, every table a future migration creates is invisible to the app until someone remembers to re-grant. With it, anything the migrator creates in `public` is readable and writable by the app on creation. The same pair of grants covers sequences.

Two smaller things in the script matter more than their size. `CREATEROLE` does not grant the creator membership in the role it creates, so the Job runs `GRANT <role> TO CURRENT_USER` right after `CREATE ROLE` — that membership is what lets it later use the migrator as `OWNER` of the database and in `FOR ROLE`. And Postgres grants `CONNECT` to `PUBLIC` on every database by default, which would let one service's app role reach another service's database on the shared instance; the Job revokes it, but only for a database it just created, because on an existing database something else might be quietly relying on it.

> [!note] Workloads, not humans
> This pattern is for services. For people running ad hoc queries, the answer is a different one — short-lived per-person credentials — and I covered that in [Who Ran That Query](/writing/who-ran-that-query/).

## A password that is never in plaintext in two places at once

The obvious way to create a database password with Terraform is `random_password` plus a `postgresql_role` resource. That leaves the password in state and sends it to Postgres as a literal inside an `ALTER ROLE` statement. The implementation avoids both.

On the Terraform side, the password is an `ephemeral "random_password"`, which cannot be persisted, and it reaches Secrets Manager only through the write-only argument `secret_string_wo`.

```hcl title="terraform/modules/db-credentials/main.tf"
resource "aws_secretsmanager_secret_version" "this" {
  for_each = local.role_specs

  secret_id = aws_secretsmanager_secret.this[each.key].id

  secret_string_wo = jsonencode({
    username = each.value.role
    password = ephemeral.random_password.this[each.key].result
    host     = var.rds_endpoint
    port     = var.rds_port
    dbname   = each.value.database
  })
  secret_string_wo_version = lookup(var.password_versions, each.key, 1)
}
```

State holds the `secret_string_wo_version` integer and nothing else about the value. Bumping that integer is what pushes a new password — that single fact is what the whole rotation design below hangs on.

On the Postgres side, the bootstrap Job fetches the password from Secrets Manager and computes a SCRAM-SHA-256 verifier itself before it talks to the database.

```python title="terraform/modules/db-credentials/scripts/bootstrap.py"
SCRAM_ITERATIONS = 4096


def scram_sha_256_verifier(password: str, iterations: int = SCRAM_ITERATIONS) -> str:
    salt = secrets_module.token_bytes(16)
    salted_password = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations, dklen=32)
    client_key = hmac.new(salted_password, b"Client Key", hashlib.sha256).digest()
    stored_key = hashlib.sha256(client_key).digest()
    server_key = hmac.new(salted_password, b"Server Key", hashlib.sha256).digest()
    b64 = lambda raw: base64.b64encode(raw).decode("ascii")
    return f"SCRAM-SHA-256${iterations}:{b64(salt)}${b64(stored_key)}:{b64(server_key)}"
```

This is the SCRAM derivation (RFC 5802, applied to SHA-256 by RFC 7677): PBKDF2-HMAC-SHA256 over the password and a random salt, then `ClientKey`, `StoredKey` and `ServerKey` from the result. What Postgres stores for a SCRAM role is exactly that verifier string, and `ALTER ROLE ... PASSWORD` accepts it directly. So the SQL statement the Job sends contains a verifier, never the plaintext, and the plaintext is in exactly one place: the Secrets Manager version the app will read.

## Getting the secret into a pod without a restart script

Three pieces carry the credential from Secrets Manager to a running container, and none of them is a script someone has to remember to run.

### EKS Pod Identity, not IRSA

Every workload here that authenticates to AWS — the bootstrap Job, External Secrets Operator, the demo app's migrate Job — does it through EKS Pod Identity. An `aws_eks_pod_identity_association` ties an IAM role to a `(cluster, namespace, service account)` tuple. The trust policy names `pods.eks.amazonaws.com` as the principal; there is no OIDC provider to register, no trust-policy condition, no JWT audience string to keep in sync. AWS's own EKS guide now recommends Pod Identity over IRSA wherever it is available.[^1]

Each role is scoped to exactly the secret ARNs its workload needs. ESO's role sees every role secret this stack generates, and nothing else.

```hcl title="terraform/main.tf"
# ESO's ClusterSecretStore reads through this role, scoped to exactly these secrets.
data "aws_iam_policy_document" "external_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = [for arn in module.db_credentials.role_secret_arns : arn]
  }
}

module "external_secrets_pod_identity" {
  source = "./modules/pod-identity-role"

  name            = "${local.name}-external-secrets"
  cluster_name    = module.eks.cluster_name
  namespace       = var.external_secrets_namespace
  service_account = "external-secrets"
  policy_json     = data.aws_iam_policy_document.external_secrets.json
  tags            = local.tags
}
```

### External Secrets Operator mirrors, it does not rotate

ESO reads a Secrets Manager secret through a cluster-wide `ClusterSecretStore` and writes a Kubernetes Secret, re-syncing on a `refreshInterval`. It does not generate or rotate anything. The demo app's `ExternalSecret` templates the JSON fields into plain `DB_*` keys, so the app reads ordinary environment variables and knows nothing about Secrets Manager.

```yaml title="k8s/demo-app/external-secret-app.yaml"
spec:
  refreshInterval: 1m # short on purpose - shrinks the window between rotation and ESO noticing
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: demo-app-db-credentials
    creationPolicy: Owner
    template:
      engineVersion: v2
      data:
        DB_HOST: "{{ .host }}"
        DB_PORT: "{{ .port }}"
        DB_NAME: "{{ .dbname }}"
        DB_USER: "{{ .username }}"
        DB_PASSWORD: "{{ .password }}"
```

### Reloader restarts what reads the Secret once

A container that takes its password from an environment variable reads it once, at startup. A changed Kubernetes Secret does nothing to a running pod. Reloader is installed cluster-wide (`reloader.watchGlobally=true`) and performs a rolling restart of any workload that opts in with one annotation.

```yaml title="k8s/demo-app/deployment.yaml"
kind: Deployment
metadata:
  name: demo-app-backend
  namespace: demo-app
  annotations:
    reloader.stakater.com/auto: "true"
```

Put together: a rotation lands in Secrets Manager and Postgres within the same apply, the new secret version written first and the `ALTER ROLE` right behind it; the Kubernetes Secret catches up on ESO's next tick, and the pods catch up when Reloader rolls them after that. Those are two separate gaps, not one. The `refreshInterval` of a minute keeps the first short; Reloader only closes the second.

In that window a pod still holding the old password fails its connect on every request, and the demo handler answers HTTP 500 with `{"status": "error"}`. Reloader's rollout is what ends it.

The one workload that skips this chain is the migrate Job. Reloader does not watch Jobs — they are not restarted, they run once and exit — so routing a one-shot Job through ESO buys nothing. It fetches the migrator secret directly with its own Pod Identity role, scoped to that one ARN, and connects.

## Rotation is a scheduled apply, not a Lambda

Secrets Manager has native scheduled rotation, and for anything other than the RDS master it needs a Lambda, because Secrets Manager does not know how to speak Postgres. That Lambda looks like the right tool and is the wrong one here.

The problem is ownership. Terraform already writes the secret, and Terraform's version bump is an unstaged overwrite. A rotation Lambda runs the staged `AWSPENDING` to `AWSCURRENT` protocol with a `testSecret` step in the middle. A version bump landing mid-rotation pulls the rug out from under that test. Two owners of one secret is the hazard, not the Lambda itself.

So Terraform stays the only writer, and "scheduled" comes from scheduling the apply. A GitHub Actions workflow increments a counter file, regenerates `rotation.auto.tfvars` from it, applies, and commits both back.

```yaml title=".github/workflows/rotate-credentials.yml"
      - name: bump rotation generation
        run: |
          gen=$(( $(cat .rotation-generation 2>/dev/null || echo 0) + 1 ))
          echo "$gen" > .rotation-generation
          versions=$(for k in ${ROLE_KEYS//,/ }; do printf '%s = %s, ' "$k" "$gen"; done)
          echo "password_versions = { ${versions%, } }" > rotation.auto.tfvars

      - name: terraform apply
        run: terraform apply -auto-approve
```

The committed files are the source of truth, so a local `terraform apply` sees the same value the last scheduled run left — no drift between state and the repo. In the apply, the bumped `password_versions` changes `secret_string_wo_version`, which writes a new Secrets Manager version, and it also feeds the hash that names the bootstrap Job, which forces a new Job to run and re-`ALTER` the roles with fresh verifiers.

```hcl title="terraform/modules/db-credentials/main.tf"
# Keyed off role topology, password_versions, and bootstrap.py's own hash - editing the script also forces a new Job.
locals {
  bootstrap_trigger = sha1(jsonencode({
    roles    = local.role_specs
    versions = var.password_versions
    script   = filesha256("${path.module}/scripts/bootstrap.py")
  }))
}

resource "kubernetes_job_v1" "bootstrap" {
  metadata {
    name      = "db-bootstrap-${substr(local.bootstrap_trigger, 0, 10)}"
    namespace = kubernetes_namespace_v1.this.metadata[0].name
  }
```

> [!warning] The master is the exception, not the model
> RDS rotates the master password through its own control plane, with no Lambda and no second writer. That is why it is fine to leave that one on native seven-day rotation while every other credential goes through Terraform.

## What a rotation looks like

The workflow carries a monthly cron, commented out for now, so rotation runs on manual dispatch. To watch the mechanism fire, do what the workflow does.

```bash
echo 'password_versions = { appdb_migrator = 99, appdb_app = 99 }' > terraform/rotation.auto.tfvars
terraform -chdir=terraform apply
kubectl rollout status deployment/demo-app-backend -n demo-app
```

The apply writes a new version of both secrets, then a new `db-bootstrap-<hash>` Job appears and runs `ALTER ROLE` for both roles. Within a minute ESO rewrites `demo-app-db-credentials`, Reloader notices the change and rolls `demo-app-backend`, and the rollout status shows a new generation. Nobody touched a pod.

The demo app reconnects on every request rather than holding a pool, so a `200` after the roll proves the live credential works, not whatever was valid at pod start.

```bash
kubectl port-forward -n demo-app svc/demo-app-backend 8080:80
curl localhost:8080
```

```text
{"status": "ok", "greeting": "Docker"}
```

That row was seeded by the migrate Job as `appdb_migrator` and read back by the Deployment as `appdb_app` — the whole chain, end to end, under two roles that neither of them could have created.

## Takeaways

- The app role should not be able to change the schema it queries. Split migrator from app, and use `ALTER DEFAULT PRIVILEGES FOR ROLE <migrator>` so the split survives the next migration.
- A password should exist in plaintext in one place. Ephemeral values and write-only arguments keep it out of state; a SCRAM verifier keeps it out of the SQL.
- Pod Identity scoped to exact secret ARNs is less to maintain than IRSA and tighter than a node role.
- ESO moves secrets, Reloader restarts consumers, and neither rotates anything. Rotation has to come from the one component that owns the secret.
- Native Secrets Manager rotation and Terraform-managed secrets do not compose. Pick one writer; if it is Terraform, schedule the apply.

[^1]: The reasoning in `docs/architecture.md` of the repo cites the EKS user guide's recommendation to use Pod Identity for pod access to AWS resources wherever possible, with IRSA remaining relevant mainly where Pod Identity is unavailable, such as self-managed Kubernetes or EKS Anywhere.
