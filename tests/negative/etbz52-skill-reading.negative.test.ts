/**
 * ETBZ-52 — the refusals of the Skill run boundary.
 *
 * Pattern: the accepted fixture reading is the green baseline (N0); each test
 * changes as little of it as the refusal needs, on a deep copy. A refusal that
 * belongs to the bundle's drift gate surfaces as `SkillContractError`; every
 * refusal a reading or a package can see is a `SkillRunError` with its code.
 * Nothing partial is ever returned.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { structuralHash } from '../../src/domain/structural-hash.js';
import type { ChartFact } from '../../src/application/interpretation/feature-set.js';
import {
  SkillContractError,
  SkillRunError,
  acceptSkillReading,
  buildSkillInputPackage,
  projectCustomerReading,
} from '../../src/application/skill/index.js';
import type { SkillInputPackage, SkillRunErrorCode } from '../../src/application/skill/index.js';
import { skillFixture } from '../support/skillFixture.js';

type Json = Record<string, unknown>;
type Paragraph = { kind: string; posture: string; text: string; factRefs: string[]; claimRefs: string[] };
type Chapter = { chapterRef: string; narrativeOperation: string; title: string; paragraphs: Paragraph[]; semanticDelta: { kind: string; claimRefs: string[] }[]; callbacks: { claimRef: string; deltaKind: string }[] };
type Reading = Json & { chapters: Chapter[]; reflectionQuestions: { text: string; claimRefs: string[] }[]; methodNote: { text: string; warningCodes: string[] }; visualizationSpecs: { specId: string; slotId: string; factRefs: string[]; claimRefs: string[] }[]; contracts: { contractRef: string; confluencePageId: string; confluencePageVersion: string }[] };

const fixture = skillFixture();
const { bundle, inputPackage } = fixture;
const baseline = JSON.parse(readFileSync(resolve(process.cwd(), 'docs/evidence/etbz-52/fixture/skill-reading.json'), 'utf8')) as Reading;

const C = {
  resource: 'claim.sha256:6a0302237348420bddc4bd7edf6247d965599e1588060419460858b26cbaf84b',
  pressure: 'claim.sha256:7ae35cd136bc6b2046f2146b984062b514ce22522886a7eed62568792ad388ff',
  dominant: 'claim.sha256:a1dbb87ff5e598f3d6a6bffbb20b3686b741ac29ed39b29bc372b8484e8501d1',
  relation: 'claim.sha256:b0b9ad02ab1bf0534bf03e312a8435221ab6ebdda9a1edc6ac6d40c3c5ac7b1a',
  dayMaster: 'claim.sha256:dfaed59cf78e966e9a7fa3840b7f86df2d9425b9dba64d7db48dd21ee6d7ad57',
  recurrence: 'claim.sha256:fcbe1320f16008b6ec8dd8139bd287bb9888f409e7aed467210c7df5a6131375',
} as const;

function readingWith(edit: (reading: Reading) => void): Reading {
  const copy = structuredClone(baseline);
  edit(copy);
  return copy;
}

/** A package with one edit and a recomputed hash, plus the reading re-bound to it. */
function packageWith(edit: (core: Record<string, unknown>) => void): { inputPackage: SkillInputPackage; reading: Reading } {
  const { structuralHash: _published, ...core } = inputPackage;
  const mutable = structuredClone(core) as Record<string, unknown>;
  edit(mutable);
  const rebound = { ...mutable, structuralHash: structuralHash(mutable) } as unknown as SkillInputPackage;
  const reading = readingWith((draft) => {
    draft['inputPackageStructuralHash'] = rebound.structuralHash;
    draft['claimGraphStructuralHash'] = rebound.claimGraph.structuralHash;
    draft['planStructuralHash'] = rebound.plan.structuralHash;
  });
  expect(_published).toMatch(/^sha256:/u);
  return { inputPackage: rebound, reading };
}

function refusal(action: () => unknown): SkillRunError {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught, 'expected a SkillRunError to be thrown').toBeInstanceOf(SkillRunError);
  return caught as SkillRunError;
}

function expectRefusal(action: () => unknown, code: SkillRunErrorCode): SkillRunError {
  const error = refusal(action);
  expect(error.code).toBe(code);
  return error;
}

