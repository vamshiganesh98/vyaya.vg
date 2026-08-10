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

export function nextMonthKey(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  if (m === 12) return `${y + 1}-01`
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

export function monthLabel(ym: string) {
  if (!ym) return ''
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const [y, m] = ym.split('-')
  return `${months[parseInt(m, 10) - 1]} ${y}`
}

export function fmtDate(d: string) {
  if (!d) return ''
  const parts = d.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1]}`
}

export function daysInMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function istDateOffset(days: number) {
  return new Date(Date.now() + days * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export function yesterday() {
  return istDateOffset(-1)
}

export function isSpendCat(cat: string) {
  return cat !== 'Investments'
}

export function normDate(raw: string) {
  if (!raw) return today()
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const sep = s.includes('/') ? '/' : '-'
  const p = s.split(sep)
  if (p.length === 3) {
    if (p[2].length === 4) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
    if (p[0].length === 4) return `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`
  }
  const d = new Date(raw)
  if (!isNaN(d.getTime())) return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  return today()
}
