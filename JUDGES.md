# OffTheBin: 60-second brief for judges

**Live:** https://joshuamathewj2.github.io/offthebin/ (no login, no keys; try *Lithium-ion pack* + *London*, then *Chennai*)
**Track:** Theme, Rethinking Waste · **Code:** https://github.com/Joshuamathewj2/offthebin (MIT, `node --test` 10/10)

## The problem
Batteries, e-waste, tube lights, paint and oil must never go in a household bin. Lithium-ion batteries in the waste stream start fires: US EPA counted **245 fires at 64 waste facilities** (2013-2020) from public reports alone ([EPA 2021](https://www.epa.gov/node/268935)). People who *want* to dispose of them properly hit stale or missing drop-off data and give up.

## What we measured (8 cities, OpenStreetMap, reproducible with `node eval/run.js`)
- **Gaps:** Mumbai and Brisbane: 0 places tagged as taking batteries within 10 km of the centre. Chennai, New York, São Paulo: 1 each. See [eval/RESULTS.md](eval/RESULTS.md).
- **Staleness:** of the nearest-3 battery drop-offs across all cities, **6 of 12 had not been edited for 3+ years**.
- **Trust score vs reality:** **PENDING** (30 sites, 15 high / 15 low score, checked blind by phone, website or Street View) → [eval/ground-truth/RESULTS.md](eval/ground-truth/RESULTS.md)

## What we built
1. Item-first safety guidance (hazard, prep, never-in), with sources.
2. Nearest drop-offs ranked by distance, open-now status and a **0-100 trust score whose reasons are shown**.
3. Unconfirmed general recycling centres shown separately, never mixed in. Gaps are stated, not hidden.
4. Cache-first: 8 saved cities render in under 1 s; live data replaces them (the public server takes 30-60 s).
5. **Data repair loop:** *Report a problem* on every result turns a user's "this place closed" into an anonymous public OpenStreetMap Note for local mappers (no account); *Fix this listing* for mappers; a 20-target survey guide for Chennai; a script that counts contributions from live OSM.

## Impact evidence
- **PENDING:** "Added N verified drop-off points to OpenStreetMap in Chennai" (from `node eval/impact.js`, checked against live OSM, each with `check_date`).
- Anything added to OSM is open data: it reaches every app and map that uses OpenStreetMap, not just this one.

## Feasibility
Static site on GitHub Pages: no backend, no API keys, zero running cost. Works in any city OpenStreetMap covers. The data improves as people use *Fix this listing*.

## Honest limits
- The score's weights are hand-set; the claim stands or falls on the ground-truth check above.
- The official Tamil Nadu recycler directory can't be redistributed (its licence forbids reproduction), so we link to it instead of importing it.
- OSM coverage in India is thin; that gap is the reason for the mapping work, not a footnote.

## How it relates to BinRules
BinRules answers *which bin* for kerbside items, using official council lists. OffTheBin covers what goes in *no* bin, and where to take it. They are complementary: a "which bin" answer of "none: take it to a drop-off" is exactly where OffTheBin starts.
