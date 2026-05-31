import { useState, useEffect } from 'react'
import { RoleProvider, useRole } from './context/RoleContext'
import { BudgetProvider } from './context/BudgetContext'
import { ComplianceProvider } from './context/ComplianceContext'
import BudgetPage from './pages/BudgetPage'
import ChatPage from './pages/ChatPage'
import PolicyPage from './pages/PolicyPage'
import ApprovalsPage from './pages/ApprovalsPage'
import ReportsPage from './pages/ReportsPage'
import TransactionsPage from './pages/TransactionsPage'
import RankingsPage from './pages/RankingsPage'
import CompliancePage from './pages/CompliancePage'
import EmployeeRequestPage from './pages/EmployeeRequestPage'
import SidebarNav from './components/SidebarNav'
import BottomNav from './components/BottomNav'
import type { ManagerTab } from './lib/types'

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

function AppShell() {
  const { role, toggleRole } = useRole()
  const [activeTab, setActiveTab] = useState<ManagerTab>('budget')
  const { count: pendingCount, refetch: refetchPending } = usePendingCount()

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
      {role === 'manager' && (
        <SidebarNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingCount={pendingCount}
          onRoleToggle={toggleRole}
        />
      )}

      {role === 'manager' ? (
        <div className="lg:ml-[220px] pb-14 lg:pb-0 min-h-screen">
          <div className={activeTab !== 'budget' ? 'hidden' : ''}><BudgetPage /></div>
          <div className={activeTab !== 'chat' ? 'hidden' : ''}><ChatPage /></div>
          <div className={activeTab !== 'transactions' ? 'hidden' : ''}><TransactionsPage /></div>
          <div className={activeTab !== 'compliance' ? 'hidden' : ''}><CompliancePage /></div>
          <div className={activeTab !== 'policy' ? 'hidden' : ''}><PolicyPage /></div>
          <div className={activeTab !== 'reports' ? 'hidden' : ''}><ReportsPage /></div>
          <div className={activeTab !== 'rankings' ? 'hidden' : ''}><RankingsPage /></div>
          {activeTab === 'approvals' && <ApprovalsPage onDecide={refetchPending} />}
        </div>
      ) : (
        <div className="min-h-screen flex flex-col">
          <header
            className="flex items-center justify-between px-5 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}
          >
            <div>
              <span className="text-base font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Brianna
              </span>
              <span
                className="ml-2 text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: 'var(--text-muted)' }}
              >
                Employee
              </span>
            </div>
            <button
              onClick={toggleRole}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors duration-150"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
              }}
            >
              Switch to Manager
            </button>
          </header>
          <EmployeeRequestPage />
        </div>
      )}

      {role === 'manager' && (
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingCount={pendingCount}
          onRoleToggle={toggleRole}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <RoleProvider>
      <BudgetProvider>
        <ComplianceProvider>
          <AppShell />
        </ComplianceProvider>
      </BudgetProvider>
    </RoleProvider>
  )
}
