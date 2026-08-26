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

  /* ---------- PULSE.NET: radial radar of the next 14 nights ----------
     Centre = tonight; ring distance = how soon; three 120° sectors group
     sports (amber), concerts (purple), and nightlife venues (teal, plotted
     at their next open night). Every node is clickable. */

  function renderPulseNet(S) {
    const { state, esc, fmtDate, dayOf, todayDayName } = S;
    const el = document.getElementById("pulseNet");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const W = 1000, H = 700, CX = W / 2, CY = H / 2;
    const R0 = 64, R1 = 308;
    const rOf = (day) => R0 + (R1 - R0) * Math.sqrt(Math.min(day, 14) / 14);
    // compass angle: 0 = north, clockwise
    const pos = (deg, r) => {
      const a = (deg * Math.PI) / 180;
      return [CX + r * Math.sin(a), CY - r * Math.cos(a)];
    };

    // Anchor "tonight" to Toronto, not the viewer's clock
    const [ty, tm, td] = S.todayISO().split("-").map(Number);
    const midnight = new Date(ty, tm - 1, td);
    const daysUntil = (iso) => {
      const [y, m, d] = iso.split("-").map(Number);
      return Math.round((new Date(y, m - 1, d) - midnight) / 86400000);
    };
    const DAY_SEQ = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayIdx = midnight.getDay();
    const nextOpenIn = (nights) => {
      for (let i = 0; i < 7; i++) {
        if (nights.includes(DAY_SEQ[(todayIdx + i) % 7])) return i;
      }
      return null;
    };

    const nodes = [];
    state.data.sports.forEach((e) => {
      const d = daysUntil(e.date);
      if (d >= 0 && d <= 14) nodes.push({ kind: "sports", day: d, item: e });
    });
    state.data.concerts.forEach((e) => {
      const d = daysUntil(e.date);
      if (d >= 0 && d <= 14) nodes.push({ kind: "concerts", day: d, item: e });
    });
    state.data.nightlife.forEach((v) => {
      const d = nextOpenIn(v.nights);
      if (d !== null) nodes.push({ kind: "lounge", vibe: v.vibe, day: d, item: v, venue: true });
    });

    // sectors: [startDeg, endDeg]
    const SECTORS = {
      sports: [244, 356],
      concerts: [4, 116],
      lounge: [124, 236],
    };
    ["sports", "concerts", "lounge"].forEach((k) => {
      const group = nodes.filter((n) => n.kind === k).sort((a, b) => a.day - b.day || String(a.item.id).localeCompare(b.item.id));
      const [s, e] = SECTORS[k];
      group.forEach((n, i) => {
        n.angle = s + ((i + 0.5) / group.length) * (e - s);
        n.r = rOf(n.day) + (i % 2 ? 7 : -7); // de-shell slightly so same-day nodes don't fuse
      });
    });

    let cheapest = null;
    nodes.forEach((n) => { if (!n.venue && (!cheapest || n.item.price < cheapest.item.price)) cheapest = n; });

    const rings = [1, 3, 7, 14].map((d) => `
      <circle cx="${CX}" cy="${CY}" r="${rOf(d)}" fill="none" stroke="${C.grid}" stroke-width="1" ${d === 14 ? "" : 'stroke-dasharray="2 5"'} />
      <text x="${CX + 6}" y="${CY - rOf(d) - 5}" fill="${C.inkFaint}" font-size="11" font-family="JetBrains Mono, monospace">+${d}</text>`).join("");

    const spokes = [0, 120, 240].map((deg) => {
      const [x1, y1] = pos(deg, R0 - 12);
      const [x2, y2] = pos(deg, R1 + 14);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.grid}" stroke-width="1" stroke-dasharray="3 7" />`;
    }).join("");

    const sectorLabel = (deg, r, text, color) => {
      const [x, y] = pos(deg, r);
      return `<text x="${x}" y="${y}" text-anchor="middle" fill="${color}" opacity="0.85" font-size="13" font-weight="800" letter-spacing="4" font-family="Archivo, sans-serif">${text}</text>`;
    };
    const labels =
      sectorLabel(300, R1 + 34, "SPORTS", C.sports) +
      sectorLabel(60, R1 + 34, "CONCERTS", C.concerts) +
      sectorLabel(180, R1 + 40, "NIGHTLIFE", C.lounge);

    const sweep = reduceMotion ? "" : `
      <path d="M ${CX} ${CY} L ${pos(0, R1)} A ${R1} ${R1} 0 0 1 ${pos(34, R1)} Z" fill="url(#sweepGrad)" opacity="0.55">
        <animateTransform attributeName="transform" type="rotate" from="0 ${CX} ${CY}" to="360 ${CX} ${CY}" dur="9s" repeatCount="indefinite" />
      </path>`;

    const nodeMarkup = nodes.map((n, i) => {
      const [x, y] = pos(n.angle, n.r);
      const color = n.venue ? C.lounge : C[n.kind]; // venues read as one teal family here; vibe detail lives on the map
      const it = n.item;
      const when = n.day === 0 ? "tonight" : n.day === 1 ? "tomorrow" : `in ${n.day} nights`;
      const tip = n.venue
        ? `<strong>${esc(it.name)}</strong><br>${esc(it.hoodLabel)} · next open <strong>${esc(when)}</strong><br>${esc(it.cover)} · click to open`
        : `<strong>${esc(it.title)}</strong><br>${esc(fmtDate(it.date))} (${esc(when)}) · ${esc(it.venue)}<br>est. from <strong>$${it.price}</strong> · click to open`;
      const ping = reduceMotion ? "" : `
        <circle cx="${x}" cy="${y}" r="6" fill="none" stroke="${color}" stroke-width="1.5" opacity="0" pointer-events="none">
          <animate attributeName="r" values="6;22" dur="3s" begin="${(i % 6) * 0.5}s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0" dur="3s" begin="${(i % 6) * 0.5}s" repeatCount="indefinite" />
        </circle>`;
      const link = `<line x1="${CX}" y1="${CY}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="1" opacity="0.14" pointer-events="none" />`;
      const cheapTag = cheapest === n
        ? `<text x="${x}" y="${y + 24}" text-anchor="middle" fill="${C.inkStrong}" font-size="11" font-weight="700" font-family="JetBrains Mono, monospace">$${it.price} · CHEAPEST</text>` : "";
      return `${link}${ping}${cheapTag}
        <circle cx="${x}" cy="${y}" r="6.5" fill="${color}" stroke="${C.surface}" stroke-width="2" filter="url(#nodeGlow)" pointer-events="none" />
        <circle cx="${x}" cy="${y}" r="14" fill="transparent" style="cursor:pointer" data-open="${esc(it.id)}" data-tip="${esc(tip)}" />`;
    }).join("");

    const hubPulse = reduceMotion ? "" : `
      <circle cx="${CX}" cy="${CY}" r="10" fill="none" stroke="${C.sports}" stroke-width="1.5" opacity="0">
        <animate attributeName="r" values="10;40" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0" dur="2.6s" repeatCount="indefinite" />
      </circle>`;
    const dateStr = `${String(tm).padStart(2, "0")}/${String(td).padStart(2, "0")}`;
    const hub = `
      ${hubPulse}
      <circle cx="${CX}" cy="${CY}" r="34" fill="${C.surface}" stroke="${C.grid}" stroke-width="1.5" />
      <circle cx="${CX}" cy="${CY}" r="5" fill="${C.inkStrong}" filter="url(#nodeGlow)" />
      <text x="${CX}" y="${CY + 18}" text-anchor="middle" fill="${C.ink}" font-size="10" letter-spacing="2" font-family="JetBrains Mono, monospace">NOW</text>
      <text x="${CX}" y="${CY - 44}" text-anchor="middle" fill="${C.inkFaint}" font-size="11" font-family="JetBrains Mono, monospace">${todayDayName().toUpperCase()} ${dateStr}</text>`;

    el.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img"
           aria-label="Radar view of the next 14 nights: sports, concerts and nightlife nodes placed by how soon they happen. Each node is clickable.">
        <defs>
          <filter id="nodeGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="${C.sports}" stop-opacity="0" />
            <stop offset="100%" stop-color="${C.sports}" stop-opacity="0.10" />
          </linearGradient>
        </defs>
        ${sweep}${rings}${spokes}${labels}${nodeMarkup}${hub}
      </svg>`;

    document.getElementById("timelineLegend").innerHTML = `
      <span class="legend-item"><span class="legend-dot" style="background:${C.sports}"></span>Sports</span>
      <span class="legend-item"><span class="legend-dot" style="background:${C.concerts}"></span>Concerts</span>
      <span class="legend-item"><span class="legend-dot" style="background:${C.lounge}"></span>Venues</span>`;

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
    renderPulseNet(S);
    renderPriceByDay(S);
    renderTonight(S);
    renderMap(S);
  }

  document.addEventListener("six:data", renderAllViz);
  renderAllViz(); // in case data beat us to it
})();
