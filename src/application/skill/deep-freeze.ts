// =============================================================================
// ETBZ-77 (Canon v2, A1) - freezes a released value, all the way down.
//
// The 2.0 contract line hands its values out by reference (sources, decision,
// content, the binding pair, the hash table). Each v2 module freezes what it
// exports where it defines it, so a caller that writes into a returned value
// cannot change what the next caller is told. Freezing changes no content and
// no hash. Internal to the skill module: not exported through the index.
// =============================================================================

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value)) deepFreeze(entry);
  }
  return value;
}
