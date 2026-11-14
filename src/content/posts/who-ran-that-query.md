---
title: "Who Ran That Query"
deck: "Ending Shared Database Passwords with Vault Dynamic Secrets"
description: "Most teams manage database access the same way: one shared username and password, handed to every developer, rotated rarely if ever. It works, until you need to answer a simple…"
date: 2026-09-30
tags: ["Vault", "Secrets Management", "DevSecOps", "Security", "DevOps"]
linkedin: "https://www.linkedin.com/feed/update/urn:li:activity:7510918100138221568/"
source: "Tech/LinkedIn Posts/AWS/Who Ran That Query - Ending Shared Database Passwords with Vault Dynamic Secrets.md"
---

Most teams manage database access the same way: one shared username and password, handed to every developer, rotated rarely if ever. It works, until you need to answer a simple question, who actually ran that query last Tuesday, and there's no good answer because everyone was using the same login.

The alternative is to stop handing out the password at all. With Vault's dynamic secrets engine, a developer doesn't get a permanent credential, they request one when they need it. Vault creates a real database user on the spot, tied to that specific person, and hands back a username and password that only exist for a limited time.

A few things fall out of that naturally:

- the username itself encodes who asked for it, not just a generic role name
- the credential comes with a lease, it expires on its own, no one has to remember to rotate or revoke it
- if it's compromised, it's already scoped to a short window instead of being valid indefinitely
- Vault's own log shows who requested access and when, and the database's log shows what that exact credential did, the two correlate by username to give a full picture neither one has alone

None of this requires the developer to know the real admin credential exists. Their access is "permission to ask Vault for a temporary one," not "permission to log in directly."

The real shift here isn't about the tooling, it's about moving from who has the password to who requested access, when, and for how long. That's the question that actually holds up when someone needs to look back at what happened later.

What other approaches have you used for managing shared database access, would like to hear how others have handled this.

![vault dynamic db credentials ui](/writing/who-ran-that-query/vault-dynamic-db-credentials-ui.png)
