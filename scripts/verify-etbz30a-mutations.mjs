#!/usr/bin/env node
/**
 * ETBZ-30A — source-mutation proofs for the guards of the InterpretiveClaimGraph.
 *
 * For each guard listed below: weaken the SOURCE in one place, run the tests
 * that claim to protect it, and require them to turn RED. A guard whose removal
 * leaves the suite green is decoration. The list is the proof; a guard that is
 * not in it has not been proven. The unmutated baseline must be GREEN first —
 * otherwise "red" proves nothing. Every file is restored byte-for-byte
 * afterwards, and the run fails if the working tree is not clean at the end.
 *
 *   npm run guards:etbz30a
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const GRAPH = 'src/application/interpretation/interpretive-claim-graph.ts';
const CLAIM = 'src/application/interpretation/interpretive-claim.ts';
const FEATURES = 'src/application/interpretation/feature-set.ts';

const T = {
  unit: 'tests/unit/interpretive-claim-graph.test.ts',
  negative: 'tests/negative/interpretive-claim-graph.negative.test.ts',
};

/** [name, file, find, replace, tests] — `find` must occur exactly once. */
const MUTANTS = [
  // --- bindings ---------------------------------------------------------------------
  ['BIND: an unverified brief is accepted', GRAPH, "  if (supplied !== structuralHash(rederived.brief)) {", "  if (supplied === '') {", [T.unit]],
  ['BIND: a brief is believed by the hash it prints on itself', GRAPH, "  if (supplied !== structuralHash(rederived.brief)) {", "  if (context.brief.structuralHash !== rederived.brief.structuralHash) {", [T.unit]],
  ['BIND: a brief that cannot be canonicalised is waved through', GRAPH, "    supplied = null;", "    supplied = structuralHash(rederived.brief);", [T.unit]],
  ['BIND: the graph does not carry its version', GRAPH, "    graphVersion: INTERPRETIVE_CLAIM_GRAPH_VERSION,\n    sourceBrief", "    sourceBrief", [T.unit]],
  ['BIND: the graph does not carry methodProfileRef', GRAPH, "    methodProfileRef,\n    methodProfileVersion", "    methodProfileVersion", [T.unit]],
  ['BIND: a draft written for another brief is accepted', GRAPH, "if (sourceBriefStructuralHash !== brief.structuralHash) {", "if (sourceBriefStructuralHash === '') {", [T.unit]],
  ['BIND: the graph does not name its brief', GRAPH, "    sourceBriefStructuralHash: brief.structuralHash,\n", "    sourceBriefStructuralHash: '',\n", [T.unit]],
  ['BIND: the graph does not name its feature set', GRAPH, "    featureSetStructuralHash: rederived.featureSet.structuralHash,\n", "", [T.unit]],
  ['BIND: the graph does not carry the released registry hash', GRAPH, "    methodRegistryStructuralHash: methodRegistryStructuralHash(context.registry),\n", "", [T.unit]],
  ['BIND: the graph does not carry methodProfileVersion', GRAPH, "    methodProfileVersion: context.registry.profileVersion,\n", "", [T.unit]],
  // --- composition of the claim contract -----------------------------------------------
  ['CLAIM: the claim validator is not composed', GRAPH, "    const cited = validateInterpretiveClaim(claim, validation);\n", "    const cited = [];\n", [T.negative]],
  ['CLAIM: the stored claim hash is not the I6 hash', GRAPH, "structuralHash: interpretiveClaimStructuralHash(accepted, methodProfileRef) };", "structuralHash: structuralHash(accepted) };", [T.unit]],
  ['CLAIM: a raw path accepted as factRef', CLAIM, "    if (fact === undefined) {\n      throw new ClaimError('CLAIM_UNKNOWN_FACT'", "    if (fact === undefined) {\n      continue;\n      throw new ClaimError('CLAIM_UNKNOWN_FACT'", [T.negative]],
  ['CLAIM: a deferred methodRef accepted', CLAIM, "    if (!isApprovedStatus(method.status)) {\n      throw", "    if (!isApprovedStatus(method.status) && method.methodId === '') {\n      throw", [T.negative]],
  ['CLAIM: a provisional claim laundered', CLAIM, "if (provisional.length > 0 && claim.epistemicClass !== 'TENTATIVE_INTERPRETATION') {", "if (provisional.length > 99 && claim.epistemicClass !== 'TENTATIVE_INTERPRETATION') {", [T.negative]],
  ['CLAIM: an unreleased registry authorises a graph', CLAIM, "  assertReleasedRegistry(registry);\n", "", [T.negative]],
  ['CLAIM: an assumed hour is interpretable', FEATURES, "interpretable: !assumedTimeDerived,", "interpretable: true,", [T.negative]],
  // --- graph-only refusals -------------------------------------------------------------
  ['GRAPH: an empty graph is accepted', GRAPH, "if (drafts.length === 0) {", "if (drafts.length < 0) {", [T.negative]],
  ['GRAPH: two claims under one handle', GRAPH, "if (acceptedIdByHandle.has(claim.claimId)) {", "if (acceptedIdByHandle.has(claim.claimId) && drafts.length < 0) {", [T.negative]],
  ['GRAPH: repeated factRefs are not looked at', GRAPH, "    refuseRepeated(claim.claimId, 'fact', claim.factRefs);\n", "", [T.negative]],
  ['GRAPH: repeated themeRefs are not looked at', GRAPH, "    refuseRepeated(claim.claimId, 'theme', claim.themeRefs);\n", "", [T.negative]],
  ['GRAPH: repeated relations are not looked at', GRAPH, "    refuseRepeated(claim.claimId, 'relation', claim.relations.map(relationKey));\n", "", [T.negative]],
  ['GRAPH: primary themes are not themes of the brief', GRAPH, "[...brief.primaryThemes, ...brief.candidateThemes].map(", "[...brief.candidateThemes].map(", [T.unit]],
  ['GRAPH: candidate themes are not themes of the brief', GRAPH, "[...brief.primaryThemes, ...brief.candidateThemes].map(", "[...brief.primaryThemes].map(", [T.unit]],
  ['GRAPH: an empty id is an id', GRAPH, "const idLike = z.string().min(1).max(256);", "const idLike = z.string().max(256);", [T.negative]],
  ['GRAPH: a schema refusal echoes what it received', GRAPH, "}: ${issue.code}`)", "}: ${issue.message}`)", [T.negative]],
  ['GRAPH: a repeated ref is counted instead of refused', GRAPH, "    if (seen.has(value)) {", "    if (seen.has(value) && values.length < 0) {", [T.negative]],
  ['GRAPH: a theme the brief does not contain', GRAPH, "      if (!briefThemeIds.has(themeRef)) {\n        throw", "      if (!briefThemeIds.has(themeRef)) {\n        continue;\n        throw", [T.negative]],
  ['THEME: the theme/fact overlap rule is re-invented (PO 2026-09-19)', GRAPH, "      if (!briefThemeIds.has(themeRef)) {\n", "      if (!briefThemeIds.has(themeRef) || ![...brief.primaryThemes, ...brief.candidateThemes].some((theme) => theme.id === themeRef && theme.factIds.some((factId) => claim.factRefs.includes(factId)))) {\n", [T.negative]],
  ['GRAPH: one semantic identity twice becomes two claims', GRAPH, "    if (twin !== undefined) {", "    if (twin !== undefined && drafts.length < 0) {", [T.negative]],
  ['GRAPH: duplicates keyed on the statement text again (PO 2026-09-19)', GRAPH, "    const twin = handleByAcceptedId.get(acceptedId);", "    const twin = drafts.find((other) => other !== claim && other.statement === claim.statement && acceptedIdByHandle.has(other.claimId))?.claimId;", [T.negative]],
  ['STATEMENT: a typography rule is re-invented (PO 2026-09-19)', GRAPH, "    refuseRepeated(claim.claimId, 'fact', claim.factRefs);\n", "    if (claim.statement !== claim.statement.normalize('NFC') || /[^\\S ]/u.test(claim.statement)) {\n      throw new ClaimGraphError('CLAIM_GRAPH_SCHEMA_INVALID', 'typography');\n    }\n    refuseRepeated(claim.claimId, 'fact', claim.factRefs);\n", [T.negative]],
  ['STATEMENT: the stored statement is normalised', GRAPH, "      statement: claim.statement,\n      factRefs: sorted(claim.factRefs),", "      statement: claim.statement.normalize('NFC'),\n      factRefs: sorted(claim.factRefs),", [T.negative]],
  ['STATEMENT: the stored statement is trimmed', GRAPH, "      statement: claim.statement,\n      factRefs: sorted(claim.factRefs),", "      statement: claim.statement.trim(),\n      factRefs: sorted(claim.factRefs),", [T.negative]],
  ['GRAPH: id-like strings are unbounded', GRAPH, "const idLike = z.string().min(1).max(256);", "const idLike = z.string().min(1);", [T.negative]],
  ['GRAPH: a dangling relation is kept', GRAPH, "      if (targetClaimId === undefined) {\n        throw", "      if (targetClaimId === undefined) {\n        return { type: relation.type, targetClaimId: relation.targetClaimId };\n        throw", [T.negative]],
  ['GRAPH: a claim may relate to itself', GRAPH, "      if (targetClaimId === claimId) {", "      if (targetClaimId === claimId && drafts.length < 0) {", [T.negative]],
  ['GRAPH: unknown fields on a claim are tolerated', GRAPH, "  claims: z.array(z.strictObject({\n    claimId", "  claims: z.array(z.object({\n    claimId", [T.negative]],
  ['GRAPH: unknown fields on the draft are tolerated', GRAPH, "const claimGraphDraftSchema = z.strictObject({", "const claimGraphDraftSchema = z.object({", [T.negative]],
  ['GRAPH: unknown fields on a relation are tolerated', GRAPH, "    relations: z.array(z.strictObject({", "    relations: z.array(z.object({", [T.negative]],
  // --- identity and determinism ----------------------------------------------------------
  ['IDENTITY: the draft handle enters claim identity', GRAPH, "    methodProfileRef,\n    statement: claim.statement,", "    methodProfileRef,\n    handle: claim.claimId,\n    statement: claim.statement,", [T.unit]],
  ['IDENTITY: the statement left out of claim identity', GRAPH, "    methodProfileRef,\n    statement: claim.statement,\n    citedFacts", "    methodProfileRef,\n    citedFacts", [T.unit]],
  ['IDENTITY: cited fact IDS left out of claim identity', GRAPH, "      .map((fact) => ({ id: fact.id, value: fact.value }))", "      .map((fact) => ({ value: fact.value }))", [T.unit]],
  ['IDENTITY: themeRefs left out of claim identity', GRAPH, "\n    themeRefs: sorted(claim.themeRefs),\n", "\n", [T.unit]],
  ['IDENTITY: themeRef order enters claim identity', GRAPH, "\n    themeRefs: sorted(claim.themeRefs),\n", "\n    themeRefs: claim.themeRefs,\n", [T.unit]],
  ['IDENTITY: methodRef order enters claim identity', GRAPH, "\n    methodRefs: sorted(claim.methodRefs),\n", "\n    methodRefs: claim.methodRefs,\n", [T.unit]],
  ['IDENTITY: the epistemic class left out of claim identity', GRAPH, "\n    epistemicClass: claim.epistemicClass,\n    provisionalFactRefs: sorted", "\n    provisionalFactRefs: sorted", [T.unit]],
  ['IDENTITY: provisional lineage left out of claim identity', GRAPH, "    provisionalFactRefs: sorted(claim.provisionalFactRefs),\n  })}", "  })}", [T.unit]],
  ['IDENTITY: cited fact VALUES left out of claim identity', GRAPH, "      .map((fact) => ({ id: fact.id, value: fact.value }))", "      .map((fact) => ({ id: fact.id }))", [T.unit]],
  ['IDENTITY: cited fact order enters claim identity', GRAPH, "\n      .sort((left, right) => (left.id < right.id ? -1 : 1)),", ",", [T.unit]],
  ['IDENTITY: lineage order enters claim identity', GRAPH, "    provisionalFactRefs: sorted(claim.provisionalFactRefs),\n  })}", "    provisionalFactRefs: claim.provisionalFactRefs,\n  })}", [T.unit]],
  ['IDENTITY: methodRefs left out of claim identity', GRAPH, "\n    methodRefs: sorted(claim.methodRefs),\n", "\n", [T.unit]],
  ['IDENTITY: the profile reference left out of claim identity', GRAPH, "  return `claim.${structuralHash({\n    methodProfileRef,\n", "  return `claim.${structuralHash({\n", [T.unit]],
  ['ORDER: claim input order survives into the graph', GRAPH, "    claims: claims.sort((left, right) => (left.claimId < right.claimId ? -1 : 1)),", "    claims,", [T.unit]],
  ['ORDER: factRef input order survives into the graph', GRAPH, "      factRefs: sorted(claim.factRefs),", "      factRefs: claim.factRefs,", [T.unit]],
  ['ORDER: methodRef input order survives into the graph', GRAPH, "      methodRefs: sorted(claim.methodRefs),", "      methodRefs: claim.methodRefs,", [T.unit]],
  ['ORDER: themeRef input order survives into the graph', GRAPH, "      themeRefs: sorted(claim.themeRefs),", "      themeRefs: claim.themeRefs,", [T.unit]],
  ['ORDER: lineage input order survives into the graph', GRAPH, "      provisionalFactRefs: sorted(claim.provisionalFactRefs),", "      provisionalFactRefs: claim.provisionalFactRefs,", [T.unit]],
  ['ORDER: relation input order survives into the graph', GRAPH, "      relations: relations.sort((left, right) => (relationKey(left) < relationKey(right) ? -1 : 1)),", "      relations,", [T.unit]],
  // --- integrity and PD-5 ------------------------------------------------------------------
  ['INTACT: an edited graph passes', GRAPH, "  if (presented !== structuralHash(rebuilt)) {", "  if (presented === '') {", [T.unit]],
  ['INTACT: only the printed hash is compared, so an added field passes', GRAPH, "  if (presented !== structuralHash(rebuilt)) {", "  if (graph.structuralHash !== rebuilt.structuralHash) {", [T.unit]],
  ['INTACT: a refused claim escapes as a raw ClaimError', GRAPH, "    const refusedClaims = error instanceof ClaimError\n      || (", "    const refusedClaims = (", [T.unit]],
  ['INTACT: a value that is not graph-shaped escapes as a raw TypeError', GRAPH, "  } catch {\n    throw new ClaimGraphError('CLAIM_GRAPH_NOT_INTACT', 'the value does not have the shape of an accepted graph');", "  } catch (shapeError) {\n    throw shapeError;", [T.unit]],
  ['INTACT: an unreleased registry is reported as a damaged graph', GRAPH, "    if (!refusedClaims) {\n      throw error;\n    }\n", "", [T.unit]],
  ['INTACT: a foreign brief is reported as a damaged graph', GRAPH, "      || (error instanceof ClaimGraphError && error.code !== 'CLAIM_GRAPH_BRIEF_NOT_DERIVED_FROM_MODEL');", "      || error instanceof ClaimGraphError;", [T.unit]],
  ['PD-5: the floor is not composed', GRAPH, "  assertCentralClaimSignals(claim, {", "  validateInterpretiveClaim(claim, {", [T.unit]],
  ['PD-5: floor weakened to OR', CLAIM, "if (kinds.size >= 2 && contributions.length >= 2) {", "if (kinds.size >= 2 || contributions.length >= 2) {", [T.unit]],
  ['PD-5: a modifier counts as a method contribution (PO 2026-09-19)', CLAIM, "methodsById.get(methodRef)?.modifier === false);", "methodsById.get(methodRef) !== undefined);", [T.unit]],
  ['PD-5: methodRefs counted instead of non-modifier contributions', CLAIM, "if (kinds.size >= 2 && contributions.length >= 2) {", "if (kinds.size >= 2 && claim.methodRefs.length >= 2) {", [T.unit]],
  ['PD-5: a claim of a tampered graph is certified', GRAPH, "  assertInterpretiveClaimGraphIntact(graph, context);\n  const claim = graph.claims.find", "  const claim = graph.claims.find", [T.unit]],
  ['PD-5: a claim the graph does not contain is certified', GRAPH, "  if (claim === undefined) {\n    throw new ClaimGraphError('CLAIM_GRAPH_UNKNOWN_CLAIM', `\"${claimId}\"", "  if (claim === undefined) {\n    return;\n    throw new ClaimGraphError('CLAIM_GRAPH_UNKNOWN_CLAIM', `\"${claimId}\"", [T.unit]],
];

