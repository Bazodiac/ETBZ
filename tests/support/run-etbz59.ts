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
import { CASE_LABELS, deriveCase } from './etbz59Cases.js';
import type { CaseLabel } from './etbz59Cases.js';
import { ETBZ59_DIR } from './etbz59Variants.js';

export const caseFile = (label: CaseLabel, name: 'skill-input' | 'semantic-reading' | 'skill-reading' | 'accepted-reading'): string => `${ETBZ59_DIR}/cases/${label}/${name}.json`;

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
    process.exitCode = 1;
  }
} else {
  process.stderr.write('usage: etbz59 emit | accept <source|near|removal>\n');
  process.exitCode = 2;
}
