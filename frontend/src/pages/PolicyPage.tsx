import { useEffect, useRef, useState } from 'react'
import { useBudget } from '../context/BudgetContext'

interface PolicyRule {
  id: string
  name: string
  rule: string
}

interface PolicyLimits {
  totalBudget: number
  preauthThreshold: number
  tipMaxServices: number
  tipMaxMeals: number
  splitChargeWindowHours: number
}

interface PolicyConfig {
  rules: PolicyRule[]
  limits: PolicyLimits
}

let nextId = Date.now()
function genId() { return `rule_${nextId++}` }

export default function PolicyPage() {
  const { refetch: refetchBudget } = useBudget()
  const [saved, setSaved] = useState<PolicyConfig | null>(null)
  const [rules, setRules] = useState<PolicyRule[]>([])
  const [limits, setLimits] = useState<PolicyLimits>({
    totalBudget: 50000,
    preauthThreshold: 50,
    tipMaxServices: 15,
    tipMaxMeals: 20,
    splitChargeWindowHours: 48,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

  useEffect(() => {
    fetch('/api/policy')
      .then(r => r.json())
      .then((data: PolicyConfig) => {
        setSaved(data)
        setRules(data.rules.map(r => ({ ...r })))
        setLimits({ ...data.limits })
      })
      .catch(() => setToast({ type: 'error', message: 'Failed to load policy.' }))
      .finally(() => setLoading(false))
  }, [])

  function updateRule(id: string, field: 'name' | 'rule', value: string) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function deleteRule(id: string) {
    setRules(prev => prev.filter(r => r.id !== id))
  }

  function addRule() {
    setRules(prev => [...prev, { id: genId(), name: 'New Rule', rule: '' }])
  }

  function updateLimit(field: keyof PolicyLimits, value: string) {
    const n = parseFloat(value)
    if (!isNaN(n)) setLimits(prev => ({ ...prev, [field]: n }))
  }

  async function save() {
    setSaving(true)
    setToast(null)
    try {
      const res = await fetch('/api/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules, limits }),
      })
      if (!res.ok) throw new Error('Save failed')
      const data: PolicyConfig = await res.json()
      setSaved(data)
      setRules(data.rules.map(r => ({ ...r })))
      setLimits({ ...data.limits })
      setToast({ type: 'success', message: 'Policy saved.' })
      refetchBudget()
    } catch {
      setToast({ type: 'error', message: 'Failed to save policy.' })
    } finally {
      setSaving(false)
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToast(null), 3000)
    }
  }

  function reset() {
    if (!saved) return
    setRules(saved.rules.map(r => ({ ...r })))
    setLimits({ ...saved.limits })
    setToast(null)
  }

  const isDirty = saved !== null && (
    JSON.stringify(rules) !== JSON.stringify(saved.rules) ||
    JSON.stringify(limits) !== JSON.stringify(saved.limits)
  )

  if (loading) {
    return <div className="p-8 text-gray-500 text-sm">Loading policy…</div>
  }

  return (
    <div className="p-6 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Policy</h1>
        <p className="mt-1 text-sm text-gray-500">Configure spending limits and compliance rules used by the scanner.</p>
      </div>

      {toast && (
        <div className={`rounded-md px-4 py-3 text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Spending Limits */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Spending Limits</h2>
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          <LimitRow
            label="Total Budget"
            description="Overall team spending budget"
            value={limits.totalBudget}
            prefix="$"
            step={1000}
            onChange={v => updateLimit('totalBudget', v)}
          />
          <LimitRow
            label="Pre-auth Threshold"
            description="Transactions above this amount are flagged as requiring pre-authorization"
            value={limits.preauthThreshold}
            prefix="$"
            step={5}
            onChange={v => updateLimit('preauthThreshold', v)}
          />
          <LimitRow
            label="Max Tip — Services"
            description="Maximum tip percentage for services and porterage"
            value={limits.tipMaxServices}
            suffix="%"
            step={1}
            onChange={v => updateLimit('tipMaxServices', v)}
          />
          <LimitRow
            label="Max Tip — Meals"
            description="Maximum tip percentage for meals and dining"
            value={limits.tipMaxMeals}
            suffix="%"
            step={1}
            onChange={v => updateLimit('tipMaxMeals', v)}
          />
          <LimitRow
            label="Split-charge Window"
            description="Time window for detecting split charges at the same merchant"
            value={limits.splitChargeWindowHours}
            suffix="h"
            step={1}
            onChange={v => updateLimit('splitChargeWindowHours', v)}
          />
        </div>
      </section>

      {/* Policy Rules */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Compliance Rules</h2>
          <button
            onClick={addRule}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="text-lg leading-none">+</span> Add Rule
          </button>
        </div>
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="text"
                  value={rule.name}
                  onChange={e => updateRule(rule.id, 'name', e.target.value)}
                  className="flex-1 text-sm font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-0 py-0.5"
                />
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none px-1"
                  title="Delete rule"
                >
                  ×
                </button>
              </div>
              <textarea
                value={rule.rule}
                onChange={e => updateRule(rule.id, 'rule', e.target.value)}
                rows={3}
                placeholder="Describe the policy rule…"
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
          ))}
          {rules.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
              No rules defined. Click "Add Rule" to create one.
            </div>
          )}
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !isDirty}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {isDirty && (
          <button
            onClick={reset}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

function LimitRow({
  label, description, value, prefix, suffix, step, onChange,
}: {
  label: string
  description: string
  value: number
  prefix?: string
  suffix?: string
  step: number
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500 mt-0.5">{description}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {prefix && <span className="text-sm text-gray-500">{prefix}</span>}
        <input
          type="number"
          value={value}
          step={step}
          min={0}
          onChange={e => onChange(e.target.value)}
          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm text-right focus:border-blue-500 focus:outline-none"
        />
        {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
      </div>
    </div>
  )
}
