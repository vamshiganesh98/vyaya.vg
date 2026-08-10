import { genId, normDate } from '@/lib/dates'
import { normCat, parseTags, type Txn } from '@/lib/types'

function parseCSVLine(line: string) {
  const cols: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQ = !inQ
      continue
    }
    if (c === ',' && !inQ) {
      cols.push(cur.trim())
      cur = ''
      continue
    }
    cur += c
  }
  cols.push(cur.trim())
  return cols
}

export function parseCSV(text: string): Txn[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const header = parseCSVLine(lines[0]).map((h) => h.trim())
  const rows: Txn[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = parseCSVLine(line)
    const obj: Record<string, string> = {}
    header.forEach((h, j) => {
      obj[h] = (cols[j] || '').trim()
    })
    const amt = parseFloat((obj.Amount || '0').replace(/,/g, ''))
    if (!obj.Date || isNaN(amt) || amt <= 0) continue
    rows.push({
      id: obj.Id || obj.ID || genId(),
      date: normDate(obj.Date),
      time: obj.Time || '00:00',
      category: normCat(obj.Category || 'Others'),
      amount: amt,
      payment: obj['Mode of Payment'] || 'UPI',
      note: obj.Note || '',
      split: parseInt(obj.Split || '1', 10) || 1,
      paidCount: parseInt(obj.Paid || '0', 10) || 0,
      tags: parseTags(obj.Tags || obj.Note || ''),
      location: obj.Location || '',
      pending: false,
    })
  }
  return rows
}

export function exportCSV(txns: Txn[]) {
  const header = 'Id,Date,Time,Category,Amount,Mode of Payment,Note,Split,Paid,Tags,Location'
  const lines = txns.map((t) =>
    [
      t.id,
      t.date,
      t.time,
      t.category,
      Math.round(t.amount),
      t.payment,
      `"${(t.note || '').replace(/"/g, '""')}"`,
      t.split || 1,
      t.paidCount || 0,
      `"${(t.tags || []).join(' ')}"`,
      `"${(t.location || '').replace(/"/g, '""')}"`,
    ].join(','),
  )
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `vyaya-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