const accept = (reading: Reading, pkg: SkillInputPackage = inputPackage): unknown => acceptSkillReading(reading, { bundle, inputPackage: pkg });
const paragraph = (reading: Reading, chapter: number, index: number): Paragraph => {
  const found = reading.chapters[chapter]?.paragraphs[index];
  if (found === undefined) throw new Error(`fixture: chapters[${String(chapter)}].paragraphs[${String(index)}] missing`);
  return found;
};
const chapter = (reading: Reading, index: number): Chapter => {
  const found = reading.chapters[index];
  if (found === undefined) throw new Error(`fixture: chapters[${String(index)}] missing`);
  return found;
};

describe('N0: the baseline is green', () => {
  it('accepts the committed fixture reading and a deep copy of it', () => {
    expect(() => accept(baseline)).not.toThrow();
    expect(() => accept(readingWith(() => undefined))).not.toThrow();
    const { inputPackage: same, reading } = packageWith(() => undefined);
    expect(same.structuralHash).toBe(inputPackage.structuralHash);
    expect(() => accept(reading, same)).not.toThrow();
  });
});

describe('N1: shape and bindings', () => {
  it('refuses an extra top-level key, naming the path and never the value', () => {
    const error = expectRefusal(() => accept(readingWith((r) => { r['temperature'] = 'warm'; })), 'READING_SCHEMA_INVALID');
    expect(error.message).not.toContain('warm');
    expect(error.detail).toEqual({ path: '<root>' });
  });

  it('refuses a missing title and an empty chapter list', () => {
    expectRefusal(() => accept(readingWith((r) => { delete r['title']; })), 'READING_SCHEMA_INVALID');
    expectRefusal(() => accept(readingWith((r) => { r.chapters = []; })), 'READING_SCHEMA_INVALID');
  });

  it('refuses another skill identity', () => {
    expectRefusal(() => accept(readingWith((r) => { r['skillRef'] = 'bazodiac-interpretation-skill@1.0.1'; })), 'READING_SKILL_MISMATCH');
  });

  it('refuses another bundle identity or hash', () => {
    expectRefusal(() => accept(readingWith((r) => { r['bundleRef'] = 'bazodiac-skill-contract-bundle@2.0.0'; })), 'READING_BUNDLE_MISMATCH');
    expectRefusal(() => accept(readingWith((r) => { r['bundleStructuralHash'] = 'sha256:' + 'ab'.repeat(32); })), 'READING_BUNDLE_MISMATCH');
  });

  it.each(['inputPackageStructuralHash', 'claimGraphStructuralHash', 'planStructuralHash'])(
    'refuses a reading produced from another %s',
    (field) => {
      expectRefusal(() => accept(readingWith((r) => { r[field] = 'sha256:' + 'cd'.repeat(32); })), 'READING_PACKAGE_MISMATCH');
    },
  );

  it('refuses a drifted contract set through the bundle gate', () => {
    let caught: unknown;
    try {
      accept(readingWith((r) => {
        const lexicon = r.contracts.find((binding) => binding.contractRef === 'terminology-wording-lexicon@1.0.0');
        if (lexicon === undefined) throw new Error('fixture: lexicon binding missing');
        lexicon.contractRef = 'terminology-wording-lexicon@2.0.0';
        lexicon.confluencePageVersion = '2';
      }));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SkillContractError);
    expect((caught as SkillContractError).code).toBe('CONTRACT_DRIFT');
  });
});

