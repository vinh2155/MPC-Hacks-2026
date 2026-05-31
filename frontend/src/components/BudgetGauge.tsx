import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useBudget } from '../context/BudgetContext'
import { fmt, pctOf } from '../lib/format'
import { CHART_COLORS } from '../lib/chartColors'

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

export default function BudgetGauge() {
  const { data, error } = useBudget()
  const [modalOpen, setModalOpen] = useState(false)
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
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center">
        <p className="text-sm font-medium text-red-500">Unable to reach server</p>
        <p className="text-xs text-gray-400 mt-1">Budget data unavailable — retrying every 5s</p>
      </div>
    )
  }

  if (data == null) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-24 mb-4" />
        <div className="h-8 bg-gray-100 rounded w-56 mb-6" />
        <div className="h-7 bg-gray-100 rounded-full" />
      </div>
    )
  }

  const pct = data.utilizationPct
  const status = statusLabel(pct)

  const topCats = data.byCategory.slice(0, 8)
  const otherAmount = Math.max(0, data.byCategory.slice(8).reduce((s, c) => s + c.amount, 0))
  const pieData = data.byCategory.length > 8
    ? [...topCats, { label: 'Other', amount: otherAmount }]
    : topCats
  const categoryTotal = pieData.reduce((s, c) => s + c.amount, 0)

  return (
    <>
      {/* Gauge card */}
      <div
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 cursor-pointer hover:shadow-md transition-shadow duration-200 select-none"
        onClick={() => setModalOpen(true)}
        role="button"
        aria-label="Open category breakdown"
      >
        {/* Header row */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">
              Team Budget
            </p>
            <h2 className="text-3xl font-bold text-gray-900 tabular-nums">
              ${fmt(data.totalSpend)}
              <span className="text-lg font-normal text-gray-400 ml-2">
                of ${fmt(data.totalBudget)} spent
              </span>
            </h2>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.cls}`}>
              {status.text}
            </span>
            <span className="text-2xl font-bold tabular-nums text-gray-700">
              {pct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Bar track */}
        <div className="relative h-7 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full shadow-lg transition-all duration-700 ease-out ${barColorClass(pct)} ${barGlowClass(pct)}`}
            style={{ width: `${displayPct}%` }}
          />
          {/* Tick marks at 70% and 90% */}
          <div className="absolute inset-0 flex items-stretch pointer-events-none">
            <div className="w-[70%] border-r-2 border-white/40" />
            <div className="w-[20%] border-r-2 border-white/40" />
          </div>
        </div>

        {/* Threshold labels */}
        <div className="relative mt-1 h-4">
          <span className="absolute text-[10px] text-gray-400 -translate-x-1/2" style={{ left: '70%' }}>
            70%
          </span>
          <span className="absolute text-[10px] text-gray-400 -translate-x-1/2" style={{ left: '90%' }}>
            90%
          </span>
        </div>

        <p className="mt-4 text-xs text-gray-400 text-center">
          Click to see category breakdown · updates every 5s
        </p>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Spend by Category</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  ${fmt(data.totalSpend)} total · {pct.toFixed(1)}% of budget
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-light leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {pieData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No transactions yet</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="amount"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [`$${fmt(v)} (${pctOf(v, categoryTotal)}%)`, '']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <ul className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                  {pieData.map((cat, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="text-gray-700">{cat.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <span className="text-gray-400 text-xs">
                          {pctOf(cat.amount, categoryTotal)}%
                        </span>
                        <span className="font-semibold text-gray-900 tabular-nums w-20">
                          ${fmt(cat.amount)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
