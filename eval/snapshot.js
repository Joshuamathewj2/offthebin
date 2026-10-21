// Saves an offline copy of drop-off data for demo cities, used by the app when Overpass is overloaded.
// Usage: node eval/snapshot.js   (resumable: cities already saved are skipped; delete a file to refresh it)
const fs = require('fs');
const path = require('path');
const OTB = require('../lib.js');

const CITIES = [
  ['Chennai', 13.0827, 80.2707], ['Mumbai', 19.076, 72.8777], ['Brisbane', -27.4698, 153.0251],
  ['London', 51.5074, -0.1278], ['New York', 40.7128, -74.006], ['Berlin', 52.52, 13.405],
  ['Nairobi', -1.2921, 36.8219], ['Sao Paulo', -23.5505, -46.6333],
];
const RADIUS = 30000;
const DIR = path.join(__dirname, '..', 'data', 'snapshots');
const items = require('../data/items.json');
const keys = [...new Set(items.flatMap(i => i.keys))];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fetchUA = (u, o) => fetch(u, { ...o, headers: { ...(o.headers || {}), 'User-Agent': 'OffTheBin-snapshot/1.0 (hackathon project)' } });

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const index = [];
  for (const [name, lat, lon] of CITIES) {
    const file = name.toLowerCase().replace(/\s+/g, '-') + '.json';
    const out = path.join(DIR, file);
    if (!fs.existsSync(out)) {
      let sites;
      for (let i = 0; i < 5 && !sites; i++) {
        try { sites = await OTB.fetchSites(keys, lat, lon, RADIUS, fetchUA, true); }
        catch (e) { console.log(name, 'attempt', i + 1, 'failed:', e.message); await sleep(15000 * (i + 1)); }
      }
      if (!sites) { console.log(name, 'SKIPPED'); continue; }
      // Store raw-ish records so the app can re-derive the tier for whichever item is searched.
      const elements = sites.map(s => ({ id: s.id, lat: s.lat, lon: s.lon, tags: s.tags, timestamp: s.timestamp, version: s.version }));
      fs.writeFileSync(out, JSON.stringify({ city: name, lat, lon, radiusM: RADIUS, fetchedAt: new Date().toISOString(), elements }));
      console.log(name, elements.length, 'records');
      await sleep(5000);
    }
    index.push({ city: name, lat, lon, file });
  }
  fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify(index, null, 1));
  console.log('index:', index.map(c => c.city).join(', '));
})();
