'use strict';
/*
 * MIKE CONSOLE — local, live, zero-credit.
 * Reads Mike's markdown brain/idea files and serves a live dashboard.
 * No dependencies (Node built-ins only). No Claude/API calls. Pure local.
 *   run:  node console/server.js   →   http://localhost:4317
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
function resolveClaude() {
  try { const p = execSync(process.platform === 'win32' ? 'where claude' : 'which claude', { encoding: 'utf8' }).split(/\r?\n/)[0].trim(); if (p) return p; } catch {}
  return 'claude';
}
const CLAUDE = resolveClaude();

const ROOT = path.join(__dirname, '..');
const PORT = process.env.MIKE_PORT || 4317;
const WATCH_DIRS = ['brain', 'ideas', 'daily-logs'].map(d => path.join(ROOT, d));

// ---------- helpers ----------
function normalizeMarkdown(md) {
  // Some headless agents copy numbered Read output back into files as "12\t## Heading".
  // Strip only tab-prefixed source line numbers; keep real markdown numbered lists.
  return String(md || '').replace(/^\d+\t/gm, '');
}
const read = rel => { try { return normalizeMarkdown(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return ''; } };
const safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function section(md, header) {
  // grab text under "## HEADER" until the next "## " heading, rule, or end (no /m → $ = true EOF)
  const re = new RegExp('##\\s+' + header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|\\n---|\\n\\*\\[|$)', 'i');
  const m = md.match(re);
  return m ? m[1].trim() : '';
}
// list items only (new item on a -/*/N. marker); wrapped continuation lines join the prior item
function bullets(txt) {
  const out = [];
  txt.split('\n').forEach(raw => {
    const l = raw.trim();
    if (!l || l.startsWith('*[') || /^#{1,6}\s/.test(l) || /^\*[^*]+\*$/.test(l)) return;
    const m = l.match(/^([-*]|\d+\.)\s+(.*)/);
    if (m) out.push(m[2].trim());
    else if (out.length) out[out.length - 1] += ' ' + l;
  });
  return out;
}

// ---------- parsers ----------
function parseIdeas(md) {
  return md.split(/^###\s+/m).slice(1).map(block => {
    const head = block.split('\n')[0] || '';
    const name = head.split(/\s+-\s+Score:/)[0].trim();
    const score = parseFloat((head.match(/Score:\s*([\d.]+)/) || [])[1]) || null;
    const fields = {};
    let fm; const fre = /\*\*(.+?):\*\*\s*([^\n]+)/g;
    while ((fm = fre.exec(block))) fields[fm[1].trim()] = fm[2].trim();
    const breakdown = [];
    let bm; const bre = /([A-Z_]{3,}):(\d+)/g;
    const bsrc = fields['Score breakdown'] || '';
    while ((bm = bre.exec(bsrc))) breakdown.push({ k: bm[1], v: +bm[2] });
    const trendRaw = (fields['Score history'] || '') + (fields['Trending'] || '');
    const trend = /up|climb|improv|rising/i.test(trendRaw) ? 'up'
      : /down|weaken|cool|declin/i.test(trendRaw) ? 'down' : 'flat';
    return {
      name, score,
      actionable: /ACTIONABLE/.test(head),
      tier: score >= 8 ? 'priority' : score >= 6.5 ? 'good' : 'low',
      what: fields['What it is'] || fields['Simple version'] || '',
      whyNow: fields['Timing signal'] || fields['Why right now'] || '',
      revenue: fields['Realistic Month 1 revenue'] || fields['You could make'] || '',
      risk: fields['Biggest risk'] || fields['The catch'] || '',
      grounded: fields['Grounded in'] || '',
      breakdown, trend
    };
  }).filter(i => i.name).sort((a, b) => (b.score || 0) - (a.score || 0));
}

function tableRows(md) {
  return md.split('\n').filter(l => l.trim().startsWith('|'))
    .map(l => l.split('|').slice(1, -1).map(c => c.trim()))
    .filter(c => c.length && !/^-+$/.test(c[0]) && c[0] !== '-' && c[0] !== '');
}

