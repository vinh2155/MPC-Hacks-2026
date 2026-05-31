import { useEffect, useRef, useState } from 'react'
import { fmtCurrency } from '../lib/format'

interface Violation {
  severity: 'critical' | 'high' | 'medium' | 'low'
  violation_type: string
  policy_rule_cited: string
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

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-700 bg-red-50',
  high: 'text-orange-700 bg-orange-50',
  medium: 'text-amber-700 bg-amber-50',
  low: 'text-blue-700 bg-blue-50',
}

const SEVERITY_BORDER: Record<string, string> = {
  critical: 'border-l-4 border-l-red-500',
  high: 'border-l-4 border-l-orange-400',
  medium: 'border-l-4 border-l-amber-400',
  low: 'border-l-4 border-l-blue-400',
}

export default function TransactionsPage() {
  const [data, setData] = useState<TxnResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanMsg, setScanMsg] = useState<string | null>(null)
  const [employees, setEmployees] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const [employee, setEmployee] = useState('')
  const [category, setCategory] = useState('')
  const [preset, setPreset] = useState('all_time')
  const [debitOnly, setDebitOnly] = useState(false)
  const [violationsOnly, setViolationsOnly] = useState(false)

  // Sort + page
  const [sortBy, setSortBy] = useState<SortCol>('posting_date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [scanVersion, setScanVersion] = useState(0)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    fetch('/api/employees')
      .then(r => r.json())
      .then((names: string[]) => setEmployees(names))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/transactions/categories')
      .then(r => r.json())
      .then((cats: string[]) => setCategories(cats))
      .catch(() => {})
  }, [])

  // Debounce search
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

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, employee, category, preset, debitOnly, violationsOnly, pageSize])

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

  function SortIcon({ col }: { col: SortCol }) {
    if (sortBy !== col) return <span className="ml-1 text-gray-300">↕</span>
    return <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const txns = data?.transactions ?? []

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <div className="flex items-center gap-3">
          {scanMsg && (
            <span className="text-sm text-gray-600">{scanMsg}</span>
          )}
          <button
            onClick={runScan}
            disabled={scanLoading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {scanLoading ? 'Scanning…' : 'Run Compliance Scan'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <input
              type="text"
              placeholder="Search merchant, employee…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <select
            value={employee}
            onChange={e => setEmployee(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">All employees</option>
            {employees.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={preset}
            onChange={e => setPreset(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
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
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={debitOnly}
              onChange={e => setDebitOnly(e.target.checked)}
              className="rounded"
            />
            Debits only
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={violationsOnly}
              onChange={e => setViolationsOnly(e.target.checked)}
              className="rounded"
            />
            Violations only
          </label>
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-700">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
            >
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {loading && (
          <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100">Loading…</div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  onClick={() => toggleSort('posting_date')}
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 whitespace-nowrap"
                >
                  Date <SortIcon col="posting_date" />
                </th>
                <th
                  onClick={() => toggleSort('employee_name')}
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 whitespace-nowrap"
                >
                  Employee <SortIcon col="employee_name" />
                </th>
                <th
                  onClick={() => toggleSort('merchant_name')}
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 whitespace-nowrap"
                >
                  Merchant <SortIcon col="merchant_name" />
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Category</th>
                <th
                  onClick={() => toggleSort('amount')}
                  className="px-4 py-3 text-right font-medium text-gray-600 cursor-pointer hover:text-gray-900 whitespace-nowrap"
                >
                  Amount <SortIcon col="amount" />
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Type</th>
                <th
                  onClick={() => toggleSort('severity')}
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 whitespace-nowrap"
                >
                  Violation <SortIcon col="severity" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {txns.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                    {violationsOnly ? 'No violations found. Run a compliance scan first.' : 'No transactions match your filters.'}
                  </td>
                </tr>
              ) : (
                txns.map((t, i) => {
                  const borderClass = t.violation ? (SEVERITY_BORDER[t.violation.severity] ?? '') : ''
                  return (
                    <tr key={t.transaction_code ?? i} className={`hover:bg-gray-50 ${borderClass}`} title={t.violation?.policy_rule_cited ?? ''}>
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">{t.posting_date ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-900 font-medium whitespace-nowrap">{t.employee_name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-700 max-w-[180px] truncate" title={t.merchant_name ?? ''}>{t.merchant_name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{t.category_label ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-900 whitespace-nowrap">
                        {t.amount !== null ? fmtCurrency(t.amount) : '—'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          t.debit_or_credit === 'debit'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {t.debit_or_credit ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {t.violation ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SEVERITY_COLORS[t.violation.severity] ?? ''}`}>
                            {t.violation.severity}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pageCount > 1 && (
          <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between text-sm text-gray-600">
            <span>
              {data.total.toLocaleString()} total · page {data.page} of {data.pageCount}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                «
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹
              </button>
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
                  className={`px-2.5 py-1 rounded text-sm ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(data.pageCount, p + 1))}
                disabled={page === data.pageCount}
                className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ›
              </button>
              <button
                onClick={() => setPage(data.pageCount)}
                disabled={page === data.pageCount}
                className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
