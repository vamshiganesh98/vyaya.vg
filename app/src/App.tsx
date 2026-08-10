import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BarChart3,
  Plus,
  Settings,
  Sparkles,
  Target,
  Wallet,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { AddSheet, type AddSheetPayload } from '@/components/AddSheet'
import { PlanView } from '@/components/PlanView'
import { QuickAdd } from '@/components/QuickAdd'
import { ReportView } from '@/components/ReportView'
import { SetupView } from '@/components/SetupView'
import { SpendView } from '@/components/SpendView'
import { AuroraBackdrop } from '@/components/ui/aurora-backdrop'
import { useExpenses } from '@/hooks/useExpenses'
import { parsedToTxnPayload, parseExpenseText } from '@/lib/ai-parse'
import { normCat, parseTags } from '@/lib/types'
import { cn, fmtAmt, nowTime, today } from '@/lib/utils'

type Tab = 'spend' | 'report' | 'plan' | 'setup'

type ToastState = { msg: string; type?: string } | null

const TABS: { id: Tab; label: string; icon: typeof Wallet; desc: string }[] = [
  { id: 'spend', label: 'Spend', icon: Wallet, desc: 'Transactions' },
  { id: 'report', label: 'Report', icon: BarChart3, desc: 'Analytics' },
  { id: 'plan', label: 'Plan', icon: Target, desc: 'Budgets' },
  { id: 'setup', label: 'Setup', icon: Settings, desc: 'Sync & keys' },
]

