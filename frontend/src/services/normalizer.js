/**
 * Normalizer service for transforming backend CheckOutput structure
 * to match frontend component expectations.
 */

/**
 * Calculate trends from timeline entries
 * @param {Array} entries - Timeline entries with indicators
 * @returns {Object} Trends object with direction and percentage change
 */
export function calculateTrends(entries) {
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return {}
  }

  const trends = {}

  // Extract pain values from entries
  const painValues = entries
    .map(entry => entry.indicators?.pain?.value)
    .filter(value => value !== undefined && value !== null)

  if (painValues.length >= 1) {
    const firstValue = painValues[0]
    const lastValue = painValues[painValues.length - 1]
    const difference = lastValue - firstValue

    let direction = 'stable'
    if (painValues.length > 1) {
      if (difference < 0) {
        direction = 'improving' // Pain decreased
      } else if (difference > 0) {
        direction = 'worsening' // Pain increased
      }
    }

    const percentChange = firstValue !== 0
      ? Math.round((difference / firstValue) * 100)
      : (lastValue !== 0 ? 100 : 0)  // 从0变化视为100%变化

    trends.painScale = {
      direction,
      percentChange,
      firstValue,
      lastValue
    }
  }

  return trends
}

/**
 * Normalize error object by restructuring location fields
 * @param {Object} error - Raw error object from backend
 * @returns {Object} Normalized error with location object
 */
function normalizeError(error) {
  if (!error || typeof error !== 'object') {
    return { location: {} }
  }

  const { visitIndex, section, field, ...rest } = error

  return {
    ...rest,
    location: {
      visitIndex,
      section,
      field
    }
  }
}

/**
 * Normalize report structure from backend CheckOutput format
 * to frontend component expected format
 *
 * Transforms:
 * - timeline: array -> { entries: array, trends: object }
 * - errors[].visitIndex -> errors[].location.visitIndex
 *
 * @param {Object} raw - Raw report from backend
 * @returns {Object} Normalized report for frontend components
 */
export function normalizeReport(raw) {
  if (!raw) {
    return {
      timeline: { entries: [], trends: {} },
      errors: []
    }
  }

  const { timeline = [], errors = [], ...rest } = raw

  const entries = [...timeline]
  const trends = calculateTrends(entries)

  const normalizedErrors = errors.map(normalizeError)

  return {
    ...rest,
    timeline: {
      entries,
      trends
    },
    errors: normalizedErrors
  }
}
