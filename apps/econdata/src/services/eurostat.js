import { fetchWithCache } from './api'

const BASE_URL = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data'

/**
 * Build a Eurostat API URL.
 * params values can be strings or arrays (for multi-value dimensions like geo).
 */
function buildUrl(dataset, params) {
  const queryParams = new URLSearchParams({ format: 'JSON' })
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === null || val === '') continue
    if (Array.isArray(val)) {
      val.forEach((v) => queryParams.append(key, v))
    } else {
      queryParams.append(key, val)
    }
  }
  return `${BASE_URL}/${dataset}?${queryParams.toString()}`
}

/**
 * Parse dimension info from a Eurostat JSON response.
 */
function parseDimension(raw, dimName) {
  const dim = raw.dimension?.[dimName]?.category
  if (!dim) return null
  const index = dim.index || {}
  const label = dim.label || {}
  // Build position → code and position → label lookups
  const posToCode = {}
  const posToLabel = {}
  for (const [code, position] of Object.entries(index)) {
    posToCode[position] = code
    posToLabel[position] = label[code] || code
  }
  return { index, label, posToCode, posToLabel, size: Object.keys(index).length }
}

/**
 * Fetch Eurostat data (single series).
 * Returns an array of { period, value } sorted by period.
 */
export async function fetchEurostatData(dataset, params = {}) {
  const url = buildUrl(dataset, params)
  const raw = await fetchWithCache(url)

  const results = []

  const timeDim =
    raw.dimension?.time?.category ||
    raw.dimension?.TIME_PERIOD?.category ||
    null

  if (!timeDim || !raw.value) {
    return results
  }

  const timeIndex = timeDim.index
  const timeLabel = timeDim.label || {}

  const positionToperiod = {}
  if (typeof timeIndex === 'object' && !Array.isArray(timeIndex)) {
    for (const [code, position] of Object.entries(timeIndex)) {
      positionToperiod[position] = timeLabel[code] || code
    }
  }

  const dimIds = raw.id || []
  const dimSizes = raw.size || []
  const timeKey = dimIds.find(
    (d) => d.toLowerCase() === 'time' || d.toLowerCase() === 'time_period'
  )
  const timeDimIdx = dimIds.indexOf(timeKey)
  const timeSize = timeDimIdx >= 0 ? dimSizes[timeDimIdx] : Object.keys(timeIndex).length

  const totalBeforeTime = timeDimIdx >= 0
    ? dimSizes.slice(timeDimIdx + 1).reduce((a, b) => a * b, 1)
    : 1

  for (const [flatIdx, val] of Object.entries(raw.value)) {
    if (val === null || val === undefined) continue

    const idx = parseInt(flatIdx, 10)
    const timePos = Math.floor(idx / totalBeforeTime) % timeSize
    const period = positionToperiod[timePos] || String(timePos)

    results.push({ period, value: val })
  }

  results.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0))
  return results
}

/**
 * Fetch Eurostat data for multiple countries (peer comparison).
 * Pass geo as an array: { geo: ['IE', 'EA20', 'EU27_2020', 'DE', 'NL'], ... }
 * Returns an array of { period, value, geo, geoLabel } sorted by geo then period.
 */
export async function fetchEurostatMultiGeo(dataset, params = {}) {
  const url = buildUrl(dataset, params)
  const raw = await fetchWithCache(url)

  if (!raw.value || !raw.id || !raw.size) return []

  const dimIds = raw.id
  const dimSizes = raw.size

  // Find geo and time dimension indices
  const geoDimIdx = dimIds.indexOf('geo')
  const timeDimIdx = dimIds.findIndex(
    (d) => d.toLowerCase() === 'time' || d.toLowerCase() === 'time_period'
  )

  if (geoDimIdx < 0 || timeDimIdx < 0) return []

  const geoDim = parseDimension(raw, 'geo')
  const timeKey = dimIds[timeDimIdx]
  const timeDim = parseDimension(raw, timeKey)

  if (!geoDim || !timeDim) return []

  const results = []

  for (const [flatIdx, val] of Object.entries(raw.value)) {
    if (val === null || val === undefined) continue

    const idx = parseInt(flatIdx, 10)

    // Compute dimension indices from flat index (row-major order)
    let remainder = idx
    const indices = []
    for (let d = dimIds.length - 1; d >= 0; d--) {
      indices[d] = remainder % dimSizes[d]
      remainder = Math.floor(remainder / dimSizes[d])
    }

    const geoCode = geoDim.posToCode[indices[geoDimIdx]]
    const geoLabel = geoDim.posToLabel[indices[geoDimIdx]]
    const period = timeDim.posToLabel[indices[timeDimIdx]]

    results.push({ period, value: val, geo: geoCode, geoLabel })
  }

  results.sort((a, b) => {
    if (a.geo !== b.geo) return a.geo < b.geo ? -1 : 1
    return a.period < b.period ? -1 : a.period > b.period ? 1 : 0
  })

  return results
}

/**
 * Fetch Eurostat data for multiple values of a given dimension.
 * dimName: the dimension to split on (e.g., 'na_item', 'cofog99')
 * Returns an array of { period, value, [dimName]: code, label } sorted by period.
 */
export async function fetchEurostatMultiDim(dataset, params = {}, dimName) {
  const url = buildUrl(dataset, params)
  const raw = await fetchWithCache(url)

  if (!raw.value || !raw.id || !raw.size) return []

  const dimIds = raw.id
  const dimSizes = raw.size

  const splitDimIdx = dimIds.indexOf(dimName)
  const timeDimIdx = dimIds.findIndex(
    (d) => d.toLowerCase() === 'time' || d.toLowerCase() === 'time_period'
  )

  if (splitDimIdx < 0 || timeDimIdx < 0) return []

  const splitDim = parseDimension(raw, dimName)
  const timeKey = dimIds[timeDimIdx]
  const timeDim = parseDimension(raw, timeKey)

  if (!splitDim || !timeDim) return []

  const results = []

  for (const [flatIdx, val] of Object.entries(raw.value)) {
    if (val === null || val === undefined) continue

    const idx = parseInt(flatIdx, 10)
    let remainder = idx
    const indices = []
    for (let d = dimIds.length - 1; d >= 0; d--) {
      indices[d] = remainder % dimSizes[d]
      remainder = Math.floor(remainder / dimSizes[d])
    }

    const code = splitDim.posToCode[indices[splitDimIdx]]
    const label = splitDim.posToLabel[indices[splitDimIdx]]
    const period = timeDim.posToLabel[indices[timeDimIdx]]

    results.push({ period, value: val, code, label })
  }

  results.sort((a, b) => a.period < b.period ? -1 : a.period > b.period ? 1 : 0)
  return results
}
