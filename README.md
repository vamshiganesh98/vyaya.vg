# Vyaya.vg

Personal expense tracker — **React + Vite + Tailwind + Motion**.

**Live:** https://vamshiganesh98.github.io/vyaya.vg/

## What libraries are actually used

| Package | Role |
|---|---|
| **React 19** + **Vite** | App framework / build |
| **Tailwind CSS v4** | Styling |
| **Motion** (`motion`) | UI animations |
| **Lucide React** | Icons |
| **clsx** + **tailwind-merge** | Class helpers |
| **GSAP** | Installed; Motion is what the UI uses today |

**Not installed from registries:** Magic UI, React Bits, SmoothUI, Unlumen. Earlier work only added *hand-rolled* accents inspired by those (NumberTicker, BlurFade, ShimmerButton, Aurora). That’s why the first React ship still looked like the old black/gold app.

Preferred registries for future apps: [`.cursor/skills/ui-component-libraries/SKILL.md`](.cursor/skills/ui-component-libraries/SKILL.md).

## Develop

```bash
npm install
npm run dev
```

Source lives in `app/`. Legacy vanilla app is under `legacy/`.

## Build / GitHub Pages

```bash
npm run build
```

`npm run build` compiles the React app, then `scripts/publish-pages.mjs` copies the production files to the **repo root** (`index.html` + `assets/`) so GitHub Pages can serve them when the source is **Deploy from a branch → `/` (root)**.

If the live site still shows the old UI after a merge:

1. Hard-refresh or clear site data for `vamshiganesh98.github.io`
2. Remove the home-screen PWA shortcut and re-add it (old service workers cache the previous shell)

Optional: Repo → Settings → Pages → set source to **GitHub Actions** (workflow already uploads `dist/`).

## Sheets sync

Paste `google-apps-script.js` into Apps Script and deploy as a Web App. Save the URL in Settings.
