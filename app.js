(async function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const items = await (await fetch('data/items.json')).json();
  let current = null, here = null, map = null, layer = null;

  // ---- item picker ----
  $('suggest').innerHTML = items.map(i => `<option value="${esc(i.name)}">`).join('');
  $('chips').innerHTML = items.map(i => `<button class="chip" aria-pressed="false" data-id="${i.id}">${esc(i.name.split(' (')[0])}</button>`).join('');
  function findItem(text) {
    const t = text.trim().toLowerCase();
    if (!t) return null;
    return items.find(i => i.name.toLowerCase() === t) ||
      items.find(i => i.aliases.some(a => t.includes(a) || a.includes(t))) ||
      items.find(i => i.name.toLowerCase().includes(t));
  }
  function pick(it) {
    current = it;
    document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.id === (it && it.id))));
    if (it) { $('q').value = it.name; try { history.replaceState(null, '', '#' + it.id); } catch (e) {} }
    run();
  }
  $('chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) pick(items.find(i => i.id === b.dataset.id)); });
  $('q').addEventListener('change', () => { const it = findItem($('q').value); if (it) pick(it); });

  // ---- location ----
  $('geo').onclick = () => {
    if (!navigator.geolocation) return say('Your browser has no geolocation. Type a city instead.');
    navigator.geolocation.getCurrentPosition(
      p => { here = { lat: p.coords.latitude, lon: p.coords.longitude, label: 'your location' }; $('place').value = 'My location'; run(); },
      () => say('Location was blocked. Type a city or area instead.'));
  };
  async function geocode(text) {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(text), { headers: { Accept: 'application/json' } });
    const j = await r.json();
    if (!j.length) throw new Error('not found');
    return { lat: +j[0].lat, lon: +j[0].lon, label: j[0].display_name.split(',').slice(0, 2).join(',') };
  }
  $('go').onclick = async () => {
    const it = findItem($('q').value); if (it) current = it;
    if ($('place').value && $('place').value !== 'My location') {
      try { here = await geocode($('place').value); } catch (e) { return say('Could not find that place. Try a bigger nearby city.'); }
    }
    run();
  };
  $('place').addEventListener('keydown', e => { if (e.key === 'Enter') $('go').click(); });

  function say(html) { $('out').innerHTML = `<div class="panel">${html}</div>`; }

  // ---- search ----
  let token = 0;
  async function run() {
    if (!current) return say('Pick an item above to start.');
    const it = current;
    const card = `<section class="panel item ${it.hazard === 'fire' ? 'fire' : ''}">
      <span class="tag ${it.hazard}">${it.hazard === 'fire' ? 'FIRE RISK' : it.hazard === 'toxic' ? 'TOXIC' : 'RECYCLABLE'}</span><span class="meta">Never in: ${esc(it.never)}</span>
      <h2>${esc(it.name)}</h2><p>${esc(it.why)}</p>
      <strong>Before you go</strong><ul>${it.prep.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      <p class="hint"><a href="${esc(it.src)}" target="_blank" rel="noopener">Source</a></p></section>`;
    if (!here) { $('out').innerHTML = card + '<div class="panel">Now enter where you are, or use your location.</div>'; return; }
    const my = ++token;
    $('out').innerHTML = card + '<div class="panel">Searching OpenStreetMap…</div>';
    $('go').disabled = true;
    // One request for everything within 30 km, then widen client-side: listed sites first, and only when
    // fewer than 3 are listed do general recycling centres join as unconfirmed.
    let all, savedAt = null;
    try { all = await OTB.fetchSites(it.keys, here.lat, here.lon, 30000, undefined, true); }
    catch (e) {
      const snap = await loadSnapshot(it);
      if (!snap) { $('go').disabled = false; return ($('out').innerHTML = card + '<div class="panel">The map server is busy and there is no saved copy for this area. Please try again in a moment.</div>'); }
      ({ all, savedAt } = snap);
    }
    $('go').disabled = false;
    if (my !== token) return;
    let sites = [], radius = 0;
    for (const r of [8000, 15000, 30000]) {
      radius = r;
      const near = all.filter(s => s.km * 1000 <= r);
      const listed = near.filter(s => s.tier === 'listed');
      sites = listed.length >= 3 ? listed : near;
      if (sites.length >= 3) break;
    }
    render(it, card, OTB.rank(sites), radius, savedAt);
  }

  // Offline copy for when public Overpass servers are overloaded (see eval/snapshot.js).
  async function loadSnapshot(it) {
    try {
      const idx = await (await fetch('data/snapshots/index.json')).json();
      const c = idx.map(c => ({ ...c, d: OTB.haversine(here.lat, here.lon, c.lat, c.lon) })).sort((a, b) => a.d - b.d)[0];
      if (!c || c.d > 40) return null;
      const s = await (await fetch('data/snapshots/' + c.file)).json();
      const all = s.elements
        .map(e => { const [type, id] = e.id.split('/'); return OTB.normalise({ ...e, type, id }, here.lat, here.lon, it.keys); })
        .filter(x => x.tier === 'listed' || x.tags.recycling_type === 'centre');
      return { all, savedAt: s.fetchedAt };
    } catch (e) { return null; }
  }

  function render(it, card, ranked, radius, savedAt) {
    const shown = ranked.slice(0, 8);
    const km = radius / 1000;
    let html = card;
    if (!shown.length) {
      html += `<div class="panel"><strong>No mapped drop-off for this within ${km} km.</strong>
        <p>That usually means the map is missing data here, not that no service exists. Try your municipal body's e-waste or hazardous-waste desk, or the shop that sold you the item (many are legally required to take it back).</p>
        <p class="hint">Know a place? <a href="https://www.openstreetmap.org/#map=15/${here.lat}/${here.lon}" target="_blank" rel="noopener">Add it to OpenStreetMap</a> so the next person finds it.</p></div>`;
    } else {
      const saved = savedAt ? `<div class="warn">The live map server is busy, so this uses a saved copy of the map from ${esc(savedAt.slice(0, 10))}.</div>` : '';
      const widened = km > 8 ? `<div class="warn">Nothing close by in the map, so the search widened to ${km} km.</div>` : '';
      const sparse = shown.every(s => s.conf < 40) ? `<div class="warn"><strong>Low trust everywhere nearby.</strong> Every listing is old or thin on detail. Call before you travel${it.hazard === 'fire' ? ', and never leave a lithium battery unattended at a closed site' : ''}.</div>` : '';
      html += `<section class="panel"><strong>${shown.length} drop-off${shown.length > 1 ? 's' : ''} near ${esc(here.label)}</strong>${saved}${widened}${sparse}<div id="map" role="img" aria-label="Map of drop-off points"></div><div id="list">`;
      html += shown.map((s, i) => siteHtml(s, i)).join('');
      html += `</div></section>`;
    }
    $('out').innerHTML = html;
    if (shown.length) drawMap(shown);
  }

  function reasons(s) {
    const t = s.tags, r = [];
    r.push(s.fresh.label === 'unknown' ? 'no edit date' : `last edited ${s.fresh.days < 60 ? Math.round(s.fresh.days) + ' days' : (s.fresh.days / 365).toFixed(1) + ' years'} ago`);
    r.push(t.opening_hours ? 'hours listed' : 'no hours listed');
    r.push(t.website || t['contact:website'] || t.phone || t['contact:phone'] ? 'contact details' : 'no contact details');
    if (t.access && !['yes', 'public', 'permissive'].includes(t.access)) r.push('access: ' + t.access);
    return r.join(' · ');
  }
  function siteHtml(s, i) {
    const o = s.open === true ? ['y', 'Open now'] : s.open === false ? ['n', 'Closed now'] : ['u', 'Hours unknown'];
    const level = s.conf >= 65 ? '' : s.conf >= 40 ? 'mid' : 'low';
    const lab = s.tier === 'possible' ? 'Unconfirmed' : s.conf >= 65 ? 'Likely fine' : s.conf >= 40 ? 'Call first' : 'Verify first';
    const possible = s.tier === 'possible' ? '<div class="meta"><strong>Not listed as accepting this.</strong> General recycling centre. Call to ask.</div>' : '';
    const [type, id] = s.id.split('/');
    const phone = s.tags.phone || s.tags['contact:phone'];
    const web = s.tags.website || s.tags['contact:website'];
    return `<article class="site" data-i="${i}">
      <div><h3>${i + 1}. ${esc(s.name)}</h3>
        <div class="meta"><span class="open ${o[0]}">${o[1]}</span>${s.tags.opening_hours ? ' · ' + esc(s.tags.opening_hours) : ''} · ${s.km.toFixed(1)} km</div>
        <div class="meta">${esc(s.tags['addr:street'] ? [s.tags['addr:housenumber'], s.tags['addr:street']].filter(Boolean).join(' ') : '')}</div>
        ${possible}
        <div class="meta">Why this score: ${esc(reasons(s))}</div>
        <div class="links"><a href="https://www.openstreetmap.org/directions?to=${s.lat}%2C${s.lon}" target="_blank" rel="noopener">Directions</a>
          ${phone ? `<a href="tel:${esc(phone)}">Call</a>` : ''}${web && /^https?:/.test(web) ? `<a href="${esc(web)}" target="_blank" rel="noopener">Website</a>` : ''}
          <a href="https://www.openstreetmap.org/edit?${type}=${id}" target="_blank" rel="noopener">Fix this listing</a></div></div>
      <div class="conf"><strong>${lab}</strong><div class="meta">${s.conf}/100</div><div class="bar ${level}"><i style="width:${s.conf}%"></i></div></div>
    </article>`;
  }

  function drawMap(shown) {
    if (map) { map.remove(); map = null; }
    map = L.map('map', { scrollWheelZoom: false }).setView([here.lat, here.lon], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
    const pts = [[here.lat, here.lon]];
    L.circleMarker([here.lat, here.lon], { radius: 8, color: '#1f6feb', fillOpacity: .9 }).addTo(map).bindTooltip('You');
    shown.forEach((s, i) => {
      const col = s.conf >= 65 ? '#1f7a4d' : s.conf >= 40 ? '#b86e00' : '#b3261e';
      L.marker([s.lat, s.lon], { title: s.name, icon: L.divIcon({ className: '', html: `<div style="background:${col};color:#fff;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-weight:700;border:2px solid #fff">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(map).bindPopup(esc(s.name));
      pts.push([s.lat, s.lon]);
    });
    map.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
  }

  // ---- evaluation banner (numbers come from eval/results.json, not hard-coded) ----
  try {
    const ev = await (await fetch('eval/results.json')).json();
    const ok = ev.rows.filter(r => !r.error);
    const sum = k => ok.reduce((a, r) => a + r[k], 0);
    const empty = ok.filter(r => r.n === 0).length, rescued = ok.filter(r => r.n === 0 && r.possible > 0).length;
    $('stat').textContent = `Measured in ${ok.length} cities: ${empty} have zero battery drop-offs tagged on the map (${rescued} gain unconfirmed candidates), and ${sum('naiveStale')} of the ${sum('naiveTop3')} nearest listings are 3+ years old.`;
  } catch (e) { $('stat').remove(); }

  const h = location.hash.slice(1);
  const start = items.find(i => i.id === h);
  if (start) { current = start; $('q').value = start.name; document.querySelector(`.chip[data-id="${start.id}"]`).setAttribute('aria-pressed', 'true'); }
})();
