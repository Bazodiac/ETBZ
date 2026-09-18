# Runbook — FuFirE runtime attestation (ETBZ-34 AC 5–7)

Read-only. Two `GET` requests against a FuFirE runtime; no calculation, no
mutation, no cost. It answers one question: *is the runtime we are about to
read from the build the Product Owner accepted?*

## Run

```bash
npm ci && npm run build
ETBZ_FUFIRE_BASE_URL=https://<fufire-origin> \
ETBZ_FUFIRE_EXPECTED_OPENAPI_SHA256=<64 hex> \
ETBZ_FUFIRE_EXPECTED_SOURCE_REVISION=<40-hex git SHA | 64-hex | sha256:<digest>> \
npm run attest:fufire
```

`ETBZ_FUFIRE_API_KEY` is sent as `X-API-Key` when set and is never printed.

| Exit | Verdict | Meaning |
|---|---|---|
| 0 | `PASS` | OpenAPI bytes AND immutable source revision were observed and both equal the expectation |
| 2 | `BLOCKED` | an expectation is missing / malformed, an observed value contradicts it, **or the runtime answered with a source identity that is not an immutable revision** |
| 3 | `CAPABILITY_MISSING` | the runtime did not let us observe what acceptance needs at all |
| 64 | — | unusable configuration (no base URL, bad timeout) |

There is no path from "could not look" to `PASS`. The line between `BLOCKED` and
`CAPABILITY_MISSING` is *did the runtime answer*: silence is a capability the
producer still has to build; an answer that is not a revision is a contradiction
and must not be softened into "could not look".

## What is observed

- **OpenAPI:** `GET /openapi.json`; SHA-256 over exactly the returned bytes.
- **Source identity:** `GET /v1/build` — an existing FuFirE surface
  (`bazi_engine/routers/info.py`). Two fields are read, in this order:
  1. `source_revision` — FuFirE's provider-neutral identity for the build that
     is answering. FuFirE takes it from the variable the **deployment platform**
     injects (`NF_DEPLOYMENT_SHA` on Northflank, `RAILWAY_GIT_COMMIT_SHA` on
     Railway), never from an application-owned value, and reports it
     unconditionally — no `EXPOSE_BUILD_METADATA` needed.
  2. `railway_commit_sha` — the older Railway-only field, still read so a
     Railway deployment that has not been rebuilt keeps attesting. It is
     exposed only when the deployment sets `EXPOSE_BUILD_METADATA`.

  The companion fields `source_revision_provider`, `source_revision_kind` and
  `source_revision_status` are FuFirE's own account of where the value came
  from. ETBZ does not read them and never treats them as identity — only the
  revision is compared, against an expectation ETBZ holds separately. The
  `version` field is a mutable version string and is refused as identity, even
  if configured.

## When the verdict is `CAPABILITY_MISSING`

`/v1/build` carried no revision at all: `source_revision` was absent or `null`
(FuFirE reports `source_revision_status` `unavailable`, `invalid` or
`ambiguous`), and no `railway_commit_sha` was exposed either. That is a producer
or deployment capability, not an ETBZ defect — the deployment platform did not
hand the runtime a usable commit, or the runtime predates
`source_revision` (FuFirE ≤ `c914d567`). To close it, redeploy FuFirE from a
build that carries the field. If a deployment exposes its commit under yet
another field name, set `ETBZ_FUFIRE_ATTEST_IDENTITY_FIELDS=<field>` — a
configuration change; no ETBZ code change is needed.

## When the verdict is `BLOCKED` on the identity

`/v1/build` DID answer with a `source_revision`, and the value is not a full git
object id (a branch name, an abbreviated SHA, a version string, upper-case hex).
Do not re-run with a different field: the runtime is misconfigured or is
publishing something it should not. Fix the deployment.

## Using the verdict

`buildBazodiacInterpretationInput(model, source, { mapper, attestation })` lifts
the `RUNTIME_ATTESTATION_NOT_PASSED` production blocker only for a verdict that
re-evaluates to `PASS` and whose observed OpenAPI SHA-256 equals the chart's
`provenance.openapiSha256`. Record the printed JSON verdict as evidence.
