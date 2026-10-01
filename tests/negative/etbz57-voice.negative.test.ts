/**
 * ETBZ-57 — the refusals of the customer-voice revision (skill and bundle 1.1.0).
 *
 * Pattern as in ETBZ-52: the accepted 1.1 fixture reading is the green
 * baseline; each test changes as little of it as the refusal needs, on a deep
 * copy, and names the code it expects. The 1.0.0 boundary is untouched: the
 * ETBZ-52 suites still accept the 1.0.0 reading under the 1.0.0 bundle.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { structuralHash } from '../../src/domain/structural-hash.js';
import type { ChartFact } from '../../src/application/interpretation/feature-set.js';
import {
  SkillContractError,
  SkillRunError,
  acceptEditorialRevision,
  acceptPortableSkillContractBundle,
  acceptSkillReading,
  assertCandidateSkillContractBundle,
  assertReleasedSkillContractBundle,
  buildSkillContractBundle,
  buildSkillInputPackage,
  renderPortableSkillContractBundle,
  skillRefForBundle,
  validateSkillContractBundleCore,
} from '../../src/application/skill/index.js';
import type { SkillContractBundleCore, SkillInputPackage, SkillRunErrorCode } from '../../src/application/skill/index.js';
import { BAZI_METHOD_REGISTRY_V1 } from '../../src/application/interpretation/method-registry.js';
import { listSlotIds } from '../../src/application/visual/index.js';
import { skillFixture, skillFixtureV1_1 } from '../support/skillFixture.js';

// Every test here accepts a 4,400-word reading through every voice gate; under a loaded
// machine that takes seconds, and a default 5 s timeout would read as a failure of the gate.
vi.setConfig({ testTimeout: 60_000 });

type Json = Record<string, unknown>;
type Paragraph = { kind: string; posture: string; text: string; factRefs: string[]; claimRefs: string[] };
type Chapter = { chapterRef: string; narrativeOperation: string; title: string; paragraphs: Paragraph[]; semanticDelta: { kind: string; claimRefs: string[] }[]; callbacks: { claimRef: string; deltaKind: string }[] };
type Reading = Json & { title: string; chapters: Chapter[]; reflectionQuestions: { text: string; claimRefs: string[] }[]; methodNote: { text: string; warningCodes: string[] }; visualizationSpecs: { specId: string; slotId: string; factRefs: string[]; claimRefs: string[] }[] };

const fixture = skillFixtureV1_1();
const { bundle, inputPackage } = fixture;
const context = { bundle, inputPackage, candidateEvaluation: true } as const;
const FIXTURE_DIR = resolve(process.cwd(), 'docs/evidence/etbz-57/fixture');
const baseline = JSON.parse(readFileSync(resolve(FIXTURE_DIR, 'skill-reading.json'), 'utf8')) as Reading;
const semanticBaseline = JSON.parse(readFileSync(resolve(FIXTURE_DIR, 'semantic-reading.json'), 'utf8')) as Reading;
const oldReading = JSON.parse(readFileSync(resolve(process.cwd(), 'docs/evidence/etbz-52/fixture/skill-reading.json'), 'utf8')) as Reading;

function readingWith(edit: (reading: Reading) => void, from: Reading = baseline): Reading {
  const copy = structuredClone(from);
  edit(copy);
  return copy;
}

const chapter = (reading: Reading, index: number): Chapter => reading.chapters[index] as Chapter;
const paragraph = (reading: Reading, c: number, p: number): Paragraph => chapter(reading, c).paragraphs[p] as Paragraph;

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

function contractRefusal(action: () => unknown): SkillContractError {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught, 'expected a SkillContractError to be thrown').toBeInstanceOf(SkillContractError);
  return caught as SkillContractError;
}

const accept = (reading: unknown, pkg: SkillInputPackage = inputPackage) => acceptSkillReading(reading, { bundle, inputPackage: pkg, candidateEvaluation: true });
/** The accepted REALISE reading, built inside each test so a broken boundary fails an assertion, not the file load. */
const semantic = () => accept(semanticBaseline);

