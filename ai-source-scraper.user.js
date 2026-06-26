// ==UserScript==
// @name         AI Source Scraper (Claude / Gemini / ChatGPT)
// @namespace    janna.dmi26.ai-source-scraper
// @version      0.3.0
// @description  Auto-detect the source list, auto-scroll it, and capture every cited web link + metadata for longitudinal analysis. DMI26 "Agentic AI on the Web".
// @match        https://claude.ai/*
// @match        https://gemini.google.com/*
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ===== Editable config ===================================================
  // Kept TIGHT on purpose: google.com / openai.com / anthropic.com stay (they can
  // be real citations); only their account/settings/support subdomains are dropped.
  const denyHosts = ['claude.ai','gemini.google.com','chatgpt.com','chat.openai.com',
    'accounts.google.com','myaccount.google.com','policies.google.com','support.google.com',
    'help.openai.com','support.anthropic.com','auth.openai.com','cdn.oaistatic.com',
    'files.oaiusercontent.com'];
  const appendMode = true; // repeated scans accumulate in a buffer you export together
  // Tracking params stripped to build clean_url (and merge duplicate URLs). Edit freely.
  const TRACKING_PARAMS = ['fbclid','gclid','gbraid','wbraid','msclkid','dclid','yclid',
    'mc_cid','mc_eid','igshid','_hsenc','_hsmi','vero_id','oly_anon_id','oly_enc_id'];
  // =========================================================================

  const PLATFORM = (() => { const x = location.hostname;
    if (x.includes('claude.ai')) return 'claude';
    if (x.includes('gemini.google')) return 'gemini';
    if (x.includes('chatgpt.com') || x.includes('chat.openai.com')) return 'chatgpt';
    return 'unknown'; })();

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let buffer = [];
  let lastCapture = [];
  let sessionLabel = '';

  // ---- engine ------------------------------------------------------------
  const isExt = a => { let u; try { u = new URL(a.href, location.href); } catch (e) { return false; }
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname.replace(/^www\./, '');
    return !denyHosts.some(d => host === d || host.endsWith('.' + d)); };
  const looksHost = l => /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(l) && !l.includes(' ');
  const reg = host => { host = host.replace(/^www\./, ''); const p = host.split('.');
    if (p.length <= 2) return host;
    const t2 = ['co.uk','ac.uk','gov.uk','org.uk','com.au','co.jp','com.br','co.nz','co.za','com.sg'];
    return t2.includes(p.slice(-2).join('.')) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
  const stripTracking = u => { [...u.searchParams.keys()].forEach(k => {
      if (/^utm_/i.test(k) || TRACKING_PARAMS.includes(k.toLowerCase())) u.searchParams.delete(k); });
    return u; };
  const cleanUrl = url => { try { return stripTracking(new URL(url)).href; } catch (e) { return url; } };
  const keyOf = url => { try { const u = stripTracking(new URL(url)); u.hash = ''; return u.href; } catch (e) { return url; } };
  const rowOf = a => { let node = a;
    for (let d = 0; d < 8 && node.parentElement && node.parentElement !== document.body; d++) {
      const p = node.parentElement;
      const sib = [...p.children].filter(c => c.querySelector && c.querySelector('a[href^="http"]')).length;
      if (sib >= 3) return node;
      node = p; }
    return a.closest('li,article') || a.parentElement || a; };
  const scrollerOf = el => { let n = el;
    while (n && n !== document.body) { const s = getComputedStyle(n);
      if (/(auto|scroll|overlay)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 4) return n;
      n = n.parentElement; }
    return document.scrollingElement || document.documentElement; };

  function extract(card, a, ts, captureId) {
    const url = new URL(a.href, location.href).href;
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const img = card.querySelector('img');
    const lines = (card.innerText || '').split('\n').map(s => s.trim())
      .filter(s => s && !/^\+\d+$/.test(s));
    const hostIdx = lines.findIndex(looksHost);
    const rest = lines.filter((_, i) => i !== hostIdx);
    return { capture_id: captureId, capture_timestamp: ts, platform: PLATFORM,
      page_url: location.href, page_title: document.title, session_label: sessionLabel,
      source_type: lines.length >= 3 ? 'panel' : 'inline',
      url, clean_url: cleanUrl(url), hostname, domain: reg(hostname),
      title: rest[0] || '', description: rest.slice(1).join(' '), favicon: img ? img.src : '' };
  }
  const richer = (a, b) => ((b.title + b.description).length > (a.title + a.description).length) ? b : a;

  function harvest(root, map, ts, captureId) {
    const anchors = [...root.querySelectorAll('a[href^="http"]')].filter(isExt);
    const cards = new Set(anchors.map(rowOf));
    for (const card of cards) {
      const a = (card.matches && card.matches('a[href^="http"]') && isExt(card))
        ? card : [...card.querySelectorAll('a[href^="http"]')].find(isExt);
      if (!a) continue;
      const rec = extract(card, a, ts, captureId);
      const key = keyOf(rec.url);
      map.set(key, map.has(key) ? richer(map.get(key), rec) : rec);
    }
  }
  function findContainers() {
    const anchors = [...document.querySelectorAll('a[href^="http"]')].filter(isExt);
    const counts = new Map();
    for (const a of anchors) { const list = rowOf(a).parentElement; if (!list) continue;
      counts.set(list, (counts.get(list) || 0) + 1); }
    const containers = new Set();
    for (const [list, c] of counts) if (c >= 2) containers.add(scrollerOf(list));
    [...document.querySelectorAll('*')].forEach(n => { const s = getComputedStyle(n);
      if (/(auto|scroll|overlay)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 40
        && n.querySelector('a[href^="http"]')) containers.add(n); });
    if (!containers.size) containers.add(scrollerOf(document.querySelector('main') || document.body));
    return [...containers];
  }
  async function autoScroll(sc, map, ts, captureId, onTick) {
    const saved = sc.scrollTop;
    try { sc.scrollTop = 0; } catch (e) {}
    await sleep(120);
    let last = map.size, stable = 0;
    for (let i = 0; i < 400; i++) {
      harvest(sc, map, ts, captureId);
      if (map.size !== last) { last = map.size; if (onTick) onTick(map.size); }
      const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4;
      sc.scrollTop = sc.scrollTop + Math.max(120, Math.floor(sc.clientHeight * 0.8));
      await sleep(170);
      if (atBottom) { stable++; if (stable >= 4) break; } else stable = 0;
    }
    harvest(sc, map, ts, captureId);
    try { sc.scrollTop = saved; } catch (e) {}
  }
  async function scan(onTick) {
    const ts = new Date().toISOString();
    const captureId = 'cap_' + Date.now();
    const map = new Map();
    for (const sc of findContainers()) await autoScroll(sc, map, ts, captureId, onTick);
    const records = [...map.values()].map((r, i) => ({ rank: i + 1, ...r }));
    lastCapture = records;
    buffer = appendMode ? buffer.concat(records) : records.slice();
    return records;
  }

  // ---- export helpers ----------------------------------------------------
  function toCSV(rows) { if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    return [cols.join(',')].concat(rows.map(r => cols.map(c => esc(r[c])).join(','))).join('\n'); }
  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  function download(name, content, mime) { try {
      const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { navigator.clipboard.writeText(content);
      alert('Download blocked by the page. Data copied to clipboard \u2014 paste into a file.'); } }
  function summarise(rows) { const dom = {};
    rows.forEach(r => { dom[r.domain] = (dom[r.domain] || 0) + 1; });
    const top = Object.entries(dom).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { total: rows.length, uniqueDomains: Object.keys(dom).length, top }; }

  // ---- UI ----------------------------------------------------------------
  function buildUI() {
    const box = document.createElement('div');
    box.id = 'ai-source-scraper';
    box.style.cssText = ['position:fixed','bottom:16px','right:16px','z-index:2147483647',
      'width:300px','font:12px/1.4 -apple-system,Segoe UI,Roboto,sans-serif','background:#1e1e24',
      'color:#eee','border:1px solid #3a3a44','border-radius:10px',
      'box-shadow:0 6px 24px rgba(0,0,0,.4)','overflow:hidden'].join(';');
    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#2a2a32">' +
        '<strong style="font-size:12px">AI Source Scraper \u00b7 ' + PLATFORM + '</strong>' +
        '<span id="ass-min" style="cursor:pointer;opacity:.7;padding:0 4px">\u2013</span></div>' +
      '<div id="ass-body" style="padding:10px;display:flex;flex-direction:column;gap:8px">' +
        '<input id="ass-label" placeholder="session label / prompt note" ' +
          'style="background:#15151a;border:1px solid #3a3a44;border-radius:6px;color:#eee;padding:6px 8px;outline:none"/>' +
        '<button id="ass-scan" style="background:#5b8def;border:none;border-radius:6px;color:#fff;padding:8px;cursor:pointer;font-weight:600">Scan sources</button>' +
        '<div id="ass-summary" style="font-size:11px;color:#bbb;white-space:pre-wrap"></div>' +
        '<div style="display:flex;gap:6px">' +
          '<button id="ass-csv" style="flex:1;background:#333;border:1px solid #444;border-radius:6px;color:#eee;padding:7px;cursor:pointer">CSV</button>' +
          '<button id="ass-json" style="flex:1;background:#333;border:1px solid #444;border-radius:6px;color:#eee;padding:7px;cursor:pointer">JSON</button>' +
          '<button id="ass-copy" style="flex:1;background:#333;border:1px solid #444;border-radius:6px;color:#eee;padding:7px;cursor:pointer">Copy</button></div>' +
        '<button id="ass-clear" style="background:transparent;border:none;color:#888;cursor:pointer;font-size:11px;text-decoration:underline">clear buffer</button>' +
      '</div>';
    document.body.appendChild(box);
    const $ = id => box.querySelector(id);
    const sumEl = $('#ass-summary');

    function render() {
      const cap = summarise(lastCapture), buf = summarise(buffer);
      const topStr = cap.top.map(t => t[0] + ' (' + t[1] + ')').join(', ');
      sumEl.textContent =
        'This capture: ' + cap.total + ' sources \u00b7 ' + cap.uniqueDomains + ' domains\n' +
        (topStr ? 'Top: ' + topStr + '\n' : '') +
        'Buffer total: ' + buf.total + ' rows across captures';
    }
    $('#ass-label').addEventListener('input', e => { sessionLabel = e.target.value; });
    $('#ass-scan').addEventListener('click', async () => {
      const btn = $('#ass-scan'); btn.disabled = true; btn.textContent = 'Scanning\u2026';
      await scan(n => { btn.textContent = 'Scanning\u2026 ' + n; });
      btn.disabled = false; btn.textContent = 'Scan sources'; render();
    });
    $('#ass-csv').addEventListener('click', () =>
      download('ai-sources_' + PLATFORM + '_' + stamp() + '.csv', toCSV(buffer), 'text/csv'));
    $('#ass-json').addEventListener('click', () =>
      download('ai-sources_' + PLATFORM + '_' + stamp() + '.json', JSON.stringify(buffer, null, 2), 'application/json'));
    $('#ass-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(toCSV(buffer)); sumEl.textContent = 'Buffer CSV copied to clipboard.'; });
    $('#ass-clear').addEventListener('click', () => { buffer = []; lastCapture = []; render(); });
    $('#ass-min').addEventListener('click', () => {
      const b = $('#ass-body'); b.style.display = b.style.display === 'none' ? 'flex' : 'none'; });
    render();
  }

  window.aiSourceScraper = { scan, get buffer() { return buffer; }, get last() { return lastCapture; },
    csv: () => toCSV(buffer), json: () => JSON.stringify(buffer, null, 2),
    clear: () => { buffer = []; lastCapture = []; }, setLabel: s => { sessionLabel = s; } };

  if (document.body) buildUI();
  else window.addEventListener('DOMContentLoaded', buildUI);
})();
