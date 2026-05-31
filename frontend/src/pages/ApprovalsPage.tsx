import { useState, useEffect } from 'react'
import { useBudget } from '../context/BudgetContext'
import { fmtCurrency, pctOf } from '../lib/format'
import type { Request } from '../lib/types'

type RecValue = 'approve' | 'deny' | 'escalate'

interface Recommendation {
  recommendation: RecValue
  reasoning: string
}

const REC_CHIP: Record<RecValue, string> = {
  approve:  'bg-[rgba(52,217,135,0.12)] text-[#34D987]',
  deny:     'bg-[rgba(245,88,88,0.12)] text-[#F55858]',
  escalate: 'bg-[rgba(155,111,255,0.12)] text-[#9B6FFF]',
}

const REC_LABEL: Record<RecValue, string> = {
  approve: 'Approve', deny: 'Deny', escalate: 'Escalate',
}

const RESOLVED_BADGE: Record<'approved' | 'denied', string> = {
  approved: 'bg-[rgba(52,217,135,0.12)] text-[#34D987]',
  denied:   'bg-[rgba(245,88,88,0.12)] text-[#F55858]',
}

export default function ApprovalsPage({ onDecide }: { onDecide?: () => void }) {
  const { data: budgetData, refetch } = useBudget()
  const [requests, setRequests] = useState<Request[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation | null>>({})
  const [deciding, setDeciding] = useState<Record<string, 'approved' | 'denied' | undefined>>({})
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
    setDecideErrors(prev => ({ ...prev, [id]: '' }))
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
  const resolved = requests.filter(
    (r): r is Request & { status: 'approved' | 'denied' } =>
      r.status === 'approved' || r.status === 'denied'
  )

  return (
    <div className="p-6 lg:p-8">
      <header className="mb-6">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Approvals Inbox</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Review and act on employee spend requests.</p>
      </header>

      {loadingRequests && (
        <div className="flex items-center justify-center py-16" style={{ color: 'var(--text-muted)' }}>
          <span
            className="inline-block w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mr-3"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
          Loading requests…
        </div>
      )}

      {!loadingRequests && fetchError && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            backgroundColor: 'rgba(245,88,88,0.10)',
            border: '1px solid rgba(245,88,88,0.30)',
            color: 'var(--accent-red)',
          }}
        >
          {fetchError}
        </div>
      )}

      {!loadingRequests && !fetchError && (
        <>
          <section className="mb-10">
            <h3
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}
            >
              Pending ({pending.length})
            </h3>

            {pending.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>No pending requests.</p>
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
                    <li
                      key={req.id}
                      className="rounded-xl p-5"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{req.employee_name}</p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{req.item_description}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                            ${fmtCurrency(req.amount)}
                          </p>
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                          >
                            {req.category}
                          </span>
                        </div>
                      </div>

                      {req.reason && (
                        <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{req.reason}</p>
                      )}

                      {budgetData && (
                        <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          Budget impact if approved:{' '}
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            ${fmtCurrency(budgetData.totalSpend + req.amount)}
                          </span>
                          {' → '}
                          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {pctOf(budgetData.totalSpend + req.amount, budgetData.totalBudget)}% of budget
                          </span>
                        </p>
                      )}

                      <div className="mt-3 flex items-start gap-2 flex-wrap">
                        {recLoading && (
                          <>
                            <span
                              className="inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5"
                              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
                            />
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Fetching AI recommendation…</span>
                          </>
                        )}
                        {recDone && rec && (
                          <div className="w-full">
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase ${REC_CHIP[rec.recommendation]}`}>
                              {REC_LABEL[rec.recommendation]}
                            </span>
                            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{rec.reasoning}</p>
                          </div>
                        )}
                        {!recLoading && !recDone && (
                          <span className="text-xs italic" style={{ color: 'var(--text-muted)' }}>AI recommendation unavailable</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-4">
                        <button
                          onClick={() => void decide(req.id, 'approved')}
                          disabled={isDeciding}
                          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          style={{ backgroundColor: 'var(--accent-green)' }}
                        >
                          {decidingAction === 'approved' ? 'Saving…' : 'Approve'}
                        </button>
                        <button
                          onClick={() => void decide(req.id, 'denied')}
                          disabled={isDeciding}
                          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          style={{ backgroundColor: 'var(--accent-red)' }}
                        >
                          {decidingAction === 'denied' ? 'Saving…' : 'Deny'}
                        </button>
                      </div>

                      {decideError && (
                        <p className="mt-2 text-xs" style={{ color: 'var(--accent-red)' }}>{decideError}</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section>
            <h3
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}
            >
              Resolved ({resolved.length})
            </h3>

            {resolved.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>No resolved requests yet.</p>
            ) : (
              <ul className="space-y-2">
                {resolved.map(req => (
                  <li
                    key={req.id}
                    className="rounded-xl p-4 opacity-70"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{req.employee_name}</p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{req.item_description}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase ${RESOLVED_BADGE[req.status]}`}>
                          {req.status}
                        </span>
                        <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
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
