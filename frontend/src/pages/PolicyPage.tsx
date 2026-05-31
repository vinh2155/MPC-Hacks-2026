import { useEffect, useRef, useState, useCallback } from 'react'
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

const inputStyle = {
  borderRadius: '6px',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-elevated)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  outline: 'none',
}

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
  const rulesEndRef = useRef<HTMLDivElement>(null)

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
    setTimeout(() => rulesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
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
    return (
      <div className="p-8 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading policy…</div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Policy</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Configure spending limits and compliance rules used by the scanner.
        </p>
      </div>

      {toast && (
        <div
          className="rounded-lg px-4 py-3 text-sm font-medium"
          style={
            toast.type === 'success'
              ? { backgroundColor: 'rgba(52,217,135,0.10)', color: '#34D987', border: '1px solid rgba(52,217,135,0.25)' }
              : { backgroundColor: 'rgba(245,88,88,0.10)', color: '#F55858', border: '1px solid rgba(245,88,88,0.25)' }
          }
        >
          {toast.message}
        </div>
      )}

      {/* Spending Limits */}
      <section>
        <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Spending Limits</h2>
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}
        >
          {[
            { label: 'Total Budget', description: 'Overall team spending budget', field: 'totalBudget' as keyof PolicyLimits, prefix: '$', step: 1000 },
            { label: 'Pre-auth Threshold', description: 'Transactions above this are flagged as requiring pre-authorization', field: 'preauthThreshold' as keyof PolicyLimits, prefix: '$', step: 5 },
            { label: 'Max Tip — Services', description: 'Maximum tip percentage for services and porterage', field: 'tipMaxServices' as keyof PolicyLimits, suffix: '%', step: 1 },
            { label: 'Max Tip — Meals', description: 'Maximum tip percentage for meals and dining', field: 'tipMaxMeals' as keyof PolicyLimits, suffix: '%', step: 1 },
            { label: 'Split-charge Window', description: 'Time window for detecting split charges at the same merchant', field: 'splitChargeWindowHours' as keyof PolicyLimits, suffix: 'h', step: 1 },
          ].map((row, idx, arr) => (
            <div
              key={row.field}
              className="flex items-center justify-between px-4 py-3 gap-4"
              style={idx < arr.length - 1 ? { borderBottom: '1px solid var(--border-subtle)' } : {}}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.label}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{row.description}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {row.prefix && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.prefix}</span>}
                <input
                  type="number"
                  value={limits[row.field]}
                  step={row.step}
                  min={0}
                  onChange={e => updateLimit(row.field, e.target.value)}
                  className="w-24 px-2 py-1 text-sm text-right"
                  style={inputStyle}
                />
                {row.suffix && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.suffix}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Policy Rules */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Compliance Rules</h2>
          <button
            onClick={addRule}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-elevated)',
            }}
          >
            <span className="text-lg leading-none">+</span> Add Rule
          </button>
        </div>
        <div className="space-y-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className="rounded-lg p-4"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="text"
                  value={rule.name}
                  onChange={e => updateRule(rule.id, 'name', e.target.value)}
                  className="flex-1 text-sm font-semibold bg-transparent px-0 py-0.5 focus:outline-none"
                  style={{
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid transparent',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { (e.target as HTMLElement).style.borderBottomColor = 'var(--accent)' }}
                  onBlur={e => { (e.target as HTMLElement).style.borderBottomColor = 'transparent' }}
                />
                <button
                  onClick={() => deleteRule(rule.id)}
                  className="text-lg leading-none px-1 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--accent-red)' }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)' }}
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
                className="w-full rounded-md px-3 py-2 text-sm resize-none focus:outline-none"
                style={{
                  ...inputStyle,
                  color: 'var(--text-secondary)',
                  borderRadius: '6px',
                }}
                onFocus={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)' }}
                onBlur={e => { (e.target as HTMLElement).style.borderColor = 'var(--border-default)' }}
              />
            </div>
          ))}
          {rules.length === 0 && (
            <div
              className="rounded-lg px-4 py-8 text-center text-sm"
              style={{
                border: '1px dashed var(--border-default)',
                color: 'var(--text-muted)',
              }}
            >
              No rules defined. Click "Add Rule" to create one.
            </div>
          )}
          <div ref={rulesEndRef} />
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !isDirty}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {isDirty && (
          <button
            onClick={reset}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-elevated)',
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}
<<<<<<< Updated upstream

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
  const [raw, setRaw] = useState(String(value))

  // Sync if parent resets the value (e.g. Reset button)
  useEffect(() => { setRaw(String(value)) }, [value])

  const commit = useCallback(() => {
    const n = parseFloat(raw)
    if (!isNaN(n)) onChange(raw)
    else setRaw(String(value))
  }, [raw, value, onChange])

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
          value={raw}
          step={step}
          min={0}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm text-right focus:border-blue-500 focus:outline-none"
        />
        {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
      </div>
    </div>
  )
}
=======
>>>>>>> Stashed changes