describe('N2: chapters are the plan', () => {
  it('refuses a missing chapter', () => {
    expectRefusal(() => accept(readingWith((r) => { r.chapters = r.chapters.slice(0, 6); })), 'READING_CHAPTER_PLAN_MISMATCH');
  });

  it('refuses chapters out of order, another operation, and an unknown chapter id', () => {
    expectRefusal(() => accept(readingWith((r) => { r.chapters = [chapter(r, 1), chapter(r, 0), ...r.chapters.slice(2)]; })), 'READING_CHAPTER_PLAN_MISMATCH');
    expectRefusal(() => accept(readingWith((r) => { chapter(r, 0).narrativeOperation = 'REINFORCE'; })), 'READING_CHAPTER_PLAN_MISMATCH');
    expectRefusal(() => accept(readingWith((r) => { chapter(r, 0).chapterRef = 'chapter.sha256:' + 'ef'.repeat(32); })), 'READING_CHAPTER_PLAN_MISMATCH');
  });

  it('refuses a claim the accepted graph does not carry', () => {
    const error = expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 2).claimRefs = ['claim.sha256:' + '01'.repeat(32)]; })), 'READING_CLAIM_UNKNOWN');
    expect(error.detail).toMatchObject({ where: 'chapters[0].paragraphs[2]' });
  });

  it('refuses a claim the plan does not place in this chapter', () => {
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 2).claimRefs = [C.dayMaster, C.resource]; })), 'READING_CLAIM_NOT_PLANNED_HERE');
  });

  it('refuses a chapter that leaves one of its planned claims unrendered', () => {
    const error = expectRefusal(() => accept(readingWith((r) => {
      // Every paragraph stays grounded in another claim the plan places here;
      // only the day-master claim is never rendered.
      for (const p of chapter(r, 0).paragraphs) {
        if (!p.claimRefs.includes(C.dayMaster)) continue;
        p.claimRefs = [C.recurrence];
        p.factRefs = [];
        p.text = 'Dieser Absatz bleibt ohne besondere Wendung.';
        if (p.kind !== 'FRAME') p.posture = 'TENTATIVE';
      }
    })), 'READING_CHAPTER_CLAIM_UNRENDERED');
    expect(error.detail).toEqual({ where: 'chapters[0]', claimRef: C.dayMaster });
  });

  it('refuses a planned claim that only a FRAME paragraph cites: framing is not rendering', () => {
    const error = expectRefusal(() => accept(readingWith((r) => {
      for (const p of chapter(r, 0).paragraphs) {
        if (!p.claimRefs.includes(C.dayMaster) || p.kind === 'FRAME') continue;
        p.claimRefs = [C.recurrence];
        p.factRefs = [];
        p.text = 'Dieser Absatz bleibt ohne besondere Wendung.';
        p.posture = 'TENTATIVE';
      }
    })), 'READING_CHAPTER_CLAIM_UNRENDERED');
    expect(error.detail).toEqual({ where: 'chapters[0]', claimRef: C.dayMaster });
  });
});

describe('N3: facts', () => {
  it('refuses a fact the validated chart does not carry', () => {
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 0).factRefs.push('chart.pillar.year.season'); })), 'READING_FACT_UNKNOWN');
  });

  it('refuses a fact the input excludes from interpretation', () => {
    const { inputPackage: pkg, reading } = packageWith((core) => {
      const facts = core['facts'] as ChartFact[];
      core['facts'] = facts.filter((fact) => fact.id !== 'chart.pillar.hour.stem');
      core['excludedFactIds'] = ['chart.pillar.hour.stem'];
    });
    expectRefusal(() => accept(reading, pkg), 'READING_FACT_EXCLUDED');
  });

  it('refuses an interpretive paragraph citing a fact none of its claims is grounded in', () => {
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 2).factRefs.push('chart.pillar.year.stem'); })), 'READING_FACT_NOT_GROUNDED');
  });

  it('refuses a FACT paragraph without facts, an INTERPRETATION without claims, a FRAME without either', () => {
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 0).factRefs = []; })), 'READING_PARAGRAPH_UNGROUNDED');
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 2).claimRefs = []; })), 'READING_PARAGRAPH_UNGROUNDED');
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 1).claimRefs = []; paragraph(r, 0, 1).factRefs = []; })), 'READING_PARAGRAPH_UNGROUNDED');
  });

  it('refuses a posture that does not fit the kind', () => {
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 0).posture = 'SUPPORTED'; })), 'READING_POSTURE_INVALID');
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 2).posture = 'NONE'; })), 'READING_POSTURE_INVALID');
    // A FACT or FRAME paragraph over certain facts is not written as tentative.
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 0).posture = 'TENTATIVE'; })), 'READING_POSTURE_INVALID');
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 1).posture = 'TENTATIVE'; })), 'READING_POSTURE_INVALID');
  });

  it('refuses a FACT paragraph that cites a claim', () => {
    const error = expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 0).claimRefs = [C.dayMaster]; })), 'READING_POSTURE_INVALID');
    expect(error.detail).toEqual({ where: 'chapters[0].paragraphs[0]' });
  });

  const withProvisionalDayMaster = () => packageWith((core) => {
    const facts = core['facts'] as ChartFact[];
    core['facts'] = facts.map((fact) => (fact.id === 'chart.dayMaster.stem' ? { ...fact, provisional: true } : fact));
    core['provisionalFactIds'] = ['chart.dayMaster.stem'];
  });

  it('refuses a paragraph written as certain over a provisional fact', () => {
    const { inputPackage: pkg, reading } = withProvisionalDayMaster();
    const error = expectRefusal(() => accept(reading, pkg), 'READING_PROVISIONALITY_LAUNDERED');
    expect(error.detail).toEqual({ where: 'chapters[0].paragraphs[0]' });
  });

  it('accepts the provisional fact once every paragraph resting on it is written as tentative (the guard seen green)', () => {
    const { inputPackage: pkg, reading } = withProvisionalDayMaster();
    // A paragraph is tentative through the facts it cites itself or a TENTATIVE claim; the accepted
    // claims stay SUPPORTED here, so only paragraphs citing the fact directly change posture.
    for (const c of reading.chapters) {
      for (const p of c.paragraphs) {
        if (p.factRefs.includes('chart.dayMaster.stem')) p.posture = 'TENTATIVE';
      }
    }
    const accepted = acceptSkillReading(reading, { bundle, inputPackage: pkg });
    const factParagraph = accepted.chapters[0]?.paragraphs[0];
    expect(factParagraph?.kind).toBe('FACT');
    expect(factParagraph?.posture).toBe('TENTATIVE');
  });
});

