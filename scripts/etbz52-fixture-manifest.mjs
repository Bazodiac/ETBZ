#!/usr/bin/env node
/**
 * ETBZ-52 — write the generation manifest of the fixture Skill run.
 *
 * Reads docs/evidence/etbz-52/fixture/{skill-input,skill-reading,accepted-reading,customer-reading}.json
 * and skill/bazodiac-interpretation-skill-v1/MANIFEST.json, recomputes every hash it can, and writes
 * manifest.json beside them. The only fields it cannot recompute are the DECLARED ones — which runtime
 * and model produced the reading, when, by whom, at which repository head — so those are passed in and
 * recorded as declarations, separately from the measured hashes.
 *
 *   node scripts/etbz52-fixture-manifest.mjs --runtime <id> --model <id> --executed-at <date> --operator <text> --head <sha>
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const FIXTURE_DIR = resolve(ROOT, 'docs/evidence/etbz-52/fixture');
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const required = ['--runtime', '--model', '--executed-at', '--operator', '--head'];
for (const key of required) {
  if (!args.get(key)) {
    process.stderr.write(`ETBZ52_MANIFEST: ${key} is required\n`);
    process.exit(64);
  }
}

const canonicalJson = (await import(pathToFileURL(resolve(ROOT, 'dist/domain/canonical-json.js')).href)).canonicalJson;
const sha256Of = (buffer) => `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
const readJson = (name) => JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8'));

const inputPackage = readJson('skill-input.json');
const accepted = readJson('accepted-reading.json');
const skillManifest = JSON.parse(readFileSync(resolve(ROOT, 'skill/bazodiac-interpretation-skill-v1/MANIFEST.json'), 'utf8'));

const files = {};
for (const name of ['skill-input.json', 'skill-reading.json', 'accepted-reading.json', 'customer-reading.json']) {
  files[name] = sha256Of(readFileSync(join(FIXTURE_DIR, name)));
}

const measured = {
  manifestVersion: 'bazodiac-skill-fixture-run-manifest.v1',
  runId: 'etbz52-fixture-run-known-time-2026-09-28',
  skillRef: inputPackage.skillRef,
  skillPackageStructuralHash: skillManifest.packageStructuralHash,
  bundleRef: inputPackage.bundleRef,
  bundleStructuralHash: inputPackage.bundleStructuralHash,
  contracts: inputPackage.contracts,
  inputPackageStructuralHash: inputPackage.structuralHash,
  interpretationInputStructuralHash: inputPackage.interpretationInputStructuralHash,
  claimGraphStructuralHash: inputPackage.claimGraph.structuralHash,
  planStructuralHash: inputPackage.plan.structuralHash,
  acceptedReadingStructuralHash: accepted.structuralHash,
  subject: inputPackage.subject,
  warnings: inputPackage.warnings,
  files,
};
const generation = {
  runtime: args.get('--runtime'),
  model: args.get('--model'),
  executedAt: args.get('--executed-at'),
  operator: args.get('--operator'),
  repositoryHead: args.get('--head'),
  declared: true,
};
const manifest = { ...measured, generation };
writeFileSync(join(FIXTURE_DIR, 'manifest.json'), `${canonicalJson(manifest)}\n`);
process.stderr.write(`${manifest.runId}\naccepted ${manifest.acceptedReadingStructuralHash}\npackage ${manifest.inputPackageStructuralHash}\nskill ${manifest.skillPackageStructuralHash}\n`);
