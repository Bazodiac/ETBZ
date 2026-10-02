/**
 * ETBZ-60 — the operator command of the re-reading (`npm run etbz60 -- <command>`, under `vite-node`). Offline.
 *
 *   accept <source|near>  runs the acceptance boundary on the case's REALISE reading (semantic-reading.json) and, when
 *                         present, its EDIT revision (skill-reading.json); writes accepted-reading.json when both pass
 *   packet                writes the judge's packet (docs/evidence/etbz-60/judge/) from the accepted readings
 *   record                re-derives docs/evidence/etbz-60/rereading-record.json from the committed files
 *
 * Prints codes, paths and hashes only.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { renderJson } from './etbz58Rehearsal.js';
import { deriveCase } from './etbz59Cases.js';
import { ETBZ60_JUDGE_DIR, ETBZ60_LABELS, ETBZ60_RECORD, acceptCase, caseFile, deriveJudgePacket, deriveRereadingRecord } from './etbz60Rereading.js';
import type { Etbz60Label } from './etbz60Rereading.js';

const write = (path: string, data: string): void => {
  const out = resolve(process.cwd(), path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, data);
};
const codeOf = (error: unknown): string => (typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : 'THREW');

const [command, argument] = process.argv.slice(2);
if (command === 'accept' && (ETBZ60_LABELS as readonly string[]).includes(argument ?? '')) {
  const label = argument as Etbz60Label;
  try {
    const { semantic, edited } = acceptCase(label, await deriveCase(label));
    process.stdout.write(`${label}: REALISE accepted ${semantic.structuralHash}\n`);
    if (edited !== null) {
      write(caseFile(label, 'accepted-reading'), renderJson(edited));
      process.stdout.write(`${label}: EDIT accepted ${edited.structuralHash}\n`);
    }
  } catch (error) {
    process.stdout.write(`${label}: REFUSED ${codeOf(error)}: ${error instanceof Error ? error.message : ''}\n`);
    const diagnostics = (error as { diagnostics?: readonly (Error & { detail?: unknown })[] }).diagnostics ?? [];
    for (const entry of diagnostics) process.stdout.write(`  - ${entry.message} ${JSON.stringify(entry.detail ?? {})}\n`);
    process.exitCode = 1;
  }
} else if (command === 'packet') {
  const files = await deriveJudgePacket();
  for (const [path, content] of Object.entries(files)) write(`${ETBZ60_JUDGE_DIR}/${path}`, content);
  process.stdout.write(`judge packet written: ${String(Object.keys(files).length)} files under ${ETBZ60_JUDGE_DIR}\n`);
} else if (command === 'record') {
  write(ETBZ60_RECORD, renderJson(await deriveRereadingRecord()));
  process.stdout.write(`record written: ${ETBZ60_RECORD}\n`);
} else {
  process.stderr.write('usage: etbz60 accept <source|near> | packet | record\n');
  process.exitCode = 2;
}
