# OffTheBin

**BinRules tells you which bin. OffTheBin is for the things that must never go in *any* bin, and it tells you how much to trust the place you're taking them.**

Live: **https://joshuamathewj2.github.io/offthebin/** · Arbiter Hacks V1, Theme track: Rethinking Waste · Judges: start with [JUDGES.md](JUDGES.md)

Batteries, e-waste, tube lights, paint and oil can't go in household bins. Lithium-ion packs crushed in a garbage truck catch fire: US EPA counted 245 lithium-ion battery fires at 64 waste facilities in 2013-2020, from public reports alone ([EPA, 2021](https://www.epa.gov/node/268935)). "Which bin" tools answer the kerbside question well. For these items the real question is *where can I take it, and is that place real?* The existing answers are weak in three ways:

1. **Stale listings, presented as fact.** In our 8-city evaluation, half of the nearest battery drop-offs on OpenStreetMap had not been edited for 3+ years ([eval/RESULTS.md](eval/RESULTS.md)).
2. **Silent gaps.** Mumbai and Brisbane have zero places tagged as taking batteries within 10 km of the centre, and Chennai has one, last edited in 2018. An empty result looks like "no service" when it really means "no data".
3. **No path to fix it.** Finders consume data; none of them feed corrections back.

## What OffTheBin does
- **Item first.** Pick what you're holding and get the hazard, why it can't be binned, and how to carry it safely (tape terminals; swollen battery → sand, metal tin, call ahead). Sources linked.
- **Trust score on every listing (0-100)**, built from how recently a person edited or surveyed it (`check_date`), listed hours, contact details, access and edit history. The reasons are printed next to the score, so nothing is a black box.
- **Honest hours.** Parses OSM `opening_hours` (ranges, split shifts, overnight, date closures, `PH off`). Anything it can't parse shows "Hours unknown" rather than a guess.
- **Two tiers.** Places tagged as accepting the item come first. General recycling centres appear below as *Unconfirmed: call to ask*, never mixed in.
- **Gap-aware.** Thin areas widen the search and say so. In Tamil Nadu the app points to the official channels instead (GCC zone hazardous-waste centres via helpline 1913, the TNPCB recycler directory).
- **Closes the loop.** Every listing has *Report a problem*: pick closed / doesn't take this / wrong hours / confirmed, preview the exact public text, and it becomes an anonymous OpenStreetMap Note that local mappers act on. No account needed. Mappers also get *Fix this listing* (OSM editor). The [Chennai mapping guide](docs/MAPPING_GUIDE_CHENNAI.md) turns the gap into a survey of 20 targets, and [eval/impact.js](eval/impact.js) counts the results from live OSM.
- **Works when the server doesn't.** The public Overpass API often queues requests for 30-60 s. Saved snapshots for 8 cities render in under 1 s, then live data replaces them, and the UI always says which one you are seeing.

## Evidence (every number is reproducible)
| What | Where | Status |
|---|---|---|
| Coverage and staleness in 8 cities | [eval/RESULTS.md](eval/RESULTS.md) (`node eval/run.js`) | done |
| Does the trust score predict reality? 30 sites, blind-checked | [eval/ground-truth/](eval/ground-truth/) (`node eval/groundtruth.js score`) | **in progress** |
| Drop-off points added to OSM in Chennai, verified from live OSM | [eval/IMPACT.md](eval/IMPACT.md) (`node eval/impact.js`) | **in progress** |
| Unit tests (hours parser, scoring, ranking, query) | `node --test` | 10/10 passing |

## Run it
No keys, no backend, no build step.
```
python -m http.server     # then open http://localhost:8000
node --test               # unit tests
node eval/run.js          # 8-city evaluation  -> eval/RESULTS.md
node eval/snapshot.js     # refresh saved city data (delete a file to refresh it)
```

## Structure
- `lib.js` shared by browser and Node: Overpass query, hours parser, freshness, confidence, ranking
- `app.js`, `index.html` UI (Leaflet map, cache-first loading)
- `data/items.json` 11 item types with hazard, prep steps and sources · `data/snapshots/` saved city data
- `eval/` evaluation, snapshots, ground-truth worksheet and scorer, impact checker · `test/` unit tests

## Limits
- The trust score is rule-based and its weights were set by hand. Whether it predicts reality is being tested now (above), and until that check is done we don't claim it does.
- OpenStreetMap coverage varies hugely; the app reports gaps rather than hiding them.
- Public-holiday closures can't be known offline; hours tagged `PH off` show a note.
- Safety guidance is general (US EPA / EU sources); local rules can differ, so call ahead for fire-risk items.

Data © OpenStreetMap contributors (ODbL). Code MIT.
