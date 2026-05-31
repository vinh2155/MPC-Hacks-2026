import { useState, useEffect } from 'react'
import { useBudget } from '../context/BudgetContext'
import { fmt, fmtCurrency } from '../lib/format'

function barColorClass(pct: number) {
  if (pct < 70) return 'bg-[#34D987]'
  if (pct < 90) return 'bg-[#F5A623]'
  return 'bg-[#F55858]'
}

function barGlowColor(pct: number) {
  if (pct < 70) return 'rgba(52,217,135,0.5)'
  if (pct < 90) return 'rgba(245,166,35,0.5)'
  return 'rgba(245,88,88,0.5)'
}

function statusLabel(pct: number) {
  if (pct < 70) return { text: 'On Track',          cls: 'text-[#34D987] bg-[rgba(52,217,135,0.12)]' }
  if (pct < 90) return { text: 'Approaching Limit', cls: 'text-[#F5A623] bg-[rgba(245,166,35,0.12)]' }
  return              { text: 'Over Threshold',     cls: 'text-[#F55858] bg-[rgba(245,88,88,0.12)]' }
}

function forecastStyle(projectedTotal: number, budget: number) {
  const ratio = projectedTotal / budget
  if (ratio < 0.85) return {
    text: 'text-[#34D987]',
    bg: 'bg-[rgba(52,217,135,0.06)]',
    border: 'border-[rgba(52,217,135,0.18)]',
    icon: '✓',
    fillColor: '#34D987',
  }
  if (ratio < 1.0) return {
    text: 'text-[#F5A623]',
    bg: 'bg-[rgba(245,166,35,0.06)]',
    border: 'border-[rgba(245,166,35,0.18)]',
    icon: '⚠',
    fillColor: '#F5A623',
  }
  return {
    text: 'text-[#F55858]',
    bg: 'bg-[rgba(245,88,88,0.06)]',
    border: 'border-[rgba(245,88,88,0.18)]',
    icon: '!',
    fillColor: '#F55858',
  }
}

