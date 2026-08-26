#!/usr/bin/env node
/**
 * Nightly data refresh for 6IXNIGHTS.
 *
 * Always: prunes events whose date has passed (Toronto time) and stamps lastUpdated.
 * With TICKETMASTER_API_KEY set: pulls live Toronto events from the Ticketmaster
 * Discovery API — sports (Jays/Raptors/Leafs/TFC/Argos/farm teams) and
 * hip-hop / R&B / reggae concerts — and swaps them in for the curated seed list.
 * Any API failure falls back to the curated data, so the site never goes empty.
 *
 * Run: node scripts/update-data.mjs   (Node 18+)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DATA_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "events.json");
const API_KEY = process.env.TICKETMASTER_API_KEY || "";
const TM_BASE = "https://app.ticketmaster.com/discovery/v2/events.json";

const torontoToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" }); // YYYY-MM-DD

const TEAM_MATCHERS = [
  { key: "farm", re: /raptors 905|marlies/i },
  { key: "jays", re: /blue jays/i },
  { key: "raptors", re: /raptors/i },
  { key: "leafs", re: /maple leafs/i },
  { key: "tfc", re: /toronto fc/i },
  { key: "argos", re: /argonauts/i },
];

const GENRE_QUERIES = [
  { genre: "hiphop", classification: "Hip-Hop/Rap" },
  { genre: "rnb", classification: "R&B" },
  { genre: "reggae", classification: "Reggae" },
];

const sg = (q) => `https://seatgeek.com/search?search=${encodeURIComponent(q)}`;

async function tmFetch(params) {
  const url = `${TM_BASE}?${new URLSearchParams({
    apikey: API_KEY,
    city: "Toronto",
    countryCode: "CA",
    size: "60",
    sort: "date,asc",
    ...params,
  })}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ticketmaster ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json?._embedded?.events ?? [];
}

function baseEvent(ev) {
  const date = ev.dates?.start?.localDate;
  const venue = ev._embedded?.venues?.[0]?.name ?? "TBA";
  const price = Math.round(ev.priceRanges?.[0]?.min ?? 0) || null;
  return { date, venue, price, name: ev.name, url: ev.url };
}

function mapSports(events) {
  const out = [];
  for (const ev of events) {
    const b = baseEvent(ev);
    if (!b.date) continue;
    const team = TEAM_MATCHERS.find((t) => t.re.test(b.name))?.key;
    if (!team) continue; // not a Toronto team we track
    out.push({
      id: `sp-tm-${ev.id}`,
      team,
      date: b.date,
      title: b.name,
      venue: b.venue,
      hood: "Downtown",
      price: b.price ?? 25,
      desc: "Live listing from Ticketmaster — tap through for current prices and seats.",
      tags: ["Live listing"],
      links: [
        { label: "Ticketmaster", url: b.url, primary: true },
        { label: "SeatGeek", url: sg(b.name) },
      ],
    });
  }
  return out;
}

function mapConcerts(events, genre) {
  const out = [];
  for (const ev of events) {
    const b = baseEvent(ev);
    if (!b.date) continue;
    out.push({
      id: `c-tm-${ev.id}`,
      genres: [genre],
      size: /scotiabank|rogers centre|amphitheatre|stadium/i.test(b.venue) ? "arena"
        : /history|rebel|danforth|coliseum|massey/i.test(b.venue) ? "mid" : "club",
      date: b.date,
      title: b.name,
      venue: b.venue,
      price: b.price ?? 35,
      desc: "Live listing from Ticketmaster — tap through for current prices.",
      links: [
        { label: "Ticketmaster", url: b.url, primary: true },
        { label: "SeatGeek", url: sg(b.name) },
      ],
    });
  }
  return out;
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((ev) => {
    const key = `${ev.title.toLowerCase()}|${ev.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  const today = torontoToday();
  const isFuture = (ev) => ev.date >= today;

  // 1. Always prune the past
  data.sports = data.sports.filter(isFuture);
  data.concerts = data.concerts.filter(isFuture);

  // 2. Optionally refresh from Ticketmaster
  if (API_KEY) {
    try {
      const sportsRaw = await tmFetch({ classificationName: "Sports", startDateTime: `${today}T00:00:00Z` });
      const liveSports = mapSports(sportsRaw);
      if (liveSports.length) data.sports = dedupe(liveSports).slice(0, 40);

      const liveConcerts = [];
      for (const { genre, classification } of GENRE_QUERIES) {
        const raw = await tmFetch({ classificationName: classification, startDateTime: `${today}T00:00:00Z` });
        liveConcerts.push(...mapConcerts(raw, genre));
      }
      if (liveConcerts.length) {
        data.concerts = dedupe(liveConcerts.sort((a, b) => a.date.localeCompare(b.date))).slice(0, 40);
      }
      data.source = "ticketmaster";
      console.log(`Ticketmaster refresh: ${data.sports.length} sports, ${data.concerts.length} concerts`);
    } catch (err) {
      console.error(`Ticketmaster fetch failed, keeping curated data: ${err.message}`);
      data.source = "curated (API fetch failed)";
    }
  } else {
    data.source = "curated";
    console.log("No TICKETMASTER_API_KEY set — pruned past events only.");
  }

  data.lastUpdated = new Date().toISOString();
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log(`Wrote ${DATA_PATH} (${data.sports.length} sports, ${data.concerts.length} concerts, ${data.nightlife.length} venues)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
