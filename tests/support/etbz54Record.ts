/**
 * ETBZ-54 — the run record (placeholder until the run's stages exist; written at the seal).
 */
import type { GoldenConfig } from './etbz54Golden.js';

export function deriveGoldenRecord(config: GoldenConfig): Promise<Record<string, unknown>> {
  return Promise.reject(new Error(`etbz54: the run record is not defined yet (${config.archiveDir === '' ? 'no archive' : 'archive set'})`));
}
