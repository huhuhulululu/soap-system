/**
 * Goal Path Calculator
 *
 * 根据 IE 初始状态 + ST/LT Goals + txCount，计算每个维度在哪些 visit 降一级。
 * 核心思路: 将总降幅按 ST/LT 阶段均匀分配到 visit 上，rng 加抖动避免机械感。
 */

export interface DimensionPath {
  dimension: string;
  startValue: number;
  stGoal: number;
  ltGoal: number;
  /** 在这些 visit index 降一级 (1-based) */
  changeVisits: number[];
}

export interface GoalPaths {
  tightness: DimensionPath;
  tenderness: DimensionPath;
  spasm: DimensionPath;
  strength: DimensionPath;
  pain: DimensionPath;
  frequency: DimensionPath;
  symptomScale: DimensionPath;
  adlA: DimensionPath;
  adlB: DimensionPath;
  txCount: number;
  stBoundary: number;
}

export interface GoalPathInput {
  tightness: { start: number; st: number; lt: number };
  tenderness: { start: number; st: number; lt: number };
  spasm: { start: number; st: number; lt: number };
  strength: { start: number; st: number; lt: number };
  pain: { start: number; st: number; lt: number };
  frequency: { start: number; st: number; lt: number };
  symptomScale: { start: number; st: number; lt: number };
  adlA: { start: number; st: number; lt: number };
  adlB: { start: number; st: number; lt: number };
}

/**
 * 在一个 visit 范围内随机分配 drops 次降级，保证最小间距。
 * 每个 drop 消耗恰好 1 次 rng() 调用（与旧策略一致，不偏移 PRNG 序列长度）。
 * 返回降级发生的 visit index 列表（升序）。
 *
 * 旧策略 (center-biased) 用 interval = rangeLen / (drops+1)，
 * 导致 drops 集中在范围中央，头尾 visit 永远空。
 * 新策略: 从全范围候选中随机选取，保证 minGap 间距，覆盖更均匀。
 */
function distributeDrops(
  drops: number,
  rangeStart: number,
  rangeEnd: number,
  rng: () => number,
): number[] {
  if (drops <= 0 || rangeEnd < rangeStart) return [];

  const rangeLen = rangeEnd - rangeStart + 1;
  if (drops >= rangeLen) {
    // 降级次数 >= 可用 visit 数，每个 visit 都降
    return Array.from({ length: rangeLen }, (_, i) => rangeStart + i);
  }

  // 最小间距: 保证 drops 不会挤在一起，但不要太大以免限制覆盖范围
  const minGap =
    drops === 1 ? 0 : Math.max(1, Math.floor(rangeLen / (drops + 1)) - 1);
  const visits: number[] = [];
  const used = new Set<number>();

  for (let d = 0; d < drops; d++) {
    const candidates: number[] = [];
    for (let v = rangeStart; v <= rangeEnd; v++) {
      if (used.has(v)) continue;
      let tooClose = false;
      for (const u of used) {
        if (Math.abs(v - u) < minGap) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) candidates.push(v);
    }
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(rng() * candidates.length)];
    visits.push(pick);
    used.add(pick);
  }

  return visits.sort((a, b) => a - b);
}

/**
 * 为单个维度计算 changeVisits。
 */
function computeDimensionPath(
  dimension: string,
  start: number,
  stGoal: number,
  ltGoal: number,
  stBoundary: number,
  txCount: number,
  rng: () => number,
  stRangeStart: number = 1,
): DimensionPath {
  // Works for both decreasing (tightness: 4→2) and increasing (strength: 2→5) dimensions
  const stSteps = Math.max(0, Math.abs(start - stGoal));
  const ltSteps = Math.max(0, Math.abs(stGoal - ltGoal));

  const stVisits = distributeDrops(stSteps, stRangeStart, stBoundary, rng);
  const ltVisits = distributeDrops(ltSteps, stBoundary + 1, txCount, rng);

  return {
    dimension,
    startValue: start,
    stGoal,
    ltGoal,
    changeVisits: [...stVisits, ...ltVisits],
  };
}

export interface GoalPathOptions {
  /**
   * Pain 维度 ST 阶段的最早 drop visit (1-based)。
   * 默认 1（无保护）。设为 N 表示 pain 的 ST drops 不会安排在 visit N 之前。
   * 临床意义: 前几次治疗身体适应期，pain 不应快速下降。
   */
  painEarlyGuard?: number;
  /**
   * SymptomScale 维度 ST 阶段的最早 drop visit (1-based)。
   * 默认 1（无保护）。前几次治疗 symptomScale 不应快速下降。
   */
  symptomScaleEarlyGuard?: number;
}