/** A package with one edit and a recomputed hash, plus the 1.1 reading re-bound to it. */
function packageWith(edit: (core: Record<string, unknown>) => void): { inputPackage: SkillInputPackage; reading: Reading } {
  const { structuralHash: published, ...core } = inputPackage;
  const mutable = structuredClone(core) as Record<string, unknown>;
  edit(mutable);
  const rebound = { ...mutable, structuralHash: structuralHash(mutable) } as unknown as SkillInputPackage;
  expect(rebound.structuralHash).not.toBe(published);
  const reading = readingWith((draft) => {
    draft['inputPackageStructuralHash'] = rebound.structuralHash;
  });
  return { inputPackage: rebound, reading };
}

describe('V0: the green baselines', () => {
  it('accepts the REALISE reading and its EDIT revision under bundle 1.1.0', () => {
    expect(() => accept(semanticBaseline)).not.toThrow();
    expect(() => acceptEditorialRevision(semantic(), baseline, context)).not.toThrow();
  });

  it('keeps the 1.0.0 reading accepted under the 1.0.0 bundle: the voice gates hold 1.1.0 only', () => {
    const released = skillFixture();
    expect(() => acceptSkillReading(oldReading, { bundle: released.bundle, inputPackage: released.inputPackage })).not.toThrow();
  });

  it('accepts tension language where the paragraph cites both poles of a CONTRASTS_WITH relation', () => {
    expect(paragraph(baseline, 2, 2).text).toMatch(/Spannung/u);
    expect(() => accept(baseline)).not.toThrow();
  });

  it('accepts method and data wording in the method note, which is not narrative', () => {
    expect(baseline.methodNote.text).toMatch(/berechnet/u);
    expect(() => accept(readingWith((r) => { r.methodNote.text = `${r.methodNote.text} Die Berechnung stammt aus dem Rechendienst.`; }))).not.toThrow();
  });
});

