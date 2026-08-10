import { useState } from 'react'
import { CATS } from '@/lib/types'
import type { UseExpensesReturn } from '@/hooks/useExpenses'
import { fmtAmt } from '@/lib/utils'

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

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="text-sm font-semibold">Monthly budget</h2>
        <p className="mt-1 text-xs text-muted">How much you plan to spend this month</p>
        <div className="mt-4 flex gap-2">
          <input
            type="number"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            placeholder="e.g. 50000"
            className="flex-1 rounded-2xl border border-line bg-canvas px-4 py-2.5 text-sm outline-none"
          />
          <button type="button" className="btn-primary shrink-0" onClick={saveBudget}>
            Save
          </button>
        </div>
        {api.budget > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-canvas p-3">
              <div className="text-xs text-muted">Spent</div>
              <div className="font-semibold">{fmtAmt(monthSpend)}</div>
            </div>
            <div className="rounded-xl bg-canvas p-3">
              <div className="text-xs text-muted">Remaining</div>
              <div className="font-semibold">{fmtAmt(remaining)}</div>
            </div>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Category budgets</h2>
        <ul className="mt-4 space-y-3">
          {CATS.filter((c) => c.k !== 'Investments').map((c) => {
            const spent = api.txns
              .filter((t) => t.category === c.k)
              .reduce((s, t) => s + t.amount, 0)
            const cap = api.catBudgets[c.k] || 0
            return (
              <li key={c.k}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>
                    {c.i} {c.k}
                  </span>
                  {cap > 0 && (
                    <span className="text-xs text-muted">
                      {fmtAmt(spent)} / {fmtAmt(cap)}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={catInputs[c.k] || ''}
                  onChange={(e) => setCatInputs((prev) => ({ ...prev, [c.k]: e.target.value }))}
                  onBlur={() => saveCat(c.k, catInputs[c.k] || '')}
                  placeholder="No limit"
                  className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm outline-none"
                />
              </li>
            )
          })}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Savings goals</h2>
        {api.goals.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No goals yet. Add them in full settings if needed.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {api.goals.map((g) => {
              const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0
              return (
                <li key={g.id}>
                  <div className="flex justify-between text-sm">
                    <span>{g.name}</span>
                    <span className="text-muted">
                      {fmtAmt(g.saved)} / {fmtAmt(g.target)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-fg" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
