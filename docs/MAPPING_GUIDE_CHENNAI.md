# Chennai mapping guide: 20 drop-off points to survey

**Why:** Within 20 km of central Chennai, OpenStreetMap has **one** place tagged as taking batteries, and that record was last edited in 2018 (snapshot 2026-10-21). Greater Chennai Corporation (GCC) told [Citizen Matters](https://citizenmatters.in/explainer-e-waste-management-in-chennai) that each zone has a domestic hazardous waste collection centre that takes e-waste. None of them are on the map. Every centre you add appears in OffTheBin, and in every other app built on OSM, as soon as Overpass updates (minutes).

**Rule:** only tag what you saw or were told by staff on the day. If they won't take something, leave that tag out. Don't add a point you couldn't confirm.

## Before you start (10 minutes)
1. Create a free account at openstreetmap.org (you do this yourself).
2. Open the area in the browser editor: `https://www.openstreetmap.org/edit#map=18/<lat>/<lon>`.
3. Install StreetComplete or Every Door (Android) if you'd rather add points on the spot.
4. Get zone centre addresses: call **1913** (GCC helpline), use the **Namma Chennai** app, or ask at the zonal office. Write the address in the log before you go.

## Tags to use (copy exactly)

A zonal hazardous waste / e-waste collection centre:
```
amenity=recycling
recycling_type=centre
name=<name on the board, or "GCC Zone N Domestic Hazardous Waste Collection Centre">
operator=Greater Chennai Corporation
recycling:batteries=yes                 (only if they take household batteries)
recycling:electrical_items=yes          (small electronics, chargers, cables)
recycling:cell_phones=yes               (if phones accepted)
recycling:computers=yes                 (if laptops/monitors accepted)
recycling:fluorescent_tubes=yes         (if CFLs / tube lights accepted)
opening_hours=Mo-Sa 10:00-17:00         (what the board or staff says)
phone=+91 ...                           (an official number only, never a staff member's personal mobile)
check_date=2026-MM-DD                   (the day you visited)
source=survey
```

A battery dealer that confirms it buys back used lead-acid batteries:
```
(keep the existing shop=car_parts / shop=batteries tags, or add shop=batteries)
recycling:car_batteries=yes
check_date=2026-MM-DD
```
Shops keep their shop tag; OffTheBin finds them only if they also carry `amenity=recycling`. For a shop, add `amenity=recycling` + `recycling_type=container` only if there is a visible collection box. Otherwise just add the `recycling:*` tag and note it in the log.

## The 20 targets

### A. Re-survey the 4 places already on the map (2018-2024 data)
| # | OSM record | What to confirm |
|---|---|---|
| 1 | [Paper Plastic Metal Recycler](https://www.openstreetmap.org/node/1955943165) (Guindy area, last edited 2018) | Still trading? Still takes batteries and electrical items? Hours `Mo-Sa 08:00-18:00` still right? Add `check_date`. |
| 2 | [Tirumani Waste Paper Mart](https://www.openstreetmap.org/node/5570584569) (2018) | Does it take batteries or e-waste? Add tags only for what it takes. |
| 3 | [Recycling Collection Center](https://www.openstreetmap.org/node/12458790385) (north Chennai, 2024) | What materials? Batteries? Hours? |
| 4 | [Unnamed recycling centre](https://www.openstreetmap.org/way/1149853388) (2023) | Name, operator, materials, hours. |

### B. The 15 GCC zonal collection centres (one per zone)
| # | Zone | | # | Zone |
|---|---|---|---|---|
| 5 | 1 Thiruvottiyur | | 13 | 9 Teynampet |
| 6 | 2 Manali | | 14 | 10 Kodambakkam |
| 7 | 3 Madhavaram | | 15 | 11 Valasaravakkam |
| 8 | 4 Tondiarpet | | 16 | 12 Alandur |
| 9 | 5 Royapuram | | 17 | 13 Adyar |
| 10 | 6 Thiru-Vi-Ka Nagar | | 18 | 14 Perungudi |
| 11 | 7 Ambattur | | 19 | 15 Sholinganallur |
| 12 | 8 Anna Nagar | | | |

Start with the zones nearest you. If a zone says it has no centre, log that too: "no centre in zone X" is evidence for the pitch.

### C. One retail take-back point
| # | Target | What to confirm |
|---|---|---|
| 20 | The nearest battery dealer (Exide / Amaron / local) | Do they take back used car or inverter batteries from anyone, not only on a new purchase? |

## Log every visit
Add one line per target to `eval/impact-log.csv` (template in the repo): target number, date, outcome (`added` / `updated` / `no centre` / `does not take`), OSM link after saving, and what they accept. Then run:
```
node eval/impact.js
```
It checks every logged OSM link against live OpenStreetMap and prints the verified count used in the README. A number only counts if the record exists on OSM with a `check_date`.
