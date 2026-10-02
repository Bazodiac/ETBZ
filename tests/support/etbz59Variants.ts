/**
 * ETBZ-59 — the synthetic charts of the Anti-Boilerplate fixture rehearsal (contract 77266967 v3, section 8; Product
 * Owner decisions D-53-6 and D-53-7, Jira ETBZ-53 comment 17031; D-59-1/D-59-2, Jira ETBZ-59 comment 17034).
 *
 * The source chart S is Musterkundin A (`KNOWN_BIRTH`), replayed from the ETBZ-58 live record: the same FuFirE
 * runtime and the same recorded bytes. Two variants are computed live by FuFirE through the ETBZ-58 live stage and
 * recorded here; nothing about a chart is set by hand:
 *
 * - N, the near-neighbour chart: `KNOWN_BIRTH` with the birth time in the neighbouring two-hour block. FuFirE reads
 *   civil time (`time_standard_used: CIVIL`), so 14:30 is the Wei block and 16:30 the Shen block; the named
 *   difference is the hour pillar. N also serves as the fact-mutation case (6.3).
 * - D, the distant foil: `KNOWN_BIRTH` with only the date moved, to 1974-09-24 (same 14:30, so the hour branch is
 *   shared and nothing else of the pillars). Chart only; no reading of D is made.
 *
 * Every variant is synthetic, marked so in its display name and its record, and committed like the fixture itself.
 * The removal case S⁻ is not a FuFirE call: it withdraws facts from S through `withdrawFactsForEvaluation` (D-59-1).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HoroscopeModel } from '../../src/application/horoscope-model.js';
import type { BazodiacInterpretationInput, ProducerSnapshots } from '../../src/application/interpretation/interpretation-input.js';
import {
  EXCHANGE_LABELS,
  loadRecordedRun,
  replayInterpretationInput,
} from './etbz58Rehearsal.js';
import type { ExchangeLabel, RuntimeReadback } from './etbz58Rehearsal.js';
import { KNOWN_BIRTH } from './narrativeFixture.js';

export const ETBZ59_DIR = 'docs/evidence/etbz-59';

export const VARIANT_LABELS = ['near', 'distant'] as const;
export type VariantLabel = (typeof VARIANT_LABELS)[number];

/** The synthetic BirthInputs of the variants: `KNOWN_BIRTH` with exactly the named field changed. */
export const VARIANT_BIRTH_INPUTS: Readonly<Record<VariantLabel, Readonly<Record<string, unknown>>>> = {
  near: { ...KNOWN_BIRTH, displayName: 'Variante N (synthetisch)', birthTime: '16:30' },
  distant: { ...KNOWN_BIRTH, displayName: 'Variante D (synthetisch)', birthDate: '1974-09-24' },
};

/** What each variant changes against `KNOWN_BIRTH`, and why (recorded with the run). */
export const VARIANT_DEFINITIONS: Readonly<Record<VariantLabel, Readonly<{ ref: string; change: string; role: string }>>> = {
  near: {
    ref: 'tests/support/etbz59Variants.ts#VARIANT_BIRTH_INPUTS.near',
    change: 'birthTime 14:30 -> 16:30 (civil time: Wei block -> Shen block); displayName marks the synthetic variant',
    role: 'near-neighbour chart N (6.1, 6.2) and fact-mutation case (6.3); named difference: the hour pillar and the Wu Xing tally it feeds (N ties Feuer and Metall at the top)',
  },
  distant: {
    ref: 'tests/support/etbz59Variants.ts#VARIANT_BIRTH_INPUTS.distant',
    change: 'birthDate 1990-06-15 -> 1974-09-24 (same 14:30); displayName marks the synthetic variant',
    role: 'distant foil D (6.1 blind attribution, 6.2 swap); chart only',
  },
};

export const variantDir = (label: VariantLabel): string => `${ETBZ59_DIR}/variants/${label}`;
export const variantReadbackFile = (label: VariantLabel): string => `${variantDir(label)}/runtime-readback.json`;
export const variantResponseFile = (label: VariantLabel, exchange: ExchangeLabel): string => `${variantDir(label)}/fufire/${exchange}.response.json`;

/**
 * The readback as committed for a variant: the ETBZ-58 live stage names its own response paths; a variant's
 * exchanges point to the variant's files instead. The replay reads path, request and response digests and length,
 * never this field.
 */
export function variantReadback(label: VariantLabel, readback: RuntimeReadback): RuntimeReadback {
  return { ...readback, exchanges: readback.exchanges.map((exchange) => ({ ...exchange, responseFile: variantResponseFile(label, exchange.label) })) };
}

export function loadVariantRun(label: VariantLabel, root: string = process.cwd()): { readback: RuntimeReadback; responses: Record<ExchangeLabel, Uint8Array> } {
  const readback = JSON.parse(readFileSync(resolve(root, variantReadbackFile(label)), 'utf8')) as RuntimeReadback;
  const responses = Object.fromEntries(
    EXCHANGE_LABELS.map((exchange) => [exchange, new Uint8Array(readFileSync(resolve(root, variantResponseFile(label, exchange))))]),
  ) as Record<ExchangeLabel, Uint8Array>;
  return { readback, responses };
}

export interface ReplayedChart {
  readonly model: HoroscopeModel;
  readonly input: BazodiacInterpretationInput;
  readonly source: ProducerSnapshots;
}

/** S: Musterkundin A, replayed from the ETBZ-58 live record (same runtime, same recorded bytes). */
export async function sourceChart(root: string = process.cwd()): Promise<ReplayedChart> {
  const { readback, responses } = loadRecordedRun(root);
  return replayInterpretationInput(readback, responses);
}

/** A variant, replayed offline from its committed record through the same client and use case. */
export async function variantChart(label: VariantLabel, root: string = process.cwd()): Promise<ReplayedChart> {
  const { readback, responses } = loadVariantRun(label, root);
  return replayInterpretationInput(readback, responses, VARIANT_BIRTH_INPUTS[label]);
}
