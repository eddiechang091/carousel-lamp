# Carousel Lamp 🎠

A web-based 3D photo carousel lamp built with React, Three.js, and Vite. Hang your personal photos on a spinning lantern carousel, complete with holiday themes, ambient music, and an immersive night-mode lighting system.

---

## Features

- **3D carousel scene** — procedurally built in Three.js: candy-cane column, scalloped canopy, hanging photo frames, light shafts, and a contact-shadow halo
- **Photo management** — drag photos onto frames, crop and position them, export polaroid-style images, swap slots by drag-and-drop; photos are stored locally in IndexedDB (never uploaded)
- **Night mode** — toggle atmospheric internal lighting with warm beam volumes and rim glow
- **Holiday themes** — 14 festival themes (New Year's Day, Valentine's Day, Spring Festival, Carnival, St. Patrick's Day, April Fools' Day, Easter, Mother's Day, Dragon Boat Festival, Mid-Autumn Festival, Halloween, Diwali, Thanksgiving, Christmas) that auto-activate by date, each with 3D decorations
- **Mood captions** — handwriting-style text rendered on each polaroid border
- **AI captions** — when you hang a photo, the model looks at it and drafts one poetic caption (≤ 20 characters, current language, named for the current festival theme) into the caption input; the user edits it and saves. Served by the `/api/llm` proxy (see below) — photos are still never uploaded anywhere except to the model for that one caption
- **Model dashboard** — the Model button next to the Theme selector opens a translucent overlay with a model picker (list comes from the server, never hardcoded) and a line chart of token usage per call
- **Festival pony** — a small 2D pony in the bottom-right corner tells you the current theme's festival background plus 2–3 fresh fun facts, searched live on the web via Otari (a different angle each tap), when tapped, and nudges you after a minute idle
- **Background music** — one tune per theme, each played in its own synthesized instrument voice (Web Audio, no audio files): suona + festive drums for Spring Festival, guzheng plucks + dizi flute for Mid-Autumn, piano for Christmas and New Year, fiddle for St. Patrick's, samba drums for Carnival, and the original music-box tine for the classic lamp — see `src/lib/theme-music.ts` (tunes) and `src/lib/instruments.ts` (voices). Browsers block audio before the first user gesture, so the music starts on your first tap or keypress.
- **Multilingual** — English, French, Spanish, 中文
- **Photos stay local** — photos are stored in IndexedDB and never uploaded, except the one photo preview sent to the AI model when a photo is hung (auto-caption)

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
│   │   ├── themes.ts             # Colour palettes + auto-detect logic
│   │   ├── photos.ts             # Crop math, polaroid export
│   │   ├── photo-storage.ts      # IndexedDB persistence
│   │   ├── view-storage.ts       # Camera position, music/theme prefs (localStorage)
│   │   ├── sounds.ts             # Chime audio
│   │   ├── music-box.ts          # Procedural music player (Web Audio)
│   │   ├── instruments.ts        # Synthesized instrument voices (KS pluck, flute, bowed, reed, piano, drums)
│   │   ├── theme-music.ts        # One tune + instrument voice per theme (MIDI-note melodies)
│   │   ├── heic.ts               # HEIC → JPEG conversion wrapper
│   │   └── utils.ts              # Tailwind class merge helper
│   ├── services/
│   │   └── otari/                # Otari client: caption + festival prompts, /api/llm fetch client, model list, usage history
│   ├── pages/
│   │   └── Home.tsx      # Main page: all UI controls and carousel integration
│   ├── __tests__/        # Vitest unit + component tests
│   ├── App.tsx
│   ├── main.tsx
│   └── routes.tsx
├── api/
│   └── llm.ts            # Vercel serverless proxy: POST /api/llm → Otari chat completions
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

Output goes to `bundle/`.

### Preview the production build

```bash
pnpm preview
```

---

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Type-check then build into `bundle/` |
| `pnpm preview` | Serve the `bundle/` folder locally |
| `pnpm typecheck` | Run `tsc --noEmit` without bundling |
| `pnpm test` | Run unit + component tests with Vitest |
| `pnpm test:browser` | Run browser (Playwright) tests |
| `pnpm lint` | Lint `src/` with Biome |

---

## Environment variables

### Browser (optional, `VITE_*`)

Create a `.env.local` file in the project root to set them.

| Variable | Description |
|---|---|
| `VITE_SENTRY_DSN` | Sentry DSN for error reporting. Omit to disable Sentry. |

### Server — AI captions via Otari (required for AI features)

These are read **only** by the `api/llm.ts` serverless function. They are
never bundled into the frontend and never leave the server. Set them in
the Vercel dashboard: **Project → Settings → Environment Variables**
(Production), then redeploy. For local function runs with `vercel dev`,
put them in `.env.local` (never commit that file).

| Variable | Required | Description |
|---|---|---|
| `OTARI_API_KEY` | Yes | Otari API key (`otk_…`, from the Otari dashboard → Keys). |
| `OTARI_MODEL` | Yes | Model in `provider/model` form (e.g. `deepseek/deepseek-v4-pro-0813`). Pick one from the Otari dashboard → Models page. No model ID is hardcoded in the repo. |
| `OTARI_FALLBACK_MODEL` | No | Second model, same `provider/model` form. If the primary model call fails, the proxy retries once with this one (multi-provider routing). |
| `OTARI_MODELS` | No | Comma-separated `provider/model` list for the Model dashboard picker (e.g. `deepseek/deepseek-v4.1-flash-1017,moonshotai/kimi-k3.1-pro`). When set, it replaces the `[OTARI_MODEL, OTARI_FALLBACK_MODEL]` default list. Add models later by editing this variable — no code change. |
| `OTARI_BASE_URL` | No | Otari API base URL. Default `https://api.otari.ai/api/v1` (US accounts). EU accounts use `https://eu.api.otari.ai/api/v1` — a key from the wrong region returns HTTP 421. |

Without `OTARI_API_KEY` / `OTARI_MODEL`, `/api/llm` answers `503` with a
clear setup message and the AI features show that message; everything
else in the app keeps working.

---

## AI captions (Otari)

    React app --POST /api/llm {messages}--> Vercel function api/llm.ts
        --Bearer OTARI_API_KEY--> Otari chat completions

- **Auto-caption.** Hanging a photo (single editor save or batch upload)
  sends its 440×520 JPEG preview to the model as an OpenAI-style
  `image_url` part, together with a prompt asking for one poetic caption
  (≤ 20 characters, current language, named for the current festival
  theme — all 14 themes are named). The result fills the caption draft;
  the user edits it and saves with the existing Save button. Nothing is
  auto-persisted. A small loading state shows in the input while
  generating; on failure an inline "Try again" retry appears. On an
  empty frame the editor shows only Add photo.
- **Model dashboard.** `GET /api/llm` returns the allowed models
  (`OTARI_MODELS`, else `[OTARI_MODEL, OTARI_FALLBACK_MODEL]`); `POST
  /api/llm` accepts an optional `model` from that list and rejects
  anything else with 400. A successful call returns `{ text, model,
  usage, searched }` — the model actually used, its token usage, and
  whether the call ran a live web search — and the
  client records each call in localStorage (`carousel-lamp:otari-usage`,
  cap 50). The Model button next to the Theme selector opens a
  translucent overlay with the picker and an SVG line chart of total
  tokens per call (last 20); it fades out after 10s idle.
- **Festival pony.** Tapping the pony sends a text-only chat request for
  the current theme's festival background + 2–3 fun facts (≤ 420
  characters, shown in a bubble, marked AI-generated). The request
  carries `search: true`, so the proxy attaches Otari's built-in
  `otari_web_search` tool and the facts come from a live web search —
  today's date plus a rotating angle (this year's news, food, history,
  how countries celebrate, recent records) keep each tap fresh. If the
  search call fails, the proxy retries without the tool and the bubble
  falls back to the plain AI-generated note. The pony also nudges after
  60s idle, then at most every 180s, max 3 per session, only when no
  editor/modal is open.
- The browser never sees the API key. The model is picked from the
  server-provided allowlist; the proxy logs only the outcome and the
  model used, never request bodies or the key.

---

## Deploying to Vercel

Project: **carousel-lamp**. The repo has a `vercel.json`
(`pnpm build` → `bundle/`, serverless functions in `api/`).

- **From GitHub (recommended):** import the repo in the Vercel dashboard,
  set the `OTARI_*` variables above, deploy. Pushes to `main` deploy
  automatically.
- **From a local build:** `pnpm build`, then deploy `bundle/` plus
  `api/llm.ts` as a file deployment (the `vercel-deploy-app.py` flow in
  the workspace connector scripts does this: static files + the function,
  SSO protection disabled).

After deploying, check two things: the app opens at the deployment URL,
and `POST /api/llm` answers `503` with the setup message until the key
and model are set (that proves the proxy is wired); with a key and a
vision-capable model set, hanging a photo auto-generates a caption line.

---

## Browser support

Modern evergreen browsers with **WebGL 2** support (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+). HEIC photo conversion requires a browser that supports `OffscreenCanvas` and Web Workers.

---

## License

For personal, non-commercial use only.

