#!/usr/bin/env node
// =============================================================================
// ETBZ-49 - write the integrity index of the recovered visual artefacts.
//
// `assets/visual-system-v1/` is a byte-preserved copy of the converged ETBZ-43
// build. "Byte-preserved" is a claim, so it gets an index: one SHA-256 per file,
// checked by `tests/contract/etbz49-visual-assets.contract.test.ts` in both
// directions - every listed file hashes as stated, and every file on disk is
// listed. An artefact cannot be edited, added or removed unnoticed.
//
// The index excludes itself, which is the only way a file inside the tree it
// describes can exist. That exclusion is explicit here and asserted there.
//
// Hash values are written with the `sha256:` prefix the recovered artefacts
// already use. That is also what keeps a bare 64-character hex string from
// sitting next to a key the secret scanner reads as credential-shaped.
//
//   node scripts/etbz49-asset-integrity.mjs
// =============================================================================

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = resolve(REPO_ROOT, 'assets/visual-system-v1');
export const INTEGRITY_FILE = 'ASSET-INTEGRITY.json';

function listFiles(root) {
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current).sort()) {
      const entryPath = join(current, entry);
      if (statSync(entryPath).isDirectory()) walk(entryPath);
      else found.push(relative(root, entryPath));
    }
  };
  walk(root);
  return found.sort();
}

const files = listFiles(ASSETS).filter((file) => file !== INTEGRITY_FILE);
const index = {
  indexVersion: 'etbz49-asset-integrity@1.0.0',
  source: 'ETBZ-43 converged build, recovered package "bazodiac-final-design-system"',
  note: `SHA-256 of every file under assets/visual-system-v1/ except ${INTEGRITY_FILE} itself.`,
  fileCount: files.length,
  files: files.map((path) => ({
    path,
    bytes: statSync(resolve(ASSETS, path)).size,
    sha256: `sha256:${createHash('sha256').update(readFileSync(resolve(ASSETS, path))).digest('hex')}`,
  })),
};

writeFileSync(resolve(ASSETS, INTEGRITY_FILE), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
process.stdout.write(`${INTEGRITY_FILE}: ${files.length} files indexed\n`);
