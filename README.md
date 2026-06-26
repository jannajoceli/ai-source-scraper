# AI Source Scraper

Capture every cited web source — with metadata — from the source/activity panels of **Claude, Gemini, and ChatGPT**, for longitudinal source-recurrence analysis (DMI26, *Agentic AI on the Web*).

## Repository contents

This repository includes:

- `README.md` — overview, purpose, usage, output schema and limitations.
- `docs/QUICKSTART.md` — step-by-step instructions for running the scraper.
- `ai-source-scraper-console.js` — no-install browser console version.
- `ai-source-scraper.user.js` — Tampermonkey/Violentmonkey userscript for repeated captures.
- `assets/` — logo and icon files.
- `.gitignore` — ignores local exports and editor/OS clutter.
- `REPOSITORY_NOTES.md` — suggested repository description, topics and setup notes.

## Two versions

- **`ai-source-scraper-console.js`** — paste into the browser console. Zero install. Auto-scrolls, then downloads CSV + JSON for the current response.
- **`ai-source-scraper.user.js`** — Tampermonkey/Violentmonkey userscript. Floating panel with a *session label* field and a *buffer* that accumulates many captures across a session before exporting them together.

## Use it in 4 steps

1. Open a Claude / Gemini / ChatGPT response that searched the web.
2. **Open the Sources / Activity panel** so the list is on screen (it doesn't need to be scrolled — the tool does that).
3. Run it — console paste, or click **Scan sources** in the userscript panel. It scrolls the panel for a few seconds; watch the count climb in the console / on the button. **Let it finish.**
4. Download CSV / JSON.

## Install the userscript

Install [Tampermonkey](https://www.tampermonkey.net/) → dashboard → **+ New** → paste `ai-source-scraper.user.js` → save. The panel appears bottom-right on the three sites.

## Output schema

| column | meaning |
|---|---|
| `rank` | order in the list (proxy for position/prominence) |
| `capture_id` | one id per scan (userscript) — separates captures in one file |
| `capture_timestamp` | ISO time of the scan |
| `platform` | claude / gemini / chatgpt |
| `page_url`, `page_title` | the conversation |
| `session_label` | your free-text note, e.g. the prompt (userscript field) |
| `source_type` | `panel` (full activity list, has a description) vs `inline` (citation chip in the answer) |
| `url` | full URL exactly as shown — keeps tracking params, for provenance |
| `clean_url` | URL with `utm_*` and click-ID params (`fbclid`, `gclid`, …) stripped — **use this for grouping / recurrence** |
| `hostname`, `domain` | host, registrable domain |
| `title` | the source's headline as shown on the card |
| `description` | the card's snippet/description |
| `favicon` | favicon image URL |

`source_type` lets you compare **what was cited in the answer (`inline`) against everything consulted (`panel`)** — a direct read on selectivity. De-duplication keeps the richer card when a source appears both inline and in the panel, and merges `utm_*` query variants of the same URL.

## Console API (userscript)

`window.aiSourceScraper` exposes `.scan()`, `.buffer`, `.csv()`, `.json()`, `.clear()`, `.setLabel(s)`.

## Tuning

`denyHosts` at the top of each file is the only exclusion list — deliberately tight, so `google.com` / `openai.com` / `anthropic.com` citations are kept (only their account/settings/support subdomains drop). Add a host there if UI links sneak in; remove one if a real citation is being dropped.

## Honest limitations

- It reads the rendered DOM, so the source panel must be **open**. If a scan returns 0, the panel almost certainly isn't open, or the list hadn't rendered yet.
- Auto-scroll works for the lazy lists these products use, but on a very long list (hundreds) give it the full few seconds; the count stops climbing when it's done.
- A strict Content-Security-Policy can block the Blob download; both versions fall back to copying the CSV to your clipboard (and the console version leaves rows in `window.__aiSources`).
- It captures the *displayed* source/activity layer, not the model's internal query fan-out — that isn't exposed in the DOM.
- These interfaces change often. The detection is structure-based (repeating link rows + scroll), not class-name-based, precisely so it survives redesigns; if a future layout breaks it, the `rowOf` / `findContainers` heuristics at the top are where to adjust.

## Full citation (APA 7, software)

Omena, J. J. (2026). AI Source Scraper (Version 3) [in-browser scraper]. https://github.com/jannajoceli/ai-source-scraper



