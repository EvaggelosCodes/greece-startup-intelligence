# Mike Console

A live, local dashboard for Startup Mike. See his thesis, the idea pool, kills,
signals and run log update **in real time** as Mike works.

## Open it
- **Easiest:** double-click **"Mike Console"** on your Desktop.
- Or double-click `console/start.bat`, or run `node console/server.js` and open http://localhost:4317

Needs Node.js. No `npm install` — it uses only Node built-ins. The launcher window
stays in the taskbar (minimized) — it's the server; **keep it open** for the console
and the scheduler to work. Closing it stops Mike's console.

## Running Mike from the console
- **RUN MIKE NOW** button → the server spawns the `claude` CLI headless in the repo.
  Mike does a full session (search → score → attack his darling → journal → commit/push),
  and you watch the pool, thesis and run log update **live** as he writes.
- **Model** opens the local provider settings. By default Mike is configured for
  OpenRouter's Anthropic-compatible endpoint with `openrouter/free`:
  `https://openrouter.ai/api`. You can switch the same panel back to Z.AI GLM.
- Paste your OpenRouter or Z.AI API key there and save it. The key is stored only in
  `console/provider.json`, which is ignored by git.
- **Schedule** (click *configure*): Off · Daily (at a time) · Weekly (day + time) ·
  Interval (every N hours). Saved to `schedule.json`. Because you chose the in-console
  scheduler, runs fire **only while this console is open** (the launcher window running).

### Important — a run is NOT free
The console itself costs **0 Claude credits**. But pressing RUN (or a scheduled run)
launches the real Mike agent, which **spends provider quota/credits** through the
configured model (OpenRouter by default), and runs with `--dangerously-skip-permissions` so it
can search, write files and `git push` unattended. That's required for one-click
autonomy — but it means a scheduled Mike acts on your machine without asking. Set
schedules with that in mind.

## Provider details
The server injects these env vars only into the headless Mike process:

OpenRouter:
```
ANTHROPIC_BASE_URL=https://openrouter.ai/api
ANTHROPIC_AUTH_TOKEN=<your OpenRouter key>
ANTHROPIC_API_KEY=
ANTHROPIC_DEFAULT_OPUS_MODEL=openrouter/free
ANTHROPIC_DEFAULT_SONNET_MODEL=openrouter/free
ANTHROPIC_DEFAULT_HAIKU_MODEL=openrouter/free
API_TIMEOUT_MS=3000000
```

Z.AI:
```
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_AUTH_TOKEN=<your Z.AI key>
ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.2[1m]
ANTHROPIC_DEFAULT_SONNET_MODEL=glm-5.2[1m]
ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-4.7
CLAUDE_CODE_AUTO_COMPACT_WINDOW=1000000
API_TIMEOUT_MS=3000000
```

You can also set `OPENROUTER_API_KEY`, `ZAI_API_KEY`, or `Z_AI_API_KEY` in the server
environment instead of saving a key in `provider.json`.

## How it works
- The server reads Mike's markdown files in `brain/`, `ideas/`, `daily-logs/`.
- It watches those folders and pushes updates to the browser via Server-Sent Events,
  so the moment Mike writes a file, the console reflects it (with a toast + flash).
- **It costs zero Claude credits to run** — it never calls an LLM. It's just a local
  file reader. Mike (the agent) is what spends credits; the console only *shows* him.

## What you see
- **Live activity** — model/auth status, run phases, searches, writes, kills and errors.
- **Stats** — pool size, top score, kills, learnings and runs.
- **The Pool** — ranked idea cards with score, trend, 7-dimension breakdown, why-now, risk.
- **What Mike Learned** — corrections and changed beliefs.
- **The Graveyard** — killed ideas with reasons.
- **Run Log** — one line per session.

## Local Windows catch-up scheduler
If you want Mike to run when the PC is on, without keeping the console open, install
the Windows scheduled task:

```
powershell -ExecutionPolicy Bypass -File local-automation/install-local-scheduler.ps1
```

It checks every 15 minutes and also on logon. If 2 hours have passed since the last
local run, it runs Mike once and sets the next due time 2 hours from that run. If the
PC was off during the scheduled window, the next login/check catches up automatically.

Remove it with:

```
powershell -ExecutionPolicy Bypass -File local-automation/uninstall-local-scheduler.ps1
```
