/* 6IXNIGHTS app logic — tabs, filters, rendering, saved lineup */

(function () {
  "use strict";

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu"];

  const state = {
    tab: "sports",
    day: "weekdays",
    team: "all",
    maxPrice: "all",
    genre: "all",
    size: "all",
    hood: "all",
    vibe: "all",
    saved: loadSaved(),
  };

  /* ---------- helpers ---------- */

  function loadSaved() {
    try {
      return new Set(JSON.parse(localStorage.getItem("sixnights-saved") || "[]"));
    } catch (e) {
      return new Set();
    }
  }

  function persistSaved() {
    try {
      localStorage.setItem("sixnights-saved", JSON.stringify([...state.saved]));
    } catch (e) { /* private mode — saving is a nice-to-have */ }
  }

  function dayOf(dateStr) {
    // Parse as local date, not UTC midnight
    const [y, m, d] = dateStr.split("-").map(Number);
    return DAY_NAMES[new Date(y, m - 1, d).getDay()];
  }

  function fmtDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
  }

  function matchesDay(dateStrOrNights) {
    if (state.day === "all") return true;
    if (Array.isArray(dateStrOrNights)) {
      // venue nights list
      if (state.day === "weekdays") return dateStrOrNights.some((n) => WEEKDAYS.includes(n));
      return dateStrOrNights.includes(state.day);
    }
    const d = dayOf(dateStrOrNights);
    if (state.day === "weekdays") return WEEKDAYS.includes(d);
    return d === state.day;
  }

  function priceClass(p) {
    if (p <= 20) return "cheap";
    if (p <= 45) return "mid";
    return "high";
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function saveBtn(id) {
    const saved = state.saved.has(id);
    return `<button class="save-btn ${saved ? "saved" : ""}" data-save="${esc(id)}" aria-label="Save to my lineup" title="Save to My Lineup">${saved ? "★" : "☆"}</button>`;
  }

  function ticketLinks(links) {
    return `<div class="ticket-links">${links
      .map((l) => `<a class="tix-btn ${l.primary ? "primary" : ""}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
      .join("")}</div>`;
  }

  /* ---------- card renderers ---------- */

  function eventCard(ev, kind) {
    const day = dayOf(ev.date);
    const isWeekday = WEEKDAYS.includes(day);
    const genreTags = (ev.genres || [])
      .map((g) => `<span class="tag genre-${g}">${esc(MUSIC_LABELS[g] || g)}</span>`)
      .join("");
    const extraTags = (ev.tags || []).map((t) => `<span class="tag deal">${esc(t)}</span>`).join("");
    return `
      <article class="card" data-kind="${kind}">
        <div class="card-top">
          <span class="card-date">${esc(fmtDate(ev.date))}${isWeekday ? '<span class="weekday-flag">● weeknight</span>' : ""}</span>
          ${saveBtn(ev.id)}
        </div>
        <h3 class="card-title">${esc(ev.title)}</h3>
        <p class="card-venue">${esc(ev.venue)}${ev.hood ? ` · <span class="hood">${esc(ev.hood)}</span>` : ""}</p>
        <p class="card-desc">${esc(ev.desc)}</p>
        <div class="tag-row">${genreTags}${extraTags}</div>
        <div class="card-bottom">
          <span class="price ${priceClass(ev.price)}"><span class="from">From (est.)</span>$${ev.price}</span>
          ${ticketLinks(ev.links)}
        </div>
      </article>`;
  }

  function venueCard(v) {
    const musicTags = v.music
      .map((g) => `<span class="tag genre-${g === "dancehall" ? "reggae" : g}">${esc(MUSIC_LABELS[g] || g)}</span>`)
      .join("");
    const nightDots = DAY_NAMES.slice(1).concat(DAY_NAMES[0]) // Mon..Sun
      .map((d) => `<span class="night-dot ${v.nights.includes(d) ? "on" : ""}">${d}</span>`)
      .join("");
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name + " " + v.address + " Toronto")}`;
    return `
      <article class="card" data-kind="venue">
        <div class="card-top">
          <span class="card-date">${esc(v.hoodLabel)}</span>
          ${saveBtn(v.id)}
        </div>
        <h3 class="card-title">${esc(v.name)}</h3>
        <p class="card-venue">${esc(v.address)} · <span class="hood">${esc(v.cover)}</span></p>
        <p class="card-desc">${esc(v.desc)}</p>
        <div class="tag-row">${musicTags}</div>
        <div class="nights-row">${nightDots}</div>
        <div class="card-bottom">
          <span class="price cheap"><span class="from">Cover</span>${esc(v.cover.split(",")[0])}</span>
          <div class="ticket-links"><a class="tix-btn primary" href="${mapsUrl}" target="_blank" rel="noopener">Map</a></div>
        </div>
      </article>`;
  }

  function watchCard(a) {
    return `
      <a class="watch-card" href="${esc(a.url)}" target="_blank" rel="noopener">
        <div class="watch-name">${esc(a.name)}</div>
        <div class="watch-note">${esc(a.note)}</div>
        <span class="watch-cta">Set alert on Ticketmaster →</span>
      </a>`;
  }

  /* ---------- renders ---------- */

  function renderSports() {
    const grid = document.getElementById("sportsGrid");
    const items = SPORTS_EVENTS.filter((ev) => {
      if (!matchesDay(ev.date)) return false;
      if (state.team !== "all" && ev.team !== state.team) return false;
      if (state.maxPrice !== "all" && ev.price > Number(state.maxPrice)) return false;
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
    grid.innerHTML = items.map((ev) => eventCard(ev, "sports")).join("");
    document.getElementById("sportsEmpty").classList.toggle("hidden", items.length > 0);
  }

  function renderConcerts() {
    const grid = document.getElementById("concertsGrid");
    const items = CONCERT_EVENTS.filter((ev) => {
      if (!matchesDay(ev.date)) return false;
      if (state.genre !== "all" && !ev.genres.includes(state.genre)) return false;
      if (state.size !== "all" && ev.size !== state.size) return false;
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
    grid.innerHTML = items.map((ev) => eventCard(ev, "concerts")).join("");
    document.getElementById("concertsEmpty").classList.toggle("hidden", items.length > 0);
    document.getElementById("watchGrid").innerHTML = ARTIST_WATCH.map(watchCard).join("");
  }

  function renderNightlife() {
    const grid = document.getElementById("nightlifeGrid");
    const items = NIGHTLIFE_VENUES.filter((v) => {
      if (!matchesDay(v.nights)) return false;
      if (state.hood !== "all" && v.hood !== state.hood) return false;
      if (state.vibe !== "all" && v.vibe !== state.vibe) return false;
      return true;
    });
    grid.innerHTML = items.map(venueCard).join("");
    document.getElementById("nightlifeEmpty").classList.toggle("hidden", items.length > 0);
  }

  function renderLineup() {
    const grid = document.getElementById("lineupGrid");
    const savedEvents = [...SPORTS_EVENTS, ...CONCERT_EVENTS]
      .filter((ev) => state.saved.has(ev.id))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((ev) => eventCard(ev, "lineup"));
    const savedVenues = NIGHTLIFE_VENUES.filter((v) => state.saved.has(v.id)).map(venueCard);
    const all = savedEvents.concat(savedVenues);
    grid.innerHTML = all.join("");
    document.getElementById("lineupEmpty").classList.toggle("hidden", all.length > 0);
  }

  function renderAll() {
    renderSports();
    renderConcerts();
    renderNightlife();
    renderLineup();
    document.getElementById("savedCount").textContent = state.saved.size;
  }

  /* ---------- wiring ---------- */

  function setActive(groupEl, target) {
    groupEl.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === target));
  }

  function wireChipGroup(id, stateKey, dataAttr) {
    const el = document.getElementById(id);
    el.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-" + dataAttr + "]");
      if (!btn) return;
      state[stateKey] = btn.dataset[dataAttr];
      setActive(el, btn);
      renderAll();
    });
  }

  // Tabs
  const nav = document.getElementById("topnav");
  nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".navlink");
    if (!btn) return;
    state.tab = btn.dataset.tab;
    nav.querySelectorAll(".navlink").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tab-panel").forEach((p) =>
      p.classList.toggle("active", p.id === "panel-" + state.tab)
    );
    document.getElementById("main").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("logo").addEventListener("click", (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // Day strip
  const dayStrip = document.getElementById("dayStrip");
  dayStrip.addEventListener("click", (e) => {
    const btn = e.target.closest(".day-chip");
    if (!btn) return;
    state.day = btn.dataset.day;
    setActive(dayStrip, btn);
    renderAll();
  });

  // Filters
  wireChipGroup("sportsTeamFilter", "team", "team");
  wireChipGroup("sportsPriceFilter", "maxPrice", "price");
  wireChipGroup("concertGenreFilter", "genre", "genre");
  wireChipGroup("concertSizeFilter", "size", "size");
  wireChipGroup("hoodFilter", "hood", "hood");
  wireChipGroup("vibeFilter", "vibe", "vibe");

  // Save buttons (delegated globally)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-save]");
    if (!btn) return;
    const id = btn.dataset.save;
    if (state.saved.has(id)) state.saved.delete(id);
    else state.saved.add(id);
    persistSaved();
    renderAll();
  });

  renderAll();
})();
