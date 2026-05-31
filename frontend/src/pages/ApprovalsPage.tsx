import { useState, useEffect } from 'react'
import { useBudget } from '../context/BudgetContext'
import { fmtCurrency, pctOf } from '../lib/format'
import type { Request } from '../lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type RecValue = 'approve' | 'deny' | 'escalate'

interface Recommendation {
  recommendation: RecValue
  reasoning: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REC_CHIP: Record<RecValue, string> = {
  approve:  'bg-emerald-100 text-emerald-700',
  deny:     'bg-red-100 text-red-700',
  escalate: 'bg-amber-100 text-amber-700',
}

const REC_LABEL: Record<RecValue, string> = {
  approve: 'Approve', deny: 'Deny', escalate: 'Escalate',
}

const RESOLVED_BADGE: Record<'approved' | 'denied', string> = {
  approved: 'bg-emerald-100 text-emerald-700',
  denied:   'bg-red-100 text-red-700',
}

// ── ApprovalsPage ─────────────────────────────────────────────────────────────

export default function ApprovalsPage({ onDecide }: { onDecide?: () => void }) {
  const { data: budgetData, refetch } = useBudget()

  const [requests, setRequests] = useState<Request[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  // null = fetch in flight; missing key = not fetched / failed; Recommendation = done
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation | null>>({})
  // tracks which action ('approved' | 'denied') is in flight per card; undefined = idle
  const [deciding, setDeciding] = useState<Record<string, 'approved' | 'denied' | undefined>>({})
  // C1: per-card error message shown below buttons when PATCH fails
  const [decideErrors, setDecideErrors] = useState<Record<string, string>>({})

  async function fetchRecommendation(id: string) {
    setRecommendations(prev => ({ ...prev, [id]: null }))
    try {
      const res = await fetch(`/api/requests/${id}/recommendation`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const data = await res.json() as Recommendation
      setRecommendations(prev => ({ ...prev, [id]: data }))
    } catch {
      setRecommendations(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  async function fetchRequests() {
    setLoadingRequests(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/requests')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as Request[]
      setRequests(data)
      data.filter(r => r.status === 'pending').forEach(r => void fetchRecommendation(r.id))
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load requests')
    } finally {
      setLoadingRequests(false)
    }
  }

  async function decide(id: string, newStatus: 'approved' | 'denied') {
    setDeciding(prev => ({ ...prev, [id]: newStatus }))
    setDecideErrors(prev => ({ ...prev, [id]: '' })) // clear previous error
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const updated = await res.json() as Request
      setRequests(prev => prev.map(r => r.id === id ? updated : r))
      refetch()
      onDecide?.()
    } catch (err) {
      // C1: surface the failure inline so manager knows the action didn't save
      setDecideErrors(prev => ({
        ...prev,
        [id]: err instanceof Error ? err.message : 'Failed to save — please try again',
      }))
    } finally {
      setDeciding(prev => ({ ...prev, [id]: undefined }))
    }
  }

  useEffect(() => { void fetchRequests() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pending = requests.filter(r => r.status === 'pending')
  // C4: type predicate narrows status to 'approved' | 'denied' — no cast needed
  const resolved = requests.filter(
    (r): r is Request & { status: 'approved' | 'denied' } =>
      r.status === 'approved' || r.status === 'denied'
  )

  return (
    <div className="p-8">
      {/* Header */}
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Approvals Inbox</h2>
        <p className="text-sm text-gray-500 mt-1">Review and act on employee spend requests.</p>
      </header>

      {/* Page-level loading */}
      {loadingRequests && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <span className="inline-block w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-3" />
          Loading requests…
        </div>
      )}

      {/* Page-level error */}
      {!loadingRequests && fetchError && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {fetchError}
        </div>
      )}

      {/* Main content */}
      {!loadingRequests && !fetchError && (
        <>
          {/* Pending section */}
          <section className="mb-10">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Pending ({pending.length})
            </h3>

            {pending.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No pending requests.</p>
            ) : (
              <ul className="space-y-4">
                {pending.map(req => {
                  const rec = recommendations[req.id]
                  const recLoading = req.id in recommendations && rec === null
                  const recDone = req.id in recommendations && rec !== null
                  const decidingAction = deciding[req.id]
                  const isDeciding = decidingAction !== undefined
                  const decideError = decideErrors[req.id]

                  return (
                    <li key={req.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{req.employee_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{req.item_description}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold text-gray-900 tabular-nums">
                            ${fmtCurrency(req.amount)}
                          </p>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {req.category}
                          </span>
                        </div>
                      </div>

                      {/* Reason */}
                      {req.reason && (
                        <p className="mt-2 text-xs text-gray-500 leading-relaxed">{req.reason}</p>
                      )}

                      {/* Budget impact */}
                      {budgetData && (
                        <p className="mt-2 text-xs text-gray-500">
                          Budget impact if approved:{' '}
                          <span className="font-medium text-gray-700">
                            ${fmtCurrency(budgetData.totalSpend + req.amount)}
                          </span>
                          {' → '}
                          <span className="font-medium text-gray-700">
                            {pctOf(budgetData.totalSpend + req.amount, budgetData.totalBudget)}% of budget
                          </span>
                        </p>
                      )}

                      {/* AI recommendation */}
                      <div className="mt-3 flex items-start gap-2 flex-wrap">
                        {recLoading && (
                          <>
                            <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-gray-400">Fetching AI recommendation…</span>
                          </>
                        )}
                        {recDone && rec && (
                          <div className="w-full">
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase ${REC_CHIP[rec.recommendation]}`}>
                              {REC_LABEL[rec.recommendation]}
                            </span>
                            <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{rec.reasoning}</p>
                          </div>
                        )}
                        {!recLoading && !recDone && (
                          <span className="text-xs text-gray-400 italic">AI recommendation unavailable</span>
                        )}
                      </div>

                      {/* Approve / Deny buttons */}
                      <div className="flex items-center gap-3 mt-4">
                        <button
                          onClick={() => void decide(req.id, 'approved')}
                          disabled={isDeciding}
                          className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {/* C5: only the button that was clicked shows "Saving…" */}
                          {decidingAction === 'approved' ? 'Saving…' : 'Approve'}
                        </button>
                        <button
                          onClick={() => void decide(req.id, 'denied')}
                          disabled={isDeciding}
                          className="rounded-md bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {decidingAction === 'denied' ? 'Saving…' : 'Deny'}
                        </button>
                      </div>

                      {/* C1: per-card error shown when PATCH fails */}
                      {decideError && (
                        <p className="mt-2 text-xs text-red-600">{decideError}</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Resolved section */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Resolved ({resolved.length})
            </h3>

            {resolved.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No resolved requests yet.</p>
            ) : (
              <ul className="space-y-3">
                {resolved.map(req => (
                  <li key={req.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 opacity-80">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-700">{req.employee_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{req.item_description}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* C4: status is narrowed to 'approved' | 'denied' by the type predicate filter — no cast */}
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase ${RESOLVED_BADGE[req.status]}`}>
                          {req.status}
                        </span>
                        <p className="text-sm font-bold text-gray-700 tabular-nums">
                          ${fmtCurrency(req.amount)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
