// Ground-truth check for the confidence score.
//   node eval/groundtruth.js make    -> eval/ground-truth/worksheet.csv (30 battery sites: 15 high, 15 low confidence)
//   node eval/groundtruth.js score   -> eval/ground-truth/RESULTS.md from the filled worksheet
// Sites come from the saved snapshots (data/snapshots), so the sample is reproducible and needs no live server.
const fs = require('fs');
const path = require('path');
const OTB = require('../lib.js');

const DIR = path.join(__dirname, 'ground-truth');
const SNAP = path.join(__dirname, '..', 'data', 'snapshots');
const CSV = path.join(DIR, 'worksheet.csv');
const KEYS = ['recycling:batteries'];
const HIGH = 65, LOW = 40, PER_BAND = 15;
const CITIES = ['london', 'berlin', 'chennai'];

const COLS = ['n', 'city', 'band', 'confidence', 'name', 'address', 'opening_hours_claimed', 'last_edited', 'osm_url', 'directions',
  'takes_batteries_today', 'source', 'checked_on', 'notes'];
const csvCell = v => /[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? '');

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(x => x.trim()));
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || '').trim()])));
}

// Deterministic shuffle so "make" always yields the same sample for the same snapshots.
function seeded(arr, seed) {
  const a = [...arr]; let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function make() {
  const now = new Date();
  const pool = [];
  for (const c of CITIES) {
    const file = path.join(SNAP, c + '.json');
    if (!fs.existsSync(file)) { console.log('missing snapshot', c); continue; }
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const e of s.elements) {
      const [type, id] = e.id.split('/');
      const site = OTB.normalise({ ...e, type, id }, s.lat, s.lon, KEYS);
      if (site.tier !== 'listed') continue;
      const conf = OTB.confidence(site, now);
      const band = conf >= HIGH ? 'high' : conf < LOW ? 'low' : null;
      if (band) pool.push({ ...site, city: s.city, conf, band });
    }
  }
  const pick = band => {
    // Round-robin over cities so no single city dominates a band.
    const by = CITIES.map(c => seeded(pool.filter(p => p.band === band && p.city.toLowerCase() === c), 42));
    const out = [];
    while (out.length < PER_BAND && by.some(l => l.length)) for (const l of by) if (l.length && out.length < PER_BAND) out.push(l.shift());
    return out;
  };
  const sample = [...pick('high'), ...pick('low')];
  const counts = b => CITIES.map(c => `${c} ${sample.filter(s => s.band === b && s.city.toLowerCase() === c).length}`).join(', ');
  console.log(`pool: high ${pool.filter(p => p.band === 'high').length}, low ${pool.filter(p => p.band === 'low').length}`);
  console.log(`sample high (${counts('high')}); low (${counts('low')})`);

  fs.mkdirSync(DIR, { recursive: true });
  // Shuffle the order of rows so whoever checks them can't tell the band from position.
  const rows = seeded(sample, 7).map((s, i) => {
    const t = s.tags;
    const addr = [t['addr:housenumber'], t['addr:street'], t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ') || `${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}`;
    const [type, id] = s.id.split('/');
    return {
      n: i + 1, city: s.city, band: s.band, confidence: s.conf, name: s.name, address: addr,
      opening_hours_claimed: t.opening_hours || '', last_edited: (s.timestamp || '').slice(0, 10),
      osm_url: `https://www.openstreetmap.org/${type}/${id}`,
      directions: `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`,
      takes_batteries_today: '', source: '', checked_on: '', notes: '',
    };
  });
  if (fs.existsSync(CSV) && parseCsv(fs.readFileSync(CSV, 'utf8')).some(r => r.takes_batteries_today)) {
    console.log('worksheet.csv already has answers; not overwriting. Delete it to regenerate.');
    return;
  }
  fs.writeFileSync(CSV, [COLS.join(','), ...rows.map(r => COLS.map(c => csvCell(r[c])).join(','))].join('\n') + '\n');
  // A blind copy hides band and score so the checker isn't primed by them.
  const blind = COLS.filter(c => c !== 'band' && c !== 'confidence');
  fs.writeFileSync(path.join(DIR, 'worksheet-blind.csv'), [blind.join(','), ...rows.map(r => blind.map(c => csvCell(r[c])).join(','))].join('\n') + '\n');
  console.log('wrote', CSV, 'and worksheet-blind.csv');
}

// Two-sided Fisher exact test for a 2x2 table [[a,b],[c,d]].
function fisher(a, b, c, d) {
  const lf = n => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
  const n = a + b + c + d, r1 = a + b, c1 = a + c;
  const p = x => Math.exp(lf(r1) + lf(n - r1) + lf(c1) + lf(n - c1) - lf(n) - lf(x) - lf(r1 - x) - lf(c1 - x) - lf(n - r1 - c1 + x));
  const p0 = p(a); let sum = 0;
  for (let x = Math.max(0, c1 - (n - r1)); x <= Math.min(r1, c1); x++) { const px = p(x); if (px <= p0 * (1 + 1e-7)) sum += px; }
  return Math.min(1, sum);
}

function score() {
  // Answers may be typed into either file; the blind one is matched back by row number.
  let rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  const blindFile = path.join(DIR, 'worksheet-blind.csv');
  if (fs.existsSync(blindFile)) {
    const b = Object.fromEntries(parseCsv(fs.readFileSync(blindFile, 'utf8')).map(r => [r.n, r]));
    rows = rows.map(r => r.takes_batteries_today ? r : { ...r, ...['takes_batteries_today', 'source', 'checked_on', 'notes'].reduce((o, k) => ({ ...o, [k]: (b[r.n] || {})[k] || '' }), {}) });
  }
  const yn = v => /^y/i.test(v) ? 'Y' : /^n/i.test(v) ? 'N' : null;
  const done = rows.filter(r => yn(r.takes_batteries_today));
  const band = b => done.filter(r => r.band === b);
  const valid = l => l.filter(r => yn(r.takes_batteries_today) === 'Y').length;
  const h = band('high'), l = band('low');
  const pct = (n, d) => d ? Math.round(100 * n / d) : 0;
  const p = fisher(valid(h), h.length - valid(h), valid(l), l.length - valid(l));
  const gap = pct(valid(h), h.length) - pct(valid(l), l.length);
  const verdict = done.length < 20 ? 'INCOMPLETE: fewer than 20 sites checked, no conclusion yet.'
    : gap >= 25 && p < 0.1 ? 'SCORE WORKS: keep confidence as the headline feature.'
    : gap >= 10 ? 'WEAK SIGNAL: keep the score as a supporting feature; lead with coverage gap + data repair.'
    : 'SCORE DOES NOT PREDICT VALIDITY: kill it as the headline; pivot to coverage gap + data repair.';
  const sources = Object.entries(done.reduce((o, r) => ({ ...o, [r.source || 'unspecified']: (o[r.source || 'unspecified'] || 0) + 1 }), {})).map(([k, v]) => `${k} ${v}`).join(', ');
  let md = `# Ground truth: does the confidence score predict reality?\n\nChecked ${done.length}/${rows.length} sites (${sources}). "Valid" = the place takes household batteries today.\n\n`;
  md += `| Band | Checked | Valid | % valid |\n|---|---|---|---|\n| Score ${HIGH}+ | ${h.length} | ${valid(h)} | ${pct(valid(h), h.length)}% |\n| Score under ${LOW} | ${l.length} | ${valid(l)} | ${pct(valid(l), l.length)}% |\n\n`;
  md += `**Headline:** sites scored ${HIGH}+: ${pct(valid(h), h.length)}% verified correct; sites under ${LOW}: ${pct(valid(l), l.length)}% (Fisher exact p = ${p.toFixed(3)}, n = ${done.length}).\n\n**Verdict:** ${verdict}\n\n`;
  const bad = done.filter(r => yn(r.takes_batteries_today) === 'N');
  if (bad.length) md += `## Sites that failed\n${bad.map(r => `- ${r.name} (${r.city}, score ${r.confidence}): ${r.notes || 'no note'}`).join('\n')}\n`;
  fs.writeFileSync(path.join(DIR, 'RESULTS.md'), md);
  console.log(md);
}

({ make, score })[process.argv[2]] ? ({ make, score })[process.argv[2]]() : console.log('usage: node eval/groundtruth.js make|score');
