import { fetchWithCache } from './api'

// ECB Data Portal (replaces the retired SDW REST endpoint
// https://sdw-wsrest.ecb.europa.eu/service/data which was decommissioned
// in 2024). The SDMX-JSON response shape is unchanged, so downstream
// parsing below continues to work.
const BASE_URL = 'https://data-api.ecb.europa.eu/service/data'

/**
 * Fetch ECB data via the ECB Data Portal SDMX REST API.
 * seriesKey example: 'EXR/M.USD.EUR.SP00.A' or 'ICP/M.IE.N.000000.4.ANR'
 * Returns an array of { period, value } sorted by period.
 */
export async function fetchECBData(seriesKey) {
  const url = `${BASE_URL}/${seriesKey}?format=jsondata`
  const raw = await fetchWithCache(url)

  const results = []

  // SDMX jsondata structure
  const dataSets = raw.dataSets
  if (!dataSets || dataSets.length === 0) {
    return results
  }

  const series = dataSets[0].series
  if (!series) {
    return results
  }

  // Time periods are in the observation-level dimension
  const obsDimensions = raw.structure?.dimensions?.observation || []
  const timeDim = obsDimensions.find(
    (d) => d.id === 'TIME_PERIOD' || d.role === 'time'
  )
  const timeValues = timeDim?.values || []

  // Iterate over all series keys
  for (const seriesIdx of Object.keys(series)) {
    const observations = series[seriesIdx].observations
    if (!observations) continue

    for (const [obsIdx, obsValue] of Object.entries(observations)) {
      const value = obsValue[0]
      if (value === null || value === undefined) continue

      const timeEntry = timeValues[parseInt(obsIdx, 10)]
      const period = timeEntry?.id || timeEntry?.name || obsIdx

      results.push({ period, value })
    }
  }

  results.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0))
  return results
}
