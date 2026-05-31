import { useState } from 'react'
import { useCompliance } from '../context/ComplianceContext'

interface Violation {
  transaction_code: number | null
  employee_name: string
  violation_type: string
  policy_rule_cited: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  reasoning: string
  is_repeat_offender: boolean
}

const SEVERITY_BADGE: Record<Violation['severity'], string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
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
    <div className="p-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Compliance</h2>

      {/* Scan controls */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={runScan}
          disabled={scanning}
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {scanning ? 'Scanning…' : 'Run Scan'}
        </button>

        {scanning && (
          <span className="flex items-center gap-2 text-sm text-gray-500">
            <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Analyzing transactions — this may take up to 30s
          </span>
        )}

        {scanError && (
          <span className="text-sm text-red-600 font-medium">{scanError}</span>
        )}
      </div>

      {/* Post-scan summary */}
      {scanned && !scanning && (
        <p className="text-sm text-gray-600 mb-4">
          {violations.length === 0
            ? 'No violations found — all clear.'
            : `${violations.length} violation${violations.length === 1 ? '' : 's'} found${scoreData ? ` across ${scoreData.totalTransactions} transactions` : ''}.`}
        </p>
      )}

      {!scanned && !scanning && (
        <p className="text-sm text-gray-400 mb-4">Run a scan to check policy compliance.</p>
      )}

      {/* Filters — only when there are results */}
      {violations.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            Severity:
            <select
              value={filterSeverity}
              onChange={e => { setFilterSeverity(e.target.value); setPage(1) }}
              className="rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            Employee:
            <select
              value={filterEmployee}
              onChange={e => { setFilterEmployee(e.target.value); setPage(1) }}
              className="rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="all">All</option>
              {uniqueEmployees.map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </label>

          {(filterSeverity !== 'all' || filterEmployee !== 'all') && (
            <span className="text-xs text-gray-400">
              Showing {filtered.length} of {violations.length}
            </span>
          )}
        </div>
      )}

      {/* Violations list */}
      {filtered.length > 0 && (
        <ul className="space-y-3">
          {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((v, i) => {
            const i2 = (page - 1) * PAGE_SIZE + i
            const key = `${i2}-${v.transaction_code ?? 'null'}`
            const isOpen = expandedIds.has(key)
            return (
              <li
                key={key}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
              >
                {/* Top row: name + badges + severity */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {v.employee_name}
                    </span>
                    {v.is_repeat_offender && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        ★ Repeat Offender
                      </span>
                    )}
                  </div>
                  <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase ${SEVERITY_BADGE[v.severity]}`}>
                    {v.severity}
                  </span>
                </div>

                {/* Violation type */}
                <p className="text-sm text-gray-800 mb-0.5">
                  {v.violation_type.replace(/_/g, ' ')}
                </p>

                {/* Policy rule cited */}
                <p className="text-xs text-gray-500 mb-3">{v.policy_rule_cited}</p>

                {/* Expand toggle */}
                <button
                  onClick={() => toggleExpand(key)}
                  aria-expanded={isOpen}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  {isOpen ? '▼ Hide reasoning' : '▶ Show reasoning'}
                </button>

                {/* Reasoning (expanded) */}
                {isOpen && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 leading-relaxed">
                    {v.reasoning}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-xs text-gray-400">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
              className="px-3 py-1 text-sm rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {Math.ceil(filtered.length / PAGE_SIZE)}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= Math.ceil(filtered.length / PAGE_SIZE)}
              className="px-3 py-1 text-sm rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* After scan but all filtered out */}
      {scanned && violations.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-gray-400">No violations match the current filters.</p>
      )}
    </div>
  )
}