describe('V1: uncertainty is carried, not added (DIRECTNESS)', () => {
  it('refuses an interpretive paragraph over SUPPORTED claims only written as TENTATIVE', () => {
    const error = expectRefusal(() => accept(readingWith((r) => {
      const p = paragraph(r, 0, 2);
      p.posture = 'TENTATIVE';
      p.text = `Vielleicht: ${p.text}`;
    })), 'READING_SUPPORTED_UNDERSTATED');
    expect(error.detail).toEqual({ where: 'chapters[0].paragraphs[2]' });
  });

  it('refuses a REFLECTION paragraph over SUPPORTED claims written as TENTATIVE', () => {
    expectRefusal(() => accept(readingWith((r) => {
      const p = paragraph(r, 0, 5);
      p.posture = 'TENTATIVE';
      p.text = `Vielleicht kennst du das: ${p.text}`;
    })), 'READING_SUPPORTED_UNDERSTATED');
  });

  it('refuses a SUPPORTED paragraph that keeps its posture but adds doubt in the text', () => {
    const error = expectRefusal(() => accept(readingWith((r) => {
      const p = paragraph(r, 0, 5);
      p.text = `Vielleicht kennst du das: ${p.text}`;
    })), 'READING_SUPPORTED_UNDERSTATED');
    expect(error.detail).toEqual({ where: 'chapters[0].paragraphs[5]', phrase: 'vielleicht' });
  });

  /** The claim of paragraph (0,5) linked by ALTERNATIVE_READING to the claim of paragraph (1,2); paragraph (0,3) also cites an unlinked claim. */
  const withAlternative = () => {
    const own = paragraph(baseline, 0, 5).claimRefs[0] as string;
    const other = paragraph(baseline, 1, 2).claimRefs[0] as string;
    expect(paragraph(baseline, 0, 3).claimRefs).toContain(own);
    expect(paragraph(baseline, 0, 3).claimRefs.some((id) => id !== own && id !== other)).toBe(true);
    return packageWith((core) => {
      const graph = core['claimGraph'] as { claims: { claimId: string; relations: { targetClaimId: string; type: string }[] }[] };
      const claim = graph.claims.find((entry) => entry.claimId === own);
      expect(claim).toBeDefined();
      claim?.relations.push({ targetClaimId: other, type: 'ALTERNATIVE_READING' });
    });
  };

  it('keeps bounded wording where the graph carries an ALTERNATIVE_READING for every cited claim (the guard seen green)', () => {
    const { inputPackage: pkg, reading } = withAlternative();
    paragraph(reading, 0, 5).text = `Vielleicht kennst du das: ${paragraph(reading, 0, 5).text}`;
    expect(() => accept(reading, pkg)).not.toThrow();
  });

  it('refuses doubt in a paragraph that also cites a claim the alternative does not cover', () => {
    const { inputPackage: pkg, reading } = withAlternative();
    paragraph(reading, 0, 3).text = `Vielleicht: ${paragraph(reading, 0, 3).text}`;
    const error = expectRefusal(() => accept(reading, pkg), 'READING_SUPPORTED_UNDERSTATED');
    expect(error.detail).toMatchObject({ where: 'chapters[0].paragraphs[3]' });
  });

  it('refuses the framework template even over a graph-carried alternative', () => {
    const { inputPackage: pkg, reading } = withAlternative();
    paragraph(reading, 0, 5).text += ' Innerhalb dieses BaZi-Rahmens ist das ein Standpunkt.';
    expectRefusal(() => accept(reading, pkg), 'READING_SUPPORTED_TEMPLATE_HEDGE');
  });

  it('refuses a retired template in a FRAME paragraph over SUPPORTED claims (posture NONE)', () => {
    expect(paragraph(baseline, 0, 1).kind).toBe('FRAME');
    const error = expectRefusal(() => accept(readingWith((r) => {
      paragraph(r, 0, 1).text += ' Innerhalb dieses BaZi-Rahmens kann der Tagesmeister als Standpunkt gelesen werden.';
    })), 'READING_SUPPORTED_TEMPLATE_HEDGE');
    expect(error.detail).toMatchObject({ where: 'chapters[0].paragraphs[1]' });
  });

  it('refuses a SUPPORTED paragraph hedged with a retired template', () => {
    for (const hedge of ['Das kann als fester Standpunkt gelesen werden.', 'Eine mögliche Ausdrucksform ist ein fester Standpunkt.', 'Innerhalb dieses BaZi-Rahmens ist das ein Standpunkt.', 'Mögliche Ausdrucksformen sind Genauigkeit und Kritik.', 'Das lässt sich als fester Standpunkt lesen.']) {
      expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 2).text = `${paragraph(r, 0, 2).text} ${hedge}`; })), 'READING_SUPPORTED_TEMPLATE_HEDGE');
    }
  });

  it('refuses "Lesart" first as meta-narration: it talks about the reading, not the chart', () => {
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 0, 2).text += ' Eine mögliche Lesart ist ein fester Standpunkt.'; })), 'READING_META_NARRATION');
  });
});

describe('V2: TENTATIVE stays visible', () => {
  const withProvisionalDayMaster = () => packageWith((core) => {
    const facts = core['facts'] as ChartFact[];
    core['facts'] = facts.map((fact) => (fact.id === 'chart.dayMaster.stem' ? { ...fact, provisional: true } : fact));
    core['provisionalFactIds'] = ['chart.dayMaster.stem'];
  });
  const restingOnDayMaster = (r: Reading): Paragraph[] => r.chapters.flatMap((c) => c.paragraphs.filter((p) => p.factRefs.includes('chart.dayMaster.stem')));

  it('refuses a paragraph over a provisional fact written TENTATIVE without a visible marker', () => {
    const { inputPackage: pkg, reading } = withProvisionalDayMaster();
    for (const p of restingOnDayMaster(reading)) p.posture = 'TENTATIVE';
    const error = expectRefusal(() => accept(reading, pkg), 'READING_TENTATIVE_NOT_VISIBLE');
    expect(error.detail).toEqual({ where: 'chapters[0].paragraphs[0]' });
  });

  it('does not take the trait adjective "vorsichtig" for a tentative marker', () => {
    const { inputPackage: pkg, reading } = withProvisionalDayMaster();
    for (const p of restingOnDayMaster(reading)) {
      p.posture = 'TENTATIVE';
      p.text = `${p.text} Das wirkt vorsichtig und abwägend.`;
    }
    expectRefusal(() => accept(reading, pkg), 'READING_TENTATIVE_NOT_VISIBLE');
  });

  it('still refuses the same paragraph written as certain (provisionality never disappears)', () => {
    const { inputPackage: pkg, reading } = withProvisionalDayMaster();
    expectRefusal(() => accept(reading, pkg), 'READING_PROVISIONALITY_LAUNDERED');
  });

  it('accepts it once every paragraph on the provisional fact is TENTATIVE and says so (the guard seen green)', () => {
    const { inputPackage: pkg, reading } = withProvisionalDayMaster();
    for (const p of restingOnDayMaster(reading)) {
      p.posture = 'TENTATIVE';
      p.text = `Vorläufig, solange die Angabe nicht bestätigt ist: ${p.text}`;
    }
    expect(() => accept(reading, pkg)).not.toThrow();
  });
});

