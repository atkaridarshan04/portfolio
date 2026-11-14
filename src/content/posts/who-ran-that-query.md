---
title: "Who Ran That Query"
deck: "Ending Shared Database Passwords with Vault Dynamic Secrets"
description: "Replacing a shared Postgres password with per-engineer, short-lived Vault credentials, and the revocation and audit details that decide whether it actually works."
date: 2026-09-30
updated: 2026-11-14
tags: ["Vault", "Secrets Management", "DevSecOps", "Security", "DevOps"]
linkedin: "https://www.linkedin.com/feed/update/urn:li:activity:7510918100138221568/"
---

Most teams manage database access the same way: one shared username and password, handed to every developer, rotated rarely if ever. It works, until you need to answer a simple question — who actually ran that query last Tuesday — and there's no good answer because everyone was using the same login.

## The log says appuser, which is everyone

The concrete version: someone ran `DELETE FROM orders WHERE ...` against a nonprod Postgres on RDS at 14:03 on a Tuesday. The database log names the user, `appuser`. That is the shared login every engineer has in a `.env` file, so the log has told you nothing. There is no second source of truth to correlate against, because nowhere in the chain is there a per-person identity.

The same gap shows up in quieter ways. You can't scope access per environment without minting more shared users. You can't revoke one person without rotating everyone. You can't show a reviewer that a contractor never had write access, because the one credential they held could do everything.

The credential is the identity, and a shared credential has no identity.

## What Vault actually does

Vault's database secrets engine connects to Postgres with one admin-level account that only Vault holds. From then on nobody asks for the password. They ask Vault for a credential, and Vault creates a real Postgres login role on the spot, named after the requester, scoped to a set of databases, valid for a few hours.

Four pieces of vocabulary carry the whole thing:

- **Connection** — the one admin credential Vault uses to talk to the database. Configured once, never handed out.
- **Role** — a template: which SQL to run to create the login, which privileges it gets, how long it lives.
- **Lease** — Vault's record of one issued credential and when it expires.
- **Revocation statements** — what Vault runs when the lease ends, so the login stops existing instead of going stale.

The flow is five steps. The engineer authenticates to Vault with their IdP identity. Vault runs `CREATE ROLE ... IN ROLE grp_*` against Postgres. Vault returns a username, a password and a lease. The engineer uses `psql` for the life of the lease. Vault runs `DROP ROLE` on expiry.

The piece that makes the audit story work is one connection-level setting, `username_template`. With `v_{{.DisplayName}}_{{random 8}}`, every credential minted over that connection is named `v_<caller identity>_<random>`. The identity is whatever the caller's auth method gave Vault; through `userpass` it reads `v_userpass-alice_9f3ac1b2`. That string is what the database log will print. Request a credential with the root token instead and you get `v_token_xxxxxxxx`, because root has no per-human identity to embed — which is also why a shared `userpass` account would just reintroduce the original problem with a different prefix. The audit trail is only as good as the identity Vault has.

What an engineer holds is no longer the password. It's permission to ask Vault for a temporary credential of a given scope. They never learn that a privileged credential exists.

## Decisions that are expensive to change later

### Scope by tier, not one blanket role

One Vault role per access tier, where a tier is a boundary you would actually enforce. Across three environment databases:

| Vault role | Access | Reaches |
|---|---|---|
| `reader` | Read-only | `app_dev`, `app_qa`, `app_prod` |
| `dev-rw` | Read-write | `app_dev` |
| `qa-rw` | Read-write | `app_qa` |
| `admin` | Read-write, DML/DQL only | all three |

A misused credential can't reach outside its tier, and a new database becomes one more independent role rather than a widened existing one. There's no `prod-rw` on purpose: routine write access to production isn't something most engineers should hold on demand, so it goes through `admin`, mapped to a much smaller group. A single-database team needs only `reader` and `writer`. The anti-pattern isn't few roles, it's roles whose boundaries don't match anything you'd want to isolate.

### Privileges through group membership, never DDL

