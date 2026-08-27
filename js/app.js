/* 6IXNIGHTS app core — data loading, tabs, filters, grids, detail modal.
   Visualization layer lives in js/viz.js and renders on the "six:data" event. */

(function () {
  "use strict";

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu"];
  const MUSIC_LABELS = {
    hiphop: "Hip-Hop", rnb: "R&B", reggae: "Reggae", dancehall: "Dancehall",
    afro: "Afrobeats", latin: "Latin", house: "House", funk: "Funk", top40: "Top 40",
  };
  const VIBE_LABELS = { club: "Full club", barclub: "Bar → dancefloor", lounge: "Lounge" };

  // Newest data lives on GitHub (updated nightly by CI); the deployed copy is the fallback.
  const RAW_DATA_URL =
    "https://raw.githubusercontent.com/anoojanv/toronto-life/claude/toronto-lifestyle-app-9zc9gy/data/events.json";
  const LOCAL_DATA_URL = "data/events.json";

  const state = {
    tab: "pulse",
    day: "weekdays",
    team: "all",
    maxPrice: "all",
    genre: "all",
    size: "all",
    hood: "all",
    vibe: "all",
    saved: loadSaved(),
    data: null,
  };

  /* ---------- helpers ---------- */

  function loadSaved() {
    try {
      return new Set(JSON.parse(localStorage.getItem("sixnights-saved") || "[]"));
    } catch (e) { return new Set(); }
  }

  function persistSaved() {
    try {
      localStorage.setItem("sixnights-saved", JSON.stringify([...state.saved]));
    } catch (e) { /* private mode — saving is a nice-to-have */ }
  }

  function todayISO() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  }

  function todayDayName() {
    // en-US: "Wed" without the period en-CA appends
    return new Date().toLocaleDateString("en-US", { timeZone: "America/Toronto", weekday: "short" }).slice(0, 3);
  }

  function dayOf(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return DAY_NAMES[new Date(y, m - 1, d).getDay()];
  }

  function fmtDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
  }

  function matchesDay(dateStrOrNights) {
    if (state.day === "all") return true;
    if (Array.isArray(dateStrOrNights)) {
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

  function igUrl(v) {
    return v.instagram
      ? `https://www.instagram.com/${encodeURIComponent(v.instagram)}/`
      : `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent((v.name || "") + " Toronto")}`;
  }

  function mapsUrl(q) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q + " Toronto")}`;
  }

  /* ---------- card renderers ---------- */

  function eventCard(ev) {
    const day = dayOf(ev.date);
    const isWeekday = WEEKDAYS.includes(day);
    const genreTags = (ev.genres || [])
      .map((g) => `<span class="tag genre-${g}">${esc(MUSIC_LABELS[g] || g)}</span>`).join("");
    const extraTags = (ev.tags || []).map((t) => `<span class="tag deal">${esc(t)}</span>`).join("");
    return `
      <article class="card clickable" data-open="${esc(ev.id)}" tabindex="0" role="button" aria-label="Open details for ${esc(ev.title)}">
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
      .map((g) => `<span class="tag genre-${g === "dancehall" ? "reggae" : g}">${esc(MUSIC_LABELS[g] || g)}</span>`).join("");
    const nightDots = DAY_NAMES.slice(1).concat(DAY_NAMES[0])
      .map((d) => `<span class="night-dot ${v.nights.includes(d) ? "on" : ""}">${d}</span>`).join("");
    return `
      <article class="card clickable" data-open="${esc(v.id)}" tabindex="0" role="button" aria-label="Open details for ${esc(v.name)}">
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
          <div class="ticket-links">
            <a class="tix-btn ig-btn" href="${igUrl(v)}" target="_blank" rel="noopener">${v.instagram ? "◉ IG" : "◉ Find IG"}</a>
            <a class="tix-btn primary" href="${mapsUrl(v.name + " " + v.address)}" target="_blank" rel="noopener">Map</a>
          </div>
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

  /* ---------- modal ---------- */

  const backdrop = document.getElementById("modalBackdrop");
  const modalBody = document.getElementById("modalBody");

  function findItem(id) {
    const d = state.data;
    if (!d) return null;
    return (
      d.sports.find((e) => e.id === id) ||
      d.concerts.find((e) => e.id === id) ||
      d.nightlife.find((v) => v.id === id) ||
      null
    );
  }

  function priceContextBars(item) {
    // this event's est. price vs the weekday and weekend averages across all events
    const all = state.data.sports.concat(state.data.concerts);
    const wk = all.filter((e) => WEEKDAYS.includes(dayOf(e.date)));
    const we = all.filter((e) => !WEEKDAYS.includes(dayOf(e.date)));
    const avg = (list) => (list.length ? Math.round(list.reduce((s, e) => s + e.price, 0) / list.length) : 0);
    const rows = [
      { label: "This event", value: item.price, self: true },
      { label: "Weeknight avg", value: avg(wk) },
      { label: "Weekend avg", value: avg(we) },
    ].filter((r) => r.value > 0);
    const max = Math.max(...rows.map((r) => r.value));
    return `
      <div class="ctx-chart" aria-label="Price context">
        ${rows.map((r) => `
          <div class="ctx-row">
            <span class="ctx-label">${esc(r.label)}</span>
            <span class="ctx-track"><span class="ctx-fill ${r.self ? "self" : ""}" style="width:${Math.max(6, Math.round((r.value / max) * 100))}%"></span></span>
            <span class="ctx-value">$${r.value}</span>
          </div>`).join("")}
      </div>`;
  }

  const HOOD_LABELS = {
    kingwest: "King West", ossington: "Ossington / Dundas W", queenwest: "Queen West",
    yorkville: "Yorkville", ent: "Entertainment District",
  };

  // Tapping a neighbourhood used to navigate to another tab with no way back.
  // It now opens a popup listing that hood's rooms; drilling into a room keeps
  // a back link to this list, so the map is never lost.
  function openHoodModal(hoodKey) {
    if (!state.data) return;
    const DAY_SEQ = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const night = DAY_SEQ.includes(state.day) ? state.day : todayDayName();
    const list = state.data.nightlife.filter((v) => v.hood === hoodKey);
    if (!list.length) return;
    const open = list.filter((v) => v.nights.includes(night));
    const shut = list.filter((v) => !v.nights.includes(night));

    const row = (v, isOpen) => `
      <button class="hood-row ${isOpen ? "" : "is-shut"}" data-open="${esc(v.id)}" data-from="${esc(hoodKey)}">
        <span class="hood-row-dot vibe-${esc(v.vibe)}"></span>
        <span class="hood-row-main">
          <span class="hood-row-name">${esc(v.name)}</span>
          <span class="hood-row-meta">${isOpen
            ? esc(v.music.slice(0, 2).map((m) => MUSIC_LABELS[m] || m).join(", ")) + " · " + esc(v.coverMin === 0 ? "No cover" : "$" + v.coverMin + "+")
            : "Closed " + esc(night)}</span>
        </span>
        <span class="hood-row-go">›</span>
      </button>`;

    modalBody.innerHTML = `
      <p class="modal-kicker">${esc(open.length)} of ${list.length} open ${esc(night)}</p>
      <h2 class="modal-title">${esc(HOOD_LABELS[hoodKey] || hoodKey)}</h2>
      <div class="hood-rows">
        ${open.map((v) => row(v, true)).join("")}
        ${shut.map((v) => row(v, false)).join("")}
      </div>
      <div class="modal-actions">
        <button class="tix-btn primary" data-hood-jump="${esc(hoodKey)}">Open in Nightlife tab</button>
      </div>`;
    backdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function openModal(id, from) {
    const item = findItem(id);
    if (!item) return;
    const isVenue = !item.date;
    let html;
    if (isVenue) {
      const nightDots = DAY_NAMES.slice(1).concat(DAY_NAMES[0])
        .map((d) => `<span class="night-dot ${item.nights.includes(d) ? "on" : ""}">${d}</span>`).join("");
      html = `
        <p class="modal-kicker">${esc(item.hoodLabel)} · ${esc(VIBE_LABELS[item.vibe] || item.vibe)}</p>
        <h2 class="modal-title">${esc(item.name)}</h2>
        <p class="modal-sub">${esc(item.address)}${item.instagram ? ` · <a class="ig-inline" href="https://www.instagram.com/${esc(item.instagram)}/" target="_blank" rel="noopener">@${esc(item.instagram)}</a>` : ""}</p>
        <p class="modal-desc">${esc(item.desc)}</p>
        <div class="tag-row">${item.music.map((g) => `<span class="tag genre-${g === "dancehall" ? "reggae" : g}">${esc(MUSIC_LABELS[g] || g)}</span>`).join("")}</div>
        <h4 class="modal-h4">Nights it goes</h4>
        <div class="nights-row">${nightDots}</div>
        <h4 class="modal-h4">Cover</h4>
        <p class="modal-desc">${esc(item.cover)}</p>
        <div class="modal-actions">
          <a class="tix-btn ig-btn" href="${igUrl(item)}" target="_blank" rel="noopener">${item.instagram ? "◉ @" + esc(item.instagram) : "◉ Find on Instagram"}</a>
          <a class="tix-btn primary" href="${mapsUrl(item.name + " " + item.address)}" target="_blank" rel="noopener">Open in Maps</a>
          <button class="tix-btn save-toggle" data-save="${esc(item.id)}">${state.saved.has(item.id) ? "★ Saved" : "☆ Save to lineup"}</button>
        </div>`;
    } else {
      const day = dayOf(item.date);
      html = `
        <p class="modal-kicker">${esc(fmtDate(item.date))}${WEEKDAYS.includes(day) ? " · weeknight ✓" : ""}</p>
        <h2 class="modal-title">${esc(item.title)}</h2>
        <p class="modal-sub">${esc(item.venue)}${item.hood ? " · " + esc(item.hood) : ""}</p>
        <p class="modal-desc">${esc(item.desc)}</p>
        <div class="tag-row">
          ${(item.genres || []).map((g) => `<span class="tag genre-${g}">${esc(MUSIC_LABELS[g] || g)}</span>`).join("")}
          ${(item.tags || []).map((t) => `<span class="tag deal">${esc(t)}</span>`).join("")}
        </div>
        <h4 class="modal-h4">Price check <span class="modal-fine">(estimates)</span></h4>
        ${priceContextBars(item)}
        <div class="modal-actions">
          ${item.links.map((l) => `<a class="tix-btn ${l.primary ? "primary" : ""}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("")}
          <button class="tix-btn save-toggle" data-save="${esc(item.id)}">${state.saved.has(item.id) ? "★ Saved" : "☆ Save to lineup"}</button>
        </div>`;
    }
    const back = from && HOOD_LABELS[from]
      ? `<button class="modal-back" data-hood-modal="${esc(from)}">‹ Back to ${esc(HOOD_LABELS[from])}</button>`
      : "";
    modalBody.innerHTML = back + html;
    backdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    backdrop.classList.add("hidden");
    document.body.style.overflow = "";
  }

  document.getElementById("modalClose").addEventListener("click", closeModal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  /* ---------- renders ---------- */

  function renderSports() {
    const items = state.data.sports.filter((ev) => {
      if (!matchesDay(ev.date)) return false;
      if (state.team !== "all" && ev.team !== state.team) return false;
      if (state.maxPrice !== "all" && ev.price > Number(state.maxPrice)) return false;
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
    document.getElementById("sportsGrid").innerHTML = items.map(eventCard).join("");
    document.getElementById("sportsEmpty").classList.toggle("hidden", items.length > 0);
  }

  function renderConcerts() {
    const items = state.data.concerts.filter((ev) => {
      if (!matchesDay(ev.date)) return false;
      if (state.genre !== "all" && !ev.genres.includes(state.genre)) return false;
      if (state.size !== "all" && ev.size !== state.size) return false;
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
    document.getElementById("concertsGrid").innerHTML = items.map(eventCard).join("");
    document.getElementById("concertsEmpty").classList.toggle("hidden", items.length > 0);
    document.getElementById("watchGrid").innerHTML = state.data.artistWatch.map(watchCard).join("");
  }

  function renderNightlife() {
    const items = state.data.nightlife.filter((v) => {
      if (!matchesDay(v.nights)) return false;
      if (state.hood !== "all" && v.hood !== state.hood) return false;
      if (state.vibe !== "all" && v.vibe !== state.vibe) return false;
      return true;
    });
    document.getElementById("nightlifeGrid").innerHTML = items.map(venueCard).join("");
    document.getElementById("nightlifeEmpty").classList.toggle("hidden", items.length > 0);
  }

  function renderLineup() {
    const savedEvents = state.data.sports.concat(state.data.concerts)
      .filter((ev) => state.saved.has(ev.id))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(eventCard);
    const savedVenues = state.data.nightlife.filter((v) => state.saved.has(v.id)).map(venueCard);
    const all = savedEvents.concat(savedVenues);
    document.getElementById("lineupGrid").innerHTML = all.join("");
    document.getElementById("lineupEmpty").classList.toggle("hidden", all.length > 0);
  }

  function renderUpdatedBadge() {
    const el = document.getElementById("updatedBadge");
    try {
      const dt = new Date(state.data.lastUpdated);
      const days = Math.floor((Date.now() - dt.getTime()) / 86400000);
      const when = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
      el.textContent = `⟳ Data refreshed ${when} · updates nightly`;
    } catch (e) {
      el.textContent = "⟳ Updates nightly";
    }
  }

  function renderAll() {
    if (!state.data) return;
    renderSports();
    renderConcerts();
    renderNightlife();
    renderLineup();
    renderUpdatedBadge();
    document.getElementById("savedCount").textContent = state.saved.size;
    // Let the viz layer re-plan too — the day strip retargets the map's night
    document.dispatchEvent(new CustomEvent("six:render"));
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

  // Radar district node → Nightlife tab, filtered to that neighbourhood
  document.addEventListener("click", (e) => {
    const jump = e.target.closest("[data-hood-jump]");
    if (!jump) return;
    const hood = jump.dataset.hoodJump;
    closeModal();
    const chip = document.querySelector(`#hoodFilter [data-hood="${hood}"]`);
    if (chip) chip.click();
    const navBtn = nav.querySelector('.navlink[data-tab="nightlife"]');
    if (navBtn) navBtn.click();
  });

  // Any element carrying data-tab outside the nav (e.g. the side-quest link)
  document.addEventListener("click", (e) => {
    const jump = e.target.closest("[data-tab]");
    if (!jump || jump.closest("#topnav")) return;
    const target = nav.querySelector(`.navlink[data-tab="${jump.dataset.tab}"]`);
    if (target) target.click();
  });

  document.getElementById("logo").addEventListener("click", (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  const dayStrip = document.getElementById("dayStrip");
  dayStrip.addEventListener("click", (e) => {
    const btn = e.target.closest(".day-chip");
    if (!btn) return;
    state.day = btn.dataset.day;
    setActive(dayStrip, btn);
    renderAll();
  });

  wireChipGroup("sportsTeamFilter", "team", "team");
  wireChipGroup("sportsPriceFilter", "maxPrice", "price");
  wireChipGroup("concertGenreFilter", "genre", "genre");
  wireChipGroup("concertSizeFilter", "size", "size");
  wireChipGroup("hoodFilter", "hood", "hood");
  wireChipGroup("vibeFilter", "vibe", "vibe");

  // Global delegation: saves, and card/pin clicks that open the modal
  document.addEventListener("click", (e) => {
    const saveEl = e.target.closest("[data-save]");
    if (saveEl) {
      e.stopPropagation();
      const id = saveEl.dataset.save;
      if (state.saved.has(id)) state.saved.delete(id);
      else state.saved.add(id);
      persistSaved();
      renderAll();
      if (saveEl.classList.contains("save-toggle")) {
        saveEl.textContent = state.saved.has(id) ? "★ Saved" : "☆ Save to lineup";
      }
      return;
    }
    if (e.target.closest("a")) return; // links behave as links
    const hoodModal = e.target.closest("[data-hood-modal]");
    if (hoodModal) { openHoodModal(hoodModal.dataset.hoodModal); return; }
    const opener = e.target.closest("[data-open]");
    if (opener) openModal(opener.dataset.open, opener.dataset.from);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const hoodEl = e.target.closest && e.target.closest("[data-hood-modal]");
    if (hoodEl) { openHoodModal(hoodEl.dataset.hoodModal); return; }
    const opener = e.target.closest && e.target.closest("[data-open]");
    if (opener) openModal(opener.dataset.open, opener.dataset.from);
  });

  /* ---------- data loading ---------- */

  function pruneAndAdopt(data) {
    const today = todayISO();
    data.sports = (data.sports || []).filter((e) => e.date >= today);
    data.concerts = (data.concerts || []).filter((e) => e.date >= today);
    state.data = data;

    // Saved ids outlive the things they point at: the nightly refresh drops past
    // events and venues close. Without this the badge counts ghosts and drifts
    // above the number of cards actually shown. Only prune once data is real.
    const live = new Set(
      data.sports.concat(data.concerts).map((e) => e.id)
        .concat(data.nightlife.map((v) => v.id))
    );
    let dropped = false;
    state.saved.forEach((id) => { if (!live.has(id)) { state.saved.delete(id); dropped = true; } });
    if (dropped) persistSaved();
    renderAll();
    document.dispatchEvent(new CustomEvent("six:data"));
  }

  async function loadData() {
    const bust = `?t=${todayISO()}`;
    for (const url of [RAW_DATA_URL + bust, LOCAL_DATA_URL + bust]) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(res.status);
        pruneAndAdopt(await res.json());
        return;
      } catch (e) { /* try next source */ }
    }
    document.getElementById("updatedBadge").textContent = "⚠ Couldn't load event data — refresh to retry.";
  }

  // Shared surface for viz.js
  window.SIX = {
    state,
    esc,
    dayOf,
    fmtDate,
    todayISO,
    todayDayName,
    openModal,
    openHoodModal,
    WEEKDAYS,
    MUSIC_LABELS,
    VIBE_LABELS,
  };

  loadData();
})();
