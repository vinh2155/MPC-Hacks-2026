export type ManagerTab = 'budget' | 'chat' | 'policy' | 'approvals' | 'reports' | 'transactions' | 'compliance' | 'rankings'

export interface Request {
  id: string
  employee_name: string
  item_description: string
  amount: number
  category: string
  reason: string
  status: 'pending' | 'approved' | 'denied'
  created_at: string
}
