# OffTheBin: 60-second brief for judges

**Live:** https://joshuamathewj2.github.io/offthebin/ (no login, no keys; try *Lithium-ion pack* + *London*, then *Chennai*)
**Track:** Theme, Rethinking Waste · **Code:** https://github.com/Joshuamathewj2/offthebin (MIT, `node --test` 10/10)

## The problem
Batteries, e-waste, tube lights, paint and oil must never go in a household bin. Lithium-ion batteries in the waste stream start fires: US EPA counted **245 fires at 64 waste facilities** (2013-2020) from public reports alone ([EPA 2021](https://www.epa.gov/node/268935)). People who *want* to dispose of them properly hit stale or missing drop-off data and give up.

## What we measured (8 cities, OpenStreetMap, reproducible with `node eval/run.js`)
- **Gaps:** Mumbai and Brisbane: 0 places tagged as taking batteries within 10 km of the centre. Chennai, New York, São Paulo: 1 each. See [eval/RESULTS.md](eval/RESULTS.md).
- **Staleness:** of the nearest-3 battery drop-offs across all cities, **6 of 12 had not been edited for 3+ years**.
- **Trust score vs reality** (30 sites sampled, 15 high / 15 low score, checked blind against council, BSR and retailer websites) → [eval/ground-truth/RESULTS.md](eval/ground-truth/RESULTS.md): **all 15 high-score sites were confirmed by an official source.** Only 5 of the 15 low-score sites could be verified at all (4 valid, 1 wrong). The other 10 had no public trace. Honest read: the score reliably identifies listings you can trust; it is a weak signal for spotting wrong ones (p = 0.25). That is why the data-repair loop matters.

## What we built
1. Item-first safety guidance (hazard, prep, never-in), with sources.
2. Nearest drop-offs ranked by distance, open-now status and a **0-100 trust score whose reasons are shown**.
3. Unconfirmed general recycling centres shown separately, never mixed in. Gaps are stated, not hidden.
4. Cache-first: 8 saved cities render in under 1 s; live data replaces them (the public server takes 30-60 s).
5. **Data repair loop:** *Report a problem* on every result turns a user's "this place closed" into an anonymous public OpenStreetMap Note for local mappers (no account); *Fix this listing* for mappers; a 20-target survey guide for Chennai; a script that counts contributions from live OSM.

## Impact evidence
- **Data repaired, not just read:** comparing OSM listings with official sources found 4 errors. A "battery drop-off" that is really a vans-only transfer station, and 3 of 8 London recycling centres with wrong or missing hours (Greenford is shown open on the two days a week it is closed). Each was filed as a public OpenStreetMap Note through the same format the app uses: [#5593537](https://www.openstreetmap.org/note/5593537)-[#5593540](https://www.openstreetmap.org/note/5593540). Details: [eval/DESK_AUDIT.md](eval/DESK_AUDIT.md).
- **Chennai, current rule built in:** GCC made four-way segregation mandatory in September 2026, with batteries and e-waste in a black bin for door-to-door collection. The app now leads with that for Chennai users.
- **Ready, not yet run:** the Chennai field survey (20 targets, [docs/MAPPING_GUIDE_CHENNAI.md](docs/MAPPING_GUIDE_CHENNAI.md)) and the tracker that counts results from live OSM (`node eval/impact.js` → [eval/IMPACT.md](eval/IMPACT.md)). We report 0 contributions so far rather than claim any.
- Anything added to OSM is open data: it reaches every app and map that uses OpenStreetMap, not just this one.

## Feasibility
Static site on GitHub Pages: no backend, no API keys, zero running cost. Works in any city OpenStreetMap covers. The data improves as people use *Fix this listing*.

## Honest limits
- The score's weights are hand-set, and the ground-truth check (above) shows a weak signal, not a proven predictor. 3 of the 20 checks rely on a chain-wide take-back policy plus the store still trading, rather than a sighting of the bin itself.
- The official Tamil Nadu recycler directory can't be redistributed (its licence forbids reproduction), so we link to it instead of importing it.
- OSM coverage in India is thin; that gap is the reason for the mapping work, not a footnote.

## How it relates to BinRules
BinRules answers *which bin* for kerbside items, using official council lists. OffTheBin covers what goes in *no* bin, and where to take it. They are complementary: a "which bin" answer of "none: take it to a drop-off" is exactly where OffTheBin starts.
