import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useBudget } from '../context/BudgetContext'
import { fmt, pctOf } from '../lib/format'
import { CHART_COLORS } from '../lib/chartColors'

const OTHER_COLOR = '#9ca3af'

function colorFor(label: string, index: number) {
  return label === 'Other' ? OTHER_COLOR : CHART_COLORS[index % CHART_COLORS.length]
}

export default function CategoryPie() {
  const { data, error } = useBudget()

  if (error) return null

  if (data == null) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex-1 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-32 mb-6" />
        <div className="h-72 bg-gray-100 rounded-xl" />
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex-1">
      <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-4">
        Spend by Category
      </p>

      {pieData.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">No transactions yet</p>
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
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
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
  )
}
