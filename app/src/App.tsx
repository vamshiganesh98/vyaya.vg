import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BarChart3,
  Home as HomeIcon,
  Moon,
  Monitor,
  Plus,
  Settings as SettingsIcon,
  Sun,
} from 'lucide-react'
import { AddSheet, type AddSheetPayload } from '@/components/AddSheet'
import { AnalyticsView } from '@/components/AnalyticsView'
import { HomeView } from '@/components/HomeView'
import { SettingsView } from '@/components/SettingsView'
import { AuroraBackdrop } from '@/components/ui/aurora-backdrop'
import { useExpenses } from '@/hooks/useExpenses'
import {
  catInfo,
  normCat,
  parseTags,
  type AnalyticsTab,
  type DrillFilter,
  type Period,
  type ThemePref,
} from '@/lib/types'
import {
  cn,
  currentMonthKey,
  fmtAmt,
  nowTime,
  today,
} from '@/lib/utils'

type View = 'Home' | 'Analytics' | 'Settings'

type ToastState = {
  msg: string
  type?: string
  actionLabel?: string
  onAction?: () => void
} | null

function resolveTheme(pref: ThemePref): 'dark' | 'light' {
  if (pref === 'light') return 'light'
  if (pref === 'dark') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function istHour() {
  return parseInt(
    new Date().toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    }),
    10,
  )
}

