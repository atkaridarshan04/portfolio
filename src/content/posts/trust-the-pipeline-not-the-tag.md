---
title: "Trust the Pipeline, Not the Tag"
deck: "Enforcing Image Provenance with Sigstore and Kyverno"
description: "A CVE scan can't tell you who built an image. Keyless cosign signing in GitHub Actions plus a Kyverno verifyImages policy make the cluster refuse anything else."
date: 2026-10-03
updated: 2026-11-14
tags: ["Sigstore", "Kyverno", "Supply Chain Security", "Kubernetes", "DevOps"]
repo: "https://github.com/atkaridarshan04/cloudnative-devops-blueprint/blob/main/docs/GitHubActions.md"
files:
  - ".github/workflows/ci.yml"
  - "kyverno/policies/verify-ghcr-image-signatures.yaml"
  - "docs/GitHubActions.md"
  - "docs/concepts/SupplyChainSecurity.md"
  - ".github/workflows/ci.md"
  - "docs/Kyverno.md"
---

An image tag tells Kubernetes what to pull. It says nothing about who built the thing being pulled.

## A tag is a pointer, not a receipt

Most pipelines treat the tag as enough: build it, scan it for CVEs, push it, and from then on the cluster trusts anything carrying that tag. The scan tells you what's inside the image. It never tells you whether what's running under that tag is still the thing the pipeline produced — nothing stops a quick local `docker build` and a push straight to the same tag to test a hotfix under pressure, or a stale image getting re-pushed by mistake. Kubernetes has no opinion either way. It pulls whatever the tag currently points to and runs it.

The Jenkins pipeline in my blueprint repo already runs Trivy, so "does this image have known CVEs" was a question I could answer. The question I couldn't answer was different: is the image in the cluster right now the exact, unmodified artifact the pipeline produced, or could it have been swapped, rebuilt, or pulled from somewhere else entirely? Trivy's output, printed to a console log, is also gone the moment the job finishes — no history, nothing to show anyone later. So I built a second pipeline in GitHub Actions, parallel to Jenkins rather than replacing it, that does three things the first one doesn't: persists the scan as SARIF in the Security tab, generates an SBOM with Syft, and signs each image with cosign so that Kyverno can refuse to admit anything that can't prove where it came from.

The rest of this post is about the signing and the refusing. The SBOM comes along for the ride because it uses the same mechanism.

## What a keyless signature actually attests

Traditional signing means generating a key, guarding it forever, and rotating it. A leaked key can forge any signature, so the key itself becomes the liability. Sigstore replaces the long-lived key with a short-lived, identity-bound certificate issued per signing event. There's no secret to leak because there's no secret.

The flow in GitHub Actions goes like this:

1. **OIDC token.** With `permissions: id-token: write`, the job can ask GitHub for a short-lived OIDC token asserting "this workflow, in this repo, on this ref, is running right now." That's a built-in GitHub Actions capability, not something Sigstore-specific.
2. **Fulcio.** Sigstore's certificate authority exchanges that token for an ephemeral x.509 certificate, valid for about ten minutes, binding the GitHub identity to a keypair generated on the fly for this one operation.
3. **cosign.** Signs the pushed image's digest with that ephemeral key, then discards the key. The digest, not the tag — the digest is tied to immutable content, the tag is not.
4. **Rekor.** A public, append-only transparency log, conceptually the same as Certificate Transparency for HTTPS. The certificate expires in minutes by design, so a verifier months later can't ask "is this cert currently valid." Rekor holds a permanent, timestamped entry proving the signature was made while the cert was genuinely valid. That entry is what makes an ephemeral certificate usable for verification indefinitely.
5. The signature, with a reference to its Rekor entry, is pushed back to the registry as an OCI artifact attached to the image.

The SBOM attestation reuses the same chain: instead of signing the raw digest, cosign signs a statement ("here is the SBOM for this digest") and attaches it the same way, so the inventory inherits the same tamper-evident, identity-bound guarantee as the image.

What the signature attests, then, is narrow and precise: *this exact digest was signed by a job running this exact workflow file, in this exact repo, on this exact ref.* Not "someone with a key signed it."

## Verifying at admission

Signing on its own is still paperwork until something checks it before a Pod runs. Kyverno already sits in the cluster's admission path for the `disallow-latest-tag` and `require-labels` policies, and a `verifyImages` rule adds one more gate on the same path. When a Pod creation request arrives, Kyverno's admission webhook:

- extracts the image reference and pulls the attached signature and certificate from the registry,
- verifies the certificate chains back to Sigstore's Fulcio root of trust and that a matching entry exists in Rekor,
- checks the certificate's identity claims against the issuer and subject configured in the policy,
- allows or denies the Pod on that match.

The third step is the one that matters most. It's not "is this signed by *some* Sigstore identity," it's "is this signed by *this* repo and *this* workflow." A perfectly valid keyless signature from anyone else's pipeline fails the check.

## The design in the repo

### The workflow

The whole thing needs zero stored secrets. The permissions block is where that shows up:

