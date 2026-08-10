import type { ParsedExpense } from '@/lib/ai-parse'

export function getBackendUrl(): string {
  return (localStorage.getItem('vyaya_backend_url') || '').replace(/\/$/, '')
}

export function setBackendUrl(url: string) {
  const trimmed = url.trim().replace(/\/$/, '')
  if (trimmed) localStorage.setItem('vyaya_backend_url', trimmed)
  else localStorage.removeItem('vyaya_backend_url')
}

export function getBackendSecret(): string {
  return localStorage.getItem('vyaya_backend_secret') || ''
}

export function setBackendSecret(secret: string) {
  const trimmed = secret.trim()
  if (trimmed) localStorage.setItem('vyaya_backend_secret', trimmed)
  else localStorage.removeItem('vyaya_backend_secret')
}

export function usePythonBackend(): boolean {
  return !!getBackendUrl()
}

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const secret = getBackendSecret()
  if (secret) h.Authorization = `Bearer ${secret}`
  return h
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getBackendUrl()
  if (!base) throw new Error('Python API URL not configured')
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers as Record<string, string>) },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text.includes('detail') ? JSON.parse(text).detail : 'API request failed')
  }
  return res.json() as Promise<T>
}

export async function backendHealth(): Promise<{ ok: boolean; openai: boolean; sheets: boolean }> {
  return apiFetch('/health')
}

export async function backendParse(
  text: string,
): Promise<{ result: ParsedExpense; source: 'ai' | 'local' }> {
  return apiFetch('/api/parse', { method: 'POST', body: JSON.stringify({ text }) })
}

export async function backendQuickAdd(text: string): Promise<{
  parsed: ParsedExpense
  source: 'ai' | 'local'
  saved: boolean
  id: string
}> {
  return apiFetch('/api/expenses/quick', { method: 'POST', body: JSON.stringify({ text }) })
}

export async function backendFetchRows(): Promise<{ rows: Record<string, string>[] }> {
  return apiFetch('/api/expenses')
}

export async function backendAppendExpense(payload: {
  id?: string
  date: string
  time: string
  category: string
  amount: number
  payment: string
  note?: string
  split?: number
  paid_count?: number
  location?: string
  tags?: string[]
}): Promise<{ ok: boolean; id: string }> {
  return apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify(payload) })
}

export async function backendUpdateExpense(payload: {
  id: string
  date: string
  time: string
  category: string
  amount: number
  payment: string
  note?: string
  split?: number
  paid_count?: number
  location?: string
  tags?: string[]
}): Promise<{ ok: boolean }> {
  return apiFetch('/api/expenses', { method: 'PUT', body: JSON.stringify(payload) })
}

export async function backendDeleteExpense(payload: {
  id: string
  date: string
  time: string
  category: string
  amount: number
  payment?: string
  note?: string
}): Promise<{ ok: boolean }> {
  return apiFetch('/api/expenses', { method: 'DELETE', body: JSON.stringify(payload) })
}

export function sheetRowToTxn(r: Record<string, string>) {
  return {
    id: r.Id || r.ID || '',
    date: r.Date,
    time: r.Time || '00:00',
    category: r.Category || 'Others',
    amount: parseFloat(String(r.Amount || '0').replace(/,/g, '')) || 0,
    payment: r['Mode of Payment'] || 'UPI',
    note: r.Note || '',
    split: parseInt(r.Split || '1', 10) || 1,
    paidCount: parseInt(r.Paid || '0', 10) || 0,
    tags: (r.Tags || '').split(/\s+/).filter(Boolean).map((t) => (t.startsWith('#') ? t : `#${t}`)),
    location: r.Location || '',
    pending: false,
  }
}