describe('V3: no meta-narration on the customer surface (CUSTOMER_SURFACE)', () => {
  it.each([
    ['a FACT paragraph naming the source', (r: Reading) => { paragraph(r, 0, 0).text += ' Die Quelle führt diese Angaben so.'; }, 'chapters[0].paragraphs[0]'],
    ['a paragraph on validation', (r: Reading) => { paragraph(r, 1, 2).text += ' Das steht so in den validierten Angaben.'; }, 'chapters[1].paragraphs[2]'],
    ['a paragraph narrating the reading', (r: Reading) => { paragraph(r, 1, 3).text += ' Dieses Reading rechnet nichts nach.'; }, 'chapters[1].paragraphs[3]'],
    ['a paragraph narrating its chapter', (r: Reading) => { paragraph(r, 1, 4).text += ' Dieses Kapitel öffnet einen Faden.'; }, 'chapters[1].paragraphs[4]'],
    ['a paragraph narrating later chapters', (r: Reading) => { paragraph(r, 1, 4).text += ' In den nächsten Kapiteln wird dieses Motiv weiter entwickelt.'; }, 'chapters[1].paragraphs[4]'],
    ['a paragraph placing itself in the reading', (r: Reading) => { paragraph(r, 1, 4).text += ' Im Reading steht das am Anfang.'; }, 'chapters[1].paragraphs[4]'],
    ['a paragraph addressing "dein Reading"', (r: Reading) => { paragraph(r, 1, 4).text += ' Dein Reading beginnt hier.'; }, 'chapters[1].paragraphs[4]'],
    ['an inflected meta word beside a cited label', (r: Reading) => { paragraph(r, 3, 0).text += ' Indirekte Quellen sind hier gemeint.'; }, 'chapters[3].paragraphs[0]'],
    ['a paragraph naming a producer label it does not cite', (r: Reading) => { paragraph(r, 4, 0).text += ' In BaZi heißt diese Beziehung Indirekte Quelle.'; }, 'chapters[4].paragraphs[0]'],
    ['a chapter title', (r: Reading) => { chapter(r, 1).title = 'Was die Berechnung im Monat zeigt'; }, 'chapters[1].title'],
    ['the reading title', (r: Reading) => { r.title = 'Dein BaZi-Reading aus validierten Angaben'; }, 'title'],
    ['a reflection question', (r: Reading) => { (r.reflectionQuestions[0] as { text: string }).text += ' Was sagt dir diese Lesart?'; }, 'reflectionQuestions[0]'],
  ])('refuses %s', (_name, edit, where) => {
    const error = expectRefusal(() => accept(readingWith(edit)), 'READING_META_NARRATION');
    expect(error.detail).toMatchObject({ where });
  });

  it('accepts a producer label containing "Quelle" where the paragraph cites the fact that carries it (the guard seen green)', () => {
    expect(paragraph(baseline, 3, 0).factRefs).toContain('chart.natal.pillar.month.hiddenStem.1.tenGod');
    expect(() => accept(readingWith((r) => { paragraph(r, 3, 0).text += ' In BaZi heißt diese Beziehung Indirekte Quelle.'; }))).not.toThrow();
  });

  it('refuses a producer label in a reflection question or a chapter title that does not cite it', () => {
    expectRefusal(() => accept(readingWith((r) => { (r.reflectionQuestions[2] as { text: string }).text += ' Kennst du die Indirekte Quelle?'; })), 'READING_META_NARRATION');
    expectRefusal(() => accept(readingWith((r) => { chapter(r, 4).title = 'Klarstellung: Indirekte Quelle'; })), 'READING_META_NARRATION');
  });

  it('accepts a producer label in a reflection question whose claim is grounded in it (the guard seen green)', () => {
    const question = baseline.reflectionQuestions[1] as { claimRefs: string[] };
    expect(question.claimRefs).toHaveLength(1);
    expect(() => accept(readingWith((r) => { (r.reflectionQuestions[1] as { text: string }).text += ' Kennst du die Indirekte Quelle?'; }))).not.toThrow();
  });

  it('refuses the 1.0.0 fixture texts once they are held to the 1.1.0 gates', () => {
    const rebound = readingWith((r) => {
      for (const key of ['skillRef', 'bundleRef', 'bundleStructuralHash', 'inputPackageStructuralHash', 'claimGraphStructuralHash', 'planStructuralHash', 'contracts']) {
        r[key] = baseline[key];
      }
    }, oldReading);
    expectRefusal(() => accept(rebound), 'READING_META_NARRATION');
  });
});

