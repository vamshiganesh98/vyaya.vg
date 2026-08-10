import { normCat, parseNaturalNote, parseTags, suggestCat, type Category } from '@/lib/types'
import { nowTime, today, yesterday } from '@/lib/dates'

export type ParsedExpense = {
  amount: number
  category: Category
  note: string
  payment: 'UPI' | 'Credit Card'
  date: string
  time: string
  location: string
  tags: string[]
  recurring: boolean
  split: number
  currency: string
}

export type ParseResult = {
  result: ParsedExpense
  source: 'ai' | 'local'
  warning?: string
}


export function getOpenAIKey(): string {
  return localStorage.getItem('vyaya_openai_key') || ''
}

export function setOpenAIKey(key: string) {
  const trimmed = key.trim()
  if (trimmed) localStorage.setItem('vyaya_openai_key', trimmed)
  else localStorage.removeItem('vyaya_openai_key')
}

function getSheetUrl(): string {
  return localStorage.getItem('vyaya_url') || ''
}

function parseDateFromText(text: string): string {
  const lower = text.toLowerCase()
  if (/\byesterday\b/.test(lower)) return yesterday()
  if (/\btoday\b/.test(lower) || /\bjust now\b/.test(lower)) return today()
  const dmy = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (dmy) {
    const day = dmy[1].padStart(2, '0')
    const month = dmy[2].padStart(2, '0')
    const year = dmy[3] ? (dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]) : String(new Date().getFullYear())
    return `${year}-${month}-${day}`
  }
  return today()
}

function parsePayment(text: string): 'UPI' | 'Credit Card' {
  const lower = text.toLowerCase()
  if (/\b(credit card|cc|card)\b/.test(lower)) return 'Credit Card'
  return 'UPI'
}

function extractAmount(text: string): number {
  const inr = text.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i)
  if (inr) return parseFloat(inr[1])
  const num = text.match(/(\d+(?:\.\d+)?)/)
  return num ? parseFloat(num[1]) : 0
}

function cleanNote(text: string, amount: number): string {
  let note = text
    .replace(/(?:i\s+)?(?:spent|paid|spend)\s*/gi, '')
    .replace(/(?:₹|rs\.?|inr)\s*\d+(?:\.\d+)?/gi, '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:rupees?|bucks?)?/gi, '')
    .replace(/\b(for|on|at|in)\b/gi, ' ')
    .replace(/\b(today|yesterday)\b/gi, '')
    .replace(/\b(upi|credit card|cc)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!note && amount > 0) {
    const words = text.split(/\s+/).filter((w) => !/^\d/.test(w) && !/^(spent|paid|for|on|at|in|today|yesterday)$/i.test(w))
    note = words.join(' ').trim()
  }
  return note.slice(0, 120)
}

function mapAiJson(parsed: Record<string, unknown>, text: string): ParsedExpense | null {
  const amount = parseFloat(String(parsed.amount || 0))
  if (!amount || amount <= 0) return null
  return {
    amount,
    category: normCat(String(parsed.category || 'Others')),
    note: String(parsed.note || '').trim() || cleanNote(text, amount),
    payment: String(parsed.payment).toLowerCase().includes('credit') ? 'Credit Card' : 'UPI',
    date: String(parsed.date || today()).slice(0, 10),
    time: nowTime(),
    location: String(parsed.location || '').trim(),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : parseTags(text),
    recurring: Boolean(parsed.recurring),
    split: Math.min(10, Math.max(1, parseInt(String(parsed.split || '1'), 10) || 1)),
    currency: 'INR',
  }
}

export function parseExpenseLocal(text: string): ParsedExpense | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const nl = parseNaturalNote(trimmed.replace(/₹/g, ''))
  const amount = nl?.amount || extractAmount(trimmed)
  if (!amount || amount <= 0) return null

  const note = nl?.desc || cleanNote(trimmed, amount)
  const category = suggestCat(note) || suggestCat(trimmed) || normCat('Others')

  return {
    amount,
    category,
    note: note || trimmed.slice(0, 80),
    payment: parsePayment(trimmed),
    date: parseDateFromText(trimmed),
    time: nowTime(),
    location: '',
    tags: parseTags(trimmed),
    recurring: /\b(subscription|monthly|recurring|apple care|insurance)\b/i.test(trimmed),
    split: 1,
    currency: 'INR',
  }
}

/** Route OpenAI via Apps Script — browsers on github.io cannot call api.openai.com directly (CORS). */
async function parseExpenseViaAppsScript(text: string, apiKey: string): Promise<ParsedExpense | null> {
  const sheetUrl = getSheetUrl()
  if (!sheetUrl) throw new Error('Add your Apps Script URL in Setup → Google Sheets sync')

  const res = await fetch(sheetUrl, {
    method: 'POST',
    body: JSON.stringify({ action: 'parse', text, apiKey }),
  })
  const data = await res.json()
  if (data.error) throw new Error(String(data.error))
  if (!data.result) return null
  return mapAiJson(data.result as Record<string, unknown>, text)
}

export async function parseExpenseText(text: string): Promise<ParseResult> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Enter an expense')

  const apiKey = getOpenAIKey()
  if (apiKey) {
    try {
      const ai = await parseExpenseViaAppsScript(trimmed, apiKey)
      if (ai) return { result: ai, source: 'ai' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI failed'
      const local = parseExpenseLocal(trimmed)
      if (local) {
        return {
          result: local,
          source: 'local',
          warning: msg.includes('Apps Script')
            ? `${msg}. Redeploy google-apps-script.js with the latest parse action.`
            : `AI unavailable: ${msg}`,
        }
      }
      throw e
    }
  }

  const local = parseExpenseLocal(trimmed)
  if (!local) throw new Error('Could not understand that expense. Try: "spent 50 at Starbucks"')
  return { result: local, source: 'local' }
}

export function parsedToTxnPayload(p: ParsedExpense) {
  return {
    amount: p.amount,
    originalAmount: p.amount,
    originalCurrency: p.currency,
    category: p.category,
    payment: p.payment,
    note: p.note,
    date: p.date,
    time: p.time,
    split: p.split,
    paidCount: 0,
    tags: p.tags,
    location: p.location,
    recurring: p.recurring,
  }
}
