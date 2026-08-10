import { useMemo } from 'react'
import { DonutChart } from '@/components/ui/donut-chart'
import { buildInsights } from '@/lib/insights'
import { catInfo, CHART_COLORS } from '@/lib/types'
import type { UseExpensesReturn } from '@/hooks/useExpenses'
import { cn, currentMonthKey, fmtAmt, isSpendCat, monthKey, monthLabel } from '@/lib/utils'

export function ReportView({ api }: { api: UseExpensesReturn }) {
  const month = currentMonthKey()
  const txns = useMemo(
    () => api.txns.filter((t) => monthKey(t.date) === month && isSpendCat(t.category)),
    [api.txns, month],
  )
  const total = txns.reduce((s, t) => s + t.amount, 0)

  const byCat = useMemo(() => {
    const map: Record<string, number> = {}
    txns.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        color: CHART_COLORS[i % CHART_COLORS.length],
        icon: catInfo(name).i,
      }))
  }, [txns])

  const insights = useMemo(
    () => buildInsights(api.txns, api.budget, api.catBudgets, api.goals).slice(0, 4),
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
    <div className="space-y-5">
      <section className="card p-5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">{monthLabel(month)}</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{fmtAmt(total)}</p>
        <p className="mt-1 text-sm text-muted">{txns.length} transactions</p>
      </section>

      {byCat.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold">By category</h2>
          <DonutChart
            total={total}
            slices={byCat.map((c) => ({ label: c.name, value: c.value, icon: c.icon }))}
          />
        </section>
      )}

      {daily.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold">Daily spend</h2>
          <div className="flex h-24 items-end gap-1">
            {daily.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-fg/80"
                  style={{ height: `${Math.max(8, d.pct)}%` }}
                  title={fmtAmt(d.amt)}
                />
                <span className="text-[9px] text-muted">{d.day}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {insights.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Insights</h2>
          {insights.map((ins) => (
            <div
              key={ins.id}
              className={cn(
                'card p-4',
                ins.tone === 'warn' && 'border-warn/30',
                ins.tone === 'good' && 'border-good/30',
              )}
            >
              <div className="text-sm font-medium">{ins.title}</div>
              <div className="mt-0.5 text-xs text-muted">{ins.sub}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
