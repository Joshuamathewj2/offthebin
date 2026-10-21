# OffTheBin

**Find a hazardous-waste drop-off you can actually trust.** Batteries, e-waste, bulbs, paint and cooking oil must stay out of the bin. Lithium-ion packs crushed in a garbage truck cause fires. The tools that tell you where to take them list stale or unverified places and never say so.

OffTheBin (Arbiter Hacks V1, Theme track: Rethinking Waste) does three things differently:

1. **Item first.** You say what you are holding. You get the hazard, why it can't be binned, and how to prepare it (tape terminals, what to do if swollen).
2. **Every listing carries a confidence score** built from edit freshness, listed hours, contact details, access rules and edit history. Closed-now and low-confidence sites are ranked down. Unparseable hours show "Hours unknown" instead of a guess.
3. **Closes the data loop.** Each listing links to "Fix this listing" on OpenStreetMap, and an empty area tells you the map is missing data instead of claiming no service exists.

No API keys, no backend, no account. Static site: open `index.html` through any static server.

```
npx serve .        # or: python -m http.server
node eval/run.js   # reproduces eval/RESULTS.md
```

## Evaluation
See [eval/RESULTS.md](eval/RESULTS.md). It runs the exact ranking code used by the app on 8 cities and reports how often "nearest" returns stale or low-confidence listings, and how that changes after scoring. Limits are stated there, including that the confidence heuristic is not yet calibrated against phone calls.

## Structure
- `lib.js` Overpass query, opening-hours parser, freshness, confidence, ranking (browser + Node)
- `app.js`, `index.html` UI with Leaflet map
- `data/items.json` item knowledge base with EPA / EU source links
- `eval/run.js` multi-city evaluation

Data © OpenStreetMap contributors (ODbL).