describe('N4: text', () => {
  it('refuses a chart symbol no cited fact carries', () => {
    const error = expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 2).text += ' Der Stamm Geng steht daneben.'; })), 'READING_UNCITED_SYMBOL');
    expect(error.detail).toMatchObject({ symbols: ['geng'] });
  });

  it('refuses a number no cited fact carries', () => {
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 2).text += ' Das sind 3 Zeichen.'; })), 'READING_UNCITED_NUMERAL');
  });

  it('refuses a title, a chapter title and a method note naming a symbol or a number no fact carries', () => {
    // The reading title and the method note may name what the chart carries; a chapter title only what its
    // paragraphs cite. The stem Gui is in no pillar and no hidden stem of the fixture chart.
    const title = expectRefusal(() => accept(readingWith((r) => { r['title'] = 'Gui und der Anfang'; })), 'READING_UNCITED_SYMBOL');
    expect(title.detail).toMatchObject({ where: 'title', symbols: ['gui'] });
    expectRefusal(() => accept(readingWith((r) => { r['title'] = 'Ein Reading aus 1990'; })), 'READING_UNCITED_NUMERAL');
    const chapterTitle = expectRefusal(() => accept(readingWith((r) => { chapter(r, 0).title = 'Der Stamm Gui'; })), 'READING_UNCITED_SYMBOL');
    expect(chapterTitle.detail).toMatchObject({ where: 'chapters[0].title', symbols: ['gui'] });
    expectRefusal(() => accept(readingWith((r) => { chapter(r, 0).title += ' in 4 Säulen'; })), 'READING_UNCITED_NUMERAL');
    const note = expectRefusal(() => accept(readingWith((r) => { r.methodNote.text += ' Der Stamm Gui fehlt.'; })), 'READING_UNCITED_SYMBOL');
    expect(note.detail).toMatchObject({ where: 'methodNote', symbols: ['gui'] });
    expectRefusal(() => accept(readingWith((r) => { r.methodNote.text += ' Es gibt 12 Zweige.'; })), 'READING_UNCITED_NUMERAL');
  });

  it('refuses prohibited wording, naming the class', () => {
    const error = expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 2).text += ' Du solltest das ändern.'; })), 'READING_PROHIBITED_WORDING');
    expect(error.detail).toMatchObject({ classId: 'ADVICE_PREDICTION' });
  });

  it('refuses the vocabulary of a deferred method', () => {
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 2).text += ' Die Jahreszeit spielt hier hinein.'; })), 'READING_UNSUPPORTED_METHOD_LANGUAGE');
  });

  it('refuses evidence chrome on the customer surface: a hash, a code, a fact id, the word fixture', () => {
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 2).text += ' (sha256:abc)'; })), 'READING_EVIDENCE_CHROME');
    expectRefusal(() => accept(readingWith((r) => { r.methodNote.text += ' Code DAY_ANCHOR_UNVERIFIED.'; })), 'READING_EVIDENCE_CHROME');
    expectRefusal(() => accept(readingWith((r) => { chapter(r, 0).title += ' chart.dayMaster.stem'; })), 'READING_EVIDENCE_CHROME');
    expectRefusal(() => accept(readingWith((r) => { r['title'] = 'Fixture reading'; })), 'READING_EVIDENCE_CHROME');
  });

  it('refuses a chapter under and over the long-form word budget', () => {
    expectRefusal(() => accept(readingWith((r) => {
      const c = chapter(r, 0);
      c.paragraphs = c.paragraphs.filter((p) => p.kind !== 'FRAME' && p.kind !== 'REFLECTION' && p.kind !== 'FACT');
      c.paragraphs = c.paragraphs.map((p, i) => (i === 0 ? p : { ...p, text: p.text.split(' ').slice(0, 5).join(' ') }));
      c.paragraphs = [...c.paragraphs, { kind: 'FACT', posture: 'NONE', text: 'Der Tagesmeister ist Xin.', factRefs: ['chart.dayMaster.stem'], claimRefs: [] }];
    })), 'READING_CHAPTER_LENGTH_OUT_OF_CONTRACT');
    expectRefusal(() => accept(readingWith((r) => {
      const p = paragraph(r, 0, 2);
      p.text = `${p.text} ${p.text} ${p.text}`;
    })), 'READING_CHAPTER_LENGTH_OUT_OF_CONTRACT');
  });
});

