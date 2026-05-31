import { useState, useEffect } from 'react'
import { fmtCurrency } from '../lib/format'
import type { Request } from '../lib/types'

const EMPLOYEE_NAMES = ['Jordan', 'Maya', 'Tyler', 'Priya', 'Marcus', 'Sofia', 'Ethan', 'Leila']

const CATEGORIES = [
  'Fuel',
  'Meals',
  'Vehicle Maintenance',
  'Government Permits',
  'Parts & Supplies',
  'Tolls & Permits',
  'Other',
]

type RequestRow = Request

const EMPTY_FORM = {
  employee_name: '',
  item_description: '',
  amount: '',
  category: '',
  reason: '',
}

function statusConfig(status: RequestRow['status']) {
  if (status === 'approved') return {
    cls: 'bg-[rgba(52,217,135,0.12)] text-[#34D987]',
    label: 'Approved',
  }
  if (status === 'denied') return {
    cls: 'bg-[rgba(245,88,88,0.12)] text-[#F55858]',
    label: 'Denied',
  }
  return {
    cls: 'bg-[rgba(245,166,35,0.12)] text-[#F5A623]',
    label: 'Awaiting Review',
  }
}

const inputClass = 'w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F82F7]'
const inputStyle = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  color: 'var(--text-primary)',
}

const labelStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--text-muted)',
  marginBottom: '6px',
}

export default function EmployeeRequestPage() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [requestData, setRequestData] = useState<RequestRow | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!submittedId) return
    let intervalId: ReturnType<typeof setInterval>
    const poll = async () => {
      try {
        const res = await fetch(`/api/requests/${submittedId}`)
        if (!res.ok) return
        const row: RequestRow = await res.json()
        setRequestData(row)
        if (row.status === 'approved' || row.status === 'denied') {
          clearInterval(intervalId)
        }
      } catch { /* silently retry */ }
    }
    poll()
    intervalId = setInterval(poll, 5_000)
    return () => clearInterval(intervalId)
  }, [submittedId])

  function setField(field: keyof typeof EMPTY_FORM, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setValidationError(null)
    setSubmitError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { employee_name, item_description, amount, category, reason } = form
    if (!employee_name || !item_description || !category || !reason) {
      setValidationError('All fields are required.')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (!isFinite(parsedAmount) || parsedAmount <= 0) {
      setValidationError('Amount must be greater than $0.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_name, item_description, amount: parsedAmount, category, reason }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSubmitError((err as { error?: string }).error ?? 'Failed to submit request.')
        return
      }
      const { id } = await res.json()
      setSubmittedId(id)
      setRequestData(null)
    } catch {
      setSubmitError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setSubmittedId(null)
    setRequestData(null)
    setForm(EMPTY_FORM)
    setValidationError(null)
    setSubmitError(null)
  }

  if (submittedId) {
    const status = requestData?.status ?? 'pending'
    const sc = statusConfig(status)
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div
          className="w-full max-w-md rounded-2xl p-8"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Request Submitted</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sc.cls}`}>
              {sc.label}
            </span>
          </div>

          {requestData && (
            <ul className="space-y-2.5 text-sm mb-6">
              {[
                { label: 'Employee', value: requestData.employee_name },
                { label: 'Item', value: requestData.item_description },
                { label: 'Amount', value: `$${fmtCurrency(requestData.amount)}` },
                { label: 'Category', value: requestData.category },
                { label: 'Reason', value: requestData.reason },
              ].map(({ label, value }) => (
                <li key={label} className="flex gap-2">
                  <span className="font-semibold min-w-[72px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)' }}>{value}</span>
                </li>
              ))}
            </ul>
          )}

          {status === 'pending' && (
            <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>Checking for updates every 5s…</p>
          )}

          {(status === 'approved' || status === 'denied') && (
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Your request has been <span className="font-medium">{status}</span> by the manager.
            </p>
          )}

          <button
            onClick={reset}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-elevated)',
            }}
          >
            Submit another request
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="mb-6">
          <p style={{ ...labelStyle, marginBottom: '4px' }}>Employee</p>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Submit a Request</h2>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label style={labelStyle}>Your Name</label>
            <select
              value={form.employee_name}
              onChange={e => setField('employee_name', e.target.value)}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">Select your name…</option>
              {EMPLOYEE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Item / Service</label>
            <input
              type="text"
              placeholder="e.g. Replacement brake pads"
              value={form.item_description}
              onChange={e => setField('item_description', e.target.value)}
              className={inputClass}
              style={{ ...inputStyle }}
            />
          </div>

          <div>
            <label style={labelStyle}>Amount ($)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={e => setField('amount', e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Category</label>
            <select
              value={form.category}
              onChange={e => setField('category', e.target.value)}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">Select a category…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Reason</label>
            <textarea
              placeholder="Briefly explain why this expense is needed…"
              value={form.reason}
              onChange={e => setField('reason', e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
              style={inputStyle}
            />
          </div>

          {validationError && (
            <p className="text-xs font-medium" style={{ color: 'var(--accent-red)' }}>{validationError}</p>
          )}
          {submitError && (
            <p className="text-xs font-medium" style={{ color: 'var(--accent-red)' }}>{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  )
}
