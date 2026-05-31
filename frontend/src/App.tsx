import { useState } from 'react'
import { RoleProvider, useRole } from './context/RoleContext'
import { BudgetProvider } from './context/BudgetContext'
import BudgetPage from './pages/BudgetPage'
import ChatPage from './pages/ChatPage'
import PolicyPage from './pages/PolicyPage'
import ApprovalsPage from './pages/ApprovalsPage'
import ReportsPage from './pages/ReportsPage'
import TransactionsPage from './pages/TransactionsPage'
import EmployeeRequestPage from './pages/EmployeeRequestPage'

type ManagerTab = 'budget' | 'chat' | 'policy' | 'approvals' | 'reports' | 'transactions'

const MANAGER_TABS: { id: ManagerTab; label: string }[] = [
  { id: 'budget', label: 'Budget Tracker' },
  { id: 'chat', label: 'Chat' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'policy', label: 'Policy' },
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
        <div className={activeTab !== 'transactions' ? 'hidden' : ''}><TransactionsPage /></div>
        <div className={activeTab !== 'policy' ? 'hidden' : ''}><PolicyPage /></div>
        {activeTab === 'approvals' && <ApprovalsPage />}
        <div className={activeTab !== 'reports' ? 'hidden' : ''}><ReportsPage /></div>
      </main>
    </>
  )
}

function AppShell() {
  const { role, toggleRole } = useRole()
  const [activeTab, setActiveTab] = useState<ManagerTab>('budget')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <span className="text-xl font-bold text-gray-900">Brianna</span>
          <div className="flex items-center gap-4">
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
      <BudgetProvider>
        <AppShell />
      </BudgetProvider>
    </RoleProvider>
  )
}
