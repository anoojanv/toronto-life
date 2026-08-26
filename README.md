# 6IXNIGHTS — Toronto Weekday Plans 🌃

A lifestyle app for people who like **sports, concerts, and going out in Toronto during the week** — built around one insight: weeknights are the arbitrage. Same city, same rooms, a fraction of the price.

## What it does

- **🏟 Sports** — Jays, Raptors, Leafs, TFC, Argos, Marlies & Raptors 905 games with typical *get-in* price estimates, filterable by team, price cap, and day of week. Every card links to Ticketmaster / SeatGeek / StubHub for live prices, plus a "cheap-ticket playbook" of strategies (weekday resale dips, standing room, G-League/AHL value plays).
- **🎤 Concerts** — hip-hop, R&B, reggae/dancehall and afrobeats shows across Scotiabank Arena, History, Rebel, Danforth Music Hall, Velvet Underground and more, plus an **Artist Watch** rail (Drake, The Weeknd, J. Cole, PartyNextDoor…) linking to Ticketmaster alerts for unannounced hometown dates.
- **🌃 Nightlife** — a curated map of clubs, bars and lounges that actually play hip-hop/R&B/reggae, filterable by neighbourhood (King West, Ossington, Yorkville, Queen West, Entertainment District) and vibe, with the nights each room actually goes, cover estimates, and weeknight survival tips.
- **📌 My Lineup** — star any game, show, or venue to build your week (persisted in `localStorage`).
- **Mon–Thu first** — the default day filter is "Mon–Thu only," because that's the whole point.

- **📊 The Pulse** — the default view: stat tiles, a clickable 14-night price timeline (dot height = est. get-in price), a "cheapest night to go out" chart, a live "Tonight" list, and a clickable schematic map of downtown venues. Every dot, bar row, and pin opens a detail modal.

## Stack

Zero-dependency static site: vanilla HTML + CSS + JS, no build step. Deploys to Netlify in seconds (`netlify.toml` included). Chart colors are validated for dark-surface contrast and colour-vision-deficiency separation (amber/purple/teal, all-pairs ΔE ≥ 10).

```
index.html               — page structure, tabs, modal
css/styles.css           — dark theme, cards, dashboard, modal
data/events.json         — the data layer (refreshed nightly)
js/app.js                — data loading, tabs, filters, grids, modal
js/viz.js                — Pulse dashboard: timeline, bars, map, tooltips
scripts/update-data.mjs  — nightly refresh script (prune + optional Ticketmaster pull)
.github/workflows/nightly-update.yml — the 4:15am ET cron
```

## Nightly updates — how it works

Every night at **4:15am Toronto time**, a GitHub Action:

1. Runs `scripts/update-data.mjs`, which always prunes events whose date has passed, and — when a `TICKETMASTER_API_KEY` repo secret is configured — replaces the seed lists with live Toronto listings from the [Ticketmaster Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) (sports + hip-hop/R&B/reggae).
2. Commits the refreshed `data/events.json`.
3. Redeploys to Netlify when a `NETLIFY_AUTH_TOKEN` repo secret is configured.

Three layers of freshness, so the site is current even with **zero secrets configured**:

- The page fetches `data/events.json` from raw.githubusercontent.com first (the nightly commit), falling back to the deployed copy.
- Past events are also filtered out client-side at render time.
- The hero badge shows when data was last refreshed.

**To turn on the full loop**, add repo secrets under GitHub → Settings → Secrets and variables → Actions:

| Secret | Purpose | Where to get it |
|---|---|---|
| `TICKETMASTER_API_KEY` | live event listings | free at [developer.ticketmaster.com](https://developer.ticketmaster.com) |
| `NETLIFY_AUTH_TOKEN` | nightly redeploys | Netlify → User settings → Applications → New access token |

## Data honesty

Events and prices in `js/data.js` are **curated seed data** (grounded in real venues, teams, and announced shows as of Aug 2026) — they're estimates, and nightlife programming changes weekly. Every card links out to a live source (Ticketmaster/SeatGeek/StubHub/venue/Maps) for the truth.

## Going fully live (roadmap)

- Swap `data.js` for the [Ticketmaster Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) (`city=Toronto`, `classificationName=hip-hop`, etc.) via a Netlify Function to keep the API key server-side.
- SeatGeek API for live "get-in" prices on sports cards.
- Instagram embeds for same-day club programming.
- Push alerts when a watched artist announces a Toronto date.

## Run locally

No tooling needed:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
