import BudgetGauge from '../components/BudgetGauge'
import CategoryPie from '../components/CategoryPie'

export default function BudgetPage() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Budget Tracker</h2>
      <div className="flex gap-6 items-start">
        <BudgetGauge />
        <CategoryPie />
      </div>
    </div>
  )
}
