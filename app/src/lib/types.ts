export type Category =
  | 'Food'
  | 'Travel & Commute'
  | 'Bills'
  | 'Q-Commerce'
  | 'Entertainment'
  | 'Investments'
  | 'Shopping'
  | 'Others'

export type Payment = 'UPI' | 'Credit Card'
export type ThemePref = 'dark' | 'light' | 'system'
export type Period = 'today' | 'week' | 'month' | 'all'
export type AnalyticsTab = 'overview' | 'categories' | 'trends' | 'year'

export type Txn = {
  id: string
  date: string
  time: string
  category: Category | string
  amount: number
  payment: Payment | string
  note: string
  split: number
  paidCount: number
  tags: string[]
  location: string
  pending?: boolean
  originalAmount?: number
  originalCurrency?: string
  recurring?: boolean
}

export type Goal = { id: string; name: string; target: number; saved: number }
export type Recurring = {
  id: string
  name: string
  amount: number
  category: string
  payment: string
  freq: 'daily' | 'weekly' | 'monthly' | 'interval'
  freqDays?: number
  freqDate?: number
  freqN?: number
  lastLogged?: string
}

export type DrillFilter =
  | { type: 'category'; value: string; month: string }
  | { type: 'payment'; value: string; month: string }
  | { type: 'dow'; value: number; month: string }
  | { type: 'tag'; value: string }

export const CATS: { k: Category; i: string; c: string }[] = [
  { k: 'Food', i: '🍽️', c: '#ff8c42' },
  { k: 'Travel & Commute', i: '🚇', c: '#5b9cf6' },
  { k: 'Bills', i: '📄', c: '#9b6dff' },
  { k: 'Q-Commerce', i: '🛒', c: '#2dd4bf' },
  { k: 'Entertainment', i: '🎬', c: '#ff6eb4' },
  { k: 'Investments', i: '📈', c: '#3ddc84' },
  { k: 'Shopping', i: '🛍️', c: '#f5d76e' },
  { k: 'Others', i: '📦', c: '#7270a0' },
]

export const PAYS: { k: Payment; i: string }[] = [
  { k: 'UPI', i: '📲' },
  { k: 'Credit Card', i: '💳' },
]

export const CURRENCIES = [
  { k: 'INR', s: '₹' },
  { k: 'USD', s: '$' },
  { k: 'EUR', s: '€' },
  { k: 'GBP', s: '£' },
  { k: 'JPY', s: '¥' },
  { k: 'AED', s: 'د.إ' },
  { k: 'SGD', s: 'S$' },
] as const

export const CAT_KEYWORDS: Record<string, string[]> = {
  Food: ['food', 'eat', 'restaurant', 'cafe', 'coffee', 'lunch', 'dinner', 'breakfast', 'snack', 'juice', 'sugarcane', 'noodle', 'buritto', 'burrito', 'mcdonalds', 'mcd', 'theobroma', 'cake', 'kapoor', 'shoba', 'green theory', 'social'],
  'Travel & Commute': ['metro', 'bus', 'auto', 'cab', 'ola', 'uber', 'fuel', 'petrol', 'parking', 'commute', 'train', 'flight', 'travel', 'rapido'],
  Bills: ['bill', 'recharge', 'airtel', 'jio', 'vi', 'electricity', 'gas', 'cylinder', 'subscription', 'apple', 'unicef', 'donation', 'fancode', 'rent', 'emi'],
  'Q-Commerce': ['blinkit', 'zepto', 'swiggy', 'zomato', 'instamart', 'dunzo', 'bigbasket', 'grofer'],
  Entertainment: ['pvr', 'inox', 'movie', 'cinema', 'concert', 'show', 'netflix', 'spotify', 'prime', 'hotstar', 'disclosure', 'bookmyshow'],
  Investments: ['indmoney', 'zerodha', 'groww', 'mutual fund', 'sip', 'invest', 'stock', 'nifty', 'ppf', 'fd'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'shop', 'mall', 'cloth', 'meesho'],
  Others: ['porter', 'other', 'misc'],
}

export const CHART_COLORS = ['#e8c547', '#5b9cf6', '#ff8c42', '#3ddc84', '#9b6dff', '#ff6eb4', '#2dd4bf', '#7270a0']

export const DEFAULT_SHEET_URL =
  'https://script.google.com/macros/s/AKfycbzj6infQ9TjQVjTjZNlMllpkhRB_No5KqjSS2vo_0NdPARgzVnDGumK8_93PP79D66Y/exec'

export function catInfo(k: string) {
  return CATS.find((c) => c.k.toLowerCase() === (k || '').toLowerCase()) || CATS[CATS.length - 1]
}

export function normCat(raw: string): Category {
  if (!raw) return 'Others'
  const r = raw.trim().toLowerCase()
  if (r.includes('travel') || r.includes('commute') || r === 'transport') return 'Travel & Commute'
  if (r.includes('food') || r.includes('dining')) return 'Food'
  if (r.includes('bill') || r.includes('utilit')) return 'Bills'
  if (r.includes('q-commerce') || r.includes('grocery') || r.includes('quick commerce')) return 'Q-Commerce'
  if (r.includes('entertain') || r.includes('leisure')) return 'Entertainment'
  if (r.includes('invest') || r.includes('saving')) return 'Investments'
  if (r.includes('shop') || r.includes('fashion') || r.includes('cloth')) return 'Shopping'
  if (r === 'other' || r === 'misc' || r === 'miscellaneous') return 'Others'
  const match = CATS.find((c) => c.k.toLowerCase() === r)
  return match ? match.k : 'Others'
}

export function suggestCat(note: string): Category | null {
  if (!note) return null
  const n = note.toLowerCase()
  for (const [cat, kws] of Object.entries(CAT_KEYWORDS)) {
    if (kws.some((kw) => n.includes(kw))) return cat as Category
  }
  return null
}

export function parseNaturalNote(text: string): { amount: number; desc: string } | null {
  if (!text) return null
  const m = text.match(/(?:paid|spent|spend)?\s*(\d+(?:\.\d+)?)\s*(?:for|on|at)?\s*(.*)/i)
  if (m && parseFloat(m[1]) > 0) return { amount: parseFloat(m[1]), desc: m[2].trim() }
  return null
}

export function parseTags(text: string): string[] {
  if (!text) return []
  const matches = text.match(/#[\w-]+/g) || []
  return [...new Set(matches.map((t) => t.toLowerCase()))]
}
