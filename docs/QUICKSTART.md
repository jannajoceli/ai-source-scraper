# AI Source Scraper - Quick Start

This guide is for the browser-extension workflow in v1.3.1. AI Source Scraper captures the sources shown in AI search source/activity panels and adds research metadata so each capture can be compared or revisited later.

## 1. Open an AI search response

Open a response on a supported AI platform that has searched the web.

Then open the platform's **Sources** or **Activity** panel so the source list is visible. The panel does not need to be manually scrolled. AI Source Scraper handles the scrolling during the scan.

## 2. Set the capture metadata

In the floating AI Source Scraper panel, complete the fields in this order:

1. **Capture mode**: `Longitudinal` or `Comparative`
2. **Session label**
3. **Prompt condition**: `Isolated`, `Initial`, or `Follow-up`
4. **Search condition**: `AI search` or `Agentic AI search`
5. **Prompt framing**: `Underspecified`, `Program`, `Anti-program`, or `Ambiguous`
6. **AI fieldwork observations**: optional notes about what you observed during the capture

The same metadata fields are available in both capture modes.

## 3. Scan and add to the session

Click **Scan and add to session**.

The scraper scrolls through the open source/activity panel, collects the displayed sources, and appends the capture to the current session buffer.

Repeat this process for each prompt or research condition you want to include in the session.

## 4. Export the session

When the session is complete, use **Download all (CSV + JSON + TXT)** to export all three formats together.

You can also expand **Download files separately** to export an individual format.

The session buffer is kept in browser `localStorage` until you clear it, so an accidental page reload should not remove the current research round.

## Naming your captures

Recommended session labels follow:

`{topic}_{prompt_id}_{thread_state}`

Examples:

- `medium_p0_cold`
- `medium_p0_warm`
- `dataviz_m1_cold`

The `thread_state` is appended from the selected Prompt condition:

| Prompt condition | `thread_state` |
|---|---|
| Isolated | `cold` |
| Initial | `cold` |
| Follow-up | `warm` |

A leading platform token or 8-digit date token is accepted and ignored during label parsing because platform and date are captured automatically.

## What the main fields mean

- **Capture mode** records whether the capture belongs to a longitudinal or comparative research design.
- **Prompt condition** records where the prompt sits conversationally.
- **Search condition** records the technical AI search condition under which the response was generated.
- **Prompt framing** records how the prompt is positioned epistemically.

For definitions, examples, code values, and the visual research schema, see **[Research Design & Codebook](RESEARCH-DESIGN.md)**.

## Login conditions

ChatGPT and Gemini can be studied in logged-in or logged-out conditions where anonymous access is available, although usage limits may apply. Claude.ai requires an account to conduct a conversation, so captures from Claude are always from an authenticated session.

This means a logged-in versus logged-out comparison is only possible on platforms that expose both conditions.

## Troubleshooting

- **The scan returns 0 sources:** make sure the Sources/Activity panel is open and has finished rendering.
- **The source count is still climbing:** let the auto-scroll finish before starting another capture.
- **A download is blocked by the page:** strict Content-Security-Policy settings can interfere with Blob downloads; the scraper includes fallback behaviour where supported.
- **The interface changed:** AI platforms redesign their source panels frequently. Report breakage in the GitHub repository so the detection heuristics can be updated.

## Console workflow

The repository also includes one-shot and buffered console builds for no-install workflows. See the main [README](../README.md) for the current console commands and file descriptions.
