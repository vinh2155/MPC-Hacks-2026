import BudgetGauge from '../components/BudgetGauge'
import CategoryPie from '../components/CategoryPie'

export default function BudgetPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Budget Tracker</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Annual spend tracking and year-end forecast.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_520px] gap-6 items-start">
        <BudgetGauge />
        <CategoryPie />
      </div>
    </div>
  )
}
