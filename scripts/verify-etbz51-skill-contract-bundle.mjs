#!/usr/bin/env node
/**
 * ETBZ-51 — source-mutation proofs for the Skill Contract Bundle guards.
 *
 * For each guard listed below: weaken it in exactly one place, run the suites
 * that claim to protect it, and require them to turn RED. A guard whose removal
 * leaves the suite green is decoration. The unmutated baseline must be GREEN
 * first — otherwise "red" proves nothing.
 *
 * RED means a TEST failed an ASSERTION (the ETBZ-30B semantics). A mutant that
 * only makes a run time out, or that breaks loading or collection, proves
 * nothing about the guard and is reported as an error, never as a kill. A
 * mutant that names its killer is killed only by that test failing an assertion.
 *
 * Two mutation kinds:
 *   text    find/replace in a UTF-8 file, restored from the original string
 *   create  add a file that must not exist, removed again afterwards
 *
 * Every file is restored from bytes held in memory rather than by `git
 * checkout`, which would also discard any uncommitted repair made while the run
 * was in flight. The run fails if the working tree differs from before.
 *
 *   npm run guards:etbz51
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BUNDLE = 'src/application/skill/skill-contract-bundle.ts';
const SOURCES = 'src/application/skill/contract-sources.ts';

const T = {
  unit: 'tests/unit/etbz51-skill-contract-bundle.test.ts',
  negative: 'tests/negative/etbz51-skill-contract-bundle.negative.test.ts',
  architecture: 'tests/architecture/etbz51-skill-boundary.test.ts',
};

/**
 * [name, kind, file, find|contents, replace, tests, killer?]
 *   kind 'text'   — `find` must occur exactly once
 *   kind 'create' — `find` is the file contents, `replace` is unused
 */
