# Mike Console

A live, local dashboard for Startup Mike. See his thesis, the idea pool, kills,
signals and run log update **in real time** as Mike works.

## Run it
- **Easiest:** double-click `start.bat` (opens the browser and starts the server).
- **Or:** from the repo root, run `node console/server.js` and open http://localhost:4317

Needs Node.js. No `npm install` — it uses only Node built-ins.

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
