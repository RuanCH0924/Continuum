# Continuum (续言)

> Let the story continue — an open-source desktop writing assistant for Chinese web novel authors

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-2D7FF9)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
[中文](./README.md)

**Continuum (续言)** is an open-source Chinese web novel writing assistant. It keeps all your creative data local, and connects to any OpenAI-compatible AI model through a unified adapter — helping serial novel authors write more efficiently.

- **Data ownership**: works and chapter content are stored locally as plain Markdown — always yours, no platform lock-in
- **Bring your own key**: connect any OpenAI-compatible service (DeepSeek / OpenAI / SiliconFlow / Ollama) with your own API key
- **Writer-friendly**: Tiptap block editor + outline navigation + four editing modes, tuned for long-form serial writing
- **Knowledge-enhanced**: hybrid semantic search (local BM25 + optional Embeddings); AI chat auto-injects your work's knowledge context
- **Open source**: MIT licensed, free to use, modify and extend

### Development Status

| Item | Status |
| --- | --- |
| Current version | **v0.1.0** (all M0–M7 milestones + 6 post-acceptance increments) |
| Editor / writing management / AI assistant / five themes | ✅ Done |
| Creative knowledge base (characters / world / clues / materials) | ✅ Done |
| Import (Markdown) / Export (Markdown · TXT) | ✅ Done |
| RAG semantic search + AI chat knowledge injection | ✅ Done |
| Unit tests | ✅ 62 passing (11 test files, incl. UI components) |
| Multi-format export (PDF/EPUB/DOCX) / plugins / SQLite engine | ✅ Done |
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

- **Block rich text**: built on Tiptap (ProseMirror) with native support for headings, tables, task lists, code blocks, quotes, images and links
- **Four modes**: Edit / Split / Preview / Markdown source, switchable from a floating pill
- **Format toolbar**: bold / italic / strikethrough / H1–H3 / quote / ordered & unordered lists / task list / table / link / image / code block / horizontal rule / undo-redo
- **Manuscript typography**: Source Han Serif body, 1.9 line-height, 2em first-line indent — comfortable Chinese reading
- **Live stats & autosave**: real-time Chinese character count; debounced autosave (800ms) + instant save via Ctrl+S

### 📚 Writing Management

- **Work / chapter tree**: multiple works in parallel, search filter, double-click rename, one-click delete
- **Auto outline**: generated from headings in the document, click to jump
- **Welcome page**: "New / Import / Example" entries when no works exist; the example entry creates a demo chapter instantly
- **Creative knowledge base**: four sidebar tabs (Characters / World / Clues / Materials) for structured notes on casts, worldbuilding, plot threads and inspirations — all indexed by semantic search
- **Global full-text search**: Ctrl+Shift+F searches chapter text & knowledge across all works, jump with one click
- **Version history**: Ctrl+S snapshots the current chapter (50 per chapter), preview & restore anytime

### 📥 Import / Export

- **Markdown import**: as a new work (+ first chapter) or appended as a new chapter of the current work
- **Export**: chapter × (Markdown / TXT); work × (Markdown / TXT / **PDF** / **EPUB** / **DOCX**) — PDF via printToPDF, EPUB3 standard structure, DOCX with heading/list levels
- **Storage engine**: JSON + Markdown files by default; set `CONTINUUM_STORAGE=sqlite` to switch to the SQLite engine (sql.js, zero native deps) with identical interfaces

### 🤖 AI Assistant

- **Unified adapter**: any OpenAI-compatible endpoint — config (API Key / Base URL / Model) + temperature + connection validation + optional Embedding model
- **Streaming chat**: four AI tabs (Chat / Polish / Continue / Knowledge Base), with optional "attach current chapter" and "inject knowledge base" (RAG reference snippets) — both on by default
- **Polish & continue**: rewrite selected text without changing plot or characters; generate natural continuations from the cursor — apply results back with one click (Ctrl+R / Ctrl+Enter)
- **Semantic search**: local BM25 (Chinese n-gram) works offline; when an Embedding model is configured it auto-upgrades to 50/50 BM25 + vector fusion, degrading gracefully on failure

### 🎨 Experience & Utilities