export default function App() {
  const api = useExpenses()
  const [tab, setTab] = useState<Tab>('spend')
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickText, setQuickText] = useState('')
  const [quickAuto, setQuickAuto] = useState(false)
  const [quickSave, setQuickSave] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [urlLoading, setUrlLoading] = useState(false)
  const urlHandled = useRef(false)
  const toastTimer = useRef<number | null>(null)

  const showToast = useCallback((msg: string, type = 'ok') => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = window.setTimeout(() => setToast(null), 2800)
  }, [])

  const openQuickAdd = useCallback(() => {
    setQuickText('')
    setQuickAuto(false)
    setQuickSave(false)
    setQuickOpen(true)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.style.colorScheme = 'dark'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', '#06060c')
  }, [])

  useEffect(() => {
    if (api.booting || urlHandled.current) return
    urlHandled.current = true
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q') || params.get('text') || params.get('input')
    history.replaceState({}, document.title, window.location.pathname)

    if (q?.trim()) {
      setQuickText(q.trim())
      setQuickAuto(true)
      setQuickSave(true)
      setQuickOpen(true)
      return
    }

    const amt = parseFloat(params.get('amt') || '')
    if (!amt || amt <= 0) return

    const runLegacy = async () => {
      setUrlLoading(true)
      try {
        const note = params.get('note') || ''
        const text = note || `${amt} ${params.get('cat') || 'Others'}`
        let payload: AddSheetPayload
        try {
          const { result } = await parseExpenseText(text.includes(String(amt)) ? text : `spent ${amt} ${text}`)
          payload = parsedToTxnPayload(result)
        } catch {
          payload = {
            amount: amt,
            originalAmount: amt,
            originalCurrency: 'INR',
            category: normCat(params.get('cat') || 'Others'),
            payment: (params.get('pay') as 'UPI') || 'UPI',
            note,
            date: params.get('date') || today(),
            time: params.get('time') || nowTime(),
            split: parseInt(params.get('split') || '1', 10) || 1,
            paidCount: 0,
            tags: parseTags(params.get('tags') || note),
            location: params.get('loc') || '',
            recurring: false,
          }
        }
        await api.addTxn(payload)
        showToast(`Saved ${payload.note || payload.category}`)
        setTab('spend')
      } catch {
        showToast('Could not save expense', 'err')
      } finally {
        setUrlLoading(false)
      }
    }
    void runLegacy()
  }, [api, api.booting, showToast])

  const handleSave = async (payload: AddSheetPayload) => {
    if (editId) {
      await api.updateTxn(editId, payload)
      showToast('Updated')
    } else {
      await api.addTxn(payload)
      if (payload.recurring && payload.note) {
        api.addRecurring({
          name: payload.note,
          amount: payload.amount,
          category: payload.category,
          payment: payload.payment,
          freq: 'monthly',
          freqDate: 1,
          lastLogged: payload.date,
        })
        void api.pushSettings()
      }
    }
    setAddOpen(false)
    setEditId(null)
    setTab('spend')
  }

  const handleDelete = (id: string) => {
    const result = api.deleteTxn(id)
    if (!result) return
    showToast('Deleted')
    window.setTimeout(() => {
      void api.syncDelete(result.txn)
    }, 4000)
  }

  const editTxn = editId ? api.txns.find((t) => t.id === editId) || null : null

  const syncLabel =
    api.syncState === 'ok'
      ? `Synced ${api.lastSync}`
      : api.syncState === 'syncing'
        ? 'Syncing…'
        : api.syncState === 'err'
          ? 'Sync error'
          : 'Local only'

  if (api.booting || urlLoading) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center gap-5">
        <div className="app-bg" />
        <AuroraBackdrop />
        <div className="font-display text-2xl font-bold tracking-tight">
          vyaya<span className="text-accent">.</span>vg
        </div>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
        <p className="text-xs text-muted">{urlLoading ? 'Saving your expense…' : 'Loading…'}</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-dvh">
      <div className="app-bg" />
      <AuroraBackdrop />

      <div className="relative flex min-h-dvh lg:pl-[240px]">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r border-line bg-canvas/80 backdrop-blur-xl lg:flex">
          <div className="border-b border-line px-6 py-6">
            <div className="font-display text-xl font-bold tracking-tight">
              vyaya<span className="text-accent">.</span>vg
            </div>
            <p className="mt-1 text-[11px] text-muted">Personal expense tracker</p>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {TABS.map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                  tab === id
                    ? 'bg-accent/12 text-accent'
                    : 'text-muted hover:bg-white/5 hover:text-fg',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={tab === id ? 2.5 : 2} />
                <div>
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-[10px] opacity-70">{desc}</div>
                </div>
              </button>
            ))}
          </nav>

          <div className="space-y-3 border-t border-line p-4">
            <button type="button" className="btn-primary w-full" onClick={openQuickAdd}>
              <Plus className="h-4 w-4" />
              Add expense
            </button>
            <div className="flex items-center gap-2 rounded-xl bg-white/4 px-3 py-2 text-[10px] text-muted">
              {api.syncState === 'ok' ? (
                <Wifi className="h-3 w-3 text-good" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span className="truncate">{syncLabel}</span>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {/* Mobile header */}
          <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-lg font-bold tracking-tight">
                  vyaya<span className="text-accent">.</span>vg
                </div>
                <div className="text-[10px] text-muted">
                  {TABS.find((t) => t.id === tab)?.label} · {fmtAmt(api.todaySpend)} today
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    api.syncState === 'ok' && 'bg-good',
                    api.syncState === 'err' && 'bg-bad',
                    api.syncState === 'syncing' && 'animate-pulse bg-accent',
                    api.syncState === 'local' && 'bg-muted',
                  )}
                />
              </div>
            </div>
          </header>

          {/* Desktop top bar */}
          <header className="sticky top-0 z-30 hidden border-b border-line bg-canvas/80 px-8 py-4 backdrop-blur-xl lg:block">
            <div className="mx-auto flex max-w-[1400px] items-center justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight">
                  {TABS.find((t) => t.id === tab)?.label}
                </h1>
                <p className="text-sm text-muted">
                  {tab === 'spend' && `${api.txns.length} transactions · ${fmtAmt(api.monthSpend)} this month`}
                  {tab === 'report' && 'Category breakdown, trends & insights'}
                  {tab === 'plan' && 'Budgets, goals & limits'}
                  {tab === 'setup' && 'Gemini AI, Sheets sync & shortcuts'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden items-center gap-6 xl:flex">
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted">Today</div>
                    <div className="font-display text-lg font-bold text-accent">{fmtAmt(api.todaySpend)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted">This month</div>
                    <div className="font-display text-lg font-bold">{fmtAmt(api.monthSpend)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-line bg-white/4 px-3 py-1.5 text-xs text-muted">
                  <Sparkles className="h-3 w-3 text-accent" />
                  {syncLabel}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 lg:px-8 lg:py-6">
            <div className="mx-auto max-w-[1400px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22 }}
                >
                  {tab === 'spend' && (
                    <SpendView
                      api={api}
                      onEdit={(id) => {
                        setEditId(id)
                        setAddOpen(true)
                      }}
                      onDelete={handleDelete}
                    />
                  )}
                  {tab === 'report' && <ReportView api={api} />}
                  {tab === 'plan' && <PlanView api={api} />}
                  {tab === 'setup' && <SetupView api={api} showToast={showToast} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>

      {/* Mobile FAB */}
      <button
        type="button"
        aria-label="Add expense"
        onClick={openQuickAdd}
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-ink shadow-[0_8px_32px_rgba(232,197,71,0.4)] active:scale-95 lg:hidden"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-canvas/90 backdrop-blur-xl lg:hidden">
        <div className="flex px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold transition',
                tab === id ? 'text-accent' : 'text-muted',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={tab === id ? 2.5 : 2} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <QuickAdd
        open={quickOpen}
        initialText={quickText}
        autoSubmit={quickAuto}
        autoSave={quickSave}
        onClose={() => {
          setQuickOpen(false)
          setQuickAuto(false)
          setQuickSave(false)
        }}
        onSave={handleSave}
        onToast={showToast}
      />

      <AnimatePresence>
        {addOpen && (
          <AddSheet
            editTxn={editTxn}
            onClose={() => {
              setAddOpen(false)
              setEditId(null)
            }}
            onSave={handleSave}
            catBudgets={api.catBudgets}
            txns={api.txns}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              'fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-line bg-canvas/95 px-5 py-2.5 text-sm shadow-xl backdrop-blur-xl lg:bottom-8',
              toast.type === 'err' ? 'text-bad' : 'text-fg',
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
