import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight, Search, Trash2, TrendingUp } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import { NumberTicker } from '@/components/ui/number-ticker'
import { exportCSV } from '@/lib/csv'
import { computeSpendMetrics } from '@/lib/metrics'
import { catInfo, type Period, type Txn } from '@/lib/types'
import type { UseExpensesReturn } from '@/hooks/useExpenses'
import { cn, filterTxns, fmtAmt, fmtDate, isSpendCat, today, yesterday } from '@/lib/utils'

function MetricTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: number
  sub?: string
  accent?: boolean
}) {
  return (
    <div className={cn('card p-4', accent && 'card-glow')}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-sm text-accent">₹</span>
        <NumberTicker value={value} className="metric-value text-2xl lg:text-3xl" />
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted">{sub}</div>}
    </div>
  )
}

function TxnRow({
  t,
  onEdit,
  onDelete,
  desktop,
}: {
  t: Txn
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  desktop?: boolean
}) {
  if (desktop) {
    return (
      <tr className="border-b border-line/60 transition hover:bg-white/[0.03]">
        <td className="px-4 py-3 text-sm text-muted">{fmtDate(t.date)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{catInfo(t.category).i}</span>
            <div>
              <div className="text-sm font-medium">{t.note || t.category}</div>
              <div className="text-[11px] text-muted">{t.category}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-muted">{t.payment}</td>
        <td className="px-4 py-3 text-sm text-muted">{t.time || '—'}</td>
        <td className="px-4 py-3 text-right">
          <div className="text-sm font-bold tabular-nums">{fmtAmt(t.amount)}</div>
          {t.pending && <span className="text-[10px] text-warn">syncing</span>}
        </td>
        <td className="px-4 py-3 text-right">
          <button type="button" onClick={() => onEdit(t.id)} className="mr-2 text-xs text-muted hover:text-accent">
            Edit
          </button>
          <button type="button" onClick={() => onDelete(t.id)} className="text-muted hover:text-bad" aria-label="Delete">
            <Trash2 className="inline h-3.5 w-3.5" />
          </button>
        </td>
      </tr>
    )
  }

  return (
    <li className="card flex items-center gap-3 p-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ background: `${catInfo(t.category).c}22` }}
      >
        {catInfo(t.category).i}
      </div>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(t.id)}>
        <div className="truncate text-sm font-semibold">{t.note || t.category}</div>
        <div className="text-[11px] text-muted">
          {t.category} · {t.payment}
          {t.pending && ' · syncing…'}
        </div>
      </button>
      <div className="text-right">
        <div className="font-display text-sm font-bold">{fmtAmt(t.amount)}</div>
        <button
          type="button"
          onClick={() => onDelete(t.id)}
          className="mt-0.5 text-muted hover:text-bad"
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  )
}