describe('V4: tension only where the graph carries it (INTERPRETIVE_EDGE)', () => {
  it('refuses tension language in a paragraph whose only claim is in no CONTRASTS_WITH relation', () => {
    const error = expectRefusal(() => accept(readingWith((r) => { paragraph(r, 1, 2).text += ' Darin liegt eine echte Spannung.'; })), 'READING_TENSION_UNGROUNDED');
    expect(error.detail).toEqual({ where: 'chapters[1].paragraphs[2]', phrase: 'spannung*' });
  });

  it('refuses tension language in a FACT paragraph, which cites no claim', () => {
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 2, 0).text += ' Das ist ein Widerspruch.'; })), 'READING_TENSION_UNGROUNDED');
  });

  it('refuses tension language over two claims that are each in a contrast, but not with each other', () => {
    expect(paragraph(baseline, 0, 3).claimRefs).toHaveLength(2);
    const error = expectRefusal(() => accept(readingWith((r) => {
      paragraph(r, 0, 3).text += ' Zwischen deinem Tagesmeister und deinem Ausdruck besteht ein Widerspruch.';
    })), 'READING_TENSION_UNGROUNDED');
    expect(error.detail).toMatchObject({ where: 'chapters[0].paragraphs[3]' });
  });

  it('refuses tension language over a single claim, even one that is the pole of a contrast', () => {
    expect(paragraph(baseline, 3, 2).claimRefs).toHaveLength(1);
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 3, 2).text += ' Darin liegt eine echte Spannung.'; })), 'READING_TENSION_UNGROUNDED');
  });

  it('accepts tension language over both poles cited against the relation\'s direction (the guard seen green)', () => {
    expect(paragraph(baseline, 5, 2).claimRefs).toHaveLength(2);
    expect(() => accept(readingWith((r) => {
      const p = paragraph(r, 5, 2);
      p.claimRefs.reverse();
      p.text += ' Darin liegt eine echte Spannung.';
    }))).not.toThrow();
  });

  it('refuses a manufactured opposition ("Gegensatz") over a claim in no contrast', () => {
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 1, 2).text += ' Zwischen deinem Ausdruck und deinem Tagesmeister besteht ein Gegensatz.'; })), 'READING_TENSION_UNGROUNDED');
  });

  it('refuses a manufactured conflict in a title over claims without a contrast', () => {
    expectRefusal(() => accept(readingWith((r) => { chapter(r, 1).title = 'Ein Konflikt im Monat'; })), 'READING_TENSION_UNGROUNDED');
  });
});

