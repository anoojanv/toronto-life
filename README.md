# 6IXNIGHTS — Toronto Weekday Plans 🌃

A nightlife app for Toronto — **where to go out during the week** when the music is hip-hop, R&B and reggae. Built around one insight: weeknights are the arbitrage. Same rooms, same city, a fraction of the cover.

## What it does

- **🌃 The Pulse** — the default view: stat tiles led by *rooms open tonight*, then **Where to go** — a neighbourhood map listing every room by district with its music and cover, following whichever night you pick in the day strip. Below it, PULSE.NET (a 14-night radar of shows and games plus a node per nightlife district) and a compact sports side-quest strip. Everything opens a detail modal.
- **🌃 Nightlife** — the main event: clubs, bars and lounges that actually play hip-hop/R&B/reggae/afrobeats, filterable by neighbourhood (King West, Ossington, Yorkville, Queen West, Entertainment District) and vibe, with the nights each room goes, cover estimates, verified Instagram links, and weeknight survival tips.
- **🎤 Concerts** — hip-hop, R&B, reggae/dancehall and afrobeats shows across Scotiabank Arena, History, Rebel, Danforth Music Hall, Velvet Underground and more, plus an **Artist Watch** rail (Drake, The Weeknd, J. Cole, PartyNextDoor…) linking to Ticketmaster alerts for unannounced hometown dates.
- **◇ Sports (side quest)** — Jays, Raptors, Leafs, TFC, Argos, Marlies & Raptors 905 with typical *get-in* price estimates and a cheap-ticket playbook. Deliberately secondary: a $13 Jays ticket is a good opening act, not the night.
- **📌 My Lineup** — star any room, show, or game to build your week (persisted in `localStorage`).
- **Mon–Thu first** — the default day filter is "Mon–Thu only," because that's the whole point.

## Stack

Zero-dependency static site: vanilla HTML + CSS + JS, no build step. Deploys to Netlify in seconds (`netlify.toml` included). Colours are validated for dark-surface contrast and colour-vision-deficiency separation (amber/purple/teal, all-pairs ΔE ≥ 10) — which is also why room *type* carries the colour and genre rides as text: a fourth hue could not pass the all-pairs gate.

```
index.html               — page structure, tabs, modal
css/styles.css           — dark theme, cards, dashboard, modal
data/events.json         — the data layer (refreshed nightly)
js/app.js                — data loading, tabs, filters, grids, modal
js/viz.js                — Pulse dashboard: neighbourhood map, radar, side quest
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

Events and prices in `data/events.json` are **curated seed data** (grounded in real venues, teams, and announced shows as of Aug 2026) — they're estimates, and nightlife programming changes weekly. Every card links out to a live source (Ticketmaster/SeatGeek/StubHub/venue/Maps) for the truth.

## Going fully live (roadmap)

- Swap the curated seed data for the [Ticketmaster Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) (`city=Toronto`, `classificationName=hip-hop`, etc.) via a Netlify Function to keep the API key server-side.
- SeatGeek API for live "get-in" prices on sports cards.
- Instagram embeds for same-day club programming.
- Push alerts when a watched artist announces a Toronto date.

## Run locally

No tooling needed:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
