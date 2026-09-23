// =============================================================================
// ETBZ-49 - the TypeScript contract IS the recovered assets.
//
// `src/application/visual` carries the canonical visual system as plain values
// so it can be consumed without a filesystem. That convenience is also a risk:
// a hand-edit to the generated module would silently fork the contract away
// from the assets whose hashes the provenance record names.
//
// This suite closes that gap in both directions:
//
//   1. every generated module is byte-identical to a fresh projection of the
//      committed assets (an empty diff, not a spot check);
//   2. every glyph's canonical digest and the manifest digest are RECOMPUTED
//      here in Node, not read back from the manifest that claims them;
//   3. every SVG asset on disk is rebuilt from the outline the contract carries
//      and must match byte for byte;
//   4. the palette and geometry match Confluence 66650114 version 2 verbatim.
//
// Tests may read the filesystem and use node:crypto; the application layer may
// not. That asymmetry is the whole reason this file exists.
// =============================================================================

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CANONICAL_COLOR_TOKENS,
  ATMOSPHERIC_COLOR_TOKENS,
  DISPLAY_GLYPH_MANIFEST,
  DISPLAY_GLYPH_SET,
  FONT_LICENSE_PROVENANCE,
  GEOMETRY_CENTIPOINTS,
  LONG_FORM_FIXTURE_RESULTS,
  PAGE_FAMILY,
  PAGINATION_RULES,
  VISUAL_SYSTEM_META,
  WORDMARK,
} from '../../src/application/visual/index.js';

const REPO_ROOT = process.cwd();
const ASSETS = resolve(REPO_ROOT, 'assets/visual-system-v1');
const GENERATED_MODULES = [
  'tokens.ts',
  'glyphs.ts',
  'wordmark.ts',
  'pagination.ts',
  'pageFamily.ts',
  'provenance.ts',
] as const;

const sha256 = (data: Buffer | string): string =>
  `sha256:${createHash('sha256').update(data).digest('hex')}`;

const readAsset = (relativePath: string): Buffer =>
  readFileSync(resolve(ASSETS, relativePath));

const readAssetJson = <T>(relativePath: string): T =>
  JSON.parse(readAsset(relativePath).toString('utf8')) as T;

// -----------------------------------------------------------------------------

