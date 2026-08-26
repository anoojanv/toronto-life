# 6IXNIGHTS — Toronto Weekday Plans 🌃

A lifestyle app for people who like **sports, concerts, and going out in Toronto during the week** — built around one insight: weeknights are the arbitrage. Same city, same rooms, a fraction of the price.

## What it does

- **🏟 Sports** — Jays, Raptors, Leafs, TFC, Argos, Marlies & Raptors 905 games with typical *get-in* price estimates, filterable by team, price cap, and day of week. Every card links to Ticketmaster / SeatGeek / StubHub for live prices, plus a "cheap-ticket playbook" of strategies (weekday resale dips, standing room, G-League/AHL value plays).
- **🎤 Concerts** — hip-hop, R&B, reggae/dancehall and afrobeats shows across Scotiabank Arena, History, Rebel, Danforth Music Hall, Velvet Underground and more, plus an **Artist Watch** rail (Drake, The Weeknd, J. Cole, PartyNextDoor…) linking to Ticketmaster alerts for unannounced hometown dates.
- **🌃 Nightlife** — a curated map of clubs, bars and lounges that actually play hip-hop/R&B/reggae, filterable by neighbourhood (King West, Ossington, Yorkville, Queen West, Entertainment District) and vibe, with the nights each room actually goes, cover estimates, and weeknight survival tips.
- **📌 My Lineup** — star any game, show, or venue to build your week (persisted in `localStorage`).
- **Mon–Thu first** — the default day filter is "Mon–Thu only," because that's the whole point.

## Stack

Zero-dependency static site: vanilla HTML + CSS + JS, no build step. Deploys to Netlify in seconds (`netlify.toml` included).

```
index.html      — page structure & tabs
css/styles.css  — dark theme, card grid, filters
js/data.js      — curated events + venues (the data layer)
js/app.js       — tabs, filters, rendering, saved lineup
```

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
