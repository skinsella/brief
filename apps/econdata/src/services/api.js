const cache = new Map()
const DEFAULT_TTL = 60 * 60 * 1000 // 1 hour

export async function fetchWithCache(url, options = {}) {
  const { ttl = DEFAULT_TTL, headers = {} } = options
  const cacheKey = url

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data
  }

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json', ...headers },
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  cache.set(cacheKey, { data, timestamp: Date.now() })
  return data
}

export function clearCache() {
  cache.clear()
}
