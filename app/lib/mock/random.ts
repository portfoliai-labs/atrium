// lib/mock/random.ts
//
// Seeded randomness for the preview features' sample data (see components/preview): the same
// seed always gives the same numbers, so the mocked charts don't reshuffle on every render or
// differ between server and client.

/** mulberry32: a tiny, fast PRNG returning floats in [0, 1). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A standard normal draw (Box–Muller) from a seeded generator. */
export function normal(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A stable seed from a string, so each mocked entity gets its own series. */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const round = (value: number, decimals = 0) => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};
