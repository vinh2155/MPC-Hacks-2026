import { useState, useEffect } from 'react'
import { fmtCurrency } from '../lib/format'

// ── Types ─────────────────────────────────────────────────────────────────────

type Period   = 'day' | 'month' | '3months' | '6months' | 'year' | 'all'
type SortMode = 'score_desc' | 'score_asc' | 'alpha'

interface EmployeeRanking {
  name: string
  rank: number
  score: number
  totalSpend: number
  transactionCount: number
  preauthViolations: number
  splitPairCount: number
  approvedRequests: number
  deniedRequests: number
}

interface RankingsResponse {
  period: Period
  teamAverageSpend: number
  employees: EmployeeRanking[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day',     label: 'Last Day' },
  { value: 'month',   label: 'Last Month' },
  { value: '3months', label: 'Last 3 Months' },
  { value: '6months', label: 'Last 6 Months' },
  { value: 'year',    label: 'Last Year' },
  { value: 'all',     label: 'All Time' },
]

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'score_desc', label: 'Best Score First' },
  { value: 'score_asc',  label: 'Worst Score First' },
  { value: 'alpha',      label: 'A → Z' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreStyle(score: number) {
  if (score >= 90) return { bg: 'rgba(52,217,135,0.12)',  text: '#34D987', border: 'rgba(52,217,135,0.25)',  grade: 'A' }
  if (score >= 75) return { bg: 'rgba(96,165,250,0.12)',  text: '#60A5FA', border: 'rgba(96,165,250,0.25)',  grade: 'B' }
  if (score >= 60) return { bg: 'rgba(251,191,36,0.12)',  text: '#FBBF24', border: 'rgba(251,191,36,0.25)',  grade: 'C' }
  return              { bg: 'rgba(245,88,88,0.12)',   text: '#F55858',  border: 'rgba(245,88,88,0.25)',   grade: 'F' }
}

function rankMedal(rank: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

const selectStyle = {
  borderRadius: '8px',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  fontSize: '14px',
  outline: 'none',
  padding: '8px 12px',
  minWidth: '160px',
}

// ── RankingsPage ──────────────────────────────────────────────────────────────

export default function RankingsPage() {
  const [period, setPeriod]           = useState<Period>('all')
  const [sort, setSort]               = useState<SortMode>('score_desc')
  const [data, setData]               = useState<RankingsResponse | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [insights, setInsights]       = useState<Record<string, string> | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setInsights(null)
    fetch(`/api/rankings?period=${period}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() as Promise<RankingsResponse> : Promise.reject(`HTTP ${r.status}`))
      .then(d => setData(d))
      .catch(err => { if ((err as Error).name !== 'AbortError') setError(String(err)) })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [period])

  useEffect(() => {
    if (!data || data.employees.length === 0) return
    const controller = new AbortController()
    setInsightsLoading(true)
    fetch('/api/rankings/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period }),
      signal: controller.signal,
    })
      .then(r => r.ok ? r.json() as Promise<{ insights: Record<string, string> }> : Promise.reject())
      .then(d => setInsights(d.insights))
      .catch(err => { if ((err as Error).name !== 'AbortError') setInsights({}) })
      .finally(() => setInsightsLoading(false))
    return () => controller.abort()
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = data
    ? [...data.employees].sort((a, b) => {
        if (sort === 'alpha')      return a.name.localeCompare(b.name)
        if (sort === 'score_asc')  return a.score - b.score
        return b.score - a.score
      })
    : []

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Employee Rankings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Compliance scores based on spending patterns and policy violations.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-end gap-4 mb-6 flex-wrap">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Period
          </label>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as Period)}
            style={{ ...selectStyle, minWidth: '160px' }}
          >
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Sort By
          </label>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortMode)}
            style={{ ...selectStyle, minWidth: '180px' }}
          >
            {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
          <span className="inline-block w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          Loading rankings…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(245,88,88,0.10)', color: '#F55858', border: '1px solid rgba(245,88,88,0.25)' }}>
          {error}
        </div>
      )}

      {/* Rankings */}
      {!loading && !error && data && (
        <>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Team average spend this period:{' '}
            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>${fmtCurrency(data.teamAverageSpend)}</span>
          </p>

          <div className="space-y-3">
            {sorted.map(emp => {
              const s = scoreStyle(emp.score)
              const totalViolations = emp.preauthViolations + emp.splitPairCount
              return (
                <div
                  key={emp.name}
                  className="rounded-xl p-5"
                  style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex items-center gap-5">
                    {/* Rank medal */}
                    <div className="flex-shrink-0 w-10 text-center text-lg font-bold tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {rankMedal(emp.rank)}
                    </div>

                    {/* Score badge */}
                    <div
                      className="flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center"
                      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
                    >
                      <span className="text-2xl font-black leading-none" style={{ color: s.text }}>{s.grade}</span>
                      <span className="text-xs font-bold mt-0.5" style={{ color: s.text }}>{emp.score}</span>
                    </div>

                    {/* Name + stats */}
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{emp.name}</p>
                      <div className="flex flex-wrap gap-x-4 mt-0.5">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Spend:{' '}
                          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>${fmtCurrency(emp.totalSpend)}</span>
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Transactions:{' '}
                          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{emp.transactionCount}</span>
                        </span>
                        {emp.approvedRequests + emp.deniedRequests > 0 && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Requests:{' '}
                            <span className="font-medium" style={{ color: '#34D987' }}>{emp.approvedRequests} approved</span>
                            {emp.deniedRequests > 0 && (
                              <span className="font-medium" style={{ color: '#F55858' }}> · {emp.deniedRequests} denied</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Violation chips */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {emp.preauthViolations > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(245,88,88,0.12)', color: '#F55858', border: '1px solid rgba(245,88,88,0.20)' }}>
                          {emp.preauthViolations} pre-auth
                        </span>
                      )}
                      {emp.splitPairCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(251,191,36,0.12)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.20)' }}>
                          {emp.splitPairCount} split
                        </span>
                      )}
                      {totalViolations === 0 && (
                        <span className="text-xs font-medium" style={{ color: '#34D987' }}>No violations</span>
                      )}
                    </div>
                  </div>

                  {/* AI insight */}
                  {insightsLoading && !insights && (
                    <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span className="inline-block w-3 h-3 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                      Generating AI insight…
                    </div>
                  )}
                  {insights?.[emp.name] && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.20)' }}>
                      <span className="text-xs mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }}>✦</span>
                      <p className="text-xs leading-relaxed italic" style={{ color: 'var(--text-secondary)' }}>{insights[emp.name]}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Score legend */}
          <div className="mt-8 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold mr-1" style={{ color: 'var(--text-muted)' }}>Score:</span>
            {[
              { label: 'A · 90–100 Excellent', ...scoreStyle(95) },
              { label: 'B · 75–89 Good',       ...scoreStyle(80) },
              { label: 'C · 60–74 Fair',        ...scoreStyle(65) },
              { label: 'F · 0–59 Poor',         ...scoreStyle(40) },
            ].map(g => (
              <span key={g.grade} className="px-2.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: g.bg, color: g.text, border: `1px solid ${g.border}` }}>
                {g.label}
              </span>
            ))}
            <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
              Deductions: −8 per pre-auth flag · −12 per split-charge pair · −5 per denied request
            </span>
          </div>
        </>
      )}
    </div>
  )
}
