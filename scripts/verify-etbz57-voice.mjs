#!/usr/bin/env node
/**
 * ETBZ-57 — source-mutation proofs for the customer-voice revision.
 *
 * For each voice gate of `acceptSkillReading`, the editorial pass
 * (`acceptEditorialRevision`) and the candidate-bundle boundary: weaken it in
 * exactly one place, run the suites that claim to protect it, and require them
 * to turn RED. A guard whose removal leaves the suite green is decoration. The
 * unmutated baseline must be GREEN first — otherwise "red" proves nothing.
 *
 * RED means a TEST failed an ASSERTION (the ETBZ-30B semantics). A mutant that
 * names its killer is killed only by that test failing an assertion; a run that
 * times out, fails to load, or throws inside a test body is an error, not a kill.
 *
 * Every file is restored from bytes held in memory; the run fails if the tree
 * differs from before.
 *
 *   npm run guards:etbz57
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const READING = 'src/application/skill/skill-reading.ts';
const BUNDLE = 'src/application/skill/skill-contract-bundle.ts';
const PACKAGE = 'src/application/skill/skill-package.ts';

const T = {
  negative: 'tests/negative/etbz57-voice.negative.test.ts',
  contract: 'tests/contract/etbz57-skill-voice.contract.test.ts',
  contract52: 'tests/contract/etbz52-skill-fixture-run.contract.test.ts',
};

/** [name, kind, file, find, replace, tests, killer] — kind 'text' (find occurs exactly once). */
// Retired with the release of 1.1.0 (2026-10-01): no bundle version is a candidate, so the candidate
// opt-in at the package, the portable copy and the reading boundary and the candidate decision-date rule cannot be
// observed. Re-arm these four with the next candidate version:
//   "CANDIDATE: a candidate bundle builds a released-run package"
//   "CANDIDATE: a CANDIDATE contract may carry a decision date"
//   "CANDIDATE: a reading under the candidate bundle needs no opt-in"
//   "CANDIDATE: a portable candidate copy needs no opt-in"
const MUTANTS = [
  ["VOICE: the voice gates are switched off for 1.1.0", 'text', READING,
    "  const voice = VOICE_GATED_SKILLS.has(reading.skillRef);",
    "  const voice = false;",
    [T.negative], "refuses an interpretive paragraph over SUPPORTED claims only written as TENTATIVE"],
  ["VOICE: the voice gates also hold the 1.0.0 reading", 'text', READING,
    "const VOICE_GATED_SKILLS: ReadonlySet<string> = new Set([SKILL_REF_V1_1]);",
    "const VOICE_GATED_SKILLS: ReadonlySet<string> = new Set([SKILL_REF_V1_1, 'bazodiac-interpretation-skill@1.0.0']);",
    [T.negative], "keeps the 1.0.0 reading accepted under the 1.0.0 bundle"],
  ["DIRECTNESS: SUPPORTED claims may be written TENTATIVE", 'text', READING,
    "        if (interpretive && !tentative && paragraph.posture === 'TENTATIVE') {",
    "        if (false) {",
    [T.negative], "refuses an interpretive paragraph over SUPPORTED claims only written as TENTATIVE"],
  ["DIRECTNESS: a retired template hedge passes on SUPPORTED", 'text', READING,
    "        const hedge = plain ? findTemplateHedge(paragraph.text) : certain ? findFrameworkTemplate(paragraph.text) : null;",
    "        const hedge = null as string | null;",
    [T.negative], "refuses a SUPPORTED paragraph hedged with a retired template"],
  ["TENTATIVE: a TENTATIVE paragraph needs no visible marker", 'text', READING,
    "        if (paragraph.posture === 'TENTATIVE' && !hasTentativeMarker(paragraph.text)) {",
    "        if (false) {",
    [T.negative], "refuses a paragraph over a provisional fact written TENTATIVE without a visible marker"],
  ["TENTATIVE: an everyday word counts as a tentative marker", 'text', READING,
    "    'vielleicht', 'möglicherweise', 'eventuell',",
    "    'dein', 'vielleicht', 'möglicherweise', 'eventuell',",
    [T.negative], "refuses a paragraph over a provisional fact written TENTATIVE without a visible marker"],
  ["SURFACE: meta-narration passes", 'text', READING,
    "  if (meta !== null) {",
    "  if (false) {",
    [T.negative], "refuses a FACT paragraph naming the source"],
  ["SURFACE: \"Quelle\" is dropped from the meta list", 'text', READING,
    "    'quelle', 'quellen', 'datenquelle',",
    "    'quellen', 'datenquelle',",
    [T.negative], "refuses a FACT paragraph naming the source"],
  ["SURFACE: the reading title is not held to the voice gates", 'text', READING,
    "  if (voice) checkVoiceSurface(reading.title, 'title', [], contrastPairs);\n",
    "",
    [T.negative], "refuses the reading title"],
  ["SURFACE: chapter titles are not held to the voice gates", 'text', READING,
    "      checkVoiceSurface(chapter.title, `${where}.title`, titleClaims, contrastPairs, labelsOf(groundingOf(titleClaims)));\n",
    "",
    [T.negative], "refuses a chapter title"],
  ["SURFACE: reflection questions are not held to the voice gates", 'text', READING,
    "    if (voice) checkVoiceSurface(question.text, at, claims, contrastPairs, labelsOf(groundingOf(claims)));\n",
    "",
    [T.negative], "refuses a reflection question"],
  ["SURFACE: the method note escapes the 1.1 prohibited phrases", 'text', READING,
    "  const methodNoteProhibited = voice ? findVoiceProhibitedWording(reading.methodNote.text) : null;",
    "  const methodNoteProhibited = null as Readonly<{ classId: string; phrase: string }> | null;",
    [T.negative], "refuses fate in the method note"],
  ["EDGE: tension language passes without a contrast", 'text', READING,
    "  if (tension !== null && !citesContrastPair(claims, contrastPairs)) {",
    "  if (false) {",
    [T.negative], "refuses tension language in a paragraph whose only claim is in no CONTRASTS_WITH relation"],
  ["EDGE: one pole of a contrast is enough for tension language", 'text', READING,
    "  return claims.some((left, index) => claims.slice(index + 1).some((right) => contrastPairs.has(pairKey(left.claimId, right.claimId))));",
    "  return claims.some((claim) => [...contrastPairs].some((key) => key.split('|').includes(claim.claimId)));",
    [T.negative], "refuses tension language over two claims that are each in a contrast, but not with each other"],
  ["EDGE: a contrast pair keeps the relation's direction", 'text', READING,
    "  return left < right ? `${left}|${right}` : `${right}|${left}`;",
    "  return `${left}|${right}`;",
    [T.negative], "accepts tension language over both poles cited against the relation"],
  ["EDGE: \"Gegensatz\" is dropped from the tension words", 'text', READING,
    "'gegensatz*', 'gegensätz*', ",
    "",
    [T.negative], "refuses a manufactured opposition"],
  ["DIRECTNESS: a tentative marker passes over SUPPORTED claims", 'text', READING,
    "        if (marker !== null) {",
    "        if (false) {",
    [T.negative], "refuses a SUPPORTED paragraph that keeps its posture but adds doubt in the text"],
  ["DIRECTNESS: FRAME paragraphs over SUPPORTED claims escape the voice checks", 'text', READING,
    "        const certain = claims.length > 0 && !tentative;",
    "        const certain = paragraph.posture === 'SUPPORTED';",
    [T.negative], "refuses a retired template in a FRAME paragraph over SUPPORTED claims"],
  ["TENTATIVE: the trait adjective \"vorsichtig\" counts as a marker", 'text', READING,
    "'vorsichtig gelesen', 'vorsichtig formuliert',",
    "'vorsichtig*',",
    [T.negative], "does not take the trait adjective"],
  ["DIRECTNESS: a graph-carried alternative loses its bounded wording", 'text', READING,
    "        const plain = certain && !claims.every((claim) => inAlternative.has(claim.claimId));",
    "        const plain = certain;",
    [T.negative], "keeps bounded wording where the graph carries an ALTERNATIVE_READING"],
  ["DIRECTNESS: one alternative-linked claim lifts the gate for its neighbours", 'text', READING,
    "        const plain = certain && !claims.every((claim) => inAlternative.has(claim.claimId));",
    "        const plain = certain && !claims.some((claim) => inAlternative.has(claim.claimId));",
    [T.negative], "refuses doubt in a paragraph that also cites a claim the alternative does not cover"],
  ["DIRECTNESS: any alternative in the graph lifts the gate everywhere", 'text', READING,
    "        const plain = certain && !claims.every((claim) => inAlternative.has(claim.claimId));",
    "        const plain = certain && inAlternative.size === 0;",
    [T.negative], "refuses doubt in a paragraph that also cites a claim the alternative does not cover"],
  ["DIRECTNESS: the framework template passes over an alternative", 'text', READING,
    "        const hedge = plain ? findTemplateHedge(paragraph.text) : certain ? findFrameworkTemplate(paragraph.text) : null;",
    "        const hedge = plain ? findTemplateHedge(paragraph.text) : null;",
    [T.negative], "refuses the framework template even over a graph-carried alternative"],
  ["DIRECTNESS: the target of an alternative is not covered", 'text', READING,
    "        inAlternative.add(relation.targetClaimId);\n",
    "",
    [T.negative], "counts the target of an ALTERNATIVE_READING as covered too"],
  ["SURFACE: a chapter title may not use the labels its claims are grounded in", 'text', READING,
    "      checkVoiceSurface(chapter.title, `${where}.title`, titleClaims, contrastPairs, labelsOf(groundingOf(titleClaims)));\n",
    "      checkVoiceSurface(chapter.title, `${where}.title`, titleClaims, contrastPairs);\n",
    [T.negative], "accepts a producer label in a chapter title and a FRAME paragraph"],
  ["SURFACE: a paragraph may use only the labels of the facts it cites itself", 'text', READING,
    "        checkVoiceSurface(paragraph.text, at, claims, contrastPairs, labelsOf([...facts, ...groundingOf(claims)]));",
    "        checkVoiceSurface(paragraph.text, at, claims, contrastPairs, labelsOf(facts));",
    [T.negative], "accepts a producer label in a chapter title and a FRAME paragraph"],
  ["SURFACE: a reflection question may use every chart label", 'text', READING,
    "    if (voice) checkVoiceSurface(question.text, at, claims, contrastPairs, labelsOf(groundingOf(claims)));\n",
    "    if (voice) checkVoiceSurface(question.text, at, claims, contrastPairs, labelsOf(inputPackage.facts));\n",
    [T.negative], "refuses a producer label in a reflection question or a chapter title"],
  ["SURFACE: a chapter title may use every chart label", 'text', READING,
    "      checkVoiceSurface(chapter.title, `${where}.title`, titleClaims, contrastPairs, labelsOf(groundingOf(titleClaims)));\n",
    "      checkVoiceSurface(chapter.title, `${where}.title`, titleClaims, contrastPairs, labelsOf(inputPackage.facts));\n",
    [T.negative], "refuses a producer label in a reflection question or a chapter title"],
  ["SURFACE: a cited label is stripped as a bare substring", 'text', READING,
    "    rest = rest.replace(new RegExp(`(?<![\\\\p{L}\\\\p{N}])${escaped}(?![\\\\p{L}\\\\p{N}])`, 'gu'), ' ');",
    "    rest = rest.split(normalise(label)).join(' ');",
    [T.negative], "an inflected meta word beside a cited label"],
  ["SURFACE: a reflection question may not use the labels its claims are grounded in", 'text', READING,
    "    if (voice) checkVoiceSurface(question.text, at, claims, contrastPairs, labelsOf(groundingOf(claims)));\n",
    "    if (voice) checkVoiceSurface(question.text, at, claims, contrastPairs);\n",
    [T.negative], "accepts a producer label in a reflection question"],
  ["COUNT: the method note may state a count", 'text', READING,
    "  if (methodNoteCount !== null) {",
    "  if (false) {",
    [T.negative], "refuses a count in the method note"],
  ["COUNT: a count word passes", 'text', READING,
    "  if (count !== null) {",
    "  if (false) {",
    [T.negative], "refuses the count"],
  ["COUNT: \"zweimal\" is dropped from the count words", 'text', READING,
    "    'zweimal', 'dreimal',",
    "    'dreimal',",
    [T.negative], "refuses a count in a chapter title"],
  ["SURFACE: a cited producer label is read as talk about the source", 'text', READING,
    "  const meta = findMetaNarration(withoutLabels(text, citedLabels));",
    "  const meta = findMetaNarration(text);",
    [T.negative], "accepts a producer label containing"],
  ["SURFACE: inflected chapter references pass", 'text', READING,
    "'kapitel*', 'dieses reading',",
    "'kapitel', 'dieses reading',",
    [T.negative], "refuses a paragraph narrating later chapters"],
  ["CONCRETE: \"Kind\" is dropped from the life-domain list", 'text', READING,
    "'schwester*', 'kind', 'kinder',",
    "'schwester*', 'kinder',",
    [T.negative], "Als Kind"],
  ["CONCRETE: the method note may name a life domain", 'text', READING,
    "  if (methodNoteDomain !== null) {",
    "  if (false) {",
    [T.negative], "refuses a life domain in the method note"],
  ["EDIT: the method note may be rewritten", 'text', READING,
    "    methodNote: { text: reading.methodNote.text, warningCodes: reading.methodNote.warningCodes },\n",
    "    methodNote: { warningCodes: reading.methodNote.warningCodes },\n",
    [T.negative], "refuses a revision of the method note"],
  ["EDIT: reflection bindings are left out of the compared structure", 'text', READING,
    "    reflectionQuestions: reading.reflectionQuestions.map((question) => ({ claimRefs: question.claimRefs })),\n",
    "",
    [T.negative], "refuses a revision that rebinds a reflection question"],
  ["EDIT: callbacks are left out of the compared structure", 'text', READING,
    "      callbacks: chapter.callbacks,\n    })),\n    reflectionQuestions:",
    "    })),\n    reflectionQuestions:",
    [T.negative], "refuses a revision that changes the kind of a callback"],
  ["EDIT: semantic deltas are left out of the compared structure", 'text', READING,
    "      semanticDelta: chapter.semanticDelta,\n      callbacks: chapter.callbacks,\n    })),",
    "      callbacks: chapter.callbacks,\n    })),",
    [T.negative], "refuses a revision that changes a semantic delta"],
  ["UNKNOWN: a portable copy's version is checked only after its statuses", 'text', BUNDLE,
    "  specFor(portableCore.bundleVersion);\n",
    "",
    [T.negative], "refuses a portable copy of a bundle version this repository does not build"],
  ["UNKNOWN: a prototype key resolves as a bundle version", 'text', BUNDLE,
    "  const spec = Object.hasOwn(BUNDLE_VERSION_SPECS, bundleVersion) ? BUNDLE_VERSION_SPECS[bundleVersion] : undefined;",
    "  const spec = BUNDLE_VERSION_SPECS[bundleVersion];",
    [T.negative], "refuses a portable copy of a bundle version this repository does not build"],
  ["UNKNOWN: a prototype key runs a Skill", 'text', PACKAGE,
    "  const skillRef = Object.hasOwn(SKILL_REF_BY_BUNDLE_VERSION, bundleVersion) ? SKILL_REF_BY_BUNDLE_VERSION[bundleVersion] : undefined;",
    "  const skillRef = SKILL_REF_BY_BUNDLE_VERSION[bundleVersion];",
    [T.negative], "runs no Skill under a bundle version it does not know"],
  ["CONCRETE: a life domain passes", 'text', READING,
    "  if (domain !== null) {",
    "  if (false) {",
    [T.negative], "refuses \"Im Beruf"],
  ["CONCRETE: \"beruf\" is dropped from the life-domain list", 'text', READING,
    "'kolleg*', 'beruf*', 'karriere*',",
    "'kolleg*', 'karriere*',",
    [T.negative], "refuses \"Im Beruf"],
  ["PROHIBITED: fate passes in a 1.1 reading", 'text', READING,
    "    'schicksal*', 'fate', 'destiny',",
    "    'fate', 'destiny',",
    [T.negative], "refuses a revision that injects fate"],
  ["PROHIBITED: a deterministic identity passes", 'text', READING,
    "    'du bist jemand', 'du bist ein mensch',",
    "    'du bist ein mensch',",
    [T.negative], "refuses a revision that injects a deterministic identity"],
  ["EDIT: the structure of a revision is not compared", 'text', READING,
    "  if (differing !== null) {",
    "  if (false) {",
    [T.negative], "refuses a revision that adds a fact reference"],
  ["EDIT: fact references are left out of the compared structure", 'text', READING,
    "        factRefs: paragraph.factRefs,\n        claimRefs: paragraph.claimRefs,\n      })),\n      semanticDelta: chapter.semanticDelta,",
    "        claimRefs: paragraph.claimRefs,\n      })),\n      semanticDelta: chapter.semanticDelta,",
    [T.negative], "refuses a revision that adds a fact reference"],
  ["EDIT: a forged semantic reading is trusted", 'text', READING,
    "  if (acceptSkillReading(semanticDraft, context).structuralHash !== semanticHash) {",
    "  if (false) {",
    [T.negative], "refuses a \"semantic\" reading that is not the accepted reading"],
  ["CANDIDATE: a released bundle passes as a candidate", 'text', BUNDLE,
    "  if (!HASH_PATTERN.test(bundle.structuralHash) || actual !== bundle.structuralHash || candidate === undefined || candidate !== actual) {",
    "  if (!HASH_PATTERN.test(bundle.structuralHash) || actual !== bundle.structuralHash) {",
    [T.negative], "builds a released-run package under bundle 1.1.0"],
  ["CANDIDATE: a CANDIDATE contract is accepted in any bundle version", 'text', BUNDLE,
    "    if (source.status !== 'CURRENT' && !(source.status === 'CANDIDATE' && isCandidateVersion(core.bundleVersion))) {",
    "    if (source.status !== 'CURRENT' && !(source.status === 'CANDIDATE')) {",
    [T.negative], "refuses a CANDIDATE contract in a bundle version that is not a candidate"],
  ["IDENTITY: the 1.1.0 bundle runs the 1.0.0 Skill", 'text', PACKAGE,
    "  '1.1.0': SKILL_REF_V1_1,\n",
    "  '1.1.0': SKILL_REF,\n",
    [T.negative], "accepts the REALISE reading and its EDIT revision"],
];

