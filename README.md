# 昨非 · Don't Dos

昨非 — 觉今是，而昨非。A private ledger for yesterday’s mistakes and today’s rules.

**Live app:** https://f-seal.github.io/Mistake_Recorder/

On iPhone, open the link in Safari, then choose Share → Add to Home Screen. Records and the API key stay on that device and origin.

A private, local-first rulebook for the things you choose not to do. You write the rule; when you slip, you record the time, what happened, and optionally a reflection. Insights turns those records into a calendar and simple, deterministic summaries.

The app is Chinese-first and bilingual, installs as an iPhone PWA, and keeps all personal data in the browser. An optional DeepSeek assistant helps turn a description into a structured rule or slip, but it can only add records, and every write requires confirmation.

## What it does

- **Rulebook** — searchable list of active rules, five fixed categories (健康 / 心理 / 社交 / 安全 / 事业), and a quick “记一次” action on each rule.
- **Rule detail** — description, month calendar of slips, full history with time, situation, reflection, and manual edit/delete.
- **Insights** — month calendar with category-coded, shape-distinct markers; 30-day and all-time counts; most-broken rule and category; ranking by rule.
- **Record with AI** — the assistant searches existing rules, prepares a rule or slip, and shows a confirmation card. It cannot edit, delete, merge, or silently write.
- **Backup** — versioned JSON export via the iOS share sheet (or download). Import replaces rules and slips after confirmation. API key, language, and settings are never exported.
- **PWA** — installable, offline app shell; the AI needs internet, manual recording does not.
- **Privacy** — no accounts, analytics, CDNs, or external fonts. Data stays in IndexedDB on the current origin.

## Stack

React 18, TypeScript, Vite (Safari 15 target), Dexie 4, Zod, VitePWA/Workbox, Vitest, and plain CSS with design tokens. No backend.

## Local development

```bash
npm install
npm run dev
```

Quality gates:

```bash
npm run typecheck
npm test
npm run build
npm run scan
```

`npm run scan` checks the production bundle against the local files in `secret/`.

## Data model

- `rules` — id, title, description, category, archived, rev, timestamps.
- `breaks` — id, ruleId, occurredAt (ISO), situation, reflection, source, rev, timestamps.
- `settings` — interface language only.
- `secrets` — the DeepSeek key, stored separately.
- Every mutable record uses an optimistic `rev`; edits fail cleanly if the record changed.
- A slip always belongs to an existing, active rule. A future slip time is rejected.
- Archived rules keep their history and continue to count in Insights. They can be restored.

Backups use `schemaVersion: 1`. Any future schema change must add a Dexie migration and a legacy backup parser with tests.

## AI safety model

- The key is read from IndexedDB only when the assistant is opened and is kept in memory for that sheet.
- Requests go directly to `https://api.deepseek.com/chat/completions`; the production CSP allows only that API host.
- The model sees the current date/time, timezone, fixed categories, and only the rules returned by its read tool.
- The tool surface is fixed: `search_rules`, `propose_new_rule`, `propose_break`.
- Write tools create app-controlled proposals. The user must confirm before any repository write occurs. There is no AI edit or delete path.
- Tool arguments, provider responses, storage records, and backups are validated with Zod.
- The conversation is intentionally not persisted.

The key is not in a secure enclave; use a dedicated DeepSeek key and monitor usage. See Settings → AI access for the same warning.

## Deployment

The app is a static bundle. A GitHub Pages project site needs the repository name as its base:

```bash
VITE_BASE=/<repo>/ npm run build
npm run scan
```

Deployment via the GitHub Git Data API (never prints the token):

```bash
python3 scripts/deploy_gh_pages.py \
  --repo OWNER/REPO \
  --token-file secret/github_apikey.txt \
  --dist dist \
  --branch gh-pages \
  --wait-for-pages
```

Keep the deployed origin stable once data exists: IndexedDB and the stored API key are origin-scoped. Export a backup before any deliberate origin move.

## Verified

- 39 unit tests across schemas/repositories, revisions, archive behavior, backups, insights, dates, and the AI tool loop.
- Typecheck and production build.
- Build-secret scan.
- Mobile-viewport Playwright walkthroughs: create rules/slips, edit/delete, archive/restore, search, insights calendar/day sheet, light/dark, Chinese/English, AI mock proposal/confirm, key save/test, backup export/restore.
- Production CSP, manifest/icon delivery, service-worker registration, and offline reload.
- DeepSeek CORS preflight from `http://localhost:4173`.
- A live DeepSeek smoke request with the local key: `deepseek-flash` returned a real `search_rules` tool call (351 tokens, no personal data sent).
- A production build under the `/Mistake_Recorder/` Pages base path, including service-worker scope and offline reload.
- The live app at https://f-seal.github.io/Mistake_Recorder/ (2026-10-25): manifest and icons, service-worker scope, offline relaunch with persisted records, HTTPS redirect, and a DeepSeek CORS preflight from the live origin.

## Still needs the real iPhone

- Keyboard behavior in the AI composer and long form sheets on iOS 15.6.
- Install from Safari, standalone launch, and the service-worker update prompt.
- A live AI round-trip from the installed app; the provider and live-origin CORS have both been checked.
