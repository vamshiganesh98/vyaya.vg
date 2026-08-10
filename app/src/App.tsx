import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BarChart3, Plus, Settings, Target, Wallet } from 'lucide-react'
import { AddSheet, type AddSheetPayload } from '@/components/AddSheet'
import { PlanView } from '@/components/PlanView'
import { QuickAdd } from '@/components/QuickAdd'
import { ReportView } from '@/components/ReportView'
import { SetupView } from '@/components/SetupView'
import { SpendView } from '@/components/SpendView'
import { useExpenses } from '@/hooks/useExpenses'
import { parsedToTxnPayload, parseExpenseText } from '@/lib/ai-parse'
import { normCat, parseTags } from '@/lib/types'
import { cn, nowTime, today } from '@/lib/utils'

type Tab = 'spend' | 'report' | 'plan' | 'setup'

type ToastState = { msg: string; type?: string } | null

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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light')
    document.documentElement.style.colorScheme = 'light'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', '#f7f7f5')
  }, [])

  // URL: ?q= plain English (iPhone Shortcut) or legacy ?amt=
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

  const tabs: { id: Tab; label: string; icon: typeof Wallet }[] = [
    { id: 'spend', label: 'Spend', icon: Wallet },
    { id: 'report', label: 'Report', icon: BarChart3 },
    { id: 'plan', label: 'Plan', icon: Target },
    { id: 'setup', label: 'Setup', icon: Settings },
  ]

  if (api.booting || urlLoading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <div className="text-xl font-semibold tracking-tight">vyaya.vg</div>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-fg" />
        <p className="text-xs text-muted">{urlLoading ? 'Saving your expense…' : 'Loading…'}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-28">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 px-4 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">vyaya.vg</h1>
          <div className="flex items-center gap-2 text-[10px] text-muted">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                api.syncState === 'ok' && 'bg-good',
                api.syncState === 'err' && 'bg-bad',
                api.syncState === 'syncing' && 'animate-pulse bg-fg',
                api.syncState === 'local' && 'bg-muted',
              )}
            />
            {api.syncState === 'ok' ? `synced ${api.lastSync}` : api.syncState}
          </div>
        </div>
      </header>

      <main className="px-4 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
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
      </main>

      <button
        type="button"
        aria-label="Add expense"
        onClick={() => {
          setQuickText('')
          setQuickAuto(false)
          setQuickOpen(true)
        }}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-fg text-canvas shadow-lg active:scale-95"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-surface px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mx-auto flex max-w-lg gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition',
                tab === id ? 'text-fg' : 'text-muted',
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
              'fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-surface px-4 py-2 text-sm shadow-lg',
              toast.type === 'err' && 'text-bad',
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