const MUTANTS = [
  // --- every required contract, released --------------------------------------------------
  ['REQUIRED: a missing contract is tolerated', 'text', BUNDLE,
    "    if (!byKey.has(key)) {\n      throw new SkillContractError('REQUIRED_CONTRACT_MISSING', `the bundle carries no \"${key}\" contract; a Skill run without it is not bound`, { key });",
    "    if (false) {\n      throw new SkillContractError('REQUIRED_CONTRACT_MISSING', `the bundle carries no \"${key}\" contract; a Skill run without it is not bound`, { key });",
    [T.negative], 'refuses a bundle without'],
  ['DRAFT: a draft entry in the core authorises a run', 'text', BUNDLE,
    "    if (source.status !== 'CURRENT') {\n      throw new SkillContractError(\n        'DRAFT_CONTRACT_REFUSED',\n        `contract \"${source.key}\" has status",
    "    if (false) {\n      throw new SkillContractError(\n        'DRAFT_CONTRACT_REFUSED',\n        `contract \"${source.key}\" has status",
    [T.negative], 'refuses a DRAFT contract entry in the core'],
  ['DRAFT: a draft entry in a portable copy is compared instead of refused', 'text', BUNDLE,
    "    if (source.status !== 'CURRENT') {\n      throw new SkillContractError(\n        'DRAFT_CONTRACT_REFUSED',\n        `portable contract",
    "    if (false) {\n      throw new SkillContractError(\n        'DRAFT_CONTRACT_REFUSED',\n        `portable contract",
    [T.negative], 'refuses a portable copy in which one contract was set to DRAFT'],

  // --- precedence -----------------------------------------------------------------------------
  ['PRECEDENCE: two owners of one domain are accepted', 'text', BUNDLE,
    "      if (existing !== undefined) {\n        throw new SkillContractError(\n          'PRECEDENCE_CONFLICT',",
    "      if (false) {\n        throw new SkillContractError(\n          'PRECEDENCE_CONFLICT',",
    [T.negative], 'refuses two owners of one domain'],
  ['PRECEDENCE: a domain without an owner is accepted', 'text', BUNDLE,
    '    if (!ownerOf.has(domain)) {',
    '    if (false) {',
    [T.negative], 'refuses a domain no contract owns'],
  ['PRECEDENCE: a contract in no tier is accepted', 'text', BUNDLE,
    '    if (!tierOf.has(key)) {',
    '    if (false) {',
    [T.negative], 'refuses a contract in no tier'],
  ['PRECEDENCE: a contract in two tiers is accepted', 'text', BUNDLE,
    "      if (tierOf.has(key)) {\n        throw new SkillContractError('PRECEDENCE_CONFLICT', `contract \"${key}\" sits in two precedence tiers`, { key });",
    "      if (false) {\n        throw new SkillContractError('PRECEDENCE_CONFLICT', `contract \"${key}\" sits in two precedence tiers`, { key });",
    [T.negative], 'refuses a contract in two tiers'],

  // --- agreement with what the repository already binds ---------------------------------------
  ['BINDING: the Lexicon entry is no longer compared to the plan binding', 'text', BUNDLE,
    "  expectBinding('TERMINOLOGY_LEXICON', lexicon, TERMINOLOGY_LEXICON_BINDING);",
    "  void lexicon;",
    [T.negative], 'refuses a Lexicon entry at another page version than the plan binding'],
  ['BINDING: repository markers are no longer compared', 'text', BUNDLE,
    '    if (core.repository[field] !== expectedRepository[field]) {',
    '    if (false) {',
    [T.negative], 'refuses a repository marker'],

  // --- the Method Profile cannot be widened by a contract ---------------------------------------
  ['PROFILE: a method the registry does not approve is accepted', 'text', BUNDLE,
    '    if (!approved.has(methodId)) {',
    '    if (false) {',
    [T.negative], 'refuses a near-neighbour feature bound to'],
  ['PROFILE: deferred and forbidden methods count as approved', 'text', BUNDLE,
    '.filter((method) => isApprovedStatus(method.status))',
    '.filter(() => true)',
    [T.negative], 'refuses a near-neighbour feature bound to'],
  ['AUTHORITY: the forbidden-key scan is disabled', 'text', BUNDLE,
    '      if (SYMBOLIC_AUTHORITY_KEYS.has(key)) {',
    '      if (false) {',
    [T.negative], 'refuses an envelope that carries methods'],
  ['AUTHORITY: numbers are accepted in contract data', 'text', BUNDLE,
    "  if (typeof value === 'number') {",
    '  if (false) {',
    [T.negative], 'refuses a number anywhere in contract data'],

  // --- release freeze ---------------------------------------------------------------------------
  ['RELEASE: the hash table is no longer consulted', 'text', BUNDLE,
    '  if (!HASH_PATTERN.test(bundle.structuralHash) || actual !== bundle.structuralHash || released === undefined || released !== actual) {',
    '  if (false) {',
    [T.negative], 'refuses a published hash that is not the content hash'],
  ['RELEASE: the released hash is altered by one hex digit', 'text', BUNDLE,
    "'sha256:1c8f80c38b57748e65035a6bd2d671604fb19574cdf3355326352fbe0e19564e'",
    "'sha256:1c8f80c38b57748e65035a6bd2d671604fb19574cdf3355326352fbe0e19564f'",
    [T.unit], 'frozen by the hash the release table carries'],
  ['SOURCES: the Anti-Boilerplate page version is bumped in place', 'text', SOURCES,
    "    confluencePageId: '72056833',\n    confluencePageVersion: '1',",
    "    confluencePageId: '72056833',\n    confluencePageVersion: '2',",
    [T.unit], 'binds exactly the five released contract sources'],

  // --- resolution, sources, drift -----------------------------------------------------------------
  ['RESOLVE: an unknown reference resolves to the first contract', 'text', BUNDLE,
    "  if (found.kind === 'RELEASED') return found.source;\n  throw new SkillContractError(\n    'UNKNOWN_CONTRACT_IDENTITY',",
    "  if (found.kind === 'RELEASED') return found.source;\n  return bundle.contracts[0];\n  throw new SkillContractError(\n    'UNKNOWN_CONTRACT_IDENTITY',",
    [T.negative], 'refuses "skill-output-contract@1.0.0"'],
  ['SOURCE: page and page version are no longer compared for a known identity', 'text', BUNDLE,
    '    source.confluencePageId !== binding.confluencePageId ||\n    source.confluencePageVersion !== binding.confluencePageVersion',
    '    false',
    [T.negative], 'refuses the right identity on another page'],
  ['DRIFT: evidence bound to another bundle version is accepted', 'text', BUNDLE,
    '  if (evidence.bundleRef !== bundle.bundleRef) {',
    '  if (false) {',
    [T.negative], 'refuses evidence bound to another bundle version'],
  ['DRIFT: a known contract at another version is not reported as drift', 'text', BUNDLE,
    "    if (found.kind === 'OTHER_VERSION') {\n      throw new SkillContractError(\n        'CONTRACT_DRIFT',",
    "    if (false) {\n      throw new SkillContractError(\n        'CONTRACT_DRIFT',",
    [T.negative], 'refuses evidence that binds a known contract at another version'],

  // --- the portable copy is a carrier, never an authority ------------------------------------------
  ['OVERRIDE: the portable copy is no longer compared to the repository bundle', 'text', BUNDLE,
    '  if (differing !== null) {',
    '  if (false) {',
    [T.negative], 'refuses a copy that re-binds the Lexicon to page version 2'],
  ['SCHEMA: the portable shape tolerates unknown keys', 'text', BUNDLE,
    'const portableSchema = z.strictObject({',
    'const portableSchema = z.object({',
    [T.negative], 'refuses an extra top-level key'],
  ['OVERRIDE: a key present on one side only is no longer a difference (it used to escape as a TypeError)', 'text', BUNDLE,
    '  if (expected === undefined || actual === undefined) {\n    return expected === actual ? null : path;\n  }',
    '  if (expected === undefined && actual === undefined) {\n    return null;\n  }',
    [T.negative], 'refuses an extra key inside a vocabulary block'],
  ['SCHEMA: prototype keys are no longer refused on the raw input', 'text', BUNDLE,
    "  refuseDangerousKeys(input, 'bundle');\n  const parsed = portableSchema.safeParse(input);",
    '  const parsed = portableSchema.safeParse(input);',
    [T.negative], 'refuses the prototype key "__proto__"'],
  ['RELEASE: a portable copy with another published hash is accepted', 'text', BUNDLE,
    '  if (published !== reference.structuralHash) {',
    '  if (false) {',
    [T.negative], 'refuses a copy whose only change is the published hash'],

  // --- guards the released content never exercises ----------------------------------------------------
  ['SCHEMA: the bundle version is no longer required to be a semver', 'text', BUNDLE,
    "  if (core.bundleId !== SKILL_CONTRACT_BUNDLE_ID || !/^\\d+\\.\\d+\\.\\d+$/u.test(core.bundleVersion)) {",
    '  if (false) {',
    [T.negative], 'refuses a bundle version that is not a semver'],
  ['SCHEMA: bundleRef is no longer tied to id and version', 'text', BUNDLE,
    '  if (core.bundleRef !== `${core.bundleId}@${core.bundleVersion}`) {',
    '  if (false) {',
    [T.negative], 'refuses a core whose bundleRef'],
  ['SCHEMA: an unknown contract key is accepted', 'text', BUNDLE,
    '    if (!(CONTRACT_KEYS as readonly string[]).includes(source.key)) {',
    '    if (false) {',
    [T.negative], 'refuses a contract key nothing released'],
  ['SCHEMA: a contract may occur twice', 'text', BUNDLE,
    '    if (byKey.has(source.key)) {',
    '    if (false) {',
    [T.negative], 'refuses a contract that occurs twice'],
  ['SCHEMA: the identity pattern is no longer checked', 'text', BUNDLE,
    '    if (source.identity !== null && !IDENTITY_PATTERN.test(source.identity)) {',
    '    if (false) {',
    [T.negative], 'refuses a released identity that is not'],
  ['SCHEMA: page id and page version patterns are no longer checked', 'text', BUNDLE,
    '    if (!PAGE_ID_PATTERN.test(source.confluencePageId) || !PAGE_ID_PATTERN.test(source.confluencePageVersion)) {',
    '    if (false) {',
    [T.negative], 'refuses a page id that is not a page reference'],
  ['SCHEMA: title and decision date are no longer checked', 'text', BUNDLE,
    "    if (source.title.trim() === '' || !isCalendarDate(source.releasedOn)) {",
    '    if (false) {',
    [T.negative], 'refuses a decision date that is not YYYY-MM-DD'],
  ['SCHEMA: a decision date only needs the shape, not a calendar', 'text', BUNDLE,
    '  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;\n  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];\n  return day <= (lengths[month - 1] ?? 0);',
    '  return true;',
    [T.negative], 'refuses a decision date that has the shape but is no calendar date: 2026-02-30'],
  ['SCHEMA: a dependency may be listed twice', 'text', BUNDLE,
    '    if (new Set(source.dependsOn).size !== source.dependsOn.length) {',
    '    if (false) {',
    [T.negative], 'refuses a dependency listed twice'],
  ['SCHEMA: an unknown domain is accepted', 'text', BUNDLE,
    '      if (!(CONTRACT_DOMAINS as readonly string[]).includes(domain)) {',
    '      if (false) {',
    [T.negative], 'refuses a domain nothing defines'],
  ['SCHEMA: a self- or unbound dependency is accepted', 'text', BUNDLE,
    '      if (dependency === source.key || !byKey.has(dependency)) {',
    '      if (false) {',
    [T.negative], 'refuses a contract that depends on itself'],
  ['SCHEMA: a method reference need not be a string', 'text', BUNDLE,
    "            if (typeof methodId !== 'string') {",
    '            if (false) {',
    [T.negative], 'refuses a method reference that is not a string'],
  ['PRECEDENCE: a dependency cycle is no longer detected', 'text', BUNDLE,
    '    if (visiting.has(key)) {',
    '    if (false) {',
    [T.negative], 'refuses a dependency cycle'],
  ['PRECEDENCE: an empty tier is accepted', 'text', BUNDLE,
    '    if (tier.length === 0) {',
    '    if (false) {',
    [T.negative], 'refuses an empty precedence tier'],
  ['PRECEDENCE: a tier may name a contract the bundle does not carry', 'text', BUNDLE,
    "      if (!byKey.has(key)) {\n        throw new SkillContractError('PRECEDENCE_CONFLICT', `precedence names",
    "      if (false) {\n        throw new SkillContractError('PRECEDENCE_CONFLICT', `precedence names",
    [T.negative], 'refuses a tier that names a contract the bundle does not carry'],
  ['PRECEDENCE: the domain list is no longer compared to the known domains', 'text', BUNDLE,
    "  if ([...core.domains].sort().join(',') !== [...CONTRACT_DOMAINS].sort().join(',')) {",
    '  if (false) {',
    [T.negative], 'refuses a domain list that is not the known domains'],
  ['BINDING: the Lens entry is no longer compared to the plan binding', 'text', BUNDLE,
    "  expectBinding('INTERPRETATION_LENS', lens, INTERPRETATION_LENS_BINDING);",
    '  void lens;',
    [T.negative], 'refuses a Lens entry on another page than the plan binding'],
  ['BINDING: the Method Profile entry is no longer compared to the released profile ref', 'text', BUNDLE,
    '  if (profile === undefined || profile.identity !== METHOD_PROFILE_REF) {',
    '  if (false) {',
    [T.negative], 'refuses a Method Profile entry that is not the released profile ref'],
  ['BINDING: an unreleased registry is no longer refused before the field comparison', 'text', BUNDLE,
    '  if (releasedRegistryHash === undefined || expectedRepository.methodRegistryStructuralHash !== releasedRegistryHash) {',
    '  if (false) {',
    [T.negative], 'refuses a core validated against a registry that is not released'],
  ['RESOLVE: contractByKey returns undefined for a missing contract', 'text', BUNDLE,
    "  if (found === undefined) {\n    throw new SkillContractError('REQUIRED_CONTRACT_MISSING', `the bundle carries no \"${key}\" contract`, { key });",
    "  if (false) {\n    throw new SkillContractError('REQUIRED_CONTRACT_MISSING', `the bundle carries no \"${key}\" contract`, { key });",
    [T.negative], 'refuses contractByKey for a contract the core does not carry'],
  ['RESOLVE: a page address resolves an identity-bearing page as another version', 'text', BUNDLE,
    "    if (pageMatch !== null && source.identity === null && source.confluencePageId === pageMatch[1]) {",
    "    if (pageMatch !== null && source.confluencePageId === pageMatch[1]) {",
    [T.negative], 'refuses a page address for a page that released an identity'],
  ['DRIFT: evidence missing a bound contract is accepted', 'text', BUNDLE,
    "    if (!seen.has(key)) {\n      throw new SkillContractError(\n        'REQUIRED_CONTRACT_MISSING',\n        `the run's evidence records no",
    "    if (false) {\n      throw new SkillContractError(\n        'REQUIRED_CONTRACT_MISSING',\n        `the run's evidence records no",
    [T.negative], 'refuses run evidence that omits a bound contract'],
  ['DRIFT: a contract bound twice in the evidence is deduplicated', 'text', BUNDLE,
    '    if (seen.has(source.key)) {',
    '    if (false) {',
    [T.negative], 'refuses run evidence that binds a contract twice'],

  // --- the boundary ----------------------------------------------------------------------------------
  ['BOUNDARY: the HTTP layer imports the bundle', 'create',
    'src/http/__mutation_skill_import__.ts',
    "// TEMPORARY MUTATION - scripts/verify-etbz51-skill-contract-bundle.mjs, never committed.\nimport { SKILL_CONTRACT_BUNDLE_REF } from '../application/skill/index.js';\nexport const mutationRef = SKILL_CONTRACT_BUNDLE_REF;\n",
    null, [T.architecture], 'is imported by no module under src/http'],
  ['BOUNDARY: another application module imports the bundle', 'create',
    'src/application/__mutation_skill_consumer__.ts',
    "// TEMPORARY MUTATION - scripts/verify-etbz51-skill-contract-bundle.mjs, never committed.\nimport { SKILL_CONTRACT_BUNDLE_REF } from './skill/index.js';\nexport const mutationRef = SKILL_CONTRACT_BUNDLE_REF;\n",
    null, [T.architecture], 'is imported by no OTHER application module'],
  ['PURITY: the bundle reads the filesystem', 'create',
    'src/application/skill/__mutation_fs__.ts',
    "// TEMPORARY MUTATION - scripts/verify-etbz51-skill-contract-bundle.mjs, never committed.\nexport const mutationRead = 'readFileSync';\n",
    null, [T.architecture], 'does not reach for the filesystem'],
  ['DATA: a JSON copy of the bundle appears beside the modules', 'create',
    'src/application/skill/bundle.json',
    '{"bundleRef":"bazodiac-skill-contract-bundle@1.0.0"}\n',
    null, [T.architecture], 'ships as values'],
];

