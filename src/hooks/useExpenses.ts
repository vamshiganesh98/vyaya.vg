import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  currentMonthKey,
  genId,
  isSpendCat,
  monthKey,
  normDate,
  today,
} from '@/lib/utils'
import {
  DEFAULT_SHEET_URL,
  normCat,
  type Txn,
} from '@/lib/types'

function loadTxns(): Txn[] {
  try {
    const raw = JSON.parse(localStorage.getItem('vyaya_txns') || '[]') as Txn[]
    return raw.map((t) => ({
      ...t,
      id: t.id || genId(),
      date: normDate(t.date),
      tags: t.tags || [],
      split: t.split || 1,
      paidCount: t.paidCount || 0,
    }))
  } catch {
    return []
  }
}

function fingerprint(t: Pick<Txn, 'date' | 'time' | 'amount' | 'category' | 'note'>) {
  return [t.date, t.time || '00:00', Math.round(t.amount || 0), t.category || '', (t.note || '').trim().toLowerCase()].join('|')
}

function mergeRemote(local: Txn[], remote: Txn[]) {
  const byId = new Map(local.map((t) => [t.id, t]))
  const byFp = new Map(local.map((t) => [fingerprint(t), t]))
  const merged: Txn[] = []
  const matched = new Set<string>()

  remote.forEach((r) => {
    const hit = (r.id && byId.get(r.id)) || byFp.get(fingerprint(r))
    if (hit) {
      matched.add(hit.id)
      merged.push({ ...r, id: hit.id || r.id, pending: false })
    } else {
      merged.push({ ...r, pending: false })
    }
  })

  local.forEach((t) => {
    if (matched.has(t.id)) return
    const hitRemote = remote.some((r) => r.id === t.id || fingerprint(r) === fingerprint(t))
    if (!hitRemote) merged.push(t)
  })

  return merged.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
}

function mapRemoteRow(r: Record<string, string>): Txn | null {
  const amount = parseFloat(String(r.Amount || '0').replace(/,/g, ''))
  if (!r.Date || !amount || amount <= 0) return null
  return {
    id: r.Id || r.ID || genId(),
    date: normDate(r.Date),
    time: r.Time || '00:00',
    category: normCat(r.Category || 'Others'),
    amount,
    payment: r['Mode of Payment'] || 'UPI',
    note: r.Note || '',
    split: parseInt(r.Split || '1', 10) || 1,
    paidCount: parseInt(r.Paid || '0', 10) || 0,
    tags: (r.Tags || '').match(/#[\w-]+/g) || [],
    location: r.Location || '',
    pending: false,
  }
}

export function useExpenses() {
  const [txns, setTxns] = useState<Txn[]>(() => loadTxns())
  const [budget, setBudgetState] = useState(() => parseFloat(localStorage.getItem('vyaya_budget') || '0') || 0)
  const [sheetUrl, setSheetUrlState] = useState(() => localStorage.getItem('vyaya_url') || DEFAULT_SHEET_URL)
  const [syncState, setSyncState] = useState<'local' | 'ok' | 'err' | 'syncing'>('local')
  const [lastSync, setLastSync] = useState('')
  const [booting, setBooting] = useState(true)

  const persist = useCallback((next: Txn[]) => {
    setTxns(next)
    try {
      localStorage.setItem('vyaya_txns', JSON.stringify(next))
    } catch {
      /* quota */
    }
  }, [])

  const setBudget = useCallback((n: number) => {
    setBudgetState(n)
    localStorage.setItem('vyaya_budget', String(n))
  }, [])

  const setSheetUrl = useCallback((url: string) => {
    setSheetUrlState(url)
    localStorage.setItem('vyaya_url', url)
  }, [])

  const syncTxn = useCallback(async (action: string, t: Txn, oldKey?: string) => {
    if (!sheetUrl) return false
    const body: Record<string, unknown> = {
      action,
      Id: t.id,
      Date: t.date,
      Time: t.time,
      Category: t.category,
      Amount: Math.round(t.amount),
      'Mode of Payment': t.payment,
      Note: t.note || '',
      Split: t.split || 1,
      Paid: t.paidCount || 0,
      Location: t.location || '',
      Tags: (t.tags || []).join(' '),
    }
    if (oldKey) body.oldKey = oldKey
    try {
      const res = await fetch(sheetUrl, { method: 'POST', body: JSON.stringify(body) })
      return res.ok
    } catch {
      return false
    }
  }, [sheetUrl])

  const addTxn = useCallback(async (partial: Omit<Txn, 'id' | 'pending'> & { id?: string }) => {
    const t: Txn = {
      ...partial,
      id: partial.id || genId(),
      pending: !!sheetUrl,
    }
    persist([t, ...txns])
    if (sheetUrl) {
      const ok = await syncTxn('append', t)
      if (ok) {
        const cleared = [ { ...t, pending: false }, ...txns ]
        persist(cleared)
      }
    }
    return t
  }, [persist, sheetUrl, syncTxn, txns])

  const updateTxn = useCallback(async (id: string, patch: Partial<Txn>) => {
    const prev = txns.find((t) => t.id === id)
    if (!prev) return
    const next = { ...prev, ...patch }
    const oldKey = `${prev.date}|${prev.time}|${Math.round(prev.amount)}|${prev.category}`
    persist(txns.map((t) => (t.id === id ? next : t)))
    if (sheetUrl) await syncTxn('update', next, oldKey)
  }, [persist, sheetUrl, syncTxn, txns])

  const deleteTxn = useCallback(async (id: string) => {
    const t = txns.find((x) => x.id === id)
    persist(txns.filter((x) => x.id !== id))
    if (t && sheetUrl) await syncTxn('delete', t)
  }, [persist, sheetUrl, syncTxn, txns])

  const syncAll = useCallback(async () => {
    if (!sheetUrl) return 'no-url'
    setSyncState('syncing')
    try {
      const res = await fetch(`${sheetUrl}?action=read`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const remote = ((data.rows || []) as Record<string, string>[])
        .map(mapRemoteRow)
        .filter(Boolean) as Txn[]
      if (remote.length) {
        const merged = mergeRemote(txns, remote)
        persist(merged)
      }
      setSyncState('ok')
      setLastSync(new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }))
      return 'ok'
    } catch {
      setSyncState('err')
      return 'err'
    }
  }, [persist, sheetUrl, txns])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (sheetUrl) await syncAll()
      if (!cancelled) setBooting(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const monthSpend = useMemo(() => {
    const mk = currentMonthKey()
    return txns
      .filter((t) => monthKey(t.date) === mk && isSpendCat(t.category))
      .reduce((s, t) => s + t.amount, 0)
  }, [txns])

  const todaySpend = useMemo(() => {
    const d = today()
    return txns
      .filter((t) => t.date === d && isSpendCat(t.category))
      .reduce((s, t) => s + t.amount, 0)
  }, [txns])

  const pending = useMemo(() => txns.filter((t) => t.pending).length, [txns])

  return {
    txns,
    budget,
    setBudget,
    sheetUrl,
    setSheetUrl,
    syncState,
    lastSync,
    booting,
    addTxn,
    updateTxn,
    deleteTxn,
    syncAll,
    persist,
    monthSpend,
    todaySpend,
    pending,
  }
}