function parseKilled(md) {
  return tableRows(md)
    .filter(c => c[0] && !/date\s*killed/i.test(c[0]) && c[1] && c[1] !== '-')
    .map(c => ({ date: c[0], idea: c[1], score: c[2], reason: c[3], type: c[4], revisit: c[5] }));
}

function parseSignals(md) {
  return tableRows(md)
    .filter(c => c[0] && !/^signal$/i.test(c[0]) && c[1] && /ACTIVE|RESOLVED|EXPIRED|ACCELER|STALL/i.test(c[1]))
    .map(c => {
      const raw = (c[2] || '').toLowerCase();
      const dir = /up/.test(raw) ? 'up' : /down/.test(raw) ? 'down' : /stable|flat/.test(raw) ? 'flat' : 'unknown';
      return { name: c[0], status: c[1], dir, note: c[4] || '' };
    });
}

function parseTop3(md) {
  const part = md.split(/^##\s+/m).find(p => /#1:/.test(p));
  if (!part) return null;
  const head = part.split('\n')[0];
  const fields = {}; let fm; const fre = /\*\*(.+?):\*\*\s*([^\n]+)/g;
  while ((fm = fre.exec(part))) fields[fm[1].trim()] = fm[2].trim();
  const play = part.split('\n').filter(l => /^-\s*(Mon|Tue|Wed|Thu|Fri):/i.test(l.trim()))
    .map(l => l.replace(/^-\s*/, '').trim());
  return {
    name: (head.split(':').slice(1).join(':') || '').split(/\s+-\s*[\d.]+/)[0].trim(),
    score: parseFloat((head.match(/-\s*([\d.]+)/) || [])[1]) || null,
    actionable: /ACTIONABLE/.test(head),
    simple: fields['Simple version'] || '',
    whyNow: fields['Why right now'] || '',
    catch: fields['The catch'] || '',
    playbook: play
  };
}

function maskKey(key) {
  if (!key) return '';
  return key.length <= 10 ? '*'.repeat(key.length) : `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function parseCorrections(md) {
  return md.split(/\n\*\*(?=\d{4}-\d{2}-\d{2})/).slice(1).map(b => {
    const head = b.split('\n')[0];
    return {
      date: (head.match(/\d{4}-\d{2}-\d{2}/) || [])[0] || '',
      title: (head.split(/\s+-\s+/)[1] || head).replace(/\*+/g, '').trim(),
      truth: ((b.match(/\*What is actually true:\*\s*([^\n]+)/) || [])[1] || '').trim(),
      change: ((b.match(/\*How this changes my thinking:\*\s*([^\n]+)/) || [])[1] || '').trim()
    };
  }).reverse();
}

function buildState() {
  const ideasMd = read('ideas/ALL_IDEAS.md');
  const journalMd = read('brain/MIKE_JOURNAL.md');
  const knowledgeMd = read('brain/MARKET_KNOWLEDGE.md');
  const ideas = safe(() => parseIdeas(ideasMd), []);
  const killed = safe(() => parseKilled(read('ideas/KILLED_IDEAS.md')), []);
  const signals = safe(() => parseSignals(read('brain/TRACKED_SIGNALS.md')), []);
  const runs = safe(() => bullets(read('ideas/RESEARCH_LOG.md')).reverse(), []);
  const facts = (knowledgeMd.match(/^(STABLE_FACT|TRACKED_SIGNAL|MARKET_PATTERN|HYPOTHESIS|CORRECTION)\s*\|/gm) || []).length;
  const learned = safe(() => parseCorrections(read('brain/CORRECTIONS.md')), []);
  const logs = safe(() => fs.readdirSync(path.join(ROOT, 'daily-logs')).filter(f => /^\d{4}-\d{2}-\d{2}.*\.md$/.test(f)).sort(), []);
  const scores = ideas.map(i => i.score).filter(Boolean);

  return {
    generatedAt: Date.now(),
    mike: {
      thesis: section(journalMd, 'CURRENT THESIS'),
      agenda: bullets(section(journalMd, 'MY AGENDA')),
      hunches: bullets(section(journalMd, 'HUNCHES')),
      nagging: section(journalMd, "WHAT'S NAGGING ME")
    },
    top: safe(() => parseTop3(read('ideas/TOP3.md')), null),
    stats: {
      pool: ideas.length,
      top: scores.length ? Math.max(...scores) : 0,
      killed: killed.length,
      learnings: learned.length,
      runs: Math.max(runs.length, logs.length),
      facts,
      lastRun: logs.length ? logs[logs.length - 1].replace('.md', '') : '—'
    },
    ideas, killed, runs, learned,
    run: {
      running: runState.running, startedAt: runState.startedAt, lastRun: runState.lastRun,
      lastExit: runState.lastExit, lastDurationMs: runState.lastDurationMs, trigger: runState.trigger,
      phase: runState.phase, phaseIndex: runState.phaseIndex, phases: PHASES,
      turns: runState.turns, cost: runState.cost, activity: runState.activity.slice(-80),
      lastError: runState.lastError
    },
    provider: publicProvider(effectiveProvider()),
    schedule, nextRun: nextRunEstimate()
  };
}

// ---------- live (SSE) ----------
const clients = new Set();
function send(obj) {
  const payload = `data: ${JSON.stringify(obj)}\n\n`;
  for (const c of clients) { try { c.write(payload); } catch {} }
}
let timer = null, lastFile = '';
for (const dir of WATCH_DIRS) {
  try {
    fs.watch(dir, { recursive: true }, (_e, fn) => {
      if (fn) lastFile = path.join(path.basename(dir), fn).replace(/\\/g, '/');
      clearTimeout(timer);
      timer = setTimeout(() => send({ type: 'change', file: lastFile, at: Date.now() }), 180);
    });
  } catch {}
}

// ---------- runs: spawn Mike headless, stream his real activity ----------
const SCHED_FILE = path.join(__dirname, 'schedule.json');
const PHASES = ['Waking up', 'Researching', 'Scoring & killing', 'Learning', 'Writing up', 'Committing'];
const runState = { running: false, startedAt: 0, lastRun: 0, lastExit: null, lastDurationMs: 0, trigger: '', phase: '', phaseIndex: -1, turns: 0, cost: 0, activity: [], lastError: '' };
let schedule = { enabled: false, mode: 'daily', time: '09:00', day: 1, intervalMin: 1440 };
try { schedule = Object.assign(schedule, JSON.parse(fs.readFileSync(SCHED_FILE, 'utf8'))); } catch {}
const saveSched = () => { try { fs.writeFileSync(SCHED_FILE, JSON.stringify(schedule, null, 2)); } catch {} };

// provider: point the headless run at OpenRouter/Z.AI (Anthropic-compatible APIs) with your own key
const PROVIDER_FILE = path.join(__dirname, 'provider.json');
const PROVIDERS = {
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api',
    model: 'openrouter/free',
    smallModel: 'openrouter/free',
    envKeyNames: ['OPENROUTER_API_KEY']
  },
  zai: {
    name: 'Z.AI GLM',
    baseUrl: 'https://api.z.ai/api/anthropic',
    model: 'glm-5.2[1m]',
    smallModel: 'glm-4.7',
    envKeyNames: ['ZAI_API_KEY', 'Z_AI_API_KEY']
  }
};
const PROVIDER_DEFAULTS = {
  enabled: true,
  type: 'openrouter',
  timeoutMs: 1500000
};
function loadProvider() { try { return JSON.parse(fs.readFileSync(PROVIDER_FILE, 'utf8')); } catch { return {}; } }
function saveProvider(p) { try { fs.writeFileSync(PROVIDER_FILE, JSON.stringify(p, null, 2)); } catch {} }
function normalizeProvider(cfg) {
  const p = Object.assign({}, PROVIDER_DEFAULTS, cfg || {});
  p.type = PROVIDERS[p.type] ? p.type : (String(p.baseUrl || '').includes('openrouter.ai') ? 'openrouter' : 'zai');
  const preset = PROVIDERS[p.type];
  p.enabled = p.enabled !== false;
  p.name = String(p.name || preset.name).trim();
  p.baseUrl = String(p.baseUrl || preset.baseUrl).trim().replace(/\s+$/, '');
  p.model = String(p.model || preset.model).trim();
  p.smallModel = String(p.smallModel || preset.smallModel).trim();
  p.apiKey = String(p.apiKey || '').trim();
  p.timeoutMs = Math.max(60000, Number(p.timeoutMs || PROVIDER_DEFAULTS.timeoutMs));
  return p;
}
function effectiveProvider() {
  const p = normalizeProvider(loadProvider());
  const keyNames = (PROVIDERS[p.type] || PROVIDERS.openrouter).envKeyNames || [];
  const envKey = keyNames.map(k => (process.env[k] || '').trim()).find(Boolean) || '';
  if (!p.apiKey && envKey) {
    p.apiKey = envKey;
    p.keySource = 'env';
  } else if (p.apiKey) {
    p.keySource = 'provider.json';
  }
  return p;
}
function publicProvider(cfg) {
  const p = normalizeProvider(cfg);
  const ready = !p.enabled || !!p.apiKey;
  return {
    enabled: p.enabled,
    ready,
    configured: !!p.apiKey,
    keySource: p.keySource || '',
    keyPreview: maskKey(p.apiKey),
    type: p.type,
    name: p.name,
    baseUrl: p.baseUrl,
    model: p.model,
    smallModel: p.smallModel,
    timeoutMs: p.timeoutMs,
    contextWindow: /\[1m\]/i.test(p.model) ? 1000000 : 200000,
    message: ready ? '' : `Save an ${p.name} API key before running Mike.`
  };
}
function providerEnv(cfg) {
  const p = normalizeProvider(cfg);
  if (!p.enabled || !p.apiKey) return {};
  const m = p.model || PROVIDER_DEFAULTS.model;
  const isOpenRouter = p.type === 'openrouter';
  const env = {
    ANTHROPIC_BASE_URL: p.baseUrl,
    ANTHROPIC_AUTH_TOKEN: p.apiKey,
    ANTHROPIC_API_KEY: isOpenRouter ? '' : p.apiKey,
    OPENROUTER_API_KEY: isOpenRouter ? p.apiKey : (process.env.OPENROUTER_API_KEY || ''),
    ANTHROPIC_MODEL: m,
    ANTHROPIC_DEFAULT_SONNET_MODEL: m,
    ANTHROPIC_DEFAULT_OPUS_MODEL: m,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: p.smallModel || m,
    ANTHROPIC_SMALL_FAST_MODEL: p.smallModel || m,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    API_TIMEOUT_MS: String(p.timeoutMs)
  };
  if (/\[1m\]/i.test(m)) env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = '1000000';
  return env;
}

const RUN_PROMPT = [
  'You are Startup Mike. Run the bounded daily research loop in CLAUDE.md. Hard constraint: finish in under 25 minutes wall-clock, even if that means a smaller complete run.',
  'Read only the required current memory files: CLAUDE.md, brain/MIKE_JOURNAL.md, brain/SEARCH_PLAYBOOK.md, brain/RESEARCH_METHODOLOGY.md, brain/RESEARCH_SOURCES.md, brain/MARKET_KNOWLEDGE.md, brain/TRACKED_SIGNALS.md, brain/RESEARCH_GAPS.md, brain/CORRECTIONS.md, ideas/ALL_IDEAS.md, ideas/TOP3.md, ideas/KILLED_IDEAS.md, and the latest daily log if present. Do not read archives or old logs.',
  'Pick 2-3 targets. Run 4-7 sharp Greek-first WebSearch queries total. Use snippets, not WebFetch, unless one missing number is essential.',
  'Apply the methodology quality bar. Score existing ideas and any new candidate. Kill weak candidates in ideas/KILLED_IDEAS.md; do not silently discard them.',
  'Attack the current #1 idea once. Update only files whose content actually changed: ALL_IDEAS, TOP3, KILLED_IDEAS, RESEARCH_LOG, MIKE_JOURNAL, CORRECTIONS, MARKET_KNOWLEDGE, SEARCH_PLAYBOOK, TRACKED_SIGNALS, RESEARCH_GAPS, and today daily log.',
  'Keep writing concise. Append exactly one research-log bullet. Commit and push. Prefer a small complete run over a huge run that exceeds context.'
].join(' ');

const shortP = p => (p || '').replace(/\\/g, '/').split('/').slice(-2).join('/');
function setPhase(name) {
  const i = PHASES.indexOf(name);
  if (i >= 0 && i >= runState.phaseIndex) { runState.phase = name; runState.phaseIndex = i; }
}
function emitActivity(kind, text) {
  const a = { kind, text: (text || '').slice(0, 220), at: Date.now() };
  runState.activity.push(a);
  if (runState.activity.length > 250) runState.activity = runState.activity.slice(-250);
  send({ type: 'run', state: 'activity', kind: a.kind, text: a.text, phase: runState.phase, phaseIndex: runState.phaseIndex, at: a.at });
}
function rememberRunError(text) {
  const s = String(text || '').trim();
  if (!s) return;
  if (/401|invalid auth|unauthorized|authentication|auth token|api key/i.test(s)) {
    runState.lastError = 'Authentication failed. Check the API key in Model settings.';
  } else if (/maximum context length|context length|reduce the length|max_tokens|too many tokens/i.test(s)) {
    runState.lastError = 'Context limit hit. Mike tried to send too much context/output; restart the console and run again with the compact prompt.';
  } else if (/insufficient|quota|balance|rate limit|too many requests/i.test(s)) {
    runState.lastError = 'Provider quota or rate limit error. Check your provider plan/quota.';
  } else if (!runState.lastError && /error|failed|exception/i.test(s)) {
    runState.lastError = s.slice(0, 220);
  }
}
function emitTool(name, input) {
  input = input || {};
  if (name === 'WebSearch') { setPhase('Researching'); return emitActivity('search', input.query || ''); }
  if (name === 'WebFetch') { setPhase('Researching'); return emitActivity('search', 'fetch ' + (input.url || '')); }
  if (name === 'Read') { return emitActivity('read', shortP(input.file_path)); }
  if (name === 'Edit' || name === 'Write' || name === 'NotebookEdit') {
    const f = shortP(input.file_path);
    if (/KILLED/i.test(f)) setPhase('Scoring & killing');
    else if (/CORRECTIONS|JOURNAL|PLAYBOOK/i.test(f)) setPhase('Learning');
    else if (/daily-logs/i.test(f)) setPhase('Writing up');
    return emitActivity('write', f);
  }
  if (name === 'Bash') {
    const c = (input.command || '').trim();
    if (/git (commit|push)/.test(c)) setPhase('Committing');
    return emitActivity('bash', c.slice(0, 70));
  }
  if (name === 'Grep' || name === 'Glob') return emitActivity('scan', input.pattern || '');
  return emitActivity('tool', name);
}
function handleEvent(ev) {
  if (!ev || !ev.type) return;
  if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
    for (const c of ev.message.content) {
      if (c.type === 'text' && c.text && c.text.trim()) emitActivity('think', c.text.trim());
      else if (c.type === 'tool_use') emitTool(c.name, c.input);
    }
  } else if (ev.type === 'result') {
    if (typeof ev.total_cost_usd === 'number') runState.cost = ev.total_cost_usd;
    if (typeof ev.num_turns === 'number') runState.turns = ev.num_turns;
    if (ev.is_error && ev.result) rememberRunError(ev.result);
  }
}

function startRun(trigger) {
  if (runState.running) return false;
  const provider = effectiveProvider();
  if (provider.enabled && !provider.apiKey) {
    Object.assign(runState, {
      running: false, startedAt: Date.now(), trigger, phase: 'Config needed', phaseIndex: -1,
      turns: 0, cost: 0, activity: [], lastError: `Save an ${provider.name} API key before running Mike.`
    });
    emitActivity('log', runState.lastError);
    send({ type: 'run', state: 'error', error: runState.lastError, at: Date.now() });
    return false;
  }
  Object.assign(runState, { running: true, startedAt: Date.now(), trigger, phase: 'Waking up', phaseIndex: 0, turns: 0, cost: 0, activity: [], lastError: '' });
  send({ type: 'run', state: 'started', trigger, at: Date.now() });
  console.log(`  ▶ run started (${trigger}) via ${CLAUDE}`);
  emitActivity('log', provider.enabled ? `provider: ${provider.name} ${provider.model}` : 'provider: Claude default auth');
  let child;
  try {
    child = spawn(CLAUDE, ['-p', RUN_PROMPT, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'],
      { cwd: ROOT, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, providerEnv(provider)) });
  } catch (e) {
    runState.running = false; emitActivity('log', 'spawn error: ' + e.message);
    send({ type: 'run', state: 'error', at: Date.now() }); return false;
  }
  let buf = '';
  const runTimeout = setTimeout(() => {
    runState.lastError = `Run stopped after ${Math.round(provider.timeoutMs / 60000)} minutes to keep the 2-hour cadence healthy.`;
    emitActivity('log', runState.lastError);
    try { child.kill(); } catch {}
  }, provider.timeoutMs);
  child.stdout.on('data', d => {
    buf += d.toString(); let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (line.trim()) { try { handleEvent(JSON.parse(line)); } catch {} }
    }
  });
  child.stderr.on('data', d => {
    const s = d.toString().trim();
    rememberRunError(s);
    if (s && !/DeprecationWarning|no stdin|trace-deprecation/.test(s)) emitActivity('log', s.slice(0, 220));
  });
  child.on('error', e => { rememberRunError(e.message); emitActivity('log', 'error: ' + e.message); });
  child.on('close', code => {
    clearTimeout(runTimeout);
    runState.running = false; runState.lastRun = Date.now();
    runState.lastExit = code; runState.lastDurationMs = Date.now() - runState.startedAt;
    runState.phase = 'Done'; runState.phaseIndex = PHASES.length;
    if (code !== 0 && !runState.lastError) runState.lastError = `Headless claude exited with code ${code}.`;
    send({ type: 'run', state: 'finished', code, cost: runState.cost, turns: runState.turns, error: runState.lastError, at: Date.now() });
    console.log(`  ✔ run finished (exit ${code}, ${Math.round(runState.lastDurationMs / 1000)}s, ${runState.turns} turns, $${(runState.cost || 0).toFixed(3)})`);
  });
  return true;
}

function testProviderOnce() {
  const provider = effectiveProvider();
  if (provider.enabled && !provider.apiKey) {
    return Promise.resolve({ ok: false, error: `Save an ${provider.name} API key first.`, provider: publicProvider(provider) });
  }
  return new Promise(resolve => {
    const args = ['-p', 'Reply with exactly GLM_OK.', '--output-format', 'stream-json', '--verbose'];
    let child;
    try {
      child = spawn(CLAUDE, args, {
        cwd: ROOT,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: Object.assign({}, process.env, providerEnv(provider))
      });
    } catch (e) {
      resolve({ ok: false, error: e.message, provider: publicProvider(provider) });
      return;
    }
    let out = '', err = '', settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(to);
      resolve(Object.assign({ provider: publicProvider(provider) }, result));
    };
    const to = setTimeout(() => {
      try { child.kill(); } catch {}
      finish({ ok: false, error: 'Provider test timed out.' });
    }, 90000);
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    child.on('error', e => finish({ ok: false, error: e.message }));
    child.on('close', code => {
      const text = out.split(/\r?\n/).map(line => {
        try {
          const ev = JSON.parse(line);
          if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
            return ev.message.content.filter(c => c.type === 'text').map(c => c.text).join(' ');
          }
          if (ev.type === 'result' && ev.result) return ev.result;
        } catch {}
        return '';
      }).filter(Boolean).join(' ').trim();
      const error = (err || text || `claude exited with code ${code}`).trim().slice(0, 500);
      finish({ ok: code === 0, code, output: text.slice(0, 500), error: code === 0 ? '' : error });
    });
  });
}

// schedule checker (fires only while the console is running — per chosen design)
const pad = n => String(n).padStart(2, '0');
let lastFiredKey = '';
setInterval(() => {
  if (!schedule.enabled || runState.running) return;
  const now = new Date();
  if (schedule.mode === 'interval') {
    const base = runState.lastRun || runState.startedAt || 0;
    if (Date.now() - base >= (schedule.intervalMin || 1440) * 60000) startRun('schedule:interval');
    return;
  }
  const hhmm = pad(now.getHours()) + ':' + pad(now.getMinutes());
  if (hhmm !== schedule.time) return;
  if (schedule.mode === 'weekly' && now.getDay() !== Number(schedule.day)) return;
  const key = now.toDateString() + ' ' + hhmm;
  if (key === lastFiredKey) return;
  lastFiredKey = key;
  startRun('schedule:' + schedule.mode);
}, 20000);

function nextRunEstimate() {
  if (!schedule.enabled) return null;
  if (schedule.mode === 'interval') return (runState.lastRun || Date.now()) + (schedule.intervalMin || 1440) * 60000;
  const [h, m] = (schedule.time || '09:00').split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  if (schedule.mode === 'weekly') {
    let add = (Number(schedule.day) - d.getDay() + 7) % 7;
    if (add === 0 && d.getTime() <= Date.now()) add = 7;
    d.setDate(d.getDate() + add);
  } else if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// ---------- http ----------
const readBody = req => new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); });
const server = http.createServer(async (req, res) => {
  const json = o => { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
  if (req.url === '/api/state') return json(buildState());
  if (req.url === '/api/run' && req.method === 'POST') return json({ ok: startRun('manual'), running: runState.running });
  if (req.url === '/api/schedule' && req.method === 'POST') {
    try { schedule = Object.assign(schedule, JSON.parse((await readBody(req)) || '{}')); saveSched(); } catch {}
    return json({ schedule, nextRun: nextRunEstimate() });
  }
  if (req.url === '/api/provider' && req.method === 'POST') {
    let incoming = {};
    try { incoming = JSON.parse((await readBody(req)) || '{}'); } catch {}
    const current = normalizeProvider(loadProvider());
    const merged = Object.assign({}, current);
    ['enabled', 'type', 'name', 'baseUrl', 'model', 'smallModel', 'timeoutMs'].forEach(k => {
      if (Object.prototype.hasOwnProperty.call(incoming, k)) merged[k] = incoming[k];
    });
    const next = normalizeProvider(merged);
    if (Object.prototype.hasOwnProperty.call(incoming, 'apiKey') && String(incoming.apiKey || '').trim()) {
      next.apiKey = String(incoming.apiKey).trim();
    } else {
      next.apiKey = current.apiKey || '';
    }
    if (incoming.clearKey) next.apiKey = '';
    saveProvider(next);
    return json({ provider: publicProvider(effectiveProvider()) });
  }
  if (req.url === '/api/provider/test' && req.method === 'POST') {
    return json(await testProviderOnce());
  }
  if (req.url === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    clients.add(res);
    const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch {} }, 15000);
    req.on('close', () => { clearInterval(hb); clients.delete(res); });
    return;
  }
  fs.readFile(path.join(__dirname, 'index.html'), (err, buf) => {
    if (err) { res.writeHead(500); return res.end('index.html missing'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log(`\n  ◆ MIKE CONSOLE live →  http://localhost:${PORT}`);
  console.log(`  watching brain/ ideas/ daily-logs/  ·  RUN button + scheduler armed`);
  console.log(`  console = 0 credits. Hitting RUN spawns 'claude' headless (that run spends credits).\n`);
});
