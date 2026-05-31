import { useEffect, useRef, useState } from 'react'
import { fmtCurrency } from '../lib/format'

interface Violation {
  severity: 'critical' | 'high' | 'medium' | 'low'
  violation_type: string
  policy_rule_cited: string
  reasoning: string
}

interface Transaction {
  transaction_code: number | null
  posting_date: string | null
  merchant_name: string | null
  amount: number | null
  debit_or_credit: string | null
  category_label: string | null
  employee_name: string | null
  transaction_description: string | null
  merchant_city: string | null
  merchant_state: string | null
  violation: Violation | null
}

interface TxnResponse {
  transactions: Transaction[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

type SortCol = 'posting_date' | 'amount' | 'employee_name' | 'merchant_name' | 'severity'
type SortDir = 'asc' | 'desc'

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(245,88,88,0.12)',    text: '#F55858' },
  high:     { bg: 'rgba(255,153,102,0.12)',  text: '#FF9966' },
  medium:   { bg: 'rgba(245,166,35,0.12)',   text: '#F5A623' },
  low:      { bg: 'rgba(79,130,247,0.12)',   text: '#4F82F7' },
}

const SEVERITY_BORDER: Record<string, string> = {
  critical: '4px solid #F55858',
  high:     '4px solid #FF9966',
  medium:   '4px solid #F5A623',
  low:      '4px solid #4F82F7',
}

function SortIcon({ col, sortBy, sortDir }: { col: SortCol; sortBy: SortCol; sortDir: SortDir }) {
  if (sortBy !== col) return <span className="ml-1" style={{ color: 'var(--text-muted)' }}>↕</span>
  return <span className="ml-1" style={{ color: 'var(--accent)' }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
}

const filterInputStyle = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-primary)',
  borderRadius: '6px',
  padding: '6px 12px',
  fontSize: '13px',
  outline: 'none',
  width: '100%',
}

