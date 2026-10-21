# OffTheBin evaluation

Run 2026-10-21. Source: OpenStreetMap via Overpass, `amenity=recycling` + `recycling:batteries=yes`, 10 km around each city centre. Reproduce: `node eval/run.js`.

| City | Battery drop-offs | Extra unconfirmed candidates | Have opening hours | Hours we can parse | Not edited in 3+ yrs | Median record age (yrs) | Nearest-3 low-confidence | Nearest-3 stale | OffTheBin top-3 low-confidence | OffTheBin top-3 stale |
|---|---|---|---|---|---|---|---|---|---|---|
| Chennai, IN | 1 | 3 | 100% | 100% | 100% | 8 | 0/1 | 1/1 | 0/1 | 1/1 |
| Mumbai, IN | 0 | 11 | 0% | 0% | 0% | - | 0/0 | 0/0 | 0/0 | 0/0 |
| Brisbane, AU | 0 | 32 | 0% | 0% | 0% | - | 0/0 | 0/0 | 0/0 | 0/0 |
| London, UK | 23 | 220 | 35% | 17% | 17% | 1.5 | 1/3 | 1/3 | 1/3 | 1/3 |
| New York, US | 1 | 78 | 0% | 0% | 100% | 5.9 | 1/1 | 1/1 | 1/1 | 1/1 |
| Berlin, DE | 8 | 812 | 50% | 25% | 13% | 2 | 2/3 | 0/3 | 1/3 | 0/3 |
| Nairobi, KE | 5 | 663 | 0% | 0% | 80% | 13.8 | 3/3 | 2/3 | 3/3 | 2/3 |
| Sao Paulo, BR | 1 | 45 | 0% | 0% | 100% | 5.1 | 1/1 | 1/1 | 1/1 | 1/1 |

**Coverage:** 2 of 8 cities have zero drop-offs explicitly tagged as taking batteries within 10 km; 2 of those gain unconfirmed candidates (general recycling centres) from the fallback tier.

**Ranking, across 8 cities:** nearest-3 results were low-confidence 8/12 times and stale 6/12 times; after OffTheBin re-ranking: 7/12 and 6/12.

## Before / after (first run 2026-10-21 vs this run)
Changes in between: parser handles date closures and `PH off`; `check_date` counts as a survey; unconfirmed tier limited to recycling centres. OSM data itself also changes between runs.

| City | Drop-offs (before → after) | Hours we can parse | Not edited 3+ yrs |
|---|---|---|---|
| Chennai, IN | 1 → 1 | 100% → 100% | 100% → 100% |
| Mumbai, IN | 0 → 0 | 0% → 0% | 0% → 0% |
| Brisbane, AU | 0 → 0 | 0% → 0% | 0% → 0% |
| London, UK | 23 → 23 | 17% → 17% | 17% → 17% |
| New York, US | 1 → 1 | 0% → 0% | 100% → 100% |
| Berlin, DE | 8 → 8 | 25% → 25% | 13% → 13% |
| Nairobi, KE | 5 → 5 | 0% → 0% | 80% → 80% |
| Sao Paulo, BR | 1 → 1 | 0% → 0% | 100% → 100% |

| Across cities | Before | After |
|---|---|---|
| Nearest-3 low-confidence | 8/12 | 8/12 |
| OffTheBin top-3 low-confidence | 7/12 | 7/12 |
| Nearest-3 stale | 6/12 | 6/12 |
| OffTheBin top-3 stale | 6/12 | 6/12 |

## Honest limits
- "Stale" means the OSM record was not edited or surveyed for 3+ years. That is a risk signal, not proof the site closed.
- Confidence is a rule-based score (freshness, listed hours, contact info, access, edit history) whose weights were set by hand. Whether it predicts reality is tested separately in [ground-truth/](ground-truth/).
- Re-ranking can only choose among the listings that exist: in cities with 0-1 listings it cannot help, which is why the project's main lever is adding data (see docs/MAPPING_GUIDE_CHENNAI.md).
- OSM coverage differs a lot by city; low counts mean missing data, not missing services.
- Hours with seasonal or public-holiday-specific times are reported as "hours unknown" instead of guessed.
