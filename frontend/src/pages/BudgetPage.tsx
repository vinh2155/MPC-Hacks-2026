import BudgetGauge from '../components/BudgetGauge'

export default function BudgetPage() {
  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Budget Tracker</h2>
      <BudgetGauge />
    </div>
  )
}