describe('V5: concrete, never biographical (CONCRETENESS)', () => {
  it.each([
    ['Im Beruf zeigt sich das jeden Tag.'],
    ['Deine Mutter kennt diese Seite von dir.'],
    ['Mit deinem Partner erlebst du das besonders deutlich.'],
    ['In deiner Kindheit war das schon so.'],
    ['Das kostet dich Geld.'],
    ['Als Kind warst du schon so.'],
    ['Mit deinen Freunden zeigt sich das deutlich.'],
    ['Die Erwartungen deines Vaters spielen hier mit.'],
    ['Mit deinen Kindern erlebst du das.'],
  ])('refuses "%s"', (sentence) => {
    expectRefusal(() => accept(readingWith((r) => { paragraph(r, 1, 4).text += ` ${sentence}`; })), 'READING_LIFE_DOMAIN_INVENTED');
  });

  it('refuses a life domain in the method note', () => {
    const error = expectRefusal(() => accept(readingWith((r) => { r.methodNote.text += ' Deine Familie kennt diese Seite von dir.'; })), 'READING_LIFE_DOMAIN_INVENTED');
    expect(error.detail).toMatchObject({ where: 'methodNote' });
  });

  it.each([
    ['Dieses Motiv taucht zweimal auf.', 'zweimal'],
    ['Die Anforderung steht an zwei Stellen.', 'an zwei stellen'],
    ['Der Ausdruck ist doppelt angelegt.', 'doppelt*'],
  ])('refuses the count "%s": a count is derived, never a chart fact', (sentence, phrase) => {
    const error = expectRefusal(() => accept(readingWith((r) => { paragraph(r, 1, 4).text += ` ${sentence}`; })), 'READING_UNCITED_NUMERAL');
    expect(error.detail).toEqual({ where: 'chapters[1].paragraphs[4]', phrase });
  });

  it('refuses a count in the method note', () => {
    const error = expectRefusal(() => accept(readingWith((r) => { r.methodNote.text += ' Das Motiv steht zweimal.'; })), 'READING_UNCITED_NUMERAL');
    expect(error.detail).toEqual({ where: 'methodNote', phrase: 'zweimal' });
  });

  it('refuses a count in a chapter title', () => {
    expectRefusal(() => accept(readingWith((r) => { chapter(r, 0).title = 'Xin und ein Ausdruck, der zweimal auftaucht'; })), 'READING_UNCITED_NUMERAL');
  });

  it('does not refuse the Lexicon\'s own term "Familie" for a Ten-God family', () => {
    expect(paragraph(baseline, 1, 1).text).toMatch(/Familien/u);
    expect(() => accept(baseline)).not.toThrow();
  });
});

