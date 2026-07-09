# Changelog

All notable changes to the AI Source Scraper are documented here.

## v1.2.0 — 2026-07

### Added
- **Buffered console build** (`ai-source-scraper-console-buffered.js`): paste once, scan
  repeatedly, download one merged CSV/JSON per thread. Supports run → pause → run → pause
  across a multi-prompt conversation, for longitudinal capture within a single thread.
- **Reload-safe buffer**: the buffer persists to `localStorage` after every scan and
  rehydrates on load, so an accidental tab reload no longer loses a round.
- **`file_id`** column — the label passed to each scan; the join key linking every source
  back to its prompt, chat export, screenshot, and notes.
- **Auto-split columns** `topic`, `prompt_id`, `thread_state`, parsed from `file_id` by
  pattern (position-independent, so `medium_m1_warm` and `chatgpt_20260715_medium_m1_warm`
  parse identically). Plus `capture_date` and an optional `note` (2nd argument to `scan`).
- **Public API** on the buffered build: `aiSourceScraper.scan(file_id[, note])`, `.csv()`,
  `.json()`, `.clear()`, `.status()`, `.buffer` (aliases: `grab`, `ass`).

### Changed
- Standardised on the 1.x release line; dropped the ambiguous internal "v3" label from the
  console header.
- Console output schema now matches the extension/userscript, plus the additive
  longitudinal columns above.

### Notes
- The original one-shot console script (`ai-source-scraper-console.js`) is retained for
  quick single captures.
- Extension / userscript capture behaviour is unchanged. To emit the same longitudinal
  columns there, add the `parseId` split to `extension/content.js`.

## v1.1.0
- Extension, userscript, and one-shot console version; panel vs. inline `source_type`;
  `clean_url` tracking-param stripping; per-scan `capture_id`; `session_label` field.
