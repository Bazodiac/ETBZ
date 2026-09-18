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
| 2 | `BLOCKED` | an expectation is missing / malformed, or an observed value contradicts it |
| 3 | `CAPABILITY_MISSING` | the runtime did not let us observe what acceptance needs |
| 64 | — | unusable configuration (no base URL, bad timeout) |

There is no path from "could not look" to `PASS`.

## What is observed

- **OpenAPI:** `GET /openapi.json`; SHA-256 over exactly the returned bytes.
- **Source identity:** `GET /v1/build` — an existing FuFirE surface
  (`bazi_engine/routers/info.py`). It carries `railway_commit_sha` only when the
  deployment sets `EXPOSE_BUILD_METADATA`. Its `version` field is a mutable
  version string and is refused as identity, even if configured.

## When the verdict is `CAPABILITY_MISSING`

Known state on 2026-09-18: the accepted deployment does not expose an immutable
revision on `/v1/build`. That is a producer / deployment capability, not an ETBZ
defect. To close it, the FuFirE deployment must expose its commit (or image
digest) on `/v1/build`. If it does so under another field name, set
`ETBZ_FUFIRE_ATTEST_IDENTITY_FIELDS=<field>` — a configuration change; no ETBZ
code change is needed.

## Using the verdict

`buildBazodiacInterpretationInput(model, source, { mapper, attestation })` lifts
the `RUNTIME_ATTESTATION_NOT_PASSED` production blocker only for a verdict that
re-evaluates to `PASS` and whose observed OpenAPI SHA-256 equals the chart's
`provenance.openapiSha256`. Record the printed JSON verdict as evidence.
