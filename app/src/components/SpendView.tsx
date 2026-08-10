import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Search, Trash2 } from 'lucide-react'
import { exportCSV } from '@/lib/csv'
import { catInfo, type Period, type Txn } from '@/lib/types'
import type { UseExpensesReturn } from '@/hooks/useExpenses'
import { cn, filterTxns, fmtAmt, fmtDate, isSpendCat, today, yesterday } from '@/lib/utils'

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
    list.slice(0, 60).forEach((t) => {
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

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">
          {period === 'today' ? 'Today' : period === 'week' ? 'This week' : period === 'month' ? 'This month' : 'All time'}
        </p>
        <motion.p
          key={spendTotal}
          initial={{ opacity: 0.6, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1 text-4xl font-semibold tracking-tight"
        >
          {fmtAmt(spendTotal)}
        </motion.p>
        {api.budget > 0 && period === 'month' && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>Monthly budget</span>
              <span>
                {fmtAmt(api.monthSpend)} / {fmtAmt(api.budget)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
              <div
                className={cn('h-full rounded-full transition-all', budgetPct >= 100 ? 'bg-bad' : 'bg-fg')}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </div>
        )}
      </section>

      <div className="flex gap-1 rounded-full bg-canvas p-1">
        {periods.map((p) => (
          <button
            key={p.k}
            type="button"
            onClick={() => setPeriod(p.k)}
            className={cn(
              'flex-1 rounded-full py-2 text-xs font-medium transition',
              period === p.k ? 'tab-active' : 'text-muted',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search or #tag"
          className="w-full rounded-2xl border border-line bg-surface py-2.5 pl-10 pr-4 text-sm outline-none ring-accent focus:ring-2"
        />
      </div>

      <div className="space-y-4">
        {grouped.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">No expenses yet. Tap + to add one.</p>
        )}
        {grouped.map(([label, items]) => (
          <div key={label}>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{label}</h3>
            <ul className="space-y-2">
              {items.map((t) => (
                <li key={t.id} className="card flex items-center gap-3 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-lg">
                    {catInfo(t.category).i}
                  </div>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(t.id)}>
                    <div className="truncate text-sm font-medium">{t.note || t.category}</div>
                    <div className="text-xs text-muted">
                      {t.category} · {t.payment}
                      {t.pending && ' · syncing…'}
                    </div>
                  </button>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{fmtAmt(t.amount)}</div>
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
  )
}