const REPORT_DIR = mkdtempSync(join(tmpdir(), 'etbz57-mutants-'));
const REPORT = join(REPORT_DIR, 'vitest.json');

function run(tests) {
  rmSync(REPORT, { force: true });
  const result = spawnSync('npx', ['vitest', 'run', ...tests, '--reporter=json', `--outputFile=${REPORT}`], { encoding: 'utf8' });
  if (result.status === null || result.error !== undefined) return { outcome: 'DID_NOT_FINISH' };
  if (result.status === 0) return { outcome: 'GREEN' };
  let report;
  try {
    report = JSON.parse(readFileSync(REPORT, 'utf8'));
  } catch {
    return { outcome: 'NO_REPORT' };
  }
  const failed = (report.testResults ?? []).flatMap((file) => (file.assertionResults ?? []).filter((test) => test.status === 'failed'));
  if (failed.length === 0) return { outcome: 'NO_ASSERTION_FAILED' };
  if (failed.some((test) => (test.failureMessages ?? []).some((message) => /timed out/iu.test(message)))) return { outcome: 'TIMEOUT' };
  return {
    outcome: 'RED',
    failed: failed.map((test) => ({
      fullName: test.fullName,
      asserted: (test.failureMessages ?? []).some((message) => message.startsWith('AssertionError')),
    })),
  };
}

