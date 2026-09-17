/**
 * ETBZ-34 negative path — PD-10 on the EXISTING narrative chain.
 *
 * With birth_time_known=false FuFirE still computes a concrete hour pillar, from
 * an assumed time of day (canonical contract Confluence BG 62259202: the
 * producer's noon normalisation, "never a claimed birth time"). That pillar may
 * not reach a customer sentence — not even with an uncertainty note attached.
 */
import { describe, expect, it } from 'vitest';
import { composeDeterministicNarrative } from '../../src/application/interpretation/deterministic-narrative-provider.js';
import { ReportError } from '../../src/application/interpretation/errors.js';
import { buildNarrativeChain } from '../../src/application/interpretation/narrative-brief.js';
import { buildReportModel } from '../../src/application/interpretation/report-model.js';
import { knownTimeModel, unknownTimeModel } from '../support/narrativeFixture.js';

interface MutableOutput {
  providerId: string;
  briefStructuralHash: string;
  sections: { themeId: string; citedFacts: { factId: string; value: string }[]; prose: string; uncertaintyNotes: string[] }[];
}

const KNOWN = knownTimeModel();
const UNKNOWN = unknownTimeModel();
const KNOWN_CHAIN = buildNarrativeChain(KNOWN);
const UNKNOWN_CHAIN = buildNarrativeChain(UNKNOWN);
const HOUR_TEN_GOD = 'chart.natal.pillar.hour.tenGod';

describe('ETBZ-34 X1: the assumed-time-derived hour pillar never reaches the narrative', () => {
  it('offers the provider no hour fact in any theme of an unknown-time brief', () => {
    const offered = [
      ...UNKNOWN_CHAIN.brief.candidateThemes.flatMap((theme) => theme.factIds),
      ...UNKNOWN_CHAIN.brief.primaryThemes.flatMap((theme) => theme.factIds),
    ];
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.filter((id) => id.includes('.hour.'))).toEqual([]);
  });

  it('still offers hour facts when the birth time is known (counterfactual)', () => {
    const offered = KNOWN_CHAIN.brief.primaryThemes.flatMap((theme) => theme.factIds);
    expect(offered.some((id) => id.includes('.hour.'))).toBe(true);
  });

  it('the deterministic provider consequently cites no hour fact for unknown time', () => {
    const output = composeDeterministicNarrative(UNKNOWN_CHAIN.brief);
    expect(output.sections.flatMap((section) => section.citedFacts.map((fact) => fact.factId)).filter((id) => id.includes('.hour.'))).toEqual([]);
  });

  it('refuses a provider that cites an hour fact anyway — even WITH an uncertainty note', () => {
    const output = structuredClone(composeDeterministicNarrative(UNKNOWN_CHAIN.brief)) as unknown as MutableOutput;
    const section = output.sections.find((candidate) => candidate.themeId === 'primary.positional_context');
    if (section === undefined) throw new Error('fixture defect: no positional_context section');
    const hour = UNKNOWN_CHAIN.brief.facts.find((fact) => fact.id === HOUR_TEN_GOD);
    if (hour === undefined) throw new Error('fixture defect: hour Ten God fact missing from the evidence');
    section.citedFacts.push({ factId: hour.id, value: hour.value });
    section.uncertaintyNotes.push('Die Geburtszeit ist unbekannt.');

    try {
      buildReportModel({ model: UNKNOWN, brief: UNKNOWN_CHAIN.brief, providerOutput: output });
    } catch (error) {
      expect(error).toBeInstanceOf(ReportError);
      expect((error as ReportError).code).toBe('REPORT_EXCLUDED_FACT_CITED');
      return;
    }
    expect.unreachable('an assumed-time-derived fact must not be narratable');
  });

  it('keeps the hour facts in the report as flagged evidence, not as deletions', () => {
    const report = buildReportModel({
      model: UNKNOWN,
      brief: UNKNOWN_CHAIN.brief,
      providerOutput: composeDeterministicNarrative(UNKNOWN_CHAIN.brief),
    });
    const hourFacts = report.facts.chart.filter((fact) => fact.pillar === 'hour');
    expect(hourFacts.length).toBeGreaterThan(0);
    expect(hourFacts.every((fact) => !fact.interpretable && fact.provisional)).toBe(true);
    // Uncertainty is carried, never narrowed: every excluded fact is provisional.
    for (const fact of hourFacts) expect(report.uncertainty.provisionalFactIds).toContain(fact.id);
  });
});
