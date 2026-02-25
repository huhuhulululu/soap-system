/**
 * Goal Path Calculator
 *
 * 根据 IE 初始状态 + ST/LT Goals + txCount，计算每个维度在哪些 visit 降一级。
 * 核心思路: 将总降幅按 ST/LT 阶段均匀分配到 visit 上，rng 加抖动避免机械感。
 */

export interface DimensionPath {
  dimension: string
  startValue: number
  stGoal: number
  ltGoal: number
  /** 在这些 visit index 降一级 (1-based) */
  changeVisits: number[]
}

export interface GoalPaths {
  tightness: DimensionPath
  tenderness: DimensionPath
  spasm: DimensionPath
  strength: DimensionPath
  pain: DimensionPath
  frequency: DimensionPath
  symptomScale: DimensionPath
  adlA: DimensionPath
  adlB: DimensionPath
  txCount: number
  stBoundary: number
}

export interface GoalPathInput {
  tightness: { start: number; st: number; lt: number }
  tenderness: { start: number; st: number; lt: number }
  spasm: { start: number; st: number; lt: number }
  strength: { start: number; st: number; lt: number }
  pain: { start: number; st: number; lt: number }
  frequency: { start: number; st: number; lt: number }
  symptomScale: { start: number; st: number; lt: number }
  adlA: { start: number; st: number; lt: number }
  adlB: { start: number; st: number; lt: number }
}

/**
 * 在一个 visit 范围内均匀分配 drops 次降级，加 rng ±1 抖动。
 * 返回降级发生的 visit index 列表。
 */
function distributeDrops(
  drops: number,
  rangeStart: number,
  rangeEnd: number,
  rng: () => number,
): number[] {
  if (drops <= 0 || rangeEnd < rangeStart) return []

  const rangeLen = rangeEnd - rangeStart + 1
  if (drops >= rangeLen) {
    // 降级次数 >= 可用 visit 数，每个 visit 都降
    return Array.from({ length: rangeLen }, (_, i) => rangeStart + i)
  }

  // 均匀间隔分配
  const interval = rangeLen / (drops + 1)
  const visits: number[] = []

  for (let d = 1; d <= drops; d++) {
    const base = Math.round(rangeStart + interval * d - 1)
    // ±1 抖动
    const r = rng()
    const jitter = r < 0.33 ? -1 : r < 0.67 ? 1 : 0
    const visit = Math.max(rangeStart, Math.min(rangeEnd, base + jitter))
    visits.push(visit)
  }

  // 去重 + 排序
  const unique = Array.from(new Set(visits)).sort((a, b) => a - b)

  // 如果去重后少了，尝试补回
  if (unique.length < drops) {
    for (let v = rangeStart; v <= rangeEnd && unique.length < drops; v++) {
      if (!unique.includes(v)) {
        unique.push(v)
        unique.sort((a, b) => a - b)
      }
    }
  }

  return unique.slice(0, drops)
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
): DimensionPath {
  // Works for both decreasing (tightness: 4→2) and increasing (strength: 2→5) dimensions
  const stSteps = Math.max(0, Math.abs(start - stGoal))
  const ltSteps = Math.max(0, Math.abs(stGoal - ltGoal))

  const stVisits = distributeDrops(stSteps, 1, stBoundary, rng)
  const ltVisits = distributeDrops(ltSteps, stBoundary + 1, txCount, rng)

  return {
    dimension,
    startValue: start,
    stGoal,
    ltGoal,
    changeVisits: [...stVisits, ...ltVisits],
  }
}

/**
 * 计算所有维度的 goal paths。
 *
 * @param input - 每个维度的 start/st/lt 值
 * @param txCount - 总治疗次数
 * @param rng - PRNG 函数 (0-1)
 */