The database groundwork runs once, from one connection to the administrative database, because `CREATE ROLE` and `GRANT` on databases are cluster-wide.

```sql title="db/groundwork.sql"
CREATE ROLE vault_admin WITH LOGIN PASSWORD '<bootstrap-password>' CREATEROLE NOINHERIT;

CREATE ROLE grp_readonly  NOLOGIN;
CREATE ROLE grp_dev_write NOLOGIN;
CREATE ROLE grp_qa_write  NOLOGIN;
CREATE ROLE grp_admin     NOLOGIN;

GRANT pg_read_all_data TO grp_readonly;
GRANT pg_read_all_data, pg_write_all_data TO grp_dev_write;
GRANT pg_read_all_data, pg_write_all_data TO grp_qa_write;
GRANT pg_read_all_data, pg_write_all_data TO grp_admin;

GRANT grp_readonly  TO vault_admin WITH ADMIN OPTION;
GRANT grp_dev_write TO vault_admin WITH ADMIN OPTION;
GRANT grp_qa_write  TO vault_admin WITH ADMIN OPTION;
GRANT grp_admin     TO vault_admin WITH ADMIN OPTION;
```

`vault_admin` is not a superuser, not the RDS master user, not an object owner. `CREATEROLE` lets it create logins, `WITH ADMIN OPTION` lets it grant membership in exactly these groups, and `NOINHERIT` stops it from using the groups' privileges itself. `pg_read_all_data` and `pg_write_all_data` (PG14+) cover every table, view and sequence in the connected database, including ones created later, so there's no per-schema bookkeeping as the schema evolves.

The write tiers get no DDL, deliberately. `CREATE TABLE` isn't a grantable privilege in Postgres; it's gated by ownership, and whoever runs it owns the result. Ownership is per-database and Vault's admin connection only talks to one, so a temporary role that creates an object elsewhere can't be dropped at lease expiry and the lease sticks. DML/DQL-only means nothing a credential does creates ownership, so `DROP ROLE` always succeeds. Schema changes belong to migration tooling with its own service account.

### CONNECT scoping is what enforces the split

Postgres grants `CONNECT` to `PUBLIC` on every database by default. Leave that alone and every group role reaches every database regardless of tier; the table above is cosmetic. This is the most commonly skipped step, and skipping it produces a system that looks correct and isn't. The fix is a maintenance-window job in three stages, and the order matters.

```sql
-- a. re-grant CONNECT explicitly to every active login role first
GRANT CONNECT ON DATABASE app_prod TO <existing_app_user>;
-- ...every application / migration / monitoring / BI account

-- b. then per group role
GRANT CONNECT ON DATABASE app_dev TO grp_dev_write;
GRANT CONNECT ON DATABASE app_qa  TO grp_qa_write;
GRANT CONNECT ON DATABASE app_dev, app_qa, app_prod TO grp_readonly;
GRANT CONNECT ON DATABASE app_dev, app_qa, app_prod TO grp_admin;

-- c. only now revoke PUBLIC, one database at a time
REVOKE CONNECT ON DATABASE app_dev  FROM PUBLIC;
REVOKE CONNECT ON DATABASE app_qa   FROM PUBLIC;
REVOKE CONNECT ON DATABASE app_prod FROM PUBLIC;
```

> [!warning] Revoking PUBLIC cuts off every role that relied on the default
> Existing service accounts have never needed an explicit `CONNECT` grant. The instant `REVOKE ... FROM PUBLIC` runs, any role without one is cut off mid-traffic. Monitoring exporters and BI tools are the usual casualties, because nobody thinks of them as database users. `SELECT rolname FROM pg_roles WHERE rolcanlogin;` is the list to work through, exhaustively, before the first revoke. Then revoke one database at a time and verify existing traffic still connects after each.

### Vault's side

