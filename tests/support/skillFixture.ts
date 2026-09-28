/**
 * ETBZ-52 — shared fixture for the Skill run suites.
 *
 * The package a Skill run is handed comes from the real chain end to end:
 * `knownTimeChart` -> `buildBazodiacInterpretationInput` (through the adapter's
 * own response mapper) -> `buildInterpretiveClaimGraph` -> `buildMetaNarrativePlan`
 * -> `buildSkillContractBundle` -> `buildSkillInputPackage`. Nothing here can
 * drift from what the reading is accepted against. The slot ids come from the
 * visual contract, which the skill module itself may not import — a test may.
 */
import { fufireResponseMapper } from '../../src/adapters/fufire/http-client.js';
import { buildBazodiacInterpretationInput } from '../../src/application/interpretation/interpretation-input.js';
import type { BazodiacInterpretationInput } from '../../src/application/interpretation/interpretation-input.js';
import type { InterpretiveClaimGraph } from '../../src/application/interpretation/interpretive-claim-graph.js';
import { buildMetaNarrativePlan } from '../../src/application/interpretation/meta-narrative-plan.js';
import type { MetaNarrativePlan } from '../../src/application/interpretation/meta-narrative-plan.js';
import { buildSkillContractBundle, buildSkillInputPackage } from '../../src/application/skill/index.js';
import type { SkillContractBundle, SkillInputPackage } from '../../src/application/skill/index.js';
import { listSlotIds } from '../../src/application/visual/index.js';
import { contextFor } from './claimGraphFixture.js';
import { graphFor, planContextFor, validPlanDraft } from './metaNarrativePlanFixture.js';
import { knownTimeChart } from './narrativeFixture.js';

export interface SkillFixture {
  readonly bundle: SkillContractBundle;
  readonly input: BazodiacInterpretationInput;
  readonly graph: InterpretiveClaimGraph;
  readonly plan: MetaNarrativePlan;
  readonly inputPackage: SkillInputPackage;
}

/** The known-time fixture chart through the whole chain, ending in the Skill input package. */
export function skillFixture(): SkillFixture {
  const chart = knownTimeChart();
  const input = buildBazodiacInterpretationInput(chart.model, chart.source, { mapper: fufireResponseMapper });
  const context = contextFor(chart.model);
  const graph = graphFor(context);
  const planContext = planContextFor(context, graph);
  const plan = buildMetaNarrativePlan(validPlanDraft(planContext), planContext);
  const bundle = buildSkillContractBundle();
  const inputPackage = buildSkillInputPackage({
    bundle,
    input,
    graph,
    plan,
    subject: { displayName: chart.model.displayName, birthTimeKnown: chart.model.precision.birthTimeKnown },
    allowedSlotIds: listSlotIds(),
  });
  return { bundle, input, graph, plan, inputPackage };
}
