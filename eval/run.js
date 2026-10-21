// Measures how trustworthy "nearest battery drop-off" is in 8 cities, and what OffTheBin's ranking changes.
// Usage: node eval/run.js   (needs network; writes eval/RESULTS.md and eval/results.json)
const fs = require('fs');
const path = require('path');
const OTB = require('../lib.js');

const CITIES = [
  ['Chennai, IN', 13.0827, 80.2707], ['Mumbai, IN', 19.076, 72.8777], ['Brisbane, AU', -27.4698, 153.0251],
  ['London, UK', 51.5074, -0.1278], ['New York, US', 40.7128, -74.006], ['Berlin, DE', 52.52, 13.405],
  ['Nairobi, KE', -1.2921, 36.8219], ['Sao Paulo, BR', -23.5505, -46.6333],
];
const RADIUS = 10000;
const UA = { 'User-Agent': 'OffTheBin-eval/1.0 (hackathon project)' };
const NOW = new Date(Date.now());
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

const fetchUA = (u, o) => fetch(u, { ...o, headers: { ...(o.headers || {}), ...UA } });

(async () => {
  const rows = [];
  for (const [name, lat, lon] of CITIES) {
    let sites;
    for (let i = 0; i < 3 && !sites; i++) {
      try { sites = await OTB.fetchSites(['recycling:batteries'], lat, lon, RADIUS, fetchUA); }
      catch (e) { await sleep(5000); }
    }
    if (!sites) { rows.push({ city: name, error: true }); continue; }
    await sleep(2500);
    let withPossible = [];
    for (let i = 0; i < 3 && !withPossible.length; i++) {
      try { withPossible = await OTB.fetchSites(['recycling:batteries'], lat, lon, RADIUS, fetchUA, true); break; }
      catch (e) { await sleep(5000); }
    }
    const possible = withPossible.filter(s => s.tier === 'possible').length;
    const ranked = OTB.rank(sites, NOW);
    const naive = [...sites].sort((a, b) => a.km - b.km).slice(0, 3).map(s => ({ ...s, conf: OTB.confidence(s, NOW), fresh: OTB.freshness(s.timestamp, NOW) }));
    const top = ranked.slice(0, 3);
    const ages = sites.map(s => OTB.ageDays(s.timestamp, NOW) / 365);
    const lowConf = x => x.filter(s => s.conf < 40).length;
    const stale = x => x.filter(s => s.fresh.label === 'stale').length;
    rows.push({
      city: name, n: sites.length, possible,
      withHours: pct(sites.filter(s => s.tags.opening_hours).length, sites.length),
      parsableHours: pct(sites.filter(s => OTB.isOpenNow(s.tags.opening_hours, NOW) !== null).length, sites.length),
      staleOver3y: pct(sites.filter(s => OTB.freshness(s.timestamp, NOW).label === 'stale').length, sites.length),
      medianAgeYears: ages.length ? +median(ages).toFixed(1) : null,
      naiveLowConf: lowConf(naive), naiveStale: stale(naive), topLowConf: lowConf(top), topStale: stale(top),
      naiveTop3: naive.length, top3: top.length,
    });
    console.log(name, rows[rows.length - 1]);
    await sleep(2500);
  }
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ at: NOW.toISOString(), radiusM: RADIUS, rows }, null, 2));

  const ok = rows.filter(r => !r.error);
  const tot = k => ok.reduce((a, r) => a + r[k], 0);
  let md = `# OffTheBin evaluation\n\nRun ${NOW.toISOString().slice(0, 10)}. Source: OpenStreetMap via Overpass, \`amenity=recycling\` + \`recycling:batteries=yes\`, ${RADIUS / 1000} km around each city centre. Reproduce: \`node eval/run.js\`.\n\n`;
  md += `| City | Battery drop-offs | Extra unconfirmed candidates | Have opening hours | Hours we can parse | Not edited in 3+ yrs | Median record age (yrs) | Nearest-3 low-confidence | Nearest-3 stale | OffTheBin top-3 low-confidence | OffTheBin top-3 stale |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of rows) md += r.error ? `| ${r.city} | fetch failed | | | | | | | | | |\n`
    : `| ${r.city} | ${r.n} | ${r.possible} | ${r.withHours}% | ${r.parsableHours}% | ${r.staleOver3y}% | ${r.medianAgeYears ?? '-'} | ${r.naiveLowConf}/${r.naiveTop3} | ${r.naiveStale}/${r.naiveTop3} | ${r.topLowConf}/${r.top3} | ${r.topStale}/${r.top3} |\n`;
  md += `\n**Coverage:** ${ok.filter(r => r.n === 0).length} of ${ok.length} cities have zero drop-offs explicitly tagged as taking batteries within ${RADIUS / 1000} km; ${ok.filter(r => r.n === 0 && r.possible > 0).length} of those gain unconfirmed candidates (general recycling centres) from the fallback tier.\n\n**Ranking, across ${ok.length} cities:** nearest-3 results were low-confidence ${tot('naiveLowConf')}/${tot('naiveTop3')} times and stale ${tot('naiveStale')}/${tot('naiveTop3')} times; after OffTheBin re-ranking: ${tot('topLowConf')}/${tot('top3')} and ${tot('topStale')}/${tot('top3')}.\n\n`;
  md += `## Honest limits\n- "Stale" means the OSM record was not edited for 3+ years. That is a risk signal, not proof the site closed.\n- Confidence is a heuristic (freshness, listed hours, contact info, access, edit history), not validated against phone-call ground truth. Calling 30 sites to calibrate it is the next step.\n- OSM coverage differs a lot by city; low counts mean missing data, not missing services.\n- Opening hours with public-holiday or seasonal rules are reported as "hours unknown" instead of guessed.\n`;
  fs.writeFileSync(path.join(__dirname, 'RESULTS.md'), md);
  console.log('\n' + md);
})();
