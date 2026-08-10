import { useState, type ReactNode } from 'react'
import { Cloud, Key, Smartphone, Sparkles } from 'lucide-react'
import { getGeminiKey, setGeminiKey } from '@/lib/ai-parse'
import { parseCSV } from '@/lib/csv'
import type { UseExpensesReturn } from '@/hooks/useExpenses'

const SHORTCUT_URL = 'https://vamshiganesh98.github.io/vyaya.vg/?q='

function StepCard({
  step,
  icon: Icon,
  title,
  children,
}: {
  step: number
  icon: typeof Key
  title: string
  children: ReactNode
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-white/[0.02] px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 font-display text-sm font-bold text-accent">
          {step}
        </div>
        <Icon className="h-4 w-4 text-accent" />
        <h2 className="font-display text-sm font-bold">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function SetupView({
  api,
  showToast,
}: {
  api: UseExpensesReturn
  showToast: (msg: string, type?: string) => void
}) {
  const [apiKey, setApiKey] = useState(getGeminiKey())
  const [showKey, setShowKey] = useState(false)
  const [url, setUrl] = useState(api.sheetUrl)

  const saveKey = () => {
    setGeminiKey(apiKey)
    showToast(apiKey ? 'Gemini key saved' : 'Gemini key removed')
  }

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
      <div className="card-glow p-5 lg:col-span-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <h2 className="font-display text-lg font-bold">Setup guide</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Everything runs on <strong className="text-fg">github.io</strong> — no server needed. Expenses save locally,
          then sync to Google Sheets via Apps Script.
        </p>
      </div>

      <StepCard step={1} icon={Key} title="AI parsing (Gemini)">
        <p className="text-xs text-muted">
          Free Google Gemini key for plain English like &quot;spent ₹50 at Starbucks&quot;.{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            Get a free key
          </a>
        </p>
        <div className="relative mt-3">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza…"
            className="w-full rounded-2xl border border-line bg-white/4 py-2.5 pl-4 pr-16 text-sm outline-none focus:ring-2 focus:ring-accent/30"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted"
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <button type="button" className="btn-primary mt-3 w-full" onClick={saveKey}>
          Save API key
        </button>
      </StepCard>

      <StepCard step={2} icon={Cloud} title="Google Sheets sync">
        <p className="text-xs text-muted">
          Deploy <code className="text-[10px] text-accent">google-apps-script.js</code> to your sheet.
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted">
          <li>Paste the latest script → save</li>
          <li>
            Run <code className="text-accent">authorizeVyayaOnce</code> → Allow
          </li>
          <li>Deploy: Execute as <strong className="text-fg">Me</strong>, access <strong className="text-fg">Anyone</strong></li>
          <li>Deploy → New version</li>
        </ol>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Apps Script web app URL"
          className="mt-3 w-full rounded-2xl border border-line bg-white/4 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/30"
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
          <button
            type="button"
            className="btn-ghost"
            onClick={async () => {
              const base = url.trim().replace(/\/$/, '')
              if (!base) {
                showToast('Paste Apps Script URL first', 'err')
                return
              }
              try {
                const sep = base.includes('?') ? '&' : '?'
                const res = await fetch(`${base}${sep}action=pingExternal`)
                const data = await res.json()
                if (data.ok) showToast('AI permission OK')
                else showToast(data.fix || data.error || 'Permission failed', 'err')
              } catch {
                showToast('Could not reach Apps Script', 'err')
              }
            }}
          >
            Test permission
          </button>
        </div>
      </StepCard>

      <StepCard step={3} icon={Smartphone} title="iPhone Back Tap shortcut">
        <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted">
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
        <pre className="mt-3 overflow-x-auto rounded-xl bg-white/4 p-3 text-[10px] leading-relaxed text-muted">
          {`${SHORTCUT_URL}[URL Encoded Text]`}
        </pre>
      </StepCard>

      <section className="card p-5 lg:col-span-2">
        <h2 className="font-display text-sm font-bold">Data</h2>
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
        <p className="mt-3 text-xs text-muted">
          {api.txns.length} transactions · sync {api.syncState}
        </p>
      </section>
    </div>
  )
}