- **Five themes**: Light / Dark / Sepia (eye-care light) / Sepia Dark / High Contrast — cycle with Ctrl+Alt+T, persisted
- **Command palette** (Ctrl+K): fuzzy-search over common actions
- **Notification center / Toast**: global lightweight toasts + bell notification history
- **Immersive mode** (F11): hide everything and focus on writing
- **Window state persistence**: geometry, theme and panel states restored on restart
- **Utility tools**: global hotkey Ctrl+G to summon the window, cross-window text typing (fast/slow pacing), clipboard monitoring with one-click insert, always-on-top

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
npm test            # Vitest unit tests (62 cases / 11 files, all passing)
npm run build       # Production build (out/)
```

> Coverage: storage CRUD, Markdown round-trip & outline, AI streaming client, hotkeys & themes, cross-window typer core, writing stats, import/export, BM25 search, knowledge-injection context. Full report in [docs/项目设计文档.md](./docs/项目设计文档.md#8-测试与验证报告).

---

## AI Configuration

1. Open **AI Service Settings** from the top menu "设置" or the AI panel gear icon;
2. Pick a provider preset (DeepSeek / OpenAI / SiliconFlow / Ollama) or enter a custom Base URL;
3. Fill in your API key (not required for local services like Ollama), choose a model and adjust temperature;
4. (Optional) Enter an **Embedding model** (e.g. `bge-large-zh` / `text-embedding-ada-002`) to enable semantic knowledge search; leave empty for keyword-only search;
5. Click "Test Connection" to validate, then save. Config is stored locally in `data/settings.json` only.

> With "inject knowledge base" checked in the chat tab, every message auto-retrieves the current work's content and knowledge and injects it as reference snippets (skipped silently on failure).

---

## Data Storage

All data lives under `desktop/data/`. Chapter content is **plain Markdown**, readable in any text editor:

```
data/
├── settings.json                     # Global settings (theme / AI / stats / window state)
└── works/
    └── <workId>/
        ├── meta.json                 # Work metadata
        ├── notes.json                # Creative knowledge (characters / world / clues / materials)
        ├── embeddings.json           # Embedding vector cache (deletable, auto-rebuilt)
        └── chapters/
            ├── index.json            # Chapter title index
            └── 001_chapter-name.md   # Chapter content (plain Markdown)
```

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+K` | Command palette |
| `Ctrl+/` | Shortcut reference |
| `Ctrl+Alt+T` | Cycle themes |
| `F11` | Immersive mode |
| `Ctrl+R` | Polish selected text |
| `Ctrl+Enter` | Continue from cursor |
| `Ctrl+S` | Save chapter now |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+B` / `Ctrl+I` | Bold / Italic |
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
| Testing | Vitest |
| Utilities | PowerShell WScript.Shell (cross-window typing, zero native deps) |

---

## Project Structure

```
Continuum/
├── desktop/                  # ★ Main application (Electron + React + TS)
│   ├── src/main/             # Main process (storage, IPC, utility services)
│   ├── src/preload/          # contextBridge secure bridge
│   ├── src/renderer/         # Renderer (React UI)
│   │   ├── components/       # Components (AppShell / Editor / AI panel / Sidebar …)
│   │   ├── stores/           # Zustand stores (data / AI / UI / tools / toast)
│   │   ├── lib/              # markdown, AI adapter, RAG injection, import/export, hotkeys
│   │   └── styles/           # Design Tokens (CSS variables + theme matrix)
│   ├── src/shared/           # IPC protocol & domain types (main/renderer shared)
│   └── tests/                # Vitest unit tests (9 files / 48 cases)
├── design/                   # GUI design assets (prototype / spec / interaction docs)
├── docs/                     # Project docs
│   ├── 项目设计文档.md        # ★ authoritative full-cycle doc (architecture / data / API / tests / timeline)
│   └── archive/              # Archived docs (historical plans & reports)
├── start_continuum.bat       # Windows one-click launcher
├── LICENSE                   # MIT License
├── README.md                 # Chinese README
└── README_EN.md              # This file
```

---

## Documentation

- [Project Design Document](./docs/项目设计文档.md) — ★ authoritative full-cycle doc: requirements, architecture, data model, IPC API, RAG design, test report, version timeline
- [GUI Design Specification](./design/GUI设计规范.md) — Design Tokens & theme system (fully implemented in desktop)
- [GUI Interaction Document](./design/GUI交互逻辑文档.md) — interaction behavior baseline
- Historical plans / tech decisions / milestone reports are archived under [docs/archive](./docs/archive/)

---

## Roadmap

**Completed (M0–M7)**: App shell → Data layer → Editor → Writing management → AI assistant → Experience layer → Utility tools → Acceptance.
**Post-acceptance increments**: data-driven status bar, import/export, creative knowledge model, hybrid RAG search, AI chat knowledge injection, interaction upgrades (selection toolbar / compare dialog / rewrite·translate / work wizard / format settings / find & replace / breadcrumb / FTUE …), global full-text search, version history, multi-format export (PDF/EPUB/DOCX), plugin mechanism, SQLite storage engine, UI component tests.

**Deferred (until development is complete)**:

- electron-builder packaging (Windows / macOS)

---

## Changelog

| Date | Change |
| --- | --- |
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