describe('N5: semantic delta and callbacks', () => {
  it('refuses a chapter without a declared semantic delta', () => {
    expectRefusal(() => accept(readingWith((r) => { chapter(r, 1).semanticDelta = []; })), 'READING_NO_SEMANTIC_DELTA');
  });

  it('refuses a delta over a claim the chapter does not render', () => {
    expectRefusal(() => accept(readingWith((r) => { chapter(r, 1).semanticDelta.push({ kind: 'NEW_RELATION', claimRefs: [C.dayMaster] }); })), 'READING_DELTA_CLAIM_NOT_RENDERED');
  });

  it('refuses NEW_CLAIM for a claim an earlier chapter already rendered', () => {
    expectRefusal(() => accept(readingWith((r) => { chapter(r, 2).semanticDelta.push({ kind: 'NEW_CLAIM', claimRefs: [C.recurrence] }); })), 'READING_NEW_CLAIM_ALREADY_RENDERED');
    expectRefusal(() => accept(readingWith((r) => { chapter(r, 2).callbacks = [{ claimRef: C.recurrence, deltaKind: 'NEW_CLAIM' }]; })), 'READING_NEW_CLAIM_ALREADY_RENDERED');
  });

  it('refuses a claim rendered for the first time without a declared NEW_CLAIM', () => {
    const error = expectRefusal(() => accept(readingWith((r) => {
      chapter(r, 2).semanticDelta = chapter(r, 2).semanticDelta.filter((delta) => delta.kind !== 'NEW_CLAIM');
    })), 'READING_NEW_CLAIM_UNDECLARED');
    expect(error.detail).toEqual({ where: 'chapters[2]', claimRef: C.pressure });
  });

  it('refuses a claim rendered again without a declared callback delta', () => {
    const error = expectRefusal(() => accept(readingWith((r) => { chapter(r, 2).callbacks = []; })), 'READING_CALLBACK_WITHOUT_DELTA');
    expect(error.detail).toEqual({ where: 'chapters[2]', claimRef: C.recurrence });
  });

  it('refuses a callback of a claim no earlier chapter rendered, or this chapter does not render', () => {
    expectRefusal(() => accept(readingWith((r) => { chapter(r, 0).callbacks = [{ claimRef: C.dayMaster, deltaKind: 'NEW_CONTEXT' }]; })), 'READING_CALLBACK_NOT_PRIOR');
    expectRefusal(() => accept(readingWith((r) => { chapter(r, 2).callbacks.push({ claimRef: C.dayMaster, deltaKind: 'NEW_CONTEXT' }); })), 'READING_CALLBACK_NOT_PRIOR');
  });

  it('refuses a method note that does not carry the source warnings verbatim', () => {
    expectRefusal(() => accept(readingWith((r) => { r.methodNote.warningCodes = []; })), 'READING_WARNINGS_NOT_VERBATIM');
    expectRefusal(() => accept(readingWith((r) => { r.methodNote.warningCodes = ['DAY_ANCHOR_UNVERIFIED', 'DAY_ANCHOR_UNVERIFIED']; })), 'READING_WARNINGS_NOT_VERBATIM');
  });

  it('refuses a reflection question resting on an unknown claim or naming a symbol its claims do not carry', () => {
    expectRefusal(() => accept(readingWith((r) => { r.reflectionQuestions[0]!.claimRefs = ['claim.sha256:' + '02'.repeat(32)]; })), 'READING_CLAIM_UNKNOWN');
    expectRefusal(() => accept(readingWith((r) => { r.reflectionQuestions[0]!.text += ' Denk an Geng.'; })), 'READING_UNCITED_SYMBOL');
    expectRefusal(() => accept(readingWith((r) => { r.reflectionQuestions[0]!.text += ' Das sind 3 Zeichen.'; })), 'READING_UNCITED_NUMERAL');
  });
});

