import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseCSV } from '@/lib/csv'
import {
  currentMonthKey,
  genId,
  isSpendCat,
  monthKey,
  normDate,
  today,
} from '@/lib/dates'
import {
  DEFAULT_SHEET_URL,
  normCat,
  parseTags,
  type Goal,
  type Recurring,
  type ThemePref,
  type Txn,
} from '@/lib/types'
import { fingerprint } from '@/lib/utils'
import {
  backendAppendExpense,
  backendDeleteExpense,
  backendFetchRows,
  backendUpdateExpense,
  sheetRowToTxn,
  usePythonBackend,
} from '@/lib/backend'

type SyncState = 'local' | 'ok' | 'err' | 'syncing'
type CatBudgets = Record<string, number>
type MoodLog = Record<string, number>

function loadTxns(): Txn[] {
  try {
    const raw = JSON.parse(localStorage.getItem('vyaya_txns') || '[]') as Txn[]
    let migrated = false
    const next = raw.map((t) => {
      const date = normDate(t.date)
      const id = t.id || genId()
      if (date !== t.date || !t.id) migrated = true
      return {
        ...t,
        id,
        date,
        tags: t.tags || [],
        split: t.split || 1,
        paidCount: t.paidCount || 0,
      }
    })
    if (migrated) {
      try {
        localStorage.setItem('vyaya_txns', JSON.stringify(next))
      } catch {
        /* quota */
      }
    }
    return next
  } catch {
    return []
  }
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writePending(n: number) {
  try {
    localStorage.setItem('vyaya_pending', String(Math.max(0, n)))
  } catch {
    /* quota */
  }
}

function sortTxns(list: Txn[]) {
  return [...list].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
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
      merged.push({
        ...r,
        id: hit.id || r.id,
        originalAmount: hit.originalAmount,
        originalCurrency: hit.originalCurrency,
        recurring: hit.recurring,
        pending: false,
      })
    } else {
      merged.push({ ...r, pending: false })
    }
  })

  local.forEach((t) => {
    if (matched.has(t.id)) return
    const hitRemote = remote.some((r) => r.id === t.id || fingerprint(r) === fingerprint(t))
    if (!hitRemote) merged.push(t)
  })

  return sortTxns(merged)
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
    tags: parseTags(r.Tags || r.Note || ''),
    location: r.Location || '',
    pending: false,
  }
}

function txnImportKey(t: Pick<Txn, 'date' | 'time' | 'amount' | 'category'>) {
  return `${t.date}|${t.time}|${t.amount}|${t.category}`
}

