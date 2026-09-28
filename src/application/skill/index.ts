// =============================================================================
// ETBZ-51 - Bazodiac Skill Contract Bundle v1.
//
// The portable, versioned, hash-frozen set of contracts a Bazodiac
// Interpretation Skill run is held to: the five released contract sources
// (Method Profile, Long-Form, Interpretation Lens, Terminology & Wording
// Lexicon, Cross-Reading Individuality) by page id and released version, the
// Lens / Lexicon / Anti-Boilerplate vocabularies as values, the repository's
// version markers, and the domain-scoped precedence between contracts.
//
// The module is a CONTRACT, not a Skill: it holds no prompt, no prose, calls
// nothing and derives no astrological fact. The Skill package that consumes it
// is ETBZ-52; `tests/architecture/etbz51-skill-boundary.test.ts` keeps that true.
// =============================================================================

export * from './contract-sources.js';
export * from './errors.js';
export * from './individuality-contract.js';
export * from './semantic-envelope.js';
export * from './skill-contract-bundle.js';
export * from './wording-boundaries.js';
