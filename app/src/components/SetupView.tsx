import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import {
  backendHealth,
  getBackendSecret,
  getBackendUrl,
  setBackendSecret,
  setBackendUrl,
  usePythonBackend,
} from '@/lib/backend'
import { getOpenAIKey, setOpenAIKey } from '@/lib/ai-parse'
import { parseCSV } from '@/lib/csv'
import type { UseExpensesReturn } from '@/hooks/useExpenses'

export function SetupView({
  api,
  showToast,
}: {
  api: UseExpensesReturn
  showToast: (msg: string, type?: string) => void
}) {
  const [backendUrl, setBackendUrlState] = useState(getBackendUrl())
  const [backendSecret, setBackendSecretState] = useState(getBackendSecret())
  const [apiKey, setApiKey] = useState(getOpenAIKey())
  const [showKey, setShowKey] = useState(false)
  const [url, setUrl] = useState(api.sheetUrl)
  const pythonMode = usePythonBackend()

  const saveBackend = async () => {
    setBackendUrl(backendUrl)
    setBackendSecret(backendSecret)
    if (backendUrl.trim()) {
      try {
        const h = await backendHealth()
        showToast(
          h.sheets ? 'Python API connected' : 'API up — check Sheets config on server',
          h.sheets ? 'ok' : 'info',
        )
        void api.syncAll()
      } catch {
        showToast('Could not reach Python API', 'err')
      }
    } else {
      showToast('Python API removed — using Apps Script fallback')
    }
  }

  const saveKey = () => {
    setOpenAIKey(apiKey)
    showToast(apiKey ? 'OpenAI key saved (browser mode)' : 'OpenAI key removed')
  }

  return (
    <div className="space-y-5">
      <section className="card border-2 border-fg/10 p-5">
        <h2 className="text-sm font-semibold">Python backend (recommended)</h2>
        <p className="mt-1 text-xs text-muted">
          Deploy the FastAPI server in <code className="text-[10px]">api/</code>. Python handles AI parsing and
          Google Sheets — your API keys stay on the server, not in the browser.
        </p>
        <input
          value={backendUrl}
          onChange={(e) => setBackendUrlState(e.target.value)}
          placeholder="https://your-api.onrender.com"
          className="mt-3 w-full rounded-2xl border border-line bg-canvas px-4 py-2.5 text-sm outline-none"
        />
        <input
          value={backendSecret}
          onChange={(e) => setBackendSecretState(e.target.value)}
          placeholder="API secret (optional, matches VYAYA_API_SECRET)"
          className="mt-2 w-full rounded-2xl border border-line bg-canvas px-4 py-2.5 text-sm outline-none"
          type="password"
          autoComplete="off"
        />
        <button type="button" className="btn-primary mt-3 w-full" onClick={() => void saveBackend()}>
          Save Python API
        </button>
        {pythonMode && (
          <p className="mt-2 text-xs text-good">✓ Using Python for parse + Sheets sync</p>
        )}
      </section>

      {!pythonMode && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold">AI parsing (browser fallback)</h2>
          <p className="mt-1 text-xs text-muted">
            Only needed if you are not using the Python backend. Key is stored on this device.
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
        </section>
      )}

      <section className="card p-5">
        <h2 className="text-sm font-semibold">iPhone Shortcut</h2>
        <p className="mt-1 text-xs text-muted">
          Back-tap → Ask for Input → Open URL with encoded text:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-canvas p-3 text-[10px] leading-relaxed text-muted">
          {`https://vamshiganesh98.github.io/vyaya.vg/?q=[your text]`}
        </pre>
        {pythonMode && (
          <p className="mt-2 text-[11px] text-muted">
            Or call Python directly: POST {backendUrl}/api/expenses/quick with JSON{' '}
            <code className="text-[10px]">{`{"text":"..."}`}</code>
          </p>
        )}
      </section>

      {!pythonMode && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold">Google Sheets (Apps Script fallback)</h2>
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
      )}

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
        <p className="mt-2 text-xs text-muted">
          {api.txns.length} transactions · sync {api.syncState}
          {pythonMode ? ' · python' : ''}
        </p>
      </section>
    </div>
  )
}