```yaml title=".github/workflows/ci.yml"
permissions:
  contents: read
  packages: write # push to GHCR
  id-token: write # OIDC token for cosign keyless signing
  security-events: write # upload Trivy SARIF to the Security tab
```

`packages: write` lets the built-in `GITHUB_TOKEN` push to GHCR. `id-token: write` is the entire requirement for keyless signing — GitHub's OIDC issuer is already trusted by Fulcio, so there's no app registration and no key pair.

The `build` job runs the repo's existing `docker-bake.hcl` unmodified, overriding only the tag at invocation time to `signed-<short-sha>`, and then pulls the pushed digests out of the bake action's metadata:

```yaml title=".github/workflows/ci.yml"
      - name: Extract pushed image digests
        id: digests
        run: |
          echo "frontend=$(jq -r '.frontend."containerimage.digest"' <<< '${{ steps.bake.outputs.metadata }}')" >> "$GITHUB_OUTPUT"
          echo "backend=$(jq -r '.backend."containerimage.digest"' <<< '${{ steps.bake.outputs.metadata }}')" >> "$GITHUB_OUTPUT"
```

Everything after that addresses images strictly as `$REF@$DIGEST`, never by tag. The second job runs as a two-way matrix over frontend and backend and does the scan, the SBOM, the signature and the attestation in order:

```yaml title=".github/workflows/ci.yml"
      - name: Generate SBOM (Syft)
        uses: anchore/sbom-action@v0
        with:
          image: ${{ env.REF }}@${{ env.DIGEST }}
          format: spdx-json
          output-file: ${{ matrix.image }}-sbom.spdx.json

      - uses: sigstore/cosign-installer@v3

      - name: Sign image (keyless via GitHub OIDC)
        run: cosign sign --yes "${REF}@${DIGEST}"

      - name: Attach SBOM attestation
        run: |
          cosign attest --yes \
            --predicate "${{ matrix.image }}-sbom.spdx.json" \
            --type spdxjson \
            "${REF}@${DIGEST}"
```

There's no `--key` flag on `cosign sign`. cosign detects it's running in GitHub Actions with `id-token: write` and does the OIDC to Fulcio to Rekor flow on its own.

> [!warning] The second job runs on its own runner
> The `scan-sbom-sign` job doesn't inherit the `build` job's Docker credentials, so it logs into GHCR again before signing. Without that login, `cosign sign` reaches Sigstore fine — the Rekor entry gets created — and then fails pushing the signature back to the registry with `UNAUTHORIZED: unauthenticated`. A signature that exists in the transparency log but never made it onto the image is indistinguishable from no signature at admission time.

### The policy

The Kyverno side is one `ClusterPolicy`, scoped to Pods in the `mern-devops` namespace whose image comes from the repo's GHCR path:

```yaml title="kyverno/policies/verify-ghcr-image-signatures.yaml"
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    - name: verify-signature
      match:
        any:
          - resources:
              kinds:
                - Pod
              namespaces:
                - mern-devops
      verifyImages:
        - imageReferences:
            - "ghcr.io/atkaridarshan04/cloudnative-devops-blueprint/*"
          attestors:
            - entries:
                - keyless:
                    issuer: "https://token.actions.githubusercontent.com"
                    subject: "https://github.com/atkaridarshan04/cloudnative-devops-blueprint/.github/workflows/ci.yml@refs/heads/main"
                    rekor:
                      url: https://rekor.sigstore.dev
```

The `subject` is the whole policy. It names the repo, the workflow file and the branch. `issuer` pins the identity provider to GitHub's OIDC endpoint, and `rekor.url` tells Kyverno which transparency log to check the entry against.

> [!note] The subject includes the branch
> The certificate Sigstore issues encodes the real ref the workflow ran on. A genuinely signed image built from a feature branch gets rejected by this policy for the same reason `cosign verify` with `@refs/heads/main` would — the subject doesn't match, not because the signature is broken. While I was testing on a feature branch I temporarily pointed that line at the branch, verified both cases, and reverted it before merging. One more detail worth being honest about: the workflow triggers on `v*` tag pushes and manual dispatch, with its push-to-`main` trigger commented out, so a tag-triggered build signs with a `@refs/tags/v…` subject that this policy would reject. The runs behind these screenshots were dispatches on `main`; widening the subject is a one-line change when releases move to tags.

## Running it: signed in, unsigned out

After a run, the digest that was actually signed is the top-level `Digest:` line from `docker buildx imagetools inspect` on the `signed-<sha>` tag — the OCI image index, not any of the per-platform or attestation manifests underneath it. Anyone can verify it without repo access; that's the point of a public log:

```bash
cosign verify \
  --certificate-identity "https://github.com/atkaridarshan04/cloudnative-devops-blueprint/.github/workflows/ci.yml@refs/heads/main" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  ghcr.io/atkaridarshan04/cloudnative-devops-blueprint/bookstore-frontend@<digest>
```