/**
 * 计算所有维度的 goal paths。
 *
 * @param input - 每个维度的 start/st/lt 值
 * @param txCount - 总治疗次数
 * @param rng - PRNG 函数 (0-1)
 * @param options - 可选配置 (painEarlyGuard 等)
 */
export function computeGoalPaths(
  input: GoalPathInput,
  txCount: number,
  rng: () => number,
  options?: GoalPathOptions,
): GoalPaths {
  const stBoundary = Math.round(txCount * 0.6);

  const tightness = computeDimensionPath(
    "tightness",
    input.tightness.start,
    input.tightness.st,
    input.tightness.lt,
    stBoundary,
    txCount,
    rng,
  );
  const tenderness = computeDimensionPath(
    "tenderness",
    input.tenderness.start,
    input.tenderness.st,
    input.tenderness.lt,
    stBoundary,
    txCount,
    rng,
  );
  const spasm = computeDimensionPath(
    "spasm",
    input.spasm.start,
    input.spasm.st,
    input.spasm.lt,
    stBoundary,
    txCount,
    rng,
  );
  // 尝试错开不同维度的 changeVisits，减少同一 visit 多维度同时变化
  // strength 和 ROM 关联，可以同时变，所以不参与 deconflict
  deconflict([tightness, tenderness, spasm], stBoundary, txCount, rng);

  // Strength computed AFTER deconflict to preserve existing PRNG sequence
  const strength = computeDimensionPath(
    "strength",
    input.strength.start,
    input.strength.st,
    input.strength.lt,
    stBoundary,
    txCount,
    rng,
  );

  // New dimensions (appended after strength to preserve PRNG sequence)
  // Pain: earlyGuard 推迟 ST 阶段的 rangeStart，让前期不安排 pain drop
  const painSTStart = Math.min(options?.painEarlyGuard ?? 1, stBoundary);
  const pain = computeDimensionPath(
    "pain",
    input.pain.start,
    input.pain.st,
    input.pain.lt,
    stBoundary,
    txCount,
    rng,
    painSTStart,
  );

  // Pain gap constraint: ensure pain drops are ≥ 2 visits apart within each phase.
  // This prevents severity/adl cascade from stacking on consecutive visits.
  // No rng calls — pure post-processing of existing changeVisits.
  {
    const stDrops = pain.changeVisits.filter((v) => v <= stBoundary);
    const ltDrops = pain.changeVisits.filter((v) => v > stBoundary);
    const enforceGap = (
      drops: number[],
      minV: number,
      maxV: number,
    ): number[] => {
      const sorted = [...drops].sort((a, b) => a - b);
      // Forward pass: push later drops forward
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] < 2) {
          sorted[i] = Math.min(sorted[i - 1] + 2, maxV);
        }
      }
      // Backward pass: if forward push hit maxV, pull earlier drops back
      for (let i = sorted.length - 2; i >= 0; i--) {
        if (sorted[i + 1] - sorted[i] < 2) {
          sorted[i] = Math.max(sorted[i + 1] - 2, minV);
        }
      }
      return sorted;
    };
    pain.changeVisits = [
      ...enforceGap(stDrops, painSTStart, stBoundary),
      ...enforceGap(ltDrops, stBoundary + 1, txCount),
    ];
  }

  const frequency = computeDimensionPath(
    "frequency",
    input.frequency.start,
    input.frequency.st,
    input.frequency.lt,
    stBoundary,
    txCount,
    rng,
  );
  const ssSTStart = Math.min(options?.symptomScaleEarlyGuard ?? 1, stBoundary);
  const symptomScale = computeDimensionPath(
    "symptomScale",
    input.symptomScale.start,
    input.symptomScale.st,
    input.symptomScale.lt,
    stBoundary,
    txCount,
    rng,
    ssSTStart,
  );
  const adlA = computeDimensionPath(
    "adlA",
    input.adlA.start,
    input.adlA.st,
    input.adlA.lt,
    stBoundary,
    txCount,
    rng,
  );
  const adlB = computeDimensionPath(
    "adlB",
    input.adlB.start,
    input.adlB.st,
    input.adlB.lt,
    stBoundary,
    txCount,
    rng,
  );

  // ADL-A and ADL-B are mutually exclusive: same visit can only change one
  deconflictPair(adlA, adlB, stBoundary, txCount, rng);

  // Global deconflict: cap simultaneous dimension changes per visit
  // ST phase: max 2, LT phase: max 3 (fewer slots available)
  // Pass earlyGuard boundaries so protected dims aren't moved into early visits
  const earlyGuardMap: Record<string, number> = {};
  if (painSTStart > 1) earlyGuardMap.pain = painSTStart;
  if (ssSTStart > 1) earlyGuardMap.symptomScale = ssSTStart;
  globalDeconflict(
    [
      tightness,
      tenderness,
      spasm,
      strength,
      pain,
      frequency,
      symptomScale,
      adlA,
      adlB,
    ],
    stBoundary,
    txCount,
    rng,
    earlyGuardMap,
  );

  return {
    tightness,
    tenderness,
    spasm,
    strength,
    pain,
    frequency,
    symptomScale,
    adlA,
    adlB,
    txCount,
    stBoundary,
  };
}

