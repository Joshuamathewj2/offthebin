# Desk audit: OSM listings vs official sources (2026-10-21)

The ground-truth check ([ground-truth/RESULTS.md](ground-truth/RESULTS.md)) confirmed 20 battery drop-offs in London and Berlin against council, BSR and retailer websites. While doing it, we also compared each listing's OpenStreetMap tags with what the official source says. Every mismatch was filed as a public OpenStreetMap Note in the same format the app's *Report a problem* button uses, so local mappers can fix it. `node eval/impact.js` counts these notes from live OSM.

## What we found
Of the 8 London recycling centres whose hours are published officially, **3 had wrong or missing hours on OSM**. One more listing claimed to take batteries when official sources say it does not.

| Listing | OSM says | Official source says | Note |
|---|---|---|---|
| [Cringle Dock Transfer Station](https://www.openstreetmap.org/way/70561923) | `recycling:batteries=yes` | Vans-only transfer station ([Wandsworth](https://wandsworth.gov.uk/rubbish-and-recycling/waste-and-recycling-sites/cringle-dock-waste-transfer-station)); batteries go to Smugglers Way ([WRWA](https://wrwa.gov.uk/materials/batteries/)) | [#5593537](https://www.openstreetmap.org/note/5593537) |
| [Greenford Re-use and Recycling Centre](https://www.openstreetmap.org/way/1007047371) | Open Mo-Fr | Closed **We, Th**; open Mo, Tu, Fr-Su (Ealing Council). OSM sends people on two closed days and hides the weekend | [#5593538](https://www.openstreetmap.org/note/5593538) |
| [Western Road RRC](https://www.openstreetmap.org/way/389245285) | Mo-Fr 09:30-16:00 | 9am-4pm every day ([London Energy](https://londonenergyltd.com/our-services/reuse-and-recycling-centres/haringey-western-road-rrc/)) | [#5593539](https://www.openstreetmap.org/note/5593539) |
| [Kimpton Park Way RRC](https://www.openstreetmap.org/way/24575990) | no hours | Mo-Sa 9am-5pm, Su 9am-2pm, booking required (Sutton Council) | [#5593540](https://www.openstreetmap.org/note/5593540) |

Hours matched the official source at Foots Cray, Tower Hamlets, Summers Lane, Smugglers Way and Greenwich.

## Why this matters for the trust score
Cringle Dock scored 31 and was the only listing that turned out wrong. The 3 hour errors all fell on centres that are otherwise real and open. The score can't catch those, but the repair loop can.

## Chennai
No official list of Chennai drop-off points is published online. We looked at Greater Chennai Corporation, TNPCB, producer take-back schemes and news. The only fixed public e-waste centre listed online is Karo Sambhav's at Ambattur Industrial Estate, and it doesn't say whether it takes batteries or members of the public. What *is* current and official: since September 2026 GCC requires four-way segregation, with batteries, bulbs and e-waste kept in a separate black bin for door-to-door collection ([report](https://english.punjabkesari.com/india/chennai-corporation-makes-four-way-waste-segregation-mandatorywarns-of-penalties)), under India's Solid Waste Management Rules 2026 (in force 1 April 2026). OffTheBin now tells Chennai users this first. Putting the zone centres on the map still needs an on-site survey ([mapping guide](../docs/MAPPING_GUIDE_CHENNAI.md)). We did not copy points from copyrighted directories or add places nobody has seen.