```bash
vault secrets enable database

vault write database/config/primary \
  plugin_name=postgresql-database-plugin \
  allowed_roles="reader,dev-rw,qa-rw,admin" \
  connection_url="postgresql://{{username}}:{{password}}@<DB_HOST>:5432/<ADMIN_DB>?sslmode=require" \
  username="vault_admin" \
  password="<bootstrap-password>" \
  username_template="v_{{.DisplayName}}_{{random 8}}"

vault write -f database/rotate-root/primary
```

`rotate-root` invalidates the bootstrap password you just typed and replaces it with a value Vault never displays. Run it immediately; a bootstrap password lingering in shell history is exactly the standing credential this exists to eliminate. Vault's own connection stays a password, by the way. The Postgres plugin supports IAM tokens only for GCP Cloud SQL, and RDS IAM tokens expire every 15 minutes with no mechanism to refresh the plugin's root connection. JIT applies to what Vault hands out, not to Vault.

Then one role per tier, differing only in `IN ROLE`:

```bash
vault write database/roles/dev-rw \
  db_name=primary \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}' IN ROLE grp_dev_write;" \
  revocation_statements="DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="4h" max_ttl="8h"
```

Four hours by default, renewable to eight, suits interactive human access: it survives a working session and not a weekend. Shorter is better for blast radius and worse for ergonomics. If people start scripting around re-requests, it's too short and they'll hoard credentials instead. Applications belong on a separate path with a machine-identity auth method, much shorter TTLs and automatic renewal; letting an application borrow a human tier collapses the identity distinction the whole design rests on.

