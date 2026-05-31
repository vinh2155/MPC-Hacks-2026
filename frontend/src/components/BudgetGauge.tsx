import { useState, useEffect } from 'react'
import { useBudget } from '../context/BudgetContext'
import { fmt, fmtCurrency } from '../lib/format'

function barColorClass(pct: number) {
  if (pct < 70) return 'bg-emerald-500'
  if (pct < 90) return 'bg-amber-400'
  return 'bg-red-500'
}

function barGlowClass(pct: number) {
  if (pct < 70) return 'shadow-emerald-400/60'
  if (pct < 90) return 'shadow-amber-400/60'
  return 'shadow-red-400/60'
}

function statusLabel(pct: number) {
  if (pct < 70) return { text: 'On Track', cls: 'text-emerald-600 bg-emerald-50' }
  if (pct < 90) return { text: 'Approaching Limit', cls: 'text-amber-600 bg-amber-50' }
  return { text: 'Over Threshold', cls: 'text-red-600 bg-red-50' }
}

function forecastStyle(projectedTotal: number, budget: number) {
  const ratio = projectedTotal / budget
  if (ratio < 0.85) return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: '✓', fillColor: '#10b981' }
  if (ratio < 1.0)  return { text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-100',   icon: '⚠', fillColor: '#f59e0b' }
  return                   { text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-100',     icon: '!', fillColor: '#ef4444' }
}

export default function BudgetGauge() {
  const { data, error } = useBudget()
  const [displayPct, setDisplayPct] = useState(0)

  useEffect(() => {
    if (data == null) {
      setDisplayPct(0)
      return
    }
    const target = Math.min(data.utilizationPct, 100)
    const t = setTimeout(() => setDisplayPct(target), 60)
    return () => clearTimeout(t)
  }, [data])

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center flex-1">
        <p className="text-sm font-medium text-red-500">Unable to reach server</p>
        <p className="text-xs text-gray-400 mt-1">Budget data unavailable — retrying every 5s</p>
      </div>
    )
  }

  if (data == null) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 animate-pulse flex-1">
        <div className="h-4 bg-gray-100 rounded w-24 mb-4" />
        <div className="h-8 bg-gray-100 rounded w-56 mb-6" />
        <div className="h-7 bg-gray-100 rounded-full" />
      </div>
    )
  }

  const pct = data.utilizationPct
  const status = statusLabel(pct)

  // Forecast math — 12-month annual budget, ~6 months of data elapsed
  const daysElapsed = (new Date(data.periodEnd).getTime() - new Date(data.periodStart).getTime()) / 86_400_000
  const monthsElapsed = Math.max(daysElapsed / 30.44, 0.5)
  const monthsRemaining = Math.max(12 - monthsElapsed, 0)
  const monthlyBurn = data.totalSpend / monthsElapsed
  const projectedAdditional = monthlyBurn * monthsRemaining
  const projectedYearEnd = data.totalSpend + projectedAdditional
  const surplusOrDeficit = data.totalBudget - projectedYearEnd
  const isDeficit = surplusOrDeficit < 0
  const fStyle = forecastStyle(projectedYearEnd, data.totalBudget)

  // Bar: spent portion + projected portion, capped at budget
  const spentPct = Math.min((data.totalSpend / data.totalBudget) * 100, 100)
  const projectedPct = Math.min((projectedAdditional / data.totalBudget) * 100, 100 - spentPct)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex-1">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">
            Annual Budget
          </p>
          <h2 className="text-4xl font-bold text-gray-900 tabular-nums">
            ${fmt(data.totalSpend)}
            <span className="text-xl font-normal text-gray-400 ml-2">
              of ${fmt(data.totalBudget)} annual budget spent
            </span>
          </h2>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.cls}`}>
            {status.text}
          </span>
          <span className="text-3xl font-bold tabular-nums text-gray-700">
            {pct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Bar track */}
      <div className="relative h-8 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full shadow-lg transition-all duration-700 ease-out ${barColorClass(pct)} ${barGlowClass(pct)}`}
          style={{ width: `${displayPct}%` }}
        />
        <div className="absolute inset-0 flex items-stretch pointer-events-none">
          <div className="w-[70%] border-r-2 border-white/40" />
          <div className="w-[20%] border-r-2 border-white/40" />
        </div>
      </div>

      {/* Threshold labels */}
      <div className="relative mt-1.5 h-4">
        <span className="absolute text-[11px] text-gray-400 -translate-x-1/2" style={{ left: '70%' }}>
          70%
        </span>
        <span className="absolute text-[11px] text-gray-400 -translate-x-1/2" style={{ left: '90%' }}>
          90%
        </span>
      </div>

      {/* Year-end forecast */}
      <div className={`mt-7 rounded-xl border p-5 ${fStyle.bg} ${fStyle.border}`}>
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-4">
          Year-End Forecast
        </p>

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Avg monthly spend</p>
            <p className="text-lg font-bold text-gray-900 tabular-nums">${fmt(monthlyBurn)}<span className="text-sm font-normal text-gray-400">/mo</span></p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Projected year-end total</p>
            <p className={`text-lg font-bold tabular-nums ${fStyle.text}`}>${fmt(projectedYearEnd)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">{isDeficit ? 'Projected overrun' : 'Projected surplus'}</p>
            <p className={`text-lg font-bold tabular-nums ${fStyle.text}`}>
              {isDeficit ? '−' : '+'}${fmt(Math.abs(surplusOrDeficit))}
            </p>
          </div>
        </div>

        {/* Stacked forecast bar: spent + projected */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>Actuals (${fmt(data.totalSpend)})</span>
            <span>Projected (+${fmt(projectedAdditional)})</span>
            <span>Budget: ${fmt(data.totalBudget)}</span>
          </div>
          <div className="h-3 rounded-full bg-white/70 overflow-hidden flex">
            <div
              className="h-full rounded-l-full transition-all duration-700"
              style={{ width: `${spentPct}%`, backgroundColor: fStyle.fillColor, opacity: 1 }}
            />
            <div
              className="h-full transition-all duration-700"
              style={{ width: `${projectedPct}%`, backgroundColor: fStyle.fillColor, opacity: 0.35 }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>{Math.round(monthsElapsed)} months elapsed</span>
            <span>{Math.round(monthsRemaining)} months remaining in year</span>
          </div>
        </div>

        <p className={`text-sm font-medium ${fStyle.text}`}>
          {fStyle.icon}&nbsp;
          {isDeficit
            ? `Over budget — at current pace, spending will exceed the annual budget by $${fmt(Math.abs(surplusOrDeficit))} by year-end.`
            : projectedYearEnd / data.totalBudget >= 0.85
            ? `Tight — projected to finish the year at $${fmt(projectedYearEnd)}, leaving only $${fmt(surplusOrDeficit)} in reserve.`
            : `Healthy — projected to finish the year at $${fmt(projectedYearEnd)}, $${fmt(surplusOrDeficit)} under budget.`}
        </p>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Updates every 5s · actuals based on {Math.round(monthsElapsed)} months of transaction history ({data.periodStart} – {data.periodEnd})
      </p>
    </div>
  )
}
