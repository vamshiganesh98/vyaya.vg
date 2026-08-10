import { getSpendPersonality, getSpendStreak, getUnderBudgetStreak } from '@/lib/insights'
import { catInfo, type Txn } from '@/lib/types'
import { currentMonthKey, isSpendCat, monthKey, prevMonthKey, today } from '@/lib/dates'

export type SpendMetrics = {
  today: number
  week: number
  month: number
  monthTxns: number
  prevMonth: number
  monthDeltaPct: number | null
  dailyAvg: number
  biggest: { amount: number; note: string } | null
  budgetPct: number
  budgetRemaining: number
  byCategory: { name: string; amount: number; pct: number; icon: string; color: string }[]
  byPayment: { name: string; amount: number; pct: number }[]
  topMerchants: { name: string; amount: number; count: number }[]
  personality: ReturnType<typeof getSpendPersonality>
  noSpendStreak: number
  underBudgetStreak: number
  openSplits: number
  pendingCount: number
}

function weekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function sumInRange(txns: Txn[], from: string, to?: string) {
  return txns
    .filter((t) => isSpendCat(t.category) && t.date >= from && (!to || t.date <= to))
    .reduce((s, t) => s + t.amount, 0)
}

export function computeSpendMetrics(txns: Txn[], budget: number): SpendMetrics {
  const mk = currentMonthKey()
  const pmk = prevMonthKey(mk)
  const monthList = txns.filter((t) => monthKey(t.date) === mk && isSpendCat(t.category))
  const prevList = txns.filter((t) => monthKey(t.date) === pmk && isSpendCat(t.category))
  const month = monthList.reduce((s, t) => s + t.amount, 0)
  const prevMonth = prevList.reduce((s, t) => s + t.amount, 0)
  const todaySpend = sumInRange(txns, today())
  const weekSpend = sumInRange(txns, weekStart())
  const dayOfMonth = parseInt(today().slice(8, 10), 10)
  const dailyAvg = dayOfMonth > 0 ? month / dayOfMonth : 0

  const catMap: Record<string, number> = {}
  monthList.forEach((t) => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount
  })
  const byCategory = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      pct: month > 0 ? Math.round((amount / month) * 100) : 0,
      icon: catInfo(name).i,
      color: catInfo(name).c,
    }))

  const payMap: Record<string, number> = {}
  monthList.forEach((t) => {
    const p = t.payment || 'UPI'
    payMap[p] = (payMap[p] || 0) + t.amount
  })
  const byPayment = Object.entries(payMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      pct: month > 0 ? Math.round((amount / month) * 100) : 0,
    }))

  const merchMap: Record<string, { amount: number; count: number }> = {}
  monthList.forEach((t) => {
    const key = (t.note || t.category).trim()
    if (!key) return
    if (!merchMap[key]) merchMap[key] = { amount: 0, count: 0 }
    merchMap[key].amount += t.amount
    merchMap[key].count += 1
  })
  const topMerchants = Object.entries(merchMap)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 5)
    .map(([name, v]) => ({ name, ...v }))

  const biggest = monthList.length
    ? monthList.reduce((best, t) => (t.amount > best.amount ? { amount: t.amount, note: t.note || t.category } : best), {
        amount: 0,
        note: '',
      })
    : null

  const monthDeltaPct =
    prevMonth > 0 ? Math.round(((month - prevMonth) / prevMonth) * 100) : month > 0 ? 100 : null

  return {
    today: todaySpend,
    week: weekSpend,
    month,
    monthTxns: monthList.length,
    prevMonth,
    monthDeltaPct,
    dailyAvg,
    biggest: biggest && biggest.amount > 0 ? biggest : null,
    budgetPct: budget > 0 ? Math.min(100, Math.round((month / budget) * 100)) : 0,
    budgetRemaining: Math.max(0, budget - month),
    byCategory,
    byPayment,
    topMerchants,
    personality: getSpendPersonality(txns),
    noSpendStreak: getSpendStreak(txns),
    underBudgetStreak: getUnderBudgetStreak(txns, budget),
    openSplits: txns.filter((t) => (t.split || 1) > 1 && (t.paidCount || 0) < (t.split || 1)).length,
    pendingCount: txns.filter((t) => t.pending).length,
  }
}
