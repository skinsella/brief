import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook for fetching API data with loading/error states and caching.
 * Uses a ref to avoid stale closures and dependency-array bugs.
 */
export function useApiData(fetchFn) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchRef.current()
      setData(result)
    } catch (err) {
      setError(err.message)
      console.error('API fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
