import { useState } from 'react'
import { useCompliance } from '../context/ComplianceContext'
import { fmtCurrency } from '../lib/format'

interface Violation {
  transaction_code: number | null
  employee_name: string
  violation_type: string
  policy_rule_cited: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  reasoning: string
  is_repeat_offender: boolean
  related_transactions?: { transaction_code: number | null; amount: number; date: string; merchant: string }[]
}

const SEVERITY_BADGE: Record<Violation['severity'], string> = {
  critical: 'bg-[rgba(245,88,88,0.15)] text-[#F55858]',
  high:     'bg-[rgba(255,153,102,0.15)] text-[#FF9966]',
  medium:   'bg-[rgba(245,166,35,0.15)] text-[#F5A623]',
  low:      'bg-[rgba(79,130,247,0.12)] text-[#4F82F7]',
}

export default function CompliancePage() {
  const { scoreData, refetchScore } = useCompliance()

  const [violations, setViolations] = useState<Violation[]>([])
  const [scanned, setScanned] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [filterEmployee, setFilterEmployee] = useState('all')
  const [page, setPage] = useState(1)

  const PAGE_SIZE = 20

  async function runScan() {
    setScanning(true)
    setScanError(null)
    try {
      const res = await fetch('/api/compliance/scan', { method: 'POST' })
      if (!res.ok) {
        let message = `Scan failed (${res.status})`
        try {
          const errBody: unknown = await res.json()
          const e = errBody as { error?: string }
          if (typeof e.error === 'string') message = e.error
        } catch { /* ignore */ }
        throw new Error(message)
      }
      const json: unknown = await res.json()
      const raw = json as { violations?: unknown }
      const v: Violation[] = Array.isArray(raw.violations) ? (raw.violations as Violation[]) : []
      setViolations(v)
      setExpandedIds(new Set())
      setFilterSeverity('all')
      setFilterEmployee('all')
      setPage(1)
      setScanned(true)
      await refetchScore()
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  function toggleExpand(key: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const uniqueEmployees = [...new Set(violations.map(v => v.employee_name))].sort()
  const filtered = violations.filter(v =>
    (filterSeverity === 'all' || v.severity === filterSeverity) &&
    (filterEmployee === 'all' || v.employee_name === filterEmployee),
  )

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Compliance</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Scan transactions for policy violations.
          {scoreData && (
            <span className="ml-2">
              Score:{' '}
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {scoreData.score}%
              </span>
              <span className="ml-1" style={{ color: 'var(--text-muted)' }}>
                ({scoreData.violationCount} of {scoreData.totalTransactions} transactions)
              </span>
            </span>
          )}
        </p>
      </div>

      {/* Pre-scan / scanning state — center stage */}
      {!scanned && !scanning && !scanError && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
            style={{ backgroundColor: 'rgba(155,111,255,0.12)' }}
          >
            <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="#9B6FFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1L2 4v4.5A6 6 0 008 15a6 6 0 006-6.5V4L8 1z" />
              <path d="M5.5 8l1.5 1.5 3-3" />
            </svg>
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Compliance Scanner</h3>
          <p className="text-sm mb-8 max-w-sm" style={{ color: 'var(--text-secondary)' }}>
            Run a full scan of all transactions against your policy rules to surface violations.
          </p>
          <button
            onClick={runScan}
            className="rounded-xl px-8 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--accent-purple)' }}
          >
            Run Compliance Scan
          </button>
        </div>
      )}

      {/* Scanning state */}
      {scanning && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
            style={{ backgroundColor: 'rgba(155,111,255,0.15)' }}
          >
            <span
              className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--accent-purple)', borderTopColor: 'transparent' }}
            />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Analyzing transactions — this may take up to 30s…
          </p>
        </div>
      )}

      {/* Scan error */}
      {scanError && !scanning && (
        <div className="mb-6">
          <div
            className="rounded-lg px-4 py-3 text-sm mb-4"
            style={{
              backgroundColor: 'rgba(245,88,88,0.10)',
              border: '1px solid rgba(245,88,88,0.30)',
              color: 'var(--accent-red)',
            }}
          >
            {scanError}
          </div>
          <button
            onClick={runScan}
            className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--accent-purple)' }}
          >
            Retry Scan
          </button>
        </div>
      )}

      {/* Post-scan content */}
      {scanned && !scanning && (
        <>
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {violations.length === 0
                ? 'No violations found — all clear.'
                : `${violations.length} violation${violations.length === 1 ? '' : 's'} found${scoreData ? ` across ${scoreData.totalTransactions} transactions` : ''}.`}
            </p>
            <button
              onClick={runScan}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
              }}
            >
              Re-scan
            </button>
          </div>

          {violations.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-3 mb-5 p-3 rounded-lg"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <label className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Severity:
                <select
                  value={filterSeverity}
                  onChange={e => { setFilterSeverity(e.target.value); setPage(1) }}
                  className="rounded focus:outline-none px-2 py-1 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="all">All</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>

              <label className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Employee:
                <select
                  value={filterEmployee}
                  onChange={e => { setFilterEmployee(e.target.value); setPage(1) }}
                  className="rounded focus:outline-none px-2 py-1 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="all">All</option>
                  {uniqueEmployees.map(emp => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
              </label>

              {(filterSeverity !== 'all' || filterEmployee !== 'all') && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Showing {filtered.length} of {violations.length}
                </span>
              )}
            </div>
          )}

          {filtered.length > 0 && (
            <ul className="space-y-3">
              {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((v, i) => {
                const i2 = (page - 1) * PAGE_SIZE + i
                const key = `${i2}-${v.transaction_code ?? 'null'}`
                const isOpen = expandedIds.has(key)
                return (
                  <li
                    key={key}
                    className="rounded-xl p-4"
                    style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {v.employee_name}
                        </span>
                        {v.is_repeat_offender && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[rgba(155,111,255,0.12)] text-[#9B6FFF]">
                            ★ Repeat Offender
                          </span>
                        )}
                      </div>
                      <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase ${SEVERITY_BADGE[v.severity]}`}>
                        {v.severity}
                      </span>
                    </div>

                    {v.violation_type === 'split_charge' ? (
                      <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[rgba(245,166,35,0.15)] text-[#F5A623] mb-0.5">
                        ⚑ Split Charge Detected
                      </span>
                    ) : (
                      <p className="text-sm mb-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {v.violation_type.replace(/_/g, ' ')}
                      </p>
                    )}

                    <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{v.policy_rule_cited}</p>

                    {v.related_transactions && v.related_transactions.length > 0 && (
                      <div
                        className="pl-3 mb-3"
                        style={{ borderLeft: '2px solid rgba(245,166,35,0.4)' }}
                      >
                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Related transactions</p>
                        {v.related_transactions.map((rt, idx) => (
                          <div key={rt.transaction_code ?? idx} className="text-xs flex gap-3">
                            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>${fmtCurrency(rt.amount)}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{rt.date}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{rt.merchant}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => toggleExpand(key)}
                      aria-expanded={isOpen}
                      className="text-xs font-medium transition-colors hover:opacity-80"
                      style={{ color: 'var(--accent)' }}
                    >
                      {isOpen ? '▼ Hide reasoning' : '▶ Show reasoning'}
                    </button>

                    {isOpen && (
                      <div
                        className="mt-3 rounded-lg p-3 text-xs leading-relaxed"
                        style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                      >
                        {v.reasoning}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-6">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  style={{
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-elevated)',
                  }}
                >
                  ← Prev
                </button>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Page {page} of {Math.ceil(filtered.length / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(filtered.length / PAGE_SIZE)}
                  className="px-3 py-1 text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  style={{
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-elevated)',
                  }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {scanned && violations.length > 0 && filtered.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No violations match the current filters.</p>
          )}
        </>
      )}
    </div>
  )
}
