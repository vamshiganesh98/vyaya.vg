import { useState } from 'react'
import { motion } from 'motion/react'
import { PiggyBank, Target } from 'lucide-react'
import { NumberTicker } from '@/components/ui/number-ticker'
import { CATS } from '@/lib/types'
import type { UseExpensesReturn } from '@/hooks/useExpenses'
import { cn, fmtAmt } from '@/lib/utils'

export function PlanView({ api }: { api: UseExpensesReturn }) {
  const [budgetInput, setBudgetInput] = useState(String(api.budget || ''))
  const [catInputs, setCatInputs] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {}
    CATS.forEach((c) => {
      d[c.k] = api.catBudgets[c.k] ? String(api.catBudgets[c.k]) : ''
    })
    return d
  })

  const saveBudget = () => {
    const n = parseFloat(budgetInput) || 0
    api.setBudget(n)
    void api.pushSettings()
  }

  const saveCat = (key: string, raw: string) => {
    const v = parseFloat(raw) || 0
    api.setCatBudget(key, v)
    void api.pushSettings()
  }

  const monthSpend = api.monthSpend
  const remaining = Math.max(0, api.budget - monthSpend)
  const budgetPct = api.budget > 0 ? Math.min(100, Math.round((monthSpend / api.budget) * 100)) : 0

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
      <section className="card-glow p-5 lg:col-span-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" />
              <h2 className="font-display text-lg font-bold">Monthly budget</h2>
            </div>
            <p className="mt-1 text-xs text-muted">How much you plan to spend this month</p>
          </div>
          {api.budget > 0 && (
            <div className="text-right">
              <div className="font-display text-2xl font-bold text-accent">{budgetPct}%</div>
              <div className="text-[10px] text-muted">used</div>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="number"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            placeholder="e.g. 50000"
            className="flex-1 rounded-2xl border border-line bg-white/4 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button type="button" className="btn-primary shrink-0" onClick={saveBudget}>
            Save
          </button>
        </div>

        {api.budget > 0 && (
          <>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
              <motion.div
                className={cn('h-full rounded-full', budgetPct >= 100 ? 'bg-bad' : 'bg-accent')}
                initial={{ width: 0 }}
                animate={{ width: `${budgetPct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/4 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted">Budget</div>
                <div className="mt-1 font-display text-lg font-bold">{fmtAmt(api.budget)}</div>
              </div>
              <div className="rounded-xl bg-white/4 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted">Spent</div>
                <div className="mt-1 flex items-baseline gap-0.5">
                  <span className="text-xs text-accent">₹</span>
                  <NumberTicker value={monthSpend} className="font-display text-lg font-bold" />
                </div>
              </div>
              <div className="rounded-xl bg-white/4 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted">Left</div>
                <div className="mt-1 font-display text-lg font-bold text-good">{fmtAmt(remaining)}</div>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-display text-sm font-bold">Category budgets</h2>
        <ul className="mt-4 space-y-3">
          {CATS.filter((c) => c.k !== 'Investments').map((c) => {
            const spent = api.txns.filter((t) => t.category === c.k).reduce((s, t) => s + t.amount, 0)
            const cap = api.catBudgets[c.k] || 0
            const pct = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 0
            return (
              <li key={c.k}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span>
                    {c.i} {c.k}
                  </span>
                  {cap > 0 && (
                    <span className={cn('text-xs', pct >= 90 ? 'text-bad' : 'text-muted')}>
                      {fmtAmt(spent)} / {fmtAmt(cap)}
                    </span>
                  )}
                </div>
                {cap > 0 && (
                  <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/8">
                    <div
                      className={cn('h-full rounded-full', pct >= 100 ? 'bg-bad' : 'bg-accent')}
                      style={{ width: `${pct}%`, background: pct < 100 ? c.c : undefined }}
                    />
                  </div>
                )}
                <input
                  type="number"
                  value={catInputs[c.k] || ''}
                  onChange={(e) => setCatInputs((prev) => ({ ...prev, [c.k]: e.target.value }))}
                  onBlur={() => saveCat(c.k, catInputs[c.k] || '')}
                  placeholder="No limit"
                  className="w-full rounded-xl border border-line bg-white/4 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/30"
                />
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-accent" />
          <h2 className="font-display text-sm font-bold">Savings goals</h2>
        </div>
        {api.goals.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No goals yet. They sync from your Google Sheet Settings tab.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {api.goals.map((g) => {
              const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0
              return (
                <li key={g.id} className="rounded-xl bg-white/4 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{g.name}</span>
                    <span className="text-muted">
                      {fmtAmt(g.saved)} / {fmtAmt(g.target)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-accent to-accent-dim"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="mt-1 text-right text-[10px] text-muted">{pct}% saved</div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