describe('N5b: claims the plan carries but no chapter renders', () => {
  const extraClaim = () => {
    const template = inputPackage.claimGraph.claims[0];
    if (template === undefined) throw new Error('fixture: no claim');
    return { ...template, claimId: 'claim.sha256:' + '07'.repeat(32), statement: 'An extra accepted claim no chapter renders.' };
  };

  it('refuses a thesis claim no chapter renders', () => {
    const { inputPackage: pkg, reading } = packageWith((core) => {
      const graph = core['claimGraph'] as { claims: unknown[] };
      graph.claims = [...graph.claims, extraClaim()];
      const plan = core['plan'] as { reportThesis: { claimRefs: string[] }; constraints: { allowedClaimRefs: string[] } };
      plan.reportThesis = { claimRefs: [...plan.reportThesis.claimRefs, 'claim.sha256:' + '07'.repeat(32)] };
      plan.constraints = { ...plan.constraints, allowedClaimRefs: [...plan.constraints.allowedClaimRefs, 'claim.sha256:' + '07'.repeat(32)] };
    });
    const error = expectRefusal(() => accept(reading, pkg), 'READING_THESIS_UNRENDERED');
    expect(error.detail).toEqual({ claimRef: 'claim.sha256:' + '07'.repeat(32) });
  });

  it('refuses a reflection question resting on an unplanned claim', () => {
    const { inputPackage: pkg, reading } = packageWith((core) => {
      const graph = core['claimGraph'] as { claims: unknown[] };
      graph.claims = [...graph.claims, extraClaim()];
    });
    reading.reflectionQuestions[0]!.claimRefs = ['claim.sha256:' + '07'.repeat(32)];
    expectRefusal(() => accept(reading, pkg), 'READING_CLAIM_NOT_PLANNED_HERE');
  });

  it('refuses a forged accepted reading with chrome in the projection', () => {
    const accepted = acceptSkillReading(baseline, { bundle, inputPackage });
    expectRefusal(() => projectCustomerReading({ ...accepted, title: 'Reading sha256:abc' }), 'READING_EVIDENCE_CHROME');
  });
});

describe('N6: visualization specs', () => {
  it('refuses a slot the presentation contract does not declare', () => {
    expectRefusal(() => accept(readingWith((r) => { r.visualizationSpecs[0]!.slotId = 'cover.secondaryGlyph'; })), 'READING_VISUAL_SLOT_UNKNOWN');
  });

  it('refuses a spec over an unknown fact or an unknown claim', () => {
    expectRefusal(() => accept(readingWith((r) => { r.visualizationSpecs[0]!.factRefs = ['chart.pillar.year.season']; })), 'READING_VISUAL_REF_INVALID');
    expectRefusal(() => accept(readingWith((r) => { r.visualizationSpecs[0]!.claimRefs = ['claim.sha256:' + '03'.repeat(32)]; })), 'READING_VISUAL_REF_INVALID');
  });

  it('refuses two specs with one id', () => {
    expectRefusal(() => accept(readingWith((r) => { r.visualizationSpecs.push({ ...r.visualizationSpecs[0]! }); })), 'READING_VISUAL_SPEC_DUPLICATE');
  });
});