describe('V6: the editorial pass changes customer text only (AC 12)', () => {
  const edit = (change: (r: Reading) => void) => () => acceptEditorialRevision(semantic(), readingWith(change), context);

  it('refuses a revision that adds a fact reference', () => {
    expectRefusal(edit((r) => { paragraph(r, 0, 0).factRefs.push('chart.pillar.year.tier'); }), 'READING_EDITORIAL_EXPANSION');
  });

  it('refuses a revision that adds a claim to a paragraph', () => {
    const p = paragraph(baseline, 0, 5);
    expect(p.claimRefs).toHaveLength(1);
    const other = paragraph(baseline, 0, 2).claimRefs[0] as string;
    expectRefusal(edit((r) => { paragraph(r, 0, 5).claimRefs.push(other); }), 'READING_EDITORIAL_EXPANSION');
  });

  it('refuses a revision that drops a visual spec or adds a paragraph', () => {
    expectRefusal(edit((r) => { r.visualizationSpecs.pop(); }), 'READING_EDITORIAL_EXPANSION');
    expectRefusal(edit((r) => { chapter(r, 1).paragraphs.push(structuredClone(paragraph(r, 1, 4))); }), 'READING_EDITORIAL_EXPANSION');
  });

  it.each([
    ['a new uncited symbol', 'Darin brennt Feuer.', 'READING_UNCITED_SYMBOL'],
    ['a new number', 'Das zeigt sich 3 Mal.', 'READING_UNCITED_NUMERAL'],
    ['a new life domain', 'Im Job ist das besonders sichtbar.', 'READING_LIFE_DOMAIN_INVENTED'],
    ['a diagnosis', 'Das deutet auf eine Angststörung hin.', 'READING_PROHIBITED_WORDING'],
    ['causality', 'Diese Stellung verursacht dein Verhalten.', 'READING_PROHIBITED_WORDING'],
    ['a deterministic identity', 'Du bist jemand, der immer zuspitzt.', 'READING_PROHIBITED_WORDING'],
    ['fate', 'Das ist dein Schicksal.', 'READING_PROHIBITED_WORDING'],
    ['an unapproved method', 'Dein Tagesmeister ist verwurzelt.', 'READING_PROHIBITED_WORDING'],
  ] as const)('refuses a revision that injects %s', (_name, sentence, code) => {
    expectRefusal(edit((r) => { paragraph(r, 1, 4).text += ` ${sentence}`; }), code);
  });

  it('refuses a revision of the method note: the disclosure stays as accepted', () => {
    const error = expectRefusal(edit((r) => { r.methodNote.text = 'BaZi ist ein traditionelles chinesisches Symbolsystem.'; }), 'READING_EDITORIAL_EXPANSION');
    expect(error.detail).toEqual({ path: 'reading.methodNote.text' });
  });

  it('refuses a revision that rebinds a reflection question', () => {
    const question = baseline.reflectionQuestions[0] as { claimRefs: string[] };
    const other = paragraph(baseline, 3, 2).claimRefs[0] as string;
    expect(question.claimRefs).not.toContain(other);
    const error = expectRefusal(edit((r) => { (r.reflectionQuestions[0] as { claimRefs: string[] }).claimRefs.push(other); }), 'READING_EDITORIAL_EXPANSION');
    expect(error.detail).toEqual({ path: 'reading.reflectionQuestions[0].claimRefs.length' });
  });

  it('refuses a revision that changes the kind of a callback', () => {
    expect(chapter(baseline, 4).callbacks[0]?.deltaKind).toBe('NEW_QUALIFICATION');
    const error = expectRefusal(edit((r) => { (chapter(r, 4).callbacks[0] as { deltaKind: string }).deltaKind = 'NEW_CONTEXT'; }), 'READING_EDITORIAL_EXPANSION');
    expect(error.detail).toEqual({ path: 'reading.chapters[4].callbacks[0].deltaKind' });
  });

  it('refuses a revision that changes a semantic delta', () => {
    expect(chapter(baseline, 4).semanticDelta[0]?.kind).toBe('NEW_QUALIFICATION');
    const error = expectRefusal(edit((r) => { (chapter(r, 4).semanticDelta[0] as { kind: string }).kind = 'NEW_CONTEXT'; }), 'READING_EDITORIAL_EXPANSION');
    expect(error.detail).toEqual({ path: 'reading.chapters[4].semanticDelta[0].kind' });
  });

  it('is version-neutral: it accepts a text-only revision of a 1.0.0 reading and refuses a structural one', () => {
    const released = skillFixture();
    const releasedContext = { bundle: released.bundle, inputPackage: released.inputPackage };
    const accepted = acceptSkillReading(oldReading, releasedContext);
    const retitled = acceptEditorialRevision(accepted, readingWith((r) => { r.title = 'Dein BaZi-Reading: ein neuer Titel'; }, oldReading), releasedContext);
    expect(retitled.skillRef).toBe('bazodiac-interpretation-skill@1.0.0');
    expectRefusal(() => acceptEditorialRevision(accepted, readingWith((r) => { r.visualizationSpecs.pop(); }, oldReading), releasedContext), 'READING_EDITORIAL_EXPANSION');
  });

  it('refuses fate in the method note, which is otherwise free of the narrative gates', () => {
    expectRefusal(() => accept(readingWith((r) => { r.methodNote.text += ' Das ist dein Schicksal.'; })), 'READING_PROHIBITED_WORDING');
  });

  it('refuses a "semantic" reading that is not the accepted reading it claims to be', () => {
    const forged = { ...semantic(), title: 'Ein anderer Titel' };
    expectRefusal(() => acceptEditorialRevision(forged, baseline, context), 'READING_EDITORIAL_EXPANSION');
  });
});

