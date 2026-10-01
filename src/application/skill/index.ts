// =============================================================================
// ETBZ-51 / ETBZ-52 - Bazodiac Skill Contract Bundle v1 and the Skill run boundary.
//
// The portable, versioned, hash-frozen set of contracts a Bazodiac
// Interpretation Skill run is held to (ETBZ-51): the five released contract
// sources by page id and released version, the Lens / Lexicon /
// Anti-Boilerplate vocabularies as values, the repository's version markers,
// and the domain-scoped precedence between contracts.
//
// On top of it (ETBZ-52): the Skill identity, the input package a run is
// handed, and the acceptance boundary for the structured reading it hands back.
//
// ETBZ-57: the voice revision beside it - bundle and Skill 1.1.0 over the Lens,
// Lexicon and Anti-Boilerplate revisions, the customer-voice gates and the
// editorial pass. 1.0.0 stays buildable, so its evidence is re-derived.
//
// The module is a CONTRACT and a GATE, not a Skill: it holds no prompt, no
// prose of its own, calls nothing and derives no astrological fact. The Skill
// package that consumes it lives under `skill/`. The only application module
// that imports it is `src/application/presentation/` (ETBZ-55), through this
// index; `tests/architecture/etbz51-skill-boundary.test.ts` enforces that.
// =============================================================================

export * from './contract-sources.js';
export * from './errors.js';
export * from './individuality-contract.js';
export * from './semantic-envelope.js';
export * from './semantic-envelope-v1-1.js';
export * from './skill-contract-bundle.js';
export * from './skill-package.js';
export * from './skill-reading.js';
export * from './skill-run-errors.js';
export * from './wording-boundaries.js';
export * from './wording-boundaries-v1-1.js';
