import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { parseTags, type DrillFilter, type Txn } from '@/lib/types'
import { currentMonthKey, monthKey, prevMonthKey, today } from '@/lib/dates'

export { currentMonthKey, monthKey, prevMonthKey, nextMonthKey, monthLabel, today, nowTime, genId, istDateOffset, yesterday, fmtDate, daysInMonth, isSpendCat, normDate } from '@/lib/dates'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtAmt(n: number) {
  return '₹' + Math.round(n || 0).toLocaleString('en-IN')
}

export function esc(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function fingerprint(t: Pick<Txn, 'date' | 'time' | 'amount' | 'category' | 'note'>) {
  return [t.date, t.time || '00:00', Math.round(t.amount || 0), t.category || '', (t.note || '').trim().toLowerCase()].join('|')
}

export type SmartFilters = {
  amtMin?: number
  amtMax?: number
  payment?: string
  month?: string
  date?: string
  tags?: string[]
  text?: string
}

export function parseSmartSearch(q: string): SmartFilters | null {
  if (!q) return null
  const filters: SmartFilters = {}
  let rem = q.trim()
  const rangeM = rem.match(/(\d+)-(\d+)/)
  if (rangeM) {
    filters.amtMin = parseFloat(rangeM[1])
    filters.amtMax = parseFloat(rangeM[2])
    rem = rem.replace(rangeM[0], '').trim()
  }
  const gtM = rem.match(/>(\d+)/)
  if (gtM) {
    filters.amtMin = parseFloat(gtM[1])
    rem = rem.replace(gtM[0], '').trim()
  }
  const ltM = rem.match(/<(\d+)/)
  if (ltM) {
    filters.amtMax = parseFloat(ltM[1])
    rem = rem.replace(ltM[0], '').trim()
  }
  const tagM = rem.match(/#[\w-]+/g) || []
  if (tagM.length) {
    filters.tags = tagM.map((t) => t.toLowerCase())
    rem = rem.replace(/#[\w-]+/g, '').trim()
  }
  if (/\bupi\b/i.test(rem)) {
    filters.payment = 'UPI'
    rem = rem.replace(/\bupi\b/gi, '').trim()
  }
  if (/\bcc\b|\bcredit\b/i.test(rem)) {
    filters.payment = 'Credit Card'
    rem = rem.replace(/\bcc\b|\bcredit\b/gi, '').trim()
  }
  const mNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const mFull = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
  for (let i = 0; i < 12; i++) {
    const re = new RegExp(`\\b(${mNames[i]}|${mFull[i]})\\b`, 'i')
    if (re.test(rem)) {
      filters.month = `${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`
      rem = rem.replace(re, '').trim()
      break
    }
  }
  if (/\blast month\b/i.test(rem)) {
    filters.month = prevMonthKey(currentMonthKey())
    rem = rem.replace(/\blast month\b/i, '').trim()
  }
  if (/\bthis month\b/i.test(rem)) {
    filters.month = currentMonthKey()
    rem = rem.replace(/\bthis month\b/i, '').trim()
  }
  if (/\btoday\b/i.test(rem)) {
    filters.date = today()
    rem = rem.replace(/\btoday\b/i, '').trim()
  }
  filters.text = rem.trim()
  return filters
}

export function applySmartSearch(list: Txn[], q: string) {
  const f = parseSmartSearch(q)
  if (!f) return list
  return list.filter((t) => {
    if (f.amtMin !== undefined && t.amount < f.amtMin) return false
    if (f.amtMax !== undefined && t.amount > f.amtMax) return false
    if (f.payment && t.payment !== f.payment) return false
    if (f.month && monthKey(t.date) !== f.month) return false
    if (f.date && t.date !== f.date) return false
    if (f.tags?.length) {
      const tTags = t.tags?.length ? t.tags : parseTags(t.note)
      if (!f.tags.every((tag) => tTags.includes(tag))) return false
    }
    if (f.text) {
      const tx = f.text.toLowerCase()
      if (
        !(
          (t.note || '').toLowerCase().includes(tx) ||
          (t.category || '').toLowerCase().includes(tx) ||
          (t.payment || '').toLowerCase().includes(tx) ||
          String(t.amount).includes(tx) ||
          (t.location || '').toLowerCase().includes(tx)
        )
      )
        return false
    }
    return true
  })
}

export function filterTxns(
  txns: Txn[],
  opts: { period: string; searchQ: string; drill: DrillFilter | null },
) {
  const todayStr = today()
  const weekAgo = (() => {
    const d = new Date(Date.now() - 7 * 86400000)
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  })()
  const curMon = currentMonthKey()
  let list = [...txns]

  if (opts.drill) {
    const d = opts.drill
    if (d.type === 'dow') {
      list = list.filter((t) => {
        const day = new Date(t.date + 'T00:00:00').getDay()
        return day === d.value && monthKey(t.date) === d.month
      })
    } else if (d.type === 'payment') {
      list = list.filter((t) => t.payment === d.value && monthKey(t.date) === d.month)
    } else if (d.type === 'category') {
      list = list.filter((t) => t.category === d.value && monthKey(t.date) === d.month)
    } else if (d.type === 'tag') {
      list = list.filter((t) => {
        const tags = t.tags?.length ? t.tags : parseTags(t.note)
        return tags.includes(d.value)
      })
    }
  } else if (opts.searchQ) {
    list = applySmartSearch(list, opts.searchQ)
  } else {
    if (opts.period === 'today') list = list.filter((t) => t.date === todayStr)
    else if (opts.period === 'week') list = list.filter((t) => t.date >= weekAgo)
    else if (opts.period === 'month') list = list.filter((t) => monthKey(t.date) === curMon)
  }

  return list.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
}

export async function getFxRate(from: string, to: string): Promise<number> {
  const key = `${from}_${to}`
  try {
    const cached = JSON.parse(localStorage.getItem('vyaya_fx') || '{}') as Record<string, { rate: number; ts: number }>
    if (cached[key] && cached[key].ts > Date.now() - 3600000) return cached[key].rate
  } catch {
    /* ignore */
  }
  const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`)
  const data = await res.json()
  const rate = data.rates[to] as number
  try {
    const cached = JSON.parse(localStorage.getItem('vyaya_fx') || '{}')
    cached[key] = { rate, ts: Date.now() }
    localStorage.setItem('vyaya_fx', JSON.stringify(cached))
  } catch {
    /* ignore */
  }
  return rate
}

export function detectLocation(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
          )
          const data = await res.json()
          const area =
            data.address?.suburb ||
            data.address?.neighbourhood ||
            data.address?.city_district ||
            data.address?.city ||
            ''
          resolve(area)
        } catch (e) {
          reject(e)
        }
      },
      () => reject(new Error('Location denied')),
    )
  })
}
