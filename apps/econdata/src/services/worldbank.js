import { fetchWithCache } from './api'

const BASE_URL = 'https://api.worldbank.org/v2'

/**
 * Fetch World Bank indicator data for a country.
 * country example: 'IRL' (ISO 3-letter code)
 * indicator example: 'NY.GDP.MKTP.CD'
 * Returns an array of { period, value } sorted by period.
 */
export async function fetchWorldBankData(country, indicator, startYear, endYear) {
  const url = `${BASE_URL}/country/${country}/indicator/${indicator}?date=${startYear}:${endYear}&format=json&per_page=100`
  const raw = await fetchWithCache(url)

  // World Bank response is [paginationInfo, dataArray]
  if (!Array.isArray(raw) || raw.length < 2 || !Array.isArray(raw[1])) {
    return []
  }

  const dataArray = raw[1]

  const results = dataArray
    .filter((item) => item.value !== null && item.value !== undefined)
    .map((item) => ({
      period: item.date,
      value: item.value,
    }))

  results.sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0))
  return results
}
