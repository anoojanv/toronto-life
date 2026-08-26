/* 6IXNIGHTS visualization layer — Pulse dashboard.
   Renders once app.js dispatches "six:data". Palette (validated for dark surface,
   all-pairs CVD-safe): amber #b8841f, purple #8d6bf3, teal #1f9d92. */

(function () {
  "use strict";

  const C = {
    sports: "#b8841f",
    concerts: "#8d6bf3",
    club: "#b8841f",
    barclub: "#8d6bf3",
    lounge: "#1f9d92",
    surface: "#14141c",
    grid: "#262636",
    ink: "#a3a0b0",
    inkStrong: "#f2f0ec",
    inkFaint: "#6f6c80",
  };

  const tooltip = document.getElementById("vizTooltip");

  function showTip(html, x, y) {
    tooltip.innerHTML = html;
    tooltip.classList.remove("hidden");
    const pad = 14;
    const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
    let left = x + pad, top = y - th - pad;
    if (left + tw > window.innerWidth - 8) left = x - tw - pad;
    if (top < 8) top = y + pad;
    tooltip.style.left = left + "px";
    tooltip.style.top = top + "px";
  }
  function hideTip() { tooltip.classList.add("hidden"); }

  function bindTips(rootEl) {
    rootEl.addEventListener("mousemove", (e) => {
      const t = e.target.closest("[data-tip]");
      if (t) showTip(t.dataset.tip, e.clientX, e.clientY);
      else hideTip();
    });
    rootEl.addEventListener("mouseleave", hideTip);
  }

  /* ---------- stat tiles ---------- */

  function renderStats(S) {
    const { state, esc, todayISO, todayDayName } = S;
    const today = todayISO();
    const week = new Date(); week.setDate(week.getDate() + 7);
    const weekISO = week.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    const all = state.data.sports.concat(state.data.concerts);
    const thisWeek = all.filter((e) => e.date >= today && e.date <= weekISO);
    const cheapest = thisWeek.slice().sort((a, b) => a.price - b.price)[0];
    const tonight = state.data.nightlife.filter((v) => v.nights.includes(todayDayName()));
    const freeTonight = tonight.filter((v) => v.coverMin === 0);

    const tiles = [
      { big: String(thisWeek.length), label: "games & shows in the next 7 days" },
      cheapest
        ? { big: `$${cheapest.price}`, label: `cheapest night out: ${cheapest.title}`, open: cheapest.id }
        : { big: "—", label: "no priced events this week" },
      { big: String(tonight.length), label: `rooms going tonight (${todayDayName()})` },
      { big: String(freeTonight.length), label: "of them with free cover" },
    ];
    document.getElementById("statRow").innerHTML = tiles
      .map((t) => `
        <div class="stat-tile ${t.open ? "clickable" : ""}" ${t.open ? `data-open="${esc(t.open)}" role="button" tabindex="0"` : ""}>
          <span class="stat-big">${esc(t.big)}</span>
          <span class="stat-label">${esc(t.label)}</span>
        </div>`)
      .join("");
  }

  /* ---------- timeline: next 14 nights ---------- */

  function renderTimeline(S) {
    const { state, esc, fmtDate, dayOf, WEEKDAYS } = S;
    const el = document.getElementById("timelineViz");

    const days = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      days.push({
        iso: d.toLocaleDateString("en-CA"),
        label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()],
        num: d.getDate(),
      });
    }
    const byDate = {};
    state.data.sports.forEach((e) => (byDate[e.date] = byDate[e.date] || []).push({ ...e, kind: "sports" }));
    state.data.concerts.forEach((e) => (byDate[e.date] = byDate[e.date] || []).push({ ...e, kind: "concerts" }));

    const COL = 66, W = COL * 14, H = 240, TOP = 18, BOT = 44;
    const plotH = H - TOP - BOT;
    const events = days.flatMap((d) => byDate[d.iso] || []);
    const maxP = Math.max(40, ...events.map((e) => e.price));
    const y = (p) => TOP + plotH - (p / maxP) * plotH;

    const gridLines = [0, Math.round(maxP / 2), maxP].map((p) => `
      <line x1="0" x2="${W}" y1="${y(p)}" y2="${y(p)}" stroke="${C.grid}" stroke-width="1" />
      <text x="4" y="${y(p) - 4}" fill="${C.inkFaint}" font-size="10" font-family="JetBrains Mono, monospace">$${p}</text>`).join("");

    const cols = days.map((d, i) => {
      const isWk = WEEKDAYS.includes(d.label);
      const x = i * COL;
      return `
        ${isWk ? `<rect x="${x}" y="${TOP - 6}" width="${COL}" height="${plotH + 12}" fill="rgba(232,182,76,0.05)" />` : ""}
        <text x="${x + COL / 2}" y="${H - 24}" text-anchor="middle" fill="${isWk ? C.inkStrong : C.inkFaint}" font-size="11" font-weight="700" font-family="Archivo, sans-serif">${d.label}</text>
        <text x="${x + COL / 2}" y="${H - 9}" text-anchor="middle" fill="${C.inkFaint}" font-size="10" font-family="JetBrains Mono, monospace">${d.num}</text>`;
    }).join("");

    let cheapestInWindow = null;
    events.forEach((e) => { if (!cheapestInWindow || e.price < cheapestInWindow.price) cheapestInWindow = e; });

    const dots = days.map((d, i) => {
      const evs = (byDate[d.iso] || []).slice().sort((a, b) => a.price - b.price);
      const n = evs.length;
      return evs.map((e, j) => {
        const cx = i * COL + COL / 2 + (n > 1 ? (j - (n - 1) / 2) * 14 : 0);
        const cy = y(Math.min(e.price, maxP));
        const tip = `<strong>${esc(e.title)}</strong><br>${esc(fmtDate(e.date))} · ${esc(e.venue)}<br>est. from <strong>$${e.price}</strong> · click for details`;
        const label = cheapestInWindow && e.id === cheapestInWindow.id
          ? `<text x="${cx}" y="${cy - 14}" text-anchor="middle" fill="${C.inkStrong}" font-size="10" font-weight="700" font-family="Archivo, sans-serif">$${e.price} ↓</text>` : "";
        return `${label}
          <circle cx="${cx}" cy="${cy}" r="6" fill="${C[e.kind]}" stroke="${C.surface}" stroke-width="2" pointer-events="none" />
          <circle cx="${cx}" cy="${cy}" r="12" fill="transparent" style="cursor:pointer" data-open="${esc(e.id)}" data-tip="${esc(tip)}" />`;
      }).join("");
    }).join("");

    el.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Timeline of events over the next 14 nights, dot height showing estimated price">
        ${gridLines}${cols}${dots}
      </svg>`;

    document.getElementById("timelineLegend").innerHTML = `
      <span class="legend-item"><span class="legend-dot" style="background:${C.sports}"></span>Sports</span>
      <span class="legend-item"><span class="legend-dot" style="background:${C.concerts}"></span>Concerts</span>`;

    bindTips(el);
  }

  /* ---------- price by day-of-week bars ---------- */

  function renderPriceByDay(S) {
    const { state, esc, dayOf } = S;
    const el = document.getElementById("priceByDayViz");
    const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const all = state.data.sports.concat(state.data.concerts);
    const groups = order.map((d) => {
      const evs = all.filter((e) => dayOf(e.date) === d);
      return { d, n: evs.length, avg: evs.length ? Math.round(evs.reduce((s, e) => s + e.price, 0) / evs.length) : 0 };
    });
    const max = Math.max(...groups.map((g) => g.avg), 1);
    const withData = groups.filter((g) => g.n > 0);
    const cheapest = withData.length ? withData.reduce((a, b) => (b.avg < a.avg ? b : a)) : null;

    el.innerHTML = `
      <div class="bars" role="img" aria-label="Average estimated ticket price by day of week">
        ${groups.map((g) => `
          <div class="bar-col" data-tip="${esc(`<strong>${g.d}</strong><br>${g.n ? `avg est. $${g.avg} across ${g.n} event${g.n > 1 ? "s" : ""}` : "no dated events"}`)}">
            <span class="bar-value">${g.n ? "$" + g.avg : "–"}</span>
            <span class="bar-fill" style="height:${g.n ? Math.max(6, Math.round((g.avg / max) * 110)) : 3}px"></span>
            <span class="bar-day ${cheapest && g.d === cheapest.d ? "cheapest-day" : ""}">${g.d}</span>
          </div>`).join("")}
      </div>
      ${cheapest ? `<p class="bars-callout">↓ ${cheapest.d} is the cheapest night right now — avg est. $${cheapest.avg}</p>` : ""}`;
    bindTips(el);
  }

  /* ---------- tonight ---------- */

  function renderTonight(S) {
    const { state, esc, todayISO, todayDayName, MUSIC_LABELS } = S;
    const el = document.getElementById("tonightList");
    const today = todayISO();
    const dayName = todayDayName();

    const events = state.data.sports.concat(state.data.concerts).filter((e) => e.date === today);
    const venues = state.data.nightlife
      .filter((v) => v.nights.includes(dayName))
      .slice().sort((a, b) => a.coverMin - b.coverMin);

    const evRows = events.map((e) => `
      <div class="tonight-row clickable" data-open="${esc(e.id)}" role="button" tabindex="0">
        <span class="tonight-dot" style="background:${e.team ? C.sports : C.concerts}"></span>
        <span class="tonight-name">${esc(e.title)}</span>
        <span class="tonight-meta">est. $${e.price}</span>
      </div>`);

    const vRows = venues.map((v) => `
      <div class="tonight-row clickable" data-open="${esc(v.id)}" role="button" tabindex="0">
        <span class="tonight-dot" style="background:${C[v.vibe]}"></span>
        <span class="tonight-name">${esc(v.name)} <span class="tonight-sub">${esc(v.hoodLabel)}</span></span>
        <span class="tonight-meta">${v.coverMin === 0 ? "free" : "$" + v.coverMin + "+"}</span>
      </div>`);

    const rows = evRows.concat(vRows);
    el.innerHTML = rows.length
      ? rows.join("")
      : `<p class="empty-note">Quiet one tonight (${esc(dayName)}) — check the timeline for what's next.</p>`;
  }

  /* ---------- venue map ---------- */

  function renderMap(S) {
    const { state, esc, VIBE_LABELS, MUSIC_LABELS } = S;
    const el = document.getElementById("mapViz");
    const venues = state.data.nightlife.filter((v) => v.lat && v.lng);

    const latMin = 43.636, latMax = 43.684, lngMin = -79.435, lngMax = -79.381;
    const W = 900, H = 540, PAD = 34;
    const px = (lng) => PAD + ((lng - lngMin) / (lngMax - lngMin)) * (W - PAD * 2);
    const py = (lat) => PAD + ((latMax - lat) / (latMax - latMin)) * (H - PAD * 2);

    const zones = [
      { label: "YORKVILLE", lat: 43.674, lng: -79.394 },
      { label: "OSSINGTON / DUNDAS W", lat: 43.654, lng: -79.423 },
      { label: "QUEEN WEST", lat: 43.6465, lng: -79.412 },
      { label: "KING WEST", lat: 43.641, lng: -79.404 },
      { label: "ENTERTAINMENT DISTRICT", lat: 43.6505, lng: -79.390 },
    ];

    const streets = `
      <line x1="${PAD}" x2="${W - PAD}" y1="${py(43.6448)}" y2="${py(43.6448)}" stroke="${C.grid}" stroke-width="1.5" />
      <text x="${W - PAD - 4}" y="${py(43.6448) - 5}" text-anchor="end" fill="${C.inkFaint}" font-size="10" font-family="JetBrains Mono, monospace">KING ST W</text>
      <line x1="${PAD}" x2="${W - PAD}" y1="${py(43.6489)}" y2="${py(43.6489)}" stroke="${C.grid}" stroke-width="1.5" />
      <text x="${W - PAD - 4}" y="${py(43.6489) - 5}" text-anchor="end" fill="${C.inkFaint}" font-size="10" font-family="JetBrains Mono, monospace">QUEEN ST W</text>
      <line x1="${px(-79.4207)}" x2="${px(-79.4207)}" y1="${PAD}" y2="${H - PAD}" stroke="${C.grid}" stroke-width="1.5" />
      <text x="${px(-79.4207) + 6}" y="${PAD + 12}" fill="${C.inkFaint}" font-size="10" font-family="JetBrains Mono, monospace">OSSINGTON</text>
      <line x1="${px(-79.3985)}" x2="${px(-79.3985)}" y1="${PAD}" y2="${py(43.663)}" stroke="${C.grid}" stroke-width="1.5" stroke-dasharray="4 4" />
      <text x="${px(-79.3985) + 6}" y="${PAD + 12}" fill="${C.inkFaint}" font-size="10" font-family="JetBrains Mono, monospace">AVENUE RD</text>
      <text x="${W / 2}" y="${H - 8}" text-anchor="middle" fill="${C.inkFaint}" font-size="10" letter-spacing="4" font-family="JetBrains Mono, monospace">≈ LAKE ONTARIO ↓ ≈</text>`;

    const zoneLabels = zones.map((z) => `
      <text x="${px(z.lng)}" y="${py(z.lat)}" text-anchor="middle" fill="${C.inkFaint}" opacity="0.65" font-size="11" letter-spacing="3" font-weight="700" font-family="Archivo, sans-serif">${z.label}</text>`).join("");

    // Spread pins that project onto (nearly) the same pixel — King West venues
    // are metres apart in real life, so nudge until hit targets don't overlap.
    const pts = venues.map((v) => ({ v, x: px(v.lng), y: py(v.lat) }));
    const MIN_D = 22;
    for (let iter = 0; iter < 40; iter++) {
      let moved = false;
      for (let a = 0; a < pts.length; a++) {
        for (let b = a + 1; b < pts.length; b++) {
          let dx = pts[b].x - pts[a].x, dy = pts[b].y - pts[a].y;
          let d = Math.hypot(dx, dy);
          if (d >= MIN_D) continue;
          if (d < 0.01) { dx = 1; dy = 0; d = 1; }
          const push = (MIN_D - d) / 2 / d;
          pts[a].x -= dx * push; pts[a].y -= dy * push;
          pts[b].x += dx * push; pts[b].y += dy * push;
          moved = true;
        }
      }
      if (!moved) break;
    }
    pts.forEach((p) => {
      p.x = Math.min(W - PAD, Math.max(PAD, p.x));
      p.y = Math.min(H - PAD, Math.max(PAD, p.y));
    });

    const pins = pts.map(({ v, x, y: yv }) => {
      const tip = `<strong>${esc(v.name)}</strong><br>${esc(v.hoodLabel)} · ${esc(VIBE_LABELS[v.vibe] || v.vibe)}<br>${esc(v.music.map((m) => MUSIC_LABELS[m] || m).join(" · "))}<br>${esc(v.cover)} · click to open`;
      return `
        <circle cx="${x}" cy="${yv}" r="7" fill="${C[v.vibe]}" stroke="${C.surface}" stroke-width="2" pointer-events="none" />
        <circle cx="${x}" cy="${yv}" r="11" fill="transparent" style="cursor:pointer" data-open="${esc(v.id)}" data-tip="${esc(tip)}" />`;
    }).join("");

    el.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Schematic map of downtown Toronto nightlife venues">
        <rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="${C.surface}" />
        ${streets}${zoneLabels}${pins}
      </svg>`;

    document.getElementById("mapLegend").innerHTML = ["club", "barclub", "lounge"]
      .map((v) => `<span class="legend-item"><span class="legend-dot" style="background:${C[v]}"></span>${VIBE_LABELS[v]}</span>`)
      .join("");

    bindTips(el);
  }

  /* ---------- boot ---------- */

  function renderAllViz() {
    const S = window.SIX;
    if (!S || !S.state.data) return;
    renderStats(S);
    renderTimeline(S);
    renderPriceByDay(S);
    renderTonight(S);
    renderMap(S);
  }

  document.addEventListener("six:data", renderAllViz);
  renderAllViz(); // in case data beat us to it
})();
