import { useState, useEffect, useRef } from 'react'
import { fmtCurrency } from '../lib/format'

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportMode = 'period' | 'employee'
type PeriodOption = 'weekly' | 'monthly'

interface PeriodReport {
  period: PeriodOption
  generatedAt: string
  narrative: string
  data: {
    sinceDate: string | null
    totalSpend: number
    allTimeBudgetUtilization: number
    spendByCategory: { category: string; total: number }[]
    topTransactions: { merchant: string; amount: number; date: string; employee: string; category: string }[]
    preauthCount: number
    splitPairCount: number
    approvedCount: number
    deniedCount: number
  }
}

interface EmployeeReport {
  employeeName: string
  generatedAt: string
  narrative: string
  data: {
    totalSpend: number
    teamAverageSpend: number
    spendByCategory: { category: string; total: number }[]
    topTransactions: { merchant: string; amount: number; date: string; category: string }[]
    requests: { id: string; item_description: string; amount: number; category: string; status: string; created_at: string }[]
    preauthCount: number
    splitPairCount: number
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function printReportAsPdf(title: string, subtitle: string, stats: { label: string; value: string }[], narrative: string) {
  const statsHtml = stats.map(s => `
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;">
      <div style="font-size:9px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">${s.label}</div>
      <div style="font-size:18px;font-weight:700;color:#111827;font-variant-numeric:tabular-nums;">${s.value}</div>
    </div>`).join('')

  // Cap to 4 paragraphs so the report reliably fits on one page
  const paragraphs = narrative.split(/\n\n+/).map(p => p.trim()).filter(Boolean).slice(0, 4)
  const narrativeHtml = paragraphs.map(p =>
    `<p style="margin:0 0 10px;color:#374151;font-size:12px;line-height:1.65;">${p}</p>`
  ).join('')

  const generated = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #fff; color: #111827; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @page { size: A4 portrait; margin: 0; }
      }
    </style>
  </head><body>
    <!-- Top accent bar -->
    <div style="height:4px;background:linear-gradient(90deg,#2563eb 0%,#1d4ed8 100%);"></div>

    <!-- Header -->
    <div style="padding:20px 40px 16px;border-bottom:1px solid #f3f4f6;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:24px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <div style="width:28px;height:28px;background:#2563eb;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <span style="color:#fff;font-size:14px;font-weight:800;letter-spacing:-1px;line-height:1;">B</span>
            </div>
            <div>
              <div style="font-size:13px;font-weight:800;color:#111827;letter-spacing:-.3px;line-height:1.2;">Brianna</div>
              <div style="font-size:8.5px;color:#9ca3af;letter-spacing:.05em;text-transform:uppercase;margin-top:1px;">Fleet Spend Management</div>
            </div>
          </div>
          <h1 style="font-size:20px;font-weight:700;color:#111827;letter-spacing:-.3px;line-height:1.2;margin-bottom:3px;">${title}</h1>
          <div style="font-size:11px;color:#6b7280;">${subtitle}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;padding-top:2px;">
          <div style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;padding:3px 10px;margin-bottom:6px;">
            <span style="font-size:9px;font-weight:600;color:#2563eb;letter-spacing:.04em;text-transform:uppercase;">Brim Financial</span>
          </div>
          <div style="font-size:10px;color:#9ca3af;">Generated ${generated}</div>
        </div>
      </div>
    </div>

    <!-- Stats strip -->
    <div style="padding:14px 40px;background:#f9fafb;border-bottom:1px solid #f3f4f6;">
      <div style="display:grid;grid-template-columns:repeat(${stats.length},1fr);gap:10px;">
        ${statsHtml}
      </div>
    </div>

    <!-- Narrative -->
    <div style="padding:18px 40px 20px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #f3f4f6;">Executive Summary</div>
      ${narrativeHtml}
    </div>

    <!-- Footer -->
    <div style="margin:0 40px;padding:10px 0;border-top:1px solid #f3f4f6;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:9px;color:#d1d5db;">Brianna · Fleet Spend Management · Brim Financial × MPC Hacks 2026</div>
      <div style="font-size:9px;color:#d1d5db;">Confidential</div>
    </div>
  </body></html>`

  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 300)
}

function StatsStrip({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      {stats.map(s => (
        <div key={s.label} className="rounded-lg bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500">{s.label}</p>
          <p className="text-lg font-bold text-gray-900 tabular-nums">{s.value}</p>
        </div>
      ))}
    </div>
  )
}

function NarrativeBlock({ text }: { text: string }) {
  return (
    <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
      {text.split(/\n\n+/).map((p, i) => (
        <p key={i}>{p.trim()}</p>
      ))}
    </div>
  )
}

// ── ReportsPage ───────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [mode, setMode] = useState<ReportMode>('period')
  const [period, setPeriod] = useState<PeriodOption>('weekly')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [employees, setEmployees] = useState<string[]>([])
  const [employeesError, setEmployeesError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inFlight = useRef(false)
  const generateAbort = useRef<AbortController | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [periodReport, setPeriodReport] = useState<PeriodReport | null>(null)
  const [employeeReport, setEmployeeReport] = useState<EmployeeReport | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/employees', { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setEmployees(data as string[])
        } else {
          setEmployeesError('Unexpected response loading employees.')
        }
      })
      .catch(err => {
        if ((err as Error).name === 'AbortError') return
        setEmployeesError('Failed to load employee list — please refresh.')
      })
    return () => {
      controller.abort()
      generateAbort.current?.abort()
    }
  }, [])

  async function generate() {
    // C3: synchronous in-flight guard — prevents concurrent calls on rapid double-click
    // before React commits the disabled state to the DOM
    if (inFlight.current) return
    inFlight.current = true
    setError(null)
    if (mode === 'employee' && !selectedEmployee) {
      setError('Select an employee first.')
      inFlight.current = false
      return
    }
    setLoading(true)
    const controller = new AbortController()
    generateAbort.current = controller
    try {
      if (mode === 'period') {
        setPeriodReport(null)
        const res = await fetch('/api/reports/period', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ period }),
          signal: controller.signal,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string }
          setError(err.error ?? `Error ${res.status}`)
          return
        }
        setPeriodReport(await res.json() as PeriodReport)
      } else {
        setEmployeeReport(null)
        const res = await fetch('/api/reports/employee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeName: selectedEmployee }),
          signal: controller.signal,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string }
          setError(err.error ?? `Error ${res.status}`)
          return
        }
        setEmployeeReport(await res.json() as EmployeeReport)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }

  const activeReport = mode === 'period' ? periodReport : employeeReport

  return (
    <div className="p-8">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800">Reports</h2>
        <p className="text-sm text-gray-500 mt-1">Generate period summaries or employee spend profiles.</p>
      </header>

      {/* Mode segmented control */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1 mb-6">
        {(['period', 'employee'] as const).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(null) }}
            className={`px-5 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === m
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {m === 'period' ? 'Period Report' : 'Employee Report'}
          </button>
        ))}
      </div>

      {/* Controls row */}
      <div className="flex items-end gap-3 mb-6 flex-wrap">
        {mode === 'period' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Period
            </label>
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1">
              {(['weekly', 'monthly'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    period === p
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p === 'weekly' ? 'Weekly' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'employee' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Employee
            </label>
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
            >
              <option value="">Select employee…</option>
              {employees.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {/* C1: surface fetch failure so user isn't silently stuck with an empty dropdown */}
            {employeesError && (
              <p className="text-xs text-red-500 mt-1">{employeesError}</p>
            )}
          </div>
        )}

        <button
          onClick={() => void generate()}
          disabled={loading || (mode === 'employee' && !selectedEmployee)}
          className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 text-sm text-gray-500 mb-6">
          <span className="inline-block w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          Generating report — this may take up to 15s…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Period report card */}
      {mode === 'period' && periodReport && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {periodReport.period === 'weekly' ? 'Weekly' : 'Monthly'} Report
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Generated {new Date(periodReport.generatedAt).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => printReportAsPdf(
                `${periodReport.period === 'weekly' ? 'Weekly' : 'Monthly'} Report`,
                `Generated ${new Date(periodReport.generatedAt).toLocaleString()}`,
                [
                  { label: 'Spend this period', value: `$${fmtCurrency(periodReport.data.totalSpend)}` },
                  { label: 'All-time utilization', value: `${periodReport.data.allTimeBudgetUtilization}%` },
                  { label: 'Pre-auth flags', value: String(periodReport.data.preauthCount) },
                  { label: 'Approved requests', value: String(periodReport.data.approvedCount) },
                ],
                periodReport.narrative,
              )}
              className="flex-shrink-0 rounded-md border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Download PDF
            </button>
          </div>
          <StatsStrip stats={[
            { label: 'Spend this period', value: `$${fmtCurrency(periodReport.data.totalSpend)}` },
            { label: 'All-time utilization', value: `${periodReport.data.allTimeBudgetUtilization}%` },
            { label: 'Pre-auth flags', value: String(periodReport.data.preauthCount) },
            { label: 'Approved requests', value: String(periodReport.data.approvedCount) },
          ]} />
          <hr className="border-gray-100 mb-5" />
          <NarrativeBlock text={periodReport.narrative} />
        </div>
      )}

      {/* Employee report card */}
      {mode === 'employee' && employeeReport && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {employeeReport.employeeName} — Spend Profile
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Generated {new Date(employeeReport.generatedAt).toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => printReportAsPdf(
                `${employeeReport.employeeName} — Spend Profile`,
                `Generated ${new Date(employeeReport.generatedAt).toLocaleString()}`,
                [
                  { label: 'Total spend', value: `$${fmtCurrency(employeeReport.data.totalSpend)}` },
                  { label: 'Team average', value: `$${fmtCurrency(employeeReport.data.teamAverageSpend)}` },
                  { label: 'Pre-auth flags', value: String(employeeReport.data.preauthCount) },
                  { label: 'Requests submitted', value: String(employeeReport.data.requests.length) },
                ],
                employeeReport.narrative,
              )}
              className="flex-shrink-0 rounded-md border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Download PDF
            </button>
          </div>
          <StatsStrip stats={[
            { label: 'Total spend', value: `$${fmtCurrency(employeeReport.data.totalSpend)}` },
            { label: 'Team average', value: `$${fmtCurrency(employeeReport.data.teamAverageSpend)}` },
            { label: 'Pre-auth flags', value: String(employeeReport.data.preauthCount) },
            { label: 'Requests submitted', value: String(employeeReport.data.requests.length) },
          ]} />
          <hr className="border-gray-100 mb-5" />
          <NarrativeBlock text={employeeReport.narrative} />
        </div>
      )}

      {/* Empty state */}
      {!activeReport && !loading && !error && (
        <p className="text-sm text-gray-400">Configure your report above and click Generate.</p>
      )}
    </div>
  )
}
