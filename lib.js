// OffTheBin core: Overpass query, hours parsing, freshness + confidence scoring.
// Works in the browser (window.OTB) and in Node (module.exports) so the eval uses the exact same code.
(function (root) {
  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  const DAY = 86400000;

  // Tier "listed": the place is tagged as accepting this material. Tier "possible" (opt-in): a general recycling
  // centre that may take it; shown as unconfirmed and always ranked below listed sites. amenity=waste_disposal is
  // deliberately excluded: in OSM it is mostly ordinary bins and skips, the exact place these items must not go.
  function buildQuery(keys, lat, lon, radius, withPossible) {
    const a = `(around:${radius},${lat},${lon})`;
    const parts = keys.map(k => `nwr["amenity"="recycling"]["${k}"="yes"]${a};`);
    if (withPossible) parts.push(`nwr["amenity"="recycling"]["recycling_type"="centre"]${a};`);
    return `[out:json][timeout:25];(${parts.join('')});out center meta;`;
  }

  async function fetchSites(keys, lat, lon, radius, fetchImpl, withPossible) {
    const f = fetchImpl || fetch;
    let lastErr;
    for (const url of OVERPASS) {
      try {
        const r = await f(url, {
          method: 'POST',
          signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: 'data=' + encodeURIComponent(buildQuery(keys, lat, lon, radius, withPossible)),
        });
        if (!r.ok) throw new Error('Overpass ' + r.status);
        return (await r.json()).elements.map(e => normalise(e, lat, lon, keys));
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  function haversine(a, b, c, d) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (c - a) * rad, dLon = (d - b) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function normalise(e, lat, lon, keys) {
    const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
    const t = e.tags || {};
    const listed = !keys || keys.some(k => t[k] === 'yes');
    return {
      id: `${e.type}/${e.id}`, lat: la, lon: lo, tags: t, tier: listed ? 'listed' : 'possible',
      name: t.name || t.operator || t.brand || 'Unnamed drop-off point',
      timestamp: e.timestamp, version: e.version,
      km: haversine(lat, lon, la, lo),
    };
  }

  // ---- opening_hours: small honest parser. Returns true/false, or null when we can't tell. ----
  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  function dayRange(s) {
    const out = new Set();
    for (const part of s.split(',')) {
      const m = part.trim().match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
      if (!m) return null;
      let i = DAYS.indexOf(m[1]); const j = DAYS.indexOf(m[2] || m[1]);
      for (let n = 0; n < 8; n++) { out.add(i); if (i === j) break; i = (i + 1) % 7; }
    }
    return out;
  }
  function isOpenNow(oh, now) {
    if (!oh) return null;
    const s = oh.trim();
    if (s === '24/7') return true;
    now = now || new Date();
    const day = now.getDay(), mins = now.getHours() * 60 + now.getMinutes();
    let matched = false, open = false;
    for (const rule of s.split(';')) {
      const r = rule.trim();
      if (!r) continue;
      // Date exceptions like "Jan 01, Dec 25-26 off": closed if today is listed, otherwise irrelevant.
      const dm = r.match(/^((?:[A-Z][a-z]{2} \d{1,2}(?:-\d{1,2})?\s*,?\s*)+)(off|closed)$/);
      if (dm) {
        const mon = now.toLocaleString('en', { month: 'short' }), d = now.getDate();
        const hit = dm[1].split(',').some(p => {
          const m = p.trim().match(/^([A-Z][a-z]{2}) (\d{1,2})(?:-(\d{1,2}))?$/);
          return m && m[1] === mon && d >= +m[2] && d <= +(m[3] || m[2]);
        });
        if (hit) return false;
        continue;
      }
      if (/PH|SH|week|\[|sunrise|sunset|easter|"/i.test(r)) return null;
      const m = r.match(/^(?:([A-Za-z,\-]+)\s+)?((?:\d{1,2}:\d{2}-\d{1,2}:\d{2})(?:\s*,\s*\d{1,2}:\d{2}-\d{1,2}:\d{2})*|off|closed)$/);
      if (!m) return null;
      const days = m[1] ? dayRange(m[1]) : new Set([0, 1, 2, 3, 4, 5, 6]);
      if (!days) return null;
      if (!days.has(day)) continue;
      matched = true;
      if (/^(off|closed)$/.test(m[2])) { open = false; continue; }
      open = m[2].split(',').some(w => {
        const [a, b] = w.trim().split('-');
        const [ah, am] = a.split(':').map(Number), [bh, bm] = b.split(':').map(Number);
        const s0 = ah * 60 + am, e0 = bh * 60 + bm;
        return e0 > s0 ? mins >= s0 && mins < e0 : mins >= s0 || mins < e0;
      });
    }
    return matched ? open : false;
  }

  // ---- Freshness: how recently did a human touch this record in OSM? ----
  function ageDays(ts, now) { return ts ? ((now || Date.now()) - new Date(ts).getTime()) / DAY : null; }
  function freshness(ts, now) {
    const a = ageDays(ts, now);
    if (a == null) return { label: 'unknown', score: 0, days: null };
    if (a <= 365) return { label: 'recent', score: 1, days: a };
    if (a <= 3 * 365) return { label: 'aging', score: 0.6, days: a };
    return { label: 'stale', score: 0.25, days: a };
  }

  // Confidence 0-100: an honest "should you drive there?" signal, not a guarantee.
  function confidence(site, now) {
    const fr = freshness(site.timestamp, now);
    const t = site.tags;
    let c = 45 * fr.score;
    if (t.opening_hours) c += 20;
    if (t.name || t.operator) c += 10;
    if (t.website || t['contact:website'] || t.phone || t['contact:phone']) c += 15;
    if (t.access && !['yes', 'public', 'permissive'].includes(t.access)) c -= 25;
    if (t.fixme || t.note) c -= 5;
    if ((site.version || 1) >= 3) c += 10;
    if (site.tier === 'possible') c = Math.min(c, 30);
    return Math.max(0, Math.min(100, Math.round(c)));
  }

  function rank(sites, now) {
    return sites.map(s => {
      const open = isOpenNow(s.tags.opening_hours, now);
      const conf = confidence(s, now);
      // closed-now sites are pushed down, unknown hours are neutral; distance still dominates.
      const penalty = (open === false ? 6 : 0) + (100 - conf) / 20 + (s.tier === 'possible' ? 15 : 0);
      return { ...s, open, conf, fresh: freshness(s.timestamp, now), score: s.km + penalty };
    }).sort((a, b) => a.score - b.score);
  }

  const api = { buildQuery, fetchSites, haversine, normalise, isOpenNow, freshness, confidence, rank, ageDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OTB = api;
})(typeof window !== 'undefined' ? window : globalThis);
