# Bazodiac Interpretation Skill v1.1 — package

`bazodiac-interpretation-skill@1.1.0` — the customer-voice revision of the portable execution package (Jira ETBZ-57; Confluence Rebaseline 62128133 section 17). Same reading schema (`bazodiac-skill-reading.v1`), same input package (`bazodiac-skill-input.v1`), same acceptance boundary plus the customer-voice gates and the editorial pass. The 1.0.0 package in `../bazodiac-interpretation-skill-v1/` is unchanged and stays the package of every run generated under it.

**Status: CANDIDATE.** The bundle `bazodiac-skill-contract-bundle@1.1.0` binds the Lens, Lexicon and Anti-Boilerplate revisions at their candidate pages (Confluence 77561858, 77529091, 77266967). A candidate bundle authorises evaluation runs only: every boundary refuses it unless the operator passes `{ candidateEvaluation: true }` — `acceptPortableSkillContractBundle`, `buildSkillInputPackage`, `acceptSkillReading` and `acceptEditorialRevision`. It is released, and this package regenerated, only after the ETBZ-57 Human Editorial Gate returns ACCEPTED.

| File | Role | Written by |
| --- | --- | --- |
| `SKILL.md` | the instructions a runtime executes: hard laws, input, REALISE and EDIT, refusal codes | hand |
| `wrappers/claude.md`, `wrappers/chatgpt.md` | invocation-only differences per runtime; no rule lives here | hand |
| `contract-bundle.json` | the portable `bazodiac-skill-contract-bundle@1.1.0` (canonical JSON) | `npm run etbz57:package` |
| `reading-schema.json` | JSON Schema of `bazodiac-skill-reading.v1` (identical to the 1.0.0 package's) | `npm run etbz57:package` |
| `MANIFEST.json` | identities, bundle hash, contract set and the SHA-256 of every file above; `packageStructuralHash` freezes the whole package | `npm run etbz57:package` |

`tests/contract/etbz57-skill-voice.contract.test.ts` requires `contract-bundle.json` and `reading-schema.json` to be byte-identical to a fresh generation, checks `MANIFEST.json` field by field, and requires its digests to match the files. Nothing in this directory is served, imported by `src/` or shipped in the container image.
