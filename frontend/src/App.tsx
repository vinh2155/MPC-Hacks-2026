import { useState, useEffect } from 'react'
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
  { id: 'chat', label: 'Chat' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'policy', label: 'Policy' },
  { id: 'approvals', label: 'Approvals Inbox' },
  { id: 'reports', label: 'Reports' },
  { id: 'budget', label: 'Budget Tracker' },
]

function usePendingCount() {
  const [count, setCount] = useState(0)

  function poll() {
    fetch('/api/requests')
      .then(r => r.ok ? r.json() : [])
      .then((data: unknown) => {
        if (Array.isArray(data)) {
          setCount(data.filter((r: unknown) => (r as { status: string }).status === 'pending').length)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    poll()
    const id = setInterval(poll, 10_000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { count, refetch: poll }
}

function ManagerView({ activeTab, setActiveTab }: {
  activeTab: ManagerTab
  setActiveTab: (tab: ManagerTab) => void
}) {
  const { count: pendingCount, refetch: refetchPending } = usePendingCount()
  return (
    <>
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex gap-0">
            {MANAGER_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.id === 'approvals' && pendingCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                    {pendingCount}
                  </span>
                )}
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
        {activeTab === 'approvals' && <ApprovalsPage onDecide={refetchPending} />}
        <div className={activeTab !== 'reports' ? 'hidden' : ''}><ReportsPage /></div>
      </main>
    </>
  )
}

function AppShell() {
  const { role, toggleRole } = useRole()
  const [activeTab, setActiveTab] = useState<ManagerTab>('chat')

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
