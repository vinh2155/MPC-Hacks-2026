import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export interface ComplianceScore {
  score: number
  totalTransactions: number
  violationCount: number
}

interface ComplianceContextValue {
  scoreData: ComplianceScore | null
  refetchScore: () => Promise<void>
}

const ComplianceContext = createContext<ComplianceContextValue | null>(null)

function isValidScore(v: unknown): v is ComplianceScore {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.score === 'number' &&
    typeof o.totalTransactions === 'number' &&
    typeof o.violationCount === 'number'
  )
}

export function ComplianceProvider({ children }: { children: ReactNode }) {
  const [scoreData, setScoreData] = useState<ComplianceScore | null>(null)

  const refetchScore = useCallback(async () => {
    try {
      const res = await fetch('/api/compliance/score')
      if (!res.ok) return
      const json: unknown = await res.json()
      if (isValidScore(json)) setScoreData(json)
    } catch {
      // score is optional — silently ignore
    }
  }, [])

  useEffect(() => {
    refetchScore()
  }, [refetchScore])

  return (
    <ComplianceContext.Provider value={{ scoreData, refetchScore }}>
      {children}
    </ComplianceContext.Provider>
  )
}

export function useCompliance(): ComplianceContextValue {
  const ctx = useContext(ComplianceContext)
  if (!ctx) throw new Error('useCompliance must be used within ComplianceProvider')
  return ctx
}
