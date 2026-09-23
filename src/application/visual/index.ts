// =============================================================================
// ETBZ-49 - Bazodiac Visual System v1.
//
// The canonical visual contract recovered from the ETBZ-43 convergence and
// bound to Confluence 66650114 version 2: nineteen colour tokens, integer
// centipoint geometry, twenty-seven display glyph assets with provenance, the
// static wordmark, the pagination rules, the page family and its fact bindings.
//
// The module is a CONTRACT, not a renderer. It carries no page output, calls
// nothing, and derives no astrological fact. The renderer that consumes it is
// ETBZ-55; `tests/architecture/etbz49-visual-boundary.test.ts` is what keeps
// that true.
// =============================================================================

export * from './errors.js';
export * from './glyphs.js';
export * from './pageFamily.js';
export * from './pagination.js';
export * from './provenance.js';
export * from './tokens.js';
export * from './types.js';
export * from './visualSystem.js';
export * from './wordmark.js';
