# Vyaya.vg

Personal expense tracker — **React + Vite + Tailwind + Motion**, full feature parity with the original app, premium dark UI.

**Live:** https://vamshiganesh98.github.io/vyaya.vg/

## Features restored

- Add / **Edit** expenses, smart search, period filters, analytics drill-down
- Splits + settle, tags, location, multi-currency FX, natural-language note parse
- Insights, recurring due banner, savings goals, category budgets
- Full Analytics: Overview (donut), Categories, Trends, Year in Review
- Theme Dark / Light / Auto · CSV import/export · Sheets sync + settings sync
- Undo delete · end-of-day mood · URL shortcut params · PWA

## Stack

| | |
|---|---|
| UI | React 19 + Vite + Tailwind CSS v4 |
| Motion | Motion (Framer) |
| Accents | NumberTicker, BlurFade, ShimmerButton, Aurora, Donut |
| Sync | Google Apps Script (`google-apps-script.js`) |

## Develop

```bash
npm install
npm run dev
```

Source: `app/`. Legacy vanilla: `legacy/`.

## Build / GitHub Pages

```bash
npm run build
```

Publishes production files to the **repo root** so branch Pages (`/`) works. After merge, hard-refresh or clear site data if an old PWA shell is cached.
