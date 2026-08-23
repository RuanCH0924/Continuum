# Continuum (续言)

> Let the story continue — an open-source desktop writing tool for Chinese web novel authors

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-2D7FF9)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Tests](https://img.shields.io/badge/tests-242%20passing-brightgreen)
[中文](./README.md)

**Continuum (续言)** is an open-source writing tool for Chinese web novels. It keeps all your creative data local and connects to any OpenAI-compatible AI model through a unified adapter, so serial authors can organize their stories and keep the words flowing.

We don't intend to replace any existing writing product. Instead, we build around three simple ideas — **your data belongs to you, your AI stack stays flexible, and the writing flow is interrupted as little as possible**. The project is still in its early stages (v0.1.0); feedback and trial use are very welcome.

- **Data ownership**: works and chapter content are stored locally as plain Markdown, readable in any text editor — no platform lock-in
- **Bring your own key**: connect any OpenAI-compatible service (DeepSeek / OpenAI / SiliconFlow / Ollama) with your own API key
- **Writer-friendly**: WYSIWYG Tiptap editor + outline / chapter outline / mind map planning + clue & timeline linking, tuned for long-form serial writing
- **Knowledge-enhanced**: hybrid semantic search (local BM25 + optional Embeddings); AI chat auto-injects your work's knowledge context
- **Open source**: MIT licensed, free to use, modify and extend

### Development Status

| Item | Status |
| --- | --- |
| Current version | **v0.1.0** (all M0–M7 milestones + several post-acceptance increments) |
| Editor / writing management / AI assistant / five themes | ✅ Done |
| Outline module (workspace / chapter outlines / mind map / AI extract & Q&A) | ✅ Done |
| Volume hierarchy / timeline / clue linking | ✅ Done |
| Creative knowledge base (characters / world / clues / materials) | ✅ Done |
| Import / Export (MD · TXT · PDF · EPUB · DOCX) | ✅ Done |
| Global full-text search / version history / RAG semantic search | ✅ Done |
| Plugin mechanism / SQLite storage engine | ✅ Done |
| Unit tests | ✅ 242 passing (29 test files, incl. UI components) |
| Packaging (electron-builder) | ⏳ Deferred |

---

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [AI Configuration](#ai-configuration)
- [Data Storage](#data-storage)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### ✍️ Editor

- **WYSIWYG**: block editor built on Tiptap (ProseMirror) with headings, tables, task lists, code blocks, quotes, images and links; three modes (Edit / Preview / Source) with live Markdown rendering in the editing pane
- **Format toolbar**: bold / italic / underline / strikethrough / H1–H3 / quote / lists / task list / table / link / image / code block / horizontal rule / undo-redo
- **Manuscript typography**: Source Han Serif body, 1.9 line-height, first-line indent; font size, line height, indent and typewriter mode adjustable in format settings and persisted
- **Live stats & autosave**: real-time Chinese character count; debounced autosave (800ms) + instant save via Ctrl+S
- **Chapter title block**: inserted automatically when opening a chapter (editable), kept in sync on rename
- **Find & replace**: Ctrl+F / Ctrl+H floating dialog with replace and replace-all
- **Clue / timeline linking**: select text to create a clue; highlighted annotations in the body (clue status color / timeline purple), click to locate the corresponding sidebar entry, colors stay in sync with status changes

### 🧭 Outline & Planning

- **Outline workspace**: permanent entry in the sidebar "Outline" tab; the central area switches between Writing ⇄ Outline; three views (outline list / chapter outlines / mind map) with a granularity toggle (key nodes only / full detail)
- **Outline nodes**: rhythm tags (opening / development / climax / turning point / low point / clue / ending), estimated word count, linked chapters (click to jump), involved characters (linked character cards); drag to reorder, double-click to rename
- **Chapter outlines**: one per chapter (core plot / character scenes / key conflict / chapter-end hook / notes / writing status), autosaved inline
- **Mind map**: dependency-free SVG tree (zoom / pan / add-edit-delete nodes), three templates (plot line / character relations / worldbuilding), bi-directional generation with the outline, XMind outline text import supported
- **AI chapter-outline extraction** ("Extract" tab): current chapter / last 20 chapters / custom range (≤50 chapters), queued extraction in the main process writing results into chapter outlines; subject to the daily AI quota
- **Outline-anchored Q&A** ("Chat" tab): references outline nodes / chapter outlines / chapter text as context for questions about story structure

### 📚 Writing Management

- **Work / chapter tree**: multiple works in parallel, search filter, double-click rename, one-click delete
- **Volume hierarchy**: Work → Volume → Chapter; volumes support add / rename / delete / reorder, chapters can be assigned to a volume (single ownership), unassigned group is custom-namable
- **Creative knowledge base**: four sidebar tabs (Characters / World / Clues / Materials) for structured notes on casts, worldbuilding, plot threads and inspirations — all indexed by semantic search
- **Timeline module**: sidebar "Timeline" tab records story time nodes (editable time + summary), CRUD / reorder / realtime save; body time annotations link bidirectionally with entries
- **Global full-text search**: Ctrl+Shift+F searches chapter text & knowledge across all works, jump with one click
- **Version history**: Ctrl+S snapshots the current chapter (50 per chapter), preview & restore anytime
- **Welcome page & work wizard**: New / Import / Example entries when no works exist; the wizard collects genre, planned length, daily goal and default volume name

### 🏠 Home (Work Gallery + Statistics)

- **Work gallery**: the app opens on a shelf dashboard with work cards (gradient cover / title / genre / summary / created date); keyword search + genre filter chips + pagination; hover lift animation on desktop, tap-press feedback on touch; clicking a card opens the work detail (editor)
- **Statistics**: four metric cards (work count / total words / today's words incl. goal progress / period words) with animated number transitions; a bar chart switchable across week / month / year with hover tooltips, grow-in redraw on period switch and smooth height transitions on data updates (daily word counts are recorded locally and accumulate across days)

### 📥 Import / Export

- **Markdown import**: as a new work (+ first chapter) or appended as a new chapter of the current work
- **Export**: chapter × (Markdown / TXT); work × (Markdown / TXT / **PDF** / **EPUB** / **DOCX**) — PDF via printToPDF, EPUB3 standard structure, DOCX with heading/list levels
- **Storage engine**: JSON + Markdown files by default; set `CONTINUUM_STORAGE=sqlite` to switch to the SQLite engine (sql.js, zero native deps) with identical interfaces
- **Plugin mechanism**: scans `data/plugins/*.js` on startup; plugins may ship metadata and an `onStart` hook; load failures only warn, never block

### 🤖 AI Assistant

- **Unified adapter**: custom providers beyond the presets, compatible with **OpenAI / Anthropic / Coze** API formats (auto-switched: `/chat/completions` · `/v1/messages` · `/v3/chat`) — config (API Key / Base URL / Model) + temperature + connection validation + optional Embedding model
- **Streaming chat**: supports chat / polish / continue / knowledge base scenarios, with optional "attach current chapter" and "inject knowledge base" (RAG reference snippets) — both on by default
- **Selection tools**: a floating bar appears on selection (polish / rewrite / translate / summarize / continue); results are confirmed in a compare dialog (original vs result) and written back with one click (Ctrl+R / Ctrl+J / Ctrl+Shift+T / Ctrl+Enter)
- **Transparent AI**: every request shows the injected context sources (e.g. "current chapter + 2 character cards"), so authors know what the AI is basing its answers on
- **Semantic search**: local BM25 (Chinese n-gram) works offline; when an Embedding model is configured it auto-upgrades to 50/50 BM25 + vector fusion, degrading gracefully on failure
- **Quota management**: AI features share a daily quota ledger (default 100/day, auto-reset), keeping usage clear and controllable

### 🎨 Experience & Utilities

- **Five themes**: Light / Dark / Sepia (eye-care light) / Sepia Dark / High Contrast — cycle with Ctrl+Alt+T, persisted
- **Command palette** (Ctrl+K): fuzzy-search over common actions, most-recent first
- **Notification center / Toast**: global lightweight toasts + bell notification history (Ctrl+Shift+N)
- **Immersive mode** (F11): hide everything and focus on writing; the floating bar keeps exit / theme / word count / goal progress
- **Window state persistence**: geometry, theme and panel states restored on restart
- **Utility tools**: global hotkey Ctrl+G to summon the window, cross-window text typing (fast/slow pacing), clipboard monitoring with one-click insert, always-on-top
- **FTUE guide**: a three-step first-run guide (create a work → write → AI polish), skippable and persisted

---

## Getting Started

### Requirements

- Node.js ≥ 18
- npm ≥ 9

### Install & Run

```bash
# Clone the repository
git clone https://github.com/RuanCH0924/continuum.git
cd continuum/desktop

# Install dependencies
npm install

# Start development mode (Electron + HMR)
npm run dev
```

**Windows users**: you can also double-click [`start_continuum.bat`](./start_continuum.bat) in the repo root for one-click startup (auto-detects Node.js and installs dependencies on first run).

> If the Electron binary download times out (common behind slow networks), retry after switching to a mirror registry, e.g. `npm config set registry https://registry.npmmirror.com`.

### Verify

```bash
npm run typecheck   # TypeScript type check (main + renderer)
npm test            # Vitest unit tests (242 cases / 29 files, all passing)
npm run build       # Production build (out/)
```

> Coverage: storage CRUD (file/SQLite), Markdown round-trip, outline & mind map parsing, AI streaming client, hotkeys & themes, cross-window typer core, writing stats, import/export, BM25 search, knowledge-injection context, UI component interaction. Full report in [docs/项目设计文档.md](./docs/项目设计文档.md#8-测试与验证报告).

### Sample Work

The repo ships a sample work under `desktop/data/works/` so you can try the editor, outline, clue and timeline features right away; delete the directory if you don't need it.

---

## AI Configuration

1. Open **AI Service Settings** from the top menu "设置" or the AI panel gear icon;
2. Pick a provider preset (DeepSeek / OpenAI / Anthropic / Coze / MiniMax / Kimi / Qwen / Zhipu GLM / Yi / SiliconFlow / Ollama) — or choose "**Custom provider…**" to plug in any service (e.g. a local gateway);
3. Choose the **API format**: OpenAI-compatible (default) / Anthropic / Coze — Anthropic uses `/v1/messages` (`x-api-key` + `anthropic-version`); Coze uses `/v3/chat` (put your Bot ID in the model field, your PAT as the key);
4. Fill in your API key (not required for local services like Ollama), choose a model and adjust temperature;
5. (Optional) Enter an **Embedding model** (e.g. `bge-large-zh` / `text-embedding-ada-002`) to enable semantic knowledge search; leave empty for keyword-only search;
6. Click "Test Connection" to validate, then save. Config is stored locally in `data/settings.json` only.

> With "inject knowledge base" checked in the chat tab, every message auto-retrieves the current work's content and knowledge and injects it as reference snippets (skipped silently on failure); AI usage is subject to the daily quota.

---

## Data Storage

All data lives under `desktop/data/`. Chapter content is **plain Markdown**, readable in any text editor:

```
data/
├── settings.json                     # Global settings (theme / AI / stats / daily goal / AI quota)
├── plugins/                          # Optional plugins (*.js)
└── works/
    └── <workId>/
        ├── meta.json                 # Work metadata
        ├── notes.json                # Creative knowledge (characters / world / clues / materials)
        ├── volumes.json              # Volume containers (chapter grouping & ownership)
        ├── timeline.json             # Timeline entries (time description + summary)
        ├── outline.json              # Outline nodes (rhythm tag / est. words / characters)
        ├── chapter_outlines.json     # Chapter outlines (per-chapter details)
        ├── mindmap.json              # Mind map data
        ├── embeddings.json           # Embedding vector cache (deletable, auto-rebuilt)
        ├── versions/                 # Version snapshots (≤ 50 per chapter)
        │   ├── index.json            # Snapshot index
        │   └── <seq>/<ts>.md         # Snapshot content
        └── chapters/
            ├── index.json            # Chapter title index
            └── 001_chapter-name.md   # Chapter content (plain Markdown)
```

> With `CONTINUUM_STORAGE=sqlite`, index data (works / chapters / volumes / timeline / outline / chapter outlines / mind maps / knowledge) moves into `data/continuum.db`; chapter bodies and version snapshots remain Markdown files, and the IPC surface stays identical.

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+K` | Command palette |
| `Ctrl+/` | Shortcut reference |
| `Ctrl+Alt+T` | Cycle themes |
| `F11` | Immersive mode |
| `Ctrl+\` | Cycle Edit / Preview mode |
| `Ctrl+R` | Polish selected text |
| `Ctrl+J` | Rewrite selected text |
| `Ctrl+Enter` | Continue from cursor |
| `Ctrl+Shift+T` | Translate selected text |
| `Ctrl+F` / `Ctrl+H` | Find / Replace |
| `Ctrl+Shift+F` | Global full-text search (all works) |
| `Ctrl+Shift+K` | Jump to knowledge-base search tab |
| `Ctrl+Shift+A` | Toggle AI panel |
| `Ctrl+Shift+E` | Export work (Markdown) |
| `Ctrl+Shift+N` | Notification center |
| `Ctrl+,` | AI service settings |
| `Ctrl+S` | Save chapter now |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+B` / `Ctrl+I` / `Ctrl+U` | Bold / Italic / Underline |
| `Ctrl+Alt+1/2/3` | H1 / H2 / H3 |
| `Ctrl+G` (global) | Bring window to front |

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Desktop | Electron 31 + electron-vite |
| UI | React 18 + TypeScript + Tailwind CSS 3 (CSS-variable theme matrix) |
| Editor | Tiptap 3 (ProseMirror) + markdown-it + turndown |
| State | Zustand |
| AI | Custom OpenAI-compatible client (fetch + SSE streaming, zero native deps) |
| Storage | File system (JSON + Markdown) by default; sql.js provides the SQLite engine |
| Export | printToPDF (PDF) + jszip (EPUB3) + docx (DOCX) |
| Testing | Vitest + Testing Library |
| Utilities | PowerShell WScript.Shell (cross-window typing, zero native deps) |

---

## Project Structure

```
Continuum/
├── desktop/                  # ★ Main application (Electron + React + TS)
│   ├── src/main/             # Main process (storage, IPC, search, AI extraction, utility services)
│   ├── src/preload/          # contextBridge secure bridge
│   ├── src/renderer/         # Renderer (React UI)
│   │   ├── components/       # Components (Editor / AI panel / Sidebar / Outline workspace / Mind map …)
│   │   ├── stores/           # Zustand stores (data / AI / UI / tools / toast)
│   │   ├── lib/              # markdown, AI adapter, RAG injection, import/export, hotkeys, annotation linking
│   │   └── styles/           # Design Tokens (CSS variables + theme matrix)
│   ├── src/shared/           # IPC protocol (60 channels) & domain types (main/renderer shared)
│   └── tests/                # Vitest unit tests (29 files / 242 cases, incl. RTL components)
├── design/                   # GUI design assets (prototype / spec / interaction docs)
├── docs/                     # Project docs (design doc / outline PRD / review reports / archive)
├── start_continuum.bat       # Windows one-click launcher
├── LICENSE                   # MIT License
├── README.md                 # Chinese README
└── README_EN.md              # This file
```

---

## Documentation

- [Project Design Document](./docs/项目设计文档.md) — ★ authoritative full-cycle doc: requirements, architecture, data model, IPC API, RAG design, test report, version timeline
- [Outline Module PRD](./docs/大纲模块产品需求文档.md) — full PRD for the outline workspace / chapter outlines / mind map / AI extract & Q&A
- [Clue Feature Review Report](./docs/伏笔功能需求核查报告.md) — implementation review of clue linking
- [GUI Design Specification](./design/GUI设计规范.md) — Design Tokens & theme system (fully implemented in desktop)
- [GUI Interaction Document](./design/GUI交互逻辑文档.md) — interaction behavior baseline
- Historical plans / tech decisions / milestone reports are archived under [docs/archive](./docs/archive/)

---

## Roadmap

**Completed (M0–M7)**: App shell → Data layer → Editor → Writing management → AI assistant → Experience layer → Utility tools → Acceptance.

**Post-acceptance increments**: data-driven status bar, import/export, creative knowledge model, hybrid RAG search, AI chat knowledge injection, interaction upgrades (selection toolbar / compare dialog / rewrite·translate / work wizard / format settings / find & replace / breadcrumb / FTUE …), global full-text search, version history, multi-format export (PDF/EPUB/DOCX), plugin mechanism, SQLite storage engine, volume hierarchy / timeline / clue linking, outline module (Round 8, 2026-08-16).

**Deferred (until development is complete)**:

- electron-builder packaging (Windows / macOS)
- P2 items such as the outline template center and structured character cards (see §12 of the design doc)

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-08-23 (Round 10) | AI access upgrade: custom providers beyond presets; unified client supports OpenAI / Anthropic / Coze API formats across chat, writing tools and chapter-outline extraction; new presets incl. Anthropic / Coze / MiniMax / Kimi / Qwen / Zhipu GLM / Yi and a format selector; 242 tests |
| 2026-08-23 (Round 9) | Home module: work gallery (cards + search / genre filter / pagination + hover & touch animations, click-through to detail) and statistics (metric cards + week/month/year writing bar chart with smooth transitions); "Home" header entry & breadcrumb return; data layer adds work genre (dual-engine persistence) and daily word records; 229 tests |
| 2026-08-16 (Round 8) | Outline module: outline workspace (outline tree / chapter outlines / mind map), granularity toggle, rhythm tags & estimated words, chapter-outline management, SVG mind map (3 templates + XMind import + bi-directional generation with outline), AI chapter-outline extraction (quota-based), outline-anchored Q&A, daily AI quota ledger; 209 tests |
| 2026-08-14 (Round 7) | Removed split-pane editing: single-pane live Markdown rendering (WYSIWYG), modes reduced to Edit/Preview/Source; 91 tests |
| 2026-08-14 (Round 6) | Timeline module (CRUD / reorder / inline realtime storage); body time-node highlight ↔ sidebar timeline entries bidirectional linking; 86 tests |
| 2026-08-14 (Round 5) | Chapter management optimization (volume containers), editor chapter-title block auto-insert & rename sync, clue linking (selection creation / bidirectional location / status sync); 74 tests |
| 2026-08-14 (Round 4) | Multi-format export (PDF/EPUB/DOCX), plugin mechanism, SQLite storage engine (sql.js), UI component tests (RTL); 62 tests |
| 2026-08-14 (Round 3) | Global full-text search (Ctrl+Shift+F), version history; 50 tests |
| 2026-08-14 | Added RAG semantic search & AI chat knowledge injection; creative knowledge model; full doc reconciliation (48 tests) |
| 2026-08-13 | M7 acceptance; data-driven status; import/export; rebuilt CN/EN README; one-click launcher; archived historical docs |
| 2026-08-11/12 | Migration to Electron + React + TS; M0–M3 milestones delivered |

---

## Contributing

Contributions of all kinds are welcome — code, docs, issues, or usage feedback.

1. Fork the repo and create a feature branch: `git checkout -b feature/xxx`
2. Commit with clear messages: `git commit -m "feat: xxx"`
3. Push and open a Pull Request
4. Add/update Vitest unit tests for new features

Issue guidelines: bug reports should include reproduction steps, expected vs actual behavior; feature requests should describe the use case and expected outcome.

---

## Contributors

- [RuanCH0924](https://github.com/RuanCH0924) — founder / architecture / all milestone development & maintenance

---

## License

This project is released under the [MIT License](./LICENSE). Free to use, modify and distribute, including commercially.

© 2026 [RuanCH0924](https://github.com/RuanCH0924)

---

*Continuum — let the story continue.*
