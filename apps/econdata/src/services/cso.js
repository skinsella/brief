import { fetchWithCache } from './api'

const BASE_URL = 'https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset'

/**
 * Unwrap a JSON-stat 2.0 response.
 * Some CSO datasets return the dataset directly at top level (class: "dataset"),
 * while others nest it under a key like the dataset ID.
 */
function unwrapDataset(raw) {
  // If it has dimension/id/value directly, it IS the dataset
  if (raw.id && raw.dimension && raw.value) return raw
  // Otherwise look for a nested dataset object
  const datasetKey = Object.keys(raw).find(
    (k) => k !== 'version' && k !== 'class' && typeof raw[k] === 'object' && raw[k]?.id
  )
  return datasetKey ? raw[datasetKey] : raw
}

/**
 * Fetch and transform CSO PxStat data in JSON-stat 2.0 format.
 * Returns an array of { period, value, label } objects.
 */
export async function fetchCSOData(datasetId) {
  const url = `${BASE_URL}/${datasetId}/JSON-stat/2.0/en`
  const raw = await fetchWithCache(url)

  const dataset = unwrapDataset(raw)

  const { dimension, id: dimIds, size, value: values } = dataset

  if (!dimIds || !size || !values) {
    throw new Error(`Unexpected CSO response structure for dataset ${datasetId}`)
  }

  // Build arrays of labels for each dimension
  const dimLabels = dimIds.map((dimId) => {
    const dim = dimension[dimId]
    const catIndex = dim.category.index
    const catLabel = dim.category.label

    // category.index can be an object { code: position } or an array
    let ordered
    if (Array.isArray(catIndex)) {
      ordered = catIndex
    } else {
      ordered = Object.entries(catIndex)
        .sort((a, b) => a[1] - b[1])
        .map(([code]) => code)
    }

    return ordered.map((code) => ({
      code,
      label: catLabel[code] || code,
    }))
  })

  // Find the TIME dimension index
  const timeIdx = dimIds.findIndex(
    (d) => d.toUpperCase().includes('TIME') || d.toUpperCase().includes('TLIST')
  )

  // Reconstruct multi-dimensional indices from the flat value array
  const results = []
  const totalSize = values.length

  for (let flatIdx = 0; flatIdx < totalSize; flatIdx++) {
    const val = values[flatIdx]
    if (val === null || val === undefined) continue

    // Compute the index for each dimension from the flat index
    let remainder = flatIdx
    const indices = []
    for (let d = dimIds.length - 1; d >= 0; d--) {
      indices[d] = remainder % size[d]
      remainder = Math.floor(remainder / size[d])
    }

    const period = timeIdx >= 0 ? dimLabels[timeIdx][indices[timeIdx]].label : String(flatIdx)

    // Build a combined label from non-time dimensions
    const labelParts = dimIds
      .map((_, d) => (d !== timeIdx ? dimLabels[d][indices[d]].label : null))
      .filter(Boolean)

    results.push({
      period,
      value: val,
      label: labelParts.join(' - '),
    })
  }

  return results
}

/**
 * Fetch CSO data with dimension filtering.
 * filters is an object mapping dimension IDs (or 'STATISTIC') to desired codes.
 * Returns an array of { period, value } sorted by period.
 *
 * Example:
 *   fetchCSOSeries('NDQ01', { STATISTIC: 'NDQ01C02', C02342V02816: '-' })
 */
export async function fetchCSOSeries(datasetId, filters = {}) {
  const url = `${BASE_URL}/${datasetId}/JSON-stat/2.0/en`
  const raw = await fetchWithCache(url)

  // JSON-stat 2.0: dataset may be at top level (class: "dataset") or nested under a key
  const dataset = unwrapDataset(raw)

  const { dimension, id: dimIds, size, value: values } = dataset

  if (!dimIds || !size || !values) {
    throw new Error(`Unexpected CSO response structure for dataset ${datasetId}`)
  }

  // Build ordered code arrays for each dimension
  const dimCodes = dimIds.map((dimId) => {
    const dim = dimension[dimId]
    const catIndex = dim.category.index
    if (Array.isArray(catIndex)) return catIndex
    return Object.entries(catIndex)
      .sort((a, b) => a[1] - b[1])
      .map(([code]) => code)
  })

  const dimLabelsMap = dimIds.map((dimId) => {
    const dim = dimension[dimId]
    return dim.category.label || {}
  })

  // Find time dimension
  const timeIdx = dimIds.findIndex(
    (d) => d.toUpperCase().includes('TIME') || d.toUpperCase().includes('TLIST')
  )

  const results = []

  for (let flatIdx = 0; flatIdx < values.length; flatIdx++) {
    const val = values[flatIdx]
    if (val === null || val === undefined) continue

    // Compute index for each dimension
    let remainder = flatIdx
    const indices = []
    for (let d = dimIds.length - 1; d >= 0; d--) {
      indices[d] = remainder % size[d]
      remainder = Math.floor(remainder / size[d])
    }

    // Check all filters match
    let matches = true
    for (const [filterDimId, wantedCode] of Object.entries(filters)) {
      const dIdx = dimIds.indexOf(filterDimId)
      if (dIdx < 0) continue
      const actualCode = dimCodes[dIdx][indices[dIdx]]
      if (actualCode !== wantedCode) {
        matches = false
        break
      }
    }
    if (!matches) continue

    // Get period label
    const timeCode = timeIdx >= 0 ? dimCodes[timeIdx][indices[timeIdx]] : String(flatIdx)
    const period = timeIdx >= 0
      ? (dimLabelsMap[timeIdx][timeCode] || timeCode)
      : String(flatIdx)

    results.push({ period, value: val })
  }

  results.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0))
  return results
}
