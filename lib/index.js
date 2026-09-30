// dsh-whale-pet — Host half (zero-dependency Cordis plugin).
//
// Responsibilities:
//  - Compute the official DeepSeek peak / off-peak billing phase for the
//    currently selected model (api-docs.deepseek.com pricing, effective
//    2026-08-17: peak = Beijing 09:00-12:00 & 14:00-18:00, Mon-Fri, excluding
//    CN statutory holidays; everything else is off-peak at half price).
//  - Track live agent activity through `api-session/status` events.
//  - Serve the state JSON, the whale-maid PNG, and the coopanion asset tree
//    to the browser half.
//
// No runtime dependencies: plain Node ESM + Cordis context only.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, resolve, sep } from 'node:path';

export const name = 'whale-pet';

const PKG_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const IMAGE_PATH = join(PKG_DIR, 'assets', 'whale-maid.png');
const ASSETS_DIR = join(PKG_DIR, 'assets');
const ASSETS_DIR_PREFIX = ASSETS_DIR + sep;
const ASSETS_ROUTE = '/whale-pet/assets';
const MIME_BY_EXT = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.js': 'text/javascript',
};

// ── Official pricing (CNY per 1M tokens) ────────────────────────────────────
export const PRICING = {
  'deepseek-flash': {
    label: 'DeepSeek V4.1 Flash',
    peak: { inputHit: 0.04, inputMiss: 2.0, output: 8.0 },
    offpeak: { inputHit: 0.02, inputMiss: 1.0, output: 4.0 },
  },
  'deepseek-v4-pro': {
    label: 'DeepSeek V4 Pro',
    peak: { inputHit: 0.3, inputMiss: 9.0, output: 27.0 },
    offpeak: { inputHit: 0.15, inputMiss: 4.5, output: 13.5 },
  },
};

const MODEL_ALIASES = {
  'deepseek-chat': 'deepseek-flash',
  'deepseek-v4-flash': 'deepseek-flash',
  'deepseek-v4-flash-vision-exp': 'deepseek-flash',
  'deepseek-reasoner': 'deepseek-v4-pro',
};

// 2026 CN statutory holiday breaks ([start, end] inclusive, local dates).
// Update through config when a new year's schedule is published.
const DEFAULT_HOLIDAYS = [
  ['2026-01-01', '2026-01-03'],
  ['2026-02-16', '2026-02-22'],
  ['2026-04-04', '2026-04-06'],
  ['2026-05-01', '2026-05-05'],
  ['2026-06-19', '2026-06-21'],
  ['2026-09-25', '2026-09-27'],
  ['2026-10-01', '2026-10-07'],
];

const DEFAULTS = {
  timeZone: 'Asia/Shanghai',
  peakRanges: [
    [9, 12],
    [14, 18],
  ],
  holidays: DEFAULT_HOLIDAYS,
  pollMs: 5000,
};

const PHASE_LABELS = {
  peak: '高峰计价',
  offpeak: '低谷计价',
  'offpeak-weekend': '周末低谷',
  'offpeak-holiday': '节假日低谷',
  unknown: '计价未知',
};

// ── Config normalization (no schema export: defensive merging) ──────────────
function normalizeConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const cfg = { ...DEFAULTS };
  if (typeof input.timeZone === 'string' && input.timeZone) cfg.timeZone = input.timeZone;
  if (Array.isArray(input.peakRanges)) {
    const ranges = input.peakRanges
      .filter((r) => Array.isArray(r) && r.length === 2 && typeof r[0] === 'number' && typeof r[1] === 'number')
      .map(([a, b]) => [Math.min(a, b), Math.max(a, b)]);
    if (ranges.length > 0) cfg.peakRanges = ranges;
  }
  if (Array.isArray(input.holidays)) {
    const ranges = input.holidays
      .filter((r) => Array.isArray(r) && r.length === 2 && typeof r[0] === 'string' && typeof r[1] === 'string')
      .map(([a, b]) => [String(a), String(b)]);
    if (ranges.length > 0) cfg.holidays = ranges;
  }
  if (typeof input.pollMs === 'number' && input.pollMs >= 1000 && input.pollMs <= 600000) {
    cfg.pollMs = Math.round(input.pollMs);
  }
  return cfg;
}

