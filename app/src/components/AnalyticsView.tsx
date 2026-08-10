import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import { DonutChart } from '@/components/ui/donut-chart'
import type { UseExpensesReturn } from '@/hooks/useExpenses'
import {
  CHART_COLORS,
  catInfo,
  type AnalyticsTab,
  type DrillFilter,
} from '@/lib/types'
import {
  cn,
  currentMonthKey,
  fmtAmt,
  fmtDate,
  isSpendCat,
  monthKey,
  monthLabel,
  nextMonthKey,
  prevMonthKey,
} from '@/lib/utils'

const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'categories', label: 'Categories' },
  { id: 'trends', label: 'Trends' },
  { id: 'year', label: 'Year' },
]

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

export function AnalyticsView({
  api,
  month,
  setMonth,
  tab,
  setTab,
  onDrill,
}: {
  api: UseExpensesReturn
  month: string
  setMonth: (m: string) => void
  tab: AnalyticsTab
  setTab: (t: AnalyticsTab) => void
  onDrill: (d: DrillFilter) => void
}) {
  const [splitsOpen, setSplitsOpen] = useState(false)
  const cur = currentMonthKey()
  const list = useMemo(
    () => api.txns.filter((t) => monthKey(t.date) === month),
    [api.txns, month],
  )
  const spendList = useMemo(() => list.filter((t) => isSpendCat(t.category)), [list])
  const spendTotal = spendList.reduce((s, t) => s + t.amount, 0)
  const allTotal = list.reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-5">
      <BlurFade>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight">Analytics</h1>
            <p className="mt-1 text-sm text-mute">Spend patterns & insights</p>
          </div>
          <div className="glass flex items-center gap-1 rounded-2xl p-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth(prevMonthKey(month))}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-mute transition hover:bg-white/5 hover:text-foam"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-[6.5rem] text-center text-xs font-bold">{monthLabel(month)}</div>
            <button
              type="button"
              aria-label="Next month"
              disabled={month >= cur}
              onClick={() => setMonth(nextMonthKey(month))}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-mute transition hover:bg-white/5 hover:text-foam disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.04}>
        <div className="glass flex gap-1 rounded-2xl p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition',
                tab === t.id ? 'bg-gold font-bold text-ink shadow-md' : 'text-mute',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </BlurFade>

      {tab === 'overview' && (
        <OverviewTab
          api={api}
          month={month}
          spendList={spendList}
          spendTotal={spendTotal}
          splitsOpen={splitsOpen}
          setSplitsOpen={setSplitsOpen}
          onDrill={onDrill}
        />
      )}
      {tab === 'categories' && (
        <CategoriesTab
          list={list}
          total={allTotal}
          month={month}
          catBudgets={api.catBudgets}
          onDrill={onDrill}
        />
      )}
      {tab === 'trends' && (
        <TrendsTab
          txns={api.txns}
          month={month}
          setMonth={setMonth}
          onDrill={onDrill}
        />
      )}
      {tab === 'year' && <YearTab txns={api.txns} />}
    </div>
  )
}