/**
 * 尝试错开不同维度在同一 visit 的变化。
 * 如果两个维度在同一 visit 变化，尝试将其中一个移动 ±1。
 */
function deconflict(
  paths: DimensionPath[],
  stBoundary: number,
  txCount: number,
  rng: () => number,
): void {
  // 收集所有 visit → 哪些维度在变
  const visitMap = new Map<number, string[]>();
  for (const p of paths) {
    for (const v of p.changeVisits) {
      const existing = visitMap.get(v) || [];
      existing.push(p.dimension);
      visitMap.set(v, existing);
    }
  }

  // 对冲突的 visit，尝试移动
  const entries = Array.from(visitMap.entries());
  for (const [visit, dims] of entries) {
    if (dims.length <= 1) continue;

    // 保留第一个维度不动，尝试移动其他的
    for (let d = 1; d < dims.length; d++) {
      const path = paths.find((p) => p.dimension === dims[d])!;
      const idx = path.changeVisits.indexOf(visit);
      if (idx === -1) continue;

      // 确定移动范围
      const inST = visit <= stBoundary;
      const rangeMin = inST ? 1 : stBoundary + 1;
      const rangeMax = inST ? stBoundary : txCount;

      // 尝试 +1 或 -1
      const direction = rng() > 0.5 ? 1 : -1;
      const candidates = [visit + direction, visit - direction];

      for (const candidate of candidates) {
        if (candidate < rangeMin || candidate > rangeMax) continue;
        // 检查候选位置是否已被其他维度占用
        const occupants = visitMap.get(candidate) || [];
        if (occupants.length === 0) {
          // 移动成功
          path.changeVisits[idx] = candidate;
          path.changeVisits.sort((a, b) => a - b);
          // 更新 map
          const oldList = visitMap.get(visit)!;
          visitMap.set(
            visit,
            oldList.filter((x) => x !== dims[d]),
          );
          visitMap.set(candidate, [...occupants, dims[d]]);
          break;
        }
      }
    }
  }
}

/**
 * Ensure two dimensions never change on the same visit.
 * If overlap found, move one of them ±1.
 */
function deconflictPair(
  pathA: DimensionPath,
  pathB: DimensionPath,
  stBoundary: number,
  txCount: number,
  rng: () => number,
): void {
  for (let bi = 0; bi < pathB.changeVisits.length; bi++) {
    const visit = pathB.changeVisits[bi];
    if (!pathA.changeVisits.includes(visit)) continue;

    // Conflict: try to move pathB's visit
    const inST = visit <= stBoundary;
    const rangeMin = inST ? 1 : stBoundary + 1;
    const rangeMax = inST ? stBoundary : txCount;

    const direction = rng() > 0.5 ? 1 : -1;
    const candidates = [visit + direction, visit - direction];

    let moved = false;
    for (const candidate of candidates) {
      if (candidate < rangeMin || candidate > rangeMax) continue;
      if (pathA.changeVisits.includes(candidate)) continue;
      if (pathB.changeVisits.includes(candidate)) continue;
      pathB.changeVisits[bi] = candidate;
      moved = true;
      break;
    }

    // If can't move ±1, try wider range
    if (!moved) {
      for (let offset = 2; offset <= 3; offset++) {
        for (const dir of [direction, -direction]) {
          const candidate = visit + dir * offset;
          if (candidate < rangeMin || candidate > rangeMax) continue;
          if (pathA.changeVisits.includes(candidate)) continue;
          if (pathB.changeVisits.includes(candidate)) continue;
          pathB.changeVisits[bi] = candidate;
          moved = true;
          break;
        }
        if (moved) break;
      }
    }
  }
  pathB.changeVisits.sort((a, b) => a - b);
}

