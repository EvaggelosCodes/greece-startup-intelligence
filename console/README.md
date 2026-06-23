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
- **Schedule** (click *configure*): Off · Daily (at a time) · Weekly (day + time) ·
  Interval (every N hours). Saved to `schedule.json`. Because you chose the in-console
  scheduler, runs fire **only while this console is open** (the launcher window running).

### Important — a run is NOT free
The console itself costs **0 Claude credits**. But pressing RUN (or a scheduled run)
launches the real Mike agent, which **spends credits** like any Claude session, and runs
with `--dangerously-skip-permissions` so it can search, write files and `git push`
unattended. That's required for one-click autonomy — but it means a scheduled Mike acts
on your machine without asking. Set schedules with that in mind.

## How it works
- The server reads Mike's markdown files in `brain/`, `ideas/`, `daily-logs/`.
- It watches those folders and pushes updates to the browser via Server-Sent Events,
  so the moment Mike writes a file, the console reflects it (with a toast + flash).
- **It costs zero Claude credits to run** — it never calls an LLM. It's just a local
  file reader. Mike (the agent) is what spends credits; the console only *shows* him.

## What you see
- **On Mike's mind** — his current thesis + the agenda he set himself + what's nagging him.
- **Stats** — pool size, top score, avg, kills, runs, facts known.
- **The Pool** — ranked idea cards with score, trend, 7-dimension breakdown, why-now, risk.
- **Signals & Hunches** — what he's tracking and his unproven leads.
- **The Graveyard** — killed ideas with reasons.
- **Run Log** — one line per session.