describe('V7: a candidate bundle runs evaluations only', () => {
  it('builds the 1.1.0 bundle as a frozen candidate that is not released', () => {
    expect(() => assertCandidateSkillContractBundle(bundle)).not.toThrow();
    expect(() => assertReleasedSkillContractBundle(bundle)).toThrow(SkillContractError);
  });

  it('refuses a package for a released run under the candidate bundle', () => {
    const released = skillFixture();
    expect(() => buildSkillInputPackage({
      bundle,
      input: fixture.input,
      graph: fixture.graph,
      plan: fixture.plan,
      subject: inputPackage.subject,
      allowedSlotIds: listSlotIds(),
    })).toThrow(SkillContractError);
    expect(() => assertCandidateSkillContractBundle(released.bundle)).toThrow(SkillContractError);
  });

  it('refuses a CANDIDATE contract in a bundle version that is not a candidate', () => {
    const core: SkillContractBundleCore = { ...buildSkillContractBundle(), contracts: buildSkillContractBundle().contracts.map((source) => (source.key === 'INTERPRETATION_LENS' ? { ...source, status: 'CANDIDATE', releasedOn: null } : source)) };
    expect(() => validateSkillContractBundleCore(core, BAZI_METHOD_REGISTRY_V1)).toThrow(/DRAFT_CONTRACT_REFUSED|status "CANDIDATE"/u);
  });

  it('refuses a CANDIDATE contract that claims a decision date, and a CURRENT one without', () => {
    const base = buildSkillContractBundle(undefined, '1.1.0');
    const dated: SkillContractBundleCore = { ...base, contracts: base.contracts.map((source) => (source.status === 'CANDIDATE' ? { ...source, releasedOn: '2026-10-01' } : source)) };
    expect(() => validateSkillContractBundleCore(dated, BAZI_METHOD_REGISTRY_V1)).toThrow(SkillContractError);
    const undated: SkillContractBundleCore = { ...base, contracts: base.contracts.map((source) => (source.key === 'METHOD_PROFILE' ? { ...source, releasedOn: null } : source)) };
    expect(() => validateSkillContractBundleCore(undated, BAZI_METHOD_REGISTRY_V1)).toThrow(SkillContractError);
  });

  it('accepts the portable candidate copy only for an evaluation run, and only as itself', () => {
    const portable = JSON.parse(renderPortableSkillContractBundle(bundle)) as Json;
    expect(contractRefusal(() => acceptPortableSkillContractBundle(portable)).code).toBe('BUNDLE_NOT_RELEASED');
    expect(acceptPortableSkillContractBundle(portable, undefined, { candidateEvaluation: true }).structuralHash).toBe(bundle.structuralHash);
  });

  it('refuses a portable copy of a bundle version this repository does not build, as such', () => {
    const releasedPortable = JSON.parse(renderPortableSkillContractBundle(skillFixture().bundle)) as Json;
    for (const bundleVersion of ['9.9.9', 'constructor', 'toString']) {
      const error = contractRefusal(() => acceptPortableSkillContractBundle({ ...releasedPortable, bundleVersion, bundleRef: `bazodiac-skill-contract-bundle@${bundleVersion}` }));
      expect(error.code).toBe('BUNDLE_SCHEMA_INVALID');
      expect(error.message).toMatch(/is not a version this repository builds/u);
    }
    // A candidate copy under an unknown version is refused as unknown, not as a draft.
    const candidatePortable = JSON.parse(renderPortableSkillContractBundle(bundle)) as Json;
    const unknown = contractRefusal(() => acceptPortableSkillContractBundle({ ...candidatePortable, bundleVersion: '9.9.9', bundleRef: 'bazodiac-skill-contract-bundle@9.9.9' }, undefined, { candidateEvaluation: true }));
    expect(unknown.code).toBe('BUNDLE_SCHEMA_INVALID');
  });

  it('runs no Skill under a bundle version it does not know', () => {
    for (const bundleVersion of ['9.9.9', 'constructor', 'toString']) {
      expectRefusal(() => skillRefForBundle(bundleVersion), 'PACKAGE_BINDING_MISMATCH');
    }
  });

  it('refuses a reading under the candidate bundle without the evaluation opt-in', () => {
    const error = expectRefusal(() => acceptSkillReading(baseline, { bundle, inputPackage }), 'READING_BUNDLE_MISMATCH');
    expect(error.message).toMatch(/candidate/u);
  });

  it('refuses a 1.1.0 reading under the 1.0.0 bundle and a 1.0.0 reading under the 1.1.0 bundle', () => {
    const released = skillFixture();
    expectRefusal(() => acceptSkillReading(baseline, { bundle: released.bundle, inputPackage: released.inputPackage }), 'READING_SKILL_MISMATCH');
    expectRefusal(() => accept(oldReading), 'READING_SKILL_MISMATCH');
  });
});
