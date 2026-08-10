import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BarChart3,
  Home as HomeIcon,
  Plus,
  Settings as SettingsIcon,
  Trash2,
  Cloud,
  X,
} from 'lucide-react'
import { AuroraBackdrop } from '@/components/ui/aurora-backdrop'
import { BlurFade } from '@/components/ui/blur-fade'
import { NumberTicker } from '@/components/ui/number-ticker'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import { useExpenses } from '@/hooks/useExpenses'
import { CATS, PAYS, catInfo, type Category, type Payment, type Txn } from '@/lib/types'
import {
  cn,
  currentMonthKey,
  fmtAmt,
  isSpendCat,
  monthKey,
  monthLabel,
  nowTime,
  prevMonthKey,
  today,
} from '@/lib/utils'

type View = 'Home' | 'Analytics' | 'Settings'
type Period = 'today' | 'week' | 'month' | 'all'

export default function App() {
  const api = useExpenses()
  const [view, setView] = useState<View>('Home')
  const [period, setPeriod] = useState<Period>('today')
  const [addOpen, setAddOpen] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: string } | null>(null)
  const [openTxn, setOpenTxn] = useState<string | null>(null)

  const showToast = (msg: string, type = 'ok') => {
    setToast({ msg, type })
    window.setTimeout(() => setToast(null), 2400)
  }

  if (api.booting) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center gap-5">
        <AuroraBackdrop />
        <div className="font-display relative z-10 text-4xl font-black tracking-tight">
          Vyaya<span className="text-accent">.</span>vg
        </div>
        <div className="relative z-10 h-8 w-8 animate-spin rounded-full border-2 border-ink/10 border-t-accent" />
        <div className="relative z-10 text-xs text-mute">Syncing…</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-dvh pb-24">
      <AuroraBackdrop />
      <div className="relative z-10 mx-auto max-w-lg px-4 pt-12 md:max-w-3xl md:px-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <div className="font-display text-2xl font-black tracking-tight">
              Vyaya<span className="text-accent">.</span>vg
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-mute">
              <span
                className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full',
                  api.syncState === 'ok' && 'bg-good shadow-[0_0_6px_var(--color-good)]',
                  api.syncState === 'err' && 'bg-bad',
                  api.syncState === 'syncing' && 'animate-pulse bg-accent',
                  api.syncState === 'local' && 'bg-mute',
                )}
              />
              {api.syncState === 'ok'
                ? `synced ${api.lastSync}`
                : api.syncState === 'err'
                  ? 'offline'
                  : api.syncState === 'syncing'
                    ? 'syncing…'
                    : 'local'}
              {api.pending > 0 && (
                <span className="rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold text-accent">
                  {api.pending} pending
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Add expense"
            onClick={() => setAddOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-3 to-accent text-lg font-bold text-ink shadow-[0_8px_24px_rgba(15,159,138,0.35)] transition active:scale-90"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </header>

        <AnimatePresence mode="wait">
          {view === 'Home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <HomeView
                api={api}
                period={period}
                setPeriod={setPeriod}
                openTxn={openTxn}
                setOpenTxn={setOpenTxn}
                onDelete={async (id) => {
                  await api.deleteTxn(id)
                  showToast('Deleted')
                }}
              />
            </motion.div>
          )}
          {view === 'Analytics' && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <AnalyticsView txns={api.txns} budget={api.budget} />
            </motion.div>
          )}
          {view === 'Settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <SettingsView api={api} showToast={showToast} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink/8 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg gap-1 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {(
            [
              ['Home', HomeIcon],
              ['Analytics', BarChart3],
              ['Settings', SettingsIcon],
            ] as const
          ).map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              onClick={() => setView(name)}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium transition',
                view === name ? 'text-accent' : 'text-mute',
              )}
            >
              <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', view === name && 'bg-accent/12')}>
                <Icon className="h-4 w-4" />
              </span>
              {name}
            </button>
          ))}
        </div>
      </nav>

      <AnimatePresence>
        {addOpen && (
          <AddSheet
            onClose={() => setAddOpen(false)}
            onSave={async (payload) => {
              await api.addTxn(payload)
              setAddOpen(false)
              showToast('Saved')
              setView('Home')
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn(
              'fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border px-4 py-2.5 text-sm font-medium shadow-xl',
              'border-ink/10 bg-white text-foam',
              toast.type === 'ok' && 'border-good/30 text-good',
              toast.type === 'err' && 'border-bad/30 text-bad',
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function HomeView({
  api,
  period,
  setPeriod,
  openTxn,
  setOpenTxn,
  onDelete,
}: {
  api: ReturnType<typeof useExpenses>
  period: Period
  setPeriod: (p: Period) => void
  openTxn: string | null
  setOpenTxn: (id: string | null) => void
  onDelete: (id: string) => void
}) {
  const list = useMemo(() => {
    const d = today()
    const weekAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const mk = currentMonthKey()
    let rows = [...api.txns]
    if (period === 'today') rows = rows.filter((t) => t.date === d)
    else if (period === 'week') rows = rows.filter((t) => t.date >= weekAgo)
    else if (period === 'month') rows = rows.filter((t) => monthKey(t.date) === mk)
    return rows
  }, [api.txns, period])

  const total = list.filter((t) => isSpendCat(t.category)).reduce((s, t) => s + t.amount, 0)
  const budgetPct = api.budget > 0 ? Math.min(100, Math.round((api.monthSpend / api.budget) * 100)) : 0

  return (
    <div className="space-y-5">
      <BlurFade>
        <div className="relative overflow-hidden rounded-[28px] border border-ink/8 bg-white/75 p-6 shadow-[0_20px_50px_rgba(7,22,28,0.08)] backdrop-blur-md">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
              {period === 'today' ? 'Today' : period === 'week' ? 'This week' : period === 'month' ? 'This month' : 'All time'}
            </div>
            <div className="mt-2 font-display text-5xl font-black tracking-tight">
              <span className="mr-1 text-3xl text-accent">₹</span>
              <NumberTicker value={total} />
            </div>
            {api.budget > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-wider text-mute">
                  <span>{fmtAmt(api.monthSpend)} of {fmtAmt(api.budget)}</span>
                  <span className="text-accent">{budgetPct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink/8">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
                    initial={{ width: 0 }}
                    animate={{ width: `${budgetPct}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            )}
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-ink/6 pt-4 text-center">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-mute">Txns</div>
                <div className="mt-1 text-sm font-bold">{list.length}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-mute">Daily avg</div>
                <div className="mt-1 text-sm font-bold">{fmtAmt(total / Math.max(1, period === 'month' ? new Date().getDate() : period === 'week' ? 7 : 1))}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-mute">Biggest</div>
                <div className="mt-1 text-sm font-bold text-bad">
                  {fmtAmt(list.filter((t) => isSpendCat(t.category)).reduce((m, t) => Math.max(m, t.amount), 0))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.08}>
        <div className="flex gap-1 rounded-2xl border border-ink/8 bg-white/70 p-1">
          {(['today', 'week', 'month', 'all'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                'flex-1 rounded-xl px-2 py-2 text-xs font-medium capitalize transition',
                period === p ? 'bg-accent font-bold text-white shadow-md' : 'text-mute',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </BlurFade>

      <BlurFade delay={0.12}>
        <div className="space-y-2">
          <div className="px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-mute">Recent</div>
          {list.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ink/12 px-6 py-14 text-center text-sm text-mute">
              <div className="font-display mb-2 text-3xl text-accent/40">₹</div>
              No expenses yet. Tap + to add one.
            </div>
          ) : (
            list.slice(0, 40).map((t, i) => {
              const ci = catInfo(t.category)
              const open = openTxn === t.id
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="rounded-2xl border border-ink/8 bg-white/80 p-3.5 backdrop-blur-sm"
                  onClick={() => setOpenTxn(open ? null : t.id)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{ background: `${ci.c}22` }}
                    >
                      {ci.i}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{t.note || t.category}</div>
                      <div className="mt-0.5 text-[10px] text-mute">
                        {t.date} · {t.time} · {t.payment}
                      </div>
                    </div>
                    <div className={cn('text-sm font-bold', t.category === 'Investments' ? 'text-good' : 'text-bad')}>
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
                        <div className="mt-3 flex gap-2 border-t border-ink/6 pt-3">
                          <button
                            type="button"
                            className="flex items-center gap-1 rounded-xl border border-bad/20 bg-bad/10 px-3 py-2 text-xs font-semibold text-bad"
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
            })
          )}
        </div>
      </BlurFade>
    </div>
  )
}

function AnalyticsView({ txns, budget }: { txns: Txn[]; budget: number }) {
  const mk = currentMonthKey()
  const list = txns.filter((t) => monthKey(t.date) === mk && isSpendCat(t.category))
  const total = list.reduce((s, t) => s + t.amount, 0)
  const byCat: Record<string, number> = {}
  list.forEach((t) => {
    byCat[t.category] = (byCat[t.category] || 0) + t.amount
  })
  const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  const prev = prevMonthKey(mk)
  const prevTotal = txns
    .filter((t) => monthKey(t.date) === prev && isSpendCat(t.category))
    .reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-4">
      <BlurFade>
        <h1 className="font-display text-2xl font-black">Analytics</h1>
        <p className="mt-1 text-sm text-mute">{monthLabel(mk)} overview</p>
      </BlurFade>
      <BlurFade delay={0.05}>
        <div className="rounded-3xl border border-accent/25 bg-gradient-to-br from-white to-accent/10 p-5 shadow-[0_16px_40px_rgba(7,22,28,0.06)]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent">Spent</div>
          <div className="font-display mt-1 text-3xl font-black">{fmtAmt(total)}</div>
          {budget > 0 && <div className="mt-1 text-xs text-mute">of {fmtAmt(budget)} budget</div>}
          {prevTotal > 0 && (
            <div className="mt-3 text-xs text-mute">
              vs {monthLabel(prev)}: {total >= prevTotal ? '+' : ''}
              {fmtAmt(total - prevTotal)}
            </div>
          )}
        </div>
      </BlurFade>
      <div className="space-y-2">
        {sorted.map(([cat, amt], i) => {
          const ci = catInfo(cat)
          const pct = total ? Math.round((amt / total) * 100) : 0
          return (
            <BlurFade key={cat} delay={0.06 + i * 0.04}>
              <div className="rounded-2xl border border-ink/8 bg-white/85 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span>{ci.i}</span> {cat}
                  </div>
                  <div className="text-sm font-bold">{fmtAmt(amt)}</div>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-ink/8">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ci.c }} />
                </div>
                <div className="mt-1 text-[10px] text-mute">{pct}%</div>
              </div>
            </BlurFade>
          )
        })}
        {!sorted.length && (
          <div className="rounded-2xl border border-dashed border-ink/12 p-10 text-center text-sm text-mute">
            No spend this month yet
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsView({
  api,
  showToast,
}: {
  api: ReturnType<typeof useExpenses>
  showToast: (m: string, t?: string) => void
}) {
  const [budgetInput, setBudgetInput] = useState(String(api.budget || ''))
  const [url, setUrl] = useState(api.sheetUrl)

  return (
    <div className="space-y-6">
      <BlurFade>
        <h1 className="font-display text-2xl font-black">Settings</h1>
      </BlurFade>

      <BlurFade delay={0.05}>
        <section className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mute">Budget</div>
          <div className="flex gap-2">
            <input
              type="number"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="Monthly budget"
              className="flex-1 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <ShimmerButton
              type="button"
              className="!px-4 !py-3"
              onClick={() => {
                api.setBudget(parseFloat(budgetInput) || 0)
                showToast('Budget saved')
              }}
            >
              Set
            </ShimmerButton>
          </div>
        </section>
      </BlurFade>

      <BlurFade delay={0.1}>
        <section className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-mute">Sync</div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Google Apps Script Web App URL"
            className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none focus:border-accent"
          />
          <ShimmerButton
            type="button"
            className="w-full"
            onClick={() => {
              api.setSheetUrl(url.trim())
              showToast('URL saved')
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
            className="flex w-full items-center gap-3 rounded-2xl border border-ink/8 bg-white/90 px-4 py-3.5 text-left"
          >
            <Cloud className="h-4 w-4 text-info" />
            <div className="flex-1">
              <div className="text-sm font-semibold">Sync Now</div>
              <div className="text-[10px] text-mute">Merge with Google Sheets</div>
            </div>
          </button>
        </section>
      </BlurFade>

      <BlurFade delay={0.15}>
        <div className="rounded-2xl border border-ink/8 bg-white/90 px-4 py-3.5">
          <div className="text-sm font-semibold">Vyaya.vg</div>
          <div className="text-[10px] text-mute">v6.1 · React · Motion · light mint UI</div>
        </div>
      </BlurFade>
    </div>
  )
}

function AddSheet({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (t: Omit<Txn, 'id' | 'pending'>) => Promise<void>
}) {
  const [amount, setAmount] = useState('')
  const [cat, setCat] = useState<Category>('Food')
  const [pay, setPay] = useState<Payment>('UPI')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md md:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%', opacity: 1 }}
        animate={{ y: 0 }}
        exit={{ y: '40%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-ink/10 bg-white p-5 pb-10 md:rounded-[24px]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15 md:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">
            <span className="text-accent">Add</span> Expense
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-mute hover:text-foam" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex items-center rounded-2xl border border-ink/10 bg-panel-2 px-4 focus-within:border-accent">
          <span className="font-display text-2xl font-bold text-accent">₹</span>
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="font-display w-full bg-transparent px-2 py-4 text-3xl font-extrabold outline-none"
          />
        </div>

        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-mute">Category</label>
        <div className="mb-4 grid grid-cols-4 gap-2">
          {CATS.map((c) => (
            <button
              key={c.k}
              type="button"
              onClick={() => setCat(c.k)}
              className={cn(
                'rounded-xl border px-1 py-2.5 text-center transition',
                cat === c.k ? 'border-accent bg-accent/10 shadow-[0_0_0_2px_rgba(15,159,138,0.15)]' : 'border-ink/8 bg-panel-2',
              )}
            >
              <div className="text-lg">{c.i}</div>
              <div className={cn('mt-0.5 text-[9px] font-semibold', cat === c.k ? 'text-accent' : 'text-mute')}>{c.k.split(' ')[0]}</div>
            </button>
          ))}
        </div>

        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-mute">Payment</label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {PAYS.map((p) => (
            <button
              key={p.k}
              type="button"
              onClick={() => setPay(p.k)}
              className={cn(
                'rounded-xl border px-3 py-3 text-sm font-semibold transition',
                pay === p.k ? 'border-accent bg-accent/10 text-accent' : 'border-ink/8 bg-panel-2 text-mute',
              )}
            >
              {p.i} {p.k}
            </button>
          ))}
        </div>

        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-mute">Note</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What was this for?"
          className="mb-5 w-full rounded-2xl border border-ink/10 bg-panel-2 px-4 py-3 text-sm outline-none focus:border-accent"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-ink/10 bg-panel-2 py-3.5 text-sm font-semibold text-mute"
          >
            Cancel
          </button>
          <ShimmerButton
            type="button"
            className="flex-[2]"
            disabled={saving}
            onClick={async () => {
              const amt = parseFloat(amount)
              if (!amt || amt <= 0) return
              setSaving(true)
              await onSave({
                amount: amt,
                category: cat,
                payment: pay,
                note: note.trim(),
                date: today(),
                time: nowTime(),
                split: 1,
                paidCount: 0,
                tags: [],
                location: '',
              })
              setSaving(false)
            }}
          >
            Save Expense
          </ShimmerButton>
        </div>
      </motion.div>
    </motion.div>
  )
}
