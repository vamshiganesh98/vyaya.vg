import { useMemo } from 'react'
import { motion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight, Calendar, CreditCard, TrendingUp } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import { DonutChart } from '@/components/ui/donut-chart'
import { NumberTicker } from '@/components/ui/number-ticker'
import { buildInsights } from '@/lib/insights'
import { computeSpendMetrics } from '@/lib/metrics'
import { CHART_COLORS } from '@/lib/types'
import type { UseExpensesReturn } from '@/hooks/useExpenses'
import { cn, currentMonthKey, fmtAmt, isSpendCat, monthKey, monthLabel } from '@/lib/utils'

export function ReportView({ api }: { api: UseExpensesReturn }) {
  const month = currentMonthKey()
  const metrics = useMemo(() => computeSpendMetrics(api.txns, api.budget), [api.txns, api.budget])

  const txns = useMemo(
    () => api.txns.filter((t) => monthKey(t.date) === month && isSpendCat(t.category)),
    [api.txns, month],
  )
  const total = metrics.month

  const byCat = useMemo(() => {
    return metrics.byCategory.map((c, i) => ({
      name: c.name,
      value: c.amount,
      color: CHART_COLORS[i % CHART_COLORS.length],
      icon: c.icon,
      pct: c.pct,
      budget: api.catBudgets[c.name] || 0,
    }))
  }, [metrics.byCategory, api.catBudgets])

  const insights = useMemo(
    () => buildInsights(api.txns, api.budget, api.catBudgets, api.goals),
    [api.txns, api.budget, api.catBudgets, api.goals],
  )

  const daily = useMemo(() => {
    const days: Record<number, number> = {}
    txns.forEach((t) => {
      const d = parseInt(t.date.slice(8, 10), 10)
      days[d] = (days[d] || 0) + t.amount
    })
    const max = Math.max(...Object.values(days), 1)
    return Object.entries(days)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .slice(-14)
      .map(([day, amt]) => ({ day: Number(day), amt, pct: (amt / max) * 100 }))
  }, [txns])

  return (
    <div className="space-y-5 lg:space-y-6">
      {/* Mobile summary */}
      <section className="card-glow p-5 lg:hidden">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{monthLabel(month)}</p>
        <p className="metric-value mt-2 text-4xl">{fmtAmt(total)}</p>
        <p className="mt-1 text-sm text-muted">{txns.length} transactions</p>
        {metrics.monthDeltaPct !== null && (
          <p className={cn('mt-2 text-xs font-semibold', metrics.monthDeltaPct > 0 ? 'text-bad' : 'text-good')}>
            {metrics.monthDeltaPct > 0 ? '+' : ''}
            {metrics.monthDeltaPct}% vs last month
          </p>
        )}
      </section>

      {/* Desktop summary row */}
      <div className="hidden lg:grid lg:grid-cols-5 lg:gap-4">
        <BlurFade className="card-glow p-5 lg:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{monthLabel(month)}</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg text-accent">₹</span>
            <NumberTicker value={total} className="metric-value text-4xl" />
          </div>
          <p className="mt-2 text-sm text-muted">{txns.length} transactions · avg {fmtAmt(Math.round(metrics.dailyAvg))}/day</p>
        </BlurFade>
        <BlurFade delay={0.05}>
          <div className="card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Last month</div>
            <div className="mt-2 font-display text-2xl font-bold">{fmtAmt(metrics.prevMonth)}</div>
          </div>
        </BlurFade>
        <BlurFade delay={0.1}>
          <div className="card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Change</div>
            <div className="mt-2 flex items-center gap-1">
              {metrics.monthDeltaPct !== null && metrics.monthDeltaPct > 0 ? (
                <ArrowUpRight className="h-4 w-4 text-bad" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-good" />
              )}
              <span className="font-display text-2xl font-bold">
                {metrics.monthDeltaPct !== null ? `${metrics.monthDeltaPct > 0 ? '+' : ''}${metrics.monthDeltaPct}%` : '—'}
              </span>
            </div>
          </div>
        </BlurFade>
        <BlurFade delay={0.15}>
          <div className="card p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Biggest</div>
            <div className="mt-2 font-display text-2xl font-bold">
              {metrics.biggest ? fmtAmt(metrics.biggest.amount) : '—'}
            </div>
            {metrics.biggest && (
              <div className="mt-1 truncate text-[11px] text-muted">{metrics.biggest.note}</div>
            )}
          </div>
        </BlurFade>
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-6">
        <div className="space-y-5">
          {byCat.length > 0 && (
            <section className="card p-5">
              <h2 className="font-display text-sm font-bold">By category</h2>
              <div className="mt-4">
                <DonutChart
                  total={total}
                  slices={byCat.map((c) => ({ label: c.name, value: c.value, icon: c.icon }))}
                />
              </div>

              {/* Desktop category table */}
              <div className="mt-6 hidden lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-[10px] uppercase tracking-wider text-muted">
                      <th className="pb-2 text-left font-semibold">Category</th>
                      <th className="pb-2 text-right font-semibold">Amount</th>
                      <th className="pb-2 text-right font-semibold">Share</th>
                      <th className="pb-2 text-right font-semibold">Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCat.map((c) => (
                      <tr key={c.name} className="border-b border-line/50">
                        <td className="py-2.5">
                          {c.icon} {c.name}
                        </td>
                        <td className="py-2.5 text-right font-semibold tabular-nums">{fmtAmt(c.value)}</td>
                        <td className="py-2.5 text-right text-muted">{c.pct}%</td>
                        <td className="py-2.5 text-right text-muted">
                          {c.budget > 0 ? (
                            <span className={c.value > c.budget ? 'text-bad' : 'text-good'}>
                              {fmtAmt(c.value)} / {fmtAmt(c.budget)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {daily.length > 0 && (
            <section className="card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-accent" />
                <h2 className="font-display text-sm font-bold">Daily spend</h2>
              </div>
              <div className={cn('flex items-end gap-1', 'h-28 lg:h-40')}>
                {daily.map((d) => (
                  <div key={d.day} className="group flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-accent/80 to-accent/40 transition-all group-hover:from-accent group-hover:to-accent/60"
                      style={{ height: `${Math.max(8, d.pct)}%` }}
                      title={fmtAmt(d.amt)}
                    />
                    <span className="text-[9px] text-muted lg:text-[10px]">{d.day}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Desktop right column */}
        <aside className="space-y-4">
          {metrics.byPayment.length > 0 && (
            <section className="card p-4">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                <CreditCard className="h-3.5 w-3.5" />
                Payment split
              </div>
              <ul className="space-y-3">
                {metrics.byPayment.map((p) => (
                  <li key={p.name}>
                    <div className="flex justify-between text-sm">
                      <span>{p.name}</span>
                      <span className="font-semibold">{fmtAmt(p.amount)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8">
                      <motion.div
                        className="h-full rounded-full bg-info"
                        initial={{ width: 0 }}
                        animate={{ width: `${p.pct}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {metrics.topMerchants.length > 0 && (
            <section className="card p-4 hidden lg:block">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                <TrendingUp className="h-3.5 w-3.5" />
                Top merchants
              </div>
              <ul className="space-y-2">
                {metrics.topMerchants.map((m, i) => (
                  <li key={m.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/8 text-[10px] font-bold text-muted">
                        {i + 1}
                      </span>
                      <span className="truncate">{m.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{fmtAmt(m.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {metrics.personality && (
            <section className="card-glow p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Your style</div>
              <div className="mt-2 font-display text-lg font-bold">{metrics.personality.label}</div>
              <div className="mt-1 text-xs text-muted">{metrics.personality.sub}</div>
            </section>
          )}

          {insights.length > 0 && (
            <section className="space-y-2">
              <h2 className="font-display text-sm font-bold">Insights</h2>
              {insights.slice(0, 6).map((ins, i) => (
                <BlurFade key={ins.id} delay={i * 0.04}>
                  <div
                    className={cn(
                      'card p-4',
                      ins.tone === 'warn' && 'border-warn/25',
                      ins.tone === 'good' && 'border-good/25',
                    )}
                  >
                    <div className="text-sm font-semibold">{ins.title}</div>
                    <div className="mt-0.5 text-xs text-muted">{ins.sub}</div>
                  </div>
                </BlurFade>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
