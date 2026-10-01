/**
 * ETBZ-57 — the voice-revision package and its fixture evidence are regenerable.
 *
 * Everything committed under skill/bazodiac-interpretation-skill-v1.1/ and
 * docs/evidence/etbz-57/ that a machine produced is re-derived here and must
 * be byte-identical - except the package MANIFEST.json, which is checked field
 * by field - and every hash a manifest states is recomputed. What a
 * machine cannot produce - the instructions, the wrappers, the two readings,
 * the declared generation record - is checked for presence and consistency.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { canonicalJson } from '../../src/domain/canonical-json.js';
import {
  CANDIDATE_BUNDLE_HASHES,
  RELEASED_BUNDLE_HASHES,
  SKILL_ID,
  SKILL_INPUT_PACKAGE_VERSION,
  SKILL_READING_SCHEMA_VERSION,
  SKILL_REF_V1_1,
  SKILL_VERSION_V1_1,
  buildSkillContractBundle,
  contractBindingRef,
  renderPortableSkillContractBundle,
  skillReadingJsonSchema,
} from '../../src/application/skill/index.js';
import { ETBZ57_FIXTURE_DIR, deriveEtbz57Evidence, renderJson } from '../support/etbz57Evidence.js';
import { skillFixture, skillFixtureV1_1 } from '../support/skillFixture.js';

// Every test here accepts a 4,400-word reading through every voice gate; under a loaded
// machine that takes seconds, and a default 5 s timeout would read as a failure of the gate.
vi.setConfig({ testTimeout: 60_000 });

const REPO_ROOT = process.cwd();
const PACKAGE_DIR = resolve(REPO_ROOT, 'skill/bazodiac-interpretation-skill-v1.1');
const PACKAGE_DIR_V1 = resolve(REPO_ROOT, 'skill/bazodiac-interpretation-skill-v1');
const FIXTURE_DIR = resolve(REPO_ROOT, ETBZ57_FIXTURE_DIR);
const EVIDENCE_DIR = resolve(REPO_ROOT, 'docs/evidence/etbz-57');

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

const fixture = skillFixtureV1_1();
const evidence = deriveEtbz57Evidence();

describe('ETBZ-57: bundle 1.1.0 is a frozen candidate beside the unchanged 1.0.0', () => {
  it('leaves bundle 1.0.0 byte-identical to its released hash', () => {
    expect(buildSkillContractBundle().structuralHash).toBe(RELEASED_BUNDLE_HASHES['1.0.0']);
  });

  it('freezes 1.1.0 as a candidate and never as released', () => {
    expect(fixture.bundle.structuralHash).toBe(CANDIDATE_BUNDLE_HASHES['1.1.0']);
    expect(Object.keys(CANDIDATE_BUNDLE_HASHES).filter((version) => Object.hasOwn(RELEASED_BUNDLE_HASHES, version))).toEqual([]);
    expect(fixture.bundle.contracts.filter((source) => source.status === 'CANDIDATE').map((source) => source.key)).toEqual([
      'INTERPRETATION_LENS', 'TERMINOLOGY_LEXICON', 'ANTI_BOILERPLATE',
    ]);
  });

  it('keeps the claim graph and the plan content of the fixture, re-binding only the Lexicon and Lens identities', () => {
    const released = skillFixture();
    expect(fixture.graph.structuralHash).toBe(released.graph.structuralHash);
    const strip = (plan: Record<string, unknown>): string => {
      const rest: Record<string, unknown> = { ...plan };
      for (const key of ['structuralHash', 'terminologyLexicon', 'interpretationLens']) delete rest[key];
      return canonicalJson(rest);
    };
    expect(strip(fixture.plan as unknown as Record<string, unknown>)).toBe(strip(released.plan as unknown as Record<string, unknown>));
    expect(fixture.plan.terminologyLexicon.contractRef).toBe('terminology-wording-lexicon@1.1.0');
    expect(fixture.plan.interpretationLens.contractRef).toBe('grounded-reflective-synthesis-lens@1.1.0');
  });
});

describe('ETBZ-57: the Skill 1.1 package is what a fresh generation produces', () => {
  const manifest = readJson(PACKAGE_DIR, 'MANIFEST.json');

  it('ships exactly the declared files', () => {
    expect(listFiles(PACKAGE_DIR).map((file) => relative(PACKAGE_DIR, file)).sort()).toEqual([
      'MANIFEST.json', 'README.md', 'SKILL.md', 'contract-bundle.json', 'reading-schema.json',
      'wrappers/chatgpt.md', 'wrappers/claude.md',
    ]);
  });

  it('carries the portable 1.1.0 bundle and the unchanged reading schema', () => {
    expect(read(PACKAGE_DIR, 'contract-bundle.json')).toBe(`${renderPortableSkillContractBundle(fixture.bundle)}\n`);
    expect(read(PACKAGE_DIR, 'reading-schema.json')).toBe(`${canonicalJson(skillReadingJsonSchema())}\n`);
    expect(read(PACKAGE_DIR, 'reading-schema.json')).toBe(read(PACKAGE_DIR_V1, 'reading-schema.json'));
  });

  it('states identities, bundle hash and contract set that equal the repository', () => {
    expect(manifest['skillRef']).toBe(SKILL_REF_V1_1);
    expect(manifest['skillId']).toBe(SKILL_ID);
    expect(manifest['skillVersion']).toBe(SKILL_VERSION_V1_1);
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
      if (name !== 'MANIFEST.json') actual[name] = sha256Of(readFileSync(file));
    }
    expect(files).toEqual(actual);
    const { packageStructuralHash, ...core } = manifest;
    expect(packageStructuralHash).toBe(sha256Of(Buffer.from(canonicalJson(core))));
  });

  it('instructs the runtime under the identities it is bound to, in both modes', () => {
    const instructions = read(PACKAGE_DIR, 'SKILL.md');
    for (const marker of [SKILL_REF_V1_1, fixture.bundle.bundleRef, SKILL_READING_SCHEMA_VERSION, SKILL_INPUT_PACKAGE_VERSION, 'REALISE', 'EDIT', 'acceptEditorialRevision']) {
      expect(instructions).toContain(marker);
    }
    for (const wrapper of ['claude.md', 'chatgpt.md']) {
      const text = read(join(PACKAGE_DIR, 'wrappers'), wrapper);
      expect(text).toContain('SKILL.md');
      expect(text).toContain(SKILL_REF_V1_1);
      expect(text).toContain('acceptEditorialRevision');
    }
  });

  it('quotes no retired voice formula as an instruction to follow', () => {
    const instructions = read(PACKAGE_DIR, 'SKILL.md');
    expect(instructions).not.toMatch(/State what the source says/u);
    expect(instructions).not.toMatch(/the chart comes from a validated calculation/u);
    expect(instructions).not.toMatch(/Interpretation uses bounded formulations/u);
  });
});

describe('ETBZ-57: the fixture run evidence is what the chain produces', () => {
  it('ships exactly the declared files', () => {
    expect(readdirSync(FIXTURE_DIR).sort()).toEqual([
      'accepted-reading.json', 'customer-reading.json', 'manifest.json', 'semantic-reading.json', 'skill-input.json', 'skill-reading.json',
    ]);
  });

  it('regenerates the 1.1.0 input package byte for byte from the fixture chain', () => {
    expect(read(FIXTURE_DIR, 'skill-input.json')).toBe(`${canonicalJson(fixture.inputPackage)}\n`);
  });

  it('accepts REALISE, accepts EDIT as a text-only revision of it, and regenerates the accepted and customer files', () => {
    expect(read(FIXTURE_DIR, 'accepted-reading.json')).toBe(renderJson(evidence.accepted));
    expect(read(FIXTURE_DIR, 'customer-reading.json')).toBe(renderJson(evidence.customer));
  });

  it('regenerates the manifest byte for byte and declares its generation record as a declaration', () => {
    expect(read(FIXTURE_DIR, 'manifest.json')).toBe(renderJson(evidence.manifest));
    const generation = (evidence.manifest as { generation: Record<string, unknown> }).generation;
    expect(generation['declared']).toBe(true);
    expect(generation['repositoryHead']).toMatch(/^[0-9a-f]{40}$/u);
    expect(read(FIXTURE_DIR, 'skill-input.json')).toContain('Musterkundin A');
    expect(read(FIXTURE_DIR, 'skill-input.json')).not.toMatch(/"latitude"|"longitude"|baziRaw/u);
  });

  it('regenerates evals.json byte for byte', () => {
    expect(read(EVIDENCE_DIR, 'evals.json')).toBe(renderJson(evidence.evals));
  });
});

describe('ETBZ-57: what the evals show (AC 5, 6, 7, 11, 12, 13)', () => {
  const evals = evidence.evals as Record<string, Record<string, unknown>>;
  const a = evals['A_fixtureOldVsNew'] as { semanticBindingsEqual: boolean; oldTotals: Record<string, number>; newTotals: Record<string, number> };

  it('A: the same facts, claims, postures and plan bindings, with no meta-narration, template hedge or unlicensed alternative left', () => {
    expect(a.semanticBindingsEqual).toBe(true);
    expect(a.oldTotals['metaSurfaces']).toBeGreaterThan(0);
    expect(a.oldTotals['supportedParagraphsWithTemplateHedge']).toBeGreaterThan(0);
    expect(a.newTotals['meta']).toBe(0);
    expect(a.newTotals['templateHedges']).toBe(0);
    expect(a.newTotals['alternatives']).toBe(0);
    expect(a.newTotals['softeners']).toBe(0);
    expect(a.newTotals['lifeDomain']).toBe(0);
    expect(a.newTotals['supportedParagraphs']).toBe(a.oldTotals['supportedParagraphs']);
  });

  it('B: tentative material stays visibly tentative', () => {
    expect(evals['B_tentative']).toMatchObject({
      asCertain: 'READING_PROVISIONALITY_LAUNDERED',
      tentativeWithoutMarker: 'READING_TENTATIVE_NOT_VISIBLE',
      tentativeWithMarker: 'ACCEPTED',
    });
  });

  it('D: a manufactured tension is refused, and the chapter without a contrast carries no tension word', () => {
    expect(evals['D_noTension']).toMatchObject({ result: 'READING_TENSION_UNGROUNDED', chapterWithoutContrastTensionWords: [] });
  });

  it('E/F: the graph is shared across versions, the swap fails against the foil, and refusals stay inside the dependency cone', () => {
    expect(evals['E_nearNeighbourSwap']).toMatchObject({ graphIdenticalAcrossVersions: true, swap: { validatesAgainstFoil: false } });
    const f = evals['F_factMutationAndRemoval'] as Record<string, Record<string, { cone: string[]; refused: string[]; refusedOutsideCone: string[] }>>;
    for (const version of ['old', 'new']) {
      for (const probe of ['mutation', 'removal']) {
        const result = f[version]?.[probe];
        expect(result?.refusedOutsideCone, `${version} ${probe}`).toEqual([]);
        expect(result?.refused.length, `${version} ${probe}`).toBeGreaterThan(0);
      }
    }
  });
});
