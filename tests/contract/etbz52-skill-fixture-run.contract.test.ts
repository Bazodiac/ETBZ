/**
 * ETBZ-52 — the Skill package and the fixture run evidence are regenerable.
 *
 * Everything committed under skill/bazodiac-interpretation-skill-v1/ and
 * docs/evidence/etbz-52/fixture/ that a machine produced is re-derived here and
 * must be byte-identical; every hash a manifest states is recomputed. What a
 * machine cannot produce — the instructions, the wrappers, the reading itself,
 * the declared generation record — is checked for presence and consistency.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import {
  SKILL_ID,
  SKILL_INPUT_PACKAGE_VERSION,
  SKILL_READING_SCHEMA_VERSION,
  SKILL_REF,
  SKILL_VERSION,
  acceptSkillReading,
  contractBindingRef,
  projectCustomerReading,
  renderPortableSkillContractBundle,
  skillReadingJsonSchema,
} from '../../src/application/skill/index.js';
import { skillFixture } from '../support/skillFixture.js';

const REPO_ROOT = process.cwd();
const PACKAGE_DIR = resolve(REPO_ROOT, 'skill/bazodiac-interpretation-skill-v1');
const FIXTURE_DIR = resolve(REPO_ROOT, 'docs/evidence/etbz-52/fixture');

const sha256Of = (buffer: Buffer): string => `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
const read = (dir: string, name: string): string => readFileSync(join(dir, name), 'utf8');
const readJson = (dir: string, name: string): Record<string, unknown> => JSON.parse(read(dir, name)) as Record<string, unknown>;

function listFiles(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current).sort()) {
      const entryPath = join(current, entry);
      if (statSync(entryPath).isDirectory()) walk(entryPath);
      else found.push(entryPath);
    }
  };
  walk(dir);
  return found;
}

const fixture = skillFixture();

describe('ETBZ-52: the Skill package is what a fresh generation produces', () => {
  const manifest = readJson(PACKAGE_DIR, 'MANIFEST.json');

  it('ships exactly the declared files', () => {
    const names = listFiles(PACKAGE_DIR).map((file) => relative(PACKAGE_DIR, file)).sort();
    expect(names).toEqual([
      'MANIFEST.json', 'README.md', 'SKILL.md', 'contract-bundle.json', 'reading-schema.json',
      'wrappers/chatgpt.md', 'wrappers/claude.md',
    ]);
  });

  it('carries the portable bundle exactly as the repository renders it', () => {
    expect(read(PACKAGE_DIR, 'contract-bundle.json')).toBe(`${renderPortableSkillContractBundle(fixture.bundle)}\n`);
  });

  it('carries the reading schema exactly as the boundary exports it', () => {
    expect(read(PACKAGE_DIR, 'reading-schema.json')).toBe(`${canonicalJson(skillReadingJsonSchema())}\n`);
  });

  it('states identities, bundle hash and contract set that equal the repository', () => {
    expect(manifest['skillRef']).toBe(SKILL_REF);
    expect(manifest['skillId']).toBe(SKILL_ID);
    expect(manifest['skillVersion']).toBe(SKILL_VERSION);
    expect(manifest['readingSchemaVersion']).toBe(SKILL_READING_SCHEMA_VERSION);
    expect(manifest['inputPackageVersion']).toBe(SKILL_INPUT_PACKAGE_VERSION);
    expect(manifest['bundleRef']).toBe(fixture.bundle.bundleRef);
    expect(manifest['bundleStructuralHash']).toBe(fixture.bundle.structuralHash);
    expect(manifest['contracts']).toEqual(fixture.bundle.contracts.map((source) => ({
      contractRef: contractBindingRef(source),
      confluencePageId: source.confluencePageId,
      confluencePageVersion: source.confluencePageVersion,
    })));
  });

  it('states the digest of every file, and its own hash over them', () => {
    const files = manifest['files'] as Record<string, string>;
    const actual: Record<string, string> = {};
    for (const file of listFiles(PACKAGE_DIR)) {
      const name = relative(PACKAGE_DIR, file);
      if (name === 'MANIFEST.json') continue;
      actual[name] = sha256Of(readFileSync(file));
    }
    expect(files).toEqual(actual);
    const { packageStructuralHash, ...core } = manifest;
    expect(packageStructuralHash).toBe(sha256Of(Buffer.from(canonicalJson(core))));
  });

  it('instructs the runtime under the same identities it is bound to', () => {
    const instructions = read(PACKAGE_DIR, 'SKILL.md');
    expect(instructions).toContain(SKILL_REF);
    expect(instructions).toContain(fixture.bundle.bundleRef);
    expect(instructions).toContain(SKILL_READING_SCHEMA_VERSION);
    expect(instructions).toContain(SKILL_INPUT_PACKAGE_VERSION);
    for (const wrapper of ['claude.md', 'chatgpt.md']) {
      const text = read(join(PACKAGE_DIR, 'wrappers'), wrapper);
      expect(text).toContain('SKILL.md');
      expect(text).toContain(SKILL_REF);
    }
  });

  it('is excluded from the container image and imported by nothing under src/', () => {
    expect(readFileSync(resolve(REPO_ROOT, '.dockerignore'), 'utf8').split('\n')).toContain('skill');
    for (const file of listFiles(resolve(REPO_ROOT, 'src'))) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/skill\/bazodiac-interpretation-skill-v1/u);
    }
  });
});

describe('ETBZ-52: the fixture run evidence is what the chain produces', () => {
  const manifest = readJson(FIXTURE_DIR, 'manifest.json');

  it('ships exactly the declared files', () => {
    expect(readdirSync(FIXTURE_DIR).sort()).toEqual([
      'accepted-reading.json', 'customer-reading.json', 'manifest.json', 'skill-input.json', 'skill-reading.json',
    ]);
    expect(existsSync(resolve(REPO_ROOT, 'docs/evidence/etbz-52/README.md'))).toBe(true);
  });

  it('regenerates the input package byte for byte from the fixture chain', () => {
    expect(read(FIXTURE_DIR, 'skill-input.json')).toBe(`${canonicalJson(fixture.inputPackage)}\n`);
  });

  it('accepts the committed reading and regenerates the accepted and customer files byte for byte', () => {
    const accepted = acceptSkillReading(readJson(FIXTURE_DIR, 'skill-reading.json'), { bundle: fixture.bundle, inputPackage: fixture.inputPackage });
    expect(read(FIXTURE_DIR, 'accepted-reading.json')).toBe(`${canonicalJson(accepted)}\n`);
    expect(read(FIXTURE_DIR, 'customer-reading.json')).toBe(`${canonicalJson(projectCustomerReading(accepted))}\n`);
    expect(manifest['acceptedReadingStructuralHash']).toBe(accepted.structuralHash);
  });

  it('states measured hashes that equal the artefacts, and the file digests', () => {
    expect(manifest['manifestVersion']).toBe('bazodiac-skill-fixture-run-manifest.v1');
    expect(manifest['skillRef']).toBe(SKILL_REF);
    expect(manifest['bundleRef']).toBe(fixture.bundle.bundleRef);
    expect(manifest['bundleStructuralHash']).toBe(fixture.bundle.structuralHash);
    expect(manifest['inputPackageStructuralHash']).toBe(fixture.inputPackage.structuralHash);
    expect(manifest['interpretationInputStructuralHash']).toBe(fixture.input.structuralHash);
    expect(manifest['claimGraphStructuralHash']).toBe(fixture.graph.structuralHash);
    expect(manifest['planStructuralHash']).toBe(fixture.plan.structuralHash);
    expect(manifest['skillPackageStructuralHash']).toBe(readJson(PACKAGE_DIR, 'MANIFEST.json')['packageStructuralHash']);
    expect(manifest['contracts']).toEqual(fixture.inputPackage.contracts);
    expect(manifest['warnings']).toEqual(['DAY_ANCHOR_UNVERIFIED']);
    const files = manifest['files'] as Record<string, string>;
    for (const name of ['skill-input.json', 'skill-reading.json', 'accepted-reading.json', 'customer-reading.json']) {
      expect(files[name], name).toBe(sha256Of(readFileSync(join(FIXTURE_DIR, name))));
    }
  });

  it('declares its generation record as a declaration: runtime, model, date, operator, head', () => {
    const generation = manifest['generation'] as Record<string, unknown>;
    expect(generation['declared']).toBe(true);
    for (const field of ['runtime', 'model', 'executedAt', 'operator', 'repositoryHead']) {
      expect(typeof generation[field], field).toBe('string');
      expect((generation[field] as string).length, field).toBeGreaterThan(0);
    }
    expect(generation['executedAt']).toMatch(/^\d{4}-\d{2}-\d{2}/u);
    expect(generation['repositoryHead']).toMatch(/^[0-9a-f]{40}$/u);
  });

  it('carries no real birth data and no raw producer body', () => {
    const text = read(FIXTURE_DIR, 'skill-input.json');
    expect(text).toContain('Musterkundin A');
    expect(text).not.toContain('baziRaw');
    expect(text).not.toMatch(/"latitude"|"longitude"/u);
  });
});