describe('ETBZ-49 contract: the generated module is a projection of the assets', () => {
  it('regenerates byte-identically from the committed assets', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'etbz49-contract-'));
    try {
      execFileSync(
        process.execPath,
        ['scripts/etbz49-generate-visual-contract.mjs', '--out', scratch],
        { cwd: REPO_ROOT, stdio: 'pipe' },
      );

      const drifted: string[] = [];
      for (const moduleName of GENERATED_MODULES) {
        const committed = readFileSync(
          resolve(REPO_ROOT, 'src/application/visual', moduleName),
        );
        const regenerated = readFileSync(resolve(scratch, moduleName));
        if (!committed.equals(regenerated)) {
          drifted.push(
            `${moduleName}: committed ${sha256(committed)} vs regenerated ${sha256(regenerated)}`,
          );
        }
      }

      expect(
        drifted,
        `the committed contract no longer equals a projection of assets/visual-system-v1:\n${drifted.join('\n')}`,
      ).toEqual([]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it('detects drift when one generated module is altered (guard self-check)', () => {
    // Proves the comparison above is not vacuous: the same byte comparison
    // applied to a deliberately altered copy must report a difference.
    const original = readFileSync(resolve(REPO_ROOT, 'src/application/visual/tokens.ts'));
    const mutated = Buffer.from(
      original.toString('utf8').replace('#FBF9F4', '#FBF9F5'),
      'utf8',
    );

    expect(mutated.equals(original)).toBe(false);
    expect(sha256(mutated)).not.toBe(sha256(original));
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49 contract: twenty-seven glyph assets, each provable', () => {
  it('carries exactly twenty-seven glyphs: ten stems, twelve branches, five phases', () => {
    expect(DISPLAY_GLYPH_SET).toHaveLength(27);
    expect(DISPLAY_GLYPH_MANIFEST.glyphCount).toBe(27);

    const byRole = DISPLAY_GLYPH_SET.reduce<Record<string, number>>((tally, glyph) => {
      tally[glyph.role] = (tally[glyph.role] ?? 0) + 1;
      return tally;
    }, {});
    expect(byRole).toEqual({ heavenly_stem: 10, earthly_branch: 12, wu_xing: 5 });
  });

  it('has twenty-seven distinct Unicode identities, in the canonical order', () => {
    const codepoints = DISPLAY_GLYPH_SET.map((glyph) => glyph.codepoint);
    expect(new Set(codepoints).size).toBe(27);
    expect(DISPLAY_GLYPH_SET.map((glyph) => glyph.character).join('')).toBe(
      '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥木火土金水',
    );
    expect(DISPLAY_GLYPH_SET.map((glyph) => glyph.ordinal)).toEqual(
      Array.from({ length: 27 }, (_unused, index) => index),
    );
    for (const glyph of DISPLAY_GLYPH_SET) {
      expect(glyph.codepoint).toBe(
        `U+${(glyph.character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`,
      );
    }
  });

  it('RECOMPUTES every per-glyph digest rather than trusting the manifest', () => {
    // The digest covers identity + outline + the box and ink parameters they are
    // drawn against, so changing any one of them moves the hash.
    const mismatches: string[] = [];
    for (const glyph of DISPLAY_GLYPH_SET) {
      const canonical = JSON.stringify({
        assetFormatVersion: DISPLAY_GLYPH_MANIFEST.assetFormatVersion,
        character: glyph.character,
        codepoint: glyph.codepoint,
        inkPassUnits: DISPLAY_GLYPH_MANIFEST.inkPass.strokeUnits,
        path: glyph.path,
        viewBox: DISPLAY_GLYPH_MANIFEST.viewBox,
      });
      const recomputed = sha256(canonical);
      if (recomputed !== glyph.sha256) {
        mismatches.push(`${glyph.codepoint}: ${recomputed} != ${glyph.sha256}`);
      }
    }
    expect(mismatches, mismatches.join('\n')).toEqual([]);
  });

  it('RECOMPUTES the manifest digest from the twenty-seven glyph digests', () => {
    const recomputed = sha256(DISPLAY_GLYPH_SET.map((glyph) => glyph.sha256).join(''));
    expect(recomputed).toBe(DISPLAY_GLYPH_MANIFEST.manifestSha256);
  });

  it('moves the digest when one outline changes (guard self-check)', () => {
    const [first] = DISPLAY_GLYPH_SET;
    expect(first).toBeDefined();
    if (first === undefined) return;

    const tampered = JSON.stringify({
      assetFormatVersion: DISPLAY_GLYPH_MANIFEST.assetFormatVersion,
      character: first.character,
      codepoint: first.codepoint,
      inkPassUnits: DISPLAY_GLYPH_MANIFEST.inkPass.strokeUnits,
      path: `${first.path}L0 0Z`,
      viewBox: DISPLAY_GLYPH_MANIFEST.viewBox,
    });
    expect(sha256(tampered)).not.toBe(first.sha256);
  });

  it('rebuilds every SVG asset from the contract and matches the file byte for byte', () => {
    const [vx, vy, vw, vh] = DISPLAY_GLYPH_MANIFEST.viewBox;
    const ink = DISPLAY_GLYPH_MANIFEST.inkPass;
    const differing: string[] = [];

    for (const glyph of DISPLAY_GLYPH_SET) {
      const rebuilt =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" ` +
        `role="img" aria-label="${glyph.codepoint} ${glyph.unicodeName}">` +
        `<title>${glyph.character} ${glyph.codepoint} ${glyph.pinyin}</title>` +
        `<path d="${glyph.path}" fill="currentColor" stroke="currentColor" ` +
        `stroke-width="${ink.strokeUnits}" stroke-linejoin="${ink.linejoin}" ` +
        `stroke-linecap="${ink.linecap}" paint-order="${ink.paintOrder}"/></svg>`;

      const onDisk = readAsset(`glyphs/${glyph.asset}`).toString('utf8');
      if (onDisk !== rebuilt) {
        differing.push(`${glyph.asset}: ${sha256(onDisk)} != ${sha256(rebuilt)}`);
      }
    }

    expect(
      differing,
      `an SVG asset no longer equals the outline the contract carries:\n${differing.join('\n')}`,
    ).toEqual([]);
  });

  it('ships exactly the twenty-seven assets it declares, plus sprite, manifest and licence', () => {
    const files = readdirSync(resolve(ASSETS, 'glyphs')).sort();
    const declared = DISPLAY_GLYPH_SET.map((glyph) => glyph.asset).sort();

    expect(files.filter((file) => /^u[0-9a-f]{4}-/.test(file))).toEqual(declared);
    expect(files).toContain('manifest.json');
    expect(files).toContain('OFL.txt');
    expect(files).toContain('sprite.svg');
  });

  it('keeps the shipped manifest and the contract in agreement', () => {
    const manifest = readAssetJson<{
      glyphs: { codepoint: string; sha256: string }[];
      manifestSha256: string;
      glyphCount: number;
    }>('glyphs/manifest.json');

    expect(manifest.glyphCount).toBe(DISPLAY_GLYPH_SET.length);
    expect(manifest.manifestSha256).toBe(DISPLAY_GLYPH_MANIFEST.manifestSha256);
    expect(manifest.glyphs.map((glyph) => `${glyph.codepoint} ${glyph.sha256}`)).toEqual(
      DISPLAY_GLYPH_SET.map((glyph) => `${glyph.codepoint} ${glyph.sha256}`),
    );
  });

  it('records the licensed vector source and the open human decision', () => {
    expect(DISPLAY_GLYPH_MANIFEST.source.family).toBe('Noto Sans CJK SC');
    expect(DISPLAY_GLYPH_MANIFEST.source.postscriptName).toBe('NotoSansCJKsc-Black');
    expect(DISPLAY_GLYPH_MANIFEST.source.weight).toBe(900);
    expect(DISPLAY_GLYPH_MANIFEST.source.licence).toBe('SIL Open Font License 1.1');
    expect(DISPLAY_GLYPH_MANIFEST.visualTarget.status).toBe(
      'HUMAN_PO_GLYPH_STYLE_APPROVAL_REQUIRED',
    );

    const licence = readAsset('glyphs/OFL.txt').toString('utf8');
    expect(licence).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49 contract: the wordmark is static and chart-independent', () => {
  it('matches the SVG asset it names', () => {
    expect(sha256(readAsset('brand/wordmark.svg'))).toBe(WORDMARK.sha256);
  });

  it('is outlines, not text, and exposes no glyph slot', () => {
    const svg = readAsset('brand/wordmark.svg').toString('utf8');
    expect(svg).not.toMatch(/<text\b/);
    expect(svg).not.toMatch(/font-family/);
    expect(WORDMARK.contract).toEqual({
      static: true,
      chartIndependent: true,
      customerGlyphForbidden: true,
    });
  });

  it('was cut from the vendored Inter SemiBold binary', () => {
    expect(WORDMARK.source['file']).toBe('Inter-SemiBold.ttf');
    expect(WORDMARK.source['fileSha256']).toBe(sha256(readAsset('fonts/Inter-SemiBold.ttf')));
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49 contract: font provenance is byte-exact upstream', () => {
  const UPSTREAM_INTER_V41 = {
    'Inter-Regular.ttf':
      'sha256:40d692fce188e4471e2b3cba937be967878f631ad3ebbbdcd587687c7ebe0c82',
    'Inter-Medium.ttf':
      'sha256:97ad806f526e41546d46365bb3a393145f75b7b1568913db74549ad8b8dba872',
    'Inter-SemiBold.ttf':
      'sha256:78a843fade9d4612a5567302fb595b56976eb5fcebf4fea5a5912d638bafcde3',
    'InterDisplay-Light.ttf':
      'sha256:1d6072bc7807fa7bf08a6d273368f04ac68e77438258f32975057a61c8772811',
    'InterDisplay-Regular.ttf':
      'sha256:99614bda7ff423aaf470990692dd93613a5971ab4446e4a6d5a83b3d74865074',
  } as const;

  it.each(Object.entries(UPSTREAM_INTER_V41))(
    '%s is byte-identical to rsms/inter v4.1 extras/ttf/',
    (file, expected) => {
      expect(sha256(readAsset(`fonts/${file}`))).toBe(expected);
    },
  );

  it('ships the upstream OFL text, not a substituted one', () => {
    expect(sha256(readAsset('fonts/OFL.txt'))).toBe(FONT_LICENSE_PROVENANCE.licenceSha256);
    const licence = readAsset('fonts/OFL.txt').toString('utf8');
    expect(licence).toContain('The Inter Project Authors');
    expect(licence).toContain('SIL OPEN FONT LICENSE Version 1.1');
  });

  it('records VERIFIED provenance with a resolvable upstream coordinate', () => {
    expect(FONT_LICENSE_PROVENANCE.status).toBe('VERIFIED');
    expect(FONT_LICENSE_PROVENANCE.release).toBe('v4.1');
    expect(FONT_LICENSE_PROVENANCE.upstreamRepository).toBe('https://github.com/rsms/inter');
    expect(FONT_LICENSE_PROVENANCE.versionString).toBe('Version 4.001;git-9221beed3');
  });

  it('ships only the five declared binaries', () => {
    const files = readdirSync(resolve(ASSETS, 'fonts')).sort();
    expect(files).toEqual([...Object.keys(UPSTREAM_INTER_V41), 'OFL.txt'].sort());
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49 contract: palette and geometry are Confluence 66650114 v2 verbatim', () => {
  /** Section 2 of the page, transcribed. Nineteen entries, no more and no fewer. */
  const CONFLUENCE_PALETTE: Readonly<Record<string, string>> = {
    'paper-000': '#FBF9F4',
    'paper-100': '#F4F1EA',
    'paper-200': '#EBE7DD',
    'ink-900': '#16181A',
    'ink-600': '#4A4F52',
    'ink-400': '#6F7477',
    'rule-200': '#DCD7CB',
    'gold-500': '#B2913F',
    'gold-700': '#7D6425',
    'phase-wood-field': '#E7ECE3',
    'phase-wood-mark': '#5F7D55',
    'phase-fire-field': '#F6E9E6',
    'phase-fire-mark': '#A8574A',
    'phase-earth-field': '#F4ECDD',
    'phase-earth-mark': '#96702A',
    'phase-metal-field': '#EDEDEC',
    'phase-metal-mark': '#6B7376',
    'phase-water-field': '#E8EDF1',
    'phase-water-mark': '#45637A',
  };

  it('carries exactly nineteen canonical colour tokens', () => {
    expect(CANONICAL_COLOR_TOKENS).toHaveLength(19);
    expect(Object.keys(CONFLUENCE_PALETTE)).toHaveLength(19);
  });

  it('matches every Confluence hex value, light theme', () => {
    const actual = Object.fromEntries(
      CANONICAL_COLOR_TOKENS.map((token) => [token.name, token.value.light]),
    );
    expect(actual).toEqual(CONFLUENCE_PALETTE);
  });

  it('keeps the five decorative tokens out of the canonical set', () => {
    expect(ATMOSPHERIC_COLOR_TOKENS).toHaveLength(5);
    for (const token of ATMOSPHERIC_COLOR_TOKENS) {
      expect(token.name.startsWith('atmos-')).toBe(true);
      expect(Object.keys(CONFLUENCE_PALETTE)).not.toContain(token.name);
      expect(token.usage).toMatch(/decorative/i);
    }
  });

  it('gives every canonical token a light and a dark value', () => {
    for (const token of CANONICAL_COLOR_TOKENS) {
      expect(token.value.light).toMatch(/^#[0-9A-F]{6}$/);
      expect(token.value.dark).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('compiles the authoring geometry into the canonical integer centipoints', () => {
    // Section 1 of the page: A4, 22/20/20 mm, 170x255 mm content, 5 mm baseline,
    // 10.5/14.17 pt body, 9 pt floor. 1 mm = 7200/25.4 cp; 1 pt = 100 cp.
    expect(GEOMETRY_CENTIPOINTS).toEqual({
      pageW: 59528,
      pageH: 84189,
      marginTop: 6236,
      marginSide: 5669,
      marginBottom: 5669,
      contentW: 48189,
      contentH: 72283,
      baseline: 1417,
      gutter: 1701,
      bodySizeCp: 1050,
      bodyLeadingCp: 1417,
      textFloorCp: 900,
      linesPerPage: 51,
    });
  });

  it('keeps the centipoint geometry internally consistent', () => {
    // Every value is rounded from its own mm authoring value independently, so
    // the box and the margins can disagree by at most one centipoint. Asserting
    // exact subtraction would be asserting a derivation the build does not use:
    // 170 mm is 48188.98 cp, while 210 mm less two 20 mm margins rounds to 48190.
    const mmToCp = (mm: number): number => Math.round((mm * 7200) / 25.4);
    expect(GEOMETRY_CENTIPOINTS.pageW).toBe(mmToCp(210));
    expect(GEOMETRY_CENTIPOINTS.pageH).toBe(mmToCp(297));
    expect(GEOMETRY_CENTIPOINTS.marginTop).toBe(mmToCp(22));
    expect(GEOMETRY_CENTIPOINTS.marginSide).toBe(mmToCp(20));
    expect(GEOMETRY_CENTIPOINTS.marginBottom).toBe(mmToCp(20));
    expect(GEOMETRY_CENTIPOINTS.contentW).toBe(mmToCp(170));
    expect(GEOMETRY_CENTIPOINTS.contentH).toBe(mmToCp(255));
    expect(GEOMETRY_CENTIPOINTS.gutter).toBe(mmToCp(6));

    const widthResidual =
      GEOMETRY_CENTIPOINTS.pageW - 2 * GEOMETRY_CENTIPOINTS.marginSide -
      GEOMETRY_CENTIPOINTS.contentW;
    const heightResidual =
      GEOMETRY_CENTIPOINTS.pageH -
      GEOMETRY_CENTIPOINTS.marginTop -
      GEOMETRY_CENTIPOINTS.marginBottom -
      GEOMETRY_CENTIPOINTS.contentH;
    expect(Math.abs(widthResidual)).toBeLessThanOrEqual(1);
    expect(Math.abs(heightResidual)).toBeLessThanOrEqual(1);

    // The baseline grid IS the body leading; the two drifting apart would break
    // every page that sets type on the grid.
    expect(GEOMETRY_CENTIPOINTS.baseline).toBe(GEOMETRY_CENTIPOINTS.bodyLeadingCp);
    expect(GEOMETRY_CENTIPOINTS.baseline).toBe(mmToCp(5));
    expect(
      Math.floor(GEOMETRY_CENTIPOINTS.contentH / GEOMETRY_CENTIPOINTS.baseline),
    ).toBe(GEOMETRY_CENTIPOINTS.linesPerPage);
  });

  it('locks the text scale and the nine-point floor', () => {
    expect(VISUAL_SYSTEM_META.scaleLock).toBe(1);
    expect(VISUAL_SYSTEM_META.textFloorPt).toBe(9);
    expect(GEOMETRY_CENTIPOINTS.textFloorCp).toBe(VISUAL_SYSTEM_META.textFloorPt * 100);
    expect(VISUAL_SYSTEM_META.regionPolicy).toBe('CN_SIMPLIFIED');
  });

  it('places no customer type below the nine-point floor', () => {
    const tooSmall = [];
    for (const style of [
      ...new Set(
        readAssetJson<{
          type: { groups: { styles: { name: string; fontSize: string }[] }[] };
        }>('tokens.json').type.groups.flatMap((group) => group.styles),
      ),
    ]) {
      if (Number.parseFloat(style.fontSize) < VISUAL_SYSTEM_META.textFloorPt) {
        tooSmall.push(`${style.name} ${style.fontSize}`);
      }
    }
    expect(tooSmall, `below the ${VISUAL_SYSTEM_META.textFloorPt} pt floor`).toEqual([]);
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49 contract: the page family and its structural hashes', () => {
  it('declares eighteen designed customer pages with distinct ids and hashes', () => {
    expect(PAGE_FAMILY).toHaveLength(18);
    expect(new Set(PAGE_FAMILY.map((page) => page.id)).size).toBe(18);
    expect(new Set(PAGE_FAMILY.map((page) => page.structuralSha256)).size).toBe(18);
    for (const page of PAGE_FAMILY) {
      expect(page.structuralSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('ships a structure file for every page in the family', () => {
    // Structure files are keyed by the page NUMBER (`08-wu-xing.json`), not by
    // the page id (`wu-xing-distribution`), so the page number is the join key.
    const structures = readdirSync(resolve(ASSETS, 'structures')).filter((file) =>
      file.endsWith('.json'),
    );
    const missing = PAGE_FAMILY.filter(
      (page) =>
        !structures.some((file) => file.startsWith(`${String(page.page).padStart(2, '0')}-`)),
    ).map((page) => `${page.page} ${page.id}`);

    expect(missing, `no structures/NN-*.json for:\n${missing.join('\n')}`).toEqual([]);
  });

  it('binds every slot to declared fact kinds and to nothing else', () => {
    for (const page of PAGE_FAMILY) {
      expect(page.bindings.length).toBeGreaterThan(0);
      for (const binding of page.bindings) {
        expect(binding.slotId).toMatch(/^[a-zA-Z]+\.[a-zA-Z[\]*]+$/);
        // `derives` exists only where it is empty: the design side computes nothing.
        if (binding.derives !== undefined) expect(binding.derives).toEqual([]);
      }
    }
  });

  it('registers exactly one presentation transform, on the Wu Xing slot', () => {
    const withTransform = PAGE_FAMILY.flatMap((page) => page.bindings).filter(
      (binding) =>
        binding.presentationTransform !== undefined && binding.presentationTransform !== null,
    );
    expect(withTransform.map((binding) => binding.slotId)).toEqual(['wuXing.vector']);
    expect(withTransform[0]?.presentationTransform).toBe('pt.linear-max-v1');
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49 contract: the recovered long-form evidence', () => {
  it('carries the customer stress fixture: 749 words, 3 pages, 89 lines, no findings', () => {
    const customer = LONG_FORM_FIXTURE_RESULTS.find((fixture) => fixture.surface === 'customer');
    expect(customer).toBeDefined();
    if (customer === undefined) return;

    expect(customer.wordCount).toBe(749);
    expect(customer.pages).toBe(3);
    expect(customer.lines).toBe(89);
    expect(customer.findings).toEqual([]);
    expect(customer.pageLineCounts).toEqual([48, 38, 3]);
    expect(customer.pageLineCounts.reduce((a, b) => a + b, 0)).toBe(customer.lines);
    expect(customer.pageTemplates).toEqual(['opener', 'continuation', 'continuation']);
  });

  it('carries the V6 continuity fixture: 679 words, 2 pages, 79 lines, no findings', () => {
    const developer = LONG_FORM_FIXTURE_RESULTS.find(
      (fixture) => fixture.surface === 'developer',
    );
    expect(developer).toBeDefined();
    if (developer === undefined) return;

    expect(developer.wordCount).toBe(679);
    expect(developer.pages).toBe(2);
    expect(developer.lines).toBe(79);
    expect(developer.findings).toEqual([]);
    expect(developer.pageLineCounts).toEqual([49, 30]);
  });

  it('states the negative pagination rules as refusals, not preferences', () => {
    expect(PAGINATION_RULES.shrinkToFit).toBe(false);
    expect(PAGINATION_RULES.clipping).toBe(false);
    expect(PAGINATION_RULES.semanticShortening).toBe(false);
    expect(PAGINATION_RULES.orphanMinLines).toBe(2);
    expect(PAGINATION_RULES.widowMinLines).toBe(2);
    expect(PAGINATION_RULES.atomic).toEqual(['pullQuote', 'keyInsight']);
  });

  it('agrees with the pagination report it was projected from', () => {
    const report = readAssetJson<{
      fixtures: { fixtureId: string; wordCount: number; pages: number; lines: number }[];
    }>('longform/pagination-report.json');

    expect(report.fixtures.map((fixture) => fixture.fixtureId)).toEqual(
      LONG_FORM_FIXTURE_RESULTS.map((fixture) => fixture.fixtureId),
    );
    for (const [index, fixture] of report.fixtures.entries()) {
      const projected = LONG_FORM_FIXTURE_RESULTS[index];
      expect(projected).toBeDefined();
      expect(projected?.wordCount).toBe(fixture.wordCount);
      expect(projected?.pages).toBe(fixture.pages);
      expect(projected?.lines).toBe(fixture.lines);
    }
  });
});

// -----------------------------------------------------------------------------

describe('ETBZ-49 contract: the recovered artefact set is complete', () => {
  const REQUIRED_ASSETS = [
    'design-system.json',
    'tokens.json',
    'tokens.css',
    'FINAL_DESIGN_PROVENANCE.md',
    'source-manifest.json',
    'render-receipt.json',
    'determinism-report.json',
    'glyphs/manifest.json',
    'glyphs/OFL.txt',
    'glyphs/sprite.svg',
    'brand/wordmark.svg',
    'brand/wordmark.manifest.json',
    'fixtures/chart-fixture.json',
    'longform/pagination-report.json',
    'longform/fixture-customer-chapter.json',
    'longform/fixture-v6-677.json',
    'fonts/OFL.txt',
  ] as const;

  it.each(REQUIRED_ASSETS)('ships %s', (relativePath) => {
    expect(statSync(resolve(ASSETS, relativePath)).size).toBeGreaterThan(0);
  });

  it('ships a structure file for all thirty-six rendered pages', () => {
    const structures = readdirSync(resolve(ASSETS, 'structures')).filter((file) =>
      file.endsWith('.json'),
    );
    expect(structures.length).toBe(36);
  });

  it('preserves every recovered artefact byte for byte, in both directions', () => {
    // The integrity index is what makes "byte-preserved" checkable rather than
    // asserted. Both directions matter: hashing only the listed files would
    // miss an artefact somebody ADDED, and listing only would miss one edited.
    const index = readAssetJson<{
      fileCount: number;
      files: { path: string; bytes: number; sha256: string }[];
    }>('ASSET-INTEGRITY.json');

    const listFiles = (root: string, prefix = ''): string[] =>
      readdirSync(resolve(ASSETS, root), { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? listFiles(join(root, entry.name), `${prefix}${entry.name}/`)
          : [`${prefix}${entry.name}`],
      );

    const onDisk = listFiles('.')
      .filter((file) => file !== 'ASSET-INTEGRITY.json')
      .sort();
    expect(index.files.map((file) => file.path).sort()).toEqual(onDisk);
    expect(index.fileCount).toBe(index.files.length);

    const altered: string[] = [];
    for (const file of index.files) {
      const bytes = readAsset(file.path);
      if (bytes.length !== file.bytes) {
        altered.push(`${file.path}: ${bytes.length} bytes, indexed ${file.bytes}`);
        continue;
      }
      const actual = sha256(bytes);
      if (actual !== file.sha256) altered.push(`${file.path}: ${actual} != ${file.sha256}`);
    }
    expect(altered, `recovered artefacts no longer match the index:\n${altered.join('\n')}`).toEqual(
      [],
    );
  });

  it('pins the render receipt, the file the secret scanner has one reviewed line in', () => {
    // `.gitleaksignore` exempts line 373 of this file, a content hash the
    // upstream generic-api-key rule reads as credential-shaped. That exemption
    // is only safe while the file's bytes are pinned, so the pin is asserted
    // here explicitly rather than only inside the loop above.
    const index = readAssetJson<{ files: { path: string; sha256: string }[] }>(
      'ASSET-INTEGRITY.json',
    );
    const receipt = index.files.find((file) => file.path === 'render-receipt.json');
    expect(receipt, 'render-receipt.json must be in the integrity index').toBeDefined();
    expect(sha256(readAsset('render-receipt.json'))).toBe(receipt?.sha256);

    const ignore = readFileSync(resolve(REPO_ROOT, '.gitleaksignore'), 'utf8');
    expect(ignore).toContain('assets/visual-system-v1/render-receipt.json:generic-api-key:373');
    const line373 = readAsset('render-receipt.json').toString('utf8').split('\n')[372];
    expect(line373, 'the exempted line must still be the tokens.json content hash').toContain(
      '"tokens.json"',
    );
  });

  it('records the per-page render receipt: twenty-nine pages, zero DOM findings', () => {
    const receipt = readAssetJson<{
      pages: { pageId: string; domFindings: number; structuralSha256: string }[];
    }>('render-receipt.json');

    expect(receipt.pages).toHaveLength(29);
    expect(receipt.pages.filter((page) => page.domFindings !== 0)).toEqual([]);
    for (const page of PAGE_FAMILY) {
      const rendered = receipt.pages.find(
        (candidate) => candidate.structuralSha256 === `sha256:${page.structuralSha256}`,
      );
      expect(rendered, `no rendered page carries the structural hash of ${page.id}`).toBeDefined();
    }
  });

  it('records the determinism proof: twenty-nine pages, identical across two builds', () => {
    const determinism = readAssetJson<{
      pages: number;
      structuralSha256Identical: number;
      pngSha256Identical: number;
      domFindingsTotal: number;
    }>('determinism-report.json');

    expect(determinism.pages).toBe(29);
    expect(determinism.structuralSha256Identical).toBe(29);
    expect(determinism.pngSha256Identical).toBe(29);
    expect(determinism.domFindingsTotal).toBe(0);
  });
});
