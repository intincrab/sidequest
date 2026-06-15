# sidequest

**Learn something while your coding agent is busy.**

When you fire off a long task in **Claude Code** (or Codex), there's dead time while it
works — sometimes seconds, sometimes minutes. `sidequest` is a small terminal panel that
reclaims that time to teach you a topic of **your choice** — the fall of Rome, how black
holes work, Spanish basics, the bond market — in bite-sized lessons from a cheap LLM, with
its own persistent memory so each wait picks up exactly where you left off. When the agent
finishes, it nudges you back.

```
┌─ Claude Code ─────────────┐ ┌─ sidequest ────────────────────┐
│  > refactor the auth flow │ │  📚 how black holes work · L28 │
│    …working…              │ │  agent ● busy — learn while…   │
│                           │ │                                │
│                           │ │  Black holes might be the      │
│                           │ │  universe's way of creating    │
│                           │ │  life by regulating galaxy …   │
│                           │ │  › /next  /deeper  /topics     │
└──────────┬────────────────┘ └───────────────▲────────────────┘
           │  SessionStart / tool hooks        │ localhost event
           └───────────────────────────────────┘
```

It's the dead time, reclaimed. The lessons are unrelated to your code — that's the point.

---

## How it works

1. The panel runs a tiny localhost listener (`127.0.0.1:4317` by default).
2. **Claude Code hooks** (installed into `settings.json`) fire a fire-and-forget script on
   every `UserPromptSubmit` / tool use / `Stop`, telling the panel when the agent is busy
   vs. idle. The script never blocks the agent (300 ms timeout, always exits 0).
3. While the agent is busy, the panel auto-serves the next bite-sized lesson on your topic.
4. Lessons come from a **pluggable cheap model** — Zhipu **GLM**, Anthropic **Haiku**, or an
   OpenAI **mini** model.
5. Each topic's conversation is saved under `~/.sidequest/topics/`, so you can stop and
   resume any time — days later it continues mid-thought.

---

## Requirements

- **Node.js 18.18+**
- An API key for one provider (GLM is free-tier friendly — see below)
- **[Claude Code](https://docs.claude.com/en/docs/claude-code)** (the agent side)
- **[Windows Terminal](https://aka.ms/terminal)** — only needed for the one-command
  side-by-side `pair` layout (everything else works in any terminal)

---

## Install

```bash
git clone https://github.com/<you>/sidequest.git
cd sidequest
npm install
npm link            # optional: makes `sidequest` available globally
```

Then wire it into Claude Code (merges hooks into your global `~/.claude/settings.json`):

```bash
npm run install:claude -- --global
```

---

## Configure

Pick a provider and give it a key. Copy `.env.example` to `.env`:

```bash
# .env  (gitignored — never commit this)
SIDEQUEST_PROVIDER=glm
GLM_API_KEY=your-key-here
```

| Provider   | Set `SIDEQUEST_PROVIDER` | Key env var        | Default model      | Notes                       |
| ---------- | ------------------------ | ------------------ | ------------------ | --------------------------- |
| Zhipu GLM  | `glm`                    | `GLM_API_KEY`      | `glm-4.5-flash`    | OpenAI-compatible; free tier |
| Anthropic  | `anthropic`              | `ANTHROPIC_API_KEY`| `claude-haiku-4-5` | —                           |
| OpenAI     | `openai`                 | `OPENAI_API_KEY`   | `gpt-4o-mini`      | —                           |

Optional settings live in `~/.sidequest/config.json`:

```jsonc
{
  "provider": "glm",
  "model": "glm-4.5-flash",
  "defaultTopic": "how black holes work", // auto-loads on launch
  "lessonStyle": "concise and vivid, ~130 words, one memorable detail",
  "autoAdvanceOnBusy": true,               // serve the next lesson when the agent is busy
  "autoLaunch": false                      // auto-open the panel on Claude Code start (Windows Terminal)
}
```

---

## Usage

### One command, side by side (recommended)

From any project folder:

```bash
sidequest pair               # Claude Code (this folder) + sidequest, split in one window
sidequest pair C:\some\proj  # …or target a specific folder
```

This opens a single **Windows Terminal** window split into two panes: your agent on the
left, sidequest docked on the right.

### Or run them separately (any terminal)

```bash
# pane A
npm start          # the sidequest panel
# pane B
claude             # your agent, as usual
```

### TUI commands

| You type            | What happens                                        |
| ------------------- | --------------------------------------------------- |
| `the history of jazz` | start a new topic                                 |
| `/next` · `/n`      | next bite-sized lesson                              |
| `/deeper` · `/d`    | go one layer deeper on the current idea             |
| `/topic <name>`     | switch to / start another topic                     |
| `/topics`           | list saved topics (all resumable)                   |
| *any question*      | ask the tutor — answered in the topic's own context |
| `/quit` · `Ctrl+C`  | exit                                                |

### Auto-open (Windows Terminal only)

Set `"autoLaunch": true` in config and the `SessionStart` hook will open sidequest
automatically whenever you start Claude Code — docking into the current window if you're in
Windows Terminal, otherwise in its own window.

---

## Supported terminals

| Terminal                     | Docked side-by-side?            |
| ---------------------------- | ------------------------------- |
| Windows Terminal             | ✅ via `sidequest pair`         |
| Warp / PowerShell / cmd      | Separate window (no split API)  |
| VS Code integrated terminal  | Separate window                 |

Only Windows Terminal exposes a CLI to split itself, so true in-window docking is
WT-specific. Everywhere else, sidequest opens its own window beside your agent.

---

## The learning design

The bet: you lose 30–90 seconds dozens of times a day waiting on an agent — enough for one
idea. So sidequest is built for **micro-learning in the gaps**:

- **One idea per lesson** — respects working-memory limits; no info-dumps.
- **Builds on context** — the model keeps the whole thread, so lessons scaffold instead of
  repeat.
- **Resume, don't restart** — per-topic memory means learning is spaced across many short
  sittings (which beats cramming).
- **A hook every time** — each lesson ends with a question that pulls you into the next.
- **You can steer** — `/deeper` and free questions turn passive reading into active recall.

> Honest scope: today it's a frictionless, continuous **explainer**. Making knowledge
> *stick* would benefit from active recall/quizzing and spaced repetition — both on the
> roadmap.

---

## Roadmap

- [x] Claude Code adapter (hooks → busy/idle)
- [x] Pluggable provider (GLM / Anthropic / OpenAI)
- [x] Topic-based bite-sized lessons with persistent context
- [x] Ink TUI + `pair` (side-by-side) launcher
- [ ] Codex CLI adapter (`notify` in `~/.codex/config.toml`)
- [ ] Universal PTY wrapper (`sidequest run -- <agent>`) for any CLI
- [ ] Active-recall / quiz mode + spaced repetition

---

## Development

```bash
npm run typecheck     # strict TypeScript, no emit
npm test              # headless suite: core state, hook round-trip, TUI render
npm run test:live     # full pipeline against the live model (needs a key in .env)
npm run doctor        # show config / keys / runtime status
```

Layout:

```
src/
  cli.ts            # entry: run | pair | install claude | doctor
  config.ts         # ~/.sidequest config + runtime
  providers/        # Provider interface + glm/anthropic/openai
  core/             # AgentMonitor (busy/idle) + localhost event server
  learning/         # engine, per-topic store, tutor prompts
  tui/App.tsx       # the Ink panel
  install/claude.ts # merges hooks into settings.json
hooks/              # forward.mjs (events) + autostart.mjs (auto-open)
```

---

## License

MIT