export default function App() {
  const api = useExpenses()
  const [view, setView] = useState<View>('Home')
  const [period, setPeriod] = useState<Period>('today')
  const [searchQ, setSearchQ] = useState('')
  const [drill, setDrill] = useState<DrillFilter | null>(null)
  const [openTxn, setOpenTxn] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [analyticsMonth, setAnalyticsMonth] = useState(currentMonthKey())
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('overview')
  const [toast, setToast] = useState<ToastState>(null)
  const [moodOpen, setMoodOpen] = useState(false)
  const [urlSplit, setUrlSplit] = useState<{
    amt: number
    cat: string
    pay: string
    note: string
    date: string
    time: string
    location: string
    tagsRaw: string
    splitN: number
  } | null>(null)

  const toastTimer = useRef<number | null>(null)
  const deleteTimer = useRef<number | null>(null)
  const urlHandled = useRef(false)

  const showToast = useCallback((msg: string, type = 'ok', opts?: { actionLabel?: string; onAction?: () => void; ms?: number }) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({
      msg,
      type,
      actionLabel: opts?.actionLabel,
      onAction: opts?.onAction,
    })
    toastTimer.current = window.setTimeout(() => setToast(null), opts?.ms ?? 2400)
  }, [])

  // Theme: data-theme + theme-color meta + system listener
  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(api.themePref)
      document.documentElement.setAttribute('data-theme', resolved)
      document.documentElement.style.colorScheme = resolved
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', resolved === 'light' ? '#f5f4f0' : '#07070c')
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => {
      if (api.themePref === 'system') apply()
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [api.themePref])

  // URL params → add transaction (iPhone Shortcut)
  useEffect(() => {
    if (api.booting || urlHandled.current) return
    urlHandled.current = true
    const params = new URLSearchParams(window.location.search)
    const amt = parseFloat(params.get('amt') || '')
    if (!amt || amt <= 0) return

    const cat = normCat(params.get('cat') || 'Others')
    const pay = params.get('pay') || 'UPI'
    const note = params.get('note') || ''
    const splitParam = params.get('split')
    let split = parseInt(splitParam || '1', 10) || 1
    const date = params.get('date') || today()
    const time = params.get('time') || nowTime()
    const location = params.get('loc') || ''
    const tagsRaw = params.get('tags') || ''

    history.replaceState({}, document.title, window.location.pathname)

    const saveUrlTxn = async (splitN: number) => {
      const allTags = [...new Set([...parseTags(tagsRaw), ...parseTags(note)])]
      await api.addTxn({
        amount: amt,
        originalAmount: amt,
        originalCurrency: 'INR',
        category: cat,
        payment: pay,
        note,
        date,
        time,
        split: splitN,
        paidCount: 0,
        tags: allTags,
        location,
        recurring: false,
      })
      const catI = catInfo(cat).i
      showToast(
        `${catI} ₹${Math.round(amt)}${note ? ` · ${note}` : ''}${splitN > 1 ? ` · split ${splitN}` : ''} saved!`,
      )
      setView('Home')
    }

    if (amt > 1000 && !splitParam) {
      setUrlSplit({
        amt,
        cat,
        pay,
        note,
        date,
        time,
        location,
        tagsRaw,
        splitN: 1,
      })
      return
    }

    void saveUrlTxn(split)
  }, [api, api.booting, showToast])

  // End-of-day mood (IST >= 21)
  useEffect(() => {
    if (api.booting) return
    const t = window.setTimeout(() => {
      const h = istHour()
      if (h < 21) return
      const d = today()
      if (api.moodLog[d] !== undefined) return
      setMoodOpen(true)
    }, 2000)
    return () => window.clearTimeout(t)
  }, [api.booting, api.moodLog])

  const cycleTheme = () => {
    const order: ThemePref[] = ['dark', 'light', 'system']
    const next = order[(order.indexOf(api.themePref) + 1) % order.length]
    api.setThemePref(next)
    showToast(`Theme: ${next}`, 'info')
  }

  const themeIcon =
    api.themePref === 'light' ? Sun : api.themePref === 'system' ? Monitor : Moon

  const openAdd = () => {
    setEditId(null)
    setAddOpen(true)
  }

  const openEdit = (id: string) => {
    setEditId(id)
    setAddOpen(true)
  }

  const handleDelete = (id: string) => {
    const result = api.deleteTxn(id)
    if (!result) return
    setOpenTxn(null)
    if (deleteTimer.current) window.clearTimeout(deleteTimer.current)
    let undone = false
    showToast('Deleted', 'ok', {
      actionLabel: 'Undo',
      ms: 5000,
      onAction: () => {
        undone = true
        api.restoreTxn(result.txn, result.index)
        showToast('Restored')
      },
    })
    deleteTimer.current = window.setTimeout(() => {
      if (!undone) void api.syncDelete(result.txn)
    }, 5000)
  }

  const handleMakeRecurring = (id: string) => {
    const t = api.txns.find((x) => x.id === id)
    if (!t) return
    const name = (t.note || t.category).replace(/#[\w-]+/g, '').trim()
    const existing = api.recurring.find(
      (r) => r.name && r.name.toLowerCase() === name.toLowerCase(),
    )
    if (existing) {
      showToast(`Already in recurring: ${existing.name}`, 'info')
      return
    }
    api.addRecurring({
      name,
      amount: t.amount,
      category: t.category,
      payment: t.payment,
      freq: 'monthly',
      freqDate: 1,
      lastLogged: t.date,
    })
    void api.pushSettings()
    void api.updateTxn(id, { recurring: true })
    showToast('Added to recurring')
  }

  const handleDrill = (d: DrillFilter) => {
    setDrill(d)
    setSearchQ('')
    setPeriod('month')
    setView('Home')
  }

  const handleSaveSheet = async (payload: AddSheetPayload) => {
    if (editId) {
      await api.updateTxn(editId, payload)
      showToast('Updated')
    } else {
      await api.addTxn(payload)
      showToast('Saved')
      if (payload.recurring && payload.note) {
        const existing = api.recurring.find(
          (r) => r.name.toLowerCase() === payload.note.toLowerCase(),
        )
        if (existing) {
          api.updateRecurring(existing.id, { lastLogged: payload.date })
        } else {
          api.addRecurring({
            name: payload.note,
            amount: payload.amount,
            category: payload.category,
            payment: payload.payment,
            freq: 'monthly',
            freqDate: 1,
            lastLogged: payload.date,
          })
        }
        void api.pushSettings()
      }
    }
    setAddOpen(false)
    setEditId(null)
    setView('Home')
  }

  const editTxn = editId ? api.txns.find((t) => t.id === editId) || null : null
  const ThemeIcon = themeIcon

  const navItems = [
    { name: 'Home' as const, icon: HomeIcon },
    { name: 'Analytics' as const, icon: BarChart3 },
    { name: 'Settings' as const, icon: SettingsIcon },
  ]

  if (api.booting) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center gap-5 overflow-hidden">
        <AuroraBackdrop className="fixed inset-0" />
        <div className="noise" />
        <div className="font-display relative z-10 text-4xl font-black tracking-tight">
          Vyaya<span className="text-gold">.</span>vg
        </div>
        <div className="relative z-10 h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-gold" />
        <div className="relative z-10 text-xs text-mute">Syncing…</div>
      </div>
    )
  }

  return (
    <div className="relative min-h-dvh pb-24 md:pb-8">
      <AuroraBackdrop className="fixed inset-0" />
      <div className="noise" />

      <div className="relative z-10 mx-auto flex max-w-6xl gap-6 px-4 pt-10 md:px-8 md:pt-12">
        {/* Desktop sidebar */}
        <aside className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-56 shrink-0 flex-col md:flex">
          <div className="font-display text-2xl font-black tracking-tight">
            Vyaya<span className="text-gold">.</span>vg
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-mute">
            <SyncDot state={api.syncState} />
            <SyncLabel api={api} />
          </div>
          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {navItems.map(({ name, icon: Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => setView(name)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition',
                  view === name
                    ? 'bg-gold/15 text-gold'
                    : 'text-mute hover:bg-white/5 hover:text-foam',
                )}
              >
                <Icon className="h-4 w-4" />
                {name}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={openAdd}
            className="mt-auto flex items-center justify-center gap-2 rounded-2xl bg-gold px-4 py-3.5 text-sm font-bold text-ink shadow-[0_12px_32px_rgba(232,197,71,0.28)]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Add expense
          </button>
        </aside>

        <div className="min-w-0 flex-1 md:max-w-2xl">
          <header className="mb-6 flex items-center justify-between gap-3 md:mb-8">
            <div className="md:hidden">
              <div className="font-display text-2xl font-black tracking-tight">
                Vyaya<span className="text-gold">.</span>vg
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-mute">
                <SyncDot state={api.syncState} />
                <SyncLabel api={api} />
                {api.pending > 0 && (
                  <span className="rounded-md border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[9px] font-bold text-gold">
                    {api.pending} pending
                  </span>
                )}
              </div>
            </div>
            <div className="hidden text-sm font-semibold text-mute md:block">
              {view === 'Home' ? 'Home' : view === 'Analytics' ? 'Analytics' : 'Settings'}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cycleTheme}
                aria-label="Cycle theme"
                title="Cycle theme"
                className="glass flex h-11 w-11 items-center justify-center rounded-2xl text-mute transition hover:text-gold"
              >
                <ThemeIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Add expense"
                onClick={openAdd}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-3 to-gold text-lg font-bold text-ink shadow-[0_8px_24px_rgba(232,197,71,0.35)] transition active:scale-90 md:hidden"
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>
          </header>

          <AnimatePresence mode="wait">
            {view === 'Home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28 }}
              >
                <HomeView
                  api={api}
                  period={period}
                  setPeriod={setPeriod}
                  searchQ={searchQ}
                  setSearchQ={setSearchQ}
                  drill={drill}
                  setDrill={setDrill}
                  openTxn={openTxn}
                  setOpenTxn={setOpenTxn}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onMakeRecurring={handleMakeRecurring}
                  onToast={showToast}
                  goAnalytics={() => {
                    setAnalyticsTab('overview')
                    setView('Analytics')
                  }}
                />
              </motion.div>
            )}
            {view === 'Analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28 }}
              >
                <AnalyticsView
                  api={api}
                  month={analyticsMonth}
                  setMonth={setAnalyticsMonth}
                  tab={analyticsTab}
                  setTab={setAnalyticsTab}
                  onDrill={handleDrill}
                />
              </motion.div>
            )}
            {view === 'Settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.28 }}
              >
                <SettingsView api={api} showToast={showToast} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/8 bg-ink/80 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg gap-1 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {navItems.map(({ name, icon: Icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => setView(name)}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium transition',
                view === name ? 'text-gold' : 'text-mute',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  view === name && 'bg-gold/15',
                )}
              >
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
            editTxn={editTxn}
            onClose={() => {
              setAddOpen(false)
              setEditId(null)
            }}
            onSave={handleSaveSheet}
            catBudgets={api.catBudgets}
            txns={api.txns}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* URL split prompt for large amounts */}
      <AnimatePresence>
        {urlSplit && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-md md:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="glass w-full max-w-md rounded-t-[28px] p-6 pb-10 md:rounded-[24px]"
            >
              <div className="font-display text-xl font-extrabold">
                <span className="text-gold">Split</span> this expense?
              </div>
              <div className="mt-2 text-sm text-mute">
                {catInfo(urlSplit.cat).i} ₹{Math.round(urlSplit.amt)}
                {urlSplit.note ? ` · ${urlSplit.note}` : ''}
              </div>
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10"
                  onClick={() =>
                    setUrlSplit((s) => (s && s.splitN > 1 ? { ...s, splitN: s.splitN - 1 } : s))
                  }
                >
                  −
                </button>
                <span className="min-w-[2rem] text-center text-lg font-bold">{urlSplit.splitN}</span>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10"
                  onClick={() =>
                    setUrlSplit((s) => (s && s.splitN < 10 ? { ...s, splitN: s.splitN + 1 } : s))
                  }
                >
                  +
                </button>
                <span className="text-xs text-mute">
                  Your share:{' '}
                  <strong className="text-foam">
                    {fmtAmt(urlSplit.amt / urlSplit.splitN)}
                  </strong>
                </span>
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-2xl border border-white/10 py-3 text-sm font-semibold text-mute"
                  onClick={async () => {
                    const s = urlSplit
                    setUrlSplit(null)
                    const allTags = [
                      ...new Set([...parseTags(s.tagsRaw), ...parseTags(s.note)]),
                    ]
                    await api.addTxn({
                      amount: s.amt,
                      originalAmount: s.amt,
                      originalCurrency: 'INR',
                      category: s.cat,
                      payment: s.pay,
                      note: s.note,
                      date: s.date,
                      time: s.time,
                      split: 1,
                      paidCount: 0,
                      tags: allTags,
                      location: s.location,
                      recurring: false,
                    })
                    showToast('Saved')
                    setView('Home')
                  }}
                >
                  No split
                </button>
                <button
                  type="button"
                  className="flex-[2] rounded-2xl bg-gold py-3 text-sm font-bold text-ink"
                  onClick={async () => {
                    const s = urlSplit
                    setUrlSplit(null)
                    const allTags = [
                      ...new Set([...parseTags(s.tagsRaw), ...parseTags(s.note)]),
                    ]
                    await api.addTxn({
                      amount: s.amt,
                      originalAmount: s.amt,
                      originalCurrency: 'INR',
                      category: s.cat,
                      payment: s.pay,
                      note: s.note,
                      date: s.date,
                      time: s.time,
                      split: s.splitN,
                      paidCount: 0,
                      tags: allTags,
                      location: s.location,
                      recurring: false,
                    })
                    showToast(
                      `Saved${s.splitN > 1 ? ` · split ${s.splitN}` : ''}`,
                    )
                    setView('Home')
                  }}
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End-of-day mood */}
      <AnimatePresence>
        {moodOpen && (
          <motion.div
            className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="glass w-full max-w-sm rounded-3xl p-6 text-center"
            >
              <div className="font-display text-xl font-black">How was today?</div>
              <div className="mt-2 text-xs text-mute">
                {api.txns.filter((t) => t.date === today()).length} transactions ·{' '}
                {fmtAmt(api.todaySpend)}
              </div>
              <div className="mt-5 flex justify-center gap-3">
                {[
                  { n: 1, label: 'Rough' },
                  { n: 2, label: 'Okay' },
                  { n: 3, label: 'Great' },
                ].map((m) => (
                  <button
                    key={m.n}
                    type="button"
                    onClick={() => {
                      api.setMood(today(), m.n)
                      setMoodOpen(false)
                      showToast('Mood logged')
                    }}
                    className="flex h-16 w-16 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-bold transition hover:border-gold/40 hover:bg-gold/10"
                  >
                    <span className="text-lg">{m.n}</span>
                    <span className="text-[9px] text-mute">{m.label}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mt-4 text-xs font-semibold text-mute"
                onClick={() => setMoodOpen(false)}
              >
                Skip
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn(
              'fixed bottom-24 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-2.5 text-sm font-medium shadow-xl md:bottom-8',
              'glass border-white/10 text-foam',
              toast.type === 'ok' && 'border-good/30',
              toast.type === 'err' && 'border-bad/30 text-bad',
              toast.type === 'info' && 'border-info/30',
            )}
          >
            <span>{toast.msg}</span>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                className="underline decoration-gold underline-offset-2 font-bold text-gold"
                onClick={() => {
                  toast.onAction?.()
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SyncDot({ state }: { state: string }) {
  return (
    <span
      className={cn(
        'inline-block h-1.5 w-1.5 rounded-full',
        state === 'ok' && 'bg-good shadow-[0_0_6px_var(--color-good)]',
        state === 'err' && 'bg-bad',
        state === 'syncing' && 'animate-pulse bg-gold',
        state === 'local' && 'bg-mute',
      )}
    />
  )
}

function SyncLabel({ api }: { api: ReturnType<typeof useExpenses> }) {
  if (api.syncState === 'ok') return <>synced {api.lastSync}</>
  if (api.syncState === 'err') return <>offline</>
  if (api.syncState === 'syncing') return <>syncing…</>
  return <>local</>
}
