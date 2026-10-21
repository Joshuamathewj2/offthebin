// Run: node --test
const test = require('node:test');
const assert = require('node:assert');
const OTB = require('../lib.js');

const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min);
const NOW = at(2026, 10, 21, 10); // a Wednesday

test('opening hours: simple ranges', () => {
  assert.strictEqual(OTB.isOpenNow('Mo-Fr 09:00-17:00', NOW), true);
  assert.strictEqual(OTB.isOpenNow('Mo-Fr 09:00-17:00', at(2026, 10, 21, 18)), false);
  assert.strictEqual(OTB.isOpenNow('Mo-Fr 09:00-17:00; Sa 10:00-14:00', at(2026, 10, 25, 11)), false); // Sunday
  assert.strictEqual(OTB.isOpenNow('Sa,Su 10:00-14:00', at(2026, 10, 25, 11)), true);
  assert.strictEqual(OTB.isOpenNow('24/7', NOW), true);
});

test('opening hours: split shifts and overnight', () => {
  assert.strictEqual(OTB.isOpenNow('Mo-Su 09:00-12:00,14:00-18:00', at(2026, 10, 21, 13)), false);
  assert.strictEqual(OTB.isOpenNow('Mo-Su 09:00-12:00,14:00-18:00', at(2026, 10, 21, 15)), true);
  assert.strictEqual(OTB.isOpenNow('Mo-Su 22:00-02:00', at(2026, 10, 21, 23)), true);
});

test('opening hours: date exceptions close only on listed days', () => {
  const oh = 'Mo-Su 08:30-16:30; Jan 01, Dec 25-26 off';
  assert.strictEqual(OTB.isOpenNow(oh, NOW), true);
  assert.strictEqual(OTB.isOpenNow(oh, at(2026, 12, 25, 10)), false);
  assert.strictEqual(OTB.isOpenNow(oh, at(2027, 1, 1, 10)), false);
});

test('opening hours: unknown instead of a guess', () => {
  assert.strictEqual(OTB.isOpenNow(undefined, NOW), null);
  assert.strictEqual(OTB.isOpenNow('Mo-Fr 09:00-12:00; PH 10:00-11:00', NOW), null);
  assert.strictEqual(OTB.isOpenNow('sunrise-sunset', NOW), null);
  assert.strictEqual(OTB.isOpenNow('by appointment', NOW), null);
});

test('opening hours: "PH off" is ignored on ordinary days', () => {
  assert.strictEqual(OTB.isOpenNow('Mo-Fr 09:00-19:00; Sa 07:00-14:30; PH off', NOW), true);
  assert.strictEqual(OTB.isOpenNow('Mo-Fr 09:00-19:00; Sa 07:00-14:30; PH off', at(2026, 10, 21, 20)), false);
});

test('freshness buckets', () => {
  const now = NOW.getTime();
  assert.strictEqual(OTB.freshness('2026-06-01T00:00:00Z', now).label, 'recent');
  assert.strictEqual(OTB.freshness('2024-06-01T00:00:00Z', now).label, 'aging');
  assert.strictEqual(OTB.freshness('2018-10-24T09:45:51Z', now).label, 'stale');
  assert.strictEqual(OTB.freshness(undefined, now).label, 'unknown');
});

const el = (tags, timestamp, version = 1) => ({ type: 'node', id: 1, lat: 13.05, lon: 80.25, tags, timestamp, version });

test('check_date counts as a fresh survey', () => {
  const s = OTB.normalise(el({ amenity: 'recycling', 'recycling:batteries': 'yes', check_date: '2026-10-01' }, '2018-01-01T00:00:00Z'), 13.08, 80.27, ['recycling:batteries']);
  assert.strictEqual(s.surveyed, true);
  assert.strictEqual(OTB.freshness(s.timestamp, NOW.getTime()).label, 'recent');
});

test('confidence: rich recent listing beats stale bare one; unconfirmed tier is capped', () => {
  const keys = ['recycling:batteries'];
  const rich = OTB.normalise(el({ amenity: 'recycling', 'recycling:batteries': 'yes', name: 'A', opening_hours: 'Mo-Fr 09:00-17:00', phone: '+91 1' }, '2026-09-01T00:00:00Z', 4), 13.08, 80.27, keys);
  const bare = OTB.normalise(el({ amenity: 'recycling', 'recycling:batteries': 'yes' }, '2015-01-01T00:00:00Z'), 13.08, 80.27, keys);
  const centre = OTB.normalise(el({ amenity: 'recycling', recycling_type: 'centre', name: 'C', opening_hours: '24/7', phone: '1' }, '2026-09-01T00:00:00Z', 5), 13.08, 80.27, keys);
  assert.ok(OTB.confidence(rich, NOW.getTime()) >= 65);
  assert.ok(OTB.confidence(bare, NOW.getTime()) < 40);
  assert.strictEqual(centre.tier, 'possible');
  assert.ok(OTB.confidence(centre, NOW.getTime()) <= 30);
});

test('rank: listed sites outrank a nearer unconfirmed centre', () => {
  const keys = ['recycling:batteries'];
  const listed = OTB.normalise({ ...el({ amenity: 'recycling', 'recycling:batteries': 'yes', name: 'L' }, '2026-09-01T00:00:00Z'), lat: 13.1, lon: 80.27 }, 13.08, 80.27, keys);
  const centre = OTB.normalise({ ...el({ amenity: 'recycling', recycling_type: 'centre', name: 'C' }, '2026-09-01T00:00:00Z'), lat: 13.081, lon: 80.27 }, 13.08, 80.27, keys);
  assert.deepStrictEqual(OTB.rank([centre, listed], NOW).map(s => s.name), ['L', 'C']);
});

test('query: one regex clause plus optional centres', () => {
  const q = OTB.buildQuery(['recycling:batteries', 'recycling:cell_phones'], 1, 2, 5000, true, 30);
  assert.match(q, /\[timeout:30\]/);
  assert.match(q, /\[~"\^\(recycling:batteries\|recycling:cell_phones\)\$"~"\^yes\$"\]/);
  assert.match(q, /recycling_type"="centre"/);
  assert.doesNotMatch(OTB.buildQuery(['recycling:batteries'], 1, 2, 5000, false), /centre/);
});
