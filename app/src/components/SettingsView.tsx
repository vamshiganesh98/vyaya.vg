import { useRef, useState } from 'react'
import {
  Cloud,
  Download,
  RefreshCw,
  Trash2,
  Upload,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import type { UseExpensesReturn } from '@/hooks/useExpenses'
import { exportCSV, parseCSV } from '@/lib/csv'
import { CATS, type ThemePref } from '@/lib/types'
import { cn, fmtAmt } from '@/lib/utils'

export function SettingsView({
  api,
  showToast,
}: {
  api: UseExpensesReturn
  showToast: (m: string, t?: string) => void
}) {
  const [budgetInput, setBudgetInput] = useState(String(api.budget || ''))
  const [url, setUrl] = useState(api.sheetUrl)
  const [catDraft, setCatDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {}
    CATS.forEach((c) => {
      d[c.k] = api.catBudgets[c.k] ? String(api.catBudgets[c.k]) : ''
    })
    return d
  })
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [recName, setRecName] = useState('')
  const [recAmt, setRecAmt] = useState('')
  const [recCat, setRecCat] = useState(CATS[0].k)
  const [recFreq, setRecFreq] = useState<'daily' | 'weekly' | 'monthly' | 'interval'>('monthly')
  const csvRef = useRef<HTMLInputElement>(null)

  const themes: { id: ThemePref; label: string; icon: typeof Moon }[] = [
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'system', label: 'Auto', icon: Monitor },
  ]

  return (
    <div className="space-y-6 pb-4">
      <BlurFade>
        <h1 className="font-display text-2xl font-black tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-mute">Budget, sync, goals & data</p>
      </BlurFade>

      <BlurFade delay={0.04}>
        <section className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mute">Theme</div>
          <div className="glass flex gap-1 rounded-2xl p-1">
            {themes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  api.setThemePref(id)
                  showToast(`Theme: ${id === 'system' ? 'Auto' : label}`, 'info')
                }}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-semibold transition',
                  api.themePref === id ? 'bg-gold font-bold text-ink shadow-md' : 'text-mute',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </section>
      </BlurFade>

      <BlurFade delay={0.06}>
        <section className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mute">
            Monthly Budget
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="Monthly budget (₹)"
              className="glass flex-1 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-gold/40"
            />
            <ShimmerButton
              type="button"
              className="!px-4 !py-3"
              onClick={() => {
                const n = parseFloat(budgetInput) || 0
                api.setBudget(n)
                void api.pushSettings()
                showToast('Budget saved')
              }}
            >
              Set
            </ShimmerButton>
          </div>
        </section>
      </BlurFade>

      <BlurFade delay={0.08}>
        <section className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mute">
            Category Budgets
          </div>
          <div className="glass space-y-1 rounded-3xl p-2">
            {CATS.map((c) => (
              <div key={c.k} className="flex items-center gap-2 rounded-2xl px-2.5 py-2">
                <span className="text-base">{c.i}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold">{c.k}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder="No limit"
                  value={catDraft[c.k] ?? ''}
                  onChange={(e) => setCatDraft((d) => ({ ...d, [c.k]: e.target.value }))}
                  onBlur={() => {
                    const v = parseFloat(catDraft[c.k] || '0') || 0
                    api.setCatBudget(c.k, v)
                    void api.pushSettings()
                  }}
                  className="w-24 rounded-xl border border-white/8 bg-white/5 px-2.5 py-1.5 text-right text-xs outline-none focus:border-gold/40"
                />
              </div>
            ))}
          </div>
        </section>
      </BlurFade>

      <BlurFade delay={0.1}>
        <section className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mute">
            Savings Goals
          </div>
          <div className="space-y-2">
            {api.goals.map((g) => {
              const pct = g.target ? Math.min(100, Math.round(((g.saved || 0) / g.target) * 100)) : 0
              return (
                <div key={g.id} className="glass rounded-2xl p-3.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">🎯 {g.name}</div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-gold to-gold-3"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[10px] text-mute">
                        {fmtAmt(g.saved || 0)} of {fmtAmt(g.target)} · {pct}%
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold"
                      onClick={() => {
                        const raw = window.prompt('Add to savings (₹):')
                        const amt = raw != null ? parseFloat(raw) : NaN
                        if (!amt || amt <= 0) return
                        api.addToGoal(g.id, amt)
                        void api.pushSettings()
                        showToast(`Saved +${fmtAmt(amt)}`)
                      }}
                    >
                      + Add
                    </button>
                    <button
                      type="button"
                      aria-label="Remove goal"
                      className="rounded-xl border border-bad/20 bg-bad/10 px-2.5 py-1.5 text-xs text-bad"
                      onClick={() => {
                        api.removeGoal(g.id)
                        void api.pushSettings()
                        showToast('Goal removed')
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}

            {showGoalForm ? (
              <div className="glass space-y-2 rounded-2xl p-3.5">
                <input
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="Goal name (e.g. Goa Trip)"
                  className="w-full rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-gold/40"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  placeholder="Target amount (₹)"
                  className="w-full rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-gold/40"
                />
                <div className="flex gap-2">
                  <ShimmerButton
                    type="button"
                    className="flex-1 !py-2.5"
                    onClick={() => {
                      const name = goalName.trim()
                      const target = parseFloat(goalTarget)
                      if (!name) {
                        showToast('Enter a goal name', 'err')
                        return
                      }
                      if (!target || target <= 0) {
                        showToast('Enter a valid target', 'err')
                        return
                      }
                      api.addGoal({ name, target })
                      void api.pushSettings()
                      setGoalName('')
                      setGoalTarget('')
                      setShowGoalForm(false)
                      showToast('Goal added!')
                    }}
                  >
                    Add Goal
                  </ShimmerButton>
                  <button
                    type="button"
                    className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-mute"
                    onClick={() => setShowGoalForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowGoalForm(true)}
                className="w-full rounded-2xl border border-dashed border-white/12 py-3 text-xs font-bold text-gold"
              >
                + New Goal
              </button>
            )}
          </div>
        </section>
      </BlurFade>

      <BlurFade delay={0.12}>
        <section className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mute">
            Recurring
          </div>
          <div className="space-y-2">
            {api.recurring.length === 0 && (
              <div className="text-xs text-mute">
                No recurring expenses yet. Toggle Recurring when adding, or add below.
              </div>
            )}
            {api.recurring.map((r) => (
              <div key={r.id} className="glass flex items-center gap-3 rounded-2xl p-3">
                <span className="text-lg">{CATS.find((c) => c.k === r.category)?.i || '📦'}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{r.name}</div>
                  <div className="text-[10px] text-mute">
                    {fmtAmt(r.amount)} · {r.category}
                  </div>
                  <select
                    value={r.freq}
                    onChange={(e) => {
                      api.updateRecurring(r.id, {
                        freq: e.target.value as typeof r.freq,
                      })
                      void api.pushSettings()
                    }}
                    className="mt-1.5 rounded-lg border border-white/8 bg-white/5 px-2 py-1 text-[11px] outline-none"
                  >
                    <option value="daily">Every day</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="interval">Every N days</option>
                  </select>
                </div>
                <button
                  type="button"
                  aria-label="Remove recurring"
                  className="rounded-xl border border-bad/20 bg-bad/10 px-2.5 py-1.5 text-xs text-bad"
                  onClick={() => {
                    api.removeRecurring(r.id)
                    void api.pushSettings()
                    showToast('Removed')
                  }}
                >
                  ✕
                </button>
              </div>
            ))}

            <div className="glass space-y-2 rounded-2xl p-3.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-mute">
                Add recurring
              </div>
              <input
                value={recName}
                onChange={(e) => setRecName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm outline-none focus:border-gold/40"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={recAmt}
                  onChange={(e) => setRecAmt(e.target.value)}
                  placeholder="Amount"
                  className="w-28 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm outline-none focus:border-gold/40"
                />
                <select
                  value={recCat}
                  onChange={(e) => setRecCat(e.target.value as typeof recCat)}
                  className="flex-1 rounded-xl border border-white/8 bg-white/5 px-2 py-2 text-xs outline-none"
                >
                  {CATS.map((c) => (
                    <option key={c.k} value={c.k}>
                      {c.i} {c.k}
                    </option>
                  ))}
                </select>
                <select
                  value={recFreq}
                  onChange={(e) =>
                    setRecFreq(e.target.value as typeof recFreq)
                  }
                  className="rounded-xl border border-white/8 bg-white/5 px-2 py-2 text-xs outline-none"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="interval">Interval</option>
                </select>
              </div>
              <button
                type="button"
                className="w-full rounded-xl bg-gold/15 py-2 text-xs font-bold text-gold"
                onClick={() => {
                  const name = recName.trim()
                  const amount = parseFloat(recAmt)
                  if (!name || !amount || amount <= 0) {
                    showToast('Enter name and amount', 'err')
                    return
                  }
                  api.addRecurring({
                    name,
                    amount,
                    category: recCat,
                    payment: 'UPI',
                    freq: recFreq,
                    freqDate: recFreq === 'monthly' ? 1 : undefined,
                    freqN: recFreq === 'interval' ? 30 : undefined,
                  })
                  void api.pushSettings()
                  setRecName('')
                  setRecAmt('')
                  showToast('Recurring added')
                }}
              >
                Add
              </button>
            </div>
          </div>
        </section>
      </BlurFade>

      <BlurFade delay={0.14}>
        <section className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mute">Sync</div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Google Apps Script Web App URL"
            className="glass w-full rounded-2xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-gold/40"
          />
          <ShimmerButton
            type="button"
            className="w-full"
            onClick={async () => {
              api.setSheetUrl(url.trim())
              showToast('URL saved')
              if (url.trim()) {
                const r = await api.syncAll()
                showToast(r === 'ok' ? 'Connected & synced' : 'Saved (sync failed)', r === 'ok' ? 'ok' : 'err')
              }
            }}
          >
            Save & Connect
          </ShimmerButton>
          <button
            type="button"
            onClick={async () => {
              const r = await api.syncAll()
              showToast(r === 'ok' ? 'Synced' : 'Sync failed', r === 'ok' ? 'ok' : 'err')
            }}
            className="glass flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
          >
            <Cloud className="h-4 w-4 text-info" />
            <div className="flex-1">
              <div className="text-sm font-semibold">Sync Now</div>
              <div className="text-[10px] text-mute">
                Merge with Google Sheets{api.lastSync ? ` · last ${api.lastSync}` : ''}
              </div>
            </div>
            <RefreshCw className="h-3.5 w-3.5 text-mute" />
          </button>
          <button
            type="button"
            onClick={async () => {
              const ok = await api.pullSettings()
              showToast(ok ? 'Settings pulled' : 'Settings sync failed', ok ? 'ok' : 'err')
            }}
            className="glass flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
          >
            <Download className="h-4 w-4 text-accent" />
            <div className="flex-1">
              <div className="text-sm font-semibold">Settings Sync</div>
              <div className="text-[10px] text-mute">
                {api.settingsSyncLbl || 'Pull budget, goals & recurring'}
              </div>
            </div>
          </button>
        </section>
      </BlurFade>

      <BlurFade delay={0.16}>
        <section className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mute">Data</div>
          <input
            ref={csvRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const text = await file.text()
                const rows = parseCSV(text)
                const n = api.importRows(rows)
                showToast(n ? `Imported ${n} rows` : 'No new rows', n ? 'ok' : 'info')
              } catch {
                showToast('Import failed', 'err')
              }
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => csvRef.current?.click()}
            className="glass flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
          >
            <Upload className="h-4 w-4 text-good" />
            <div>
              <div className="text-sm font-semibold">Import CSV</div>
              <div className="text-[10px] text-mute">Merge rows into local data</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              exportCSV(api.txns)
              showToast('CSV exported')
            }}
            className="glass flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
          >
            <Download className="h-4 w-4 text-gold" />
            <div>
              <div className="text-sm font-semibold">Export CSV</div>
              <div className="text-[10px] text-mute">{api.txns.length} transactions</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('Delete ALL local data? This cannot be undone.')) return
              api.clearAllData()
              showToast('Data cleared', 'ok')
            }}
            className="glass flex w-full items-center gap-3 rounded-2xl border border-bad/20 px-4 py-3.5 text-left"
          >
            <Trash2 className="h-4 w-4 text-bad" />
            <div>
              <div className="text-sm font-semibold text-bad">Clear All Data</div>
              <div className="text-[10px] text-mute">Removes local transactions only</div>
            </div>
          </button>
        </section>
      </BlurFade>

      <BlurFade delay={0.18}>
        <div className="glass rounded-2xl px-4 py-3.5">
          <div className="text-sm font-semibold">Vyaya.vg</div>
          <div className="text-[10px] text-mute">v7.0 · React · Motion · full features</div>
        </div>
      </BlurFade>
    </div>
  )
}
