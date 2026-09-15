# `src/application/ports`

Interfaces the application layer requires from the outside world (outbound
ports). Concrete implementations live in `src/adapters` and are injected at the
composition root (`src/app/server.ts`).

## Declared ports

- `fufire-gateway.ts` (ETBZ-24 / ETBZ-29) - the FuFirE boundary. Implementations
  MUST fail closed: schema drift, auth failure, timeout or rejection surfaces as
  an explicit error, never as a locally computed substitute.
- `narrative-provider.ts` (ETBZ-25) - the narrative boundary. The only
  implementation in the repository is deterministic and reaches no network, no
  credential and no cost path; the port exists so that a future creative
  provider faces the same validation without the application layer changing.
- `interpretive-claim-provider.ts` (ETBZ-30) - the interpretive-claim boundary.
  It produces UNTRUSTED structured claim drafts and the relations between them,
  so that long-form meaning is persisted as validated structure rather than
  recovered by re-reading earlier prose. The port's schemas prove SHAPE only -
  the declared fields, the closed relation and epistemic vocabularies, and no
  invented key. Whether a draft is actually grounded in this chart, whether a
  relation's endpoints exist and whether provisional lineage was preserved are
  SEMANTIC questions; application validation owns acceptance and answers them
  against the brief, exactly as `report-model.ts` does for narrative prose.

  This port does NOT replace `narrative-provider.ts`: that one asks for prose
  bound to citations, this one asks for meaning as structure, and both remain
  declared. Symbolic chart truth stays outside the port entirely - a provider
  sees only the `NarrativeBrief`, echoes the facts it used, and can therefore
  cite a chart fact but never add, amend or recalculate one.

  C1 declares the boundary and nothing more: there is no adapter, no network,
  no credential, no cost path and no provider implementation behind it, and
  none is added merely so that tests have something to call.

A port is only introduced together with the slice that genuinely needs it -
declaring one earlier would imply a capability the service does not have. There
is still no Etsy, database, PDF renderer or delivery port.
