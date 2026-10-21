(async function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const items = await (await fetch('data/items.json')).json();
  let current = null, here = null, map = null, scrollPending = false;

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
      token++; // cancel any search still running for the previous place
      $('go').disabled = true;
      say('Finding ' + esc($('place').value) + '…');
      try { here = await geocode($('place').value); }
      catch (e) { $('go').disabled = false; return say('Could not find that place. Try a bigger nearby city.'); }
    }
    run();
  };
  $('place').addEventListener('keydown', e => { if (e.key === 'Enter') $('go').click(); });

  function say(html) { $('out').innerHTML = `<div class="panel">${html}</div>`; }

  // ---- search ----
  let token = 0;
  async function run() {
    $('go').disabled = false;
    if (!current) return say('Pick an item above to start.');
    const it = current;
    const card = `<section class="panel item ${it.hazard === 'fire' ? 'fire' : ''}">
      <span class="tag ${it.hazard}">${it.hazard === 'fire' ? 'FIRE RISK' : it.hazard === 'toxic' ? 'TOXIC' : 'RECYCLABLE'}</span><span class="meta">Never in: ${esc(it.never)}</span>
      <h2>${esc(it.name)}</h2><p>${esc(it.why)}</p>
      <strong>Before you go</strong><ul>${it.prep.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      <p class="hint"><a href="${esc(it.src)}" target="_blank" rel="noopener">Source</a></p></section>`;
    if (!here) { $('out').innerHTML = card + '<div class="panel">Now enter where you are, or use your location.</div>'; return; }
    const my = ++token;
    scrollPending = true;
    $('go').disabled = true;
    // Cache-first: public Overpass often queues requests for 30-40 s, so a saved copy (if this area has one)
    // renders immediately and live data replaces it when it arrives.
    const snap = await loadSnapshot(it);
    if (my !== token) return;
    if (snap) show(it, card, snap.all, snap.radiusM, { kind: 'cached', savedAt: snap.savedAt, refreshing: true });
    else $('out').innerHTML = card + '<div class="panel">Searching OpenStreetMap… the public map server can take up to a minute.</div>';
    let live = null;
    try { live = await OTB.fetchSites(it.keys, here.lat, here.lon, 25000, undefined, true, 60000); } catch (e) {}
    $('go').disabled = false;
    if (my !== token) return;
    if (live && snap && document.querySelector('.report:not([hidden])')) {
      // Don't wipe a report someone is writing; let them switch when ready.
      const bar = document.createElement('div');
      bar.className = 'warn';
      bar.innerHTML = 'Live data is ready. <button class="linkbtn" type="button">Show live data</button>';
      bar.querySelector('button').onclick = () => show(it, card, live, 25000, { kind: 'live' });
      $('out').querySelector('section.panel:not(.item)')?.prepend(bar);
    } else if (live) show(it, card, live, 25000, { kind: 'live' });
    else if (snap) show(it, card, snap.all, snap.radiusM, { kind: 'cached', savedAt: snap.savedAt, refreshing: false });
    else $('out').innerHTML = card + '<div class="panel">The public map server is overloaded and there is no saved copy for this area yet. Please try again in a minute.</div>';
  }

  // Widen client-side: listed sites first; only when fewer than 3 are listed do general recycling centres
  // join as unconfirmed.
  function show(it, card, all, maxRadius, source) {
    let sites = [], radius = 0;
    for (const r of [8000, 15000, 25000].filter(r => r <= maxRadius).concat(maxRadius < 25000 ? [maxRadius] : [])) {
      radius = r;
      const near = all.filter(s => s.km * 1000 <= r);
      const listed = near.filter(s => s.tier === 'listed');
      sites = listed.length >= 3 ? listed : near;
      if (sites.length >= 3) break;
    }
    render(it, card, OTB.rank(sites), radius, source);
  }

  // Saved copy built by eval/snapshot.js. Only used when the searched point is well inside its coverage.
  async function loadSnapshot(it) {
    try {
      const idx = await (await fetch('data/snapshots/index.json')).json();
      const c = idx.map(c => ({ ...c, d: OTB.haversine(here.lat, here.lon, c.lat, c.lon) })).sort((a, b) => a.d - b.d)[0];
      if (!c || c.d > 10) return null;
      const s = await (await fetch('data/snapshots/' + c.file)).json();
      const all = s.elements
        .map(e => { const [type, id] = e.id.split('/'); return OTB.normalise({ ...e, type, id }, here.lat, here.lon, it.keys); })
        .filter(x => x.tier === 'listed' || x.tags.recycling_type === 'centre');
      // The copy covers radiusM around the city centre; only trust it out to what is still inside that circle.
      return { all, savedAt: s.fetchedAt, radiusM: Math.max(5000, s.radiusM - c.d * 1000) };
    } catch (e) { return null; }
  }

  function sourceHtml(src) {
    if (src.kind === 'live') return '<span class="src live">Live data</span>';
    return `<span class="src cached">Saved copy from ${esc(src.savedAt.slice(0, 10))}</span>${src.refreshing ? ' <span class="meta">checking for live data…</span>' : ' <span class="meta">live server busy</span>'}`;
  }

  // Official channels for areas where the map is thin. Linked, not copied: the TNPCB directory forbids reproduction.
  function localHelp() {
    const inTN = here.lat > 8 && here.lat < 13.6 && here.lon > 76.2 && here.lon < 80.4;
    const nearChennai = OTB.haversine(here.lat, here.lon, 13.0827, 80.2707) < 35;
    if (!inTN) return '';
    return `<div class="warn"><strong>Official options here:</strong> ${nearChennai ? 'Greater Chennai Corporation runs a domestic hazardous waste collection centre in each zone. Ask for your zone\'s centre on helpline <a href="tel:1913">1913</a> or the Namma Chennai app. ' : ''}Authorised recyclers (mostly for bulk quantities) are listed in the <a href="https://tnpcb.gov.in/PDF/Updates/Whats_New/Recyclers_Directory_2025.pdf" target="_blank" rel="noopener">TNPCB Recyclers Directory 2025</a> (PDF, 15 MB).</div>`;
  }

  function render(it, card, ranked, radius, source) {
    const shown = ranked.slice(0, 8);
    lastShown = shown;
    const km = radius / 1000;
    let html = card;
    if (!shown.length) {
      html += `<div class="panel">${sourceHtml(source)}<br><strong>No mapped drop-off for this within ${km} km.</strong>
        <p>That usually means the map is missing data here, not that no service exists. Try your municipal body's e-waste or hazardous-waste desk, or the shop that sold you the item (many are legally required to take it back).</p>
        ${localHelp()}
        <p class="hint">Know a place? <a href="https://www.openstreetmap.org/#map=15/${here.lat}/${here.lon}" target="_blank" rel="noopener">Add it to OpenStreetMap</a> so the next person finds it.</p></div>`;
    } else {
      const widened = km > 8 ? `<div class="warn">Nothing close by in the map, so the search widened to ${km} km.</div>` : '';
      const sparse = shown.every(s => s.conf < 40) ? `<div class="warn"><strong>Low trust everywhere nearby.</strong> Every listing is old or thin on detail. Call before you travel${it.hazard === 'fire' ? ', and never leave a lithium battery unattended at a closed site' : ''}.</div>` : '';
      html += `<section class="panel"><strong>${shown.length} drop-off${shown.length > 1 ? 's' : ''} near ${esc(here.label)}</strong> ${sourceHtml(source)}${widened}${sparse}${shown.filter(s => s.tier === 'listed').length < 3 ? localHelp() : ''}<div id="map" role="img" aria-label="Map of drop-off points"></div><div id="list">`;
      html += shown.map((s, i) => siteHtml(s, i)).join('');
      html += `</div></section>`;
    }
    $('out').innerHTML = html;
    if (shown.length) drawMap(shown);
    // On phones the results start below the item chips; bring them into view once per search, not on the
    // live refresh that replaces a cached result.
    if (scrollPending) { scrollPending = false; $('out').querySelector('section.panel:not(.item)')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
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
        <div class="meta"><span class="open ${o[0]}">${o[1]}</span>${s.tags.opening_hours ? ' · ' + esc(s.tags.opening_hours) : ''}${/\bPH\s+(off|closed)/.test(s.tags.opening_hours || '') && s.open !== null ? ' (closed on public holidays)' : ''} · ${s.km.toFixed(1)} km</div>
        <div class="meta">${esc(s.tags['addr:street'] ? [s.tags['addr:housenumber'], s.tags['addr:street']].filter(Boolean).join(' ') : '')}</div>
        ${possible}
        <div class="meta">Why this score: ${esc(reasons(s))}</div>
        <div class="links"><a href="https://www.openstreetmap.org/directions?to=${s.lat}%2C${s.lon}" target="_blank" rel="noopener">Directions</a>
          ${phone ? `<a href="tel:${esc(phone)}">Call</a>` : ''}${web && /^https?:/.test(web) ? `<a href="${esc(web)}" target="_blank" rel="noopener">Website</a>` : ''}
          <a href="https://www.openstreetmap.org/edit?${type}=${id}" target="_blank" rel="noopener">Fix this listing</a>
          <button class="linkbtn" type="button" data-report="${i}">Report a problem</button></div>
        <div class="report" id="report-${i}" hidden></div></div>
      <div class="conf"><strong>${lab}</strong><div class="meta">${s.conf}/100</div><div class="bar ${level}"><i style="width:${s.conf}%"></i></div></div>
    </article>`;
  }

  // ---- Report a problem: anonymous OpenStreetMap Note at the site, so local mappers can fix the data. ----
  // ?osm=dev sends to the OSM development server instead (for testing without touching the real map).
  const NOTES_API = /[?&]osm=dev\b/.test(location.search) ? 'https://master.apis.dev.openstreetmap.org' : 'https://api.openstreetmap.org';
  const REASONS = {
    closed: 'This place has closed or moved.',
    refuses: 'This place does not accept ITEM.',
    hours: 'The opening hours shown are wrong.',
    confirmed: 'Confirmed: this place accepts ITEM.',
  };
  let lastShown = [];
  function noteText(s, reason, extra) {
    const [type, id] = s.id.split('/');
    return [`${REASONS[reason].replace('ITEM', current.name.split(' (')[0].toLowerCase())}`, extra && extra.trim() ? `Details: ${extra.trim().slice(0, 500)}` : '',
      `Place: ${s.name} (https://www.openstreetmap.org/${type}/${id})`, `Reported via OffTheBin on ${new Date().toISOString().slice(0, 10)}. #OffTheBin`].filter(Boolean).join('\n');
  }
  $('out').addEventListener('click', async e => {
    const open = e.target.closest('[data-report]');
    if (open) {
      const i = +open.dataset.report, box = $('report-' + i);
      box.hidden = !box.hidden;
      if (!box.hidden && !box.innerHTML) {
        box.innerHTML = `<fieldset><legend>What's wrong?</legend>${Object.entries(REASONS).map(([k, v], n) => `<label><input type="radio" name="r${i}" value="${k}" ${n ? '' : 'checked'}> ${esc(v.replace('ITEM', 'this item'))}</label>`).join('')}</fieldset>
          <label for="x${i}" class="meta">Details (optional, public)</label><input type="text" id="x${i}" maxlength="500" placeholder="e.g. new address, or the hours on the board">
          <pre class="preview" aria-live="polite"></pre>
          <button class="btn" type="button" data-send="${i}">Post public note to OpenStreetMap</button>
          <p class="hint">Notes are public and anonymous. Volunteers who edit the map near this place see them. Don't include personal details.</p>`;
      }
      if (!box.hidden) preview(i);
      return;
    }
    const send = e.target.closest('[data-send]');
    if (!send) return;
    const i = +send.dataset.send, s = lastShown[i], box = $('report-' + i);
    send.disabled = true; send.textContent = 'Sending…';
    try {
      const body = new URLSearchParams({ lat: s.lat, lon: s.lon, text: noteText(s, box.querySelector('input[type=radio]:checked').value, $('x' + i).value) });
      const r = await fetch(NOTES_API + '/api/0.6/notes.json', { method: 'POST', body });
      if (!r.ok) throw new Error(r.status);
      const n = await r.json();
      box.innerHTML = `<p class="ok">Thanks! Note <a href="${NOTES_API.replace('//api.', '//www.')}/note/${n.properties.id}" target="_blank" rel="noopener">#${n.properties.id}</a> is on the map for local mappers.</p>`;
    } catch (err) { send.disabled = false; send.textContent = 'Post public note to OpenStreetMap'; box.querySelector('.hint').textContent = 'Could not reach OpenStreetMap. Please try again.'; }
  });
  $('out').addEventListener('input', e => { const m = e.target.closest('.report'); if (m) preview(+m.id.split('-')[1]); });
  $('out').addEventListener('change', e => { const m = e.target.closest('.report'); if (m) preview(+m.id.split('-')[1]); });
  function preview(i) {
    const box = $('report-' + i);
    box.querySelector('.preview').textContent = noteText(lastShown[i], box.querySelector('input[type=radio]:checked').value, $('x' + i).value);
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
