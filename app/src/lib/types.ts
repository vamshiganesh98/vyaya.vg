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
  if (r.includes('q-commerce') || r.includes('grocery')) return 'Q-Commerce'
  if (r.includes('entertain') || r.includes('leisure')) return 'Entertainment'
  if (r.includes('invest') || r.includes('saving')) return 'Investments'
  if (r.includes('shop') || r.includes('fashion')) return 'Shopping'
  const match = CATS.find((c) => c.k.toLowerCase() === r)
  return match ? match.k : 'Others'
}
