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

const ROOT = path.join(__dirname, '..');
const PORT = process.env.MIKE_PORT || 4317;
const WATCH_DIRS = ['brain', 'ideas', 'daily-logs'].map(d => path.join(ROOT, d));

// ---------- helpers ----------
const read = rel => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };
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
    const name = head.split('—')[0].trim();
    const score = parseFloat((head.match(/Score:\s*([\d.]+)/) || [])[1]) || null;
    const fields = {};
    let fm; const fre = /\*\*(.+?):\*\*\s*([^\n]+)/g;
    while ((fm = fre.exec(block))) fields[fm[1].trim()] = fm[2].trim();
    const breakdown = [];
    let bm; const bre = /([A-Z_]{3,}):(\d+)/g;
    const bsrc = fields['Score breakdown'] || '';
    while ((bm = bre.exec(bsrc))) breakdown.push({ k: bm[1], v: +bm[2] });
    const trendRaw = (fields['Score history'] || '') + (fields['Trending'] || '');
    const trend = /↑|climb|improv|rising/i.test(trendRaw) ? 'up'
      : /↓|weaken|cool|declin/i.test(trendRaw) ? 'down' : 'flat';
    return {
      name, score,
      actionable: /🎯|ACTIONABLE/.test(head),
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
    .filter(c => c.length && !/^-+$/.test(c[0]) && c[0] !== '—' && c[0] !== '');
}

function parseKilled(md) {
  return tableRows(md)
    .filter(c => c[0] && !/date\s*killed/i.test(c[0]) && c[1] && c[1] !== '—')
    .map(c => ({ date: c[0], idea: c[1], score: c[2], reason: c[3], type: c[4], revisit: c[5] }));
}

function parseSignals(md) {
  return tableRows(md)
    .filter(c => c[0] && !/^signal$/i.test(c[0]) && c[1] && /ACTIVE|RESOLVED|EXPIRED|ACCELER|STALL/i.test(c[1]))
    .map(c => {
      const dir = (c[2] || '').match(/↑|↓|→|\?/);
      return {
        name: c[0], status: c[1],
        dir: dir ? (dir[0] === '↑' ? 'up' : dir[0] === '↓' ? 'down' : dir[0] === '→' ? 'flat' : 'unknown') : 'unknown',
        note: c[4] || ''
      };
    });
}

function parseTop3(md) {
  const part = md.split(/^##\s+/m).find(p => p.startsWith('🥇'));
  if (!part) return null;
  const head = part.split('\n')[0];
  const fields = {}; let fm; const fre = /\*\*(.+?):\*\*\s*([^\n]+)/g;
  while ((fm = fre.exec(part))) fields[fm[1].trim()] = fm[2].trim();
  const play = part.split('\n').filter(l => /^-\s*(Mon|Tue|Wed|Thu|Fri):/i.test(l.trim()))
    .map(l => l.replace(/^-\s*/, '').trim());
  return {
    name: (head.split(':')[1] || '').split('—')[0].trim(),
    score: parseFloat((head.match(/—\s*([\d.]+)/) || [])[1]) || null,
    actionable: /🎯|ACTIONABLE/.test(head),
    simple: fields['Simple version'] || '',
    whyNow: fields['Why right now'] || '',
    catch: fields['The catch'] || '',
    playbook: play
  };
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
  const corrections = (read('brain/CORRECTIONS.md').match(/^\*\*\d{4}-\d{2}-\d{2}/gm) || []).length;
  const logs = safe(() => fs.readdirSync(path.join(ROOT, 'daily-logs')).filter(f => /\d{4}-\d{2}-\d{2}\.md/.test(f)).sort(), []);
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
      avg: scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0,
      killed: killed.length,
      runs: runs.length || logs.length,
      facts, corrections,
      lastRun: logs.length ? logs[logs.length - 1].replace('.md', '') : '—'
    },
    ideas, signals, killed, runs
  };
}

// ---------- live (SSE) ----------
const clients = new Set();
function broadcast(file) {
  const payload = `data: ${JSON.stringify({ type: 'change', file, at: Date.now() })}\n\n`;
  for (const c of clients) { try { c.write(payload); } catch {} }
}
let timer = null, lastFile = '';
for (const dir of WATCH_DIRS) {
  try {
    fs.watch(dir, { recursive: true }, (_e, fn) => {
      if (fn) lastFile = path.join(path.basename(dir), fn).replace(/\\/g, '/');
      clearTimeout(timer);
      timer = setTimeout(() => broadcast(lastFile), 180);
    });
  } catch {}
}

// ---------- http ----------
const server = http.createServer((req, res) => {
  if (req.url === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(buildState()));
  }
  if (req.url === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    clients.add(res);
    const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch {} }, 15000);
    req.on('close', () => { clearInterval(hb); clients.delete(res); });
    return;
  }
  // default → index.html
  fs.readFile(path.join(__dirname, 'index.html'), (err, buf) => {
    if (err) { res.writeHead(500); return res.end('index.html missing'); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log(`\n  ◆ MIKE CONSOLE live →  http://localhost:${PORT}`);
  console.log(`  watching: brain/  ideas/  daily-logs/`);
  console.log(`  zero Claude credits — reading local files only.\n`);
});
