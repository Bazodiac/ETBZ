/**
 * ETBZ-60 — the operator command of the re-readings (`npm run etbz60 -- <command>`, under `vite-node`). Offline.
 *
 *   emit                         writes round 2's Skill input packages (round-2/cases/<label>/skill-input.json)
 *   cones                        writes round 2's pre-run cones, BEFORE any round-2 reading exists
 *   accept <round> <label>       runs the acceptance boundary on the case's REALISE reading and, when present, its
 *                                EDIT revision; writes accepted-reading.json when both pass
 *   packet <round>               writes the round's judge packet (<round>/judge/) from the accepted readings
 *   record                       re-derives docs/evidence/etbz-60/rereading-record.json from the committed files
 *
 * Prints codes, paths and hashes only.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { renderJson } from './etbz58Rehearsal.js';
import { dependencyCone, namedDifference } from './etbz59Individuality.js';
import { SURFACE_CLAIM_ID, SURFACE_FACT_IDS, SURFACE_STATEMENTS } from './etbz60Cases.js';
import { ETBZ60_LABELS, ETBZ60_RECORD, ETBZ60_ROUNDS, ROUND2_CONES, acceptCase, caseFile, deriveJudgePacket, deriveRereadingRecord, deriveRoundCase, judgeDir } from './etbz60Rereading.js';
import type { Etbz60Label, Etbz60Round } from './etbz60Rereading.js';

const write = (path: string, data: string): void => {
  const out = resolve(process.cwd(), path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, data);
};
const codeOf = (error: unknown): string => (typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : 'THREW');
const isRound = (value: string | undefined): value is Etbz60Round => (ETBZ60_ROUNDS as readonly string[]).includes(value ?? '');
const isLabel = (value: string | undefined): value is Etbz60Label => (ETBZ60_LABELS as readonly string[]).includes(value ?? '');

const [command, first, second] = process.argv.slice(2);
if (command === 'emit') {
  for (const label of ETBZ60_LABELS) {
    const run = await deriveRoundCase('round-2', label);
    write(caseFile('round-2', label, 'skill-input'), renderJson(run.inputPackage));
    process.stdout.write(`${label}: package ${run.inputPackage.structuralHash} · graph ${run.graph.structuralHash} · plan ${run.plan.structuralHash}\n`);
  }
} else if (command === 'cones') {
  // Contract 6.3 step 1 and section 8.2: the cones are listed BEFORE the round-2 readings exist (committed first).
  const [s, n] = [await deriveRoundCase('round-2', 'source'), await deriveRoundCase('round-2', 'near')];
  const delta = namedDifference(s.model, n.model);
  const cone = dependencyCone(s, delta);
  write(ROUND2_CONES, renderJson({
    recordVersion: 'etbz60-round2-pre-run-cones.v1',
    note: 'written before any round-2 reading exists; the round-2 readings are judged against these cones (PO decision D-60-1)',
    surfaceClaim: { claimId: SURFACE_CLAIM_ID, factIds: [...SURFACE_FACT_IDS], statements: SURFACE_STATEMENTS },
    nearNeighbourDifference: { variant: 'near', factIds: delta },
    nearNeighbourCone: { ...cone, claimStatements: cone.claims.map((id) => s.graph.claims.find((claim) => claim.claimId === id)?.statement ?? null) },
    graphs: { source: s.graph.structuralHash, near: n.graph.structuralHash },
    plans: { source: s.plan.structuralHash, near: n.plan.structuralHash },
    packages: { source: s.inputPackage.structuralHash, near: n.inputPackage.structuralHash },
  }));
  process.stdout.write(`cones written: ${ROUND2_CONES} (cone ${String(cone.claims.length)} claims)\n`);
} else if (command === 'accept' && isRound(first) && isLabel(second)) {
  try {
    const { semantic, edited } = acceptCase(first, second, await deriveRoundCase(first, second));
    process.stdout.write(`${first} ${second}: REALISE accepted ${semantic.structuralHash}\n`);
    if (edited !== null) {
      write(caseFile(first, second, 'accepted-reading'), renderJson(edited));
      process.stdout.write(`${first} ${second}: EDIT accepted ${edited.structuralHash}\n`);
    }
  } catch (error) {
    process.stdout.write(`${first} ${second}: REFUSED ${codeOf(error)}: ${error instanceof Error ? error.message : ''}\n`);
    const diagnostics = (error as { diagnostics?: readonly (Error & { detail?: unknown })[] }).diagnostics ?? [];
    for (const entry of diagnostics) process.stdout.write(`  - ${entry.message} ${JSON.stringify(entry.detail ?? {})}\n`);
    process.exitCode = 1;
  }
} else if (command === 'packet' && isRound(first)) {
  const files = await deriveJudgePacket(first);
  for (const [path, content] of Object.entries(files)) write(`${judgeDir(first)}/${path}`, content);
  process.stdout.write(`judge packet written: ${String(Object.keys(files).length)} files under ${judgeDir(first)}\n`);
} else if (command === 'record') {
  write(ETBZ60_RECORD, renderJson(await deriveRereadingRecord()));
  process.stdout.write(`record written: ${ETBZ60_RECORD}\n`);
} else {
  process.stderr.write('usage: etbz60 emit | cones | accept <round-1|round-2> <source|near> | packet <round-1|round-2> | record\n');
  process.exitCode = 2;
}