export default function BudgetGauge() {
  const { data, error } = useBudget()
  const [displayPct, setDisplayPct] = useState(0)

  useEffect(() => {
    if (data == null) { setDisplayPct(0); return }
    const target = Math.min(data.utilizationPct, 100)
    const t = setTimeout(() => setDisplayPct(target), 60)
    return () => clearTimeout(t)
  }, [data])

  if (error) {
    return (
      <div
        className="rounded-2xl p-8 text-center flex-1"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(245,88,88,0.25)' }}
      >
        <p className="text-sm font-medium" style={{ color: 'var(--accent-red)' }}>Unable to reach server</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Budget data unavailable — retrying every 5s</p>
      </div>
    )
  }

  if (data == null) {
    return (
      <div
        className="rounded-2xl p-8 animate-pulse flex-1"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="h-4 rounded w-24 mb-4" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <div className="h-8 rounded w-56 mb-6" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <div className="h-7 rounded-full" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      </div>
    )
  }

  const pct = data.utilizationPct
  const status = statusLabel(pct)

  const daysElapsed = (new Date(data.periodEnd).getTime() - new Date(data.periodStart).getTime()) / 86_400_000
  const monthsElapsed = Math.max(daysElapsed / 30.44, 0.5)
  const monthsRemaining = Math.max(12 - monthsElapsed, 0)
  const monthlyBurn = data.totalSpend / monthsElapsed
  const projectedAdditional = monthlyBurn * monthsRemaining
  const projectedYearEnd = data.totalSpend + projectedAdditional
  const surplusOrDeficit = data.totalBudget - projectedYearEnd
  const isDeficit = surplusOrDeficit < 0
  const fStyle = forecastStyle(projectedYearEnd, data.totalBudget)

  const spentPct = Math.min((data.totalSpend / data.totalBudget) * 100, 100)
  const projectedPct = Math.min((projectedAdditional / data.totalBudget) * 100, 100 - spentPct)
  const glowColor = barGlowColor(pct)

  return (
    <div
      className="rounded-2xl p-8 flex-1"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--text-secondary)' }}>
            Annual Budget
          </p>
          <h2 className="text-4xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            ${fmt(data.totalSpend)}
            <span className="text-xl font-normal ml-2" style={{ color: 'var(--text-secondary)' }}>
              of ${fmt(data.totalBudget)} spent
            </span>
          </h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.cls}`}>
            {status.text}
          </span>
          <span className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
            {pct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Bar track */}
      <div
        className="relative h-7 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-elevated)' }}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${barColorClass(pct)}`}
          style={{
            width: `${displayPct}%`,
            boxShadow: `0 0 12px ${glowColor}`,
          }}
        />
        <div className="absolute inset-0 flex items-stretch pointer-events-none">
          <div className="w-[70%] border-r border-white/10" />
          <div className="w-[20%] border-r border-white/10" />
        </div>
      </div>

      {/* Threshold labels */}
      <div className="relative mt-1.5 h-4">
        <span
          className="absolute text-[11px] -translate-x-1/2"
          style={{ left: '70%', color: 'var(--text-secondary)' }}
        >
          70%
        </span>
        <span
          className="absolute text-[11px] -translate-x-1/2"
          style={{ left: '90%', color: 'var(--text-secondary)' }}
        >
          90%
        </span>
      </div>

      {/* Year-end forecast */}
      <div className={`mt-7 rounded-xl border p-5 ${fStyle.bg} ${fStyle.border}`}>
        <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'var(--text-secondary)' }}>
          Year-End Forecast
        </p>

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Avg monthly spend</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              ${fmt(monthlyBurn)}<span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>/mo</span>
            </p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Projected year-end</p>
            <p className={`text-lg font-bold tabular-nums ${fStyle.text}`}>${fmt(projectedYearEnd)}</p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>{isDeficit ? 'Projected overrun' : 'Projected surplus'}</p>
            <p className={`text-lg font-bold tabular-nums ${fStyle.text}`}>
              {isDeficit ? '−' : '+'}${fmt(Math.abs(surplusOrDeficit))}
            </p>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
            <span>Actuals (${fmt(data.totalSpend)})</span>
            <span>Projected (+${fmt(projectedAdditional)})</span>
            <span>Budget: ${fmt(data.totalBudget)}</span>
          </div>
          <div
            className="h-3 rounded-full overflow-hidden flex"
            style={{ backgroundColor: 'var(--bg-elevated)' }}
          >
            <div
              className="h-full rounded-l-full transition-all duration-700"
              style={{ width: `${spentPct}%`, backgroundColor: fStyle.fillColor }}
            />
            <div
              className="h-full transition-all duration-700"
              style={{ width: `${projectedPct}%`, backgroundColor: fStyle.fillColor, opacity: 0.3 }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            <span>{Math.round(monthsElapsed)} months elapsed</span>
            <span>{Math.round(monthsRemaining)} months remaining</span>
          </div>
        </div>

        <p className={`text-sm font-medium ${fStyle.text}`}>
          {fStyle.icon}&nbsp;
          {isDeficit
            ? `Over budget — at current pace, spending will exceed the annual budget by $${fmt(Math.abs(surplusOrDeficit))} by year-end.`
            : projectedYearEnd / data.totalBudget >= 0.85
            ? `Tight — projected to finish at $${fmt(projectedYearEnd)}, leaving only $${fmtCurrency(surplusOrDeficit)} in reserve.`
            : `Healthy — projected to finish at $${fmt(projectedYearEnd)}, $${fmt(surplusOrDeficit)} under budget.`}
        </p>
      </div>

      <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        Updates every 5s · {Math.round(monthsElapsed)} months of history ({data.periodStart} – {data.periodEnd})
      </p>
    </div>
  )
}
