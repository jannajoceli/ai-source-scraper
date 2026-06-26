/* AI Source Scraper v3 — console one-shot (auto-detect list + auto-scroll)
   Paste this whole block into the browser DevTools Console with a response on
   screen. OPEN THE SOURCES / ACTIVITY PANEL first. It finds the source list
   (wherever it sits), auto-scrolls it to load every card, extracts
   hostname/title/description per source, prints a table and downloads CSV + JSON.
   Works on claude.ai, gemini.google.com, chatgpt.com / chat.openai.com.

   It auto-scrolls for a few seconds — let it finish; the count ticks up in the
   console. Rows are also left in window.__aiSources.                          */

(async () => {
  const h = location.hostname;
  const platform = h.includes('claude.ai') ? 'claude'
    : h.includes('gemini.google') ? 'gemini'
    : (h.includes('chatgpt.com') || h.includes('chat.openai.com')) ? 'chatgpt'
    : 'unknown';

  // UI/account/policy chrome to exclude. Kept TIGHT — google.com / openai.com /
  // anthropic.com stay, since those can be real citations (e.g. Gemini citing
  // Google-owned content). Only their account/settings/support subdomains drop.
  const denyHosts = ['claude.ai','gemini.google.com','chatgpt.com','chat.openai.com',
    'accounts.google.com','myaccount.google.com','policies.google.com','support.google.com',
    'help.openai.com','support.anthropic.com','auth.openai.com','cdn.oaistatic.com',
    'files.oaiusercontent.com'];

  const ts = new Date().toISOString();
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
  // Tracking params stripped to build clean_url (and to merge duplicate URLs). Edit freely.
  const TRACKING_PARAMS = ['fbclid','gclid','gbraid','wbraid','msclkid','dclid','yclid',
    'mc_cid','mc_eid','igshid','_hsenc','_hsmi','vero_id','oly_anon_id','oly_enc_id'];
  const stripTracking = u => { [...u.searchParams.keys()].forEach(k => {
      if (/^utm_/i.test(k) || TRACKING_PARAMS.includes(k.toLowerCase())) u.searchParams.delete(k); });
    return u; };
  const cleanUrl = url => { try { return stripTracking(new URL(url)).href; } catch (e) { return url; } };
  const keyOf = url => { try { const u = stripTracking(new URL(url)); u.hash = ''; return u.href; } catch (e) { return url; } };

  // Climb to the "row": the ancestor whose parent holds >=3 link-bearing children.
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

  const extract = (card, a) => {
    const url = new URL(a.href, location.href).href;
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const img = card.querySelector('img');
    const lines = (card.innerText || '').split('\n').map(s => s.trim())
      .filter(s => s && !/^\+\d+$/.test(s));
    const hostIdx = lines.findIndex(looksHost);
    const rest = lines.filter((_, i) => i !== hostIdx);
    return { capture_timestamp: ts, platform, page_url: location.href, page_title: document.title,
      source_type: lines.length >= 3 ? 'panel' : 'inline',
      url, clean_url: cleanUrl(url), hostname, domain: reg(hostname),
      title: rest[0] || '', description: rest.slice(1).join(' '),
      favicon: img ? img.src : '' };
  };

  const richer = (a, b) =>
    ((b.title + b.description).length > (a.title + a.description).length) ? b : a;

  const harvest = (root, map) => {
    const anchors = [...root.querySelectorAll('a[href^="http"]')].filter(isExt);
    const cards = new Set(anchors.map(rowOf));
    for (const card of cards) {
      const a = (card.matches && card.matches('a[href^="http"]') && isExt(card))
        ? card : [...card.querySelectorAll('a[href^="http"]')].find(isExt);
      if (!a) continue;
      const rec = extract(card, a);
      const key = keyOf(rec.url);
      map.set(key, map.has(key) ? richer(map.get(key), rec) : rec);
    }
  };

  // Candidate scroll regions: (a) parents holding >=2 source rows, plus
  // (b) any scrollable element that contains a source link (virtualization safety net).
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

  const autoScroll = async (sc, map) => {
    const saved = sc.scrollTop;
    try { sc.scrollTop = 0; } catch (e) {}
    await sleep(120);
    let last = map.size, stable = 0;
    for (let i = 0; i < 400; i++) {
      harvest(sc, map);
      if (map.size !== last) { console.log('  collected', map.size); last = map.size; }
      const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4;
      sc.scrollTop = sc.scrollTop + Math.max(120, Math.floor(sc.clientHeight * 0.8));
      await sleep(170);
      if (atBottom) { stable++; if (stable >= 4) break; } else stable = 0;
    }
    harvest(sc, map);
    try { sc.scrollTop = saved; } catch (e) {}
  };

  console.log('%cAI Source Scraper v3 \u2014 ' + platform, 'font-weight:bold');
  const containers = findContainers();
  console.log('scanning ' + containers.length + ' scroll region(s)\u2026 (let it finish)');
  const map = new Map();
  for (const sc of containers) await autoScroll(sc, map);

  const rows = [...map.values()].map((r, i) => ({ rank: i + 1, ...r }));
  const uniqDom = new Set(rows.map(r => r.domain)).size;
  console.log('\n' + rows.length + ' sources \u00b7 ' + uniqDom + ' domains');
  console.table(rows.map(r => ({ rank: r.rank, type: r.source_type, domain: r.domain, title: r.title, url: r.clean_url })));

  const cols = rows.length ? Object.keys(rows[0]) : [];
  const csv = [cols.join(',')].concat(rows.map(r =>
    cols.map(c => '"' + String(r[c] == null ? '' : r[c]).replace(/"/g, '""') + '"').join(','))).join('\n');
  const stamp = ts.replace(/[:.]/g, '-').slice(0, 19);
  const dl = (name, content, mime) => { try {
      const b = new Blob([content], { type: mime }); const u = URL.createObjectURL(b);
      const a = document.createElement('a'); a.href = u; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch (e) { navigator.clipboard.writeText(content); console.warn('Download blocked \u2014 copied to clipboard.'); } };
  dl('ai-sources_' + platform + '_' + stamp + '.csv', csv, 'text/csv');
  dl('ai-sources_' + platform + '_' + stamp + '.json', JSON.stringify(rows, null, 2), 'application/json');

  window.__aiSources = rows;
  console.log('Done. Rows also in window.__aiSources');
})();