export function useExpenses() {
  const [txns, setTxns] = useState<Txn[]>(() => loadTxns())
  const [budget, setBudgetState] = useState(
    () => parseFloat(localStorage.getItem('vyaya_budget') || '0') || 0,
  )
  const [catBudgets, setCatBudgetsState] = useState<CatBudgets>(
    () => loadJson<CatBudgets>('vyaya_cat_budgets', {}),
  )
  const [recurring, setRecurringState] = useState<Recurring[]>(
    () => loadJson<Recurring[]>('vyaya_recurring', []),
  )
  const [goals, setGoalsState] = useState<Goal[]>(() => loadJson<Goal[]>('vyaya_goals', []))
  const [moodLog, setMoodLogState] = useState<MoodLog>(() => loadJson<MoodLog>('vyaya_mood', {}))
  const [themePref, setThemePrefState] = useState<ThemePref>(
    () => (localStorage.getItem('vyaya_theme') as ThemePref) || 'dark',
  )
  const [sheetUrl, setSheetUrlState] = useState(
    () => localStorage.getItem('vyaya_url') || DEFAULT_SHEET_URL,
  )
  const [syncState, setSyncState] = useState<SyncState>('local')
  const [lastSync, setLastSync] = useState('')
  const [booting, setBooting] = useState(true)
  const [settingsSyncLbl, setSettingsSyncLbl] = useState('')

  const txnsRef = useRef(txns)
  const sheetUrlRef = useRef(sheetUrl)
  const budgetRef = useRef(budget)
  const catBudgetsRef = useRef(catBudgets)
  const goalsRef = useRef(goals)
  const recurringRef = useRef(recurring)

  useEffect(() => {
    txnsRef.current = txns
  }, [txns])
  useEffect(() => {
    sheetUrlRef.current = sheetUrl
  }, [sheetUrl])
  useEffect(() => {
    budgetRef.current = budget
  }, [budget])
  useEffect(() => {
    catBudgetsRef.current = catBudgets
  }, [catBudgets])
  useEffect(() => {
    goalsRef.current = goals
  }, [goals])
  useEffect(() => {
    recurringRef.current = recurring
  }, [recurring])

  const persist = useCallback((next: Txn[]) => {
    const sorted = sortTxns(next)
    setTxns(sorted)
    txnsRef.current = sorted
    const pendingN = sorted.filter((t) => t.pending).length
    writePending(pendingN)
    try {
      localStorage.setItem('vyaya_txns', JSON.stringify(sorted))
    } catch {
      /* quota */
    }
  }, [])

  const saveCatBudgets = useCallback((next: CatBudgets) => {
    setCatBudgetsState(next)
    catBudgetsRef.current = next
    localStorage.setItem('vyaya_cat_budgets', JSON.stringify(next))
  }, [])

  const saveRecurring = useCallback((next: Recurring[]) => {
    setRecurringState(next)
    recurringRef.current = next
    localStorage.setItem('vyaya_recurring', JSON.stringify(next))
  }, [])

  const saveGoals = useCallback((next: Goal[]) => {
    setGoalsState(next)
    goalsRef.current = next
    localStorage.setItem('vyaya_goals', JSON.stringify(next))
  }, [])

  const syncTxn = useCallback(async (action: string, t: Txn, oldKey?: string) => {
    if (usePythonBackend()) {
      try {
        const payload = {
          id: t.id,
          date: t.date,
          time: t.time,
          category: t.category,
          amount: t.amount,
          payment: t.payment,
          note: t.note || '',
          split: t.split || 1,
          paid_count: t.paidCount || 0,
          location: t.location || '',
          tags: t.tags || [],
        }
        if (action === 'append') {
          await backendAppendExpense(payload)
          return true
        }
        if (action === 'update') {
          await backendUpdateExpense(payload)
          return true
        }
        if (action === 'delete') {
          await backendDeleteExpense(payload)
          return true
        }
      } catch {
        return false
      }
    }

    const url = sheetUrlRef.current
    if (!url) return false
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
      const res = await fetch(url, { method: 'POST', body: JSON.stringify(body) })
      return res.ok
    } catch {
      return false
    }
  }, [])

  const pushSettings = useCallback(async () => {
    const url = sheetUrlRef.current
    if (!url) return false
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
          action: 'writeSettings',
          settings: {
            monthly_budget: budgetRef.current,
            cat_budgets: catBudgetsRef.current,
            goals: goalsRef.current,
            recurring: recurringRef.current,
          },
        }),
      })
      return res.ok
    } catch {
      return false
    }
  }, [])

  const applyRemoteSettings = useCallback((s: Record<string, unknown>) => {
    if (s.monthly_budget !== undefined) {
      const n = parseFloat(String(s.monthly_budget)) || 0
      setBudgetState(n)
      budgetRef.current = n
      localStorage.setItem('vyaya_budget', String(n))
    }
    if (s.cat_budgets && typeof s.cat_budgets === 'object') {
      const next = s.cat_budgets as CatBudgets
      saveCatBudgets(next)
    }
    if (Array.isArray(s.goals)) {
      saveGoals(s.goals as Goal[])
    }
    if (Array.isArray(s.recurring)) {
      saveRecurring(s.recurring as Recurring[])
    }
  }, [saveCatBudgets, saveGoals, saveRecurring])

  const pullSettings = useCallback(async () => {
    const url = sheetUrlRef.current
    if (!url) return false
    try {
      const res = await fetch(`${url}?action=readSettings`)
      const data = await res.json()
      if (data.error || !data.settings) return false
      applyRemoteSettings(data.settings as Record<string, unknown>)
      const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setSettingsSyncLbl(`Settings synced ${ts}`)
      return true
    } catch {
      return false
    }
  }, [applyRemoteSettings])

  const syncAll = useCallback(async () => {
    if (usePythonBackend()) {
      setSyncState('syncing')
      try {
        const { rows } = await backendFetchRows()
        const remote = rows.map(sheetRowToTxn).filter((t) => t.amount > 0 && t.date)
        if (remote.length) {
          const merged = mergeRemote(txnsRef.current, remote as Txn[])
          persist(merged)
        }
        const t = new Date().toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
        })
        setSyncState('ok')
        setLastSync(t)
        return 'ok'
      } catch {
        setSyncState('err')
        return 'err'
      }
    }

    const url = sheetUrlRef.current
    if (!url) return 'no-url'
    setSyncState('syncing')
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 12000)
    try {
      const [txnRes, settRes] = await Promise.all([
        fetch(`${url}?action=read`, { signal: ctrl.signal }),
        fetch(`${url}?action=readSettings`, { signal: ctrl.signal }),
      ])
      clearTimeout(timeout)

      const txnData = await txnRes.json()
      if (txnData.error) throw new Error(txnData.error)
      const remote = ((txnData.rows || []) as Record<string, string>[])
        .map(mapRemoteRow)
        .filter(Boolean) as Txn[]
      if (remote.length) {
        const merged = mergeRemote(txnsRef.current, remote)
        persist(merged)
      }

      try {
        const settData = await settRes.json()
        if (!settData.error && settData.settings) {
          applyRemoteSettings(settData.settings as Record<string, unknown>)
          const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          setSettingsSyncLbl(`Settings synced ${ts}`)
        }
      } catch {
        /* settings optional */
      }

      const t = new Date().toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
      })
      setSyncState('ok')
      setLastSync(t)
      return 'ok'
    } catch {
      clearTimeout(timeout)
      setSyncState('err')
      return 'err'
    }
  }, [applyRemoteSettings, persist])

  const setBudget = useCallback(
    (n: number) => {
      setBudgetState(n)
      budgetRef.current = n
      localStorage.setItem('vyaya_budget', String(n))
      void pushSettings()
    },
    [pushSettings],
  )

  const setCatBudgets = useCallback(
    (next: CatBudgets) => {
      saveCatBudgets(next)
      void pushSettings()
    },
    [pushSettings, saveCatBudgets],
  )

  const setCatBudget = useCallback(
    (cat: string, n: number) => {
      const next = { ...catBudgetsRef.current, [cat]: n }
      if (!n) {
        delete next[cat]
      }
      saveCatBudgets(next)
      void pushSettings()
    },
    [pushSettings, saveCatBudgets],
  )

  const setSheetUrl = useCallback((url: string) => {
    setSheetUrlState(url)
    sheetUrlRef.current = url
    localStorage.setItem('vyaya_url', url)
  }, [])

  const setThemePref = useCallback((pref: ThemePref) => {
    setThemePrefState(pref)
    localStorage.setItem('vyaya_theme', pref)
  }, [])

  const setGoals = useCallback(
    (next: Goal[]) => {
      saveGoals(next)
      void pushSettings()
    },
    [pushSettings, saveGoals],
  )

  const addGoal = useCallback(
    (partial: Omit<Goal, 'id' | 'saved'> & { id?: string; saved?: number }) => {
      const g: Goal = {
        id: partial.id || genId(),
        name: partial.name,
        target: partial.target,
        saved: partial.saved || 0,
      }
      saveGoals([...goalsRef.current, g])
      void pushSettings()
      return g
    },
    [pushSettings, saveGoals],
  )

  const addToGoal = useCallback(
    (id: string, amt: number) => {
      if (!amt) return
      saveGoals(
        goalsRef.current.map((g) =>
          g.id === id ? { ...g, saved: (g.saved || 0) + amt } : g,
        ),
      )
      void pushSettings()
    },
    [pushSettings, saveGoals],
  )

  const removeGoal = useCallback(
    (id: string) => {
      saveGoals(goalsRef.current.filter((g) => g.id !== id))
      void pushSettings()
    },
    [pushSettings, saveGoals],
  )

  const setRecurring = useCallback(
    (next: Recurring[]) => {
      saveRecurring(next)
      void pushSettings()
    },
    [pushSettings, saveRecurring],
  )

  const addRecurring = useCallback(
    (partial: Omit<Recurring, 'id'> & { id?: string }) => {
      const r: Recurring = { ...partial, id: partial.id || genId() }
      saveRecurring([...recurringRef.current, r])
      void pushSettings()
      return r
    },
    [pushSettings, saveRecurring],
  )

  const updateRecurring = useCallback(
    (id: string, patch: Partial<Recurring>) => {
      saveRecurring(
        recurringRef.current.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      )
      void pushSettings()
    },
    [pushSettings, saveRecurring],
  )

  const removeRecurring = useCallback(
    (id: string) => {
      saveRecurring(recurringRef.current.filter((r) => r.id !== id))
      void pushSettings()
    },
    [pushSettings, saveRecurring],
  )

  const markRecurringLogged = useCallback(
    (id: string, date: string) => {
      saveRecurring(
        recurringRef.current.map((r) =>
          r.id === id ? { ...r, lastLogged: date } : r,
        ),
      )
      void pushSettings()
    },
    [pushSettings, saveRecurring],
  )

  const setMood = useCallback(
    (date: string, rating: number) => {
      setMoodLogState((prev) => {
        const next = { ...prev, [date]: rating }
        localStorage.setItem('vyaya_mood', JSON.stringify(next))
        return next
      })
    },
    [],
  )

  const addTxn = useCallback(
    async (partial: Omit<Txn, 'id' | 'pending'> & { id?: string; pending?: boolean }) => {
      const hasSync = usePythonBackend() || sheetUrlRef.current
      const t: Txn = {
        ...partial,
        id: partial.id || genId(),
        tags: partial.tags || [],
        split: partial.split || 1,
        paidCount: partial.paidCount || 0,
        pending: partial.pending ?? !!hasSync,
      }
      persist([t, ...txnsRef.current])
      if (hasSync) {
        const ok = await syncTxn('append', t)
        if (ok) {
          const cleared = txnsRef.current.map((x) =>
            x.id === t.id ? { ...x, pending: false } : x,
          )
          persist(cleared)
          return { ...t, pending: false }
        }
      }
      return t
    },
    [persist, syncTxn],
  )

  const updateTxn = useCallback(
    async (id: string, patch: Partial<Txn>) => {
      const prev = txnsRef.current.find((t) => t.id === id)
      if (!prev) return
      const next = { ...prev, ...patch }
      const oldKey = `${prev.date}|${prev.time}|${Math.round(prev.amount)}|${prev.category}`
      persist(txnsRef.current.map((t) => (t.id === id ? next : t)))
      if (sheetUrlRef.current) await syncTxn('update', next, oldKey)
    },
    [persist, syncTxn],
  )

  /** Immediate local delete; returns deleted txn (and index) for undo. Call syncDelete later. */
  const deleteTxn = useCallback(
    (id: string): { txn: Txn; index: number } | null => {
      const index = txnsRef.current.findIndex((x) => x.id === id)
      if (index === -1) return null
      const txn = txnsRef.current[index]
      persist(txnsRef.current.filter((x) => x.id !== id))
      return { txn, index }
    },
    [persist],
  )

  const syncDelete = useCallback(
    async (t: Txn) => {
      if (!sheetUrlRef.current) return false
      return syncTxn('delete', t)
    },
    [syncTxn],
  )

  const restoreTxn = useCallback(
    (t: Txn, index?: number) => {
      const list = [...txnsRef.current]
      if (list.some((x) => x.id === t.id)) return
      if (typeof index === 'number' && index >= 0 && index <= list.length) {
        list.splice(index, 0, t)
        persist(list)
      } else {
        persist([t, ...list])
      }
    },
    [persist],
  )

  const settle = useCallback(
    (id: string, delta: number) => {
      const t = txnsRef.current.find((x) => x.id === id)
      if (!t) return
      const paidCount = Math.max(0, Math.min(t.split - 1, (t.paidCount || 0) + delta))
      const next = { ...t, paidCount }
      persist(txnsRef.current.map((x) => (x.id === id ? next : x)))
      if (sheetUrlRef.current) void syncTxn('update', next)
    },
    [persist, syncTxn],
  )

  const settleAll = useCallback(
    (id: string) => {
      const t = txnsRef.current.find((x) => x.id === id)
      if (!t) return
      const next = { ...t, paidCount: Math.max(0, t.split - 1) }
      persist(txnsRef.current.map((x) => (x.id === id ? next : x)))
      if (sheetUrlRef.current) void syncTxn('update', next)
    },
    [persist, syncTxn],
  )

  const importRows = useCallback(
    (rows: Txn[]) => {
      if (!rows.length) return 0
      const existing = new Set(txnsRef.current.map(txnImportKey))
      let added = 0
      const next = [...txnsRef.current]
      rows.forEach((r) => {
        const key = txnImportKey(r)
        if (existing.has(key)) return
        next.push({
          ...r,
          id: r.id || genId(),
          date: normDate(r.date),
          tags: r.tags || [],
          split: r.split || 1,
          paidCount: r.paidCount || 0,
          pending: false,
        })
        existing.add(key)
        added++
      })
      if (added) persist(next)
      return added
    },
    [persist],
  )

  const clearAllData = useCallback(() => {
    persist([])
    writePending(0)
  }, [persist])

  const autoLoadCSV = useCallback(async () => {
    if (txnsRef.current.length > 0) return false
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}vyaya-vg.csv`)
      if (!res.ok) return false
      const text = await res.text()
      const rows = parseCSV(text)
      if (!rows.length) return false
      persist(rows)
      return true
    } catch {
      return false
    }
  }, [persist])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        localStorage.setItem('vyaya_data_ver', '2')
      } catch {
        /* ignore */
      }
      if (sheetUrlRef.current) {
        await syncAll()
      }
      if (!cancelled && txnsRef.current.length === 0) {
        await autoLoadCSV()
      }
      if (!cancelled) setBooting(false)
    })()
    return () => {
      cancelled = true
    }
    // Boot once on mount
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
    catBudgets,
    recurring,
    goals,
    moodLog,
    themePref,
    sheetUrl,
    syncState,
    lastSync,
    booting,
    settingsSyncLbl,
    setBudget,
    setCatBudgets,
    setCatBudget,
    setSheetUrl,
    setThemePref,
    setGoals,
    addGoal,
    addToGoal,
    removeGoal,
    setRecurring,
    addRecurring,
    updateRecurring,
    removeRecurring,
    markRecurringLogged,
    setMood,
    addTxn,
    updateTxn,
    deleteTxn,
    syncDelete,
    restoreTxn,
    settle,
    settleAll,
    persist,
    syncTxn,
    pushSettings,
    pullSettings,
    syncAll,
    importRows,
    clearAllData,
    autoLoadCSV,
    monthSpend,
    todaySpend,
    pending,
  }
}

export type UseExpensesReturn = ReturnType<typeof useExpenses>