// ── Zoned time helpers ──────────────────────────────────────────────────────
const zonedFmt = (timeZone) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export function zonedParts(nowMs, timeZone) {
  const p = {};
  for (const { type, value } of zonedFmt(timeZone).formatToParts(new Date(nowMs))) {
    if (type !== 'literal') p[type] = value;
  }
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    dateStr: `${p.year}-${p.month}-${p.day}`,
  };
}

// ISO weekday of a calendar date: 1 = Mon … 7 = Sun.
function weekdayOfDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() || 7;
}

function isHoliday(dateStr, holidays) {
  return holidays.some(([start, end]) => dateStr >= start && dateStr <= end);
}

// ── Phase computation ───────────────────────────────────────────────────────
export function phaseAt(cfg, nowMs) {
  const z = zonedParts(nowMs, cfg.timeZone);
  const dow = weekdayOfDate(z.dateStr);
  const weekend = dow >= 6;
  if (weekend) return { phase: 'offpeak-weekend', zoned: z };
  if (isHoliday(z.dateStr, cfg.holidays)) return { phase: 'offpeak-holiday', zoned: z };
  const t = z.hour + z.minute / 60;
  const inPeak = cfg.peakRanges.some(([h0, h1]) => t >= h0 && t < h1);
  return { phase: inPeak ? 'peak' : 'offpeak', zoned: z };
}

// Epoch ms of a zoned local date-time (two-pass offset measurement).
function zonedEpochMs(timeZone, y, mo, d, h, mi = 0) {
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) {
    const p = {};
    for (const { type, value } of zonedFmt(timeZone).formatToParts(new Date(guess))) {
      if (type !== 'literal') p[type] = value;
    }
    const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    const offset = asUtc - (guess - (guess % 60000));
    const real = Date.UTC(y, mo - 1, d, h, mi) - offset;
    if (Math.abs(real - guess) <= 60000) return real;
    guess = real;
  }
  return guess;
}

function addDaysToDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  const p = (n) => String(n).padStart(2, '0');
  return `${next.getUTCFullYear()}-${p(next.getUTCMonth() + 1)}-${p(next.getUTCDate())}`;
}

export function nextPhaseChange(cfg, nowMs, currentPhase) {
  const z = zonedParts(nowMs, cfg.timeZone);
  const boundaryHours = new Set();
  for (const [h0, h1] of cfg.peakRanges) {
    boundaryHours.add(h0);
    boundaryHours.add(h1);
  }
  const candidates = [];
  for (let d = 0; d < 40; d++) {
    const dateStr = addDaysToDateStr(z.dateStr, d);
    const [y, mo, dd] = dateStr.split('-').map(Number);
    for (const h of boundaryHours) candidates.push({ y, mo, d: dd, h, mi: 0 });
    candidates.push({ y, mo, d: dd, h: 0, mi: 0 });
  }
  candidates.sort((a, b) => (zonedEpochMs(cfg.timeZone, a.y, a.mo, a.d, a.h, a.mi) - zonedEpochMs(cfg.timeZone, b.y, b.mo, b.d, b.h, b.mi)));
  for (const c of candidates) {
    const atMs = zonedEpochMs(cfg.timeZone, c.y, c.mo, c.d, c.h, c.mi);
    if (atMs <= nowMs) continue;
    const { phase } = phaseAt(cfg, atMs);
    if (phase !== currentPhase) {
      return { phase, atMs, label: PHASE_LABELS[phase] ?? phase };
    }
  }
  return null;
}

