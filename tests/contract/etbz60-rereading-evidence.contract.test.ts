/**
 * ETBZ-60 — the committed evidence of both re-reading rounds under READING_POSITION_UNGROUNDED (PO decisions D-59-5,
 * D-59-6, D-60-1). For each round, every reading passes this boundary to its committed accepted bytes and carries no
 * position statement. The judge read exactly the packet the accepted readings derive, and every quote of the judgement
 * stands at its path. Round 1 (the boundary repair alone) keeps the BLOCKING STOCK_PARAGRAPH_REUSE its judge raised;
 * round 2 (the graph grounds the surface) raises no BLOCKING code. The Skill package and the bundle are those ETBZ-57
 * released: nothing under skill/ changed against e5ccc94c.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { INDIVIDUALITY_REASON_CODES, findPositionStatement } from '../../src/application/skill/index.js';
import { renderJson } from '../support/etbz58Rehearsal.js';
import { ETBZ60_LABELS, ETBZ60_RECORD, ETBZ60_ROUNDS, acceptCase, caseFile, deriveJudgePacket, deriveRereadingRecord, deriveRoundCase, judgeDir, judgementsFile, roundDir } from '../support/etbz60Rereading.js';
import type { Etbz60Label, Etbz60Round } from '../support/etbz60Rereading.js';

vi.setConfig({ testTimeout: 60_000 });

const read = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');
type Reading = { chapters: { paragraphs: { text: string }[] }[] };
interface Quote { readonly case: Etbz60Label; readonly path: string; readonly text: string }
interface Judgement { readonly check?: string; readonly subject: string; readonly verdict: string; readonly codes: readonly string[]; readonly quotes: readonly Quote[] }
interface Judgements { readonly judge: { packet: readonly string[]; toolCalls: string }; readonly judgements: readonly Judgement[]; readonly outsideContract: readonly Judgement[] }

const blockingOf = (judgements: Judgements): string[] => judgements.judgements.flatMap((entry) => entry.codes).filter((code) => INDIVIDUALITY_REASON_CODES.find((known) => known.code === code)?.class === 'BLOCKING');
const CASES = ETBZ60_ROUNDS.flatMap((round) => ETBZ60_LABELS.map((label) => [round, label] as const));

describe('ETBZ-60: the re-readings', () => {
  it.each(CASES)('%s %s: REALISE and EDIT accepted by this boundary, to the committed accepted reading', async (round, label) => {
    const { edited } = acceptCase(round, label, await deriveRoundCase(round, label));
    expect(edited).not.toBeNull();
    expect(renderJson(edited)).toBe(read(caseFile(round, label, 'accepted-reading')));
  });

  it.each(CASES)('%s %s: every statement of the chart\'s positions as a whole stands in a paragraph that cites every pillar', async (round, label) => {
    const run = await deriveRoundCase(round, label);
    const pillarOf = new Map(run.inputPackage.facts.map((fact) => [fact.id, fact.pillar]));
    const claimFacts = new Map(run.graph.claims.map((claim) => [claim.claimId, claim.factRefs]));
    const reading = JSON.parse(read(caseFile(round, label, 'accepted-reading'))) as { chapters: { paragraphs: { text: string; factRefs: string[]; claimRefs: string[] }[] }[] };
    const statements = reading.chapters.flatMap((chapter) => chapter.paragraphs).filter((paragraph) => findPositionStatement(paragraph.text) !== null);
    for (const paragraph of statements) {
      const facts = [...paragraph.factRefs, ...paragraph.claimRefs.flatMap((id) => claimFacts.get(id) ?? [])];
      expect([...new Set(facts.map((id) => pillarOf.get(id)))].filter((pillar) => pillar !== null && pillar !== undefined).sort(), findPositionStatement(paragraph.text) ?? '').toEqual(['day', 'hour', 'month', 'year']);
    }
    // Round 1's drafts cite no pillar's surface beyond the month's, so its readings carry no position statement at all.
    if (round === 'round-1') expect(statements).toEqual([]);
  });

  it('re-derives the run record byte for byte from the committed files', async () => {
    expect(renderJson(await deriveRereadingRecord())).toBe(read(ETBZ60_RECORD));
  });

  it('changes nothing under skill/ against e5ccc94c: Skill 1.1.0 and bundle 1.1.0 stay as ETBZ-57 released them (D-59-6)', () => {
    expect(() => execFileSync('git', ['diff', '--quiet', 'e5ccc94c52abef01c7e1d537f4bb4575095d0be3', '--', 'skill/'])).not.toThrow();
  });
});

describe.each(ETBZ60_ROUNDS)('ETBZ-60 %s: the independent 6.7 judgement', (round: Etbz60Round) => {
  const judgements = (): Judgements => JSON.parse(read(judgementsFile(round))) as Judgements;

  it('re-derives every file the judge read, byte for byte, from the accepted readings and the validated charts', async () => {
    const packet = await deriveJudgePacket(round);
    expect(Object.keys(packet).sort()).toEqual([...judgements().judge.packet].map((file) => file.replace('judge/', '')).sort());
    for (const [file, content] of Object.entries(packet)) expect(read(`${judgeDir(round)}/${file}`), file).toBe(content);
  });

  it('shows the judge reading its packet and nothing else, with the Read tool only', () => {
    const { judge } = judgements();
    const calls = read(`${roundDir(round)}/${judge.toolCalls}`).trim().split('\n');
    expect(calls.map((call) => call.split(' ')[0])).toEqual(judge.packet.map(() => 'Read'));
    expect(calls.map((call) => `judge/${call.split('/judge/')[1] ?? ''}`).sort()).toEqual([...judge.packet].sort());
  });

  it('finds every quote verbatim at its path in the accepted reading', () => {
    const quotes = [...judgements().judgements, ...judgements().outsideContract].flatMap((entry) => entry.quotes);
    expect(quotes.length).toBeGreaterThan(0);
    for (const quote of quotes) {
      const match = /^chapters\[(\d+)\]\.paragraphs\[(\d+)\]$/u.exec(quote.path);
      const reading = JSON.parse(read(caseFile(round, quote.case, 'accepted-reading'))) as Reading;
      const text = match === null ? '' : reading.chapters[Number(match[1])]?.paragraphs[Number(match[2])]?.text ?? '';
      expect(text, `${quote.case} ${quote.path}`).toContain(quote.text);
    }
  });

  it('uses only 6.7 codes, a PASS exactly where no code is raised', () => {
    for (const entry of judgements().judgements) {
      expect(entry.check, entry.subject).toBe('6.7');
      for (const code of entry.codes) expect(INDIVIDUALITY_REASON_CODES.find((known) => known.code === code)?.checks, code).toContain('6.7');
      expect(entry.verdict === 'PASS', entry.subject).toBe(entry.codes.length === 0);
    }
  });

  it(round === 'round-1' ? 'keeps the BLOCKING code its judge raised (the boundary repair alone did not close the class)' : 'raises no BLOCKING code (AC5)', () => {
    expect(blockingOf(judgements())).toEqual(round === 'round-1' ? ['STOCK_PARAGRAPH_REUSE'] : []);
  });
});
