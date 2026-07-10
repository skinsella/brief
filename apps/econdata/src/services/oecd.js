import { fetchWithCache } from './api'

const BASE_URL = 'https://sdmx.oecd.org/public/rest/data'

/**
 * Fetch OECD data via SDMX REST API.
 * dataflow example: 'OECD.SDD.NAD,SNA_TABLE1,1.0'
 * key example: 'A.IRL.GDP+B1GQ.C'
 * Returns an array of { period, value } sorted by period.
 * Falls back gracefully on CORS or network errors.
 */
export async function fetchOECDData(dataflow, key) {
  const url = `${BASE_URL}/${dataflow}/${key}?format=jsondata`

  try {
    const raw = await fetchWithCache(url)

    const results = []

    const dataSets = raw.dataSets
    if (!dataSets || dataSets.length === 0) {
      return results
    }

    const series = dataSets[0].series
    if (!series) {
      return results
    }

    // Time periods from observation-level dimensions
    const obsDimensions = raw.structure?.dimensions?.observation || []
    const timeDim = obsDimensions.find(
      (d) => d.id === 'TIME_PERIOD' || d.role === 'time'
    )
    const timeValues = timeDim?.values || []

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
  } catch (err) {
    console.warn(
      `OECD data fetch failed (possibly CORS): ${err.message}. Returning empty dataset.`
    )
    return []
  }
}