/**
 * 全局去冲突: 限制每个 visit 同时变化的维度数量。
 * ST 阶段 max 2, LT 阶段 max 3（LT slots 少，允许稍密）。
 * 超出上限的维度移到最近的低占用 visit。
 *
 * 策略: 按 visit 从前往后扫描，超限时把优先级最低的维度移走。
 * 优先级: adlA/adlB < symptomScale < frequency < strength < spasm < tenderness < tightness < pain
 * (pain 最不愿意移动，因为有 earlyGuard 保护)
 */
function globalDeconflict(
  paths: DimensionPath[],
  stBoundary: number,
  txCount: number,
  rng: () => number,
  earlyGuardMap: Record<string, number> = {},
): void {
  // Priority: higher = harder to move (stays put)
  const priority: Record<string, number> = {
    adlB: 0,
    adlA: 1,
    symptomScale: 2,
    frequency: 3,
    strength: 4,
    spasm: 5,
    tenderness: 6,
    tightness: 7,
    pain: 8,
  };

  // Build visit → dimension names map
  const visitMap = new Map<number, string[]>();
  for (const p of paths) {
    for (const v of p.changeVisits) {
      const list = visitMap.get(v) || [];
      list.push(p.dimension);
      visitMap.set(v, list);
    }
  }

  // Process each visit
  for (let v = 1; v <= txCount; v++) {
    const dims = visitMap.get(v);
    if (!dims) continue;

    const cap = 3;
    if (dims.length <= cap) continue;

    // Sort dims by priority ascending (lowest priority = move first)
    const sorted = [...dims].sort(
      (a, b) => (priority[a] ?? 0) - (priority[b] ?? 0),
    );

    // Move excess dims (lowest priority first)
    const toMove = sorted.slice(0, dims.length - cap);

    for (const dimName of toMove) {
      const path = paths.find((p) => p.dimension === dimName)!;
      const idx = path.changeVisits.indexOf(v);
      if (idx === -1) continue;

      // Determine phase range
      const inST = v <= stBoundary;
      const rangeMin = inST ? 1 : stBoundary + 1;
      const rangeMax = inST ? stBoundary : txCount;
      const phaseCap = 3;

      // Find best candidate: nearest visit with fewest occupants below cap
      const direction = rng() > 0.5 ? 1 : -1;
      let bestCandidate = -1;
      let bestCount = Infinity;

      // Respect earlyGuard: don't move this dim before its protected boundary
      const dimEarlyGuard = earlyGuardMap[dimName] ?? rangeMin;
      const effectiveMin = inST ? Math.max(rangeMin, dimEarlyGuard) : rangeMin;

      for (let offset = 1; offset <= rangeMax - rangeMin; offset++) {
        for (const dir of [direction, -direction]) {
          const candidate = v + dir * offset;
          if (candidate < effectiveMin || candidate > rangeMax) continue;

          const occupants = visitMap.get(candidate) || [];
          if (occupants.length < phaseCap && occupants.length < bestCount) {
            // Also check adlA/adlB mutual exclusion
            if (
              (dimName === "adlA" && occupants.includes("adlB")) ||
              (dimName === "adlB" && occupants.includes("adlA"))
            ) {
              continue;
            }
            bestCandidate = candidate;
            bestCount = occupants.length;
            if (bestCount === 0) break; // Can't do better than empty
          }
        }
        if (bestCount === 0) break;
      }

      if (bestCandidate === -1) continue; // No room — rare edge case

      // Move
      path.changeVisits[idx] = bestCandidate;
      path.changeVisits.sort((a, b) => a - b);

      // Update map
      const oldList = visitMap.get(v)!;
      visitMap.set(
        v,
        oldList.filter((x) => x !== dimName),
      );
      const newList = visitMap.get(bestCandidate) || [];
      newList.push(dimName);
      visitMap.set(bestCandidate, newList);
    }
  }
}
