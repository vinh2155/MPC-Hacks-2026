import { useState } from 'react'
import { RoleProvider, useRole } from './context/RoleContext'
import { BudgetProvider } from './context/BudgetContext'
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
        {activeTab === 'budget' && <BudgetPage />}
        {activeTab === 'chat' && <ChatPage />}
        {activeTab === 'compliance' && <CompliancePage />}
        {activeTab === 'approvals' && <ApprovalsPage />}
        {activeTab === 'reports' && <ReportsPage />}
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
          <button
            onClick={toggleRole}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Switch to {role === 'manager' ? 'Employee' : 'Manager'}
          </button>
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
