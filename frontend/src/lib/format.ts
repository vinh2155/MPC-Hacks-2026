export function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
}

export function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export function pctOf(amount: number, total: number): string {
  return total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0'
}