// ── Current-phase time window ──────────────────────────────────────────────
// startMs: the most recent phase *transition* at or before `nowMs` — i.e. the
// newest candidate instant where the phase flips into the current one. If no
// transition is found within 40 days, fall back to nowMs - 24h.
// endMs: nextPhaseChange().atMs, or nowMs + 24h when there is no next change.
export function currentWindow(cfg, nowMs, phase) {
  if (phase === 'unknown') return { startMs: nowMs - 864e5, endMs: nowMs + 864e5 };
  const z = zonedParts(nowMs, cfg.timeZone);
  const boundaryHours = new Set();
  for (const [h0, h1] of cfg.peakRanges) {
    boundaryHours.add(h0);
    boundaryHours.add(h1);
  }
  // Same candidate instants as nextPhaseChange, generated 40 days backwards.
  const candidates = [];
  for (let d = 0; d < 40; d++) {
    const dateStr = addDaysToDateStr(z.dateStr, -d);
    const [y, mo, dd] = dateStr.split('-').map(Number);
    for (const h of boundaryHours) {
      candidates.push({ atMs: zonedEpochMs(cfg.timeZone, y, mo, dd, h, 0) });
    }
    candidates.push({ atMs: zonedEpochMs(cfg.timeZone, y, mo, dd, 0, 0) });
  }
  candidates.sort((a, b) => b.atMs - a.atMs);
  let startMs = nowMs - 864e5;
  let prevAtMs = null; // newest candidate ≤ now with the current phase
  for (const c of candidates) {
    if (c.atMs > nowMs) continue;
    const { phase: p } = phaseAt(cfg, c.atMs);
    if (p !== phase) {
      // First older candidate whose phase differs: the transition into the
      // current phase is the candidate we saw just before it.
      if (prevAtMs !== null) startMs = prevAtMs;
      break;
    }
    prevAtMs = c.atMs;
  }
  const next = nextPhaseChange(cfg, nowMs, phase);
  return { startMs, endMs: next ? next.atMs : nowMs + 864e5 };
}

// ── State assembly ──────────────────────────────────────────────────────────
function modelInfo(rawModel) {
  if (!rawModel) return { raw: null, canonical: null, label: null, known: false };
  const canonical = MODEL_ALIASES[rawModel] ?? (PRICING[rawModel] ? rawModel : null);
  if (canonical) {
    return { raw: rawModel, canonical, label: PRICING[canonical].label, known: true };
  }
  return { raw: rawModel, canonical: null, label: rawModel, known: false };
}

function readCurrentModel(ctx) {
  try {
    const service = ctx.get('agentDefaultModel');
    const selection = service?.currentSelection?.();
    return typeof selection?.model === 'string' ? selection.model : undefined;
  } catch {
    return undefined;
  }
}

export function buildState(ctx, cfg, running) {
  const nowMs = Date.now();
  const { phase, zoned } = phaseAt(cfg, nowMs);
  const model = modelInfo(readCurrentModel(ctx));
  const pricing = model.canonical ? PRICING[model.canonical] : null;
  const next = phase === 'unknown' ? null : nextPhaseChange(cfg, nowMs, phase);
  const window = currentWindow(cfg, nowMs, phase);
  return {
    ok: true,
    now: nowMs,
    nowDate: zoned.dateStr,
    timeZone: cfg.timeZone,
    model,
    phase,
    phaseLabel: PHASE_LABELS[phase] ?? phase,
    pricing,
    running: running.size > 0,
    activeSessions: running.size,
    next,
    window,
    remainingMs: next ? next.atMs - nowMs : null,
    pollMs: cfg.pollMs,
    source: 'api-docs.deepseek.com · 2026-08-17 峰谷定价',
  };
}

// ── HTTP helpers ────────────────────────────────────────────────────────────
// The desktop shell serves its page from the custom `dsh-app://app` origin,
// so browser fetches to this HTTP server are cross-origin: every response
// carries permissive CORS headers (no credentials are required here).
function corsHeaders(res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-length', Buffer.byteLength(body));
  corsHeaders(res);
  res.end(body);
}