export function computeGoalPaths(
  input: GoalPathInput,
  txCount: number,
  rng: () => number,
): GoalPaths {
  const stBoundary = Math.round(txCount * 0.6)

  const tightness = computeDimensionPath(
    'tightness', input.tightness.start, input.tightness.st, input.tightness.lt,
    stBoundary, txCount, rng,
  )
  const tenderness = computeDimensionPath(
    'tenderness', input.tenderness.start, input.tenderness.st, input.tenderness.lt,
    stBoundary, txCount, rng,
  )
  const spasm = computeDimensionPath(
    'spasm', input.spasm.start, input.spasm.st, input.spasm.lt,
    stBoundary, txCount, rng,
  )
  // 尝试错开不同维度的 changeVisits，减少同一 visit 多维度同时变化
  // strength 和 ROM 关联，可以同时变，所以不参与 deconflict
  deconflict([tightness, tenderness, spasm], stBoundary, txCount, rng)

  // Strength computed AFTER deconflict to preserve existing PRNG sequence
  const strength = computeDimensionPath(
    'strength', input.strength.start, input.strength.st, input.strength.lt,
    stBoundary, txCount, rng,
  )

  // New dimensions (appended after strength to preserve PRNG sequence)
  const pain = computeDimensionPath(
    'pain', input.pain.start, input.pain.st, input.pain.lt,
    stBoundary, txCount, rng,
  )
  const frequency = computeDimensionPath(
    'frequency', input.frequency.start, input.frequency.st, input.frequency.lt,
    stBoundary, txCount, rng,
  )
  const symptomScale = computeDimensionPath(
    'symptomScale', input.symptomScale.start, input.symptomScale.st, input.symptomScale.lt,
    stBoundary, txCount, rng,
  )
  const adlA = computeDimensionPath(
    'adlA', input.adlA.start, input.adlA.st, input.adlA.lt,
    stBoundary, txCount, rng,
  )
  const adlB = computeDimensionPath(
    'adlB', input.adlB.start, input.adlB.st, input.adlB.lt,
    stBoundary, txCount, rng,
  )

  // ADL-A and ADL-B are mutually exclusive: same visit can only change one
  deconflictPair(adlA, adlB, stBoundary, txCount, rng)

  return { tightness, tenderness, spasm, strength, pain, frequency, symptomScale, adlA, adlB, txCount, stBoundary }
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
  const visitMap = new Map<number, string[]>()
  for (const p of paths) {
    for (const v of p.changeVisits) {
      const existing = visitMap.get(v) || []
      existing.push(p.dimension)
      visitMap.set(v, existing)
    }
  }

  // 对冲突的 visit，尝试移动
  const entries = Array.from(visitMap.entries())
  for (const [visit, dims] of entries) {
    if (dims.length <= 1) continue

    // 保留第一个维度不动，尝试移动其他的
    for (let d = 1; d < dims.length; d++) {
      const path = paths.find(p => p.dimension === dims[d])!
      const idx = path.changeVisits.indexOf(visit)
      if (idx === -1) continue

      // 确定移动范围
      const inST = visit <= stBoundary
      const rangeMin = inST ? 1 : stBoundary + 1
      const rangeMax = inST ? stBoundary : txCount

      // 尝试 +1 或 -1
      const direction = rng() > 0.5 ? 1 : -1
      const candidates = [visit + direction, visit - direction]

      for (const candidate of candidates) {
        if (candidate < rangeMin || candidate > rangeMax) continue
        // 检查候选位置是否已被其他维度占用
        const occupants = visitMap.get(candidate) || []
        if (occupants.length === 0) {
          // 移动成功
          path.changeVisits[idx] = candidate
          path.changeVisits.sort((a, b) => a - b)
          // 更新 map
          const oldList = visitMap.get(visit)!
          visitMap.set(visit, oldList.filter(x => x !== dims[d]))
          visitMap.set(candidate, [...occupants, dims[d]])
          break
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
    const visit = pathB.changeVisits[bi]
    if (!pathA.changeVisits.includes(visit)) continue

    // Conflict: try to move pathB's visit
    const inST = visit <= stBoundary
    const rangeMin = inST ? 1 : stBoundary + 1
    const rangeMax = inST ? stBoundary : txCount

    const direction = rng() > 0.5 ? 1 : -1
    const candidates = [visit + direction, visit - direction]

    let moved = false
    for (const candidate of candidates) {
      if (candidate < rangeMin || candidate > rangeMax) continue
      if (pathA.changeVisits.includes(candidate)) continue
      if (pathB.changeVisits.includes(candidate)) continue
      pathB.changeVisits[bi] = candidate
      moved = true
      break
    }

    // If can't move ±1, try wider range
    if (!moved) {
      for (let offset = 2; offset <= 3; offset++) {
        for (const dir of [direction, -direction]) {
          const candidate = visit + dir * offset
          if (candidate < rangeMin || candidate > rangeMax) continue
          if (pathA.changeVisits.includes(candidate)) continue
          if (pathB.changeVisits.includes(candidate)) continue
          pathB.changeVisits[bi] = candidate
          moved = true
          break
        }
        if (moved) break
      }
    }
  }
  pathB.changeVisits.sort((a, b) => a - b)
}
