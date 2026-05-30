import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export interface BudgetSummary {
  totalSpend: number
  totalBudget: number
  utilizationPct: number
  byCategory: { label: string; amount: number }[]
}

interface BudgetContextValue {
  data: BudgetSummary | null
  error: boolean
  refetch: () => void
}

const BudgetContext = createContext<BudgetContextValue | null>(null)

const POLL_MS = 5_000

function isValidSummary(v: unknown): v is BudgetSummary {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.totalSpend === 'number' &&
    typeof o.totalBudget === 'number' &&
    typeof o.utilizationPct === 'number' &&
    Array.isArray(o.byCategory)
  )
}

export function BudgetProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<BudgetSummary | null>(null)
  const [error, setError] = useState(false)

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/budget/summary')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: unknown = await res.json()
      if (!isValidSummary(json)) throw new Error('invalid response shape')
      setData(json)
      setError(false)
    } catch {
      setData(null)
      setError(true)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
    const id = setInterval(fetchSummary, POLL_MS)
    return () => clearInterval(id)
  }, [fetchSummary])

  return (
    <BudgetContext.Provider value={{ data, error, refetch: fetchSummary }}>
      {children}
    </BudgetContext.Provider>
  )
}

export function useBudget(): BudgetContextValue {
  const ctx = useContext(BudgetContext)
  if (!ctx) throw new Error('useBudget must be used within BudgetProvider')
  return ctx
}
