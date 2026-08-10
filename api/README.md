# Vyaya.vg Python API

FastAPI backend that handles **AI expense parsing** and **Google Sheets** storage. Your React UI (GitHub Pages) talks to this API; secrets stay on the server.

## Architecture

```
iPhone Shortcut → vyaya.vg (React UI) → Python API → OpenAI + Google Sheets
                      ↑ local cache              ↑ all backend logic
```

## Setup

### 1. Google Sheets service account

1. [Google Cloud Console](https://console.cloud.google.com/) → create project → enable **Google Sheets API**
2. IAM → Service Accounts → Create → download JSON key
3. Open your expense Google Sheet → **Share** with the service account email (Editor)

### 2. Environment

```bash
cd api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your keys
```

### 3. Run locally

```bash
uvicorn main:app --reload --port 8000
```

Health check: http://localhost:8000/health

### 4. Deploy (Railway / Render / Fly.io)

- Set the same env vars from `.env.example`
- For `GOOGLE_SERVICE_ACCOUNT_JSON`, paste the full JSON as one line
- Note your public URL, e.g. `https://vyaya-api.onrender.com`

### 5. Connect the app

In **vyaya.vg → Setup**:

- **Python API URL**: `https://your-api.example.com`
- **API secret**: same as `VYAYA_API_SECRET` (if set)

The UI will parse and sync through Python instead of calling OpenAI / Apps Script from the browser.

## iPhone Shortcut (one-shot)

Call the quick-add endpoint directly (no UI needed):

```
POST https://your-api.example.com/api/expenses/quick
Authorization: Bearer YOUR_SECRET
Content-Type: application/json

{"text": "spent 50 at Starbucks today"}
```

Or keep opening the website with `?q=spent+50+at+Starbucks` — the UI will forward to Python when configured.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Status |
| POST | `/api/parse` | Parse text only |
| POST | `/api/expenses/quick` | Parse + save to Sheets |
| GET | `/api/expenses` | Read all rows |
| POST | `/api/expenses` | Append structured expense |
| PUT | `/api/expenses` | Update |
| DELETE | `/api/expenses` | Delete |
