import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2, Sparkles, X } from 'lucide-react'
import {
  parseExpenseText,
  parsedToTxnPayload,
  type ParsedExpense,
} from '@/lib/ai-parse'
import { catInfo } from '@/lib/types'
import { cn, fmtAmt, fmtDate } from '@/lib/utils'
import type { AddSheetPayload } from '@/components/AddSheet'

type Phase = 'input' | 'parsing' | 'preview' | 'saving'

export function QuickAdd({
  open,
  initialText = '',
  autoSubmit = false,
  autoSave = false,
  onClose,
  onSave,
  onToast,
}: {
  open: boolean
  initialText?: string
  autoSubmit?: boolean
  /** Shortcut mode: parse and save without preview */
  autoSave?: boolean
  onClose: () => void
  onSave: (payload: AddSheetPayload) => Promise<void>
  onToast: (msg: string, type?: string) => void
}) {
  const [text, setText] = useState(initialText)
  const [phase, setPhase] = useState<Phase>('input')
  const [parsed, setParsed] = useState<ParsedExpense | null>(null)
  const [source, setSource] = useState<'ai' | 'local'>('local')
  const [warning, setWarning] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const autoRan = useRef(false)

  useEffect(() => {
    if (!open) {
      setPhase('input')
      setParsed(null)
      setError('')
      setWarning('')
      autoRan.current = false
      return
    }
    setText(initialText)
    if (initialText && autoSubmit && !autoRan.current) {
      autoRan.current = true
      void runParse(initialText, autoSave)
    } else {
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [open, initialText, autoSubmit, autoSave])

  const runParse = async (raw: string, saveImmediately = false) => {
    setError('')
    setPhase('parsing')
    try {
      const { result, source: src, warning: warn } = await parseExpenseText(raw)
      if (saveImmediately) {
        setPhase('saving')
        await onSave(parsedToTxnPayload(result))
        onToast(`Saved · ${result.note || result.category}`)
        onClose()
        return
      }
      setParsed(result)
      setSource(src)
      setWarning(warn || '')
      setPhase('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Parse failed')
      setPhase('input')
    }
  }

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (phase === 'preview' && parsed) {
      setPhase('saving')
      try {
        await onSave(parsedToTxnPayload(parsed))
        onToast('Saved')
        onClose()
      } catch {
        setError('Could not save')
        setPhase('preview')
      }
      return
    }
    await runParse(trimmed)
  }

  const handleSaveNow = async () => {
    if (!parsed) return
    setPhase('saving')
    try {
      await onSave(parsedToTxnPayload(parsed))
      onToast('Saved')
      onClose()
    } catch {
      setError('Could not save')
      setPhase('preview')
    }
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-md sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="glass w-full max-w-lg rounded-t-3xl border border-line p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="font-display text-lg font-bold tracking-tight">Add expense</div>
              <div className="text-xs text-muted">Type in plain English</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-muted hover:text-fg"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {phase === 'input' && (
            <>
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder='e.g. "spent ₹50 at Starbucks today" or "₹200 for Apple Care"'
                rows={3}
                className="w-full resize-none rounded-2xl border border-line bg-white/4 px-4 py-3 text-[15px] outline-none ring-accent focus:ring-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSubmit()
                  }
                }}
              />
              {error && <p className="mt-2 text-sm text-bad">{error}</p>}
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!text.trim()}
                className="btn-primary mt-4 w-full"
              >
                Parse & preview
              </button>
            </>
          )}

          {(phase === 'parsing' || phase === 'saving') && (
            <div className="flex flex-col items-center gap-4 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="text-sm text-muted">
                {phase === 'parsing' ? 'Understanding your expense…' : 'Saving…'}
              </p>
            </div>
          )}

          {phase === 'preview' && parsed && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-white/4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="metric-value text-3xl">{fmtAmt(parsed.amount)}</div>
                    <div className="mt-1 text-sm text-muted">{parsed.note || 'Expense'}</div>
                  </div>
                  <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
                    {catInfo(parsed.category).i} {parsed.category}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide">Date</span>
                    {fmtDate(parsed.date)}
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wide">Payment</span>
                    {parsed.payment}
                  </div>
                  {parsed.location && (
                    <div className="col-span-2">
                      <span className="block text-[10px] uppercase tracking-wide">Location</span>
                      {parsed.location}
                    </div>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  'rounded-xl px-3 py-2 text-xs',
                  source === 'ai'
                    ? 'flex items-center gap-2 bg-accent/12 text-accent'
                    : warning
                      ? 'parse-warn-banner'
                      : 'flex items-center gap-2 bg-white/5 text-muted',
                )}
              >
                {source === 'ai' ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Parsed with AI
                  </>
                ) : warning ? (
                  warning
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Parsed locally — add Gemini key in Setup for smarter parsing
                  </>
                )}
              </div>

              {error && <p className="text-sm text-bad">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost flex-1"
                  onClick={() => {
                    setPhase('input')
                    setParsed(null)
                  }}
                >
                  Edit text
                </button>
                <button type="button" className="btn-primary flex-[2]" onClick={() => void handleSaveNow()}>
                  Save expense
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
