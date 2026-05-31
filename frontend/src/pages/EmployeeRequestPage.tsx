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
  if (status === 'approved') return { cls: 'text-emerald-600 bg-emerald-50', label: 'Approved' }
  if (status === 'denied') return { cls: 'text-red-600 bg-red-50', label: 'Denied' }
  return { cls: 'text-amber-600 bg-amber-50', label: 'Awaiting Manager Review' }
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
      } catch {
        // silently retry
      }
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
      <div className="p-8 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Request Submitted</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sc.cls}`}>
              {sc.label}
            </span>
          </div>

          {requestData && (
            <ul className="space-y-2 text-sm text-gray-600 mb-6">
              <li><span className="font-medium text-gray-800">Employee:</span> {requestData.employee_name}</li>
              <li><span className="font-medium text-gray-800">Item:</span> {requestData.item_description}</li>
              <li><span className="font-medium text-gray-800">Amount:</span> ${fmtCurrency(requestData.amount)}</li>
              <li><span className="font-medium text-gray-800">Category:</span> {requestData.category}</li>
              <li><span className="font-medium text-gray-800">Reason:</span> {requestData.reason}</li>
            </ul>
          )}

          {status === 'pending' && (
            <p className="text-xs text-gray-400 mb-6">Checking for updates every 5s…</p>
          )}

          {(status === 'approved' || status === 'denied') && (
            <p className="text-sm text-gray-500 mb-6">
              Your request has been <span className="font-medium">{status}</span> by the manager.
            </p>
          )}

          <button
            onClick={reset}
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Submit another request
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-lg mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">Employee</p>
          <h2 className="text-2xl font-bold text-gray-900">Submit a Request</h2>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Your Name
            </label>
            <select
              value={form.employee_name}
              onChange={e => setField('employee_name', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select your name…</option>
              {EMPLOYEE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Item / Service
            </label>
            <input
              type="text"
              placeholder="e.g. Replacement brake pads"
              value={form.item_description}
              onChange={e => setField('item_description', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Amount ($)
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={e => setField('amount', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Category
            </label>
            <select
              value={form.category}
              onChange={e => setField('category', e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a category…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Reason
            </label>
            <textarea
              placeholder="Briefly explain why this expense is needed…"
              value={form.reason}
              onChange={e => setField('reason', e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {validationError && (
            <p className="text-xs font-medium text-red-500">{validationError}</p>
          )}

          {submitError && (
            <p className="text-xs font-medium text-red-500">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  )
}
