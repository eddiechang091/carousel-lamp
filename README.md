# Carousel Lamp 🎠

A web-based 3D photo carousel lamp built with React, Three.js, and Vite. Hang your personal photos on a spinning lantern carousel, complete with holiday themes, ambient music, and an immersive night-mode lighting system.

---

## Features

- **3D carousel scene** — procedurally built in Three.js: candy-cane column, scalloped canopy, hanging photo frames, light shafts, and a contact-shadow halo
- **Photo management** — drag photos onto frames, crop and position them, export polaroid-style images, swap slots by drag-and-drop; photos are stored locally in IndexedDB (never uploaded)
- **Night mode** — toggle atmospheric internal lighting with warm beam volumes and rim glow
- **Holiday themes** — four themes that auto-activate by date, each with 3D decorations and a 5-second opening canvas animation:
  | Theme | Active window | Opening animation |
  |---|---|---|
  | 🎃 Halloween | Oct 25 – Nov 4 | Dancing clown with trick-or-treat bucket, ghosts, bats, spider webs, skeletons |
  | 🎄 Christmas | Dec 20 – Dec 30 | Santa sleigh with 8 reindeer flying in an arc, falling snow |
  | 🧨 Lunar New Year | ~3 days before – 7 days after CNY | Chinese dragon, fireworks bursts, red lanterns |
  | ✨ Classic (default) | All other dates | — |
- **Mood captions** — handwriting-style text rendered on each polaroid border
- **Background music** — procedural music-box melody, toggleable
- **Multilingual** — English, French, Spanish, 中文
- **Fully offline** — no backend, no uploads, no accounts

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| 3D rendering | Three.js |
| Animation | GSAP |
| Build tool | Vite 8 |
| Styling | Tailwind CSS 3 + shadcn/ui primitives |
| Error tracking | Sentry (optional, via `VITE_SENTRY_DSN`) |
| Testing | Vitest + Testing Library |
| Linting | Biome |
| Package manager | pnpm (workspace) |

---

## Project structure

```
carousel-lamp/
├── public/
│   ├── fonts/            # Subset LXGW WenKai Lite woff2 files
│   └── assets/           # Carousel texture images
├── src/
│   ├── components/
│   │   ├── common/       # LanguageSwitcher, ThemeSwitcher, ThemeIntro, PageMeta
│   │   └── ui/           # shadcn/ui components (button, dialog, dropdown-menu, etc.)
│   ├── i18n/             # Translation dictionaries (en, fr, es, zh)
│   ├── lib/
│   │   ├── carousel-scene.ts     # Three.js scene: geometry, lighting, interaction
│   │   ├── carousel-ornaments.ts # Horses, poles, garden details
│   │   ├── carousel-motion.ts    # Rotation physics + wind gust system
│   │   ├── theme-decorations.ts  # Holiday 3D decoration layers
│   │   ├── theme-intro.ts        # 5-second canvas opening animations
│   │   ├── memory-projections.ts # Night-sky prismatic star particles
│   │   ├── themes.ts             # Colour palettes + auto-detect logic
│   │   ├── photos.ts             # Crop math, polaroid export
│   │   ├── photo-storage.ts      # IndexedDB persistence
│   │   ├── view-storage.ts       # Camera position, music/theme prefs (localStorage)
│   │   ├── sounds.ts             # Chime audio
│   │   ├── music-box.ts          # Procedural music-box melody
│   │   ├── heic.ts               # HEIC → JPEG conversion wrapper
│   │   └── utils.ts              # Tailwind class merge helper
│   ├── pages/
│   │   └── Home.tsx      # Main page: all UI controls and carousel integration
│   ├── __tests__/        # Vitest unit + component tests
│   ├── App.tsx
│   ├── main.tsx
│   └── routes.tsx
├── .gitignore
├── .npmrc
├── biome.json
├── components.json       # shadcn/ui config
├── package.json
├── pnpm-workspace.yaml
├── tailwind.config.js
├── vite.config.ts
├── vitest.config.ts
└── vitest.browser.config.ts
```

---

## Getting started

### Prerequisites

- **Node.js ≥ 20**
- **pnpm ≥ 9** — install with `npm install -g pnpm`

### Install dependencies

```bash
pnpm install
```

### Start the dev server

```bash
pnpm dev
```

The app opens at `http://localhost:5173`.

### Build for production

```bash
pnpm build
```

Output goes to `dist/`.

### Preview the production build

```bash
pnpm preview
```

---

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Type-check then build the Anna bundle into `bundle/` |
| `pnpm preview` | Serve the `bundle/` folder locally |
| `pnpm typecheck` | Run `tsc --noEmit` without bundling |
| `pnpm test` | Run unit + component tests with Vitest |
| `pnpm test:browser` | Run browser (Playwright) tests |
| `pnpm lint` | Lint `src/` with Biome |
| `pnpm validate` | `anna-app validate --strict` (needs the Anna CLI) |
| `pnpm harness` | Run the Anna local harness on port 5192 (needs the Anna CLI) |

---

## Environment variables

All variables are optional. Create a `.env.local` file in the project root to set them.

| Variable | Description |
|---|---|
| `VITE_SENTRY_DSN` | Sentry DSN for error reporting. Omit to disable Sentry. |

---

## Browser support

Modern evergreen browsers with **WebGL 2** support (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+). HEIC photo conversion requires a browser that supports `OffscreenCanvas` and Web Workers.

---

## Anna

Carousel Lamp is a **UI-only Anna App**:

    React 18 + TypeScript + Vite
        -> Anna static-spa bundle
        -> Anna App Runtime
        -> Anna Host API (anna.llm.complete)

- No server. Photos stay in the browser (IndexedDB, never uploaded).
- Outside the Anna host the app runs in standalone mode and the LLM
  reports as unavailable; inside Anna it uses the Host API.
- `app.json` — CLI project identity (slug, name, version).
- `manifest.json` — schema 2, UI-only, least-privilege permissions
  (`llm.complete` only for now).
- `src/services/anna/` — runtime connection + `LlmService` wrapper.
  AI behavior (caption generation) is built on top of this service.

Publish flow (runs on a machine with the Anna CLI — `anna-app` is not
installed on the build VM):

    pnpm build → anna-app validate --strict → publish → install test
    → submit-review → release

---

## License

For personal, non-commercial use only.

