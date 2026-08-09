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

*A personal expense tracker — built for the iPhone, synced via Google Sheets, signed with intent.*

[![Live App](https://img.shields.io/badge/Live%20App-Vyaya.vg-e8c547?style=for-the-badge&labelColor=080810)](https://vamshiganesh98.github.io/vyaya.vg/)
[![PWA](https://img.shields.io/badge/PWA-Offline%20Ready-3ddc84?style=for-the-badge&labelColor=080810)](https://vamshiganesh98.github.io/vyaya.vg/)
[![Sheets Sync](https://img.shields.io/badge/Sync-Google%20Sheets-5b9cf6?style=for-the-badge&labelColor=080810)](#-google-sheets-sync)

</div>

---

## ₹ What is Vyaya.vg?

**Vyaya** (व्यय) — Sanskrit for *expenditure*. **`.vg`** — my signature.

A personal budgeting app built for one person: me. No accounts, no subscriptions. Add expenses from your iPhone in seconds via a Back Tap shortcut. Data lives in `localStorage` and merges with Google Sheets so local offline edits are never wiped on sync.

---

## ✦ Features

| | |
|---|---|
| **Fast add** | Amount → category → payment → save. Extra fields live under *More options* |
| **Offline-first PWA** | Installs on iPhone home screen, works without internet |
| **Google Sheets sync** | Merge sync with stable row IDs — local pending rows are kept |
| **localStorage cache** | Phone stores data locally — shows instantly, syncs in background |
| **CSV import / export** | Merge import + full export with Ids |
| **Back Tap shortcut** | Double-tap iPhone back → log expense in 3 taps |
| **8 categories** | Food · Travel & Commute · Q-Commerce · Bills · Entertainment · Investments · Shopping · Others |
| **2 payment modes** | UPI · Credit Card |
| **Monthly + category budgets** | Progress in the home hero; Investments excluded from spend totals |
| **Analytics** | Overview, categories, trends, year-in-review |
| **Dark / light / auto** | Theme toggle with gold accent brand |
| **Smart search** | `>500 food`, `#work`, `jun`, `upi`, `last month` |

---

## 🗂 File Structure

```
vyaya.vg/
├── index.html              ← App shell
├── app.js                  ← Logic
├── style.css               ← UI
├── google-apps-script.js   ← Sheets backend (deploy as Web App)
├── vyaya-vg.csv            ← Optional historical seed
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service worker (network-first for JS/CSS)
├── icon-192.png / icon-512.png / apple-touch-icon.png
└── README.md
```

---

## 🔄 How Data Flows

```
iPhone (you)                          Google Sheets
─────────────────────────────────     ─────────────────
Back Tap / + → add expense
  └─ saves to localStorage instantly
  └─ marks pending if offline

Settings → Sync Now  ──────────────► merge append/update/delete
                                       (stable Id column)

─────────────────────────────────
Open app
  └─ merge remote rows with local
  └─ pending local rows are kept
```

---

## 📲 Install on iPhone

1. Open **[https://vamshiganesh98.github.io/vyaya.vg/](https://vamshiganesh98.github.io/vyaya.vg/)** in **Safari**
2. Tap **Share** → **"Add to Home Screen"**
3. Name it **Vyaya.vg** → tap **Add**

---

## ☁ Google Sheets Sync

1. Create a Google Sheet
2. Extensions → Apps Script → paste `google-apps-script.js`
3. Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone
4. Copy the Web App URL into **Settings → Sync** in the app
5. Redeploy a new version whenever you update the script (especially after the Id column change)

Sheets columns:
`Date, Time, Category, Amount, Mode of Payment, Note, Split, Paid, Location, Tags, Id`

---

## ⚡ Back Tap Shortcut (iPhone)

```
https://vamshiganesh98.github.io/vyaya.vg/?amt=AMOUNT&cat=CATEGORY&pay=PAYMENT
```

Categories: `Food, Travel & Commute, Q-Commerce, Bills, Entertainment, Investments, Shopping, Others`  
Payments: `UPI, Credit Card`

---

## 📂 CSV Format

```
Id,Date,Time,Category,Amount,Mode of Payment,Note,Split,Paid,Tags,Location
abc123,06-06-2026,10:08,Food,12,UPI,lunch,1,0,#work,
```

Header row is optional — auto-detected. `Id` is optional on import (generated if missing).

---

## 🛠 Tech Stack

| | |
|---|---|
| **Frontend** | Vanilla HTML + CSS + JS — zero dependencies |
| **Storage** | `localStorage` + Google Sheets merge sync |
| **Offline** | Service Worker v5 — network-first for app shell |
| **Fonts** | Syne + DM Sans |
| **Hosting** | GitHub Pages |

---

<div align="center">

*Built by* **VG** · *Powered by* **₹** · *Synced via* **Sheets**

</div>
