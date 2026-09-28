# Bazodiac Interpretation Skill v1 — package

`bazodiac-interpretation-skill@1.0.0` — the portable execution package of the canonical Bazodiac Interpretation Model for a ChatGPT or Claude runtime (Jira ETBZ-38 / ETBZ-52; Confluence Rebaseline 62128133 section 4.4). The Skill is an execution host: it consumes one validated input package and returns one structured reading; it is not an astrology engine and holds no chart fact of its own.

| File | Role | Written by |
| --- | --- | --- |
| `SKILL.md` | the instructions a runtime executes: hard laws, input, writing procedure, refusal codes | hand |
| `wrappers/claude.md`, `wrappers/chatgpt.md` | invocation-only differences per runtime; no rule lives here | hand |
| `contract-bundle.json` | the portable `bazodiac-skill-contract-bundle@1.0.0` (canonical JSON); accepted back by the repository only when it equals the repository bundle in canonical content | `npm run etbz52:package` |
| `reading-schema.json` | JSON Schema of `bazodiac-skill-reading.v1`, generated from the acceptance boundary's own zod schema | `npm run etbz52:package` |
| `MANIFEST.json` | identities, bundle hash, contract set and the SHA-256 of every file above; `packageStructuralHash` freezes the whole package | `npm run etbz52:package` |

The repository side is `src/application/skill/`: `buildSkillInputPackage` produces what a run is handed, `acceptSkillReading` is the boundary every reading passes or fails, `projectCustomerReading` is the text-only customer projection. `tests/contract/etbz52-skill-fixture-run.contract.test.ts` requires every generated file here to be byte-identical to a fresh generation and the manifest digests to match the files.

A change to `SKILL.md`, a wrapper, the bundle or the schema changes `packageStructuralHash`; a run's evidence records the hash it was produced under, so a re-run under another package is visible as such. Nothing in this directory is served, imported by `src/` or shipped in the container image.