function verdictOf(verdict, killer) {
  if (verdict.outcome === 'GREEN') return 'STAYED GREEN — guard is decoration';
  if (verdict.outcome !== 'RED') return `RUN_ERROR (${verdict.outcome}) — not a proof`;
  if (killer === undefined || killer === null) return `RED (guard holds) <- ${verdict.failed[0].fullName}`;
  const named = verdict.failed.filter((test) => test.fullName.includes(killer));
  const by = named.find((test) => test.asserted);
  if (by !== undefined) return `RED (guard holds) <- ${by.fullName}`;
  return named.length > 0
    ? `RUN_ERROR (KILLER_DID_NOT_ASSERT: "${named[0].fullName}" threw instead of failing an assertion) — not a proof`
    : `RUN_ERROR (KILLED_BY_OTHER_TEST: "${verdict.failed[0].fullName}", expected "${killer}") — not a proof`;
}

const trackedState = () =>
  execFileSync('git', ['status', '--porcelain', '--', 'src', 'tests', 'scripts', 'skill', 'docs'], { encoding: 'utf8' }).trim();
const stateBefore = trackedState();

const ALL_SUITES = [T.negative, T.contract, T.contract52];
const baseline = run(ALL_SUITES);
if (baseline.outcome !== 'GREEN') {
  process.stdout.write(`BASELINE_NOT_GREEN (${baseline.outcome}): the unmutated suites fail, so a red mutant would prove nothing\n`);
  process.exit(1);
}
process.stdout.write('BASELINE GREEN (unmutated)\n');

