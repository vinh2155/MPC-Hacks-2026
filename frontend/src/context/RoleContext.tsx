import { createContext, useContext, useState } from 'react'

type Role = 'employee' | 'manager'

interface RoleContextValue {
  role: Role
  toggleRole: () => void
}

const RoleContext = createContext<RoleContextValue | null>(null)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>('manager')
  const toggleRole = () => setRole(r => (r === 'manager' ? 'employee' : 'manager'))
  return <RoleContext.Provider value={{ role, toggleRole }}>{children}</RoleContext.Provider>
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used within RoleProvider')
  return ctx
}
