import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useBudget } from '../context/BudgetContext'
import { fmt, pctOf } from '../lib/format'
import { CHART_COLORS } from '../lib/chartColors'

const OTHER_COLOR = '#4A4A6A'

function colorFor(label: string, index: number) {
  return label === 'Other' ? OTHER_COLOR : CHART_COLORS[index % CHART_COLORS.length]
}

const TOOLTIP_STYLE = {
  background: '#1D1D2E',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '8px',
  color: '#EEEEF5',
  fontSize: '12px',
}

export default function CategoryPie() {
  const { data, error } = useBudget()

  if (error) return null

  if (data == null) {
    return (
      <div
        className="rounded-2xl p-8 flex-1 animate-pulse"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="h-4 rounded w-32 mb-6" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <div className="h-72 rounded-xl" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      </div>
    )
  }

  const topCats = data.byCategory.slice(0, 8)
  const otherAmount = Math.max(0, data.byCategory.slice(8).reduce((s, c) => s + c.amount, 0))
  const pieData = data.byCategory.length > 8
    ? [...topCats, { label: 'Other', amount: otherAmount }]
    : topCats
  const categoryTotal = pieData.reduce((s, c) => s + c.amount, 0)

  return (
    <div
      className="rounded-2xl p-8 flex-1"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'var(--text-muted)' }}>
        Spend by Category
      </p>

      {pieData.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>No transactions yet</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="amount"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={112}
                paddingAngle={2}
              >
                {pieData.map((cat, i) => (
                  <Cell key={i} fill={colorFor(cat.label, i)} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => [`$${fmt(v)} (${pctOf(v, categoryTotal)}%)`, '']}
                contentStyle={TOOLTIP_STYLE}
              />
            </PieChart>
          </ResponsiveContainer>

          <ul className="mt-3 space-y-2">
            {pieData.map((cat, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: colorFor(cat.label, i) }}
                  />
                  <span style={{ color: 'var(--text-secondary)' }}>{cat.label}</span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {pctOf(cat.amount, categoryTotal)}%
                  </span>
                  <span className="font-semibold tabular-nums w-20" style={{ color: 'var(--text-primary)' }}>
                    ${fmt(cat.amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