A valid signature prints the Rekor log entry and the certificate identity that signed it. The SBOM attestation comes back the same way through `cosign verify-attestation --type spdxjson`, and piping the payload through `jq -r '.payload' | base64 -d | jq '.predicate.packages | length'` is enough to prove it's a real inventory and not an empty statement.

Then the cluster. Apply the policy and confirm it registered:

```bash
kubectl apply -f kyverno/policies/verify-ghcr-image-signatures.yaml
kubectl get clusterpolicy verify-ghcr-image-signatures
```

The positive case — a real image from this pipeline, referenced by digest — should be admitted and reach `Running`:

```bash
kubectl run test-signed -n mern-devops \
  --image=ghcr.io/atkaridarshan04/cloudnative-devops-blueprint/bookstore-frontend@<real-digest>
kubectl get pod test-signed -n mern-devops
```

The negative case is the test that matters. The repo's existing `3.0.0` tag lives on the same GHCR path but predates this pipeline and was never signed:

```bash
kubectl run test-unsigned -n mern-devops \
  --image=ghcr.io/atkaridarshan04/cloudnative-devops-blueprint/bookstore-frontend:3.0.0
```

```text
Error from server: admission webhook "mutate.kyverno.svc-fail" denied the request:

resource Pod/mern-devops/test-unsigned was blocked due to the following policies

verify-ghcr-image-signatures:
  verify-signature: 'failed to verify image ghcr.io/atkaridarshan04/cloudnative-devops-blueprint/bookstore-frontend:3.0.0:
    .attestors[0].entries[0].keyless: no signatures found'
```

![The unsigned 3.0.0 tag is denied at admission: Kyverno reports no signatures found for the keyless attestor](/writing/trust-the-pipeline-not-the-tag/unsigned-test-failure.png)

The denial names a webhook called `mutate.kyverno.svc-fail` rather than a validating one, and that isn't a mislabel. Kyverno runs `verifyImages` inside its mutating webhook first, because the rule may rewrite the image reference to its digest (`mutateDigest` is on by default), so the decision is made before validation ever runs.

The Pod never gets created. There's nothing to clean up, no CrashLoop, no container that ran for a few seconds before anyone noticed — the API server refused the object. The same denial is recorded as a Kubernetes event, which is where you'd look if a Deployment's Pods silently never appeared:

```bash
kubectl get events -n mern-devops --field-selector reason=PolicyViolation
```

```text
Warning  PolicyViolation  kyverno-admission  Pod mern-devops/test-unsigned: [verify-signature] fail (blocked); failed to verify image ghcr.io/atkaridarshan04/cloudnative-devops-blueprint/bookstore-frontend:3.0.0: .attestors[0].entries[0].keyless: no signatures found
```

> [!tip] If the unsigned Pod gets admitted anyway
> The policy isn't enforcing. Check that `validationFailureAction` is `Enforce` and not `Audit`, and that `background: false` isn't being read as "skip live admission checks" — it only means the policy runs at admission and isn't applied to resources that already exist.

## Where it breaks quietly

Most of the time I lost on this wasn't in cosign or Kyverno. It was in GitHub settings that sit outside the workflow file:

- **The repo-level workflow permission is a ceiling.** Under the default read-only setting, `GITHUB_TOKEN` can't push to GHCR no matter what `permissions:` the YAML requests, and the build fails with `denied: permission_denied`. Settings → Actions → General → Workflow permissions has to be set to read and write.
- **An existing package isn't linked to the repo.** If the package already exists from an earlier manual push, the repo's token has no write access to it until the repository is added under the package's Actions access. The error is `denied: permission_denied: write_package` — a different one from above, easy to misread as the same.
- **Both kubelet and Kyverno need to reach the registry.** Kyverno pulls the signature and attestation to verify them, not just the image. With a private package you need an `imagePullSecret` in the namespace *and* Kyverno's admission controller configured with registry credentials. For the demo I made the package public.

None of these produce a bad signature. They produce no signature, or no verification, which from the cluster's point of view is the same thing as an attacker's image.

## Takeaways

- A CVE scan and a signature answer different questions. The scan says what's inside; the signature says who built it and from what. You need both, and the second is the one most pipelines skip.
- Sign the digest, deploy by digest. The tag is the mutable thing the whole post is arguing against; the moment the workflow extracts `containerimage.digest` from the bake output, nothing downstream touches a tag again.
- The identity in the policy is the control. `issuer` plus a `subject` that names the repo, workflow file and branch is what turns "signed by someone" into "signed by this pipeline." Get that string wrong and valid images get rejected; get it too loose and the gate is decorative.
- Enforce at admission, not in CI. The pipeline already trusts itself. The one place a trust check can't be skipped is the API server, and that's where `verifyImages` lives — alongside the tag and label policies already there, on the same principle as the promotion gates in [Synced Isn't Healthy](/writing/synced-isnt-healthy/): take the trust decision out of CI and put it where it can't be skipped.
- Test the negative case. "Signing succeeded" proves nothing. The policy only earns its place when an unsigned image on the same registry path is turned away with `no signatures found`.
