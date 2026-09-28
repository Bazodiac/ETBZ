# Wrapper — ChatGPT runtime

Invocation only. Nothing here changes a rule of `SKILL.md`; a ChatGPT run and a Claude run are held to the same input, the same contracts, the same schema and the same acceptance boundary.

1. Attach `SKILL.md`, `contract-bundle.json` and `reading-schema.json` as knowledge, or paste them in this order as the system context. Attach the one `bazodiac-skill-input.v1` package as a file.
2. Verify before writing: `input.bundleRef` equals the bundle's `bundleRef`; `input.bundleStructuralHash` equals the bundle's `structuralHash` and the `bundleStructuralHash` in `MANIFEST.json`; `input.skillRef` equals `bazodiac-interpretation-skill@1.0.0`. If any differs, emit nothing and report the mismatch.
3. Emit the reading as one JSON document and nothing else. Where the runtime offers a structured-output mode, use `reading-schema.json`; where it does not, emit a single fenced ```json block.
4. Report to the operator, outside the reading: the model identity the runtime reports, the date, and the `structuralHash` values copied from the input. The operator runs the acceptance boundary.
5. A refusal may be handed back once with its code and path; repair only what it names. A second refusal ends the run.
6. Browsing, code execution, memory of earlier conversations and any tool that could fetch a chart fact or a method from outside the input are not used.
