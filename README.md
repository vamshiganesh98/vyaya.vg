<div align="center">

```
 ██╗   ██╗██╗   ██╗ █████╗ ██╗   ██╗ █████╗       ██╗   ██╗ ██████╗
 ██║   ██║╚██╗ ██╔╝██╔══██╗╚██╗ ██╔╝██╔══██╗      ██║   ██║██╔════╝
 ██║   ██║ ╚████╔╝ ███████║ ╚████╔╝ ███████║      ██║   ██║██║  ███╗
 ╚██╗ ██╔╝  ╚██╔╝  ██╔══██║  ╚██╔╝  ██╔══██║      ╚██╗ ██╔╝██║   ██║
  ╚████╔╝    ██║   ██║  ██║   ██║   ██║  ██║  ██╗  ╚████╔╝ ╚██████╔╝
   ╚═══╝     ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝  ╚═╝   ╚═══╝   ╚═════╝
```

### **Your money. Your device. Your rules.**

*A personal expense tracker — built for the iPhone, synced via GitHub, signed with intent.*

[![Live App](https://img.shields.io/badge/Live%20App-Vyaya.vg-e8c547?style=for-the-badge&labelColor=0a0a0f)](https://vamshiganesh98.github.io/vyaya.vg/)
[![PWA](https://img.shields.io/badge/PWA-Offline%20Ready-3ddc84?style=for-the-badge&labelColor=0a0a0f)](https://vamshiganesh98.github.io/vyaya.vg/)
[![GitHub Sync](https://img.shields.io/badge/Sync-GitHub%20CSV-5b9cf6?style=for-the-badge&labelColor=0a0a0f)](#-github-sync)

</div>

---

## ₹ What is Vyaya.vg?

**Vyaya** (व्यय) — Sanskrit for *expenditure*. **`.vg`** — my signature.

A personal budgeting app built for one person: me. No accounts, no subscriptions, no servers. Add expenses from your iPhone in seconds via a Back Tap shortcut. Data lives in `localStorage` on your phone and syncs to GitHub as a CSV — readable from any device, forever.

---

## ✦ Features

| | |
|---|---|
| **Splash screen** | Gold `₹` icon loads on every open while data fetches |
| **Offline-first PWA** | Installs on iPhone home screen, works without internet |
| **GitHub CSV sync** | `vyaya-vg.csv` on GitHub is the source of truth — push from phone, read anywhere |
| **localStorage cache** | Phone stores data locally — shows instantly, syncs in background |
| **CSV import** | Tap 📂 to load a `vyaya-vg.csv` from Files app — merges new rows |
| **CSV export** | Month / year / all-time / payment report download |
| **Back Tap shortcut** | Double-tap iPhone back → log expense in 3 taps |
| **8 categories** | Food · Travel & Commute · Q-Commerce · Bills · Investments · Vacation · Shopping · Others |
| **2 payment modes** | UPI · Credit Card |
| **Monthly budget** | Set a limit, track remaining, get warned when over |
| **6-month trend** | Bar chart of last 6 months |
| **Top spend highlight** | Biggest category card on home screen |
| **Payment donut** | UPI vs Credit Card split with donut chart |
| **About tab** | Built-in shortcut setup guide |
| **Dark UI** | Deep dark theme with gold accents |

---

## 🗂 File Structure

```
vyaya.vg/
├── index.html           ← Entire app (single file, no build step)
├── vyaya-vg.csv         ← Expense data — source of truth on GitHub
├── manifest.json        ← PWA manifest
├── sw.js                ← Service worker (offline cache)
├── icon.svg             ← App icon (SVG)
├── apple-touch-icon.png ← iPhone home screen icon (180×180 PNG)
└── README.md
```

---

## 🔄 How Data Flows

```
iPhone (you)                          GitHub
─────────────────────────────────     ─────────────────
Back Tap → add expense
  └─ saves to localStorage instantly
  
📂 Import CSV
  └─ merges into localStorage

Settings → ⬆ Push to GitHub  ──────► writes vyaya-vg.csv
                                       (authenticated, needs token)

─────────────────────────────────
Open app anywhere (laptop etc.)
  └─ fetches vyaya-vg.csv  ◄──────── reads vyaya-vg.csv
  └─ displays data                   (public, no token needed)
```

**Phone** (token saved) — localStorage is primary, GitHub is backup you push to.  
**Any other device** — reads directly from GitHub CSV, read-only.

---

## 📲 Install on iPhone

1. Open **[https://vamshiganesh98.github.io/vyaya.vg/](https://vamshiganesh98.github.io/vyaya.vg/)** in **Safari**
2. Tap **Share** `⎋` → **"Add to Home Screen"**
3. Name it **Vyaya.vg** → tap **Add**
4. The gold `₹` icon appears on your home screen

---

## ☁️ GitHub Sync Setup (one time)

You need a GitHub Personal Access Token to push expenses from the app.

**Get a token:**
1. `github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)`
2. Generate new token → name it `vyaya-vg` → expiry: No expiration → tick **repo** scope
3. Copy the token

**Save it in the app:**
1. Open the app → **Settings → ☁️ GitHub Sync**
2. Repo: `vamshiganesh98/vyaya.vg`
3. Token: paste your PAT
4. Tap **Save Token**

**From now on:**
- Add expenses via Back Tap or `+` → data in localStorage
- Tap **⬆ Push to GitHub** in Settings → writes `vyaya-vg.csv` to GitHub
- Open on laptop → automatically reads latest from GitHub

---

## ⚡ Back Tap Shortcut (iPhone)

Double-tap the back of your iPhone → log an expense in 3 taps.

**Setup (once):**

| Step | Action |
|------|--------|
| 1 | Shortcuts app → **+** → New Shortcut |
| 2 | Add **"Ask for Input"** → Question: `Amount ₹` → Type: Number |
| 3 | Add **"Choose from List"** → items: `Food, Travel & Commute, Q-Commerce, Bills, Investments, Vacation, Shopping, Others` |
| 4 | Add **"Choose from List"** → items: `UPI, Credit Card` |
| 5 | Add **"Open URLs"** → build URL with variables from steps above |
| 6 | Settings → Accessibility → Touch → Back Tap → Double Tap → select shortcut |

**Shortcut URL:**
```
https://vamshiganesh98.github.io/vyaya.vg/?amt=AMOUNT&cat=CATEGORY&pay=PAYMENT
```
Replace `AMOUNT`, `CATEGORY`, `PAYMENT` with the *Provided Input* variables from steps 2, 3, 4.

---

## 📂 CSV Format

```
Date,Time,Category,Amount,Mode of Payment
06-06-2026,10:08,Food,12,UPI
05-06-2026,22:44,Food,70,Credit Card
02-06-2026,09:30,Travel & Commute,400,UPI
```

| Column | Format | Valid values |
|--------|--------|--------------|
| Date | `DD-MM-YYYY` or `DD/MM/YYYY` | any date |
| Time | `HH:MM` | `00:00` if unknown |
| Category | text | Food, Travel & Commute, Q-Commerce, Bills, Investments, Vacation, Shopping, Others |
| Amount | number | `12` or `924.50` |
| Mode of Payment | text | UPI, Credit Card |

Header row is optional — auto-detected and skipped.

---

## 🛠 Tech Stack

| | |
|---|---|
| **Frontend** | Vanilla HTML + CSS + JS — zero dependencies, zero build |
| **Storage** | `localStorage` on phone + `vyaya-vg.csv` on GitHub |
| **Sync** | GitHub Contents API (authenticated PUT, public GET) |
| **Offline** | Service Worker v10 — full offline after first load |
| **PWA** | Web App Manifest — standalone display, custom icon |
| **Fonts** | Syne + DM Sans via Google Fonts |
| **Hosting** | GitHub Pages |

---

<div align="center">

*Built by* **VG** · *Powered by* **₹** · *Synced via* **GitHub**

</div>
