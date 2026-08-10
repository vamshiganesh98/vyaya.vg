import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { getOpenAIKey, setOpenAIKey } from '@/lib/ai-parse'
import { parseCSV } from '@/lib/csv'
import type { UseExpensesReturn } from '@/hooks/useExpenses'

const SHORTCUT_URL = 'https://vamshiganesh98.github.io/vyaya.vg/?q='

export function SetupView({
  api,
  showToast,
}: {
  api: UseExpensesReturn
  showToast: (msg: string, type?: string) => void
}) {
  const [apiKey, setApiKey] = useState(getOpenAIKey())
  const [showKey, setShowKey] = useState(false)
  const [url, setUrl] = useState(api.sheetUrl)

  const saveKey = () => {
    setOpenAIKey(apiKey)
    showToast(apiKey ? 'OpenAI key saved' : 'OpenAI key removed')
  }

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h2 className="text-sm font-semibold">How it works (GitHub Pages)</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Everything runs in your browser on <strong className="text-fg">github.io</strong> — no Python server.
          Expenses save locally, then sync to Google Sheets via Apps Script.
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs text-muted">
          <li>Add OpenAI key below (optional, for smart parsing)</li>
          <li>Paste your Apps Script URL under Google Sheets</li>
          <li>Set up the iPhone Shortcut (Back Tap → type expense → open URL)</li>
        </ol>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">1. AI parsing</h2>
        <p className="mt-1 text-xs text-muted">
          OpenAI key for plain English like &quot;spent ₹50 at Starbucks&quot;. Stored only on this device.
        </p>
        <div className="relative mt-3">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            className="w-full rounded-2xl border border-line bg-canvas py-2.5 pl-4 pr-10 text-sm outline-none"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            aria-label={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <button type="button" className="btn-primary mt-3 w-full" onClick={saveKey}>
          Save API key
        </button>
        <p className="mt-2 text-[11px] text-muted">
          No key? Basic parsing still works: &quot;spent 50 at cafe&quot;.
        </p>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">2. Google Sheets sync</h2>
        <p className="mt-1 text-xs text-muted">
          Deploy <code className="text-[10px]">google-apps-script.js</code> to your sheet (Extensions → Apps Script).
        </p>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Apps Script web app URL"
          className="mt-3 w-full rounded-2xl border border-line bg-canvas px-4 py-2.5 text-sm outline-none"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              api.setSheetUrl(url.trim())
              const r = await api.syncAll()
              showToast(r === 'ok' ? 'Synced' : 'Sync issue', r === 'ok' ? 'ok' : 'err')
            }}
          >
            Save & sync
          </button>
          <button type="button" className="btn-ghost" onClick={() => void api.pullSettings()}>
            Pull settings
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">3. iPhone Back Tap shortcut</h2>
        <p className="mt-1 text-xs text-muted">Create a Shortcut with these actions:</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs text-muted">
          <li>
            <strong className="text-fg">Ask for Input</strong> — &quot;What did you spend?&quot;
          </li>
          <li>
            <strong className="text-fg">URL Encode</strong> the input
          </li>
          <li>
            <strong className="text-fg">Open URL</strong>:
          </li>
        </ol>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-canvas p-3 text-[10px] leading-relaxed text-muted">
          {`${SHORTCUT_URL}[URL Encoded Text]`}
        </pre>
        <p className="mt-2 text-[11px] text-muted">
          The app parses your text, saves it, and syncs to Sheets automatically — then shows Spend tab.
        </p>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold">Data</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="btn-ghost cursor-pointer">
            Import CSV
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const text = await file.text()
                const rows = parseCSV(text)
                const n = api.importRows(rows)
                showToast(`Imported ${n} rows`)
              }}
            />
          </label>
          <button
            type="button"
            className="btn-ghost text-bad"
            onClick={() => {
              if (confirm('Delete all local data?')) {
                api.clearAllData()
                showToast('Cleared')
              }
            }}
          >
            Clear all
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">{api.txns.length} transactions · sync {api.syncState}</p>
      </section>
    </div>
  )
}