function sendMethodNotAllowed(res) {
  res.statusCode = 405;
  res.setHeader('allow', 'GET');
  corsHeaders(res);
  res.end();
}

function sendNotFound(res) {
  res.statusCode = 404;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  corsHeaders(res);
  res.end('not found');
}

// Resolve a URL rest-path against PKG_DIR/assets with path-traversal
// protection, then read the file. Returns { data, file } or null.
async function readAssetSafe(rest) {
  const segments = String(rest ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((s) => s !== '' && s !== '.');
  if (segments.length === 0 || segments.includes('..') || segments.some((s) => s.includes(':'))) {
    return null;
  }
  const file = resolve(ASSETS_DIR, ...segments);
  if (!file.startsWith(ASSETS_DIR_PREFIX)) return null;
  try {
    const data = await readFile(file);
    return { data, file };
  } catch {
    return null;
  }
}

// ── Plugin entry ────────────────────────────────────────────────────────────
// Hard dependency on the HTTP carrier: activation must wait until the
// webServer service exists, otherwise route registration is silently skipped.
export const inject = ['webServer'];

export function apply(ctx, rawConfig) {
  const cfg = normalizeConfig(rawConfig);
  const running = new Set();

  ctx.on('api-session/status', (sessionId, isRunning) => {
    if (isRunning) running.add(sessionId);
    else running.delete(sessionId);
  });

  const web = ctx.webServer ?? ctx.get('webServer');
  if (web) {
    let imageCache = null;
    ctx.effect(() => {
      const unState = web.register({
        kind: 'exact',
        path: '/whale-pet/state',
        handler: (req, res) => {
          if (req.method !== 'GET') return sendMethodNotAllowed(res);
          sendJson(res, 200, buildState(ctx, cfg, running));
        },
      });
      const unImage = web.register({
        kind: 'exact',
        path: '/whale-pet/image',
        handler: async (req, res) => {
          if (req.method !== 'GET') return sendMethodNotAllowed(res);
          try {
            imageCache ??= await readFile(IMAGE_PATH);
            res.statusCode = 200;
            res.setHeader('content-type', 'image/png');
            res.setHeader('cache-control', 'public, max-age=3600');
            res.setHeader('content-length', String(imageCache.byteLength));
            corsHeaders(res);
            res.end(imageCache);
          } catch {
            res.statusCode = 404;
            res.setHeader('content-type', 'text/plain; charset=utf-8');
            corsHeaders(res);
            res.end('whale-maid.png missing');
          }
        },
      });
      const unAssets = web.register({
        kind: 'prefix',
        path: ASSETS_ROUTE,
        handler: async (req, res) => {
          if (req.method !== 'GET') return sendMethodNotAllowed(res);
          let rest = (req.url ?? '/').split('?')[0];
          if (rest.startsWith(ASSETS_ROUTE)) rest = rest.slice(ASSETS_ROUTE.length);
          try {
            rest = decodeURIComponent(rest);
          } catch {
            return sendNotFound(res);
          }
          // Try assets/<rest> first, then assets/coopanion/<rest>, else 404.
          let hit = await readAssetSafe(rest);
          if (hit === null) hit = await readAssetSafe(`coopanion/${rest}`);
          if (hit === null) return sendNotFound(res);
          res.statusCode = 200;
          res.setHeader(
            'content-type',
            MIME_BY_EXT[extname(hit.file).toLowerCase()] ?? 'application/octet-stream'
          );
          res.setHeader('cache-control', 'public, max-age=3600');
          res.setHeader('content-length', String(hit.data.byteLength));
          corsHeaders(res);
          res.end(hit.data);
        },
      });
      return () => {
        unState();
        unImage();
        unAssets();
      };
    }, 'whale-pet: /whale-pet/state + /whale-pet/image + /whale-pet/assets');
  }

  ctx.logger?.info?.('whale-pet host half active (routes: %s)', web ? 'registered' : 'unavailable');
}