const results = [];
for (const [name, kind, file, find, replace, tests, killer] of MUTANTS) {
  let restore;
  try {
    if (kind === 'text') {
      const original = readFileSync(file, 'utf8');
      const occurrences = original.split(find).length - 1;
      if (occurrences !== 1) {
        results.push([name, `SETUP_ERROR (pattern occurs ${occurrences}x in ${file})`]);
        continue;
      }
      writeFileSync(file, original.replace(find, replace));
      restore = () => writeFileSync(file, original);
    } else if (kind === 'create') {
      if (existsSync(file)) {
        results.push([name, `SETUP_ERROR (${file} already exists)`]);
        continue;
      }
      writeFileSync(file, find);
      restore = () => rmSync(file, { force: true });
    } else {
      results.push([name, `SETUP_ERROR (unknown mutation kind "${kind}")`]);
      continue;
    }
    let verdict;
    try {
      verdict = run(tests);
    } finally {
      restore();
    }
    results.push([name, verdictOf(verdict, killer)]);
  } catch (error) {
    if (restore !== undefined) restore();
    results.push([name, `SETUP_ERROR (${error.message})`]);
  }
}
rmSync(REPORT_DIR, { recursive: true, force: true });

let killed = 0;
for (const [name, outcome] of results) {
  if (outcome.startsWith('RED')) killed += 1;
  process.stdout.write(`${name}\n    ${outcome}\n`);
}
const stateAfter = trackedState();
const residue = stateAfter === stateBefore ? '' : stateAfter;
if (residue.length > 0) process.stdout.write(`MUTATION_RESIDUE (tree differs from before the run):\n${residue}\n`);
const after = run(ALL_SUITES);
process.stdout.write(`\n${killed}/${MUTANTS.length} mutants killed · baseline after restore: ${after.outcome}\n`);
if (killed !== MUTANTS.length || after.outcome !== 'GREEN' || residue.length > 0) process.exit(1);
