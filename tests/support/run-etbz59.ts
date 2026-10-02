/**
 * ETBZ-59 — the operator command of the Anti-Boilerplate fixture rehearsal (`npm run etbz59 -- <command>`, under
 * `vite-node`). Offline; the variants were recorded by `npm run etbz59:variants`.
 *
 *   emit                  writes each case's Skill input package to docs/evidence/etbz-59/cases/<label>/skill-input.json
 *   accept <label>        runs the acceptance boundary on the case's REALISE reading (semantic-reading.json) and, when
 *                         present, its EDIT revision (skill-reading.json); writes accepted-reading.json when both pass
 *
 * Prints codes, paths and hashes only.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { acceptEditorialRevision, acceptSkillReading } from '../../src/application/skill/index.js';
import { renderJson, readJsonFile } from './etbz58Rehearsal.js';
import { CASE_LABELS, ETBZ59_CONES, NEAR_CONTRADICTION_TERMS, REMOVED_FACT_IDS, RESCUE_POSITION_TERMS, RESCUE_SUBJECT_TERMS, RESCUE_TERMS_WHY, caseFile, deriveCase } from './etbz59Cases.js';
import type { CaseLabel, CaseRun } from './etbz59Cases.js';
import { dependencyCone, namedDifference } from './etbz59Individuality.js';
import type { Cone } from './etbz59Individuality.js';

const write = (path: string, data: string): void => {
  const out = resolve(process.cwd(), path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, data);
};
const codeOf = (error: unknown): string => (typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : 'THREW');

const [command, argument] = process.argv.slice(2);
if (command === 'emit') {
  for (const label of CASE_LABELS) {
    const run = await deriveCase(label);
    write(caseFile(label, 'skill-input'), renderJson(run.inputPackage));
    process.stdout.write(`${label}: package ${run.inputPackage.structuralHash} · graph ${run.graph.structuralHash} · plan ${run.plan.structuralHash}\n`);
  }
} else if (command === 'accept' && (CASE_LABELS as readonly string[]).includes(argument ?? '')) {
  const label = argument as CaseLabel;
  const run = await deriveCase(label);
  const context = { bundle: run.bundle, inputPackage: run.inputPackage };
  try {
    const semantic = acceptSkillReading(readJsonFile(caseFile(label, 'semantic-reading')), context);
    process.stdout.write(`${label}: REALISE accepted ${semantic.structuralHash}\n`);
    if (existsSync(resolve(process.cwd(), caseFile(label, 'skill-reading')))) {
      const accepted = acceptEditorialRevision(semantic, readJsonFile(caseFile(label, 'skill-reading')), context);
      write(caseFile(label, 'accepted-reading'), renderJson(accepted));
      process.stdout.write(`${label}: EDIT accepted ${accepted.structuralHash}\n`);
    }
  } catch (error) {
    const path = (error as { path?: unknown }).path;
    process.stdout.write(`${label}: REFUSED ${codeOf(error)}${typeof path === 'string' ? ` at ${path}` : ''}: ${error instanceof Error ? error.message : ''}\n`);
    // D-59-4: the whole list one full pass found - what the operator hands to the one repair.
    const diagnostics = (error as { diagnostics?: readonly Error[] }).diagnostics ?? [];
    for (const entry of diagnostics) process.stdout.write(`  - ${entry.message}\n`);
    process.exitCode = 1;
  }
} else if (command === 'cones') {
  // Contract 6.3 step 1 and section 8.2: the cones are listed BEFORE the readings exist (committed first).
  const [s, n, r] = [await deriveCase('source'), await deriveCase('near'), await deriveCase('removal')];
  const delta = namedDifference(s.model, n.model);
  const describe = (cone: Cone, run: CaseRun): unknown => ({
    ...cone,
    claimStatements: cone.claims.map((id) => run.graph.claims.find((claim) => claim.claimId === id)?.statement ?? null),
  });
  write(ETBZ59_CONES, renderJson({
    recordVersion: 'etbz59-pre-run-cones.v1',
    note: 'written before any reading of the three cases exists; the readings are judged against these cones',
    nearNeighbourDifference: { variant: 'near', factIds: delta },
    nearNeighbourAndMutationCone: describe(dependencyCone(s, delta), s),
    removal: { factIds: [...REMOVED_FACT_IDS], cone: describe(dependencyCone(s, REMOVED_FACT_IDS), s) },
    rescueTerms: { subjectTerms: [...RESCUE_SUBJECT_TERMS], positionTerms: [...RESCUE_POSITION_TERMS], why: RESCUE_TERMS_WHY },
    nearContradictionTerms: { terms: [...NEAR_CONTRADICTION_TERMS], why: 'N ties Feuer and Metall at the top; FuFirE still names Feuer dominant (a tie-break the tie claim does not cite), so prose naming one leading element contradicts the tie claim (draft review round 2, G3)' },
    graphs: { source: s.graph.structuralHash, near: n.graph.structuralHash, removal: r.graph.structuralHash },
    plans: { source: s.plan.structuralHash, near: n.plan.structuralHash, removal: r.plan.structuralHash },
  }));
  process.stdout.write(`cones written: |delta|=${String(delta.length)}\n`);
} else {
  process.stderr.write('usage: etbz59 emit | cones | accept <source|near|removal>\n');
  process.exitCode = 2;
}