> [!warning] Unset revocation_statements is not "plain DROP ROLE"
> Leave it unset and Vault runs `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "{{name}}"` before the drop. That requires `vault_admin` to own or hold `GRANT OPTION` on every table in `public`. It doesn't, on application-owned tables, and a migration tool's lock table (Liquibase's `databasechangeloglock`) bites first. The revoke fails with `permission denied ... (SQLSTATE 42501)`, `DROP ROLE` never runs, Vault retries six times, marks the lease irrevocable and stops. The login stays alive indefinitely and nothing alerts.
>
> `DROP ROLE IF EXISTS` on its own is sufficient here because every privilege arrived through `IN ROLE` membership, and Postgres drops the membership rows with the role. The no-DDL rule above is what keeps that true.

Finally, who can request what. One policy per tier, attached to IdP groups:

```hcl title="vault/policies/db-dev-rw.hcl"
path "database/creds/dev-rw" {
  capabilities = ["read"]
}

# list and read are independent capabilities on different paths;
# seeing a role name carries no access to it.
path "database/roles" {
  capabilities = ["list"]
}
```

One trap in the group mapping: writing `value=...` on an auth method's team mapping replaces the group's policy list rather than appending to it. Omit a policy that was already there and you've silently removed that access while believing you only added a grant. Always restate the full list.

## What it looks like running

```bash
vault login -method=github token=<pat>
vault read database/creds/dev-rw
```

```text
lease_id           database/creds/dev-rw/AbCdEf123456
lease_duration     4h
password           A1b2-C3d4-E5f6-G7h8
username           v_github-jsmith_9f3ac1b2
```

```bash
psql -h <DB_HOST> -p 5432 -U v_github-jsmith_9f3ac1b2 -d app_dev "sslmode=require"
```

That credential reaches `app_dev` and nothing else. Pointing it at `app_qa` comes back `FATAL: permission denied for database "app_qa"`, even though it was created over a connection to the administrative database. Reach is decided by the `CONNECT` grants and the group it joined, not by where the issuing connection points. When the engineer is done, `vault lease revoke` or just walk away. Revocation isn't a task anyone has to remember.

The same flow works in the UI: Secrets, `database/`, Roles, the role, Generate credentials. It needs slightly more policy than the CLI, because rendering the roles list and the role's detail page are separate reads, which is why the policy above carries `list`. The trade-off is that `list` exposes every role name under the mount, including ones the holder can't use.

![Vault UI generating a dynamic PostgreSQL credential for a developer role: username, password and lease duration](/writing/who-ran-that-query/vault-dynamic-db-credentials-ui.png)

### Two logs, one join key

Vault knows who it authorized; it has no visibility past handing the credential over. Postgres knows what the credential did; it knows nothing about who asked. The generated username is the join key.

```bash
vault audit enable file file_path=stdout elide_list_responses=true
vault secrets tune -audit-non-hmac-response-keys=username database/
```

Sensitive response fields are HMAC-hashed in the audit log by default. That's right for a log read by more people than the secrets it describes, but it means the log alone can't say which username someone received, which is the correlation you need. The `secrets tune` exempts `username` only, on the `database/` mount only; `password` stays hashed. Never set `log_raw`, which disables hashing for every field. And note that Vault fails closed on audit failure: if every audit device fails to write, it blocks requests rather than serve them unaudited, so sampling the log to control cost is the wrong lever.

On the Postgres side, on RDS, it's a parameter-group change. `log_connections` and `log_disconnections` tie a generated username to a real session. pgAudit's `role` class covers `CREATE`/`ALTER`/`DROP ROLE` and `GRANT`/`REVOKE`, which is exactly the lifecycle of a JIT credential.

```hcl title="terraform/rds-parameter-group.tf"
parameter {
  name         = "shared_preload_libraries"
  value        = "pgaudit"
  apply_method = "pending-reboot"
}
parameter { name = "pgaudit.log"        value = "role" }
parameter { name = "log_connections"    value = "1" }
parameter { name = "log_disconnections" value = "1" }
```

After the reboot, `CREATE EXTENSION IF NOT EXISTS pgaudit;` in every audited database, including the administrative one, because that's where Vault runs `creation_statements` and so that's where the `CREATE ROLE` events land. `log_line_prefix` needs `%u` and `%d` or entries can't be tied to a role or database. `enabled_cloudwatch_logs_exports = ["postgresql"]` on the instance is what actually ships it; pgAudit has no separate export type.

> [!warning] Never use log_statement=all for this
> `creation_statements` literally runs `CREATE ROLE ... PASSWORD '{{password}}'`. With `log_statement=all`, every generated password lands in the log in plaintext and the audit log becomes a credential store. pgAudit's `role` class redacts it, with documented gaps: a failed `CREATE ROLE` can still leak the password into the error log. Generate a real credential and read the actual log line rather than assuming.

The proof is filtering the aggregator on one generated username and getting the `connection authorized` line, the `AUDIT: ... CREATE ROLE ... <REDACTED>` line, the disconnection line, and Vault's request/response pair naming the human.

### Trusting revocation

Vault reports an expired lease identically whether the drop succeeded or it gave up after retrying. The only reliable check is on the database side.

```sql
SELECT rolname, rolvaliduntil FROM pg_roles WHERE rolname LIKE 'v\_%' ESCAPE '\';
```

Empty is the expected result. A `v_` role whose `rolvaliduntil` has already passed is a revocation that failed silently; `vault read sys/leases/count type=irrevocable` is the Vault-side view of the same thing. Don't reach for `sys/leases/revoke-force` to clear it: that discards Vault's bookkeeping without running revocation, so the orphaned login stays behind with nothing in Vault pointing at it any more. Drop the roles directly first, then force-revoke. This check runs on a schedule, not once at rollout.

## Takeaways

- The credential is the identity. `username_template` with a real IdP identity behind it is the one field that lets a database log name a person; without it the rest is cosmetic.
- Tiers only exist once `CONNECT` is revoked from `PUBLIC`. Grant it explicitly to every existing login role first, then revoke one database at a time.
- Set `revocation_statements` explicitly on every role, and give JIT roles their privileges only through group membership so that `DROP ROLE IF EXISTS` is the whole story.
- Revocation can fail silently, a failure mode shared passwords never had. Budget for a recurring `pg_roles` check and an irrevocable-lease count as part of the design, not as an afterthought.
- This doesn't solve network access, what someone does inside a legitimate window, or Vault's own admin connection. Attribution is an investigation aid and a deterrent, not prevention.

The shift is from who has the password to who requested access, when, and for how long — the question that holds up when someone reconstructs events months later.
