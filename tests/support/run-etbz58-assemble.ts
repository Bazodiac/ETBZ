/**
 * ETBZ-58 — the operator command of the offline stages (`npm run etbz58:assemble -- <mode> ...`, under
 * `vite-node`). Not a test file. Every mode starts from the committed live stage, replayed.
 *
 *   check-realise <reading.json>              runs acceptSkillReading on a REALISE reading; prints ACCEPTED or the
 *                                             refusal code and path (wrapper step 5: the operator runs the boundary)
 *   check-edit <realise.json> <edit.json>     the same for the EDIT revision (acceptEditorialRevision)
 *   assemble                                  the committed readings -> accepted reading + PresentationProjection
 *   seal                                      after the renderer and the visual verdict: the run record
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SkillRunError, acceptEditorialRevision, acceptSkillReading } from '../../src/application/skill/index.js';
import {
  ETBZ58_ACCEPTED_READING,
  ETBZ58_PROJECTION,
  ETBZ58_RECORD,
  ETBZ58_SEMANTIC_READING,
  ETBZ58_SKILL_READING,
  assembleRehearsal,
  deriveRehearsalInput,
  deriveRehearsalRecord,
  loadRecordedRun,
  readJsonFile,
  renderJson,
} from './etbz58Rehearsal.js';

const [mode, first, second] = process.argv.slice(2);
const { readback, responses } = loadRecordedRun();
const rehearsal = await deriveRehearsalInput(readback, responses);
const context = { bundle: rehearsal.bundle, inputPackage: rehearsal.inputPackage };

const report = (action: () => { structuralHash: string }): void => {
  try {
    process.stdout.write(`ACCEPTED ${action().structuralHash}\n`);
  } catch (error) {
    if (!(error instanceof SkillRunError)) throw error;
    process.stdout.write(`REFUSED ${error.code}\n${error.message}\n${JSON.stringify(error.detail)}\n`);
    process.exitCode = 2;
  }
};

if (mode === 'check-realise' && first !== undefined) {
  report(() => acceptSkillReading(readJsonFile(first, '/'), context));
} else if (mode === 'check-edit' && first !== undefined && second !== undefined) {
  const semantic = acceptSkillReading(readJsonFile(first, '/'), context);
  report(() => acceptEditorialRevision(semantic, readJsonFile(second, '/'), context));
} else if (mode === 'assemble') {
  const { semantic, accepted, projection } = assembleRehearsal(rehearsal, readJsonFile(ETBZ58_SEMANTIC_READING), readJsonFile(ETBZ58_SKILL_READING));
  writeFileSync(resolve(process.cwd(), ETBZ58_ACCEPTED_READING), renderJson(accepted));
  writeFileSync(resolve(process.cwd(), ETBZ58_PROJECTION), renderJson(projection));
  process.stdout.write(`semantic ${semantic.structuralHash}\naccepted ${accepted.structuralHash}\nprojection ${projection.structuralHash} pages ${String(projection.pageCount)}\n`);
} else if (mode === 'seal') {
  const record = await deriveRehearsalRecord();
  writeFileSync(resolve(process.cwd(), ETBZ58_RECORD), renderJson(record));
  process.stdout.write(`record written: ${ETBZ58_RECORD}\n`);
} else {
  throw new Error('usage: check-realise <reading.json> | check-edit <realise.json> <edit.json> | assemble | seal');
}
