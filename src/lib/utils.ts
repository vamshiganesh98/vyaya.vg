import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtAmt(n: number) {
  return '₹' + Math.round(n || 0).toLocaleString('en-IN')
}

export function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export function nowTime() {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function monthKey(dateStr: string) {
  return (dateStr || '').slice(0, 7)
}

export function currentMonthKey() {
  return today().slice(0, 7)
}

export function prevMonthKey(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

export function monthLabel(ym: string) {
  if (!ym) return ''
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const [y, m] = ym.split('-')
  return `${months[parseInt(m, 10) - 1]} ${y}`
}

export function normDate(raw: string) {
  if (!raw) return today()
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const sep = s.includes('/') ? '/' : '-'
  const p = s.split(sep)
  if (p.length === 3) {
    if (p[2].length === 4) return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`
    if (p[0].length === 4) return `${p[0]}-${p[1].padStart(2,'0')}-${p[2].padStart(2,'0')}`
  }
  return today()
}

export function isSpendCat(cat: string) {
  return cat !== 'Investments'
}

export function esc(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