function OverviewTab({
  api,
  month,
  spendList,
  spendTotal,
  splitsOpen,
  setSplitsOpen,
  onDrill,
}: {
  api: UseExpensesReturn
  month: string
  spendList: UseExpensesReturn['txns']
  spendTotal: number
  splitsOpen: boolean
  setSplitsOpen: (v: boolean) => void
  onDrill: (d: DrillFilter) => void
}) {
  const catTotals: Record<string, number> = {}
  spendList.forEach((t) => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount
  })
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
  const slices = sorted.map(([label, value]) => ({
    label,
    value,
    icon: catInfo(label).i,
  }))
  const budgetPct =
    api.budget > 0 ? Math.min(100, Math.round((spendTotal / api.budget) * 100)) : 0
  const budgetCol =
    budgetPct >= 90 ? 'bg-bad' : budgetPct >= 70 ? 'bg-warn' : 'bg-gold'

  const splitTxns = api.txns.filter((t) => t.split > 1 && t.paidCount < t.split - 1)
  const owedTotal = splitTxns.reduce(
    (s, t) => s + (t.amount / t.split) * (t.split - 1 - t.paidCount),
    0,
  )

  return (
    <div className="space-y-4">
      {api.budget > 0 && (
        <BlurFade delay={0.06}>
          <div className="beam glass relative overflow-hidden rounded-3xl p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
              Monthly Budget
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-3xl font-black">{fmtAmt(spendTotal)}</span>
              <span className="text-sm text-mute">of {fmtAmt(api.budget)}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={cn('h-full rounded-full', budgetCol)}
                initial={{ width: 0 }}
                animate={{ width: `${budgetPct}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="mt-2 text-[11px] text-mute">
              {budgetPct}% used · {fmtAmt(Math.max(0, api.budget - spendTotal))} remaining
            </div>
          </div>
        </BlurFade>
      )}

      <BlurFade delay={0.08}>
        <div className="glass rounded-3xl p-5">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
            Spending Breakdown · {monthLabel(month)}
          </div>
          {slices.length === 0 ? (
            <div className="py-10 text-center text-sm text-mute">No spend this month yet</div>
          ) : (
            <DonutChart
              total={spendTotal}
              slices={slices}
              onSlice={(label) => onDrill({ type: 'category', value: label, month })}
            />
          )}
        </div>
      </BlurFade>

      {splitTxns.length > 0 && (
        <BlurFade delay={0.1}>
          <div className="glass overflow-hidden rounded-3xl">
            <button
              type="button"
              onClick={() => setSplitsOpen(!splitsOpen)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <div>
                <div className="text-sm font-bold">Pending Splits</div>
                <div className="text-[10px] text-mute">{splitTxns.length} items</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-accent">{fmtAmt(owedTotal)} owed</span>
                <span className="text-xs text-mute">{splitsOpen ? '▲' : '▼'}</span>
              </div>
            </button>
            {splitsOpen && (
              <div className="space-y-2 border-t border-white/6 px-4 pb-4 pt-2">
                {splitTxns.map((t) => {
                  const ci = catInfo(t.category)
                  const rem = t.split - 1 - t.paidCount
                  const share = t.amount / t.split
                  return (
                    <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-white/4 px-3 py-2.5">
                      <span className="text-lg">{ci.i}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{t.note || t.category}</div>
                        <div className="text-[10px] text-mute">
                          {fmtDate(t.date)} · {rem} person{rem > 1 ? 's' : ''} owe you
                        </div>
                      </div>
                      <div className="text-sm font-bold tabular-nums">{fmtAmt(share * rem)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </BlurFade>
      )}
    </div>
  )
}

function CategoriesTab({
  list,
  total,
  month,
  catBudgets,
  onDrill,
}: {
  list: UseExpensesReturn['txns']
  total: number
  month: string
  catBudgets: Record<string, number>
  onDrill: (d: DrillFilter) => void
}) {
  const catTotals: Record<string, number> = {}
  list.forEach((t) => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount
  })
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1])

  if (!sorted.length) {
    return (
      <BlurFade delay={0.06}>
        <div className="glass rounded-3xl border border-dashed border-white/10 px-6 py-14 text-center text-sm text-mute">
          No data for this month
        </div>
      </BlurFade>
    )
  }

  return (
    <div className="space-y-2">
      {sorted.map(([cat, amt], i) => {
        const ci = catInfo(cat)
        const pct = total > 0 ? Math.round((amt / total) * 100) : 0
        const lim = catBudgets[cat]
        const budPct = lim ? Math.min(100, Math.round((amt / lim) * 100)) : null
        const budCol =
          budPct != null && budPct >= 90
            ? 'text-bad'
            : budPct != null && budPct >= 70
              ? 'text-warn'
              : 'text-gold'
        return (
          <BlurFade key={cat} delay={0.05 + i * 0.03}>
            <button
              type="button"
              onClick={() => onDrill({ type: 'category', value: cat, month })}
              className="glass flex w-full items-center gap-3 rounded-2xl p-3.5 text-left transition hover:bg-white/5"
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg"
                style={{ background: `${ci.c}22` }}
              >
                {ci.i}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{cat}</span>
                  {budPct != null && (
                    <span className={cn('text-[9px] font-bold', budCol)}>
                      {budPct}% of budget
                    </span>
                  )}
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.55, delay: 0.05 * i }}
                  />
                </div>
                {lim ? (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={cn(
                        'h-full rounded-full opacity-60',
                        budPct != null && budPct >= 90
                          ? 'bg-bad'
                          : budPct != null && budPct >= 70
                            ? 'bg-warn'
                            : 'bg-gold',
                      )}
                      style={{ width: `${budPct ?? 0}%` }}
                    />
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold tabular-nums">{fmtAmt(amt)}</div>
                <div className="text-[10px] text-mute">{pct}%</div>
              </div>
            </button>
          </BlurFade>
        )
      })}
    </div>
  )
}

function TrendsTab({
  txns,
  month,
  setMonth,
  onDrill,
}: {
  txns: UseExpensesReturn['txns']
  month: string
  setMonth: (m: string) => void
  onDrill: (d: DrillFilter) => void
}) {
  const months: string[] = []
  let mk = currentMonthKey()
  for (let i = 0; i < 6; i++) {
    months.unshift(mk)
    mk = prevMonthKey(mk)
  }
  const data = months.map((m) => ({
    month: m,
    label: monthLabel(m),
    total: txns.filter((t) => monthKey(t.date) === m).reduce((s, t) => s + t.amount, 0),
  }))
  const maxVal = Math.max(...data.map((d) => d.total), 1)

  const curList = txns.filter((t) => monthKey(t.date) === month)
  const dowTotals = [0, 0, 0, 0, 0, 0, 0]
  curList.forEach((t) => {
    const d = new Date(t.date + 'T00:00:00').getDay()
    dowTotals[d] += t.amount
  })
  const dowMax = Math.max(...dowTotals, 1)

  const upiTotal = curList.filter((t) => t.payment === 'UPI').reduce((s, t) => s + t.amount, 0)
  const ccTotal = curList
    .filter((t) => t.payment === 'Credit Card')
    .reduce((s, t) => s + t.amount, 0)
  const payTotal = upiTotal + ccTotal
  const upiPct = payTotal > 0 ? Math.round((upiTotal / payTotal) * 100) : 0
  const ccPct = payTotal > 0 ? 100 - upiPct : 0

  return (
    <div className="space-y-4">
      <BlurFade delay={0.06}>
        <div className="glass rounded-3xl p-5">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
            6-Month Trend
          </div>
          <div className="flex items-end justify-between gap-1.5">
            {data.map((d) => {
              const h = Math.round((d.total / maxVal) * 80)
              const isCur = d.month === currentMonthKey()
              return (
                <button
                  key={d.month}
                  type="button"
                  onClick={() => setMonth(d.month)}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <div className="flex h-20 w-full items-end justify-center">
                    <motion.div
                      className={cn(
                        'w-full max-w-[28px] rounded-t-md',
                        isCur || d.month === month
                          ? 'bg-gold'
                          : 'bg-white/10 border border-white/10',
                      )}
                      initial={{ height: 0 }}
                      animate={{ height: Math.max(h, d.total > 0 ? 4 : 2) }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="text-[9px] font-bold text-mute">{d.label.split(' ')[0]}</div>
                  <div className="text-[8px] tabular-nums text-mute-2">
                    {d.total > 0 ? fmtAmt(d.total) : '—'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.08}>
        <div className="glass rounded-3xl p-5">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
            Day of Week · {monthLabel(month)}
          </div>
          <div className="flex items-end justify-between gap-1.5">
            {dowTotals.map((v, i) => {
              const h = Math.round((v / dowMax) * 60)
              return (
                <button
                  key={DOW[i]}
                  type="button"
                  onClick={() => onDrill({ type: 'dow', value: i, month })}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <div className="flex h-[60px] w-full items-end justify-center">
                    <motion.div
                      className="w-full max-w-[28px] rounded-t-md bg-accent/70"
                      initial={{ height: 0 }}
                      animate={{ height: Math.max(h, v > 0 ? 4 : 2) }}
                      transition={{ duration: 0.45, delay: 0.03 * i }}
                    />
                  </div>
                  <div className="text-[9px] font-bold text-mute">{DOW[i]}</div>
                  <div className="text-[8px] tabular-nums text-mute-2">
                    {v > 0 ? fmtAmt(v) : '—'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        <div className="glass rounded-3xl p-5">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
            Payment Mode
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onDrill({ type: 'payment', value: 'UPI', month })}
              className="rounded-2xl bg-white/4 p-3 text-left transition hover:bg-white/8"
            >
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full bg-info" style={{ width: `${upiPct}%` }} />
              </div>
              <div className="text-xs font-semibold">
                📲 UPI <span className="text-mute">{upiPct}%</span>
              </div>
              <div className="mt-1 text-sm font-bold">{fmtAmt(upiTotal)}</div>
            </button>
            <button
              type="button"
              onClick={() => onDrill({ type: 'payment', value: 'Credit Card', month })}
              className="rounded-2xl bg-white/4 p-3 text-left transition hover:bg-white/8"
            >
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full bg-accent" style={{ width: `${ccPct}%` }} />
              </div>
              <div className="text-xs font-semibold">
                💳 CC <span className="text-mute">{ccPct}%</span>
              </div>
              <div className="mt-1 text-sm font-bold">{fmtAmt(ccTotal)}</div>
            </button>
          </div>
        </div>
      </BlurFade>
    </div>
  )
}

function YearTab({ txns }: { txns: UseExpensesReturn['txns'] }) {
  const yr = new Date().getFullYear().toString()
  const yearTxns = txns.filter((t) => t.date.startsWith(yr))

  if (yearTxns.length < 5) {
    return (
      <BlurFade delay={0.06}>
        <div className="glass rounded-3xl border border-dashed border-white/10 px-6 py-14 text-center text-sm text-mute">
          Not enough data yet.
          <br />
          Keep logging expenses!
        </div>
      </BlurFade>
    )
  }

  const total = yearTxns.reduce((s, t) => s + t.amount, 0)
  const avgMonthly = total / 12
  const catTotals: Record<string, number> = {}
  yearTxns.forEach((t) => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount
  })
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]
  const biggest = yearTxns.reduce((m, t) => (t.amount > m.amount ? t : m), yearTxns[0])
  const monthTotals: Record<string, number> = {}
  yearTxns.forEach((t) => {
    const mk = monthKey(t.date)
    monthTotals[mk] = (monthTotals[mk] || 0) + t.amount
  })
  const sortedMonths = Object.entries(monthTotals).sort((a, b) => b[1] - a[1])
  const biggestMonth = sortedMonths[0]
  const quietestMonth = sortedMonths[sortedMonths.length - 1]
  const maxMonthAmt = biggestMonth ? biggestMonth[1] : 1
  const ci = topCat ? catInfo(topCat[0]) : null

  return (
    <div className="space-y-4">
      <BlurFade delay={0.06}>
        <div className="beam glass relative overflow-hidden rounded-3xl p-5">
          <div className="font-display text-xl font-black">{yr} Year in Review</div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="font-display text-lg font-black">{fmtAmt(total)}</div>
              <div className="text-[9px] uppercase tracking-wider text-mute">Total Spent</div>
            </div>
            <div>
              <div className="font-display text-lg font-black">{fmtAmt(avgMonthly)}</div>
              <div className="text-[9px] uppercase tracking-wider text-mute">Avg / Month</div>
            </div>
            <div>
              <div className="font-display text-lg font-black">{yearTxns.length}</div>
              <div className="text-[9px] uppercase tracking-wider text-mute">Transactions</div>
            </div>
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.08}>
        <div className="space-y-2">
          {topCat && ci && (
            <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
              <span className="text-xl">{ci.i}</span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-mute">
                  Top Category
                </div>
                <div className="text-sm font-semibold">
                  {topCat[0]} · {fmtAmt(topCat[1])}
                </div>
              </div>
            </div>
          )}
          {biggestMonth && (
            <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
              <span className="text-xl">📅</span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-mute">
                  Biggest Month
                </div>
                <div className="text-sm font-semibold">
                  {monthLabel(biggestMonth[0])} · {fmtAmt(biggestMonth[1])}
                </div>
              </div>
            </div>
          )}
          {quietestMonth && quietestMonth[0] !== biggestMonth?.[0] && (
            <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
              <span className="text-xl">🌿</span>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-mute">
                  Quietest Month
                </div>
                <div className="text-sm font-semibold">
                  {monthLabel(quietestMonth[0])} · {fmtAmt(quietestMonth[1])}
                </div>
              </div>
            </div>
          )}
          {biggest && (
            <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
              <span className="text-xl">💸</span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-mute">
                  Biggest Expense
                </div>
                <div className="truncate text-sm font-semibold">
                  {biggest.note || biggest.category} · {fmtAmt(biggest.amount)}
                </div>
              </div>
            </div>
          )}
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        <div className="glass rounded-3xl p-5">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
            Monthly Breakdown
          </div>
          <div className="flex items-end justify-between gap-1">
            {Array.from({ length: 12 }, (_, i) => {
              const m = i + 1
              const key = `${yr}-${String(m).padStart(2, '0')}`
              const amt = monthTotals[key] || 0
              const h = Math.round((amt / maxMonthAmt) * 70)
              const isBig = biggestMonth && key === biggestMonth[0]
              return (
                <div key={key} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-[70px] w-full items-end justify-center">
                    <motion.div
                      className={cn(
                        'w-full max-w-[22px] rounded-t-sm',
                        isBig ? 'bg-gold' : 'bg-accent/70',
                      )}
                      style={{ opacity: amt ? 0.85 : 0.2 }}
                      initial={{ height: 0 }}
                      animate={{ height: Math.max(h, amt > 0 ? 3 : 2) }}
                      transition={{ duration: 0.4, delay: 0.02 * i }}
                    />
                  </div>
                  <div className="text-[9px] font-bold text-mute">{MONTH_LETTERS[i]}</div>
                </div>
              )
            })}
          </div>
        </div>
      </BlurFade>
    </div>
  )
}
