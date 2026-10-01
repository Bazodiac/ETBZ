#!/usr/bin/env node
/**
 * ETBZ-52 — generate the machine parts of the Skill package and its manifest.
 * ETBZ-57 — with the argument `1.1.0`, the same for the voice-revision package
 * (skill/bazodiac-interpretation-skill-v1.1/, bundle 1.1.0, a CANDIDATE bundle
 * until its Human Editorial Gate). Without an argument it writes 1.0.0, unchanged.
 *
 * Writes into skill/bazodiac-interpretation-skill-v1/ (or -v1.1/):
 *   contract-bundle.json   the portable Skill Contract Bundle (canonical JSON) from the compiled module
 *   reading-schema.json    the JSON Schema of bazodiac-skill-reading.v1 from the compiled module
 *   MANIFEST.json          identities, hashes and the SHA-256 of every file of the package
 *
 * The hand-written parts (SKILL.md, README.md, wrappers/*.md) are read, never
 * written. `tests/contract/etbz52-skill-fixture-run.contract.test.ts` requires
 * the generated files and the manifest to be byte-identical to a fresh run.
 *
 *   npm run build && npm run etbz52:package      (1.0.0)
 *   npm run build && npm run etbz57:package      (1.1.0)
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const VERSION = process.argv[2] ?? '1.0.0';
const TARGETS = {
  '1.0.0': { dir: 'skill/bazodiac-interpretation-skill-v1', skillRef: 'SKILL_REF', skillVersion: 'SKILL_VERSION' },
  '1.1.0': { dir: 'skill/bazodiac-interpretation-skill-v1.1', skillRef: 'SKILL_REF_V1_1', skillVersion: 'SKILL_VERSION_V1_1' },
};
const target = Object.hasOwn(TARGETS, VERSION) ? TARGETS[VERSION] : undefined;
if (target === undefined) {
  process.stderr.write(`ETBZ52_PACKAGE: no Skill package for version ${VERSION}\n`);
  process.exit(64);
}
const PACKAGE_DIR = resolve(ROOT, target.dir);
const compiled = resolve(ROOT, 'dist/application/skill/index.js');
if (!existsSync(compiled)) {
  process.stderr.write('ETBZ52_PACKAGE: dist/application/skill/index.js missing — run `npm run build` first\n');
  process.exit(64);
}

const skill = await import(pathToFileURL(compiled).href);
const bundle = skill.buildSkillContractBundle(undefined, VERSION);
if (Object.hasOwn(skill.CANDIDATE_BUNDLE_HASHES, VERSION)) {
  skill.assertCandidateSkillContractBundle(bundle);
} else {
  skill.assertReleasedSkillContractBundle(bundle);
}

const canonicalJson = (await import(pathToFileURL(resolve(ROOT, 'dist/domain/canonical-json.js')).href)).canonicalJson;

writeFileSync(join(PACKAGE_DIR, 'contract-bundle.json'), `${skill.renderPortableSkillContractBundle(bundle)}\n`);
writeFileSync(join(PACKAGE_DIR, 'reading-schema.json'), `${canonicalJson(skill.skillReadingJsonSchema())}\n`);

function sha256(path) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function listFiles(dir) {
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current).sort()) {
      const entryPath = join(current, entry);
      if (statSync(entryPath).isDirectory()) walk(entryPath);
      else found.push(entryPath);
    }
  };
  walk(dir);
  return found;
}

const files = {};
for (const file of listFiles(PACKAGE_DIR)) {
  const name = relative(PACKAGE_DIR, file);
  if (name === 'MANIFEST.json') continue;
  files[name] = sha256(file);
}

const manifestCore = {
  manifestVersion: 'bazodiac-skill-package-manifest.v1',
  skillRef: skill[target.skillRef],
  skillId: skill.SKILL_ID,
  skillVersion: skill[target.skillVersion],
  readingSchemaVersion: skill.SKILL_READING_SCHEMA_VERSION,
  inputPackageVersion: skill.SKILL_INPUT_PACKAGE_VERSION,
  bundleRef: bundle.bundleRef,
  bundleStructuralHash: bundle.structuralHash,
  contracts: bundle.contracts.map((source) => ({
    contractRef: skill.contractBindingRef(source),
    confluencePageId: source.confluencePageId,
    confluencePageVersion: source.confluencePageVersion,
  })),
  files,
};
const packageStructuralHash = `sha256:${createHash('sha256').update(canonicalJson(manifestCore)).digest('hex')}`;
const manifest = { ...manifestCore, packageStructuralHash };
writeFileSync(join(PACKAGE_DIR, 'MANIFEST.json'), `${canonicalJson(manifest)}\n`);

process.stderr.write(`${manifest.skillRef}\n${manifest.packageStructuralHash}\n`);
for (const [name, digest] of Object.entries(files)) process.stderr.write(`${digest}  ${name}\n`);
