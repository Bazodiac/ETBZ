#!/usr/bin/env node
/**
 * ETBZ-34 AC 8 — source-mutation proofs for the guards of this slice.
 *
 * For every guard: weaken the SOURCE in one place, run the tests that claim to
 * protect it, and require them to turn RED. A guard whose removal leaves the
 * suite green is decoration. Every file is restored byte-for-byte afterwards,
 * and the run fails if the working tree is not clean at the end.
 *
 *   npm run guards:etbz34
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const I = 'src/application/interpretation/';
const MODEL = 'src/application/horoscope-model.ts';
const WIRE = 'src/adapters/fufire/http-client.ts';
const ATTEST = 'src/application/attestation/runtime-attestation.ts';
const PROBE = 'src/adapters/fufire/runtime-attestation.ts';

const T = {
  boundary: 'tests/unit/wuxing-consumer-boundary.test.ts',
  raw: 'tests/unit/raw-evidence-binding.test.ts',
  e2e: 'tests/integration/interpretation-handoff.test.ts',
  input: 'tests/unit/interpretation-input.test.ts',
  attest: 'tests/unit/runtime-attestation.test.ts',
  claim: 'tests/unit/interpretive-claim.test.ts',
  registry: 'tests/unit/method-registry.test.ts',
  prov: 'tests/unit/provisionality-propagation.test.ts',
  hour: 'tests/negative/unknown-time-exclusion.negative.test.ts',
  request: 'tests/unit/fufire-request-contract.test.ts',
};

/** [name, file, find, replace, tests] — `find` must occur exactly once. */
const MUTANTS = [
  // --- AC 1–4 at the model -------------------------------------------------------
  ['AC1 model: source-pillar mismatch tolerated', MODEL, "source === undefined || source.stem !== accepted.stem || source.branch !== accepted.branch", "source === undefined", [T.boundary, T.e2e]],
  ['AC1 model: branch not compared', MODEL, "source.stem !== accepted.stem || source.branch !== accepted.branch", "source.stem !== accepted.stem", [T.boundary]],
  ['AC1 model: wu-xing precision not tied to the input', MODEL, "if (wuxing.precision.birthTimeKnown !== input.birthTimeKnown) {", "if (wuxing.precision.birthTimeKnown !== input.birthTimeKnown && PILLAR_ORDER.length === 0) {", [T.boundary]],
  ['AC2 model: non-max dominant tolerated', MODEL, "] !== maximum) {", "] !== maximum && maximum < 0) {", [T.boundary]],
  ['AC3 model: keyset not closed', MODEL, "if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) {\n    throw new HoroscopeError(\n      'HOROSCOPE_WUXING_KEYSET_ERROR'", "if (expected.length === 0) {\n    throw new HoroscopeError(\n      'HOROSCOPE_WUXING_KEYSET_ERROR'", [T.boundary]],
  ['AC4 model: foreign basis tolerated', MODEL, "if (snapshot.basis !== REQUIRED_WUXING_BASIS) {", "if (snapshot.basis === '') {", [T.boundary]],
  // --- AC 1–4 at the wire ---------------------------------------------------------
  ['AC1 wire: pillars keyset not closed', WIRE, "assertExactKeys(pillarsRaw, PILLAR_NAMES, 'pillars');", "", [T.boundary]],
  ['AC2 wire: non-max dominant tolerated', WIRE, "] !== Math.max(...Object.values(vector))) {", "] !== Math.max(...Object.values(vector)) && dominant === '') {", [T.boundary, T.raw]],
  ['AC3 wire: sixth key dropped silently', WIRE, "assertExactKeys(vectorRaw, WUXING_ELEMENTS, 'wu_xing_vector');", "", [T.boundary]],
  ['AC4 wire: foreign basis tolerated', WIRE, "if (basis !== REQUIRED_WUXING_BASIS) {", "if (basis === 'never') {", [T.boundary, T.raw]],
  // --- AC 5–7 ----------------------------------------------------------------------
  ['AC5: wrong OpenAPI SHA passes', ATTEST, "observation.openapi.sha256 !== expectedSha) {", "observation.openapi.sha256 === '') {", [T.attest]],
  ['AC5: missing expected OpenAPI SHA passes', ATTEST, "  if (expectedSha === null) {\n    blocked(", "  if (expectedSha === null && findings.length > 99) {\n    blocked(", [T.attest]],
  ['AC6: wrong source revision passes', ATTEST, "observation.sourceIdentity.value !== expectedRevision\n  ) {", "observation.sourceIdentity.value === ''\n  ) {", [T.attest]],
  ['AC6: missing expected source revision passes', ATTEST, "  if (expectedRevision === null) {\n    blocked(", "  if (expectedRevision === null && findings.length > 99) {\n    blocked(", [T.attest]],
  ['AC6: missing immutable identity passes', ATTEST, "  if (observation.sourceIdentity.status !== 'OBSERVED') {\n    missing(", "  if (observation.sourceIdentity.status !== 'OBSERVED' && findings.length > 99) {\n    missing(", [T.attest]],
  ['AC6: version string accepted as identity', ATTEST, "return /^[0-9a-f]{40}$/u.test(value) ||", "return value.length > 0 || /^[0-9a-f]{40}$/u.test(value) ||", [T.attest]],
  ['AC6: probe offers the version field as identity', PROBE, "(field) => !MUTABLE_IDENTITY_FIELDS.includes(field),", "() => true,", [T.attest]],
  ['AC5: probe hashes a re-serialisation, not the bytes', PROBE, "createHash('sha256').update(bytes).digest('hex')", "createHash('sha256').update(JSON.stringify(JSON.parse(Buffer.from(bytes).toString('utf8')))).digest('hex')", [T.attest]],
  ['AC7: CAPABILITY_MISSING reported as PASS', ATTEST, "      ? 'CAPABILITY_MISSING'\n      : 'PASS';", "      ? 'PASS'\n      : 'PASS';", [T.attest]],
  ['AC7: non-PASS exits zero', ATTEST, "return status === 'PASS' ? 0 : status === 'BLOCKED' ? 2 : 3;", "return status === 'PASS' ? 0 : status === 'BLOCKED' ? 2 : 0;", [T.attest]],
  ['AC14: a typed-in PASS lifts the production blocker', I + 'interpretation-input.ts', "    ).status === 'PASS';\n  if (attestation !== undefined && attestation.status === 'PASS' && !attestationPassed) {", "    ).status !== 'NEVER';\n  if (attestation !== undefined && attestation.status === 'PASS' && !attestationPassed) {", [T.attest]],
  ['AC14: a PASS for another runtime is accepted', I + 'interpretation-input.ts', "if (observed === null || observed !== model.provenance.openapiSha256) {", "if (observed === null) {", [T.attest]],
  ['AC14: unknown time eligible', I + 'interpretation-input.ts', "  if (!birthTimeKnown) {\n    blockers.push('UNKNOWN_TIME_PRODUCER_CONTRACT_NOT_DELIVERED');", "  if (!birthTimeKnown && blockers.length > 99) {\n    blockers.push('UNKNOWN_TIME_PRODUCER_CONTRACT_NOT_DELIVERED');", [T.attest, T.input]],
  // --- raw evidence ------------------------------------------------------------------
  ['RAW: evidence not re-mapped against the snapshot', I + 'interpretation-input.ts', "if (structuralHash(withoutRaw(remapped)) !== structuralHash(withoutRaw(snapshot))) {", "if (structuralHash(withoutRaw(remapped)) === '') {", [T.raw]],
  ['RAW: a body that fails the producer contract is accepted', I + 'interpretation-input.ts', "    remapped = map(structuredClone(raw.payload));\n  } catch (error) {\n    throw", "    remapped = map(structuredClone(raw.payload));\n  } catch (error) {\n    return { endpoint: raw.endpoint, claimBearing: false, originalPayloadSha256: '', storedPayloadSha256: '', redactions: [], payload: raw.payload };\n    throw", [T.raw]],
  ['RAW: missing evidence tolerated', I + 'interpretation-input.ts', "  const raw = snapshot.raw;\n  if (raw === undefined ||", "  const raw = snapshot.raw ?? { endpoint: what, payload: {} };\n  if (raw.endpoint === what) {\n    return { endpoint: what, claimBearing: false, originalPayloadSha256: '', storedPayloadSha256: '', redactions: [], payload: {} };\n  }\n  if (raw === undefined ||", [T.input]],
  ['RAW: snapshots of another chart accepted', I + 'interpretation-input.ts', "  if (fromModel !== fromSource) {", "  if (fromModel === '') {", [T.input]],
  ['RAW: coordinates not redacted', I + 'interpretation-input.ts', "if (COORDINATE_KEY.test(key) && typeof entry === 'number' &&", "if (COORDINATE_KEY.test(key) && key === '' && typeof entry === 'number' &&", [T.input, T.raw]],
  ['RAW: a symbolic value redacted because it equals a coordinate', I + 'interpretation-input.ts', "if (COORDINATE_KEY.test(key) && typeof entry === 'number' &&", "if (typeof entry === 'number' &&", [T.raw]],
  ['RAW: a coordinate-named key redacted whatever its value', I + 'interpretation-input.ts', " && (entry === location.lat || entry === location.lon)) {", ") {", [T.raw]],
  ['RAW: stored hash is the original hash', I + 'interpretation-input.ts', "storedPayloadSha256: structuralHash(payload),", "storedPayloadSha256: structuralHash(raw.payload),", [T.raw]],
  ['RAW: a raw path accepted as factRef', I + 'interpretive-claim.ts', "    if (fact === undefined) {\n      throw new ClaimError('CLAIM_UNKNOWN_FACT'", "    if (fact === undefined) {\n      continue;\n      throw new ClaimError('CLAIM_UNKNOWN_FACT'", [T.claim]],
  // --- method profile ------------------------------------------------------------------
  ['PD-5: floor weakened to OR', I + 'interpretive-claim.ts', "if (kinds.size >= 2 && claim.methodRefs.length >= 2) {", "if (kinds.size >= 2 || claim.methodRefs.length >= 2) {", [T.claim]],
  ['PD-6: deferred methodRef accepted', I + 'interpretive-claim.ts', "    if (!isApprovedStatus(method.status)) {\n      throw", "    if (!isApprovedStatus(method.status) && method.methodId === '') {\n      throw", [T.claim]],
  ['SEASON: MARK_SEASON re-added', I + 'method-registry.ts', "['NAME_BRANCH', 'HAND_OFF_TO_HIDDEN_STEMS']", "['NAME_BRANCH', 'HAND_OFF_TO_HIDDEN_STEMS', 'MARK_SEASON']", [T.registry]],
  ['SEASON: mapping requirement off', I + 'method-registry.ts', "if (mapping !== null && !registry.approvedDeterministicMappings.includes(mapping)) {", "if (mapping !== null && mapping === '') {", [T.registry]],
  ['ENABLE: identity-pair precondition off', I + 'method-registry.ts', "if (method.evidence.mode === 'ANY_TWO_FACTS' && firstIdentityPair(facts) === null) {", "if (method.evidence.mode === 'ANY_TWO_FACTS' && firstIdentityPair(facts) === null && facts.length < 0) {", [T.registry]],
  ['ENABLE: pillar precondition off', I + 'method-registry.ts', "if (!facts.some((fact) => fact.pillar !== null && readable.has(fact.kind))) {", "if (!facts.some((fact) => fact.pillar !== null && readable.has(fact.kind)) && facts.length < 0) {", [T.registry]],
  ['IDENTITY: day master pairs with the day stem', I + 'method-registry.ts', "  pillar_stem: 'stem',\n", "  pillar_stem: 'stem',\n  day_master: 'stem',\n", [T.registry, T.claim]],
  ['IDENTITY: visible and hidden stem elements split again', I + 'method-registry.ts', "  hidden_stem_element: 'stem_element',", "  hidden_stem_element: 'hidden_stem_element',", [T.registry, T.claim]],
  ['IDENTITY: elements compared without the released bridge', I + 'method-registry.ts', "  if (fact.kind !== 'hidden_stem_element') {\n    return fact.value;\n  }", "  if (fact.kind !== 'hidden_stem_element' || fact.value.length > 0) {\n    return fact.value;\n  }", [T.registry]],
  ['IDENTITY: every element pairs with every element', I + 'method-registry.ts', "  return leftValue !== null && leftValue === identityValue(right);", "  return leftValue !== null && (leftValue === identityValue(right) || domain === 'stem_element');", [T.registry]],
  ['DRIFT: an unreleased registry authorises a hand-off', I + 'method-registry.ts', "if (released === undefined || released !== actual) {", "if (released === undefined) {", [T.registry]],
  // --- provisionality / unknown time -----------------------------------------------------
  ['PROV: hour-only provisionality', I + 'feature-set.ts', "(pillar !== null && provisional.has(pillar)) || assumedTimeDerived", "(pillar === 'hour' && provisional.has(pillar)) || assumedTimeDerived", [T.prov]],
  ['PROV: wu-xing statement ignored', I + 'feature-set.ts', "    ['wuxing.precision.provisionalFields', model.wuxing.precision.provisionalFields],\n", "", [T.prov]],
  ['PROV: wu-xing certain under unknown time', I + 'feature-set.ts', "(!birthTimeKnown || provisional.size > 0) &&", "(false as boolean) &&", [T.prov, T.input]],
  ['PROV: unmapped provisional field dropped', I + 'feature-set.ts', "      if (!isPillarName(field)) {\n        throw", "      if (!isPillarName(field)) {\n        continue;\n        throw", [T.prov]],
  ['PROV: provisional claim laundered', I + 'interpretive-claim.ts', "if (provisional.length > 0 && claim.epistemicClass !== 'TENTATIVE_INTERPRETATION') {", "if (provisional.length > 99 && claim.epistemicClass !== 'TENTATIVE_INTERPRETATION') {", [T.prov]],
  ['HOUR: assumed hour interpretable', I + 'feature-set.ts', "interpretable: !assumedTimeDerived,", "interpretable: true,", [T.prov, T.hour]],
  ['REQUEST: boundary left to the producer default', WIRE, "    boundary: FUFIRE_DAY_BOUNDARY,\n", "", [T.request]],
];

