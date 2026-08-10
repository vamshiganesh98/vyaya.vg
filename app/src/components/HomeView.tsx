import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { MapPin, Pencil, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import { NumberTicker } from '@/components/ui/number-ticker'
import { exportCSV } from '@/lib/csv'
import { buildInsights, isRecurringDue } from '@/lib/insights'
import { CURRENCIES, catInfo, parseTags, type DrillFilter, type Period, type Txn } from '@/lib/types'
import type { UseExpensesReturn } from '@/hooks/useExpenses'
import {
  cn,
  currentMonthKey,
  filterTxns,
  fmtAmt,
  fmtDate,
  isSpendCat,
  monthKey,
  monthLabel,
  prevMonthKey,
  today,
  yesterday,
} from '@/lib/utils'

export function HomeView({
  api,
  period,
  setPeriod,
  searchQ,
  setSearchQ,
  drill,
  setDrill,
  openTxn,
  setOpenTxn,
  onEdit,
  onDelete,
  onMakeRecurring,
  onToast,
  goAnalytics,
}: {
  api: UseExpensesReturn
  period: Period
  setPeriod: (p: Period) => void
  searchQ: string
  setSearchQ: (q: string) => void
  drill: DrillFilter | null
  setDrill: (d: DrillFilter | null) => void
  openTxn: string | null
  setOpenTxn: (id: string | null) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onMakeRecurring: (id: string) => void
  onToast: (msg: string, type?: string) => void
  goAnalytics: () => void
}) {
  const list = useMemo(
    () => filterTxns(api.txns, { period, searchQ, drill }),
    [api.txns, period, searchQ, drill],
  )
  const spendList = list.filter((t) => isSpendCat(t.category))
  const total = spendList.reduce((s, t) => s + t.amount, 0)
  const invested = list.filter((t) => t.category === 'Investments').reduce((s, t) => s + t.amount, 0)
  const splitsOwed = api.txns
    .filter((t) => t.split > 1 && t.paidCount < t.split - 1)
    .reduce((s, t) => s + (t.amount / t.split) * (t.split - 1 - t.paidCount), 0)
  const mk = currentMonthKey()
  const prevMk = prevMonthKey(mk)
  const prevTotal = api.txns
    .filter((t) => monthKey(t.date) === prevMk && isSpendCat(t.category))
    .reduce((s, t) => s + t.amount, 0)
  const monthTotal = api.monthSpend
  const budgetPct = api.budget > 0 ? Math.min(100, Math.round((monthTotal / api.budget) * 100)) : 0
  const insights = useMemo(
    () => buildInsights(api.txns, api.budget, api.catBudgets, api.goals),
    [api.txns, api.budget, api.catBudgets, api.goals],
  )
  const due = api.recurring.filter(isRecurringDue)
  const biggest = spendList.reduce((m, t) => Math.max(m, t.amount), 0)

  const grouped = useMemo(() => {
    const map = new Map<string, Txn[]>()
    list.slice(0, 80).forEach((t) => {
      const key = t.date === today() ? 'Today' : t.date === yesterday() ? 'Yesterday' : fmtDate(t.date)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    })
    return [...map.entries()]
  }, [list])

  const title = drill
    ? drill.type === 'dow'
      ? `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][drill.value]} · ${monthLabel(drill.month)}`
      : `${drill.value} · ${'month' in drill ? monthLabel(drill.month) : ''}`
    : 'Recent'

  return (
    <div className="space-y-5">
      <BlurFade>
        <div className="beam glass relative overflow-hidden rounded-[28px] p-6">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-mute">
                {period === 'today' ? 'Today' : period === 'week' ? 'This week' : period === 'month' ? 'This month' : 'All time'}
              </div>
              {prevTotal > 0 && period === 'month' && (
                <div
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-bold',
                    monthTotal <= prevTotal ? 'bg-good/15 text-good' : 'bg-bad/15 text-bad',
                  )}
                >
                  {monthTotal >= prevTotal ? '+' : ''}
                  {fmtAmt(monthTotal - prevTotal)} vs {monthLabel(prevMk).split(' ')[0]}
                </div>
              )}
            </div>
            <div className="mt-2 font-display text-5xl font-extrabold tracking-tight md:text-6xl">
              <span className="mr-1 text-3xl text-gold md:text-4xl">₹</span>
              <NumberTicker value={total} />
            </div>

            {api.budget > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-mute">
                  <span>
                    {fmtAmt(monthTotal)} of {fmtAmt(api.budget)}
                  </span>
                  <span className="text-gold">{budgetPct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-gold via-gold-3 to-gold-2"
                    initial={{ width: 0 }}
                    animate={{ width: `${budgetPct}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/6 pt-4 text-center">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-mute">Txns</div>
                <div className="mt-1 text-sm font-bold">{list.length}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-mute">Daily avg</div>
                <div className="mt-1 text-sm font-bold">
                  {fmtAmt(total / Math.max(1, period === 'month' ? new Date().getDate() : period === 'week' ? 7 : 1))}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-mute">Biggest</div>
                <div className="mt-1 text-sm font-bold text-bad">{fmtAmt(biggest)}</div>
              </div>
            </div>

            {(invested > 0 || splitsOwed > 0) && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/6 pt-3 text-[11px]">
                {invested > 0 && (
                  <span className="rounded-lg bg-good/10 px-2.5 py-1 font-semibold text-good">
                    Investments excluded · {fmtAmt(invested)}
                  </span>
                )}
                {splitsOwed > 0 && (
                  <button
                    type="button"
                    onClick={goAnalytics}
                    className="rounded-lg bg-accent/15 px-2.5 py-1 font-semibold text-accent"
                  >
                    Splits owed · {fmtAmt(splitsOwed)}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </BlurFade>

      {due.length > 0 && (
        <BlurFade delay={0.04}>
          <div className="space-y-2">
            {due.map((r) => (
              <div key={r.id} className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold">Due: {r.name}</div>
                  <div className="text-[10px] text-mute">
                    {fmtAmt(r.amount)} · {r.freq}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-xl bg-gold px-3 py-2 text-xs font-bold text-ink"
                  onClick={async () => {
                    await api.addTxn({
                      amount: r.amount,
                      category: r.category,
                      payment: r.payment,
                      note: r.name,
                      date: today(),
                      time: new Date().toLocaleTimeString('en-GB', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      }),
                      split: 1,
                      paidCount: 0,
                      tags: [],
                      location: '',
                      recurring: true,
                    })
                    api.markRecurringLogged(r.id, today())
                    await api.pushSettings()
                    onToast('Logged recurring')
                  }}
                >
                  Log
                </button>
              </div>
            ))}
          </div>
        </BlurFade>
      )}

      {insights.length > 0 && (
        <BlurFade delay={0.06}>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {insights.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => (c.id === 'splits' ? goAnalytics() : undefined)}
                className={cn(
                  'glass min-w-[148px] shrink-0 rounded-2xl px-3.5 py-3 text-left',
                  c.tone === 'warn' && 'border-bad/30',
                  c.tone === 'good' && 'border-good/25',
                  c.tone === 'gold' && 'border-gold/25',
                )}
              >
                <div className="text-xs font-bold">{c.title}</div>
                <div className="mt-0.5 text-[10px] text-mute">{c.sub}</div>
              </button>
            ))}
          </div>
        </BlurFade>
      )}

      <BlurFade delay={0.08}>
        <div className="glass flex gap-1 rounded-2xl p-1">
          {(['today', 'week', 'month', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPeriod(p)
                setDrill(null)
              }}
              className={cn(
                'flex-1 rounded-xl px-2 py-2 text-xs font-medium capitalize transition',
                period === p && !drill ? 'bg-gold font-bold text-ink shadow-md' : 'text-mute',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2.5">
          <Search className="h-4 w-4 text-mute" />
          <input
            value={searchQ}
            onChange={(e) => {
              setSearchQ(e.target.value)
              if (e.target.value) setDrill(null)
            }}
            placeholder='Search · >500 · #food · upi · "aug"'
            className="w-full bg-transparent text-sm outline-none placeholder:text-mute/70"
          />
          {searchQ && (
            <button type="button" onClick={() => setSearchQ('')} aria-label="Clear">
              <X className="h-4 w-4 text-mute" />
            </button>
          )}
        </div>
      </BlurFade>

      {(drill || searchQ) && (
        <div className="flex items-center justify-between px-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-mute">{title}</div>
          <button
            type="button"
            className="text-[10px] font-bold text-gold"
            onClick={() => {
              setDrill(null)
              setSearchQ('')
            }}
          >
            Clear filter
          </button>
        </div>
      )}

      <BlurFade delay={0.12}>
        <div className="space-y-3">
          {!drill && !searchQ && (
            <div className="px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-mute">Recent</div>
          )}
          {list.length === 0 ? (
            <div className="glass rounded-3xl border border-dashed border-white/10 px-6 py-14 text-center text-sm text-mute">
              <div className="font-display mb-2 text-3xl text-gold/50">₹</div>
              No expenses yet. Tap + to add one.
            </div>
          ) : (
            grouped.map(([label, rows]) => (
              <div key={label} className="space-y-2">
                <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-mute">{label}</div>
                {rows.map((t, i) => {
                  const ci = catInfo(t.category)
                  const open = openTxn === t.id
                  const tags = t.tags?.length ? t.tags : parseTags(t.note)
                  const cs = CURRENCIES.find((c) => c.k === t.originalCurrency)
                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.25) }}
                      className="glass rounded-2xl p-3.5"
                      onClick={() => setOpenTxn(open ? null : t.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg"
                          style={{ background: `${ci.c}22` }}
                        >
                          {ci.i}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{t.note || t.category}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-mute">
                            <span>
                              {t.time} · {t.payment}
                            </span>
                            {t.location && (
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" /> {t.location}
                              </span>
                            )}
                            {t.pending && (
                              <span className="rounded bg-gold/15 px-1.5 py-0.5 font-bold text-gold">pending</span>
                            )}
                            {t.split > 1 && (
                              <span className="rounded bg-accent/15 px-1.5 py-0.5 font-bold text-accent">
                                split {t.paidCount}/{t.split - 1}
                              </span>
                            )}
                            {t.originalCurrency && t.originalCurrency !== 'INR' && (
                              <span className="rounded bg-info/15 px-1.5 py-0.5 text-info">
                                {cs?.s}
                                {t.originalAmount}
                              </span>
                            )}
                          </div>
                          {tags.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {tags.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold text-mute-2"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDrill({ type: 'tag', value: tag })
                                    setSearchQ('')
                                  }}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div
                          className={cn(
                            'text-sm font-bold tabular-nums',
                            t.category === 'Investments' ? 'text-good' : 'text-foam',
                          )}
                        >
                          {fmtAmt(t.amount)}
                        </div>
                      </div>

                      <AnimatePresence>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            {t.split > 1 && t.paidCount < t.split - 1 && (
                              <div className="mt-3 flex items-center gap-2 border-t border-white/6 pt-3">
                                <div className="flex-1 text-[11px] text-mute">
                                  Share {fmtAmt(t.amount / t.split)} · {t.split - 1 - t.paidCount} owe you
                                </div>
                                <button
                                  type="button"
                                  className="rounded-lg border border-white/10 px-2.5 py-1 text-sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    api.settle(t.id, -1)
                                  }}
                                >
                                  −
                                </button>
                                <span className="text-xs font-bold">
                                  {t.paidCount}/{t.split - 1}
                                </span>
                                <button
                                  type="button"
                                  className="rounded-lg border border-white/10 px-2.5 py-1 text-sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    api.settle(t.id, 1)
                                  }}
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg bg-accent/20 px-2.5 py-1 text-[10px] font-bold text-accent"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    api.settleAll(t.id)
                                  }}
                                >
                                  All paid
                                </button>
                              </div>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2 border-t border-white/6 pt-3">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onEdit(t.id)
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onMakeRecurring(t.id)
                                }}
                              >
                                <RotateCcw className="h-3.5 w-3.5" /> Recurring
                              </button>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-xl border border-bad/20 bg-bad/10 px-3 py-2 text-xs font-semibold text-bad"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDelete(t.id)
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </BlurFade>

      <div className="flex justify-center pb-2">
        <button
          type="button"
          onClick={() => {
            exportCSV(api.txns)
            onToast('CSV exported')
          }}
          className="text-[10px] font-bold uppercase tracking-wider text-mute hover:text-gold"
        >
          Export CSV
        </button>
      </div>
    </div>
  )
}
