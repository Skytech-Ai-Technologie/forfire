import { useEffect, useRef, useState } from 'react'

export function useAsyncData<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const loaderRef = useRef(loader)
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const depsKey = JSON.stringify(deps)

  useEffect(() => {
    loaderRef.current = loader
  })

  useEffect(() => {
    let active = true
    loaderRef.current()
      .then((next) => {
        if (!active) return
        setData(next)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setData(null)
        setError(reason instanceof Error ? reason.message : 'Something went wrong. Try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [tick, depsKey])

  return {
    data,
    error,
    loading,
    reload: () => setTick((value) => value + 1),
  }
}
