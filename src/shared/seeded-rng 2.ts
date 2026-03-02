function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 创建 RNG。
 * - 传入 seed: 纯确定性，可复现
 * - 不传 seed: 混合运行时熵，不可复现
 * 返回 { rng, seed } — seed 用于记录和复现
 */
export function createSeededRng(seed?: number): { rng: () => number; seed: number } {
  if (seed != null) {
    // 确定性模式：相同 seed 产生相同序列
    return { rng: mulberry32(seed >>> 0), seed: seed >>> 0 };
  }
  // 熵模式：生成随机 seed
  const now = Date.now();
  const randomBits = Math.floor(Math.random() * 0xffffffff);
  const perfBits = (() => {
    try {
      return Number(process.hrtime.bigint() % BigInt(0xffffffff));
    } catch {
      return Math.floor(Math.random() * 0xffffffff);
    }
  })();
  const generatedSeed = (now ^ randomBits ^ perfBits) >>> 0;
  return { rng: mulberry32(generatedSeed), seed: generatedSeed };
}
