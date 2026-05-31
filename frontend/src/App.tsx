import { useState } from 'react'
import { RoleProvider, useRole } from './context/RoleContext'
import { BudgetProvider } from './context/BudgetContext'
import { ComplianceProvider, useCompliance } from './context/ComplianceContext'
import BudgetPage from './pages/BudgetPage'
import ChatPage from './pages/ChatPage'
import CompliancePage from './pages/CompliancePage'
import ApprovalsPage from './pages/ApprovalsPage'
import ReportsPage from './pages/ReportsPage'
import EmployeeRequestPage from './pages/EmployeeRequestPage'

type ManagerTab = 'budget' | 'chat' | 'compliance' | 'approvals' | 'reports'

const MANAGER_TABS: { id: ManagerTab; label: string }[] = [
  { id: 'budget', label: 'Budget Tracker' },
  { id: 'chat', label: 'Chat' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'approvals', label: 'Approvals Inbox' },
  { id: 'reports', label: 'Reports' },
]

function ManagerView({ activeTab, setActiveTab }: {
  activeTab: ManagerTab
  setActiveTab: (tab: ManagerTab) => void
}) {
  return (
    <>
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex gap-0">
            {MANAGER_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-7xl">
        <div className={activeTab !== 'budget' ? 'hidden' : ''}><BudgetPage /></div>
        <div className={activeTab !== 'chat' ? 'hidden' : ''}><ChatPage /></div>
        <div className={activeTab !== 'compliance' ? 'hidden' : ''}><CompliancePage /></div>
        {activeTab === 'approvals' && <ApprovalsPage />}
        <div className={activeTab !== 'reports' ? 'hidden' : ''}><ReportsPage /></div>
      </main>
    </>
  )
}

function scoreColorClass(score: number): string {
  if (score >= 90) return 'text-emerald-600 bg-emerald-50'
  if (score >= 75) return 'text-amber-600 bg-amber-50'
  return 'text-red-600 bg-red-50'
}

function AppShell() {
  const { role, toggleRole } = useRole()
  const { scoreData } = useCompliance()
  const [activeTab, setActiveTab] = useState<ManagerTab>('budget')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <span className="text-xl font-bold text-gray-900">Brianna</span>
          <div className="flex items-center gap-4">
            {role === 'manager' && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${scoreData ? scoreColorClass(scoreData.score) : 'text-gray-500 bg-gray-100'}`}>
                Compliance: {scoreData ? `${scoreData.score}%` : '--'}
              </span>
            )}
            <button
              onClick={toggleRole}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Switch to {role === 'manager' ? 'Employee' : 'Manager'}
            </button>
          </div>
        </div>
      </header>
      {role === 'manager' ? (
        <ManagerView activeTab={activeTab} setActiveTab={setActiveTab} />
      ) : (
        <main className="mx-auto max-w-7xl">
          <EmployeeRequestPage />
        </main>
      )}
    </div>
  )
}

export default function App() {
  return (
    <RoleProvider>
      <ComplianceProvider>
        <BudgetProvider>
          <AppShell />
        </BudgetProvider>
      </ComplianceProvider>
    </RoleProvider>
  )
}
