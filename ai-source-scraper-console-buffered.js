/* AI Source Scraper v1.2 — console BUFFERED build (paste once, scan many, download once)
   ---------------------------------------------------------------------------------
   Same engine as the extension & userscript. It does NOT scan or download on paste.
   It installs a small API and accumulates every scan in a buffer (persisted to
   localStorage, so an accidental reload doesn't lose the round).

   USAGE (run/pause/run/pause -> one merged file):
     1. Paste this whole block ONCE into DevTools Console (Mac: Option+Cmd+J). Nothing downloads.
     2. Open the Sources / Activity panel for a response, then run ONE of:
            aiSourceScraper.scan('medium_p0_warm')
            grab('medium_p0_warm')                     // neutral short name
        The string you pass = file_id. Minimal convention: {topic}_{prompt_id}_{thread_state}
        (date + platform are auto-captured, so you don't type them). Send the next prompt,
        open its panel, run scan('medium_m1_warm'), and so on. Each call APPENDS.
        Optional 2nd arg = free-text note:  scan('politics-en_m2_warm', 'panel slow to load')
     3. When the thread is done, download the merged files:
            aiSourceScraper.csv()      aiSourceScraper.json()
     4. Start the next thread fresh:
            aiSourceScraper.clear()
   file_id is auto-split into topic / prompt_id / thread_state (pattern-based, so a
   longer label like chatgpt_20260715_medium_m1_warm parses the same way). thread_state
   (warm/cold) MUST be in the label — the tool cannot infer it.
   Handy: grab.status() prints the buffer summary; grab.buffer is the raw array.
   Works on claude.ai, gemini.google.com, chatgpt.com / chat.openai.com.            */