describe('N7: the input package', () => {
  const parts = () => ({
    bundle,
    input: fixture.input,
    graph: fixture.graph,
    plan: fixture.plan,
    subject: { displayName: 'Musterkundin A', birthTimeKnown: true },
    allowedSlotIds: inputPackage.allowedSlotIds,
  });

  it('refuses a plan accepted against another claim graph', () => {
    const plan = { ...fixture.plan, claimGraphStructuralHash: 'sha256:' + '04'.repeat(32) };
    expectRefusal(() => buildSkillInputPackage({ ...parts(), plan }), 'PACKAGE_BINDING_MISMATCH');
  });

  it('refuses a claim graph accepted under another Method Profile', () => {
    const graph = { ...fixture.graph, methodRegistryStructuralHash: 'sha256:' + '05'.repeat(32) };
    expectRefusal(() => buildSkillInputPackage({ ...parts(), graph }), 'PACKAGE_BINDING_MISMATCH');
  });

  it('refuses an interpretation input whose feature set the graph did not cite', () => {
    const input = { ...fixture.input, validatedChart: { ...fixture.input.validatedChart, featureSetStructuralHash: 'sha256:' + '06'.repeat(32) } };
    expectRefusal(() => buildSkillInputPackage({ ...parts(), input }), 'PACKAGE_BINDING_MISMATCH');
  });

  it('refuses a plan bound to another Lexicon release', () => {
    const plan = {
      ...fixture.plan,
      terminologyLexicon: { ...fixture.plan.terminologyLexicon, confluencePageVersion: '2' },
    } as unknown as typeof fixture.plan;
    expectRefusal(() => buildSkillInputPackage({ ...parts(), plan }), 'PACKAGE_BINDING_MISMATCH');
  });

  it('refuses a claim graph or plan version the bundle does not bind', () => {
    const graph = { ...fixture.graph, graphVersion: 'etbz-30.interpretive-claim-graph.v2' as typeof fixture.graph.graphVersion };
    expectRefusal(() => buildSkillInputPackage({ ...parts(), graph }), 'PACKAGE_BINDING_MISMATCH');
  });

  it('refuses an interpretation input built under another Method Profile', () => {
    const input = { ...fixture.input, methodProfile: { ...fixture.input.methodProfile, ref: 'bazi-method-profile@1.0.1' } };
    expectRefusal(() => buildSkillInputPackage({ ...parts(), input }), 'PACKAGE_BINDING_MISMATCH');
  });

  it('refuses an interpretation input of another schema or feature-set version', () => {
    const otherSchema = { ...fixture.input, schemaVersion: 'bazodiac-interpretation-input.v2' } as unknown as typeof fixture.input;
    expectRefusal(() => buildSkillInputPackage({ ...parts(), input: otherSchema }), 'PACKAGE_BINDING_MISMATCH');
    const otherFeatureSet = { ...fixture.input, validatedChart: { ...fixture.input.validatedChart, featureSetVersion: 'v0' } } as unknown as typeof fixture.input;
    expectRefusal(() => buildSkillInputPackage({ ...parts(), input: otherFeatureSet }), 'PACKAGE_BINDING_MISMATCH');
  });

  it('refuses a plan bound to another Lens release', () => {
    const plan = {
      ...fixture.plan,
      interpretationLens: { ...fixture.plan.interpretationLens, confluencePageVersion: '2' },
    } as unknown as typeof fixture.plan;
    expectRefusal(() => buildSkillInputPackage({ ...parts(), plan }), 'PACKAGE_BINDING_MISMATCH');
  });

  it('refuses an input whose excluded fact ids do not equal its non-interpretable facts', () => {
    const input = {
      ...fixture.input,
      provisionality: { ...fixture.input.provisionality, excludedFactIds: ['chart.pillar.hour.stem'] },
    } as unknown as typeof fixture.input;
    expectRefusal(() => buildSkillInputPackage({ ...parts(), input }), 'PACKAGE_BINDING_MISMATCH');
  });

  it('refuses a slot id that is not one lowercase token', () => {
    expectRefusal(() => buildSkillInputPackage({ ...parts(), allowedSlotIds: ['Cover.primaryGlyph'] }), 'PACKAGE_SCHEMA_INVALID');
    expectRefusal(() => buildSkillInputPackage({ ...parts(), allowedSlotIds: ['cover primary'] }), 'PACKAGE_SCHEMA_INVALID');
  });

  it('refuses a subject that contradicts the input, an empty name, and duplicated slot ids', () => {
    expectRefusal(() => buildSkillInputPackage({ ...parts(), subject: { displayName: 'Musterkundin A', birthTimeKnown: false } }), 'PACKAGE_SCHEMA_INVALID');
    expectRefusal(() => buildSkillInputPackage({ ...parts(), subject: { displayName: '  ', birthTimeKnown: true } }), 'PACKAGE_SCHEMA_INVALID');
    expectRefusal(() => buildSkillInputPackage({ ...parts(), allowedSlotIds: ['cover.primaryGlyph', 'cover.primaryGlyph'] }), 'PACKAGE_SCHEMA_INVALID');
  });
});
