/**
 * ETBZ-54 — the operator command of the Golden run (`npm run etbz54 -- <command>`, under `vite-node`). Offline; the
 * live variant N is recorded by `npm run etbz54:variant`. Every file it writes goes into the private archive
 * (`<ETBZ54_ARCHIVE>/etbz54/`, 700/600) except the run record.
 *
 *   facts <source|near|removal>   writes the case's fact sheet for drafting and review (review/facts-<label>.json,
 *                                 review/chart-<label>.txt); `near` needs the variant, `removal` the drafts
 *   emit                          writes each case's Skill input package (cases/<label>/skill-input.json)
 *   cones                         writes the pre-run cones, BEFORE any reading exists; prints their keyed digest
 *   check-realise <label> <file>  runs the acceptance boundary on one REALISE attempt (wrapper step 5: the operator runs
 *                                 it; a refusal lists every violation of one full pass - what the one repair receives)
 *   check-edit <label> <realise> <edit>   the same for an EDIT revision (acceptEditorialRevision)
 *   accept <label>                runs the acceptance boundary on the case's REALISE reading and, when present, its
 *                                 EDIT revision; writes accepted-reading.json when both pass
 *   packets                       writes the judges' packets (judges/) from the accepted readings
 *   assemble                      the accepted Golden reading -> presentation-projection.json
 *   record | verify               writes the run record into the repository | re-derives it and compares byte for byte
 *
 * Environment: ETBZ54_INPUT (the Product Owner's input file), ETBZ54_ARCHIVE (the ETBZ-53 archive directory).
 * Prints codes, paths and keyed digests. A message that quotes a value of the input file is withheld.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deriveInterpretationFeatureSet } from '../../src/application/interpretation/feature-set.js';
import { acceptEditorialRevision, acceptSkillReading } from '../../src/application/skill/index.js';
import { keyed, loadOrCreateKey } from './etbz53GoldenFreeze.js';
import { renderJson } from './etbz58Rehearsal.js';
import type { CaseLabel } from './etbz59Cases.js';
import { chartSheet } from './etbz59Judges.js';
import {
  CONES_FILE,
  ETBZ54_RECORD,
  GOLDEN_LABELS,
  archiveHas,
  assertTreePrivate,
  attemptsDir,
  caseFile,
  goldenChart,
  loadGoldenDrafts,
  nearChart,
  readInput,
  readPrivateJson,
  removalChart,
  safeMessage,
  workPath,
  writePrivateFile,
} from './etbz54Golden.js';
import type { GoldenConfig } from './etbz54Golden.js';
import { assembleGolden, deriveGoldenCones, deriveGoldenJudgePackets, loadGoldenRun } from './etbz54Run.js';
import { deriveGoldenRecord } from './etbz54Record.js';

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') throw new Error(`${name} is required`);
  return value.trim();
};
const config: GoldenConfig = { inputPath: required('ETBZ54_INPUT'), archiveDir: required('ETBZ54_ARCHIVE') };
const isLabel = (value: string | undefined): value is CaseLabel => (GOLDEN_LABELS as readonly string[]).includes(value ?? '');
const codeOf = (error: unknown): string => (typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : 'THREW');
const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

async function main(): Promise<void> {
  const raw = readInput(config);
  const key = loadOrCreateKey(config.archiveDir, false);
  const [command, argument, first, second] = process.argv.slice(2);
  try {
    if (command === 'facts' && isLabel(argument)) {
      const source = await goldenChart(config, raw);
      const chart = argument === 'source' ? source : argument === 'near' ? await nearChart(config, raw) : removalChart(source, loadGoldenDrafts(config).removal.factIds, config);
      const facts = deriveInterpretationFeatureSet(chart.model).facts.map((fact) => ({ id: fact.id, value: fact.value, interpretable: fact.interpretable }));
      writePrivateFile(workPath(config, 'review', `facts-${argument}.json`), `${JSON.stringify(facts, null, 1)}\n`);
      writePrivateFile(workPath(config, 'review', `chart-${argument}.txt`), `${chartSheet(chart.model)}\n`);
      out(`facts written: ${workPath(config, 'review', `facts-${argument}.json`)} · input ${keyed(key, chart.input.structuralHash)} eligible ${String(chart.input.productionEligibility.eligible)}`);
    } else if (command === 'emit') {
      const { runs } = await loadGoldenRun(config);
      for (const label of GOLDEN_LABELS) {
        writePrivateFile(caseFile(config, label, 'skill-input'), renderJson(runs[label].inputPackage));
        out(`${label}: package ${keyed(key, runs[label].inputPackage.structuralHash)} · bundle ${runs[label].bundle.bundleRef} ${runs[label].bundle.structuralHash}`);
      }
    } else if (command === 'cones') {
      const path = workPath(config, CONES_FILE);
      if (archiveHas(path)) throw new Error('the pre-run cones exist already; they are written once, before any reading');
      const readings = GOLDEN_LABELS.filter((label) => archiveHas(caseFile(config, label, 'semantic-reading')) || archiveHas(attemptsDir(config, label)));
      if (readings.length > 0) throw new Error(`a reading exists already (${readings.join(', ')}); the cones must precede every reading`);
      const text = renderJson(await deriveGoldenCones(config));
      writePrivateFile(path, text);
      out(`cones written: ${path} · ${keyed(key, text)}`);
    } else if ((command === 'check-realise' || command === 'check-edit') && isLabel(argument) && first !== undefined) {
      const { runs } = await loadGoldenRun(config);
      const context = { bundle: runs[argument].bundle, inputPackage: runs[argument].inputPackage };
      const semantic = acceptSkillReading(readPrivateJson(first), context);
      if (command === 'check-realise') out(`${argument}: REALISE ACCEPTED ${keyed(key, semantic.structuralHash)}`);
      else if (second !== undefined) out(`${argument}: EDIT ACCEPTED ${keyed(key, acceptEditorialRevision(semantic, readPrivateJson(second), context).structuralHash)}`);
      else throw new Error('check-edit needs the accepted REALISE file and the EDIT file');
    } else if (command === 'accept' && isLabel(argument)) {
      const { runs } = await loadGoldenRun(config);
      const run = runs[argument];
      const context = { bundle: run.bundle, inputPackage: run.inputPackage };
      const semantic = acceptSkillReading(readPrivateJson(caseFile(config, argument, 'semantic-reading')), context);
      out(`${argument}: REALISE accepted ${keyed(key, semantic.structuralHash)}`);
      if (archiveHas(caseFile(config, argument, 'skill-reading'))) {
        const accepted = acceptEditorialRevision(semantic, readPrivateJson(caseFile(config, argument, 'skill-reading')), context);
        writePrivateFile(caseFile(config, argument, 'accepted-reading'), renderJson(accepted));
        out(`${argument}: EDIT accepted ${keyed(key, accepted.structuralHash)}`);
      }
    } else if (command === 'packets') {
      const files = await deriveGoldenJudgePackets(config);
      for (const [path, content] of Object.entries(files)) writePrivateFile(workPath(config, 'judges', path), content);
      out(`judge packets written: ${String(Object.keys(files).length)} files under ${workPath(config, 'judges')}`);
    } else if (command === 'assemble') {
      const { projection } = await assembleGolden(config);
      const path = workPath(config, 'presentation-projection.json');
      writePrivateFile(path, renderJson(projection));
      out(`projection written: ${path} · ${keyed(key, projection.structuralHash)}`);
    } else if (command === 'record' || command === 'verify') {
      const text = renderJson(await deriveGoldenRecord(config));
      const target = resolve(process.cwd(), ETBZ54_RECORD);
      if (command === 'record') {
        writeFileSync(target, text);
        out(`record written: ${ETBZ54_RECORD}`);
      } else {
        const equal = readFileSync(target, 'utf8') === text;
        out(`committed record re-derived byte for byte: ${String(equal)}`);
        if (!equal) process.exitCode = 1;
      }
    } else {
      process.stderr.write('usage: etbz54 facts <label> | emit | cones | check-realise <label> <file> | check-edit <label> <realise> <edit> | accept <label> | packets | assemble | record | verify\n');
      process.exitCode = 2;
      return;
    }
    assertTreePrivate(workPath(config));
  } catch (error) {
    out(`REFUSED ${codeOf(error)}: ${safeMessage(error instanceof Error ? error.message : String(error), raw)}`);
    // D-59-4: every violation one full pass found - what the operator hands to the one repair.
    const diagnostics = (error as { diagnostics?: readonly (Error & { detail?: unknown })[] }).diagnostics ?? [];
    for (const entry of diagnostics) out(`  - ${safeMessage(`${entry.message} ${JSON.stringify(entry.detail ?? {})}`, raw)}`);
    process.exitCode = 1;
  }
}

// A failure outside the commands (environment, input file, archive key) is reported by its name and code only.
main().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : 'Error';
  process.stderr.write(`FAILED: ${name} ${codeOf(error)} (message withheld)\n`);
  process.exitCode = 1;
});
