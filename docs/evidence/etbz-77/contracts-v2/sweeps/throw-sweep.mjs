// ETBZ-77 one-time throw-site sweep: every `throw` of canon-v2-contracts.ts is disabled in turn
// (`throw X` -> `if (false) throw X`), the three ETBZ-77 suites run, and the kill must be an AssertionError.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
const F = 'src/application/skill/canon-v2-contracts.ts';
const REPORT = process.argv[2];
const SUITES = ['tests/unit/etbz77-contracts-v2.test.ts', 'tests/negative/etbz77-contracts-v2.negative.test.ts', 'tests/contract/etbz77-contracts-v2.contract.test.ts'];
const original = readFileSync(F, 'utf8');
const lines = original.split('\n');
const sites = lines.map((line, index) => ({ line, index })).filter(({ line }) => /^\s*(?:if \([^)]*\) )?throw\b/u.test(line) || /[;{]\s*throw\b/u.test(line));
console.log(`sweep over ${F} at ${execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()} (working tree sha256 ${execFileSync('shasum', ['-a', '256', F], { encoding: 'utf8' }).slice(0, 64)})`);
console.log(`throw sites: ${sites.length}`);
let killed = 0;
for (const { line, index } of sites) {
  const mutated = [...lines];
  mutated[index] = line.replace(/\bthrow\b/u, 'if (false) throw');
  writeFileSync(F, mutated.join('\n'));
  rmSync(REPORT, { force: true });
  let r;
  try { r = spawnSync('npx', ['vitest', 'run', ...SUITES, '--reporter=json', `--outputFile=${REPORT}`], { encoding: 'utf8' }); }
  finally { writeFileSync(F, original); }
  let failed = [];
  try { failed = JSON.parse(readFileSync(REPORT, 'utf8')).testResults.flatMap((f) => f.assertionResults.filter((t) => t.status === 'failed')); } catch {}
  const asserted = failed.filter((t) => t.failureMessages.some((m) => m.startsWith('AssertionError')));
  const verdict = r.status === 0 ? 'SURVIVED' : asserted.length > 0 ? 'KILLED_BY_ASSERTION' : 'RED_NOT_BY_ASSERTION';
  if (verdict === 'KILLED_BY_ASSERTION') killed += 1;
  console.log(`L${index + 1} ${verdict} ${verdict === 'KILLED_BY_ASSERTION' ? `<- ${asserted[0].fullName}` : ''}\n    ${line.trim().slice(0, 150)}`);
}
console.log(`\n${killed}/${sites.length} throw sites killed by assertion · restored identical: ${readFileSync(F, 'utf8') === original}`);
