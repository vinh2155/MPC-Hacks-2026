import type { ManagerTab } from '../lib/types'

interface Props {
  activeTab: ManagerTab
  setActiveTab: (tab: ManagerTab) => void
  pendingCount: number
  onRoleToggle: () => void
}

interface NavItem {
  id: ManagerTab
  label: string
  icon: React.ReactNode
}

function IconBudget() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="8" width="3" height="7" rx="0.5" />
      <rect x="6.5" y="4" width="3" height="11" rx="0.5" />
      <rect x="12" y="1" width="3" height="14" rx="0.5" />
    </svg>
  )
}

function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H2a1 1 0 00-1 1v8a1 1 0 001 1h4l2 2 2-2h4a1 1 0 001-1V3a1 1 0 00-1-1z" />
    </svg>
  )
}

function IconTransactions() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 4h12M2 8h12M2 12h7" />
    </svg>
  )
}

function IconApprovals() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="14" height="10" rx="1.5" />
      <path d="M1 9h3.5l1.5 2h4l1.5-2H15" />
    </svg>
  )
}

function IconReports() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="1" width="10" height="14" rx="1.5" />
      <path d="M6 5.5h4M6 8h4M6 10.5h2" />
    </svg>
  )
}

function IconPolicy() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 5h12M2 8h12M2 11h12" />
      <circle cx="5.5" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="11" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="7" cy="11" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconRankings() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-.5L8 2z" />
    </svg>
  )
}

const NAV_ITEMS: NavItem[] = [
  { id: 'chat',         label: 'Chat',        icon: <IconChat /> },
  { id: 'transactions', label: 'Txns',        icon: <IconTransactions /> },
  { id: 'policy',       label: 'Policy',      icon: <IconPolicy /> },
  { id: 'approvals',    label: 'Approvals',   icon: <IconApprovals /> },
  { id: 'reports',      label: 'Reports',     icon: <IconReports /> },
  { id: 'budget',       label: 'Budget',      icon: <IconBudget /> },
  { id: 'rankings',     label: 'Rankings',    icon: <IconRankings /> },
]

export default function BottomNav({ activeTab, setActiveTab, pendingCount, onRoleToggle }: Props) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch overflow-x-auto"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        height: '56px',
      }}
    >
      {NAV_ITEMS.map(item => {
        const isActive = activeTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="relative flex flex-col items-center justify-center gap-0.5 px-3 min-w-[56px] flex-1 transition-colors duration-150"
            style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            {isActive && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-b-full"
                style={{ backgroundColor: 'var(--accent)' }}
              />
            )}
            {item.icon}
            <span className="text-[9px] font-semibold tracking-wide">{item.label}</span>
            {item.id === 'approvals' && pendingCount > 0 && (
              <span
                className="absolute top-1.5 right-2 text-[8px] font-bold leading-none w-3.5 h-3.5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent-red)', color: '#fff' }}
              >
                {pendingCount}
              </span>
            )}
          </button>
        )
      })}

      {/* Role toggle */}
      <button
        onClick={onRoleToggle}
        className="flex flex-col items-center justify-center gap-0.5 px-3 min-w-[56px] flex-1 transition-colors duration-150"
        style={{ color: 'var(--text-muted)' }}
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="5" r="3" />
          <path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" />
        </svg>
        <span className="text-[9px] font-semibold tracking-wide">Switch</span>
      </button>
    </nav>
  )
}