export default function TransactionsPage() {
  const [data, setData] = useState<TxnResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const [employees, setEmployees] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])

  const [search, setSearch] = useState('')
  const [employee, setEmployee] = useState('')
  const [category, setCategory] = useState('')
  const [preset, setPreset] = useState('all_time')
  const [debitOnly, setDebitOnly] = useState(false)
  const [violationsOnly, setViolationsOnly] = useState(false)

  const [sortBy, setSortBy] = useState<SortCol>('posting_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [scanVersion, setScanVersion] = useState(0)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then((names: string[]) => setEmployees(names)).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/transactions/categories').then(r => r.json()).then((cats: string[]) => setCategories(cats)).catch(() => {})
  }, [])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (employee) params.set('employee', employee)
    if (category) params.set('category', category)
    if (preset !== 'all_time') params.set('preset', preset)
    if (debitOnly) params.set('debitOnly', 'true')
    if (violationsOnly) params.set('violationsOnly', 'true')
    params.set('sortBy', sortBy)
    params.set('sortDir', sortDir)

    setLoading(true)
    fetch(`/api/transactions?${params.toString()}`, { signal: controller.signal })
      .then(r => r.json())
      .then((d: TxnResponse) => setData(d))
      .catch(err => { if ((err as Error).name !== 'AbortError') setData(null) })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [page, pageSize, debouncedSearch, employee, category, preset, debitOnly, violationsOnly, sortBy, sortDir, scanVersion])

  async function runScan() {
    setScanLoading(true)
    setScanMsg(null)
    try {
      const res = await fetch('/api/compliance/scan', { method: 'POST' })
      const json = await res.json() as { violations?: unknown[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Scan failed')
      const count = Array.isArray(json.violations) ? json.violations.length : 0
      setScanMsg(`Scan complete — ${count} violation${count === 1 ? '' : 's'} found.`)
      setScanVersion(v => v + 1)
    } catch (e) {
      setScanMsg(e instanceof Error ? e.message : 'Scan failed')
    } finally {
      setScanLoading(false)
      setTimeout(() => setScanMsg(null), 5000)
    }
  }

  function toggleSort(col: SortCol) {
    setPage(1)
    if (sortBy === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
  }

  const txns = data?.transactions ?? []

  const thStyle = {
    color: 'var(--text-muted)',
    fontWeight: '500' as const,
    fontSize: '12px',
    padding: '10px 14px',
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
    borderBottom: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--bg-elevated)',
    cursor: 'pointer',
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Transactions</h1>
        <div className="flex items-center gap-3">
          {scanMsg && (
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{scanMsg}</span>
          )}
          <button
            onClick={runScan}
            disabled={scanLoading}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {scanLoading ? 'Scanning…' : 'Run Compliance Scan'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        className="mb-4 rounded-lg p-4"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <input
              type="text"
              placeholder="Search merchant, employee…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              style={filterInputStyle}
            />
          </div>
          <select
            value={employee}
            onChange={e => { setEmployee(e.target.value); setPage(1) }}
            style={filterInputStyle}
          >
            <option value="">All employees</option>
            {employees.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1) }}
            style={filterInputStyle}
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={preset}
            onChange={e => { setPreset(e.target.value); setPage(1) }}
            style={filterInputStyle}
          >
            <option value="last_day">Last day</option>
            <option value="last_month">Last month</option>
            <option value="last_3months">Last 3 months</option>
            <option value="last_6months">Last 6 months</option>
            <option value="last_year">Last year</option>
            <option value="all_time">All time</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={debitOnly}
              onChange={e => { setDebitOnly(e.target.checked); setPage(1) }}
              className="rounded"
            />
            Debits only
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={violationsOnly}
              onChange={e => { setViolationsOnly(e.target.checked); setPage(1) }}
              className="rounded"
            />
            Violations only
          </label>
          <div className="ml-auto flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
              style={{ ...filterInputStyle, width: 'auto', padding: '4px 8px' }}
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}
      >
        {loading && (
          <div
            className="px-4 py-2 text-xs"
            style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}
          >
            Loading…
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                <th style={thStyle} onClick={() => toggleSort('posting_date')}>
                  Date <SortIcon col="posting_date" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th style={thStyle} onClick={() => toggleSort('employee_name')}>
                  Employee <SortIcon col="employee_name" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th style={thStyle} onClick={() => toggleSort('merchant_name')}>
                  Merchant <SortIcon col="merchant_name" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th style={{ ...thStyle, cursor: 'default' }}>Category</th>
                <th style={{ ...thStyle, textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleSort('amount')}>
                  Amount <SortIcon col="amount" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th style={{ ...thStyle, cursor: 'default' }}>Type</th>
                <th style={thStyle} onClick={() => toggleSort('severity')}>
                  Violation <SortIcon col="severity" sortBy={sortBy} sortDir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody>
              {txns.length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {violationsOnly ? 'No violations found. Run a compliance scan first.' : 'No transactions match your filters.'}
                  </td>
                </tr>
              ) : (
                txns.map((t, i) => {
                  const borderLeft = t.violation ? (SEVERITY_BORDER[t.violation.severity] ?? '') : ''
                  return (
                    <tr
                      key={t.transaction_code ?? i}
                      className="transition-colors"
                      style={{
                        borderLeft: borderLeft || undefined,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
                    >
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{t.posting_date ?? '—'}</td>
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{t.employee_name ?? '—'}</td>
                      <td className="px-4 py-2.5 max-w-[180px] truncate" style={{ color: 'var(--text-secondary)' }} title={t.merchant_name ?? ''}>{t.merchant_name ?? '—'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{t.category_label ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        {t.amount !== null ? fmtCurrency(t.amount) : '—'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={
                            t.debit_or_credit === 'debit'
                              ? { backgroundColor: 'rgba(245,88,88,0.10)', color: '#F55858' }
                              : { backgroundColor: 'rgba(52,217,135,0.10)', color: '#34D987' }
                          }
                        >
                          {t.debit_or_credit ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {t.violation ? (
                          <div className="relative inline-block group">
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-full cursor-default"
                              style={{
                                backgroundColor: SEVERITY_COLORS[t.violation.severity]?.bg ?? 'transparent',
                                color: SEVERITY_COLORS[t.violation.severity]?.text ?? 'inherit',
                              }}
                            >
                              {t.violation.severity}
                            </span>
                            <div
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 rounded-lg px-3 py-2 text-xs shadow-xl hidden group-hover:block z-50 whitespace-normal pointer-events-none"
                              style={{
                                backgroundColor: 'var(--bg-elevated)',
                                border: '1px solid var(--border-default)',
                                color: 'var(--text-primary)',
                              }}
                            >
                              <p className="font-semibold mb-1">{t.violation.violation_type.replace(/_/g, ' ')}</p>
                              <p style={{ color: 'var(--text-secondary)' }}>{t.violation.reasoning}</p>
                              <div
                                className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
                                style={{ borderTopColor: 'var(--bg-elevated)' }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {data && data.pageCount > 1 && (
          <div
            className="px-4 py-3 flex items-center justify-between text-sm"
            style={{
              borderTop: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <span>
              {data.total.toLocaleString()} total · page {data.page} of {data.pageCount}
            </span>
            <div className="flex items-center gap-1">
              {[
                { label: '«', action: () => setPage(1), disabled: page === 1 },
                { label: '‹', action: () => setPage(p => Math.max(1, p - 1)), disabled: page === 1 },
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={btn.action}
                  disabled={btn.disabled}
                  className="px-2 py-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={e => { if (!btn.disabled) (e.target as HTMLElement).style.backgroundColor = 'var(--bg-elevated)' }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = '' }}
                >
                  {btn.label}
                </button>
              ))}
              {Array.from({ length: Math.min(5, data.pageCount) }, (_, i) => {
                const half = 2
                let start = Math.max(1, page - half)
                const end = Math.min(data.pageCount, start + 4)
                start = Math.max(1, end - 4)
                return start + i
              }).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="px-2.5 py-1 rounded text-sm transition-colors"
                  style={
                    p === page
                      ? { backgroundColor: 'var(--accent)', color: '#fff' }
                      : { color: 'var(--text-secondary)' }
                  }
                  onMouseEnter={e => { if (p !== page) (e.target as HTMLElement).style.backgroundColor = 'var(--bg-elevated)' }}
                  onMouseLeave={e => { if (p !== page) (e.target as HTMLElement).style.backgroundColor = '' }}
                >
                  {p}
                </button>
              ))}
              {[
                { label: '›', action: () => setPage(p => Math.min(data.pageCount, p + 1)), disabled: page === data.pageCount },
                { label: '»', action: () => setPage(data.pageCount), disabled: page === data.pageCount },
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={btn.action}
                  disabled={btn.disabled}
                  className="px-2 py-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={e => { if (!btn.disabled) (e.target as HTMLElement).style.backgroundColor = 'var(--bg-elevated)' }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.backgroundColor = '' }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
