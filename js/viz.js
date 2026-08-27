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
    sportsGlow: "#e8b64c",
    concertsGlow: "#b39bff",
    loungeGlow: "#3fd6c8",
    surface: "#14141c",
    grid: "#262636",
    ring: "rgba(158, 148, 232, 0.34)",   // structural lines on dark viz — visible, not shouting
    ringBright: "rgba(196, 188, 255, 0.55)",
    street: "#565a86",
    ink: "#a3a0b0",
    inkStrong: "#f2f0ec",
    inkFaint: "#8b88a5",
    inkLabel: "#c9c6dd",
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
    if (!document.getElementById("statRow")) return;
    const { state, esc, todayISO, todayDayName } = S;
    const today = todayISO();
    const week = new Date(); week.setDate(week.getDate() + 7);
    const weekISO = week.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    const all = state.data.sports.concat(state.data.concerts);
    const thisWeek = all.filter((e) => e.date >= today && e.date <= weekISO);
    const tonight = state.data.nightlife.filter((v) => v.nights.includes(todayDayName()));
    const freeTonight = tonight.filter((v) => v.coverMin === 0);

    const shows = state.data.concerts.filter((e) => e.date >= today && e.date <= weekISO);
    const games = state.data.sports.filter((e) => e.date >= today && e.date <= weekISO);
    const tiles = [
      { big: String(tonight.length), label: `rooms open tonight (${todayDayName()})`, hero: true },
      { big: String(freeTonight.length), label: "of them with no cover" },
      { big: String(shows.length), label: "hip-hop / R&B / reggae shows this week" },
      { big: String(games.length), label: "games this week · side quest", quiet: true },
    ];
    document.getElementById("statRow").innerHTML = tiles
      .map((t) => `
        <div class="stat-tile ${t.hero ? "hero" : ""} ${t.quiet ? "quiet" : ""} ${t.open ? "clickable" : ""}" ${t.open ? `data-open="${esc(t.open)}" role="button" tabindex="0"` : ""}>
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
    if (!document.getElementById("pulseNet")) return;
    const { state, esc, fmtDate, dayOf, todayDayName } = S;
    const el = document.getElementById("pulseNet");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const W = 1000, H = 745, CX = W / 2, CY = H / 2;
    const R0 = 126, R1 = 330;   // inner radius must clear the hub collar and give day-0 nodes arc room
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
    // Venues recur weekly rather than having a date, so 15 of them all land on
    // the day-0 ring and fuse. The map above already answers "which room, which
    // night" — here nightlife reads at district level: one node per hood, sized
    // by how many rooms are open, clicking through to that neighbourhood.
    const HOODS = [
      { key: "kingwest", label: "KING W" },
      { key: "ent", label: "ENT DIST" },
      { key: "queenwest", label: "QUEEN W" },
      { key: "ossington", label: "OSSINGTON" },
      { key: "yorkville", label: "YORKVILLE" },
    ];
    HOODS.forEach((h) => {
      const list = state.data.nightlife.filter((v) => v.hood === h.key);
      if (!list.length) return;
      const days = list.map((v) => nextOpenIn(v.nights)).filter((d) => d !== null);
      if (!days.length) return;
      const day = Math.min(...days);
      const openThatNight = list.filter((v) => nextOpenIn(v.nights) === day).length;
      nodes.push({ kind: "lounge", day, district: h, count: openThatNight, total: list.length });
    });

    // Sector width follows priority, not equal thirds: nightlife is the app's
    // centre of gravity, concerts second, sports a slim side-quest wedge.
    const SECTORS = {
      lounge: [186, 354],   // 168deg
      concerts: [8, 128],   // 120deg
      sports: [136, 178],   // 42deg
    };
    ["lounge", "concerts", "sports"].forEach((k) => {
      const group = nodes.filter((n) => n.kind === k).sort((a, b) => a.day - b.day || String(a.item ? a.item.id : a.district.key).localeCompare(b.item ? b.item.id : b.district.key));
      const [s, e] = SECTORS[k];
      group.forEach((n, i) => {
        n.angle = s + ((i + 0.5) / group.length) * (e - s);
        n.r = rOf(n.day) + (i % 2 ? 7 : -7); // de-shell slightly so same-day nodes don't fuse
      });
    });

    let cheapest = null;
    nodes.forEach((n) => { if (n.item && n.item.price != null && (!cheapest || n.item.price < cheapest.item.price)) cheapest = n; });

    const rings = [1, 3, 7, 14].map((d) => `
      <circle cx="${CX}" cy="${CY}" r="${rOf(d)}" fill="none" stroke="${d === 14 ? C.ringBright : C.ring}" stroke-width="${d === 14 ? 1.5 : 1}" ${d === 14 ? "" : 'stroke-dasharray="1 6"'} stroke-linecap="round" />
      <text x="${CX + 6}" y="${CY - rOf(d) - 6}" fill="${C.inkLabel}" font-size="11.5" font-family="JetBrains Mono, monospace">+${d}</text>`).join("");

    // outer tick ring — HUD dial marks every 6°, bright every 30°
    const ticks = Array.from({ length: 60 }, (_, i) => {
      const deg = i * 6;
      const major = i % 5 === 0;
      const [x1, y1] = pos(deg, R1 + 8);
      const [x2, y2] = pos(deg, R1 + (major ? 20 : 14));
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${major ? C.ringBright : C.ring}" stroke-width="${major ? 1.8 : 1}" />`;
    }).join("");

    // colored sector arcs hugging the outer ring
    const arcFor = (deg1, deg2, color) => {
      const [x1, y1] = pos(deg1, R1 + 26);
      const [x2, y2] = pos(deg2, R1 + 26);
      return `<path d="M ${x1} ${y1} A ${R1 + 26} ${R1 + 26} 0 ${deg2 - deg1 > 180 ? 1 : 0} 1 ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.8" stroke-linecap="round" />`;
    };
    const sectorArcs =
      arcFor(SECTORS.sports[0], SECTORS.sports[1], C.sports) +
      arcFor(SECTORS.concerts[0], SECTORS.concerts[1], C.concerts) +
      arcFor(SECTORS.lounge[0], SECTORS.lounge[1], C.lounge);

    const spokes = [0, 132, 182].map((deg) => {
      const [x1, y1] = pos(deg, R0 - 12);
      const [x2, y2] = pos(deg, R1 + 8);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.ring}" stroke-width="1" stroke-dasharray="2 8" />`;
    }).join("");

    // orbiting particles tracing the rings
    const orbiters = reduceMotion ? "" : [
      { r: rOf(3), dur: 14, color: C.concertsGlow },
      { r: rOf(7), dur: 22, color: C.loungeGlow },
      { r: rOf(14), dur: 30, color: C.sportsGlow },
    ].map((o) => `
      <circle r="2.6" fill="${o.color}" filter="url(#nodeGlow)">
        <animateMotion dur="${o.dur}s" repeatCount="indefinite"
          path="M ${CX} ${CY - o.r} A ${o.r} ${o.r} 0 1 1 ${CX - 0.01} ${CY - o.r}" />
      </circle>`).join("");

    const sectorLabel = (deg, r, text, color) => {
      const [x, y] = pos(deg, r);
      return `<text x="${x}" y="${y}" text-anchor="middle" fill="${color}" font-size="14" font-weight="800" letter-spacing="5" font-family="Archivo, sans-serif" filter="url(#textGlow)">${text}</text>`;
    };
    const labels =
      sectorLabel(270, R1 + 46, "NIGHTLIFE", C.loungeGlow) +
      sectorLabel(68, R1 + 44, "CONCERTS", C.concertsGlow) +
      sectorLabel(157, R1 + 44, "SPORTS", C.sportsGlow);

    const sweep = reduceMotion ? "" : `
      <path d="M ${CX} ${CY} L ${pos(0, R1)} A ${R1} ${R1} 0 0 1 ${pos(40, R1)} Z" fill="url(#sweepGrad)" opacity="0.8">
        <animateTransform attributeName="transform" type="rotate" from="0 ${CX} ${CY}" to="360 ${CX} ${CY}" dur="9s" repeatCount="indefinite" />
      </path>
      <line x1="${CX}" y1="${CY}" x2="${pos(40, R1)[0]}" y2="${pos(40, R1)[1]}" stroke="${C.ringBright}" stroke-width="1.5" opacity="0.7">
        <animateTransform attributeName="transform" type="rotate" from="0 ${CX} ${CY}" to="360 ${CX} ${CY}" dur="9s" repeatCount="indefinite" />
      </line>`;

    const nodeMarkup = nodes.map((n, i) => {
      const [x, y] = pos(n.angle, n.r);
      const color = C[n.kind];
      const when = n.day === 0 ? "tonight" : n.day === 1 ? "tomorrow" : `in ${n.day} nights`;

      if (n.district) {
        const r = 7 + Math.min(n.count, 6);
        const tip = `<strong>${esc(n.district.label)}</strong><br><strong>${n.count}</strong> room${n.count === 1 ? "" : "s"} open ${esc(when)} · ${n.total} total<br>click for this neighbourhood`;
        const ping = reduceMotion ? "" : `
          <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0">
            <animate attributeName="r" values="${r};${r + 18}" dur="3s" begin="${i * 0.3}s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0" dur="3s" begin="${i * 0.3}s" repeatCount="indefinite" />
          </circle>`;
        return `<line x1="${CX}" y1="${CY}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="1" opacity="0.28" pointer-events="none" />${ping}
          <circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="${C.surface}" stroke-width="2.5" filter="url(#nodeGlow)" pointer-events="none" />
          <text x="${x}" y="${y + 4}" text-anchor="middle" fill="${C.surface}" font-size="11" font-weight="800" font-family="Archivo, sans-serif" pointer-events="none">${n.count}</text>
          <text x="${x}" y="${y + r + 15}" text-anchor="middle" fill="${C.inkLabel}" font-size="10" letter-spacing="1.2" font-family="JetBrains Mono, monospace" paint-order="stroke" stroke="${C.surface}" stroke-width="3" pointer-events="none">${esc(n.district.label)}</text>
          <circle cx="${x}" cy="${y}" r="${r + 8}" fill="transparent" style="cursor:pointer" data-hood-jump="${esc(n.district.key)}" data-tip="${esc(tip)}" />`;
      }

      const it = n.item;
      const tip = `<strong>${esc(it.title)}</strong><br>${esc(fmtDate(it.date))} (${esc(when)}) · ${esc(it.venue)}<br>est. from <strong>$${it.price}</strong> · click to open`;
      const ping = reduceMotion ? "" : `
        <circle cx="${x}" cy="${y}" r="6" fill="none" stroke="${color}" stroke-width="1.5" opacity="0" pointer-events="none">
          <animate attributeName="r" values="6;22" dur="3s" begin="${(i % 6) * 0.5}s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.7;0" dur="3s" begin="${(i % 6) * 0.5}s" repeatCount="indefinite" />
        </circle>`;
      const link = `<line x1="${CX}" y1="${CY}" x2="${x}" y2="${y}" stroke="${color}" stroke-width="1" opacity="0.28" pointer-events="none" />`;
      const cheapTag = cheapest === n
        ? `<text x="${x}" y="${y + 24}" text-anchor="middle" fill="${C.inkStrong}" font-size="11" font-weight="700" font-family="JetBrains Mono, monospace">$${it.price} · CHEAPEST</text>` : "";
      return `${link}${ping}${cheapTag}
        <circle cx="${x}" cy="${y}" r="6.5" fill="${color}" stroke="${C.surface}" stroke-width="2" filter="url(#nodeGlow)" pointer-events="none" />
        <circle cx="${x}" cy="${y}" r="14" fill="transparent" style="cursor:pointer" data-open="${esc(it.id)}" data-tip="${esc(tip)}" />`;
    }).join("");

    const hubPulse = reduceMotion ? "" : `
      <circle cx="${CX}" cy="${CY}" r="10" fill="none" stroke="${C.sportsGlow}" stroke-width="1.5" opacity="0">
        <animate attributeName="r" values="10;44" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0" dur="2.6s" repeatCount="indefinite" />
      </circle>`;
    const hubSpin = reduceMotion ? "" : `
      <circle cx="${CX}" cy="${CY}" r="42" fill="none" stroke="${C.ringBright}" stroke-width="1.2" stroke-dasharray="10 16" stroke-linecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 ${CX} ${CY}" to="-360 ${CX} ${CY}" dur="24s" repeatCount="indefinite" />
      </circle>`;
    const dateStr = `${String(tm).padStart(2, "0")}/${String(td).padStart(2, "0")}`;
    const hub = `
      ${hubPulse}${hubSpin}
      <circle cx="${CX}" cy="${CY}" r="34" fill="${C.surface}" stroke="${C.ringBright}" stroke-width="1.5" />
      <line x1="${CX - 12}" y1="${CY}" x2="${CX - 4}" y2="${CY}" stroke="${C.ringBright}" stroke-width="1" />
      <line x1="${CX + 4}" y1="${CY}" x2="${CX + 12}" y2="${CY}" stroke="${C.ringBright}" stroke-width="1" />
      <line x1="${CX}" y1="${CY - 12}" x2="${CX}" y2="${CY - 4}" stroke="${C.ringBright}" stroke-width="1" />
      <line x1="${CX}" y1="${CY + 4}" x2="${CX}" y2="${CY + 12}" stroke="${C.ringBright}" stroke-width="1" />
      <circle cx="${CX}" cy="${CY}" r="4.5" fill="${C.inkStrong}" filter="url(#nodeGlow)" />
      <text x="${CX}" y="${CY + 22}" text-anchor="middle" fill="${C.inkLabel}" font-size="10" letter-spacing="2" font-family="JetBrains Mono, monospace">NOW</text>
      <text x="${CX}" y="${CY - 46}" text-anchor="middle" fill="${C.inkLabel}" font-size="11.5" font-family="JetBrains Mono, monospace">${todayDayName().toUpperCase()} ${dateStr}</text>`;

    const readout = `
      <text x="20" y="${H - 18}" fill="${C.inkLabel}" font-size="11" letter-spacing="1.5" font-family="JetBrains Mono, monospace">NODES:${nodes.length} // WINDOW:14N // SYNC:OK</text>
      <text x="${W - 20}" y="${H - 18}" text-anchor="end" fill="${C.inkFaint}" font-size="11" letter-spacing="1.5" font-family="JetBrains Mono, monospace">6IXNIGHTS.SYS</text>`;

    el.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img"
           aria-label="Radar view of the next 14 nights: shows and games placed by how soon they happen, plus a node per nightlife district. Each node is clickable.">
        <defs>
          <filter id="nodeGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="textGlow" x="-40%" y="-60%" width="180%" height="220%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="${C.sportsGlow}" stop-opacity="0" />
            <stop offset="100%" stop-color="${C.sportsGlow}" stop-opacity="0.16" />
          </linearGradient>
          <radialGradient id="netBg" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stop-color="rgba(141,107,243,0.10)" />
            <stop offset="55%" stop-color="rgba(141,107,243,0.03)" />
            <stop offset="100%" stop-color="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
        <circle cx="${CX}" cy="${CY}" r="${R1 + 30}" fill="url(#netBg)" />
        ${sweep}${rings}${ticks}${sectorArcs}${spokes}${orbiters}${labels}${nodeMarkup}${hub}${readout}
      </svg>`;

    document.getElementById("timelineLegend").innerHTML = `
      <span class="legend-item"><span class="legend-dot" style="background:${C.sports}"></span>Sports</span>
      <span class="legend-item"><span class="legend-dot" style="background:${C.concerts}"></span>Concerts</span>
      <span class="legend-item"><span class="legend-dot" style="background:${C.lounge}"></span>Venues</span>`;

    bindTips(el);
  }

  /* ---------- tonight ---------- */

  function renderTonight(S) {
    if (!document.getElementById("tonightList")) return;
    const { state, esc, todayISO, fmtDate } = S;
    const el = document.getElementById("tonightList");
    const card = document.getElementById("todayCard");
    const today = todayISO();

    // Venues live on the map now; this card is only for what's dated today.
    const events = state.data.sports.concat(state.data.concerts).filter((e) => e.date === today);
    if (card) card.classList.toggle("hidden", events.length === 0);
    if (!events.length) { el.innerHTML = ""; return; }

    el.innerHTML = events.map((e) => `
      <div class="tonight-row clickable" data-open="${esc(e.id)}" role="button" tabindex="0">
        <span class="tonight-dot" style="background:${e.team ? C.sports : C.concerts}"></span>
        <span class="tonight-name">${esc(e.title)} <span class="tonight-sub">${esc(e.venue)}</span></span>
        <span class="tonight-meta">from $${e.price}</span>
      </div>`).join("");
  }

  function renderMapList(S) {
    const { state, esc, MUSIC_LABELS, todayDayName } = S;
    const el = document.getElementById("mapViz");
    const DAY_SEQ = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const FULL_DAY = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
                       Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
    const night = DAY_SEQ.includes(state.day) ? state.day : todayDayName();
    const isTonight = night === todayDayName();

    const ZONES = [
      { key: "kingwest", label: "King West" },
      { key: "ossington", label: "Ossington / Dundas W" },
      { key: "queenwest", label: "Queen West" },
      { key: "ent", label: "Entertainment District" },
      { key: "yorkville", label: "Yorkville" },
    ];
    const genreOf = (v) => (v.music || []).slice(0, 2).map((m) => MUSIC_LABELS[m] || m).join(", ");
    const coverOf = (v) => (v.coverMin === 0 ? "No cover" : "$" + v.coverMin + "+");

    let openTotal = 0, freeTotal = 0;
    const zones = ZONES.map((z) => {
      const list = state.data.nightlife.filter((v) => v.hood === z.key);
      const open = list.filter((v) => v.nights.includes(night));
      const shut = list.filter((v) => !v.nights.includes(night));
      openTotal += open.length;
      freeTotal += open.filter((v) => v.coverMin === 0).length;
      const row = (v, isOpen) => `
        <button class="zone-venue ${isOpen ? "is-open" : "is-shut"}" data-open="${esc(v.id)}">
          <span class="zv-dot vibe-${esc(v.vibe)}"></span>
          <span class="zv-name">${esc(v.name)}</span>
          <span class="zv-meta">${isOpen ? esc(genreOf(v)) + " · " + esc(coverOf(v)) : "Closed"}</span>
        </button>`;
      return `
        <section class="zone-card">
          <header class="zone-head">
            <h4 class="zone-name">${esc(z.label)}</h4>
            <span class="zone-count ${open.length ? "" : "zero"}">${open.length} open</span>
          </header>
          <div class="zone-venues">${open.map((v) => row(v, true)).join("")}${shut.map((v) => row(v, false)).join("")}</div>
        </section>`;
    }).join("");

    el.innerHTML = `
      <p class="map-summary">
        <strong>${openTotal} rooms open ${isTonight ? "tonight" : FULL_DAY[night]}</strong>
        <span>${freeTotal} with no cover · tap a room for details</span>
      </p>
      <div class="zone-list">${zones}</div>`;

    const legend = document.getElementById("mapLegend");
    if (legend) legend.innerHTML = "";
  }

  /* ---------- CITY MAP: the spatial view, calmed down ----------
     Middle ground. Keeps what made the map worth looking at — districts in
     their real relative positions, venues as pins you can see at a glance —
     and drops what made it hard to read: crawl routes, travelling particles,
     dot grid, spinning collars, tick dials, dashed strokes, and per-pin
     genre/cover text. Each pin carries a name; the detail lives in the
     tooltip and the modal, one hop away. */

  function renderMap(S) {
    if (!document.getElementById("mapViz")) return;
    const { state, esc, VIBE_LABELS, MUSIC_LABELS, todayDayName } = S;
    const el = document.getElementById("mapViz");
    // A 1000px-wide diagram scaled to a 360px phone renders 12px labels at ~4px.
    // Narrow screens get the same data as a legible grouped list instead.
    if (window.innerWidth < 760) return renderMapList(S);

    const DAY_SEQ = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const FULL_DAY = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
                       Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
    const night = DAY_SEQ.includes(state.day) ? state.day : todayDayName();
    const isTonight = night === todayDayName();

    const W = 1000, H = 620;
    const pos = (deg, r, cx, cy) => {
      const a = (deg * Math.PI) / 180;
      return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
    };

    const DISTRICTS = [
      { key: "yorkville", label: "YORKVILLE", x: 796, y: 112, start: 30 },
      { key: "ossington", label: "OSSINGTON / DUNDAS W", x: 206, y: 292, start: 200 },
      { key: "queenwest", label: "QUEEN WEST", x: 452, y: 186, start: 150 },
      { key: "kingwest", label: "KING WEST", x: 462, y: 452, start: 96 },
      { key: "ent", label: "ENT. DISTRICT", x: 840, y: 392, start: 165 },
    ];
    const hubOf = {};
    DISTRICTS.forEach((d) => { hubOf[d.key] = d; });

    // Streets: solid, quiet, and labelled — context, not decoration
    const CORRIDORS = [
      { a: "ossington", b: "queenwest", label: "" },
      { a: "queenwest", b: "kingwest", label: "" },
      { a: "kingwest", b: "ent", label: "KING ST W" },
      { a: "queenwest", b: "yorkville", label: "AVENUE RD" },
    ];
    const corridorMarkup = CORRIDORS.map((c) => {
      const A = hubOf[c.a], B = hubOf[c.b];
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const ang = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
      const flip = ang > 90 || ang < -90;
      const label = c.label ? `
        <text x="${mx}" y="${my - 8}" text-anchor="middle" fill="${C.inkFaint}" font-size="10.5"
              letter-spacing="1.5" font-family="JetBrains Mono, monospace"
              transform="rotate(${flip ? ang + 180 : ang} ${mx} ${my})"
              paint-order="stroke" stroke="${C.surface}" stroke-width="3">${esc(c.label)}</text>` : "";
      return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="${C.street}"
                 stroke-width="1.4" opacity="0.5" />${label}`;
    }).join("");

    const nodes = [];
    DISTRICTS.forEach((d) => {
      const list = state.data.nightlife.filter((v) => v.hood === d.key);
      d.total = list.length;
      d.open = list.filter((v) => v.nights.includes(night)).length;
      d.ringR = list.length <= 1 ? 64 : 58 + list.length * 8;
      list.forEach((v, i) => {
        const angle = d.start + (i * 360) / list.length;
        const [x, y] = pos(angle, d.ringR, d.x, d.y);
        nodes.push({ v, x, y, angle, hub: d, open: v.nights.includes(night) });
      });
    });

    // one soft solid ring per district — grouping, not chartjunk
    const ringMarkup = DISTRICTS.filter((d) => d.total > 1).map((d) => `
      <circle cx="${d.x}" cy="${d.y}" r="${d.ringR}" fill="none" stroke="${C.ring}"
              stroke-width="1" opacity="0.45" />`).join("");

    const spokes = nodes.map((n) => `
      <line x1="${n.hub.x}" y1="${n.hub.y}" x2="${n.x}" y2="${n.y}" stroke="${C[n.v.vibe]}"
            stroke-width="1" opacity="${n.open ? 0.3 : 0.12}" />`).join("");

    const hubMarkup = DISTRICTS.map((d) => `
      <circle cx="${d.x}" cy="${d.y}" r="25" fill="${C.surface}"
              stroke="${d.open ? C.loungeGlow : C.ring}" stroke-width="1.6" />
      <text x="${d.x}" y="${d.y + 3}" text-anchor="middle" fill="${d.open ? C.inkStrong : C.inkFaint}"
            font-size="17" font-weight="800" font-family="Archivo, sans-serif">${d.open}</text>
      <text x="${d.x}" y="${d.y + 15}" text-anchor="middle" fill="${C.inkFaint}" font-size="8"
            letter-spacing="0.8" font-family="JetBrains Mono, monospace">OPEN</text>
      <text x="${d.x}" y="${d.y - 40}" text-anchor="middle" fill="${C.sportsGlow}" font-size="12"
            font-weight="800" letter-spacing="2.5" font-family="Archivo, sans-serif">${esc(d.label)}</text>`).join("");

    const genreOf = (v) => (v.music || []).slice(0, 2).map((m) => MUSIC_LABELS[m] || m).join(", ");

    const nodeMarkup = nodes.map(({ v, x, y, angle, open }) => {
      const color = C[v.vibe];
      const tip = `<strong>${esc(v.name)}</strong><br>${esc(VIBE_LABELS[v.vibe] || v.vibe)} · ${esc(genreOf(v))}<br>${esc(v.cover)}<br>${open ? `<strong>Open ${esc(night)}</strong>` : `Closed ${esc(night)} — goes ${esc(v.nights.join(", "))}`}`;

      let anchor = Math.sin((angle * Math.PI) / 180) >= 0 ? "start" : "end";
      let lx = x + (anchor === "start" ? 14 : -14);
      if (anchor === "end" && lx < 120) { anchor = "start"; lx = x + 14; }
      if (anchor === "start" && lx > W - 120) { anchor = "end"; lx = x - 14; }

      return `
        <circle cx="${x}" cy="${y}" r="${open ? 8 : 5.5}" fill="${color}" stroke="${C.surface}"
                stroke-width="2.5" opacity="${open ? 1 : 0.42}"
                ${open ? 'filter="url(#pinGlow)"' : ""} pointer-events="none" />
        <text x="${lx}" y="${y + 4}" text-anchor="${anchor}" fill="${open ? C.inkStrong : C.inkFaint}"
              font-size="${open ? 12 : 11}" font-weight="${open ? 700 : 600}"
              font-family="Archivo, sans-serif" paint-order="stroke" stroke="${C.surface}"
              stroke-width="3.5" opacity="${open ? 1 : 0.7}" pointer-events="none">${esc(v.name)}</text>
        <circle cx="${x}" cy="${y}" r="15" fill="transparent" style="cursor:pointer"
                data-open="${esc(v.id)}" data-tip="${esc(tip)}" />`;
    }).join("");

    const openTotal = nodes.filter((n) => n.open).length;
    const freeTotal = nodes.filter((n) => n.open && n.v.coverMin === 0).length;

    el.innerHTML = `
      <p class="map-summary">
        <strong>${openTotal} rooms open ${isTonight ? "tonight" : FULL_DAY[night]}</strong>
        <span>${freeTotal} with no cover · tap a pin for details</span>
      </p>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img"
           aria-label="Map of Toronto nightlife districts for ${esc(night)}: ${openTotal} rooms open. Each pin is a venue and opens its details.">
        <defs>
          <filter id="pinGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="lakeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(63,214,200,0)" />
            <stop offset="100%" stop-color="rgba(63,214,200,0.13)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${W}" height="${H}" rx="14" fill="#12121c" />
        <rect x="0" y="${H - 44}" width="${W}" height="44" fill="url(#lakeGrad)" />
        <text x="${W / 2}" y="${H - 16}" text-anchor="middle" fill="${C.loungeGlow}" opacity="0.6"
              font-size="10.5" letter-spacing="5" font-family="JetBrains Mono, monospace">LAKE ONTARIO</text>
        ${corridorMarkup}${ringMarkup}${spokes}${nodeMarkup}${hubMarkup}
      </svg>`;

    bindTips(el);

    const legend = document.getElementById("mapLegend");
    if (legend) {
      legend.innerHTML = ["club", "barclub", "lounge"]
        .map((k) => `<span class="legend-item"><span class="legend-dot" style="background:${C[k]}"></span>${VIBE_LABELS[k]}</span>`)
        .join("") + `<span class="legend-item"><span class="legend-dot legend-dim"></span>Closed ${esc(night)}</span>`;
    }
  }


  /* ---------- sports: the side quest ----------
     Deliberately compact — a single scannable strip, not a headline panel. */

  function renderSportsStrip(S) {
    if (!document.getElementById("sportsStrip")) return;
    const { state, esc, fmtDate, dayOf, WEEKDAYS } = S;
    const today = S.todayISO();
    const next = state.data.sports
      .filter((e) => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);

    document.getElementById("sportsStrip").innerHTML = next.length
      ? next.map((e) => `
          <div class="quest-chip clickable" data-open="${esc(e.id)}" role="button" tabindex="0"
               data-tip="${esc(`<strong>${e.title}</strong><br>${fmtDate(e.date)} · ${e.venue}<br>est. from <strong>$${e.price}</strong>`)}">
            <span class="quest-date">${esc(fmtDate(e.date))}${WEEKDAYS.includes(dayOf(e.date)) ? " ·" : ""}</span>
            <span class="quest-title">${esc(e.title)}</span>
            <span class="quest-price">$${e.price}</span>
          </div>`).join("")
      : `<p class="empty-note">No games on the board right now.</p>`;

    bindTips(document.getElementById("sportsStrip"));
  }

  /* ---------- boot ---------- */

  function renderAllViz() {
    const S = window.SIX;
    if (!S || !S.state.data) return;
    // Each panel renders independently — one failure must never blank the rest
    [renderStats, renderMap, renderTonight, renderPulseNet, renderSportsStrip].forEach((fn) => {
      try { fn(S); } catch (err) { console.error("viz panel failed:", fn.name, err); }
    });
  }

  document.addEventListener("six:data", renderAllViz);
  document.addEventListener("six:render", renderAllViz);

  let resizeTimer = null;
  let wasNarrow = window.innerWidth < 760;
  window.addEventListener("resize", () => {
    const nowNarrow = window.innerWidth < 760;
    if (nowNarrow === wasNarrow) return;   // only swap when we cross the breakpoint
    wasNarrow = nowNarrow;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderAllViz, 150);
  });
  renderAllViz(); // in case data beat us to it
})();