const results = [];
for (const [name, file, find, replace, tests] of MUTANTS) {
  const original = readFileSync(file, 'utf8');
  const occurrences = original.split(find).length - 1;
  if (occurrences !== 1) {
    results.push([name, `SETUP_ERROR (pattern occurs ${occurrences}x in ${file})`]);
    continue;
  }
  writeFileSync(file, original.replace(find, replace));
  let red;
  try {
    red = spawnSync('npx', ['vitest', 'run', ...tests], { encoding: 'utf8' }).status !== 0;
  } finally {
    writeFileSync(file, original);
  }
  results.push([name, red ? 'RED (guard holds)' : 'STAYED GREEN — guard is decoration']);
}

let failed = 0;
for (const [name, outcome] of results) {
  if (!outcome.startsWith('RED')) failed += 1;
  process.stdout.write(`${outcome.padEnd(36)} :: ${name}\n`);
}
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'src', 'tests'], { encoding: 'utf8' }).trim();
if (dirty.length > 0) {
  process.stdout.write(`MUTATION_RESIDUE:\n${dirty}\n`);
  failed += 1;
}
process.stdout.write(`\n${results.length - failed}/${results.length} mutants killed; working tree ${dirty.length === 0 ? 'clean' : 'DIRTY'}\n`);
process.exit(failed === 0 ? 0 : 1);
