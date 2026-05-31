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

function scoreStyle(score: number): { bg: string; text: string; ring: string; grade: string } {
  if (score >= 90) return { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', grade: 'A' }
  if (score >= 75) return { bg: 'bg-blue-50',    text: 'text-blue-700',    ring: 'ring-blue-200',    grade: 'B' }
  if (score >= 60) return { bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200',   grade: 'C' }
  return              { bg: 'bg-red-50',    text: 'text-red-700',    ring: 'ring-red-200',    grade: 'F' }
}

function rankMedal(rank: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
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

  // Fetch rankings whenever period changes
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

  // Auto-fetch AI insights once rankings data is ready
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
    <div className="p-8">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Employee Rankings</h2>
        <p className="text-sm text-gray-500 mt-1">
          Compliance scores based on spending patterns and policy violations.
        </p>
      </header>

      {/* Controls */}
      <div className="flex items-end gap-4 mb-6 flex-wrap">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Period
          </label>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as Period)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
          >
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Sort By
          </label>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortMode)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
          >
            {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-12 text-gray-400 text-sm">
          <span className="inline-block w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          Loading rankings…
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Rankings */}
      {!loading && !error && data && (
        <>
          {/* Team average */}
          <p className="text-xs text-gray-400 mb-4">
            Team average spend this period:{' '}
            <span className="font-semibold text-gray-600">${fmtCurrency(data.teamAverageSpend)}</span>
          </p>

          <div className="space-y-3">
            {sorted.map(emp => {
              const s = scoreStyle(emp.score)
              const totalViolations = emp.preauthViolations + emp.splitPairCount
              return (
                <div
                  key={emp.name}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                >
                  {/* Top row: rank · score · name · violations */}
                  <div className="flex items-center gap-5">
                    {/* Compliance rank medal */}
                    <div className="flex-shrink-0 w-10 text-center text-lg font-bold text-gray-400 tabular-nums">
                      {rankMedal(emp.rank)}
                    </div>

                    {/* Score badge */}
                    <div className={`flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center ring-1 ${s.bg} ${s.ring}`}>
                      <span className={`text-2xl font-black leading-none ${s.text}`}>{s.grade}</span>
                      <span className={`text-xs font-bold mt-0.5 ${s.text}`}>{emp.score}</span>
                    </div>

                    {/* Name + spend */}
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-gray-900">{emp.name}</p>
                      <div className="flex flex-wrap gap-x-4 mt-0.5">
                        <span className="text-xs text-gray-500">
                          Spend:{' '}
                          <span className="font-medium text-gray-700">${fmtCurrency(emp.totalSpend)}</span>
                        </span>
                        <span className="text-xs text-gray-500">
                          Transactions:{' '}
                          <span className="font-medium text-gray-700">{emp.transactionCount}</span>
                        </span>
                        {emp.approvedRequests + emp.deniedRequests > 0 && (
                          <span className="text-xs text-gray-500">
                            Requests:{' '}
                            <span className="font-medium text-emerald-600">{emp.approvedRequests} approved</span>
                            {emp.deniedRequests > 0 && (
                              <span className="font-medium text-red-500"> · {emp.deniedRequests} denied</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Violation chips */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {emp.preauthViolations > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-600 ring-1 ring-red-100">
                          {emp.preauthViolations} pre-auth
                        </span>
                      )}
                      {emp.splitPairCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                          {emp.splitPairCount} split
                        </span>
                      )}
                      {totalViolations === 0 && (
                        <span className="text-xs font-medium text-emerald-600">No violations</span>
                      )}
                    </div>
                  </div>

                  {/* AI insight — shown below once ready */}
                  {insightsLoading && !insights && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-indigo-400">
                      <span className="inline-block w-3 h-3 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      Generating AI insight…
                    </div>
                  )}
                  {insights?.[emp.name] && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-indigo-50 px-3 py-2">
                      <span className="text-indigo-400 text-xs mt-0.5 flex-shrink-0">✦</span>
                      <p className="text-xs text-indigo-700 leading-relaxed italic">{insights[emp.name]}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Score legend */}
          <div className="mt-8 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500 font-semibold mr-1">Score:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 font-medium">
              A · 90–100 Excellent
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200 font-medium">
              B · 75–89 Good
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 font-medium">
              C · 60–74 Fair
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 ring-1 ring-red-200 font-medium">
              F · 0–59 Poor
            </span>
            <span className="ml-2 text-gray-400">
              Deductions: −8 per pre-auth flag · −12 per split-charge pair · −5 per denied request
            </span>
          </div>
        </>
      )}
    </div>
  )
}