/** Exit status of the named suites. A run that did not END (signal, spawn failure) is an error, never "red". */
function run(tests) {
  const result = spawnSync('npx', ['vitest', 'run', ...tests], { encoding: 'utf8' });
  if (result.status === null || result.error !== undefined) {
    return 'DID_NOT_FINISH';
  }
  return result.status;
}

if (run([T.unit, T.negative]) !== 0) {
  process.stdout.write('BASELINE_NOT_GREEN: the unmutated suites fail, so a red mutant would prove nothing\n');
  process.exit(1);
}
process.stdout.write('BASELINE GREEN (unmutated)\n');

const results = [];
for (const [name, file, find, replace, tests] of MUTANTS) {
  const original = readFileSync(file, 'utf8');
  const occurrences = original.split(find).length - 1;
  if (occurrences !== 1) {
    results.push([name, `SETUP_ERROR (pattern occurs ${occurrences}x in ${file})`]);
    continue;
  }
  writeFileSync(file, original.replace(find, replace));
  let status;
  try {
    status = run(tests);
  } finally {
    writeFileSync(file, original);
  }
  results.push([name, status === 'DID_NOT_FINISH'
    ? 'RUN_ERROR (vitest did not finish)'
    : status !== 0 ? 'RED (guard holds)' : 'STAYED GREEN — guard is decoration']);
}

let killed = 0;
for (const [name, outcome] of results) {
  if (outcome.startsWith('RED')) killed += 1;
  process.stdout.write(`${outcome.padEnd(36)} :: ${name}\n`);
}
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'src', 'tests'], { encoding: 'utf8' }).trim();
if (dirty.length > 0) {
  process.stdout.write(`MUTATION_RESIDUE:\n${dirty}\n`);
}
process.stdout.write(`\n${killed}/${results.length} mutants killed; working tree ${dirty.length === 0 ? 'clean' : 'DIRTY'}\n`);
process.exit(killed === results.length && dirty.length === 0 ? 0 : 1);
