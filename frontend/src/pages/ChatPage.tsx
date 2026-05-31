import { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { fmt } from '../lib/format'
import { CHART_COLORS } from '../lib/chartColors'

type VisualizationType = 'bar' | 'pie' | 'line' | 'table' | 'number'

interface Visualization {
  type: VisualizationType
  title: string
  data: Record<string, unknown>[]
  config: Record<string, unknown>
}

interface ChatResponse {
  answer: string
  visualization: Visualization | null
  followUpSuggestions: string[]
  metadata: { dateRange: string; confidence: 'high' | 'medium' | 'low'; rowsAnalyzed: number }
}

type UserMessage = { role: 'user'; content: string }
type AssistantMessage = { role: 'assistant'; content: string; response: ChatResponse }
type ChatMessage = UserMessage | AssistantMessage

const TOOLTIP_STYLE = {
  background: '#1D1D2E',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '8px',
  color: '#EEEEF5',
  fontSize: '12px',
}

function normalizeChartData(raw: Record<string, unknown>[]): { label: string; value: number }[] {
  if (!raw.length) return []
  const first = raw[0]
  if ('label' in first && 'value' in first) return raw as { label: string; value: number }[]
  const labelKey = Object.keys(first).find(k => typeof first[k] === 'string') ?? ''
  const valueKey = Object.keys(first).find(k => typeof first[k] === 'number') ?? ''
  if (!labelKey || !valueKey) return []
  return raw.map(r => ({ label: String(r[labelKey] ?? ''), value: Number(r[valueKey] ?? 0) }))
}

function confidenceColor(c: 'high' | 'medium' | 'low'): string {
  if (c === 'high') return 'text-[#34D987]'
  if (c === 'medium') return 'text-[#F5A623]'
  return 'text-[#F55858]'
}

function BarViz({ data }: { data: Record<string, unknown>[] }) {
  const chartData = normalizeChartData(data)
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8888AA' }} />
        <YAxis tick={{ fontSize: 11, fill: '#8888AA' }} tickFormatter={(v: number) => `$${fmt(v)}`} />
        <Tooltip formatter={(v: number) => [`$${fmt(v)}`, 'Amount']} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function PieViz({ data }: { data: Record<string, unknown>[] }) {
  const chartData = normalizeChartData(data)
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={90}
          paddingAngle={2}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => [`$${fmt(v)}`, '']} contentStyle={TOOLTIP_STYLE} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ color: '#8888AA', fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function LineViz({ data }: { data: Record<string, unknown>[] }) {
  const chartData = normalizeChartData(data)
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8888AA' }} />
        <YAxis tick={{ fontSize: 11, fill: '#8888AA' }} tickFormatter={(v: number) => `$${fmt(v)}`} />
        <Tooltip formatter={(v: number) => [`$${fmt(v)}`, 'Amount']} contentStyle={TOOLTIP_STYLE} />
        <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS[0] }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function TableViz({ data }: { data: Record<string, unknown>[] }) {
  if (!data.length) return <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No data</p>
  const columns = Object.keys(data[0])
  return (
    <div className="overflow-auto max-h-60">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-base)' }}>
            {columns.map(col => (
              <th
                key={col}
                className="text-left px-3 py-2 font-medium whitespace-nowrap"
                style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}
              >
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
              {columns.map(col => {
                const v = row[col]
                const isAmt = typeof v === 'number' &&
                  (col.includes('amount') || col.includes('spend') || col.includes('total'))
                return (
                  <td
                    key={col}
                    className="px-3 py-2 whitespace-nowrap"
                    style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    {isAmt ? `$${fmt(v as number)}` : String(v ?? '')}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


function VizCard({ viz }: { viz: Visualization }) {
  if (!viz.data.length) return null
  return (
    <div
      className="rounded-xl p-4 mt-2"
      style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
        {viz.title}
      </p>
      {viz.type === 'bar' && <BarViz data={viz.data} />}
      {viz.type === 'pie' && <PieViz data={viz.data} />}
      {viz.type === 'line' && <LineViz data={viz.data} />}
      {viz.type === 'table' && <TableViz data={viz.data} />}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'rgba(79,130,247,0.15)' }}
      >
        <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>B</span>
      </div>
      <div
        className="rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center"
        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
      >
        {[0, 150, 300].map(delay => (
          <span
            key={delay}
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: 'var(--text-muted)', animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

function FollowUpChips({ suggestions, onSelect, disabled }: { suggestions: string[]; onSelect: (s: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          disabled={disabled}
          className="rounded-full text-xs px-3 py-1 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            border: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--accent)',
          }}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div
        className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap text-white"
        style={{ backgroundColor: 'var(--accent)' }}
      >
        {content}
      </div>
    </div>
  )
}

function AssistantBubble({ msg, onFollowUp, disabled }: { msg: AssistantMessage; onFollowUp: (s: string) => void; disabled: boolean }) {
  const { response } = msg
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'rgba(79,130,247,0.15)' }}
      >
        <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>B</span>
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="rounded-2xl rounded-tl-sm px-4 py-3"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
        >
          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{msg.content}</p>
        </div>
        {response.visualization && <VizCard viz={response.visualization} />}
        <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap" style={{ color: 'var(--text-muted)' }}>
          <span>{response.metadata.dateRange}</span>
          <span>·</span>
          <span>{response.metadata.rowsAnalyzed} rows</span>
          <span>·</span>
          <span className={confidenceColor(response.metadata.confidence)}>
            {response.metadata.confidence} confidence
          </span>
        </div>
        <FollowUpChips suggestions={response.followUpSuggestions} onSelect={onFollowUp} disabled={disabled} />
      </div>
    </div>
  )
}

const STARTER_PROMPTS = [
  'What is our total spend?',
  'Which employee spent the most on fuel?',
  'Show me a category breakdown',
]

function EmptyState({ onSelect }: { onSelect: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 text-center">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: 'rgba(79,130,247,0.15)' }}
      >
        <span className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>B</span>
      </div>
      <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Ask Brianna</h3>
      <p className="text-sm mb-6 max-w-xs" style={{ color: 'var(--text-secondary)' }}>
        Ask me about team spending, compliance, or individual employees.
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {STARTER_PROMPTS.map((p, i) => (
          <button
            key={i}
            onClick={() => onSelect(p)}
            className="rounded-full text-sm px-4 py-2 transition-colors"
            style={{
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--accent)',
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
      style={{
        backgroundColor: 'rgba(245,88,88,0.10)',
        border: '1px solid rgba(245,88,88,0.30)',
        color: 'var(--accent-red)',
      }}
    >
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="font-medium leading-none opacity-70 hover:opacity-100">×</button>
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return
    const userMsg: UserMessage = { role: 'user', content: text.trim() }
    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), history }),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json() as ChatResponse
      const assistantMsg: AssistantMessage = { role: 'assistant', content: data.answer, response: data }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen">
      {/* Scrollable message thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && <EmptyState onSelect={text => void sendMessage(text)} />}
        {messages.map((m, i) =>
          m.role === 'user'
            ? <UserBubble key={i} content={m.content} />
            : <AssistantBubble key={i} msg={m} onFollowUp={text => void sendMessage(text)} disabled={loading} />
        )}
        {loading && <TypingIndicator />}
        {error !== null && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex gap-2 items-end">
          <textarea
            rows={1}
            placeholder="Ask about team spending… (Shift+Enter for newline)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              caretColor: 'var(--accent)',
            }}
          />
          <button
            onClick={() => void sendMessage(input)}
            disabled={loading || !input.trim()}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
