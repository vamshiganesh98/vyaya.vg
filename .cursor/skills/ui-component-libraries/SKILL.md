---
name: ui-component-libraries
description: Preferred modern React UI/animation component libraries for new apps and redesigns. Use when building or restyling a frontend, choosing a UI kit, or the user mentions Magic UI, React Bits, SmoothUI, Unlumen UI, shadcn, Aceternity, Motion, or GSAP.
---

# UI Component Libraries

When starting or redesigning a **React** app, prefer the shadcn ecosystem + animated registries below. Do **not** force these into a vanilla HTML/JS app — migrate to Vite/Next + Tailwind first.

## Default stack for new apps

| Layer | Choice |
|-------|--------|
| Framework | Vite + React (or Next.js if routing/SSR needed) |
| Styling | Tailwind CSS |
| Primitives | **shadcn/ui** |
| Motion | **Motion** (`motion` / formerly Framer Motion) |
| Extra motion | **GSAP** when timelines / scroll / complex sequences help |
| Animated flair | Pick from registries below (copy-paste / CLI — not fat npm UI kits) |

## Preferred registries (copy into project)

Use **2–3 accent components max per screen**. More kills performance and looks noisy.

### 1. shadcn/ui — base primitives
- Buttons, dialogs, sheets, tabs, inputs, cards
- `npx shadcn@latest init` then `npx shadcn@latest add sheet button input tabs ...`
- Docs: https://ui.shadcn.com

### 2. Magic UI — marketing / polish animations
- Number ticker, shimmer buttons, blur fade, particles, marquee, animated beam
- Best for heroes, landing moments, first-impression polish
- `npx shadcn@latest add @magicui/<component>`
- Docs: https://magicui.design
- Needs: React, Tailwind, Motion

### 3. React Bits — creative text / backgrounds / effects
- Text animations, interactive backgrounds, standout patterns
- Copy JS/TS + CSS or Tailwind variants from https://reactbits.dev
- Or CLI: `npx shadcn@latest add @react-bits/<Component>-TS-TW`
- Use sparingly (≤2–3 per page); disable heavy effects on mobile

### 4. SmoothUI — Motion/GSAP animated shadcn companions
- Production UI with spring motion baked in
- `npx shadcn@latest add @smoothui/<component>` or SmoothUI CLI
- Docs: https://smoothui.dev
- Needs: React 19+, Tailwind v4+, Motion (GSAP for some)

### 5. Unlumen UI — animated registry on shadcn
- `npx shadcn@latest add @unlumen-ui/<component>`
- Docs: https://ui.unlumen.com
- Free + Pro (Pro needs license in `components.json`)

### 6. Aceternity UI (optional)
- Heavier 3D / particle / beam effects for marketing landings
- Prefer Magic UI / SmoothUI for app chrome; Aceternity for splash pages

## When to use what

| Goal | Use |
|------|-----|
| App chrome (forms, nav, sheets, settings) | shadcn/ui + SmoothUI |
| Hero numbers, soft entrances, CTA shine | Magic UI |
| Memorable background / text moment | React Bits (one hero effect) |
| Complex timeline / scroll story | GSAP |
| Micro-interaction springs | Motion |

## Rules of thumb

1. **App UI ≠ landing page.** Expense/dashboard apps: shadcn structure first; Magical accents second.
2. **Copy-paste ownership.** These registries land source in-repo — customize freely; don’t wrap the whole app in a closed kit.
3. **Respect `prefers-reduced-motion`.** Soften or disable movement; keep opacity/color.
4. **Brand over library defaults.** Keep product tokens (e.g. Vyaya gold `#e8c547` on deep dark) — don’t ship purple-on-white defaults.
5. **Vanilla / PWA zero-build apps:** use CSS + GSAP CDN; plan a React+Tailwind migration before adopting Magic UI / React Bits / SmoothUI / Unlumen.

## Install cheatsheet

```bash
# New Vite app
npm create vite@latest . -- --template react-ts
npm i && npm i motion gsap clsx tailwind-merge
npx shadcn@latest init

# Examples
npx shadcn@latest add button sheet input tabs
npx shadcn@latest add @magicui/number-ticker @magicui/shimmer-button @magicui/blur-fade
npx shadcn@latest add @smoothui/smooth-button
npx shadcn@latest add @unlumen-ui/glow
# React Bits: copy from reactbits.dev or shadcn registry @react-bits/...
```

## Utility

Always add `cn()`:

```ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```
