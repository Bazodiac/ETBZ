#!/usr/bin/env node
/**
 * ETBZ-51 — print the portable Skill Contract Bundle this repository binds.
 *
 * Reads the COMPILED module (run `npm run build` first) so that what is
 * printed is exactly what a Skill package would ship. Writes the canonical JSON
 * to stdout and the identity, hash and contract table to stderr; nothing is
 * written into the repository.
 *
 *   npm run build && npm run etbz51:bundle > .etbz-verify/skill-contract-bundle.json
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const compiled = resolve(process.cwd(), 'dist/application/skill/index.js');
if (!existsSync(compiled)) {
  process.stderr.write('ETBZ51_BUNDLE: dist/application/skill/index.js missing — run `npm run build` first\n');
  process.exit(64);
}

const skill = await import(pathToFileURL(compiled).href);
const bundle = skill.buildSkillContractBundle();
skill.assertReleasedSkillContractBundle(bundle);

process.stderr.write(`${bundle.bundleRef}\n${bundle.structuralHash}\n`);
for (const source of bundle.contracts) {
  process.stderr.write(
    `${source.key.padEnd(20)} ${skill.contractBindingRef(source).padEnd(48)} page ${source.confluencePageId} v${source.confluencePageVersion}\n`,
  );
}
process.stderr.write(`registry ${bundle.repository.methodRegistryStructuralHash}\n`);
process.stdout.write(skill.renderPortableSkillContractBundle(bundle));
process.stdout.write('\n');
