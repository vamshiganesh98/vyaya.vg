import { currentMonthKey, daysInMonth, isSpendCat, monthKey, today } from '@/lib/dates'
import { catInfo, type Goal, type Txn } from '@/lib/types'

export type Insight = { id: string; title: string; sub: string; tone?: 'gold' | 'warn' | 'good' | 'info' }

export function getSpendPersonality(txns: Txn[]) {
  const list = txns.filter((t) => monthKey(t.date) === currentMonthKey())
  if (list.length < 3) return null
  const spendList = list.filter((t) => isSpendCat(t.category))
  const total = spendList.reduce((s, t) => s + t.amount, 0)
  if (total <= 0) return null
  const catTotals: Record<string, number> = {}
  spendList.forEach((t) => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount
  })
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]
  const topPct = topCat ? Math.round((topCat[1] / total) * 100) : 0
  const nightPct = Math.round(
    (list.filter((t) => parseInt((t.time || '00:00').split(':')[0], 10) >= 21).length / list.length) * 100,
  )
  const weekendAmt = spendList
    .filter((t) => {
      const d = new Date(t.date + 'T00:00:00').getDay()
      return d === 0 || d === 6
    })
    .reduce((s, t) => s + t.amount, 0)
  const weekendPct = Math.round((weekendAmt / total) * 100)
  if (topCat && topCat[0] === 'Food' && topPct >= 35)
    return { label: 'The Foodie 🍽️', sub: `Food is ${topPct}% of your spend`, tone: 'gold' as const }
  if (nightPct >= 40) return { label: 'Night Owl 🦉', sub: `${nightPct}% of txns after 9pm`, tone: 'info' as const }
  if (weekendPct >= 45) return { label: 'Weekend Warrior 🎉', sub: `${weekendPct}% spent on weekends`, tone: 'gold' as const }
  if (topCat && topPct >= 45)
    return { label: `${catInfo(topCat[0]).i} Focused`, sub: `${topCat[0]} is ${topPct}% of spend`, tone: 'info' as const }
  return { label: 'Balanced Spender ⚖️', sub: 'No single category dominates', tone: 'good' as const }
}

export function getSpendStreak(txns: Txn[]) {
  let streak = 0
  for (let i = 0; i < 60; i++) {
    const d = new Date(Date.now() - i * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const spent = txns.some((t) => t.date === d && isSpendCat(t.category))
    if (i === 0 && spent) return 0
    if (!spent) streak++
    else break
  }
  return streak
}

export function getUnderBudgetStreak(txns: Txn[], budget: number) {
  if (!budget) return 0
  let streak = 0
  let mk = currentMonthKey()
  for (let i = 0; i < 12; i++) {
    const spend = txns
      .filter((t) => monthKey(t.date) === mk && isSpendCat(t.category))
      .reduce((s, t) => s + t.amount, 0)
    if (spend > 0 && spend <= budget) streak++
    else break
    const [y, m] = mk.split('-').map(Number)
    mk = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  }
  return streak
}

export function buildInsights(
  txns: Txn[],
  budget: number,
  catBudgets: Record<string, number>,
  goals: Goal[],
): Insight[] {
  const mk = currentMonthKey()
  const monthList = txns.filter((t) => monthKey(t.date) === mk && isSpendCat(t.category))
  const total = monthList.reduce((s, t) => s + t.amount, 0)
  const cards: Insight[] = []

  Object.entries(catBudgets).forEach(([cat, lim]) => {
    if (!lim) return
    const spent = monthList.filter((t) => t.category === cat).reduce((s, t) => s + t.amount, 0)
    const pct = Math.round((spent / lim) * 100)
    if (pct >= 80)
      cards.push({
        id: `cat-${cat}`,
        title: `${cat} ${pct}%`,
        sub: `${Math.round(spent).toLocaleString('en-IN')} of ${lim.toLocaleString('en-IN')}`,
        tone: pct >= 100 ? 'warn' : 'gold',
      })
  })

  const catTotals: Record<string, number> = {}
  monthList.forEach((t) => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount
  })
  const top = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]
  if (top && total > 0) {
    cards.push({
      id: 'top-cat',
      title: `Top: ${top[0]}`,
      sub: `${Math.round((top[1] / total) * 100)}% of month`,
      tone: 'info',
    })
  }

  if (budget > 0) {
    const day = parseInt(today().split('-')[2], 10)
    const dim = daysInMonth(mk)
    const predicted = day > 0 ? (total / day) * dim : total
    cards.push({
      id: 'predict',
      title: `~₹${Math.round(predicted).toLocaleString('en-IN')}`,
      sub: 'Predicted month spend',
      tone: predicted > budget ? 'warn' : 'good',
    })
  }

  const personality = getSpendPersonality(txns)
  if (personality) cards.push({ id: 'persona', title: personality.label, sub: personality.sub, tone: personality.tone })

  const streak = getSpendStreak(txns)
  if (streak >= 2) cards.push({ id: 'streak', title: `${streak}-day streak`, sub: 'No-spend days', tone: 'good' })

  const under = getUnderBudgetStreak(txns, budget)
  if (under >= 2) cards.push({ id: 'under', title: `${under} mo under budget`, sub: 'Keep it going', tone: 'good' })

  goals.slice(0, 2).forEach((g) => {
    const pct = g.target ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0
    cards.push({ id: `goal-${g.id}`, title: g.name, sub: `${pct}% · ₹${g.saved.toLocaleString('en-IN')}`, tone: 'gold' })
  })

  const splits = txns.filter((t) => t.split > 1 && t.paidCount < t.split - 1)
  if (splits.length) {
    const owed = splits.reduce((s, t) => s + (t.amount / t.split) * (t.split - 1 - t.paidCount), 0)
    cards.push({
      id: 'splits',
      title: 'Splits owed',
      sub: `₹${Math.round(owed).toLocaleString('en-IN')} · ${splits.length} open`,
      tone: 'info',
    })
  }

  return cards.slice(0, 4)
}

export function isRecurringDue(r: {
  freq: string
  freqDays?: number
  freqDate?: number
  freqN?: number
  lastLogged?: string
}) {
  const last = r.lastLogged || '1970-01-01'
  const now = today()
  if (last >= now) return false
  if (r.freq === 'daily') return true
  if (r.freq === 'weekly') {
    const lastD = new Date(last + 'T00:00:00').getTime()
    return Date.now() - lastD >= 7 * 86400000
  }
  if (r.freq === 'interval') {
    const n = r.freqN || 30
    const lastD = new Date(last + 'T00:00:00').getTime()
    return Date.now() - lastD >= n * 86400000
  }
  // monthly
  const day = r.freqDate || 1
  const todayDay = parseInt(now.split('-')[2], 10)
  const lastMk = monthKey(last)
  const curMk = currentMonthKey()
  return lastMk < curMk && todayDay >= day
}