export function SpendView({
  api,
  onEdit,
  onDelete,
}: {
  api: UseExpensesReturn
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [period, setPeriod] = useState<Period>('today')
  const [searchQ, setSearchQ] = useState('')

  const metrics = useMemo(() => computeSpendMetrics(api.txns, api.budget), [api.txns, api.budget])

  const list = useMemo(
    () => filterTxns(api.txns, { period, searchQ, drill: null }),
    [api.txns, period, searchQ],
  )
  const spendTotal = list.filter((t) => isSpendCat(t.category)).reduce((s, t) => s + t.amount, 0)
  const budgetPct =
    api.budget > 0 && period === 'month'
      ? Math.min(100, Math.round((api.monthSpend / api.budget) * 100))
      : 0

  const grouped = useMemo(() => {
    const map = new Map<string, Txn[]>()
    list.slice(0, 80).forEach((t) => {
      const key = t.date === today() ? 'Today' : t.date === yesterday() ? 'Yesterday' : fmtDate(t.date)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    })
    return [...map.entries()]
  }, [list])

  const periods: { k: Period; label: string }[] = [
    { k: 'today', label: 'Today' },
    { k: 'week', label: 'Week' },
    { k: 'month', label: 'Month' },
    { k: 'all', label: 'All' },
  ]

  const periodLabel =
    period === 'today' ? 'Today' : period === 'week' ? 'This week' : period === 'month' ? 'This month' : 'All time'

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* ── Mobile hero ── */}
      <section className="card-glow relative overflow-hidden p-5 lg:hidden">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{periodLabel}</p>
        <motion.p
          key={spendTotal}
          initial={{ opacity: 0.6, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="metric-value mt-2 text-5xl text-fg"
        >
          {fmtAmt(spendTotal)}
        </motion.p>
        {api.budget > 0 && period === 'month' && (
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-[11px] text-muted">
              <span>Budget</span>
              <span>
                {fmtAmt(api.monthSpend)} / {fmtAmt(api.budget)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className={cn('h-full rounded-full transition-all', budgetPct >= 100 ? 'bg-bad' : 'bg-accent')}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* ── Desktop metrics grid ── */}
      <div className="hidden lg:grid lg:grid-cols-4 lg:gap-4">
        <BlurFade delay={0}>
          <MetricTile label="Today" value={metrics.today} accent />
        </BlurFade>
        <BlurFade delay={0.05}>
          <MetricTile label="This week" value={metrics.week} />
        </BlurFade>
        <BlurFade delay={0.1}>
          <MetricTile label="This month" value={metrics.month} sub={`${metrics.monthTxns} transactions`} />
        </BlurFade>
        <BlurFade delay={0.15}>
          <MetricTile
            label="Daily average"
            value={Math.round(metrics.dailyAvg)}
            sub={metrics.monthDeltaPct !== null ? `vs last month ${metrics.monthDeltaPct > 0 ? '+' : ''}${metrics.monthDeltaPct}%` : undefined}
          />
        </BlurFade>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
        <div className="space-y-4 lg:space-y-5">
          {/* Period + search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex gap-1 rounded-2xl bg-white/4 p-1">
              {periods.map((p) => (
                <button
                  key={p.k}
                  type="button"
                  onClick={() => setPeriod(p.k)}
                  className={cn(
                    'flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4',
                    period === p.k ? 'tab-active' : 'text-muted hover:text-fg',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search, #tag, >500…"
                className="w-full rounded-2xl border border-line bg-white/4 py-2.5 pl-10 pr-4 text-sm outline-none ring-accent focus:ring-2"
              />
            </div>
          </div>

          {/* Desktop table */}
          <section className="card hidden overflow-hidden lg:block">
            <div className="border-b border-line px-4 py-3">
              <h2 className="font-display text-sm font-bold">Transactions</h2>
            </div>
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-canvas/95 text-[10px] uppercase tracking-wider text-muted backdrop-blur">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-4 py-2.5 font-semibold">Description</th>
                    <th className="px-4 py-2.5 font-semibold">Payment</th>
                    <th className="px-4 py-2.5 font-semibold">Time</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted">
                        No expenses yet. Click Add expense in the sidebar.
                      </td>
                    </tr>
                  )}
                  {list.slice(0, 50).map((t) => (
                    <TxnRow key={t.id} t={t} onEdit={onEdit} onDelete={onDelete} desktop />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Mobile list */}
          <div className="space-y-4 lg:hidden">
            {grouped.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">No expenses yet. Tap + to add one.</p>
            )}
            {grouped.map(([label, items]) => (
              <div key={label}>
                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">{label}</h3>
                <ul className="space-y-2">
                  {items.map((t) => (
                    <TxnRow key={t.id} t={t} onEdit={onEdit} onDelete={onDelete} />
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {list.length > 0 && (
            <button type="button" className="btn-ghost w-full text-xs" onClick={() => exportCSV(api.txns)}>
              Export CSV
            </button>
          )}
        </div>

        {/* Desktop sidebar panel */}
        <aside className="hidden space-y-4 lg:block">
          {api.budget > 0 && (
            <div className="card-glow p-5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Monthly budget</span>
                <span className="font-display text-sm font-bold text-accent">{metrics.budgetPct}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className={cn('h-full rounded-full', metrics.budgetPct >= 100 ? 'bg-bad' : 'bg-accent')}
                  style={{ width: `${metrics.budgetPct}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[10px] text-muted">Spent</div>
                  <div className="font-semibold">{fmtAmt(metrics.month)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted">Remaining</div>
                  <div className="font-semibold text-good">{fmtAmt(metrics.budgetRemaining)}</div>
                </div>
              </div>
            </div>
          )}

          {metrics.personality && (
            <div className="card p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Spending style</div>
              <div className="mt-2 font-display text-lg font-bold">{metrics.personality.label}</div>
              <div className="mt-1 text-xs text-muted">{metrics.personality.sub}</div>
            </div>
          )}

          <div className="card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Streaks</div>
            <div className="mt-3 space-y-2">
              {metrics.noSpendStreak > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">No-spend days</span>
                  <span className="font-bold text-good">{metrics.noSpendStreak}</span>
                </div>
              )}
              {metrics.underBudgetStreak > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Under budget months</span>
                  <span className="font-bold text-accent">{metrics.underBudgetStreak}</span>
                </div>
              )}
              {metrics.openSplits > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Open splits</span>
                  <span className="font-bold text-warn">{metrics.openSplits}</span>
                </div>
              )}
              {metrics.pendingCount > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Pending sync</span>
                  <span className="font-bold text-warn">{metrics.pendingCount}</span>
                </div>
              )}
            </div>
          </div>

          {metrics.byCategory.length > 0 && (
            <div className="card p-4">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                <TrendingUp className="h-3 w-3" />
                Top categories
              </div>
              <ul className="space-y-2.5">
                {metrics.byCategory.slice(0, 5).map((c) => (
                  <li key={c.name}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>
                        {c.icon} {c.name}
                      </span>
                      <span className="font-semibold tabular-nums">{c.pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {metrics.biggest && (
            <div className="card p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Biggest this month</div>
              <div className="mt-2 font-display text-xl font-bold">{fmtAmt(metrics.biggest.amount)}</div>
              <div className="mt-1 truncate text-xs text-muted">{metrics.biggest.note}</div>
            </div>
          )}

          {metrics.monthDeltaPct !== null && (
            <div className="card flex items-center gap-3 p-4">
              {metrics.monthDeltaPct > 0 ? (
                <ArrowUpRight className="h-5 w-5 text-bad" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-good" />
              )}
              <div>
                <div className="text-sm font-semibold">
                  {metrics.monthDeltaPct > 0 ? '+' : ''}
                  {metrics.monthDeltaPct}% vs last month
                </div>
                <div className="text-[11px] text-muted">Last month: {fmtAmt(metrics.prevMonth)}</div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
