// Turns eval/impact-log.csv into verified impact numbers by checking every OSM link against live OpenStreetMap.
// Usage: node eval/impact.js   -> eval/IMPACT.md
// A row counts as "verified on the map" only if the OSM record exists, carries a check_date, and is tagged as
// accepting at least one OffTheBin material. Nothing here is self-reported beyond the outcome column.
const fs = require('fs');
const path = require('path');
const items = require('../data/items.json');

const KEYS = new Set(items.flatMap(i => i.keys));
const LOG = path.join(__dirname, 'impact-log.csv');
const UA = { 'User-Agent': 'OffTheBin-impact/1.0 (hackathon project)' };

function rows() {
  const [head, ...body] = fs.readFileSync(LOG, 'utf8').split(/\r?\n/).filter(l => l.trim());
  const cols = head.split(',');
  return body.map(l => {
    const cells = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
    return Object.fromEntries(cols.map((c, i) => [c, (cells[i] || '').trim()]));
  });
}

async function osm(url) {
  const m = url.match(/openstreetmap\.org\/(node|way|relation)\/(\d+)/);
  if (!m) return null;
  const r = await fetch(`https://api.openstreetmap.org/api/0.6/${m[1]}/${m[2]}.json`, { headers: UA });
  if (!r.ok) return null;
  const e = (await r.json()).elements[0];
  return e && e.visible !== false ? e : null;
}

(async () => {
  const log = rows();
  const out = [];
  for (const r of log) {
    const e = r.osm_url ? await osm(r.osm_url) : null;
    const t = (e && e.tags) || {};
    const accepts = Object.keys(t).filter(k => KEYS.has(k) && t[k] === 'yes');
    out.push({ ...r, onMap: !!e, checkDate: t.check_date || '', accepts, verified: !!e && !!t.check_date && accepts.length > 0 });
  }
  const verified = out.filter(r => r.verified);
  const byOutcome = o => out.filter(r => r.outcome === o).length;
  const battery = verified.filter(r => r.accepts.some(k => /batter/.test(k))).length;
  let md = `# Impact log (checked against live OpenStreetMap ${new Date().toISOString().slice(0, 10)})\n\n`;
  md += `- Targets surveyed: **${out.length}** of 20\n- Verified on the map (record exists, has check_date, accepts an OffTheBin material): **${verified.length}**\n`;
  md += `- Of those, taking household or car batteries: **${battery}**\n- Added new: ${byOutcome('added')} · updated existing: ${byOutcome('updated')} · zone said no centre: ${byOutcome('no centre')} · does not take these items: ${byOutcome('does not take')}\n\n`;
  md += `| Target | Date | Outcome | On map | check_date | Accepts (from OSM) |\n|---|---|---|---|---|---|\n`;
  md += out.map(r => `| ${r.target} | ${r.date} | ${r.outcome} | ${r.onMap ? `[yes](${r.osm_url})` : 'no'} | ${r.checkDate} | ${r.accepts.map(k => k.replace('recycling:', '')).join(', ')} |`).join('\n') + '\n';
  fs.writeFileSync(path.join(__dirname, 'IMPACT.md'), md);
  console.log(md);
})();
