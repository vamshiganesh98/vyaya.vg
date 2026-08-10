import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, MapPin, X } from 'lucide-react'
import { ShimmerButton } from '@/components/ui/shimmer-button'
import {
  CATS,
  CURRENCIES,
  PAYS,
  parseNaturalNote,
  parseTags,
  suggestCat,
  type Category,
  type Payment,
  type Txn,
} from '@/lib/types'
import {
  cn,
  currentMonthKey,
  detectLocation,
  fmtAmt,
  getFxRate,
  isSpendCat,
  monthKey,
  nowTime,
  today,
} from '@/lib/utils'

export type AddSheetPayload = Omit<Txn, 'id' | 'pending'> & {
  id?: string
  pending?: boolean
}

export function AddSheet({
  editTxn,
  onClose,
  onSave,
  catBudgets,
  txns,
  showToast,
}: {
  editTxn: Txn | null
  onClose: () => void
  onSave: (payload: AddSheetPayload) => Promise<void>
  catBudgets: Record<string, number>
  txns: Txn[]
  showToast: (m: string, t?: string) => void
}) {
  const editing = !!editTxn
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]['k']>('INR')
  const [cat, setCat] = useState<Category>('Food')
  const [pay, setPay] = useState<Payment>('UPI')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')
  const [date, setDate] = useState(today())
  const [time, setTime] = useState(nowTime())
  const [location, setLocation] = useState('')
  const [split, setSplit] = useState(1)
  const [recurring, setRecurring] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [hint, setHint] = useState('')
  const [hintWarn, setHintWarn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [locLoading, setLocLoading] = useState(false)

  useEffect(() => {
    if (editTxn) {
      setAmount(String(editTxn.originalAmount ?? editTxn.amount))
      setCurrency((editTxn.originalCurrency as typeof currency) || 'INR')
      setCat((editTxn.category as Category) || 'Food')
      setPay((editTxn.payment as Payment) || 'UPI')
      setNote(editTxn.note || '')
      setTags((editTxn.tags || []).join(' '))
      setDate(editTxn.date)
      setTime(editTxn.time || nowTime())
      setLocation(editTxn.location || '')
      setSplit(editTxn.split || 1)
      setRecurring(!!editTxn.recurring)
      const needsMore =
        !!(editTxn.tags && editTxn.tags.length) ||
        !!editTxn.location ||
        (editTxn.split || 1) > 1 ||
        !!editTxn.recurring ||
        editTxn.date !== today()
      setMoreOpen(needsMore)
      setHint('')
      setHintWarn(false)
    } else {
      setAmount('')
      setCurrency('INR')
      setCat('Food')
      setPay('UPI')
      setNote('')
      setTags('')
      setDate(today())
      setTime(nowTime())
      setLocation('')
      setSplit(1)
      setRecurring(false)
      setMoreOpen(false)
      setHint('')
      setHintWarn(false)
    }
  }, [editTxn])

  const symbol = CURRENCIES.find((c) => c.k === currency)?.s || '₹'
  const shareAmt = (parseFloat(amount) || 0) / Math.max(1, split)

  const catBudgetWarn = useMemo(() => {
    const lim = catBudgets[cat]
    if (!lim || !isSpendCat(cat)) return null
    const mk = currentMonthKey()
    const spent = txns
      .filter((t) => t.category === cat && monthKey(t.date) === mk && (!editTxn || t.id !== editTxn.id))
      .reduce((s, t) => s + t.amount, 0)
    const entering = currency === 'INR' ? parseFloat(amount) || 0 : 0
    const pct = Math.round(((spent + entering) / lim) * 100)
    if (pct < 80) return null
    return { pct, spent: spent + entering, lim }
  }, [cat, catBudgets, txns, amount, currency, editTxn])

  useEffect(() => {
    if (catBudgetWarn) {
      setHint(
        `⚠️ ${cat} budget ${catBudgetWarn.pct}% used (${fmtAmt(catBudgetWarn.spent)} of ${fmtAmt(catBudgetWarn.lim)})`,
      )
      setHintWarn(true)
    }
  }, [catBudgetWarn, cat])

  const applyNoteIntelligence = (raw: string) => {
    const trimmed = raw.trim()
    const nl = parseNaturalNote(trimmed)
    if (nl && nl.amount > 0 && !amount) {
      setAmount(String(nl.amount))
      setHint(`💬 Detected: ${fmtAmt(nl.amount)}${nl.desc ? ` for ${nl.desc}` : ''}`)
      setHintWarn(false)
    }
    const suggested = suggestCat(trimmed)
    if (suggested) {
      setCat(suggested)
      if (!nl || amount) {
        setHint(`✨ Auto-selected: ${suggested}`)
        setHintWarn(false)
      }
    }
  }

  const handleSave = async () => {
    const rawAmt = parseFloat(amount)
    if (!rawAmt || rawAmt <= 0) {
      showToast('Enter a valid amount', 'err')
      return
    }
    setSaving(true)
    try {
      let finalAmt = rawAmt
      let originalCurrency = currency
      let originalAmount = rawAmt
      if (currency !== 'INR') {
        try {
          const rate = await getFxRate(currency, 'INR')
          finalAmt = Math.round(rawAmt * rate * 100) / 100
          showToast(
            `Converted: ${symbol}${rawAmt} → ${fmtAmt(finalAmt)}`,
            'info',
          )
        } catch {
          showToast('FX fetch failed, saving as INR', 'err')
          finalAmt = rawAmt
          originalCurrency = 'INR'
        }
      }

      const tagsField = tags.trim()
      const normalizedTags = tagsField
        ? tagsField.startsWith('#')
          ? tagsField
          : tagsField
              .split(/\s+/)
              .filter(Boolean)
              .map((t) => (t.startsWith('#') ? t : `#${t}`))
              .join(' ')
        : ''
      const allTags = [...new Set([...parseTags(normalizedTags), ...parseTags(note.trim())])]

      const payload: AddSheetPayload = {
        amount: finalAmt,
        originalAmount,
        originalCurrency,
        category: cat,
        payment: pay,
        note: note.trim(),
        date: date || today(),
        time: time || nowTime(),
        split: Math.max(1, Math.min(10, split)),
        paidCount: editTxn ? editTxn.paidCount || 0 : 0,
        tags: allTags,
        location: location.trim(),
        recurring,
      }
      await onSave(payload)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md md:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '40%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="glass max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-white/10 p-5 pb-10 md:rounded-[24px]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 md:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">
            <span className="text-gold">{editing ? 'Edit' : 'Add'}</span> Expense
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-mute hover:text-foam"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-panel-2/80 px-3 focus-within:border-gold/50">
          <span className="font-display text-2xl font-bold text-gold">{symbol}</span>
          <input
            autoFocus={!editing}
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="font-display w-full bg-transparent py-4 text-3xl font-extrabold outline-none"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as typeof currency)}
            className="rounded-xl border border-white/8 bg-white/5 px-2 py-1.5 text-xs font-semibold outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c.k} value={c.k}>
                {c.s} {c.k}
              </option>
            ))}
          </select>
        </div>

        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
          Category
        </label>
        <div className="mb-3 grid grid-cols-4 gap-2">
          {CATS.map((c) => (
            <button
              key={c.k}
              type="button"
              onClick={() => setCat(c.k)}
              className={cn(
                'rounded-xl border px-1 py-2.5 text-center transition',
                cat === c.k
                  ? 'border-gold bg-gold/10 shadow-[0_0_0_2px_rgba(232,197,71,0.18)]'
                  : 'border-white/8 bg-panel-2/60',
              )}
            >
              <div className="text-lg">{c.i}</div>
              <div
                className={cn(
                  'mt-0.5 text-[9px] font-semibold',
                  cat === c.k ? 'text-gold' : 'text-mute',
                )}
              >
                {c.k.split(' ')[0]}
              </div>
            </button>
          ))}
        </div>

        {(hint || catBudgetWarn) && (
          <div
            className={cn(
              'mb-3 rounded-xl px-3 py-2 text-[11px] font-medium',
              hintWarn || catBudgetWarn ? 'bg-warn/15 text-warn' : 'bg-info/10 text-info',
            )}
          >
            {hint ||
              (catBudgetWarn
                ? `⚠️ ${cat} budget ${catBudgetWarn.pct}% used`
                : '')}
          </div>
        )}

        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
          Payment
        </label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {PAYS.map((p) => (
            <button
              key={p.k}
              type="button"
              onClick={() => setPay(p.k)}
              className={cn(
                'rounded-xl border px-3 py-3 text-sm font-semibold transition',
                pay === p.k
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-white/8 bg-panel-2/60 text-mute',
              )}
            >
              {p.i} {p.k}
            </button>
          ))}
        </div>

        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
          Note
        </label>
        <input
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            applyNoteIntelligence(e.target.value)
          }}
          onBlur={(e) => applyNoteIntelligence(e.target.value)}
          placeholder='What was this for? · "paid 450 for lunch"'
          className="mb-3 w-full rounded-2xl border border-white/10 bg-panel-2/80 px-4 py-3 text-sm outline-none focus:border-gold/50"
        />

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="mb-3 flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-xs font-semibold text-mute"
        >
          <span>{moreOpen ? 'Hide options' : 'More options'}</span>
          <ChevronDown
            className={cn('h-4 w-4 transition', moreOpen && 'rotate-180')}
          />
        </button>

        <AnimatePresence initial={false}>
          {moreOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mb-4 space-y-3">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
                    Tags
                  </label>
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="#food #goa"
                    className="w-full rounded-2xl border border-white/10 bg-panel-2/80 px-4 py-3 text-sm outline-none focus:border-gold/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
                      Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-panel-2/80 px-3 py-3 text-sm outline-none focus:border-gold/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
                      Time
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-panel-2/80 px-3 py-3 text-sm outline-none focus:border-gold/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
                    Location
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Area / place"
                      className="w-full rounded-2xl border border-white/10 bg-panel-2/80 px-4 py-3 text-sm outline-none focus:border-gold/50"
                    />
                    <button
                      type="button"
                      disabled={locLoading}
                      onClick={async () => {
                        setLocLoading(true)
                        try {
                          const area = await detectLocation()
                          setLocation(area)
                          showToast(area ? `Location: ${area}` : 'Location set', 'ok')
                        } catch {
                          showToast('Location failed', 'err')
                        } finally {
                          setLocLoading(false)
                        }
                      }}
                      className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-3 text-mute"
                      aria-label="Detect location"
                    >
                      <MapPin className={cn('h-4 w-4', locLoading && 'animate-pulse text-gold')} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-mute">
                    Split
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg"
                      onClick={() => setSplit((n) => Math.max(1, n - 1))}
                    >
                      −
                    </button>
                    <span className="min-w-[2rem] text-center text-sm font-bold">{split}</span>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg"
                      onClick={() => setSplit((n) => Math.min(10, n + 1))}
                    >
                      +
                    </button>
                    <span className="text-[11px] text-mute">
                      Your share: <strong className="text-foam">{fmtAmt(shareAmt)}</strong>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={recurring}
                  onClick={() => setRecurring((v) => !v)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition',
                    recurring
                      ? 'border-gold/40 bg-gold/10 text-gold'
                      : 'border-white/10 bg-panel-2/60 text-mute',
                  )}
                >
                  <span>Recurring expense</span>
                  <span
                    className={cn(
                      'relative h-6 w-11 rounded-full transition',
                      recurring ? 'bg-gold' : 'bg-white/15',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-ink transition',
                        recurring ? 'left-5' : 'left-0.5',
                      )}
                    />
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-white/10 bg-panel-2/80 py-3.5 text-sm font-semibold text-mute"
          >
            Cancel
          </button>
          <ShimmerButton
            type="button"
            className="flex-[2]"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Save Expense'}
          </ShimmerButton>
        </div>
      </motion.div>
    </motion.div>
  )
}
