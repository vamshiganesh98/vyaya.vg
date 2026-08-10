# Vyaya.vg

Personal expense tracker — **React + Tailwind + Motion**, with Magic UI–style accents.

**Live:** https://vamshiganesh98.github.io/vyaya.vg/

## Stack

| | |
|---|---|
| UI | React 19 + Vite + Tailwind CSS v4 |
| Motion | Motion (Framer) + GSAP available |
| Accents | Magic UI–inspired NumberTicker, BlurFade, ShimmerButton, Aurora |
| Sync | Google Apps Script (`google-apps-script.js`) |
| Offline | PWA service worker |

Preferred registries for future work are documented in [`.cursor/skills/ui-component-libraries/SKILL.md`](.cursor/skills/ui-component-libraries/SKILL.md) (Magic UI, React Bits, SmoothUI, Unlumen, shadcn).

## Develop

```bash
npm install
npm run dev
```

## Build / GitHub Pages

```bash
npm run build
```

Deploy the `dist/` folder to GitHub Pages (base path `/vyaya.vg/`).

## Sheets sync

Paste `google-apps-script.js` into Apps Script and deploy as a Web App. Save the URL in Settings.

## Legacy

The previous vanilla HTML/JS app is archived under `legacy/` for reference.
