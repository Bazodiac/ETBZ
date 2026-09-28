# Wrapper — Claude runtime

Invocation only. Nothing here changes a rule of `SKILL.md`.

1. Load, in this order: `SKILL.md`, `contract-bundle.json`, `reading-schema.json`, then the one `bazodiac-skill-input.v1` package the operator supplies as a file or as the message body.
2. Verify before writing: `input.bundleRef` equals the bundle's `bundleRef`; `input.bundleStructuralHash` equals the bundle's `structuralHash` and the `bundleStructuralHash` in `MANIFEST.json`; `input.skillRef` equals `bazodiac-interpretation-skill@1.0.0`. If any differs, emit nothing and report the mismatch.
3. Produce the reading as one JSON document in a single fenced ```json block or as a file, with no text before or after it. Do not summarise the reading, do not explain your choices, do not add a preface.
4. Record for the operator, outside the reading: the model identity the runtime reports, the date, and the `structuralHash` values you copied from the input (package, claim graph, plan). The operator runs the acceptance boundary; you do not.
5. If the acceptance boundary refuses the reading, the operator may hand you the refusal code and path once. Repair only what the code names; do not rewrite anything else. A second refusal ends the run.
6. Under this chain the runtime is the Claude runtime available to the Delivery Runner (PO decision D2, 2026-09-28); no other provider, model or paid call is used.