(() => {
  const h = location.hostname;
  const platform = h.includes('claude.ai') ? 'claude'
    : h.includes('gemini.google') ? 'gemini'
    : (h.includes('chatgpt.com') || h.includes('chat.openai.com')) ? 'chatgpt'
    : 'unknown';

  const denyHosts = ['claude.ai','gemini.google.com','chatgpt.com','chat.openai.com',
    'accounts.google.com','myaccount.google.com','policies.google.com','support.google.com',
    'help.openai.com','support.anthropic.com','auth.openai.com','cdn.oaistatic.com',
    'files.oaiusercontent.com'];

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const isExt = a => {
    let u; try { u = new URL(a.href, location.href); } catch (e) { return false; }
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname.replace(/^www\./, '');
    return !denyHosts.some(d => host === d || host.endsWith('.' + d));
  };
  const looksHost = l => /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(l) && !l.includes(' ');
  const reg = host => { host = host.replace(/^www\./, ''); const p = host.split('.');
    if (p.length <= 2) return host;
    const t2 = ['co.uk','ac.uk','gov.uk','org.uk','com.au','co.jp','com.br','co.nz','co.za','com.sg'];
    return t2.includes(p.slice(-2).join('.')) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
  const TRACKING_PARAMS = ['fbclid','gclid','gbraid','wbraid','msclkid','dclid','yclid',
    'mc_cid','mc_eid','igshid','_hsenc','_hsmi','vero_id','oly_anon_id','oly_enc_id'];
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
      node = p;
    }
    return a.closest('li,article') || a.parentElement || a; };

  const scrollerOf = el => { let n = el;
    while (n && n !== document.body) {
      const s = getComputedStyle(n);
      if (/(auto|scroll|overlay)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 4) return n;
      n = n.parentElement;
    }
    return document.scrollingElement || document.documentElement; };

  // parse file_id -> topic / prompt_id / thread_state by PATTERN (position-independent).
  // Minimal label is {topic}_{prompt_id}_{thread_state}, e.g. medium_m1_warm.
  // A leading platform token and any 8-digit date token are ignored (captured elsewhere),
  // so chatgpt_20260715_medium_m1_warm parses the same as medium_m1_warm.
  const parseId = id => {
    const parts = String(id || '').split('_').filter(Boolean);
    const platforms = ['claude', 'gemini', 'chatgpt'];
    let prompt_id = '', thread_state = ''; const rest = [];
    parts.forEach((p, i) => { const low = p.toLowerCase();
      if (!prompt_id && /^(p0|m\d+)$/i.test(p)) prompt_id = low;
      else if (!thread_state && /^(cold|warm)$/i.test(p)) thread_state = low;
      else if (/^\d{8}$/.test(p)) { /* date token — already in capture_date */ }
      else if (i === 0 && platforms.includes(low)) { /* leading platform — already in platform */ }
      else rest.push(p); });
    return { topic: rest.join('_'), prompt_id, thread_state };
  };

  const extract = (card, a, meta) => {
    const url = new URL(a.href, location.href).href;
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const img = card.querySelector('img');
    const lines = (card.innerText || '').split('\n').map(s => s.trim())
      .filter(s => s && !/^\+\d+$/.test(s));
    const hostIdx = lines.findIndex(looksHost);
    const rest = lines.filter((_, i) => i !== hostIdx);
    return { capture_id: meta.captureId, file_id: meta.fileId, capture_date: meta.date,
      capture_timestamp: meta.ts, platform,
      topic: meta.parsed.topic, prompt_id: meta.parsed.prompt_id, thread_state: meta.parsed.thread_state,
      page_url: location.href, page_title: document.title, session_label: meta.fileId, note: meta.note,
      source_type: lines.length >= 3 ? 'panel' : 'inline',
      url, clean_url: cleanUrl(url), hostname, domain: reg(hostname),
      title: rest[0] || '', description: rest.slice(1).join(' '),
      favicon: img ? img.src : '' };
  };
  const richer = (a, b) =>
    ((b.title + b.description).length > (a.title + a.description).length) ? b : a;

  const harvest = (root, map, meta) => {
    const anchors = [...root.querySelectorAll('a[href^="http"]')].filter(isExt);
    const cards = new Set(anchors.map(rowOf));
    for (const card of cards) {
      const a = (card.matches && card.matches('a[href^="http"]') && isExt(card))
        ? card : [...card.querySelectorAll('a[href^="http"]')].find(isExt);
      if (!a) continue;
      const rec = extract(card, a, meta);
      const key = keyOf(rec.url);
      map.set(key, map.has(key) ? richer(map.get(key), rec) : rec);
    }
  };

  const findContainers = () => {
    const anchors = [...document.querySelectorAll('a[href^="http"]')].filter(isExt);
    const counts = new Map();
    for (const a of anchors) { const list = rowOf(a).parentElement; if (!list) continue;
      counts.set(list, (counts.get(list) || 0) + 1); }
    const containers = new Set();
    for (const [list, c] of counts) if (c >= 2) containers.add(scrollerOf(list));
    [...document.querySelectorAll('*')].forEach(n => {
      const s = getComputedStyle(n);
      if (/(auto|scroll|overlay)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 40
        && n.querySelector('a[href^="http"]')) containers.add(n);
    });
    if (!containers.size) containers.add(scrollerOf(document.querySelector('main') || document.body));
    return [...containers];
  };

  const autoScroll = async (sc, map, meta) => {
    const saved = sc.scrollTop;
    try { sc.scrollTop = 0; } catch (e) {}
    await sleep(120);
    let last = map.size, stable = 0;
    for (let i = 0; i < 400; i++) {
      harvest(sc, map, meta);
      if (map.size !== last) { console.log('  collected', map.size); last = map.size; }
      const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4;
      sc.scrollTop = sc.scrollTop + Math.max(120, Math.floor(sc.clientHeight * 0.8));
      await sleep(170);
      if (atBottom) { stable++; if (stable >= 4) break; } else stable = 0;
    }
    harvest(sc, map, meta);
    try { sc.scrollTop = saved; } catch (e) {}
  };

  // ---- persistent buffer -------------------------------------------------
  const LS_KEY = '__aiSourceScraper_buffer_v1';
  let buffer = [];
  try { const saved = localStorage.getItem(LS_KEY); if (saved) buffer = JSON.parse(saved) || []; } catch (e) {}
  const persist = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(buffer)); } catch (e) {} };

  const summarise = rows => { const dom = {};
    rows.forEach(r => { dom[r.domain] = (dom[r.domain] || 0) + 1; });
    const caps = new Set(rows.map(r => r.capture_id)).size;
    const top = Object.entries(dom).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(t => t[0] + ' (' + t[1] + ')').join(', ');
    return { total: rows.length, uniqueDomains: Object.keys(dom).length, captures: caps, top }; };

  const status = () => { const s = summarise(buffer);
    console.log('%cBuffer: ' + s.total + ' rows \u00b7 ' + s.captures + ' captures \u00b7 '
      + s.uniqueDomains + ' domains', 'font-weight:bold');
    if (s.top) console.log('  top domains: ' + s.top);
    return s; };

  async function scan(fileId, noteArg) {
    const ts = new Date().toISOString();
    const meta = { captureId: 'cap_' + Date.now(), fileId: String(fileId == null ? '' : fileId),
      note: String(noteArg == null ? '' : noteArg), ts, date: ts.slice(0, 10),
      parsed: parseId(fileId) };
    console.log('%cScanning \u2014 ' + platform + (meta.fileId ? ' \u00b7 ' + meta.fileId : ''), 'font-weight:bold');
    const map = new Map();
    for (const sc of findContainers()) await autoScroll(sc, map, meta);
    const rows = [...map.values()].map((r, i) => ({ rank: i + 1, ...r }));
    buffer = buffer.concat(rows);
    persist();
    console.log('  this capture: ' + rows.length + ' sources');
    status();
    window.__aiSources = rows;
    return rows;
  }

  const toCSV = rows => { if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    return [cols.join(',')].concat(rows.map(r =>
      cols.map(c => '"' + String(r[c] == null ? '' : r[c]).replace(/"/g, '""') + '"').join(','))).join('\n'); };
  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dl = (name, content, mime) => { try {
      const b = new Blob([content], { type: mime }); const u = URL.createObjectURL(b);
      const a = document.createElement('a'); a.href = u; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch (e) { navigator.clipboard.writeText(content); console.warn('Download blocked \u2014 copied to clipboard.'); } };

  // ---- public API --------------------------------------------------------
  const api = (fileId, note) => scan(fileId, note);   // grab('file_id'[, 'note'])
  api.scan     = scan;
  api.status   = status;
  api.clear    = () => { buffer = []; window.__aiSources = []; try { localStorage.removeItem(LS_KEY); } catch (e) {} console.log('buffer cleared'); };
  api.csv      = () => dl('ai-sources_' + platform + '_' + stamp() + '.csv', toCSV(buffer), 'text/csv');
  api.json     = () => dl('ai-sources_' + platform + '_' + stamp() + '.json', JSON.stringify(buffer, null, 2), 'application/json');
  Object.defineProperty(api, 'buffer', { get: () => buffer });

  window.grab = api;              // neutral name
  window.aiSourceScraper = api;   // matches extension/userscript global
  window.ass = api;               // short alias

  console.log('%cAI Source Scraper \u2014 buffered console build ready (' + platform + ')', 'font-weight:bold;color:#5b8def');
  if (buffer.length) console.log('Restored ' + buffer.length + ' rows from a previous session. grab.clear() to start fresh.');
  console.log("Scan:  aiSourceScraper.scan('topic_promptid_threadstate')   e.g. scan('medium_p0_warm')");
  console.log("Download:  aiSourceScraper.csv()  aiSourceScraper.json()     Reset:  aiSourceScraper.clear()");
})();