const REPORT_DIR = mkdtempSync(join(tmpdir(), 'etbz51-mutants-'));
const REPORT = join(REPORT_DIR, 'vitest.json');

function run(tests) {
  rmSync(REPORT, { force: true });
  const result = spawnSync(
    'npx',
    ['vitest', 'run', ...tests, '--reporter=json', `--outputFile=${REPORT}`],
    { encoding: 'utf8' },
  );
  if (result.status === null || result.error !== undefined) return { outcome: 'DID_NOT_FINISH' };
  if (result.status === 0) return { outcome: 'GREEN' };
  let report;
  try {
    report = JSON.parse(readFileSync(REPORT, 'utf8'));
  } catch {
    return { outcome: 'NO_REPORT' };
  }
  const failed = (report.testResults ?? []).flatMap((file) =>
    (file.assertionResults ?? []).filter((test) => test.status === 'failed'),
  );
  if (failed.length === 0) return { outcome: 'NO_ASSERTION_FAILED' };
  if (failed.some((test) => (test.failureMessages ?? []).some((message) => /timed out/iu.test(message)))) {
    return { outcome: 'TIMEOUT' };
  }
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
  if (killer === undefined || killer === null) {
    return `RED (guard holds) <- ${verdict.failed[0].fullName}`;
  }
  const named = verdict.failed.filter((test) => test.fullName.includes(killer));
  const by = named.find((test) => test.asserted);
  if (by !== undefined) return `RED (guard holds) <- ${by.fullName}`;
  return named.length > 0
    ? `RUN_ERROR (KILLER_DID_NOT_ASSERT: "${named[0].fullName}" threw instead of failing an assertion) — not a proof`
    : `RUN_ERROR (KILLED_BY_OTHER_TEST: "${verdict.failed[0].fullName}", expected "${killer}") — not a proof`;
}

const trackedState = () =>
  execFileSync('git', ['status', '--porcelain', '--', 'src', 'tests', 'scripts'], { encoding: 'utf8' }).trim();
const stateBefore = trackedState();

const ALL_SUITES = [T.unit, T.negative, T.architecture];
const baseline = run(ALL_SUITES);
if (baseline.outcome !== 'GREEN') {
  process.stdout.write(
    `BASELINE_NOT_GREEN (${baseline.outcome}): the unmutated suites fail, so a red mutant would prove nothing\n`,
  );
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
if (residue.length > 0) {
  process.stdout.write(`MUTATION_RESIDUE (tree differs from before the run):\n${residue}\n`);
}

const after = run(ALL_SUITES);
process.stdout.write(
  `\n${killed}/${MUTANTS.length} mutants killed · baseline after restore: ${after.outcome}\n`,
);

if (killed !== MUTANTS.length || after.outcome !== 'GREEN' || residue.length > 0) {
  process.exit(1);
}
