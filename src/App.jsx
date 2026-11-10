import React, { useState, useMemo, useEffect, useRef } from "react";

// ═══════════════ THEME (edit these to restyle the app) ═══════════
// Player detail header color:
//   "team"   -> uses the player's CURRENT team color
//   any hex  -> one fixed color for everyone, e.g. "#1e293b"
const HEADER_COLOR = "team";

// Season used for team payroll totals (must match your Season select format)
const CURRENT_SEASON = "2026-2027"; // league year — bump every July

// Salary bar colors by year type - change any hex you like.
const BAR_COLORS = {
  G: "#2563eb",    // guaranteed        (blue)
  PO: "#22c55e",   // player option     (green)
  TO: "#dc2626",   // team option       (red)
  NG: "#cbd5e1",   // non-guaranteed    (slate)
  PG: "#d2b48c",   // partially gtd     (tan)
  UFA: "#e2e8f0",  // free agent stub
  RFA: "#fecdd3",  // restricted stub
};
// Accent for the Total tile + featured contract border.
const ACCENT_TEXT = "text-emerald-600";
const ACCENT_BORDER = "border-2 border-emerald-500";

const TEAM_COLORS = {
  NY: "#1D428A", DAL: "#00538C", ATL: "#C8102E", OKC: "#007AC1",
  MIN: "#0C2340", DEN: "#0E2240", IND: "#002D62", BOS: "#007A33",
  PHI: "#006BB6", LAL: "#552583", GSW: "#1D428A", GS: "#1D428A",
  MIA: "#98002E", MIL: "#00471B", CHI: "#CE1141", CLE: "#860038",
  TOR: "#CE1141", BKN: "#000000", WSH: "#E31837", ORL: "#0077C0",
  CHA: "#00788C", DET: "#1D42BA", HOU: "#CE1141", SAS: "#000000",
  MEM: "#5D76A9", NOP: "#0C2340", PHX: "#E56020", SAC: "#5A2D81",
  POR: "#E03A3E", UTA: "#002B5C", UTAH: "#002B5C", LAC: "#C8102E",
  SA: "#000000", NO: "#0C2340", // ESPN spellings
};
// Secondary color per team (free-throw circle, and the center circle for
// teams whose logo is the same color as their primary).
const TEAM_COLORS2 = {
  NY: "#F58426", DAL: "#B8C4CA", ATL: "#FDB927", OKC: "#EF6024",
  MIN: "#236192", DEN: "#FEC524", IND: "#FDBB30", BOS: "#BA9653",
  PHI: "#ED174C", LAL: "#FDB927", GSW: "#FDB927", GS: "#FDB927",
  MIA: "#F9A01B", MIL: "#EEE1C6", CHI: "#000000", CLE: "#FDBB30",
  TOR: "#000000", BKN: "#FFFFFF", WSH: "#002B5C", ORL: "#C4CED4",
  CHA: "#1D1160", DET: "#C8102E", HOU: "#000000", SAS: "#C4CED4",
  MEM: "#12173F", NOP: "#C8102E", PHX: "#1D1160", SAC: "#63727A",
  POR: "#000000", UTA: "#F9A01B", UTAH: "#F9A01B", LAC: "#1D428A",
  SA: "#C4CED4", NO: "#C8102E",
};
// Blend two hex colors for the team-card gradient
function mixHex(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(String(h).slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const m = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return "#" + m(r1, r2) + m(g1, g2) + m(b1, b2);
}
const teamColor2 = (abbr) => TEAM_COLORS2[String(abbr || "").toUpperCase()] || "#F59E0B";
// Border color for headline tiles: the secondary color, unless it's too light to
// show against a white card (Brooklyn, Spurs…) — then the primary.
const tileBorder = (abbr) => teamColor(abbr);
// Teams whose logo is mostly the primary color — the center circle uses the
// secondary color for them so the logo doesn't disappear into it.
const FLIP_CENTER = new Set(["HOU", "CHI", "MIA", "TOR", "ATL", "POR", "WSH", "IND", "NOP", "NO", "DAL", "ORL", "MEM", "CLE", "LAC", "DET", "MIN", "UTAH", "UTA", "BKN", "SAS", "SA"]);
const centerColor = (abbr) => (FLIP_CENTER.has(String(abbr || "").toUpperCase()) ? teamColor2(abbr) : teamColor(abbr));
// Per-team floor overrides for courts that don't follow the default scheme.
// Any key left out falls back to the default.
//   lines: 3-pt, key, hash marks, restricted area · ft: free-throw circle
//   half: half-court line · side: sideline/baseline · center: center-circle fill
//   centerStroke: center-circle outline · floorText: lettering along the sideline
//   circleR: center-circle radius in ft (default 4.5) · logoW: logo width as % of court
//   apron: out-of-bounds strip color · apronText: lettering color on it
//   ftLogos: small team logos either side of the free-throw line
//   floorText: sideline lettering, one entry per line {t, color}
const WOOD_LIGHTER = "repeating-linear-gradient(90deg,#ecc48c 0 6.5%,#e4ba80 6.5% 13%)";
const COURT_THEMES = {
  CHI: { lines: "#111111", ft: "#111111", half: "#111111", side: "#111111", center: "none", centerStroke: "none",
         logoW: 30, apron: "#111111", apronText: "#FFFFFF",
         floorText: [[{ t: "UNITED", color: "#111111" }], [{ t: "CENTER", color: "#111111" }]] },
  NY:  { lines: "#FFFFFF", ft: "#FFFFFF", half: "#FFFFFF", side: "#FFFFFF", center: "none", centerStroke: "none",
         threePt: "#1D428A", logoW: 30, apron: "#1D428A", apronText: "#FFFFFF",
         floorText: [[{ t: "MADISON SQUARE GARDEN", color: "#1D428A" }], [{ t: "CHASE", color: "#111111" }]] },
  ATL: { lines: "#FFFFFF", ft: "#FFFFFF", half: "#FFFFFF", side: "#FFFFFF", threePt: "#FFFFFF", center: "none", centerStroke: "#FFFFFF",
         circleR: 5, logoW: 30, apron: "#111111", apronText: "#FDB927",
         floorText: [[{ t: "State Farm", color: "#C8102E" }], [{ t: "ARENA", color: "#111111" }]] },
  BOS: { lines: "#FFFFFF", ft: "#FFFFFF", half: "#FFFFFF", side: "#FFFFFF", threePt: "#FFFFFF", center: "none", centerStroke: "none",
         logoW: 34, apron: "#007A33", apronText: "#FFFFFF", courtLogo: "https://cdn.nba.com/logos/nba/1610612738/global/L/logo.svg",
         floorText: [[{ t: "TD", color: "#FFFFFF", box: "#3FA35B" }, { t: "GARDEN", color: "#111111" }]] },
  MIA: { lines: "#111111", ft: "#111111", half: "#111111", side: "#111111", threePt: "#111111", center: "none", centerStroke: "none",
         paint: "#F9A01B", paintSides: "#98002E", logoW: 30, apron: "#111111", apronText: "#FFFFFF",
         floorText: [[{ t: "Kaseya", color: "#111111" }], [{ t: "Center", color: "#111111" }]] },
  BKN: { floor: "repeating-linear-gradient(90deg,#b9b3aa 0 6.5%,#aea79e 6.5% 13%)", paint: "#8f877d",
         lines: "#111111", ft: "#111111", half: "#111111", side: "#111111", threePt: "#111111", center: "none", centerStroke: "none",
         logoW: 30, apron: "#111111", apronText: "#FFFFFF",
         floorText: [[{ t: "BARCLAYS", color: "#0076B6" }], [{ t: "CENTER", color: "#0076B6" }]] },
  SAS: { lines: "#FFFFFF", ft: "#FFFFFF", half: "#FFFFFF", side: "#FFFFFF", threePt: "#111111", center: "none", centerStroke: "none",
         logoW: 30, floorText: [[{ t: "FrostBank", color: "#111111" }], [{ t: "CENTER", color: "#111111" }]] },
  LAL: { lines: "#FFFFFF", ft: "#FFFFFF", half: "#FFFFFF", side: "#FFFFFF", threePt: "#552583", center: "none", centerStroke: "none",
         logoW: 30, apron: "#FDB927", apronText: "#552583",
         floorText: [[{ t: "crypto.com", color: "#552583" }], [{ t: "ARENA", color: "#552583" }]] },
  CLE: { floor: WOOD_LIGHTER, lines: "#B8996F", ft: "#B8996F", threePt: "#6F263F", half: "#6F263F", side: "#6F263F", center: "none", centerStroke: "none",
         logoW: 30, apron: "#6F263F", apronText: "#B8996F",
         floorText: [[{ t: "Rocket Arena", color: "#6F263F" }]] },
  DAL: { floor: "repeating-linear-gradient(90deg,#c9c5be 0 6.5%,#bfbab2 6.5% 13%)", paint: "#002B5E",
         lines: "#FFFFFF", ft: "#FFFFFF", ftTop: "#00538C", threePt: "#00538C", half: "#00538C", side: "#FFFFFF", center: "none", centerStroke: "none",
         logoW: 28, apron: "#002B5E", apronText: "#FFFFFF", apronLine: "#FFFFFF",
         floorText: [{ parts: [{ t: "American", color: "#00538C" }], align: "start" },
                     { parts: [{ t: "Airlines", color: "#00538C" }], align: "start", indent: 2.2 },
                     { parts: [{ t: "Center", color: "#00538C" }], align: "start", indent: 4.4 }] },
  PHI: { lines: "#FFFFFF", ft: "#FFFFFF", threePt: "#FFFFFF", half: "#FFFFFF", side: "#FFFFFF", center: "none", centerStroke: "none",
         paint: "#003087", logoW: 28, apron: "#003087", apronText: "#FFFFFF", apronLine: "#ED174C", apronLabel: "Philadelphia 76ers", apronScript: true,
         floorText: [[{ t: "xfinity mobile", color: "#111111" }], [{ t: "ARENA", color: "#111111" }]] },
  GSW: { lines: "#1D428A", ft: "#1D428A", threePt: "#1D428A", half: "#1D428A", side: "#1D428A", center: "none", centerStroke: "none",
         logoW: 28, apron: "#FFC72C", apronText: "#1D428A",
         floorText: [[{ t: "CHASE CENTER", color: "#1D428A" }]] },
  HOU: { lines: "#111111", ft: "#111111", threePt: "#111111", half: "#111111", side: "#111111", center: "none", centerStroke: "none",
         logoW: 28, apronLine: "#111111",
         floorText: [{ parts: [{ t: "TOYOTA", color: "#111111" }], weight: 900 }, [{ t: "CENTER", color: "#111111" }]] },
  CHA: { lines: "#FFFFFF", ft: "#FFFFFF", threePt: "#FFFFFF", half: "#FFFFFF", side: "#FFFFFF", center: "none", centerStroke: "none",
         paint: "#00788C", logoW: 28, apron: "#00788C", apronText: "#FFFFFF", apronLine: "#FFFFFF",
         floorText: [{ parts: [{ t: "Spectrum", color: "#1D1160" }], size: 1.3 }, { parts: [{ t: "CENTER", color: "#1D1160" }], align: "end" }] },
  DEN: { lines: "#0E2240", ft: "#0E2240", threePt: "#0E2240", half: "#0E2240", side: "#0E2240", center: "none", centerStroke: "none",
         paint: "none", logoW: 30, fs: 2.2,
         floorText: [{ parts: [{ t: "Ball", color: "#0E2240" }], script: true, size: 1.4 }, { parts: [{ t: "Arena", color: "#0E2240" }], size: 0.7 }] },
  DET: { lines: "#1D42BA", ft: "#1D42BA", threePt: "#1D42BA", half: "#1D42BA", side: "#1D42BA", center: "none", centerStroke: "none",
         paint: "none", logoW: 28, apron: "#1D42BA", apronText: "#FFFFFF", fs: 2.3, textTop: 1.6,
         floorText: [{ parts: [{ t: "Platinum Equity", color: "#111111" }], script: true }] },
  IND: { lines: "#FFFFFF", ft: "#FFFFFF", threePt: "#FFFFFF", half: "#FFFFFF", side: "#FFFFFF", center: "none", centerStroke: "none",
         paint: "#002D62", logoW: 28, apron: "#002D62", apronText: "#FFFFFF", apronLine: "#FFFFFF",
         floorText: [{ parts: [{ t: "GAINBRIDGE", color: "#111111" }], size: 1.3, weight: 900 }, { parts: [{ t: "FIELDHOUSE", color: "#111111" }], weight: 500 }] },
  LAC: { lines: "#FFFFFF", ft: "#FFFFFF", ftTop: "#C8102E", threePt: "#FFFFFF", half: "#FFFFFF", side: "#FFFFFF", center: "none", centerStroke: "none",
         paint: "#0C2340", logoW: 28, logoRing: "#C8102E", apron: "#0C2340", apronText: "#FFFFFF",
         floorText: [[{ t: "inTUIT", color: "#111111" }], [{ t: "DoMe", color: "#111111" }]] },
  MEM: { floor: WOOD_LIGHTER, lines: "#12173F", ft: "#12173F", threePt: "#12173F", half: "#12173F", side: "#12173F", center: "none", centerStroke: "none",
         paint: "#5D76A9", logoW: 28, apron: "none", apronText: "#12173F", apronLine: "#12173F", tight: true,
         floorText: [[{ t: "Fed", color: "#111111", weight: 900 }, { t: "Ex", color: "none", outline: "#111111", weight: 900 }, { t: "Forum", color: "#111111", weight: 900 }]] },
  MIL: { lines: "#FFFFFF", ft: "#FFFFFF", threePt: "#FFFFFF", half: "#FFFFFF", side: "#FFFFFF", center: "none", centerStroke: "none",
         logoW: 28,
         floorText: [[{ t: "fiserv", color: "#111111", weight: 1000 }, { t: "forum", color: "#111111", weight: 600 }]] },
  MIN: { lines: "#FFFFFF", ft: "#FFFFFF", ftTopFill: "#9EA2A2", ftBottomFill: "#111111", threePt: "#0C2340", half: "#0C2340", side: "#FFFFFF", center: "none", centerStroke: "none",
         paint: "#1B4E77", logoW: 30, apron: "#111111", apronText: "#FFFFFF", apronLine: "#FFFFFF", fs: 1.7,
         floorText: [[{ t: "TARGET CENTER", color: "#FFFFFF" }]] },
  OKC: { lines: "#FFFFFF", ft: "#FFFFFF", threePt: "#FFFFFF", half: "#FFFFFF", side: "#FFFFFF", center: "none", centerStroke: "none",
         logoW: 32, apron: "#007AC1", apronText: "#FFFFFF",
         floorText: [{ parts: [{ t: "paycom", color: "#00843D" }], weight: 900 }, [{ t: "center", color: "#111111" }]] },
  ORL: { lines: "#111111", ft: "#111111", threePt: "#111111", half: "#111111", side: "none", center: "none", centerStroke: "none",
         paint: "#0B3FA8", logoW: 28, apron: "#0B3FA8", apronText: "#FFFFFF",
         floorText: [{ parts: [{ t: "KIA", color: "#111111" }], size: 1.5, weight: 900 }, [{ t: "CENTER", color: "#111111" }]] },
  PHX: { lines: "#E56020", ft: "#E56020", threePt: "#111111", half: "#E56020", side: "#E56020", restricted: "#FFFFFF", center: "none", centerStroke: "none",
         logoW: 32, apron: "#111111", apronText: "#FFFFFF", apronLine: "#E56020", fs: 1.6,
         floorText: [{ parts: [{ t: "mortgage", color: "#111111" }], size: 1.3 }, [{ t: "matchup", color: "#111111" }], { parts: [{ t: "center", color: "#111111" }], size: 0.82 }] },
  POR: { lines: "#111111", ft: "#111111", threePt: "#111111", half: "#FFFFFF", side: "#FFFFFF", restricted: "#FFFFFF", center: "none", centerStroke: "none",
         paint: "#B32026", logoW: 30, apron: "#B32026", apronText: "#FFFFFF", apronLine: "#FFFFFF", fs: 2.1,
         floorText: [{ parts: [{ t: "moda", color: "#111111" }], size: 1.35 }, { parts: [{ t: "center", color: "#111111" }], size: 0.8 }] },
  SAC: { lines: "#FFFFFF", ft: "#FFFFFF", threePt: "#FFFFFF", half: "#FFFFFF", side: "#FFFFFF", ftBottomFill: "#111111", center: "none", centerStroke: "none",
         paint: "#5A2D81", logoW: 28, apron: "#111111", apronText: "#FFFFFF", fs: 1.75,
         floorText: [[{ t: "Golden 1", color: "#FDB927", weight: 900 }, { t: "Center", color: "#111111", weight: 900 }], { parts: [{ t: "Credit Union", color: "#111111" }], size: 0.7 }] },
  TOR: { lines: "#111111", ft: "#111111", threePt: "#111111", half: "#111111", side: "#111111", center: "none", centerStroke: "none",
         logoW: 28, apron: "#CE1141", apronText: "#FFFFFF", apronLabel: "TORONTO RAPTORS", apronTextAlt: "#111111", fs: 2.2,
         floorText: [[{ t: "Scotia", color: "#CE1141", weight: 900 }], [{ t: "Arena", color: "#CE1141", weight: 900 }]] },
  WSH: { lines: "#FFFFFF", ft: "#FFFFFF", threePt: "#FFFFFF", half: "#FFFFFF", side: "#FFFFFF", center: "none", centerStroke: "none",
         paint: "#002B5C", logoW: 28, apron: "#002B5C", apronText: "#FFFFFF",
         floorText: [[{ t: "Capital One", color: "#002B5C" }], { parts: [{ t: "Arena", color: "#002B5C" }], align: "end" }] },
  UTAH:{ lines: "#7BAFD4", ft: "#7BAFD4", threePt: "#7BAFD4", half: "#7BAFD4", side: "#FFFFFF", center: "none", centerStroke: "none",
         paint: "#4B2A85", logoW: 28, apron: "#4B2A85", apronText: "#FFFFFF",
         floorText: [[{ t: "DELTA CENTER", color: "#0C2340" }]] },
};
COURT_THEMES.SA = COURT_THEMES.SAS;
COURT_THEMES.GS = COURT_THEMES.GSW;
COURT_THEMES.UTA = COURT_THEMES.UTAH;
const courtTheme = (abbr) => COURT_THEMES[String(abbr || "").toUpperCase()] || {};

// Full team names -> abbreviations, so a player's current team
// (which may be stored as "New York Knicks") maps to its color.
const NAME_TO_ABBR = {
  "atlanta hawks": "ATL", "boston celtics": "BOS", "brooklyn nets": "BKN",
  "charlotte hornets": "CHA", "chicago bulls": "CHI", "cleveland cavaliers": "CLE",
  "dallas mavericks": "DAL", "denver nuggets": "DEN", "detroit pistons": "DET",
  "golden state warriors": "GS", "houston rockets": "HOU", "indiana pacers": "IND",
  "los angeles clippers": "LAC", "la clippers": "LAC", "los angeles lakers": "LAL",
  "memphis grizzlies": "MEM", "miami heat": "MIA", "milwaukee bucks": "MIL",
  "minnesota timberwolves": "MIN", "new orleans pelicans": "NOP",
  "new york knicks": "NY", "oklahoma city thunder": "OKC", "orlando magic": "ORL",
  "philadelphia 76ers": "PHI", "phoenix suns": "PHX", "portland trail blazers": "POR",
  "sacramento kings": "SAC", "san antonio spurs": "SAS", "toronto raptors": "TOR",
  "utah jazz": "UTAH", "washington wizards": "WSH",
};

function toAbbr(team) {
  if (!team) return "";
  const t = String(team).trim();
  if (TEAM_COLORS[t.toUpperCase()]) return t.toUpperCase();
  return NAME_TO_ABBR[t.toLowerCase()] || "";
}
// Franchises that moved or renamed: draft-team codes map to today's logo and colors
const HIST_ABBR = { VAN: "MEM", NJ: "BKN", NJN: "BKN", SEA: "OKC", NOH: "NOP", NOK: "NOP", CHH: "CHA", WSB: "WSH", KCK: "SAC", SDC: "LAC", BUF: "LAC", SAN: "SAS", NOJ: "UTAH" };
const modernAbbr = (abbr) => { const u = String(abbr || "").toUpperCase(); return HIST_ABBR[u] || u; };
// Same team, different spellings (ESPN vs Airtable vs Basketball-Reference)
const ABBR_VARIANTS = { BKN: ["BKN", "BRK", "NJN", "NJ"], GSW: ["GSW", "GS"], NOP: ["NOP", "NO", "NOH", "NOK"], SAS: ["SAS", "SA"], UTAH: ["UTAH", "UTA"], WSH: ["WSH", "WAS"], PHX: ["PHX", "PHO"], NY: ["NY", "NYK"], CHA: ["CHA", "CHO", "CHH"], MEM: ["MEM", "VAN"], OKC: ["OKC", "SEA"], LAC: ["LAC", "SDC"], SAC: ["SAC", "KCK"] };
// Same franchise under any spelling (SA/SAS, NO/NOP, GS/GSW, NY/NYK, UTA/UTAH, WAS/WSH, PHO/PHX, BRK/BKN…)
function sameAbbr(a, b) {
  const A = modernAbbr(a), B = modernAbbr(b);
  if (A === B) return true;
  const canon = (x) => Object.entries(ABBR_VARIANTS).find(([k, v]) => k === x || v.includes(x))?.[0] || x;
  return canon(A) === canon(B);
}
function logoFor(abbr) {
  const m = modernAbbr(abbr);
  const tries = [String(abbr || "").toUpperCase(), m, ...(ABBR_VARIANTS[m] || []), ...Object.entries(ABBR_VARIANTS).filter(([, v]) => v.includes(m)).flatMap(([k, v]) => [k, ...v])];
  for (const t of tries) if (TEAM_LOGOS[t]) return TEAM_LOGOS[t];
  return null;
}
const teamColor = (abbr) => TEAM_COLORS[modernAbbr(abbr)] || "#334155";
// Per-team logo trims. Orlando's artwork carries a heavy black ring; clip to
// the inner circle so only the ball shows. Spread onto any logo <img>.
const LOGO_TRIM = { ORL: { clipPath: "circle(38% at 50% 50%)", transform: "scale(1.3)" } };
const logoTrim = (abbr) => LOGO_TRIM[String(abbr || "").toUpperCase()] || {};
// Logos drawn on top of their own team color: Houston's red mark vanishes on
// red, so it renders white there. Everything else is unchanged.
const ON_OWN_COLOR_WHITE = new Set(["HOU"]);
const logoOnColor = (abbr) => ({ ...logoTrim(abbr), ...(ON_OWN_COLOR_WHITE.has(String(abbr || "").toUpperCase()) ? { filter: "brightness(0) invert(1) drop-shadow(0 2px 4px rgba(0,0,0,0.4))" } : {}) });
// Current-team color first; falls back to the contract team if no current team.
function playerHeaderColor(p) {
  if (HEADER_COLOR !== "team") return HEADER_COLOR;
  const current = toAbbr(p.teamName);
  if (current) return teamColor(current);
  const act = activeOf(p);
  return teamColor(act?.team || "");
}

const TYPE_LABEL = { G: "Guaranteed", PO: "Player Option", TO: "Team Option", NG: "Non-Guaranteed", PG: "Partially Gtd", UFA: "Free Agent", RFA: "Restricted FA" };
const BADGE = { ESTIMATE: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300", EST: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300", PO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", TO: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300", NG: "bg-slate-100 text-slate-500 dark:text-slate-400", PG: "bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", UFA: "bg-slate-100 text-blue-700", RFA: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300" };

const fmtM = (v) => "$" + v.toFixed(1) + "M";
const cleanNo = (no) => String(no || "").replace(/^#+/, "");
const salaried = (c) => c.years.filter((y) => y.salary != null);
const total = (c) => salaried(c).reduce((a, y) => a + y.salary, 0);
const terms = (c) => salaried(c).length + " yrs / " + fmtM(total(c));
const displayLine = (c) => terms(c) + (c.team ? " (" + c.team + ")" : "") + " · " + c.kind;
// Same line, but the signing team shows as a small logo instead of "(ATL)".
function ContractLine({ c, noTerms }) {
  const abbr = toAbbr(c.team) || String(c.team || "").toUpperCase();
  const logo = abbr ? TEAM_LOGOS[abbr] : null;
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      {!noTerms && <span className="shrink-0">{terms(c)}</span>}
      {abbr && (logo
        ? <img src={logo} alt={abbr} title={c.team} className="w-4 h-4 object-contain shrink-0" style={logoTrim(abbr)} />
        : <span className="text-[9px] font-extrabold text-slate-400 shrink-0">{abbr}</span>)}
      <span className="truncate">{noTerms ? "" : "· "}{c.kind}</span>
    </span>
  );
}
// Free-agency deadline for a contract: the Contract Years row typed UFA/RFA
// (the empty year after the last paid one). An Airtable Deadline on that
// row wins; otherwise free agency opens June 30 of that summer.
function faDeadline(c) {
  const rows = (c.years || []).filter((y) => /^(UFA|RFA)$/i.test(String(y.type || "")) && startYear(y.season) != null)
    .sort((a, b) => startYear(a.season) - startYear(b.season));
  const y = rows[0];
  if (!y) return null;
  const dl = eventDeadline({ kind: String(y.type).toUpperCase(), season: y.season, deadline: y.deadline || null });
  return dl ? dl.label : null;
}
// The contract in force: Status = Active. With none, the most recent one still
// drives the card — unless it's been closed out (Expired / Terminated / Waived /
// Bought out / Declined), in which case there is no active contract.
const CLOSED = /expired|terminated|waived|bought|declined|void|released/i;
const activeOf = (p) => {
  const cs = p.contracts || [];
  const open = cs.filter((c) => !CLOSED.test(String(c.status || "")));
  return cs.find((c) => /^active$/i.test(String(c.status || "")))
    || open.find((c) => (c.years || []).some((y) => y.season === CURRENT_SEASON && y.salary != null))   // no "Active" flag, but it covers this season
    || open[0] || null;
};

// Years in the league, computed from Draft Year vs the current season.
function latestStats(p) {
  return p.stats && p.stats.length > 0 ? p.stats[0] : null;
}
// The season before the latest one (for trend arrows)
function prevStats(p) {
  return p.stats && p.stats.length > 1 ? p.stats[1] : null;
}
const fmt1 = (v) => (v == null ? null : Number(v).toFixed(1));

// Inclusive season count: drafted 2014 -> 2025-26 is season #12.
// Has the current season tipped off? (NBA opens in the third week of Oct.)
function seasonStarted() {
  const y = parseInt(String(CURRENT_SEASON).slice(0, 4), 10);
  return new Date() >= new Date(y, 9, 15);
}
function seasonsPlayed(p) {
  if (!p.draftYear) return null;
  // Retired: count through his Last Season column; if it's blank, through the
  // latest season he has stats for.
  if (isRetired(p)) {
    const last = Number(String(p.lastSeason || "").match(/\d{4}/)?.[0]) || (p.stats && p.stats.length ? startYear(p.stats[0].season) : null);
    return last ? Math.max(0, last - p.draftYear + 1) : null;
  }
  const nowYear = parseInt(String(CURRENT_SEASON).slice(0, 4), 10);
  const n = nowYear - p.draftYear + (seasonStarted() ? 1 : 0);   // "5 seasons" in Sept, "6 seasons" once the season starts
  return isNaN(n) ? null : Math.max(0, n);
}
function experienceOf(p) {
  const n = seasonsPlayed(p);
  if (n == null) return "";
  if (n === 0) return "Rookie";
  return n === 1 ? "1 season" : n + " seasons";
}

// Search matches player name, current team (full name or abbreviation),
// or the active contract's team. "knicks", "NY", "jalen" all work.
function matchesQuery(p, q) {
  if (!q) return true;
  const s = q.toLowerCase().trim();
  if (p.name.toLowerCase().includes(s)) return true;
  const team = String(p.teamName || "").toLowerCase();
  if (team.includes(s)) return true;
  const abbr = teamOfPlayer(p) || "";
  if (String(abbr).toLowerCase().includes(s)) return true;
  if (String(TEAM_NAMES[abbr] || "").toLowerCase().includes(s)) return true;   // "knicks", "new york"
  const actTeam = activeOf(p) ? String(activeOf(p).team).toLowerCase() : "";
  if (actTeam.includes(s)) return true;
  for (const c of p.contracts) {
    if (String(c.kind).toLowerCase().includes(s)) return true;
  }
  return false;
}


// ═══════════════ ESPN ROSTER FEED (photos + positions) ═══════════
// Filled once from /api/espn-rosters. Airtable still wins when it has a
// value; ESPN fills the blanks — a missing headshot, or a Position that
// only says "G" / "F".
const ESPN_BY_NAME = {};
const espnNrm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.'’]/g, "").replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
function espnOf(p) {
  if (!p) return null;
  const hit = ESPN_BY_NAME[espnNrm(p.name)];
  if (hit) return hit;
  const team = teamOfPlayer(p);
  return team ? ESPN_BY_NAME[String(team).toUpperCase() + "|" + espnNrm(p.name).split(" ").pop()] || null : null;
}
const photoOf = (p) => p.photo || espnOf(p)?.headshot || null;
const ringClsOf = (p) => { if (!p) return "border-white/40"; const h = healthOf(p); return h === "ok" ? "border-white" : h === "q" ? "border-amber-400 hrb-pulse-q" : "border-red-500 hrb-pulse-out"; };
// Injury write-up for a player: the Airtable Injury Notes field, else ESPN's
// description; plus ESPN's estimated return date when it publishes one.
function injuryLine(p) {
  const e = espnOf(p);
  const note = tidyInjury(p.injuryNotes || e?.injuryDetail || "");
  const ret = e?.injuryReturn ? new Date(e.injuryReturn) : null;
  const retTxt = ret && !isNaN(ret) ? "est. return " + ret.toLocaleDateString([], { month: "short", day: "numeric" }) : "";
  return [note, retTxt].filter(Boolean).join(" · ");
}
// ── Injury rules (one place) ─────────────────────────────────────────
// Status: ESPN's live status wins whenever ESPN lists the player as hurt;
//         otherwise Airtable's Status column. So Airtable "Active" + ESPN
//         "Day-To-Day" shows Day-To-Day everywhere.
// Note:   Airtable Injury Notes first (any "est. return …" inside it is
//         split off into the return date), else ESPN's description.
// Return: Airtable Return Date column, else a date inside the notes, else
//         ESPN's estimate. Always shown as "Estimated Return Date: Oct 2".
// Freshest source first: the live injury feed (5-min cache, re-polled on wake).
// The roster feed is only a stopgap before the live feed has loaded.
// Out for the season only when (a) the injury return date lands past the end of
// the regular season, or (b) the write-up says so in plain words. A status of IR
// or Out on its own never promotes — an illness isn't season-ending.
const SEASON_RE = /season[- ]ending|out for the (rest of the |remainder of the )?season|out for the year|miss(es|ing)? the (entire |rest of the |remainder of the )season|year (is )?(already )?(over|finished|done)|remainder of the season|rest of the season/i;
function outForSeason(p) {
  const st = String(p?.status || "").toLowerCase();
  if (st.includes("season")) return true;
  const raw = injOf(p)?.returnDate || espnOf(p)?.injuryReturn || p?.returnDate;
  if (raw) { const d = new Date(raw); const endYear = Number(String(CURRENT_SEASON).slice(-4)); if (!isNaN(d) && d > new Date(endYear, 3, 15)) return true; }   // after Apr 15 of the season's end year
  const txt = [injOf(p)?.comment, injOf(p)?.longComment, espnOf(p)?.injuryComment].filter(Boolean).join(" ");
  return SEASON_RE.test(txt);
}
const SEVERITY = (st) => { const s = String(st || "").toLowerCase(); if (!s || /active|available/.test(s)) return 0; if (/season/.test(s)) return 6; if (/\bout\b|^ir$|injured reserve|suspend/.test(s)) return 5; if (/doubt/.test(s)) return 4; if (/quest|gtd|game.time/.test(s)) return 3; if (/day/.test(s)) return 2; if (/prob/.test(s)) return 1; return 2; };
function effectiveStatus(p) {
  const e = INJ_LOADED ? injOf(p)?.status : (espnOf(p)?.injury || injOf(p)?.status);
  const feed = (e && !/active|available/i.test(String(e))) ? String(e) : "";
  const mine = String(p.status || "");
  // Feed drives availability; your Airtable can only make it MORE severe (Doubtful over Day-To-Day), never clear it
  const base = feed ? (SEVERITY(mine) > SEVERITY(feed) && !/active|available/i.test(mine) ? mine : feed) : mine;
  if (base && /out|ir/i.test(base) && outForSeason(p)) return "Out for Season";
  return base;
}
const injuryCommentOf = (p) => espnOf(p)?.injuryComment || injOf(p)?.comment || null;
function splitNotes(raw) {
  const t = String(raw || "");
  const m = t.match(/\b(?:est(?:imated)?\.?\s*)?return(?:\s*date)?[:\s]*([A-Za-z]{3,9}\.?\s*\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  const ret = m ? m[1] : null;
  const note = m ? t.replace(m[0], "").replace(/[·,;-]\s*$/, "").trim() : t;
  return { note, ret };
}
const fmtRet = (v) => { if (!v) return null; const d = new Date(/\d{4}/.test(String(v)) ? v : v + " " + new Date().getFullYear()); return isNaN(d) ? String(v) : d.toLocaleDateString([], { month: "short", day: "numeric" }); };
// "(right ankle sprain)" — Airtable notes first, else ESPN's write-up
const tidyInjury = (t) => { const x = String(t || "").toLowerCase().replace(/[()]/g, "").trim(); return !x ? "" : /\s/.test(x) || /injur|sprain|strain|surgery|fracture|tear|soreness|illness|rest|contusion|bruise|concussion|tendin|manage/.test(x) ? x : x + " injury"; };
const injuryDetailOf = (p) => tidyInjury(splitNotes(p.injuryNotes).note || espnOf(p)?.injuryDetail || injOf(p)?.detail || "");
const injuryReturnOf = (p) => (outForSeason(p) ? null : (fmtRet(p.returnDate) || fmtRet(splitNotes(p.injuryNotes).ret) || fmtRet(espnOf(p)?.injuryReturn) || fmtRet(injOf(p)?.returnDate)));
const isActiveStatus = (p) => { const st = String(effectiveStatus(p)).toLowerCase(); return !st || st.includes("active") || st.includes("available"); };
// Retired / Overseas aren't injuries: no notes, no return date, just the tag
const isSidelined = (p) => !isActiveStatus(p) && !isRetired(p);
const GENERIC_POS = new Set(["", "G", "F", "G-F", "F-G", "F-C", "C-F", "G/F", "F/C", "GUARD", "FORWARD", "WING", "BIG"]);
// Court position: Airtable's exact label (PG/SG/SF/PF/C) if it has one,
// otherwise ESPN's, otherwise whatever Airtable said.
function courtPos(p) {
  const a = String(p.pos || "").toUpperCase().replace(/\s+/g, "");
  if (!GENERIC_POS.has(a)) return a;
  const e = espnOf(p)?.pos;
  return e && !GENERIC_POS.has(e) ? e : a;
}
// Height in inches from "6-7", "6'7", "6 ft 7 in", "6'7\"" — used only as a
// tie-break when two forwards both qualify for the same slot.
function heightIn(p) {
  const m = String(p.height || espnOf(p)?.height || "").match(/(\d)\D+(\d{1,2})/);
  return m ? Number(m[1]) * 12 + Number(m[2]) : null;
}

const SWIPE_DEPTH = { n: 0 }; // how many teams deep the swipe trail goes
const TEAM_VIEW_MEMORY = {};   // per team: which tab / sub-view was open, so "back" returns to it
function useSwipe(onLeft, onRight) {
  const start = React.useRef(null);
  return {
    onTouchStart: (e) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY, t: Date.now() }; },
    onTouchEnd: (e) => {
      const s0 = start.current; start.current = null;
      if (!s0) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s0.x, dy = t.clientY - s0.y;
      if (Date.now() - s0.t > 600) return;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
      if (dx > 0) onRight && onRight(); else onLeft && onLeft();
    },
  };
}

// ═══════════════ SHARED PIECES ═══════════════════════════════════
// A basketball jersey in the team's colors: sleeveless tank, scoop neck,
// deep armholes, contrast trim, number on the chest.
function Jersey({ no, color, trim }) {
  return (
    <span className="self-center shrink-0 relative w-12 h-14 flex items-center justify-center">
      <svg viewBox="0 0 48 56" className="absolute inset-0 w-full h-full">
        {/* body + straps */}
        <path d="M8 2 H17 Q24 15 31 2 H40 V11 Q33 17 41 27 V54 H7 V27 Q15 17 8 11 Z" fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" strokeLinejoin="round" />
        {/* neck + armhole trim */}
        <path d="M17 2 Q24 15 31 2" fill="none" stroke={trim} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M40 11 Q33 17 41 27" fill="none" stroke={trim} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M8 11 Q15 17 7 27" fill="none" stroke={trim} strokeWidth="2.2" strokeLinecap="round" />
        {/* side piping */}
        <path d="M11 32 V52 M37 32 V52" fill="none" stroke={trim} strokeWidth="1.2" opacity="0.7" />
      </svg>
      <span className="relative text-[14px] font-extrabold text-white tabular-nums leading-none mt-3" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>{no || "—"}</span>
    </span>
  );
}
function Avatar({ p, size }) {
  const px = size === "xl" ? "w-28 h-28 text-3xl ring-4 ring-white/80" : size === "lg" ? "w-20 h-20 text-2xl" : "w-14 h-14 text-base"; // every list view uses the same 56px photo
  const url = photoOf(p);
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return <img src={url} alt={p.name} loading="lazy" className={px + " rounded-full object-cover object-top bg-slate-200 shrink-0"} onError={() => setBroken(true)}
      onLoad={(e) => { const im = e.currentTarget; if (im.naturalWidth < 40 || /nophoto|silhouette|placeholder/i.test(im.src)) setBroken(true); }} />;
  }
  const no = cleanNo(p.no);
  const label = no ? "#" + no : p.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <div className={px + " rounded-full bg-slate-200 text-slate-500 dark:text-slate-400 dark:bg-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0"}>
      {label}
    </div>
  );
}


function rankOf(teams, team, key, dir) {
  if (!teams || team[key] == null) return null;
  const vals = teams.filter((t) => t[key] != null && !isFaTeam(t) && ((t.wins ?? 0) + (t.losses ?? 0) > 0 || !t.live));
  if (vals.length < 2) return null;
  const sorted = vals.slice().sort((a, b) => (dir === "asc" ? a[key] - b[key] : b[key] - a[key]));
  const rank = sorted.findIndex((t) => t.id === team.id) + 1;
  if (!rank) return null;
  const cls =
    rank <= 10 ? "text-green-600 dark:text-green-400"
    : rank <= 20 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";
  return { label: "(" + ordinal(rank) + ")", cls };
}

function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return n + "th";
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th";
  return n + suffix;
}

function Tile({ value, label, sub, accent, valueClass, onClick, active, activeColor, borderColor, labelColor }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={"relative bg-white dark:bg-slate-900 rounded-2xl border px-2 py-4 text-center shadow-sm flex flex-col items-center justify-center w-full " + (active || borderColor ? "border-2" : "border-slate-200 dark:border-slate-800")}
      style={active ? { borderColor: activeColor || "#2563eb", boxShadow: `0 0 0 2px ${activeColor || "#2563eb"}33` } : borderColor ? { borderColor } : undefined}>
      {onClick && (
        <svg viewBox="0 0 12 12" className={"absolute top-2 right-2 w-3 h-3 transition-transform " + (active ? "rotate-180" : "")} style={{ color: active ? (activeColor || "#2563eb") : "#cbd5e1" }} aria-hidden="true">
          <path d="M2.5 4.5 L6 8 L9.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <div className={"text-[10px] tracking-widest uppercase mb-1 " + (labelColor ? "font-extrabold" : "font-semibold text-slate-400")} style={labelColor ? { color: labelColor } : undefined}>{label}</div>
      <div className={"text-2xl font-extrabold tracking-tight " + (valueClass ? valueClass : accent ? ACCENT_TEXT : "text-slate-900 dark:text-slate-100")}>{value}</div>
      {sub && (
        <div className={"text-[10px] font-bold mt-0.5 " + (typeof sub === "object" && sub.cls ? sub.cls : "text-blue-600 dark:text-blue-400")}>
          {typeof sub === "object" ? sub.label : sub}
        </div>
      )}
    </Tag>
  );
}


// "2026-2027" -> "'26-'27"; falls back to the old single-year tick
function seasonTick(y) {
  const m = String(y.season || "").match(/(\d{4})\s*-\s*(\d{4})/);
  if (m) return "'" + m[1].slice(2) + "-'" + m[2].slice(2);
  return y.s;
}

function SalaryBars({ years }) {
  const max = Math.max(...years.map((y) => y.salary ?? 0), 1);
  return (
    <div className="flex items-end justify-around gap-3 h-32 mt-2">
      {years.map((y, i) => (
        <div key={i} className="flex-1 max-w-[52px] flex flex-col items-center justify-end h-full">
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
            {y.salary == null ? y.type : fmtM(y.salary)}
          </div>
          <div
            className="w-full rounded-t-md"
            style={{
              backgroundColor: BAR_COLORS[y.type] || BAR_COLORS.G,
              height: y.salary == null ? "6px" : Math.max((y.salary / max) * 100, 8) + "%",
            }}
          />
          <div className="text-[10px] font-semibold text-slate-400 mt-1 whitespace-nowrap">{seasonTick(y)}</div>
        </div>
      ))}
    </div>
  );
}

function ContractCard({ c, big }) {
  return (
    <div className={"bg-white dark:bg-slate-900 rounded-2xl border shadow-sm px-4 py-4 " + (big ? ACCENT_BORDER : "border-slate-200 dark:border-slate-800")}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase truncate flex items-center gap-2">
            {c.team && logoFor(c.team) && <img src={logoFor(c.team)} alt={c.team} className="w-6 h-6 object-contain shrink-0" style={logoTrim(modernAbbr(c.team))} />}
            <span className="truncate">{c.kind}</span>
          </div>
          <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">{terms(c)}</div>
        </div>
        <span className={"text-[10px] font-bold px-2 py-1 rounded-full shrink-0 " + (c.status === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" : "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300")}>
          {c.status}
        </span>
      </div>
      <SalaryBars years={c.years} />
      <div className="flex flex-wrap gap-1.5 mt-3">
        {c.years
          .filter((y) => y.type !== "G")
          .filter((y, _, arr) => {
            const isFA = y.type === "UFA" || y.type === "RFA";
            const hasOption = arr.some((o) => (o.type === "PO" || o.type === "TO") && !o.decision);
            return !(isFA && hasOption); // option chip covers it - FA chip is redundant
          })
          .map((y, i) => (
          <span key={i} className={"text-[11px] font-semibold px-2 py-1 rounded-full " + (y.decision && /^(PO|TO)$/i.test(String(y.type || ""))
              ? (String(y.type).toUpperCase() === "PO" ? "bg-white dark:bg-slate-900 text-green-600 border border-green-500" : "bg-white dark:bg-slate-900 text-red-600 border border-red-500")
              : (BADGE[String(y.type || "").toUpperCase()] || "bg-slate-100 text-slate-500 dark:text-slate-400"))}>
            {y.season || y.s} · {TYPE_LABEL[y.type] || y.type}
            {y.decision ? " · " + y.decision : ""}
            {y.gtd != null ? " (" + fmtM(y.gtd) + " gtd)" : ""}
          </span>
        ))}
        {c.years.length > 0 && c.years.every((y) => y.type === "G") && (
          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">Fully guaranteed</span>
        )}
      </div>
    </div>
  );
}

// League rank of a player in a per-game stat across everyone in the database
// Season total for a per-game stat (per-game × games)
const totalOf = (st, key) => (st && st[key] != null && st.gp ? Math.round(st[key] * st.gp) : st && st[key] != null ? st[key] : null);
// League rank by season TOTAL (not average). Ties share a rank: "30th (tied)".
const curStats = (p) => (p.stats || []).find((x) => x.season === CURRENT_SEASON) || null;
function leagueRank(players, p, key) {
  const st = curStats(p); const v = totalOf(st, key);
  if (v == null) return null;
  const all = players.map((q) => totalOf(curStats(q), key)).filter((x) => x != null && x > 0).sort((a, b) => b - a);
  const i = all.indexOf(v);
  if (i < 0) return null;
  const tied = all.filter((x) => x === v).length > 1;
  return { rank: i + 1, of: all.length, tied, label: ordinal(i + 1) + (tied ? " (tied)" : "") };
}
const POS_WORD = (p) => { const x = courtPos(p); return /^C/.test(x) ? "Center" : /F/.test(x) && !/G/.test(x) ? "Forward" : /G/.test(x) ? "Guard" : x || ""; };
function fullTeamName(p, teams) {
  const ab = teamOfPlayer(p);
  const t = (teams || []).find((t) => (t.abbr || toAbbr(t.name)) === ab);
  return t ? t.name : (p.teamName || ab || "");
}

// Game-by-game line chart (PTS / REB / AST / …) from ESPN's game log
function GameLogChart({ espnId, color }) {
  const [log, setLog] = useState(null);
  const [stat, setStat] = useState("pts");
  useEffect(() => { let alive = true; setLog(null); fetch("/api/season-stats?gamelog=" + espnId).then((r) => r.json()).then((d) => alive && setLog(d && d.games ? d.games : [])).catch(() => alive && setLog([])); return () => { alive = false; }; }, [espnId]);
  const CATS = [["pts", "Points"], ["reb", "Rebounds"], ["ast", "Assists"], ["stl", "Steals"], ["blk", "Blocks"], ["p3m", "3PM"], ["min", "Minutes"]];
  const games = (log || []).slice(-20);
  const vals = games.map((g) => g[stat] ?? 0);
  const max = Math.max(1, ...vals), avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const W = 320, H = 120, padL = 22, padR = 10, padT = 14, padB = 22;
  const x = (i) => padL + (games.length > 1 ? (i / (games.length - 1)) * (W - padL - padR) : (W - padL - padR) / 2);
  const y = (v) => padT + (1 - v / max) * (H - padT - padB);
  const path = vals.map((v, i) => (i ? "L" : "M") + x(i) + " " + y(v)).join(" ");
  const area = vals.length ? path + ` L ${x(vals.length - 1)} ${H - padB} L ${x(0)} ${H - padB} Z` : "";
  const lbl = CATS.find(([k]) => k === stat)?.[1] || stat;
  return (
    <div className="mb-3">
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
        {CATS.map(([k, l]) => (
          <button key={k} onClick={() => setStat(k)} className={"shrink-0 px-3 py-1 rounded-full text-[10px] font-extrabold border " + (stat === k ? "text-white border-transparent" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800")} style={stat === k ? { backgroundColor: color } : undefined}>{l}</button>
        ))}
      </div>
      {!log && <div className="text-center text-[11px] text-slate-400 py-6">Loading game log…</div>}
      {log && games.length === 0 && <div className="text-center text-[11px] text-slate-400 py-6">No games yet this season.</div>}
      {games.length > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32">
          {[0, 0.5, 1].map((f) => <g key={f}><line x1={padL} x2={W - padR} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" strokeDasharray="3 3" className="text-slate-200 dark:text-slate-700" /><text x={padL - 4} y={y(max * f) + 3} fontSize="8" textAnchor="end" fill="currentColor" className="text-slate-400">{Math.round(max * f)}</text></g>)}
          <line x1={padL} x2={W - padR} y1={y(avg)} y2={y(avg)} stroke={color} strokeWidth="1" strokeDasharray="2 3" opacity="0.6" />
          <path d={area} fill={color} opacity="0.12" />
          <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {vals.map((v, i) => <g key={i}><circle cx={x(i)} cy={y(v)} r="4" fill="white" stroke={color} strokeWidth="2.5" /><text x={x(i)} y={y(v) - 8} fontSize="9" fontWeight="700" textAnchor="middle" fill="currentColor" className="text-slate-900 dark:text-white">{v}</text></g>)}
          {games.map((g, i) => (games.length <= 10 || i % Math.ceil(games.length / 8) === 0) && <text key={"x" + i} x={x(i)} y={H - 6} fontSize="8" textAnchor="middle" fill="currentColor" className="text-slate-400">{(g.home ? "vs" : "@") + g.opp}</text>)}
        </svg>
      )}
      {games.length > 0 && <div className="text-center text-[10px] text-slate-400 mt-1">{lbl} by game · dashed line = season average{log.length > 20 ? " · last 20" : ""}</div>}
    </div>
  );
}

// ── Tonight strip: tonight's starters, one card per player, with tip time, opponent and status ──
function TonightStrip({ players, teams, onSelect }) {
  const [sb, setSb] = useState(null);
  useEffect(() => { let alive = true; const load = () => fetch("/api/scoreboard").then((r) => r.json()).then((d) => alive && setSb(d && d.games ? d.games : [])).catch(() => alive && setSb([])); load(); const t = setInterval(load, 2 * 60 * 1000); return () => { alive = false; clearInterval(t); }; }, []);
  const games = (sb || []).filter((g) => g.state !== "post");
  if (!sb || !games.length) return null;
  const cards = [];
  for (const g of games) {
    for (const side of ["away", "home"]) {
      const t = g[side], opp = g[side === "away" ? "home" : "away"];
      const team = (teams || []).find((x) => modernAbbr(x.abbr || toAbbr(x.name)) === modernAbbr(t.abbr));
      if (!team) continue;
      const roster = rosterOf(team, players);
      const lu = lineupOf(roster, team.abbr || toAbbr(team.name));
      const five = lu.starters.map((x) => x.p).filter(Boolean);
      for (const p of five) cards.push({ p, g, t, opp, home: side === "home", team });
    }
  }
  if (!cards.length) return null;
  return (
    <div className="pt-3">
      <div className="flex items-center justify-between px-4 mb-2">
        <span className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase">Tonight</span>
        <span className="text-[10px] font-semibold text-slate-400">{games.length} game{games.length === 1 ? "" : "s"} · starters</span>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 pb-2" style={{ scrollbarWidth: "none" }}>
        {cards.map(({ p, g, t, opp, home, team }) => {
          const ab = team.abbr || toAbbr(team.name); const live = g.state === "in";
          const st = effectiveStatus(p); const hurt = isSidelined(p);
          const cur = curStats(p);
          return (
            <button key={p.id + g.id} onClick={() => onSelect(p)} className="shrink-0 w-[108px] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-center flex flex-col items-center justify-start" style={{ borderTop: "3px solid " + teamColor(ab) }}>
              <div className="pt-2 flex justify-center"><Avatar p={p} /></div>
              <div className="px-1.5 mt-1 text-[11px] font-bold text-slate-900 dark:text-white truncate">{lastNameOf(p)}</div>
              <div className="text-[9px] font-semibold text-slate-400 truncate">{cur ? `${fmt1(cur.pts)} PPG` : courtPos(p)}</div>
              <div className="mt-1.5 flex items-center justify-center gap-1 text-[9px] font-extrabold text-slate-500">
                <img src={TEAM_LOGOS[ab] || ""} alt="" className="w-4 h-4 object-contain" style={logoTrim(ab)} />
                <span>{home ? "vs" : "@"}</span>
                <img src={TEAM_LOGOS[opp.abbr] || ""} alt="" className="w-4 h-4 object-contain" style={logoTrim(opp.abbr)} />
              </div>
              <div className={"mt-1 mb-2 text-[9px] font-extrabold " + (live ? "text-red-500" : "text-slate-400")}>{live ? "LIVE " + (t.score ?? 0) + "-" + (opp.score ?? 0) : new Date(g.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
              {hurt && <div className="pb-2 -mt-1"><StatusBadge status={st} /></div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Player comparison ──
function ComparePicker({ players, exclude, onPick, color }) {
  const [q, setQ] = useState("");
  const list = q.trim().length < 2 ? [] : players.filter((x) => x.id !== exclude.id && !isRetired(x) && x.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 mb-3">
      <div className="text-[10px] font-extrabold tracking-widest uppercase mb-2" style={{ color }}>Compare with…</div>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a player's name" className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none" />
      <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
        {list.map((x) => (
          <button key={x.id} onClick={() => onPick(x)} className="w-full flex items-center gap-3 py-2 text-left">
            <Avatar p={x} />
            <span className="flex-1 min-w-0"><span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{x.name}</span><span className="block text-[10px] text-slate-400">{teamOfPlayer(x) || "Free Agent"} · {courtPos(x)}</span></span>
          </button>
        ))}
      </div>
    </div>
  );
}
function CompareView({ a, b, color, onSwap }) {
  const sa = curStats(a) || {}, sb = curStats(b) || {};
  const cb = playerHeaderColor(b);
  const KEYS = [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["stl", "STL"], ["blk", "BLK"], ["p3m", "3PM"]];
  const ROWS = [["Points", "pts"], ["Rebounds", "reb"], ["Assists", "ast"], ["Steals", "stl"], ["Blocks", "blk"], ["Turnovers", "tov", true], ["3PM", "p3m"], ["FG%", "fg", false, true], ["3P%", "p3", false, true], ["FT%", "ft", false, true], ["Minutes", "min"]];
  const max = {}; for (const [k] of KEYS) max[k] = Math.max(0.1, sa[k] ?? 0, sb[k] ?? 0);
  const cx = 70, cy = 70, r = 50, n = KEYS.length;
  const pt = (i, f) => { const ang = -Math.PI / 2 + (i / n) * 2 * Math.PI; return [cx + r * f * Math.cos(ang), cy + r * f * Math.sin(ang)]; };
  const poly = (st) => KEYS.map(([k], i) => pt(i, Math.min(1, (st[k] ?? 0) / max[k])).join(",")).join(" ");
  const ring = (f) => KEYS.map((_, i) => pt(i, f).join(",")).join(" ");
  const Head = ({ p, col, right }) => (
    <div className={"flex items-center gap-2 min-w-0 " + (right ? "flex-row-reverse text-right" : "")}>
      <Avatar p={p} />
      <div className="min-w-0"><div className="text-[12px] font-extrabold truncate" style={{ color: col }}>{lastNameOf(p)}</div><div className="text-[9px] text-slate-400">{teamOfPlayer(p) || "FA"} · {curStats(p)?.gp ?? 0} GP</div></div>
    </div>
  );
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 mb-3">
      <div className="flex items-center justify-between gap-2">
        <Head p={a} col={color} />
        <button onClick={onSwap} className="shrink-0 text-[10px] font-extrabold text-slate-400 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700">swap</button>
        <Head p={b} col={cb} right />
      </div>
      <svg viewBox="0 0 140 140" className="w-40 h-40 mx-auto my-2">
        {[0.33, 0.66, 1].map((f) => <polygon key={f} points={ring(f)} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" />)}
        {KEYS.map(([, l], i) => { const [x, y] = pt(i, 1.18); return <text key={l} x={x} y={y + 3} fontSize="8" fontWeight="700" textAnchor="middle" fill="currentColor" className="text-slate-500 dark:text-slate-400">{l}</text>; })}
        <polygon points={poly(sa)} fill={color} opacity="0.3" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        <polygon points={poly(sb)} fill={cb} opacity="0.3" stroke={cb} strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {ROWS.map(([lbl, k, lower, pct]) => {
          const va = sa[k], vb = sb[k]; const f = (v) => (v == null ? "—" : pct ? Number(v).toFixed(1) + "%" : fmt1(v));
          const aWins = va != null && vb != null && (lower ? va < vb : va > vb), bWins = va != null && vb != null && (lower ? vb < va : vb > va);
          return (
            <div key={k} className="flex items-center py-1.5 text-[12px] tabular-nums">
              <span className={"w-16 text-left font-extrabold " + (aWins ? "" : "text-slate-400")} style={aWins ? { color } : undefined}>{f(va)}</span>
              <span className="flex-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">{lbl}</span>
              <span className={"w-16 text-right font-extrabold " + (bWins ? "" : "text-slate-400")} style={bWins ? { color: cb } : undefined}>{f(vb)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Cheat sheet: consistency. For tonight's players, how often they clear a line. ──
// "Jalen Johnson: 6+ REB in 90% of games" — built from every box score in the
// last 30 days. The line shown is the highest one he still clears ≥ 70% of the
// time, with the next line up beside it so you can see where it drops off.
const CS_LINES = { pts: [8, 10, 12, 15, 18, 20, 22, 25, 28, 30], reb: [3, 4, 5, 6, 7, 8, 10, 12], ast: [2, 3, 4, 5, 6, 7, 8, 10], p3m: [1, 2, 3, 4, 5], pra: [15, 20, 25, 30, 35, 40, 45] };
const CS_LABEL = { pts: "PTS", reb: "REB", ast: "AST", p3m: "3PM", pra: "PTS+REB+AST" };
function CheatSheet({ games, teams, players, onSelect }) {
  const [stat, setStat] = useState("pts");
  const [floor, setFloor] = useState(70);                // hit-rate threshold for the headline line
  const [data, setData] = useState(null);
  const upcoming = (games || []).filter((g) => g.state !== "post");
  const slate = [];                                       // [{ ab, opp, home }] using ESPN's codes from the scoreboard
  for (const g of upcoming) for (const [me, them] of [["away", "home"], ["home", "away"]]) slate.push({ ab: g[me].abbr, opp: g[them].abbr, home: me === "home" });
  const slateKey = slate.map((x) => x.ab).sort().join(",");
  useEffect(() => {
    if (!slateKey) { setData({ players: [] }); return; }
    let alive = true; setData(null);
    fetch("/api/season-stats?logs=season&teams=" + encodeURIComponent(slateKey))
      .then((r) => r.ok ? r.json() : r.text().then((t) => ({ error: "HTTP " + r.status + (/timeout|FUNCTION_INVOCATION/i.test(t) ? " (timed out)" : "") })))
      .then((d) => alive && setData(d && d.players ? d : { players: [], error: d?.error || "No data returned" }))
      .catch((e) => alive && setData({ players: [], error: String(e.message || e) }));
    return () => { alive = false; };
  }, [slateKey]);
  const slotOf = (ab) => slate.find((x) => sameAbbr(x.ab, ab));
  if (!data) return <div className="px-4 py-10 text-center text-xs text-slate-400">Reading this season's box scores for these teams… (10–20 seconds the first time)</div>;
  if (data.error) return <div className="px-4 py-10 text-center text-xs text-slate-400">Couldn't load the game logs ({data.error}). Pull down to refresh, or try again in a minute.</div>;
  const val = (gm) => (stat === "pra" ? gm.pts + gm.reb + gm.ast : gm[stat]);
  const rows = [];
  for (const rec of data.players) {
    const slot = slotOf(rec.team); if (!slot) continue;
    const gs = rec.g; if (gs.length < 3) continue;
    const p = (players || []).find((x) => espnNrm(x.name) === espnNrm(rec.name));
    if (p && healthOf(p) === "out") continue;
    const vals = gs.map(val); const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const rates = CS_LINES[stat].map((L) => ({ L, pct: Math.round((vals.filter((v) => v >= L).length / vals.length) * 100) }));
    const hits = rates.filter((r) => r.pct >= floor);
    const best = hits.length ? hits[hits.length - 1] : null;          // highest line still cleared at the floor
    if (!best) continue;
    const next = rates[rates.indexOf(best) + 1] || null;
    const recent = vals.slice(-5);
    rows.push({ rec, p, avg, best, next, recent, gp: vals.length, min: gs.reduce((a, b) => a + b.min, 0) / gs.length, opp: slot.opp, home: slot.home });
  }
  // best lines first; ties broken by how reliable the next line still is
  rows.sort((a, b) => b.best.L - a.best.L || (b.next?.pct ?? 0) - (a.next?.pct ?? 0) || b.avg - a.avg);
  const pctCls = (pct) => (pct >= 90 ? "text-green-700 bg-green-100" : pct >= 80 ? "text-green-700 bg-green-50" : pct >= 70 ? "text-amber-700 bg-amber-100" : "text-slate-500 bg-slate-100");
  return (
    <div className="px-4 pt-3 pb-28">
      <div className="flex gap-1.5 mb-2">
        {Object.keys(CS_LINES).map((k) => <button key={k} onClick={() => setStat(k)} className={"flex-1 py-1.5 rounded-full text-[10px] font-extrabold border " + (stat === k ? "bg-blue-600 text-white border-transparent" : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800")}>{k === "pra" ? "P+R+A" : CS_LABEL[k]}</button>)}
      </div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase">Consistency · season</span>
        <span className="flex gap-1">{[70, 80, 90].map((f) => <button key={f} onClick={() => setFloor(f)} className={"px-2 py-0.5 rounded-full text-[10px] font-extrabold border " + (floor === f ? "bg-slate-900 text-white border-transparent dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800")}>{f}%+</button>)}</span>
      </div>
      <div className="text-[10px] text-slate-400 mb-3 px-1">Each row: the highest {CS_LABEL[stat]} line he clears in at least {floor}% of his games, then the next line up so you can see where it drops. Last 5 games on the right, oldest → newest. Players who are Out are hidden.</div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {rows.slice(0, 40).map((r, i) => {
          const ab = r.rec.team;
          return (
            <button key={r.rec.name} onClick={() => r.p && onSelect(r.p)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800" style={{ borderLeft: "4px solid " + teamColor(ab) }}>
              {r.p ? <Avatar p={r.p} /> : <span className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />}
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[13px] font-bold text-slate-900 dark:text-white truncate">{r.rec.name}</span>
                  {r.p && isSidelined(r.p) && <StatusBadge status={effectiveStatus(r.p)} />}
                </span>
                <span className="block text-[10px] text-slate-500 dark:text-slate-400">{ab} {r.home ? "vs" : "@"} {r.opp} · {fmt1(r.avg)} avg · {fmt1(r.min)} min · {r.gp} GP</span>
                <span className="flex items-center gap-1.5 mt-1">
                  <span className={"px-1.5 py-0.5 rounded-md text-[10px] font-extrabold " + pctCls(r.best.pct)}>{r.best.L}+ {CS_LABEL[stat]} · {r.best.pct}%</span>
                  {r.next && <span className={"px-1.5 py-0.5 rounded-md text-[10px] font-bold " + pctCls(r.next.pct)}>{r.next.L}+ · {r.next.pct}%</span>}
                </span>
              </span>
              <span className="flex gap-0.5 shrink-0">
                {r.recent.map((v, k) => <span key={k} className={"w-6 h-6 rounded-md text-[9px] font-extrabold flex items-center justify-center " + (v >= r.best.L ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600")}>{v}</span>)}
              </span>
            </button>
          );
        })}
        {rows.length === 0 && <div className="text-center text-xs text-slate-400 py-10 px-4">{upcoming.length === 0 ? "No games left on this day." : `Nothing to show. Checked ${data.scanned ?? 0} games since ${data.from ? new Date(data.from).toLocaleDateString([], { month: "short", day: "numeric" }) : "?"}, read ${data.games ?? 0} box scores, found ${data.players.length} players; ${slate.length} teams on this slate.`}</div>}
      </div>
    </div>
  );
}

// ── Full court (pregame): away starters on top, home starters on the bottom,
//    drawn with the home team's real floor (same renderer as the team court) ──
function FullCourt({ game, teams, players, onSelect }) {
  const teamBy = (ab) => (teams || []).find((t) => sameAbbr(t.abbr || toAbbr(t.name), ab));
  const homeT = teamBy(game.home.abbr), awayT = teamBy(game.away.abbr);
  if (!homeT || !awayT) return null;
  const hAb = homeT.abbr || toAbbr(homeT.name), aAb = awayT.abbr || toAbbr(awayT.name);
  const hLu = lineupOf(rosterOf(homeT, players), hAb), aLu = lineupOf(rosterOf(awayT, players), aAb);
  const th = courtTheme(hAb), color = teamColor(hAb);
  const nick = homeT.name ? String(homeT.name).trim().split(" ").pop() : hAb;
  const HALF = 47 + COURT_TOP_FT;                       // one half as the team view draws it (court + apron above the half line)
  const TOTAL = 2 * 47;                                  // full playing surface
  // vertical % for a slot: slot.y is % of the half-court view; convert to feet from the half line
  const yFt = (slot) => ((slot.y / 100) * COURT_FT) - COURT_TOP_FT;
  // guards and wings pulled toward half court, bigs kept near the paint, so the three rows stay clear of each other
  const FACTOR = { PG: 0.85, SG: 0.72, SF: 0.72, PF: 0.86, C: 0.86 };
  const posOf = (slot, top) => { const f = yFt(slot) * (FACTOR[slot.lbl] || 0.8); return { left: slot.x + "%", top: ((top ? 47 - f : 47 + f) / TOTAL) * 100 + "%" }; };
  const Tag = ({ lu, ab, top }) => {
    const lineup = lineupFor(ab);
    // Green only when the known lineup is from this very game (same ESPN event, or same day as this game's tip)
    const isToday = lu.automated && lineup && lineup.date && (() => { if (lineup.eventId && String(lineup.eventId) === String(game.id)) return true; const et = (x) => new Date(new Date(x).toLocaleString("en-US", { timeZone: "America/New_York" })); const a = et(lineup.date), b = et(game.date); return a.toDateString() === b.toDateString(); })();
    const when = lineup && lineup.date ? new Date(lineup.date).toLocaleDateString([], { month: "numeric", day: "numeric" }) : "";
    return (
      <span className={"absolute rounded-md bg-black/45 backdrop-blur-sm px-2 py-1 text-[9px] font-extrabold shadow-sm leading-tight " + (isToday ? "text-emerald-300" : "text-amber-300") + (top ? " left-2 top-2" : " right-2 bottom-2 text-right")}>
        {lu.automated && lineup
          ? (isToday ? <><span className="block">Confirmed lineup</span><span className="block text-[8px] font-bold opacity-80">{when}</span></>
                     : <><span className="block">Projected lineup</span><span className="block text-[8px] font-bold opacity-80">last game {(lineup.home ? "vs " : "@ ") + lineup.opp} · {when}</span></>)
          : "Projected lineup"}
      </span>
    );
  };
  const Player = ({ x, slot, top }) => {
    const p = x.p; if (!p) return null;
    const h = healthOf(p); const st = effectiveStatus(p);
    const short = /game\s*time|gtd/i.test(st) ? "GTD" : /quest/i.test(st) ? "GTD" : /doubt/i.test(st) ? "DOUBTFUL" : /season/i.test(st) ? "OUT" : /out|ir/i.test(st) ? "OUT" : /prob/i.test(st) ? "PROB" : st;
    return (
      <button onClick={() => onSelect && onSelect(p)} className="absolute flex flex-col items-center" style={{ ...posOf(slot, top), transform: "translate(-50%, -50%)", width: "18%" }}>
        <span className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
          <img src={photoOf(p)} alt="" className={"w-full h-full rounded-full object-cover object-top bg-white border-[3px] shadow-lg " + ringClsOf(p)} />
          <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[110%] text-[8px] font-extrabold text-slate-700 bg-white/90 rounded px-1">{slot.lbl}</span>
          {h !== "ok" && <span className={"absolute -top-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[8px] font-extrabold text-white whitespace-nowrap " + (h === "q" ? "bg-amber-500" : "bg-red-600")}>{short}</span>}
        </span>
        <span className="mt-0.5 text-[10px] font-extrabold text-white whitespace-nowrap" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>{cleanNo(p.no) ? "#" + cleanNo(p.no) + " " : ""}{lastNameOf(p)}</span>
      </button>
    );
  };
  return (
    <div className="mb-4">
      <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mb-2 px-1">Starting lineups</div>
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-md" style={{ paddingBottom: (TOTAL / 50 * 100).toFixed(1) + "%", background: th.floor || "repeating-linear-gradient(90deg,#e3b77c 0 6.5%,#dbad70 6.5% 13%)" }}>
        <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.045) 0 1px, transparent 1px 22px)" }} />
        {/* bottom half: the home court exactly as the team view draws it (apron clipped off) */}
        <svg viewBox={`0 0 50 47`} preserveAspectRatio="none" className="absolute left-0 bottom-0 w-full" style={{ height: "50%", pointerEvents: "none" }}>
          <HalfCourtLines th={th} color={color} abbr={hAb} team={homeT} nick={nick} />
        </svg>
        {/* top half: the same floor mirrored for the visiting end */}
        <svg viewBox={`0 0 50 47`} preserveAspectRatio="none" className="absolute left-0 top-0 w-full" style={{ height: "50%", pointerEvents: "none", transform: "rotate(180deg)" }}>
          <HalfCourtLines th={th} color={color} abbr={hAb} team={homeT} nick={nick} />
        </svg>
        {/* out-of-bounds line around the whole floor */}
        <svg viewBox="0 0 50 94" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
          <rect x="0.25" y="0.25" width="49.5" height="93.5" fill="none" stroke={th.side === "none" ? "transparent" : th.side || "rgba(255,255,255,0.8)"} strokeWidth="0.4" />
        </svg>
        {homeT && (homeT.courtLogo || th.courtLogo || homeT.logo) && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden pointer-events-none select-none" style={{ width: Math.min((th.logoW || 26) * 1.15, 36) + "%", aspectRatio: "1 / 1", ...(th.logoRing ? { boxShadow: "0 0 0 2px " + th.logoRing } : {}) }}>
            <img src={homeT.courtLogo || th.courtLogo || homeT.logo} alt="" className="absolute inset-[6%] w-[88%] h-[88%] object-contain" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }} />
          </div>
        )}
        {aLu.starters.map((x, i) => <Player key={"a" + i} x={x} slot={COURT_SLOTS.find((c) => c.lbl === x.slot) || COURT_SLOTS[i]} top />)}
        {hLu.starters.map((x, i) => <Player key={"h" + i} x={x} slot={COURT_SLOTS.find((c) => c.lbl === x.slot) || COURT_SLOTS[i]} />)}
        <Tag lu={aLu} ab={aAb} top /><Tag lu={hLu} ab={hAb} />
      </div>
    </div>
  );
}

// Game-by-game table (ESPN game log)
function GameLogTable({ espnId, color }) {
  const [log, setLog] = useState(null);
  useEffect(() => { let alive = true; fetch("/api/season-stats?gamelog=" + espnId).then((r) => r.json()).then((d) => alive && setLog(d && d.games ? d.games.slice().reverse() : [])).catch(() => alive && setLog([])); return () => { alive = false; }; }, [espnId]);
  const cols = ["MIN", "PTS", "REB", "AST", "STL", "BLK", "TO", "FG", "3PT", "FT"];
  const cell = (g, c) => ({ MIN: g.min, PTS: g.pts, REB: g.reb, AST: g.ast, STL: g.stl, BLK: g.blk, TO: g.tov, FG: `${g.fgm}-${g.fga}`, "3PT": `${g.p3m}-${g.p3a}`, FT: `${g.ftm}-${g.fta}` }[c]);
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-3">
      {!log && <div className="text-center text-[11px] text-slate-400 py-6">Loading game log…</div>}
      {log && log.length === 0 && <div className="text-center text-[11px] text-slate-400 py-6">No games yet this season.</div>}
      {log && log.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px] tabular-nums">
            <thead><tr className="text-white" style={{ backgroundColor: color }}>
              <th className="text-left px-3 py-2 font-extrabold sticky left-0" style={{ backgroundColor: color }}>GAME</th>
              {cols.map((c) => <th key={c} className="px-2 py-2 font-extrabold text-center whitespace-nowrap">{c}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {log.map((g) => (
                <tr key={g.id} className="text-slate-900 dark:text-white">
                  <td className="px-3 py-2 sticky left-0 bg-white dark:bg-slate-900 whitespace-nowrap">
                    <span className="font-bold">{g.home ? "vs " : "@ "}{g.opp}</span>
                    <span className="ml-1.5 text-[10px] text-slate-400">{g.date ? new Date(g.date).toLocaleDateString([], { month: "numeric", day: "numeric" }) : ""}</span>
                    {g.result && <span className={"ml-1.5 text-[10px] font-extrabold " + (g.result === "W" ? "text-green-600" : "text-red-500")}>{g.result}</span>}
                  </td>
                  {cols.map((c) => <td key={c} className="px-2 py-2 text-center whitespace-nowrap font-medium">{cell(g, c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BioRow({ k, v }) {
  if (!v) return null;
  return (
    <div className="flex justify-between px-4 py-3 text-sm">
      <span className="text-slate-400 font-medium">{k}</span>
      <span className="text-slate-800 dark:text-slate-200 font-semibold">{v}</span>
    </div>
  );
}

// ═══════════════ PLAYER DETAIL ═══════════════════════════════════
function PlayerDetail({ p, onBack, backLabel, mode = "full", teams, players, onJumpToStats }) {
  const [showLog, setShowLog] = useState(false);
  const [compare, setCompare] = useState(null);   // null | "pick" | player
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const swipe = useSwipe(null, onBack);
  const act = activeOf(p);
  const past = p.contracts.filter((c) => c !== act);
  const no = cleanNo(p.no);
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24" {...swipe}>
      <div className="px-5 pb-6 text-white relative overflow-hidden" style={{ backgroundColor: playerHeaderColor(p), paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        {TEAM_LOGOS[teamOfPlayer(p)] && (
          <img src={TEAM_LOGOS[teamOfPlayer(p)]} alt="" className="absolute pointer-events-none select-none"
            style={{ right: "-14%", top: "-4%", width: "58%", opacity: 0.10,
              WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 30%, transparent 70%)", maskImage: "radial-gradient(circle at 50% 50%, #000 30%, transparent 70%)",
              ...logoTrim(teamOfPlayer(p)) }} />
        )}
        <button onClick={onBack} className="text-sm font-semibold opacity-80 mb-3 relative">‹ {backLabel}</button>
        <div className="flex items-start gap-4 relative">
          <Avatar p={p} size="xl" />
          <div className="min-w-0">
            <div className="text-2xl font-extrabold leading-tight">
              {p.name}
            </div>
            <div className="text-sm opacity-85 font-medium mt-0.5 leading-snug">
              {[isRetired(p) ? (isOverseas(p) ? "Overseas" : "Retired") : fullTeamName(p, teams), cleanNo(p.no) ? "#" + cleanNo(p.no) : "", POS_WORD(p)].filter(Boolean).join(" · ")}
            </div>
            <div className="mt-1.5"><StatusBadge status={effectiveStatus(p)} /></div>
            {!isActiveStatus(p) && injuryDetailOf(p) && (
              <div className="mt-1.5"><span className="inline-block text-[11px] font-extrabold text-white bg-red-600 rounded-md px-1.5 py-0.5">({injuryDetailOf(p)})</span></div>
            )}
            {!isActiveStatus(p) && injuryReturnOf(p) && (
              <div className="text-[11px] font-extrabold text-white mt-0.5">Estimated Return Date: {injuryReturnOf(p)}</div>
            )}
            {!isActiveStatus(p) && injuryCommentOf(p) && (
              <div className="text-[11px] opacity-90 mt-1.5 leading-snug">{injuryCommentOf(p)}</div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3">
        {(() => { const cur = (p.stats || []).find((x) => x.season === CURRENT_SEASON); return (
        <div className="grid grid-cols-3 gap-2 relative z-10 -mt-2">
          {[["pts", "PTS"], ["reb", "REB"], ["ast", "AST"]].map(([k, lbl]) => {
            const st = cur; const v = st?.[k];
            const r = players ? leagueRank(players, p, k) : null;
            const cls = r ? (r.rank <= 10 ? "text-green-600 dark:text-green-400" : r.rank <= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-slate-400") : null;
            const c0 = playerHeaderColor(p);
            return (
              <button key={k} onClick={onJumpToStats && v != null ? () => onJumpToStats(p, k) : undefined} className="rounded-2xl text-center bg-white dark:bg-slate-900 shadow-md border-2 py-3" style={{ borderColor: tileBorder(teamOfPlayer(p) || toAbbr(activeOf(p)?.team)) }}>
                <div className="text-[10px] font-extrabold tracking-widest uppercase" style={{ color: c0 }}>{lbl}</div>
                <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums leading-none mt-1">{v != null ? fmt1(v) : "—"}</div>
                <div className={"text-[10px] font-semibold mt-1 tabular-nums " + (cls || "text-slate-400")}>{r ? r.label : (st ? "per game" : "no games yet")}</div>
              </button>
            );
          })}
        </div>); })()}

        {mode === "full" && (p.height || p.weight || p.age || p.draft || p.birthplace || p.draftYear) && (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden mt-6">
              <div className="px-4 py-1.5 text-[10px] font-extrabold tracking-widest uppercase text-white" style={{ backgroundColor: playerHeaderColor(p) }}>Bio</div>
              <BioRow k="Height / Weight" v={[p.height ? String(p.height).replace(/^(\d)[-\s'](\d{1,2})"?$/, "$1'$2\"") : "", p.weight ? String(p.weight).replace(/\s*lbs?$/i, "") + " lbs" : ""].filter(Boolean).join(", ")} />
              <BioRow k="Date of Birth" v={(() => { if (!p.dob) return null; const d = new Date(p.dob); return isNaN(d) ? String(p.dob) : d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); })()} />
              <BioRow k="Age" v={p.age} />
              <BioRow k="Draft" v={[p.draftYear, p.draft].filter(Boolean).join(": ")} />
              <BioRow k="Experience" v={experienceOf(p)} />
              <BioRow k="College" v={p.college} />
              <BioRow k="Birthplace" v={p.birthplace} />
            </div>
          </>
        )}

        {mode === "full" && p.stats && p.stats.length > 0 && (() => {
          const st = p.stats[0];
          const c = playerHeaderColor(p);
          const gp = st.gp != null ? Math.round(st.gp) : null;
          const tot = (k) => (st[k] == null ? null : gp ? Math.round(st[k] * gp).toLocaleString() : fmt1(st[k]));
          const pg = (k) => (st[k] == null ? null : fmt1(st[k]) + "/g");
          const pct = (k) => (st[k] == null ? null : Number(st[k]).toFixed(1) + "%");
          // A stat sheet: one row per line, total on the right with per game in gray.
          // Shooting rows read made/attempted and the percentage together.
          const shoot = (m, a, pk) => (st[m] != null && st[a] != null ? { tot: `${Math.round(st[m] * (gp || 1))}/${Math.round(st[a] * (gp || 1))}`, pg: `${fmt1(st[m])}/${fmt1(st[a])}`, pct: pct(pk) } : null);
          const line = (k) => (st[k] != null ? { tot: tot(k), pg: pg(k) } : null);
          const sheet = [
            ["Scoring", [["Field Goals", shoot("fgm", "fga", "fg"), "fg"], ["3-Pointers", shoot("p3m", "p3a", "p3"), "p3"], ["Free Throws", shoot("ftm", "fta", "ft"), "ft"]]],
            ["Playmaking", [["Minutes", line("min"), "min"], ["Assists", line("ast"), "ast"], ["Turnovers", line("tov"), "tov"], ["AST / TO", st.tov > 0 ? { tot: fmt1(st.ast / st.tov), pg: "ratio" } : (st.ast > 0 ? { tot: "∞", pg: "no turnovers" } : null), "ast"]]],
            ["Rebounding", [["Rebounds", line("reb"), "reb"], ["Offensive", line("oreb"), "oreb"], ["Defensive", line("dreb"), "dreb"]]],
            ["Defense", [["Steals", line("stl"), "stl"], ["Blocks", line("blk"), "blk"]]],
          ].map(([g, rows]) => [g, rows.filter(([, v]) => v)]).filter(([, rows]) => rows.length);
          return (
            <>
              <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mt-6 mb-2 px-1">
                {seasonTick({ season: st.season }) || st.season} season{gp != null ? " · " + gp + " GP" : ""}
                <span className="float-right flex gap-1.5">
                  {st.espnId && <button onClick={() => setShowLog((v) => !v)} className="text-[11px] font-extrabold normal-case tracking-normal px-2.5 py-0.5 rounded-full border" style={{ color: c, borderColor: c, backgroundColor: showLog ? c + "1A" : "transparent" }}>{showLog ? "Hide log" : "Game log ›"}</button>}
                  {players && <button onClick={() => setCompare(compare ? null : "pick")} className="text-[11px] font-extrabold normal-case tracking-normal px-2.5 py-0.5 rounded-full border" style={{ color: c, borderColor: c, backgroundColor: compare ? c + "1A" : "transparent" }}>{compare ? "Close" : "Compare"}</button>}
                </span>
              </div>
              {compare === "pick" && <ComparePicker players={players} exclude={p} onPick={(q) => setCompare(q)} color={c} />}
              {compare && compare !== "pick" && <CompareView a={p} b={compare} color={c} onSwap={() => setCompare("pick")} />}
              {showLog && st.espnId && <GameLogTable espnId={st.espnId} color={c} />}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {sheet.map(([g, rows]) => (
                  <div key={g}>
                    <div className="px-4 py-1.5 text-[10px] font-extrabold tracking-widest uppercase text-white" style={{ backgroundColor: c }}>{g}</div>
                    {rows.map(([lbl, v, key]) => (
                      <button key={lbl} onClick={onJumpToStats && key !== "min" ? () => onJumpToStats(p, key) : undefined} className="w-full flex items-center justify-between px-4 py-2 text-left border-b border-slate-100 dark:border-slate-800 last:border-0 active:bg-slate-50 dark:active:bg-slate-800">
                        <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{lbl}</span>
                        <span className="text-right">
                          <span className="text-[15px] font-extrabold text-slate-900 dark:text-white tabular-nums">{typeof v.tot === "number" ? v.tot.toLocaleString() : v.tot}{v.pct != null && <span className="ml-2 text-[12px] font-bold" style={{ color: c }}>{v.pct}</span>}</span>
                        <span className="block text-[10px] font-semibold text-slate-400 tabular-nums">{v.pg}{v.pct != null ? " per game" : ""}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
                <div className="p-3">                {st.espnId && <div className="pt-3 border-t border-slate-100 dark:border-slate-800"><GameLogChart espnId={st.espnId} color={c} /></div>}
                </div>
              </div>
            </>
          );
        })()}

        {act && salaried(act).length > 0 && (
          <div className="mt-4"><ContractCard c={act} big /></div>
        )}

        {past.length > 0 && (
          <>
            <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mt-6 mb-2 px-1">Contract history</div>
            <div className="flex flex-col gap-3">
              {past.map((c, i) => <ContractCard key={i} c={c} />)}
            </div>
          </>
        )}


        {mode === "full" && p.awards && p.awards.length > 0 && (
          <>
            <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mt-6 mb-2 px-1">Awards</div>
            <div className="flex flex-wrap gap-1.5">
              {p.awards.map((a, i) => (
                <span key={i} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                  🏆 {a}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════ LIST HEADER (shared) ════════════════════════════
function ListHeader({ title, q, setQ, placeholder, pills, noSearch }) {
  return (
    <div className="bg-blue-600 px-5 pb-5 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
      <div className="text-2xl font-extrabold tracking-tight">{title}</div>
      {!noSearch && <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder || "Search players or teams…"}
        className="mt-3 w-full rounded-xl px-4 py-2.5 text-base text-slate-800 dark:text-slate-200 bg-white/95 dark:bg-slate-900/80 placeholder-slate-400 outline-none"
      />}
      {pills}
    </div>
  );
}

// Populated once data loads: abbr -> logo URL
const TEAM_LOGOS = {};
const TEAM_NAMES = {}; // abbr → full name, filled once teams load
const STANDINGS_PHASE = { v: "regular" }; // "preseason" until opening night
const LIVE_STATS = { updatedAt: null, season: null, teams: null };   // when ESPN season averages last loaded

function TeamPill({ team }) {
  const abbr = toAbbr(team) || team;
  if (!abbr) return null;
  const logo = logoFor(abbr);
  if (logo) {
    return <img src={logo} alt={abbr} className="w-11 h-11 object-contain shrink-0" style={logoTrim(abbr)} />;
  }
  return (
    <span className="text-[10px] font-bold text-white px-2 py-1 rounded-xl shrink-0 text-center leading-tight" style={{ backgroundColor: teamColor(abbr) }}>
      {/free\s*agent/i.test(String(team)) ? <>Free<br />Agent</> : abbr}
    </span>
  );
}

// ═══════════════ TAB: PLAYER HUB ═════════════════════════════════
// One bottom tab for players, the injury report, contracts and the draft —
// same hub the NFL app uses, so the bottom nav stays at four buttons.
function PlayersHub({ players, teams, onSelect, injury }) {
  const [view, setView] = useState("players");
  const [newsView, setNewsView] = useState("report");
  const pills = (
    <div className="flex gap-2 mt-3 overflow-x-auto pt-1.5" style={{ scrollbarWidth: "none" }}>
      {[["players", "Active"], ["injury", "🏥 News"], ["contracts", "Contracts"], ["draft", "Draft"], ["retired", "Retired / Overseas"]].map(([k, lbl]) => (
        <button key={k} onClick={() => setView(k)}
          className={"relative shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold " + (view === k ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100 active:bg-blue-500")}>
          {lbl}
          {k === "injury" && <Badge n={injury.unseen} />}
        </button>
      ))}
    </div>
  );
  if (view === "contracts") return <ContractsTab players={players} onSelect={onSelect} pills={pills} />;
  if (view === "draft") return <DraftTab players={players} onSelect={onSelect} pills={pills} />;
  if (view === "injury") {
    const sub = (
      <>
        {pills}
        <div className="flex gap-2 mt-2">
          {[["report", "Injury Report"], ["transactions", "Transactions"], ["recaps", "Recaps"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setNewsView(k)}
              className={"relative shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold " + (newsView === k ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100 active:bg-blue-500")}>
              {lbl}{k === "report" && <Badge n={injury.unseen} />}
            </button>
          ))}
        </div>
      </>
    );
    return newsView === "recaps"
      ? <RecapsFeed players={players} teams={teams} onSelect={onSelect} pills={sub} />
      : newsView === "transactions"
      ? <TransactionsFeed players={players} teams={teams} onSelect={onSelect} pills={sub} />
      : <InjuryFeed players={players} teams={teams} onSelect={onSelect} pills={sub} feed={injury.feed} markSeen={injury.markSeen} />;
  }
  if (view === "retired") return <PlayersTab players={players.filter(isRetired)} onSelect={onSelect} pills={pills} title="Retired / Overseas" key={view} />;
  return <PlayersTab players={players.filter((p) => !isRetired(p))} onSelect={onSelect} pills={pills} title="Active Players" key={view} />;
}

// ═══════════════ GAME VIEW (live) ════════════════════════════════
// Opened from a matchup card. Polls /api/game every 30s while the game is
// live: score + clock, scoring by quarter, each team's leaders, latest plays.
function GameView({ game, teams, players, onBack, onSelectTeam, onSelectPlayer }) {
  const [d, setD] = useState(null);
  const [boxTeam, setBoxTeam] = useState(game.away.abbr);
  const swipe = useSwipe(null, onBack);
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/game?id=" + game.id).then((r) => r.json()).then((x) => alive && setD(x)).catch(() => {});
    load();
    const t = setInterval(() => { if (!d || d.state === "in" || game.state === "in") load(); }, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [game.id]);
  const g = d && !d.error ? d : null;
  const away = g?.away || game.away, home = g?.home || game.home;
  const ca = teamColor(away.abbr), ch = teamColor(home.abbr);
  const state = g?.state || game.state;
  const isLive = state === "in", isFinal = state === "post";
  const tip = new Date(game.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const qs = Math.max(4, away.linescores?.length || 0, home.linescores?.length || 0);
  const qLabel = (i) => (i < 4 ? ["1ST", "2ND", "3RD", "4TH"][i] : "OT" + (i - 3 > 1 ? i - 3 : ""));
  const teamByAbbr = (ab) => (teams || []).find((t) => sameAbbr(t.abbr || toAbbr(t.name), ab));
  const Side = ({ t, color, right }) => (
    <button onClick={() => { const tm = teamByAbbr(t.abbr); if (tm && onSelectTeam) onSelectTeam(tm); }} className={"flex flex-col items-center w-28 " + (right ? "items-end" : "items-start")}>
      <img src={t.logo || TEAM_LOGOS[t.abbr] || ""} alt="" className="w-24 h-24 object-contain" style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.45))", ...logoOnColor(t.abbr) }} />
      <div className="mt-1 text-xl font-extrabold text-white tracking-wide">{t.abbr}</div>
      <div className="text-xs font-semibold text-white/75 tabular-nums">{t.record || (() => { const tm = teamByAbbr(t.abbr); return tm && tm.wins != null ? `${tm.wins}-${tm.losses}` : ""; })()}</div>
    </button>
  );
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24" {...swipe}>
      <div className="px-5 pb-6 text-white" style={{ background: `linear-gradient(100deg, ${ca} 0%, ${ca} 42%, ${ch} 58%, ${ch} 100%)`, paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <button onClick={onBack} className="text-sm font-semibold opacity-85 mb-4">‹ Matchups</button>
        <div className="flex items-center justify-between gap-2">
          <Side t={away} color={ca} />
          <div className="flex-1 text-center">
            {state === "pre" ? (
              <>
                <div className="text-3xl font-extrabold tabular-nums">{tip}</div>
                {(g?.broadcast || game.broadcast) && <div className="text-xs font-semibold opacity-85 mt-1">{g?.broadcast || game.broadcast}</div>}
                {game.odds && (game.odds.details || game.odds.overUnder != null) && <div className="text-[11px] font-semibold opacity-80 mt-1">{game.odds.details}{game.odds.overUnder != null ? ` · O/U ${game.odds.overUnder}` : ""}</div>}
              </>
            ) : (
              <>
                <div className="text-4xl font-extrabold tabular-nums leading-none whitespace-nowrap">
                  <span className={isFinal && !away.winner ? "opacity-60" : ""}>{away.score ?? 0}</span>
                  <span className="opacity-50 text-2xl mx-1.5">–</span>
                  <span className={isFinal && !home.winner ? "opacity-60" : ""}>{home.score ?? 0}</span>
                </div>
                <div className={"text-xs font-extrabold uppercase mt-2 tracking-widest " + (isLive ? "text-white" : "opacity-90")}>{isLive ? (g?.detail || game.detail) : "Final"}</div>
              </>
            )}
          </div>
          <Side t={home} color={ch} right />
        </div>
        {(g?.venue || game.venue) && <div className="text-center text-[11px] opacity-75 mt-3">{g?.venue || game.venue}</div>}
      </div>
      <div className="px-4 mt-4 space-y-4">
        {state !== "pre" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center px-4 py-2 text-[10px] font-extrabold tracking-widest uppercase text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800">
              <span className="flex-1">Scoring by quarter</span>
              {Array.from({ length: qs }).map((_, i) => <span key={i} className="w-10 text-center">{qLabel(i)}</span>)}
              <span className="w-10 text-center">T</span>
            </div>
            {[away, home].map((t) => (
              <div key={t.abbr} className="flex items-center px-4 py-2.5 border-b last:border-0 border-slate-100 dark:border-slate-800">
                <span className="flex-1 flex items-center gap-2 min-w-0"><img src={t.logo || TEAM_LOGOS[t.abbr] || ""} alt="" className="w-6 h-6 object-contain" style={logoTrim(t.abbr)} /><span className="text-sm font-extrabold text-slate-900 dark:text-white">{t.abbr}</span></span>
                {Array.from({ length: qs }).map((_, i) => <span key={i} className="w-10 text-center text-sm font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{t.linescores?.[i] ?? "—"}</span>)}
                <span className="w-10 text-center text-base font-extrabold text-slate-900 dark:text-white tabular-nums">{t.score ?? 0}</span>
              </div>
            ))}
          </div>
        )}
        {g && Object.keys(g.leaders || {}).length > 0 && (
          <div>
            <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mb-2 px-1">Leaders</div>
            <div className="grid grid-cols-2 gap-2">
              {[away, home].map((t) => (
                <div key={t.abbr} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-3" style={{ borderTop: "4px solid " + teamColor(t.abbr) }}>
                  <div className="text-[10px] font-extrabold tracking-widest uppercase text-slate-400 mb-1.5">{t.abbr}</div>
                  {(g.leaders[t.abbr] || []).slice(0, 3).map((l) => (
                    <div key={l.cat} className="flex items-center gap-2 py-1">
                      {l.headshot ? <img src={l.headshot} alt="" className="w-7 h-7 rounded-full object-cover object-top bg-slate-200" /> : <span className="w-7 h-7 rounded-full bg-slate-200" />}
                      <span className="flex-1 min-w-0"><span className="block text-[11px] font-bold text-slate-900 dark:text-white truncate">{l.name}</span><span className="block text-[9px] text-slate-400 uppercase">{l.cat}</span></span>
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">{l.value}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        {game.state === "pre" && <FullCourt game={game} teams={teams} players={players} onSelect={onSelectPlayer} />}
        {g && g.box && (g.box[away.abbr] || g.box[home.abbr]) && (() => {
          const t = boxTeam === home.abbr ? home : away;
          const bx = g.box[t.abbr] || { cols: [], rows: [] };
          const want = ["MIN", "PTS", "REB", "AST", "STL", "BLK", "TO", "FG", "3PT", "FT", "+/-"];
          const idx = want.map((w) => bx.cols.indexOf(w));
          const c = teamColor(t.abbr);
          const minIdx = bx.cols.indexOf("MIN");
          const mins = (r) => { const v = String(r.stats[minIdx] ?? "0"); const [m, sec] = v.split(":"); return Number(m) + (sec ? Number(sec) / 60 : 0); };
          const LBL = { PG: 1, G: 1.5, SG: 2, "G-F": 2.5, SF: 3, F: 3.5, "F-G": 3, PF: 4, "F-C": 4.5, "C-F": 4.5, C: 5 };
          const posScore = (r) => {
            const nm = espnNrm(r.name); const last = nm.split(" ").pop();
            const p = (players || []).find((q) => espnNrm(q.name) === nm) || (players || []).find((q) => { const qn = espnNrm(q.name); return qn.endsWith(" " + last) && qn[0] === nm[0]; });
            return (p && (Number(p.sort) || LBL[courtPos(p)])) || LBL[String(r.pos || "").toUpperCase()] || 3;
          };
          const played = (r) => r.starter || mins(r) > 0;
          const rows = [...bx.rows.filter((r) => !r.dnp && r.starter).sort((a, b) => posScore(a) - posScore(b)), ...bx.rows.filter((r) => !r.dnp && !r.starter && played(r)).sort((a, b) => mins(b) - mins(a))];
          const dnp = [...bx.rows.filter((r) => r.dnp), ...bx.rows.filter((r) => !r.dnp && !played(r)).map((r) => ({ ...r, dnp: true, reason: r.reason || "DID NOT PLAY" }))];
          return (
            <div>
              <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mb-2 px-1">Box score · tap a team to switch</div>
              <div className="flex gap-2 mb-2">
                {[away, home].map((x) => (
                  <button key={x.abbr} onClick={() => setBoxTeam(x.abbr)}
                    className={"flex-1 py-2 rounded-full text-sm font-extrabold border flex items-center justify-center gap-2 " + (boxTeam === x.abbr ? "text-white border-transparent" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800")}
                    style={boxTeam === x.abbr ? { backgroundColor: teamColor(x.abbr) } : undefined}>
                    <img src={x.logo || TEAM_LOGOS[x.abbr] || ""} alt="" className="w-5 h-5 object-contain" style={boxTeam === x.abbr ? logoOnColor(x.abbr) : logoTrim(x.abbr)} />{x.abbr}
                  </button>
                ))}
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[11px] tabular-nums">
                    <thead>
                      <tr className="text-white" style={{ backgroundColor: c }}>
                        <th className="text-left font-extrabold px-3 py-2 sticky left-0" style={{ backgroundColor: c }}>PLAYER</th>
                        {want.map((w) => <th key={w} className="font-extrabold px-2 py-2 text-center">{w}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {rows.map((r, i) => (
                        <tr key={r.id || i} className={"text-slate-900 dark:text-white " + (r.starter ? "font-bold" : "font-medium")}
                          style={!r.starter && i > 0 && rows[i - 1].starter ? { borderTop: "3px solid " + c } : undefined}>
                          <td className="px-3 py-2 sticky left-0 bg-white dark:bg-slate-900 whitespace-nowrap">
                            <span className="font-bold text-slate-900 dark:text-white">{r.name}</span>
                            <span className="ml-1 text-[9px] font-semibold text-slate-400">{r.pos}</span>
                          </td>
                          {idx.map((k, j) => <td key={j} className={"px-2 py-2 text-center whitespace-nowrap " + (want[j] === "PTS" ? "font-extrabold text-slate-900 dark:text-white" : "")}>{k >= 0 ? (r.stats[k] ?? "—") : "—"}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {dnp.length > 0 && <div className="px-3 py-2 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800">DNP: {dnp.map((r) => r.name + (r.reason ? " (" + r.reason + ")" : "")).join(" · ")}</div>}
              </div>
            </div>
          );
        })()}
        {g && (g.plays || []).length > 0 && (
          <div>
            <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mb-2 px-1">{isLive ? "Latest plays" : "Final plays"}</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {g.plays.slice(0, 15).map((pl) => (
                <div key={pl.id} className="flex items-start gap-3 px-4 py-2.5" style={{ borderLeft: "3px solid " + (pl.team ? teamColor(pl.team) : "transparent") }}>
                  <span className="flex-1 min-w-0">
                    <span className={"block text-[12px] leading-snug text-slate-900 dark:text-white " + (pl.scoring ? "font-bold" : "font-normal")}>{pl.text}</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">{pl.period ? "Q" + pl.period + " " : ""}{pl.clock}</span>
                  </span>
                  {pl.scoring && pl.away != null && <span className="text-[12px] font-extrabold text-slate-700 dark:text-slate-200 tabular-nums shrink-0">{pl.away}–{pl.home}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {!g && <div className="text-center text-xs text-slate-400 py-8">Loading game…</div>}
      </div>
    </div>
  );
}

// ═══════════════ INJURY FEED STORE + UNSEEN BADGE ════════════════
// The feed is loaded once at app start (and refreshed every 15 min). The
// last time you opened the Injury Report is remembered on the device; any
// update to one of YOUR players newer than that counts as unseen and shows
// as a badge on the Players tab and the Injury Report pill until you open it.
const INJ_SEEN_KEY = "hrb_injury_seen_at";
const readSeen = () => { try { return Number(localStorage.getItem(INJ_SEEN_KEY) || 0); } catch { return 0; } };
const writeSeen = (t) => { try { localStorage.setItem(INJ_SEEN_KEY, String(t)); } catch {} };
const INJ_BY_NAME = {};
const INJ_UPDATED = { at: null }; // ESPN injury-feed record per player name (filled by useInjuryFeed)
let INJ_LOADED = false;  // once the live feed is in, the 6-hour roster cache is no longer trusted for status
const injOf = (p) => (p ? INJ_BY_NAME[espnNrm(p.name)] || null : null);
function useInjuryFeed(players) {
  const [feed, setFeed] = useState(null);
  const [seenAt, setSeenAt] = useState(readSeen);
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/injuries").then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d && d.records) {
          for (const k of Object.keys(INJ_BY_NAME)) delete INJ_BY_NAME[k];         // rebuild: a player who dropped off the feed is healthy again
          for (const r of d.records) { const k = espnNrm(r.name); if (!INJ_BY_NAME[k]) INJ_BY_NAME[k] = r; }
          INJ_LOADED = true; INJ_UPDATED.at = d.updatedAt || new Date().toISOString();
        }
        setFeed(d && d.records ? d : { records: [], error: d?.error || "unavailable" });
      })
      .catch(() => alive && setFeed({ records: [], error: "unreachable" }));
    load();
    const t = setInterval(load, 2 * 60 * 1000);                      // every 2 min while open
    const onWake = () => { if (document.visibilityState === "visible") load(); };   // and the moment the app is reopened
    document.addEventListener("visibilitychange", onWake);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", onWake); };
  }, []);
  const mine = useMemo(() => new Set((players || []).map((p) => espnNrm(p.name))), [players]);
  const unseen = useMemo(() => (feed?.records || []).filter((r) => mine.has(espnNrm(r.name)) && r.date && new Date(r.date).getTime() > seenAt).length, [feed, mine, seenAt]);
  const markSeen = () => {
    const latest = Math.max(seenAt, ...(feed?.records || []).map((r) => (r.date ? new Date(r.date).getTime() : 0)), 0);
    writeSeen(latest); setSeenAt(latest);
  };
  return { feed, unseen, markSeen };
}
function Badge({ n }) {
  if (!n) return null;
  return <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-extrabold flex items-center justify-center leading-none shadow">{n > 99 ? "99+" : n}</span>;
}

// ═══════════════ RECAPS (week / month digest from box scores) ═════
function RecapsFeed({ players, teams, onSelect, pills }) {
  const [days, setDays] = useState(7);
  const [d, setD] = useState(null);
  useEffect(() => { let alive = true; setD(null); fetch("/api/season-stats?recap=" + days).then((r) => r.json()).then((x) => alive && setD(x)).catch(() => alive && setD({ error: "unreachable" })); return () => { alive = false; }; }, [days]);
  const byName = (n) => (players || []).find((p) => espnNrm(p.name) === espnNrm(n));
  const teamBy = (ab) => (teams || []).find((t) => modernAbbr(t.abbr || toAbbr(t.name)) === modernAbbr(ab));
  const Section = ({ title, children }) => (
    <div className="mb-4">
      <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mb-2 px-1">{title}</div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">{children}</div>
    </div>
  );
  const PlayerRow = ({ r, big, sub }) => { const p = byName(r.name); const ab = r.team; return (
    <button onClick={() => p && onSelect(p)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800" style={{ borderLeft: "3px solid " + teamColor(ab) }}>
      {p ? <Avatar p={p} /> : <span className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />}
      <span className="flex-1 min-w-0"><span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{r.name}</span><span className="block text-[10px] font-semibold text-slate-400">{ab}{sub ? " · " + sub : ""}</span></span>
      <span className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">{big}</span>
    </button>
  ); };
  const TeamRow = ({ r, right }) => { const t = teamBy(r.team); return (
    <button onClick={() => t && onSelect && onSelect(t, "team")} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800" style={{ borderLeft: "3px solid " + teamColor(r.team) }}>
      <img src={TEAM_LOGOS[r.team] || ""} alt="" className="w-8 h-8 object-contain" style={logoTrim(r.team)} />
      <span className="flex-1 min-w-0"><span className="block text-sm font-bold text-slate-900 dark:text-white">{t ? t.name : r.team}</span><span className="block text-[10px] font-semibold text-slate-400">{r.w}-{r.l} · {fmt1(r.ppg)} scored · {fmt1(r.oppPpg)} allowed</span></span>
      <span className={"text-sm font-extrabold tabular-nums " + (r.margin >= 0 ? "text-green-600" : "text-red-500")}>{r.margin > 0 ? "+" : ""}{fmt1(r.margin)}</span>
    </button>
  ); };
  return (
    <div>
      <ListHeader title="Recaps" q={""} setQ={() => {}} pills={pills} noSearch />
      <div className="px-4 pb-28 mt-4">
        <div className="flex gap-2 mb-4">
          {[[7, "This week"], [14, "Two weeks"], [30, "This month"]].map(([n, l]) => <button key={n} onClick={() => setDays(n)} className={"flex-1 py-1.5 rounded-full text-[11px] font-extrabold border " + (days === n ? "bg-blue-600 text-white border-transparent" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800")}>{l}</button>)}
        </div>
        {!d && <div className="text-center text-xs text-slate-400 py-10">Adding up the box scores…</div>}
        {d && d.error && <div className="text-center text-xs text-slate-400 py-10">Couldn't build the recap right now.</div>}
        {d && !d.error && (
          <>
            <div className="text-[11px] font-semibold text-slate-400 mb-3">{d.games} games · {new Date(d.from).toLocaleDateString([], { month: "short", day: "numeric" })} – {new Date(d.to).toLocaleDateString([], { month: "short", day: "numeric" })}</div>
            <Section title="Teams of the week">{(d.teamsBest || []).map((r) => <TeamRow key={r.team} r={r} />)}</Section>
            <Section title="Rough week">{(d.teamsWorst || []).map((r) => <TeamRow key={r.team} r={r} />)}</Section>
            <Section title="Scoring leaders · per game">{(d.topScorers || []).map((r) => <PlayerRow key={r.name} r={r} big={fmt1(r.ppg)} sub={r.gp + " GP"} />)}</Section>
            <Section title="Biggest games">{(d.bigGames || []).map((r, i) => <PlayerRow key={i} r={r} big={r.pts} sub={`${r.reb} REB · ${r.ast} AST · ${r.home ? "vs" : "@"} ${r.opp}`} />)}</Section>
            {(d.tripleDoubles || []).length > 0 && <Section title="Triple-doubles">{d.tripleDoubles.map((r, i) => <PlayerRow key={i} r={r} big={`${r.pts}/${r.reb}/${r.ast}`} sub={`${r.home ? "vs" : "@"} ${r.opp}`} />)}</Section>}
            <Section title="Rebounding leaders · per game">{(d.topRebounders || []).map((r) => <PlayerRow key={r.name} r={r} big={fmt1(r.rpg)} sub={r.gp + " GP"} />)}</Section>
            <Section title="Assist leaders · per game">{(d.topPassers || []).map((r) => <PlayerRow key={r.name} r={r} big={fmt1(r.apg)} sub={r.gp + " GP"} />)}</Section>
            <Section title="Hot shooters · 3PM per game">{(d.topShooters || []).map((r) => <PlayerRow key={r.name} r={r} big={fmt1(r.p3pg)} sub={`${r.p3pct}% from three`} />)}</Section>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════ TRANSACTIONS (ESPN feed, newest first) ══════════
function TransactionsFeed({ players, teams, onSelect, pills, onlyTeam, embedded }) {
  const [q, setQ] = useState("");
  const [feed, setFeed] = useState(null);
  const year = null;
  useEffect(() => {
    let alive = true; setFeed(null);
    const qs = [onlyTeam ? "team=" + encodeURIComponent(modernAbbr(onlyTeam)) : "", onlyTeam ? "history=1" : ""].filter(Boolean).join("&");
    fetch("/api/transactions" + (qs ? "?" + qs : "")).then((r) => r.json()).then((d) => alive && setFeed(d && d.records ? d : { records: [], error: d?.error || "unavailable" })).catch(() => alive && setFeed({ records: [], error: "unreachable" }));
    return () => { alive = false; };
  }, [onlyTeam]);
  const KIND_CLS = { "Signing": "bg-green-600 text-white", "Option exercised": "bg-green-600 text-white", "Option declined": "bg-red-600 text-white", "Waived": "bg-red-600 text-white", "Trade": "bg-blue-600 text-white", "Two-way": "bg-purple-600 text-white", "G League": "bg-slate-500 text-white", "Transaction": "bg-slate-500 text-white" };
  const s0 = q.toLowerCase().trim();
  const same = (a, b) => modernAbbr(a) === modernAbbr(b) || (ABBR_VARIANTS[modernAbbr(a)] || []).includes(String(b).toUpperCase()) || (ABBR_VARIANTS[modernAbbr(b)] || []).includes(String(a).toUpperCase());
  const recs = (feed?.records || []).filter((r) => (!onlyTeam || same(r.team, onlyTeam)) && (!s0 || r.text.toLowerCase().includes(s0) || r.teamName.toLowerCase().includes(s0) || r.team.toLowerCase().includes(s0)));
  const groups = [];
  for (const r of recs) {
    const d = r.date ? new Date(r.date) : null;
    const key = d && !isNaN(d) ? d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }).toUpperCase() : "UNDATED";
    let g = groups[groups.length - 1]; if (!g || g.key !== key) { g = { key, items: [] }; groups.push(g); }
    g.items.push(r);
  }
  // tap a transaction → open the player it names, if he's in your database
  const playerIn = (text) => players.find((p) => text.includes(p.name)) || players.find((p) => { const last = p.name.split(" ").pop(); return last.length > 3 && new RegExp("\\b" + last + "\\b").test(text); });
  return (
    <div>
      {!embedded && <ListHeader title="Transactions" q={q} setQ={setQ} pills={pills} placeholder="Search players or teams…" />}
      <div className={embedded ? "px-4 pb-6 mt-4" : "px-4 pb-28 mt-4"}>
        {!feed && <div className="text-center text-xs text-slate-400 py-10">Loading ESPN feed…</div>}
        {feed && feed.error && <div className="text-center text-xs text-slate-400 py-10">Couldn't reach ESPN's transactions feed. Try again in a minute.</div>}
        {feed && !feed.error && <div className="text-[11px] font-semibold text-slate-400 mb-3">ESPN feed · {recs.length} transactions{onlyTeam ? " · full history" : ""} · newest first</div>}
        {groups.map((g) => (
          <div key={g.key}>
            <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mb-2 px-1">{g.key}</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden mb-4">
              {g.items.map((r) => {
                const p = playerIn(r.text);
                return (
                  <button key={r.id} onClick={p ? () => onSelect(p) : undefined} className="w-full flex items-start gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800" style={{ borderLeft: "3px solid " + teamColor(r.team) }}>
                    {TEAM_LOGOS[r.team] ? <img src={TEAM_LOGOS[r.team]} alt="" className="w-9 h-9 object-contain shrink-0 mt-0.5" style={logoTrim(r.team)} /> : <span className="w-9 h-9 rounded-full shrink-0" style={{ backgroundColor: teamColor(r.team) }} />}
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 mb-1">
                        <span className={"px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide " + (KIND_CLS[r.kind] || KIND_CLS.Transaction)}>{r.kind}</span>
                        <span className="text-[11px] font-semibold text-slate-400">{r.team}</span>
                      </span>
                      <span className="block text-[12px] text-slate-900 dark:text-white leading-snug">{r.text}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {feed && !feed.error && recs.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No {onlyTeam ? onlyTeam + " " : ""}transactions{q ? ` matching "${q}"` : ""} in ESPN's recent feed.</div>}
      </div>
    </div>
  );
}

// ═══════════════ INJURY REPORT (ESPN feed, newest first) ═════════
function InjuryFeed({ players, teams, onSelect, pills, feed, markSeen }) {
  const [q, setQ] = useState("");
  // Opening the report is what clears the badge — once the feed is in hand.
  useEffect(() => { if (feed && !feed.error) markSeen(); }, [feed]);
  const byName = useMemo(() => { const m = {}; for (const p of players) m[espnNrm(p.name)] = p; return m; }, [players]);
  const abbrOfTeamName = (name) => { const t = (teams || []).find((t) => String(t.name).toLowerCase() === String(name).toLowerCase()); return t ? (t.abbr || toAbbr(t.name)) : toAbbr(name); };
  const s = q.toLowerCase().trim();
  const recs = (feed?.records || []).filter((r) => !s || r.name.toLowerCase().includes(s) || r.team.toLowerCase().includes(s));
  // group by ESPN update date
  const groups = [];
  for (const r of recs) {
    const d = r.date ? new Date(r.date) : null;
    const key = d && !isNaN(d) ? d.toLocaleDateString([], { month: "short", day: "numeric" }).toUpperCase() : "UNDATED";
    let g = groups[groups.length - 1]; if (!g || g.key !== key) { g = { key, items: [] }; groups.push(g); }
    g.items.push(r);
  }
  const stamp = feed?.updatedAt ? new Date(feed.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
  return (
    <div>
      <ListHeader title="News" q={q} setQ={setQ} pills={pills} placeholder="Search players or teams…" />
      <div className="px-4 pb-28 mt-4">
        {!feed && <div className="text-center text-xs text-slate-400 py-10">Loading ESPN feed…</div>}
        {feed && feed.error && <div className="text-center text-xs text-slate-400 py-10">Couldn't reach ESPN's injury feed. Try again in a minute.</div>}
        {feed && !feed.error && (
          <div className="text-[11px] font-semibold text-slate-400 mb-3">ESPN feed · {recs.length} records{stamp ? " · " + stamp : ""} · newest update first</div>
        )}
        {groups.map((g) => (
          <div key={g.key}>
            <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mb-2 px-1">{g.key}</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden mb-4">
              {g.items.map((r) => {
                const p = byName[espnNrm(r.name)];
                const ab = abbrOfTeamName(r.team);
                const time = r.date ? new Date(r.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
                const photo = p ? photoOf(p) : r.headshot;
                const ret = r.returnDate ? new Date(r.returnDate) : null;
                return (
                  <button key={r.id} onClick={p ? () => onSelect(p) : undefined} className="w-full flex items-start gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800"
                    style={{ borderLeft: "3px solid " + teamColor(ab) }}>
                    <span className="w-12 shrink-0 flex justify-center mt-0.5">{TEAM_LOGOS[ab] ? <img src={TEAM_LOGOS[ab]} alt="" className="w-11 h-11 object-contain" style={logoTrim(ab)} /> : <TeamPill team={ab} />}</span>
                    {photo ? <img src={photo} alt="" className="w-11 h-11 rounded-full object-cover object-top bg-slate-200 shrink-0" /> : <span className="w-11 h-11 rounded-full bg-slate-200 shrink-0" />}
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {(() => { const no = r.jersey || (p && cleanNo(p.no)) || (p && espnOf(p)?.jersey); return no ? <span className="text-slate-400 font-extrabold mr-1.5">#{no}</span> : null; })()}{r.name}
                        </span>
                      </span>
                      <span className="flex items-center justify-between mt-1.5">
                        <StatusBadge status={r.status || "Injured"} />
                        <span className="text-[11px] font-semibold text-slate-400 tabular-nums">{time}</span>
                      </span>
                      {r.detail && <span className="block text-[11px] font-semibold text-red-500 mt-1">({tidyInjury(r.detail)})</span>}
                      {ret && !isNaN(ret) && <span className="block text-[11px] font-semibold text-slate-900 dark:text-white mt-0.5">Estimated Return Date: {ret.toLocaleDateString([], { month: "short", day: "numeric" })}</span>}
                      {r.comment && <span className="block text-[11px] text-slate-400 mt-1 leading-snug">{r.comment}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {feed && !feed.error && recs.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No injury records{q ? ` matching "${q}"` : ""}.</div>}
      </div>
    </div>
  );
}

// Anyone not fully Active, or with an injury note, is on the report.
const isHurt = (p) => {
  const s = String(p.status || "").toLowerCase();
  return (s && !s.includes("active") && !s.includes("available")) || !!p.injuryNotes;
};

// Retired = Status column says Retired (or Role does). Retired players keep
// their full profile; they just leave every roster, lineup, and leaderboard.
const isOverseas = (p) => /overseas|abroad|euro|international/i.test(String(p.status || "")) || /overseas/i.test(String(p.role || ""));
const isRetired = (p) => /retire/i.test(String(p.status || "")) || /retire/i.test(String(p.role || "")) || isOverseas(p);
function PlayersTab({ players, onSelect, pills, forceInj, title, tonight }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const base = players.filter((p) => matchesQuery(p, q));
    if (!forceInj) return base;
    // Out/IR first, then game-time decisions, alphabetical inside each group
    const sev = (p) => { const s = String(p.status || "").toLowerCase(); return s.includes("ir") || s.includes("out") ? 0 : 1; };
    return base.filter(isHurt).sort((a, b) => sev(a) - sev(b) || a.name.localeCompare(b.name));
  }, [players, q, forceInj]);
  return (
    <div>
      <ListHeader title={forceInj ? "Injury Report" : (title || "Players")} q={q} setQ={setQ} pills={pills} />
      {tonight && !q && tonight}
      <div className="px-4 pb-28 mt-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {list.map((p) => (
            <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-start gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
              {(() => { const ab = teamOfPlayer(p) || toAbbr(p.teamName) || toAbbr(activeOf(p)?.team); return <span className="w-8 h-8 shrink-0 self-center rounded-lg flex items-center justify-center text-[10px] font-extrabold uppercase text-white" style={{ backgroundColor: ab ? teamColor(ab) : "#64748b" }}>{courtPos(p) || "—"}</span>; })()}
              <Avatar p={p} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {cleanNo(p.no) && <span className="text-slate-400 font-extrabold mr-1.5">#{cleanNo(p.no)}</span>}{p.name}
                </span>
                <span className="block text-[11px] text-slate-400 font-medium truncate">
                  {[p.height, p.weight ? String(p.weight).replace(/\s*lbs?$/i, "") + " lbs" : "", p.age ? p.age + " yrs" : ""].filter(Boolean).join(" · ") || "—"}
                </span>
                {!isActiveStatus(p) && (
                  <span className="block mt-1.5">
                    <StatusBadge status={effectiveStatus(p) || "Injured"} />
                    {isSidelined(p) && injuryDetailOf(p) && <span className="block text-[11px] font-semibold text-red-500 mt-1">({injuryDetailOf(p)})</span>}
                  </span>
                )}
              </span>
              <span className={"shrink-0 w-12 flex justify-center " + (teamOfPlayer(p) ? "self-start" : "self-center")}><TeamPill team={teamOfPlayer(p) || p.teamName || activeOf(p)?.team} /></span>
            </button>
          ))}
          {list.length === 0 && forceInj && <div className="text-center text-sm text-slate-400 py-12 px-6">Nobody on the injury report{q ? ` matching "${q}"` : ""}. Everyone's Active.</div>}
          {list.length === 0 && !forceInj && <div className="text-center text-sm text-slate-400 py-12">No players match "{q}".</div>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ TAB: CONTRACTS ══════════════════════════════════

// Upcoming free agency: the earliest UFA/RFA year at/after the current season
function faStatus(p) {
  let best = null;
  for (const c of p.contracts || []) {
    for (const y of c.years || []) {
      const t = String(y.type || "").toUpperCase();
      if (t !== "UFA" && t !== "RFA") continue;
      if (String(y.season) < CURRENT_SEASON) continue;
      if (!best || String(y.season) < String(best.season)) best = { type: t, season: y.season };
    }
  }
  if (!best) return null;
  const yr = String(best.season).slice(0, 4); // "2026-2027" -> hits market summer 2026
  return { ...best, label: best.type + " " + yr };
}


function Rating2kBadge({ r }) {
  if (r == null) return null;
  const n = Math.round(r);
  const cls =
    n >= 90 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"        // gold
    : n >= 80 ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"          // silver
    : "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300";            // bronze
  return (
    <span className={"shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold " + cls}>
      {n} OVR
    </span>
  );
}

// Next contract event: earliest pending PO/TO or upcoming UFA/RFA on the active deal

// First year of a season string: "2026-2027" | "2026-27" -> 2026
function startYear(s) {
  const m = String(s || "").match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function nextEvent(p) {
  let best = null;
  for (const c of p.contracts || []) {
    if (CLOSED.test(String(c.status || ""))) continue;          // waived / expired / terminated deals have no next event; blank status still counts
    for (const y of c.years || []) {
      if (startYear(y.season) != null && startYear(y.season) < startYear(CURRENT_SEASON)) continue;
      const t = String(y.type || "").toUpperCase();
      let kind = null;
      if (t === "PO" || t === "TO") {
        // Settled options are history, not the next event: a Result/Decision is
        // filled in, the option year is already this season, or its deadline passed.
        const settled = !!y.decision || startYear(y.season) <= startYear(CURRENT_SEASON)
          || (() => { const d = eventDeadline({ kind: t, season: y.season, deadline: y.deadline || null }); return d && d.date && d.date < new Date(); })();
        if (!settled) kind = t;
      } else if (t === "UFA" || t === "RFA") kind = t;
      if (!kind) continue;
      if (!best || String(y.season) < String(best.season)) best = { kind, season: y.season, deadline: y.deadline || null };
    }
  }
  if (!best) return null;
  return { ...best, label: best.kind + " " + String(best.season).slice(0, 4) };
}

// Everyone who could be a free agent next summer: expiring (UFA/RFA) plus
// player/team options still undecided — declined options become free agents.
function faEligible(roster) {
  const cutoff = startYear(CURRENT_SEASON) + 1;
  return roster.filter((p) => { const e = nextEvent(p); return e && startYear(e.season) != null && startYear(e.season) <= cutoff; });
}
const EVENT_WORDS = { PO: "Player Option", TO: "Team Option", UFA: "Free Agent", RFA: "Restricted FA" };
const EVENT_COLORS = {
  PO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  TO: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300",
  UFA: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  RFA: "bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300",
};

// When the decision is actually due. An Airtable "Deadline" value on the
// contract year wins; otherwise the CBA's standard dates for that offseason:
// options must be exercised by June 29, free agency opens June 30 (6pm ET).
const mdy = (d) => String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getDate()).padStart(2, "0") + "/" + d.getFullYear();
function eventDeadline(ev) {
  if (!ev) return null;
  const yr = startYear(ev.season);             // "2027-2028" → 2027: the summer before that season
  if (ev.deadline) {
    const d = new Date(ev.deadline);
    return isNaN(d) ? { label: ev.deadline, date: null } : { label: mdy(d), date: d };
  }
  if (!yr) return null;
  const d = ev.kind === "PO" || ev.kind === "TO" ? new Date(yr, 5, 29) : new Date(yr, 5, 30);
  return { label: mdy(d), date: d, standard: true };
}
function EventPill({ ev, withDate, noYear }) {
  if (!ev) return null;
  const cls = EVENT_COLORS[ev.kind] || EVENT_COLORS.UFA;
  const dl = withDate && (ev.kind === "PO" || ev.kind === "TO") ? eventDeadline(ev) : null; // deadlines are for options only
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={"inline-flex shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide " + cls}>
        {ev.kind === "UFA"
          ? <>Free Agent{noYear ? "" : " " + (startYear(ev.season) ?? seasonTick({ season: ev.season }))}</>
          : <>{EVENT_WORDS[ev.kind] || ev.kind} {seasonTick({ season: ev.season })}</>}
      </span>
      {dl && <span className="text-[9px] font-semibold text-slate-400 whitespace-nowrap">(deadline {dl.label})</span>}
    </span>
  );
}


// The season after the current one - "2025-2026" -> "2026-2027". Rolls forward with CURRENT_SEASON.
function nextSeason(s) {
  const m = String(s).match(/(\d{4})\s*-\s*(\d{4})/);
  if (!m) return null;
  return (Number(m[1]) + 1) + "-" + (Number(m[2]) + 1);
}

function ContractsTab({ players, onSelect, pills }) {
  const [q, setQ] = useState("");
  const [faOnly, setFaOnly] = useState(false);
  const list = useMemo(
    () =>
      players
        .filter((p) => p.contracts.length > 0)
        .filter((p) => matchesQuery(p, q))
        .filter((p) => {
          if (!faOnly) return true;
          const ev = nextEvent(p);                       // UFA, RFA, player + team options
          return ev && startYear(ev.season) === startYear(CURRENT_SEASON) + 1;
        })
        .slice()
        .sort((x, y) => {
          if (faOnly) {
            const rank = { UFA: 0, RFA: 1, PO: 2, TO: 3 };
            const ex = nextEvent(x), ey = nextEvent(y);
            const rx = rank[ex?.kind] ?? 9, ry = rank[ey?.kind] ?? 9;
            if (rx !== ry) return rx - ry;              // free agents first, then options
          }
          const sx = currentSalary(x), sy = currentSalary(y);
          if (sy !== sx) return sy - sx;               // biggest current-season salary first
          return x.name.localeCompare(y.name);          // $0 group: alphabetical
        }),
    [players, q, faOnly]
  );
  return (
    <div>
      <ListHeader title="Contracts" q={q} setQ={setQ} pills={pills} />
      <div className="px-4 mt-3 flex gap-2">
        {[["All", false], ["Free Agency " + (startYear(CURRENT_SEASON) + 1), true]].map(([lbl, v]) => (
          <button key={lbl} onClick={() => setFaOnly(v)}
            className={"px-4 py-1.5 rounded-full text-xs font-bold " + (faOnly === v
              ? "bg-blue-600 text-white"
              : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
            {lbl}
          </button>
        ))}
      </div>
      <div className="px-4 pb-28 mt-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {list.map((p) => {
            const act = activeOf(p);
            return (
              <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                <Avatar p={p} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                  <span className="block text-[11px] text-slate-400 font-medium truncate">
                    {act ? <ContractLine c={act} /> : "No contract"}
                  </span>
                  {nextEvent(p) && (
                    <span className="block mt-1"><EventPill ev={nextEvent(p)} /></span>
                  )}
                </span>
                {currentSalary(p) > 0 && (
                  <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 shrink-0">{fmtM(currentSalary(p))}</span>
                )}
                <TeamPill team={teamOfPlayer(p) || act?.team} />
              </button>
            );
          })}
          {list.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No players match "{q}".</div>}
        </div>
      </div>
    </div>
  );
}


// ═══════════════ TAB: TEAMS ══════════════════════════════════════
function teamOfPlayer(p) {
  return toAbbr(p.teamName) || (activeOf(p) ? toAbbr(activeOf(p).team) || activeOf(p).team : "");
}

function currentSalary(p) {
  const act = activeOf(p);
  if (!act) return 0;
  const yr = act.years.find((y) => y.season === CURRENT_SEASON && y.salary != null);
  if (yr) return yr.salary;
  const first = salaried(act)[0];
  return first ? first.salary : 0;
}

const ROLE_ORDER = ["Starter", "Bench", "Reserve", "Two-Way"];

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

function winPct(t) {
  const w = t.wins ?? 0, l = t.losses ?? 0;
  return w + l > 0 ? w / (w + l) : -1;
}

// The "Free Agents" row in the Teams table isn't a team: no court, no tiles.
// Everyone on a team's roster: the Airtable link first, name match as backup.
// Retired / overseas players never appear on a roster.
function rosterOf(team, players) {
  const abbr = team.abbr || toAbbr(team.name);
  return (players || []).filter((p) => {
    if (isRetired(p)) return false;
    if (p.teamId && p.teamId === team.id) return true;
    if (p.teamId) return false;                                  // Airtable's Team link is the roster of record — a contract can't override it
    const t = teamOfPlayer(p);
    return t && (t === abbr || String(p.teamName).toLowerCase() === String(team.name).toLowerCase());
  });
}
const isFaTeam = (t) => !!t && (/free\s*agent/i.test(String(t.name || "")) || String(t.abbr || "").toUpperCase() === "FA");

// ── Playoff bracket: East builds left→right on top, West right→left below, Finals in the middle ──
function PlayoffBracket({ teams, onSelect }) {
  const seedsOf = (k) => (teams || []).filter((t) => !isFaTeam(t) && confKey(t) === k).sort((a, b) => winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0) || ((b.ppg ?? 0) - (b.oppPpg ?? 0)) - ((a.ppg ?? 0) - (a.oppPpg ?? 0))).slice(0, 10);
  const Team = ({ t, seed, right }) => {
    const ab = t ? (t.abbr || toAbbr(t.name)) : "";
    return (
      <button onClick={() => t && onSelect(t)} className={"flex items-center gap-1 h-8 px-1.5 w-full " + (right ? "flex-row-reverse text-right" : "")}>
        {t ? <img src={t.logo || TEAM_LOGOS[ab] || ""} alt="" className="w-5 h-5 object-contain shrink-0" style={logoTrim(ab)} /> : <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />}
        <span className="text-[9px] font-extrabold text-slate-400 w-3">{seed}</span>
        <span className="text-[11px] font-extrabold text-slate-900 dark:text-white truncate">{t ? ab : "TBD"}</span>
        {t && <span className="text-[9px] font-semibold text-slate-400 tabular-nums">{t.wins ?? 0}-{t.losses ?? 0}</span>}
      </button>
    );
  };
  const Pair = ({ a, b, sa, sb, right, proj }) => (
    <div className={"rounded-xl border bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 shadow-sm relative " + (proj ? "border-dashed border-slate-300 dark:border-slate-600 opacity-80" : "border-slate-200 dark:border-slate-700")}>
      {proj && <span className={"absolute -top-2 text-[8px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-950 px-1 " + (right ? "right-2" : "left-2")}>proj.</span>}
      <Team t={a} seed={sa} right={right} /><Team t={b} seed={sb} right={right} />
    </div>
  );
  // connector between two stacked pairs and the next-round slot
  const Join = ({ right }) => (
    <div className={"w-4 shrink-0 self-stretch flex flex-col " + (right ? "items-end" : "items-start")}>
      <div className={"flex-1 w-1/2 border-slate-300 dark:border-slate-600 " + (right ? "border-l-2 border-b-2 rounded-bl-md" : "border-r-2 border-b-2 rounded-br-md")} style={{ marginTop: 32 }} />
      <div className={"flex-1 w-1/2 border-slate-300 dark:border-slate-600 " + (right ? "border-l-2 border-t-2 rounded-tl-md" : "border-r-2 border-t-2 rounded-tr-md")} style={{ marginBottom: 32 }} />
    </div>
  );
  const Conf = ({ k, title, right }) => {
    const seeds = seedsOf(k);
    const S = (n) => seeds[n - 1] || null;
    const r1 = [[1, 8], [4, 5], [3, 6], [2, 7]];
    const col1 = (
      <div className="flex flex-col justify-around gap-2 w-[112px] shrink-0">
        {r1.map(([a, b]) => <Pair key={a} a={S(a)} b={S(b)} sa={a} sb={b} right={right} />)}
      </div>
    );
    // Projected: the higher seed advances (what "if the season ended today" means for later rounds)
    const col2 = (
      <div className="flex flex-col justify-around gap-2 w-[112px] shrink-0">
        <Pair a={null} b={null} sa="" sb="" right={right} /><Pair a={null} b={null} sa="" sb="" right={right} />
      </div>
    );
    const col3 = (
      <div className="flex flex-col justify-around w-[112px] shrink-0">
        <Pair a={null} b={null} sa="" sb="" right={right} />
      </div>
    );
    const cols = [col1, <Join key="j1" right={right} />, col2, <Join key="j2" right={right} />, col3];
    return (
      <div>
        <div className={"flex items-center justify-between px-1 mb-2 " + (right ? "flex-row-reverse" : "")}>
          <span className="text-[11px] font-extrabold tracking-widest uppercase text-slate-900 dark:text-white">{title}</span>
          <span className="text-[9px] font-semibold text-slate-400">First round · Conf. semis · Conf. finals</span>
        </div>
        <div className={"flex items-stretch " + (right ? "flex-row-reverse" : "")}>{cols}</div>
        <div className={"mt-2 text-[9px] text-slate-400 " + (right ? "text-right" : "")}>
          Play-in: <span className="font-bold text-slate-600 dark:text-slate-300">7 {S(7) ? (S(7).abbr || toAbbr(S(7).name)) : "—"}</span> v <span className="font-bold text-slate-600 dark:text-slate-300">8 {S(8) ? (S(8).abbr || toAbbr(S(8).name)) : "—"}</span> for the 7 seed · <span className="font-bold text-slate-600 dark:text-slate-300">9 {S(9) ? (S(9).abbr || toAbbr(S(9).name)) : "—"}</span> v <span className="font-bold text-slate-600 dark:text-slate-300">10 {S(10) ? (S(10).abbr || toAbbr(S(10).name)) : "—"}</span>, winner meets the 7/8 loser for the 8 seed
        </div>
      </div>
    );
  };
  return (
    <div className="mt-4 space-y-5">
      <div className="text-[10px] font-semibold text-slate-400 px-1">Seeding if the season ended today · 7 and 8 are the current 7th and 8th pending the play-in</div>
      <Conf k="east" title="Eastern Conference" />
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
        <div className="rounded-2xl border-2 border-amber-400 bg-white dark:bg-slate-900 px-5 py-2 text-center shadow-sm">
          <div className="text-[9px] font-extrabold tracking-widest uppercase text-amber-500">NBA Finals</div>
          <div className="text-[11px] font-extrabold text-slate-400 mt-0.5">East champ · West champ</div>
        </div>
        <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
      </div>
      <Conf k="west" title="Western Conference" right />
    </div>
  );
}

// Conference standings tables with the playoff (1–6) and play-in (7–10) lines
const confKey = (t) => { const c = String(t.conference || "").toLowerCase(); return c.startsWith("east") ? "east" : c.startsWith("west") ? "west" : "other"; };
function StandingsTable({ teams, onSelect }) {
  const confs = [["east", "Eastern Conference"], ["west", "Western Conference"]];
  const gbOf = (t, leader) => { if (t.gb != null && t.gb !== "") return t.gb; const d = ((leader.wins - t.wins) + (t.losses - leader.losses)) / 2; return d === 0 ? "—" : d.toFixed(1); };
  return (
    <div className="mt-4 space-y-4">
      {confs.map(([k, title]) => {
        // Sort: win % → NBA tiebreak order where the feed allows: division winner → net rating
        // (head-to-head isn't in the feed). Tied rows are marked TB.
        const divLeaders = new Set();
        const byDiv = {};
        for (const t of (teams || []).filter((t) => !isFaTeam(t) && confKey(t) === k)) (byDiv[t.division] ||= []).push(t);
        for (const list of Object.values(byDiv)) divLeaders.add(list.slice().sort((a, b) => winPct(b) - winPct(a))[0]?.id);
        const net = (t) => (t.ppg ?? 0) - (t.oppPpg ?? 0);
        const rows = (teams || []).filter((t) => !isFaTeam(t) && confKey(t) === k).sort((a, b) => winPct(b) - winPct(a) || (divLeaders.has(b.id) - divLeaders.has(a.id)) || net(b) - net(a));
        const leader = rows[0];
        // Clinch / elimination (x = playoffs, p = play-in or better, e = eliminated)
        const played = (t) => (t.wins ?? 0) + (t.losses ?? 0), left = (t) => Math.max(0, 82 - played(t)), maxW = (t) => (t.wins ?? 0) + left(t);
        const clinch = {};
        rows.forEach((t) => {
          const seventh = rows[6], eleventh = rows[10], tenth = rows[9];
          if (seventh && (t.wins ?? 0) > maxW(seventh)) clinch[t.id] = "x";
          else if (eleventh && (t.wins ?? 0) > maxW(eleventh)) clinch[t.id] = "p";
          else if (tenth && maxW(t) < (tenth.wins ?? 0)) clinch[t.id] = "e";
        });
        const tied = (i) => rows[i - 1] && winPct(rows[i - 1]) === winPct(rows[i]);
        const abOf = (t) => t.abbr || toAbbr(t.name);
        return (
          <div key={k} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 text-[11px] font-extrabold tracking-widest uppercase text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span>{title}</span><span className="text-slate-400 font-semibold normal-case tracking-normal text-[10px] text-right">1–6 playoffs · 7–10 play-in</span>
            </div>
            <table className="w-full text-[11px] tabular-nums">
              <thead><tr className="text-slate-400 text-[9px] font-extrabold uppercase"><th className="text-left pl-3 py-1.5 w-7">#</th><th className="text-left py-1.5">Team</th><th className="py-1.5">W-L</th><th className="py-1.5">GB</th><th className="py-1.5">L10</th><th className="py-1.5 pr-3">Strk</th></tr></thead>
              <tbody>
                {rows.map((t, i) => {
                  const ab = t.abbr || toAbbr(t.name);
                  const line = i === 6 ? "border-t-2 border-green-500" : i === 10 ? "border-t-2 border-red-400" : "border-t border-slate-100 dark:border-slate-800";
                  const mark = clinch[t.id];
                  return (
                    <tr key={t.id} onClick={() => onSelect(t)} className={"text-slate-900 dark:text-white active:bg-slate-50 dark:active:bg-slate-800 " + line}>
                      <td className="pl-3 py-2 font-extrabold text-slate-400">{i + 1}{mark && <span className={"ml-0.5 text-[9px] " + (mark === "e" ? "text-red-400" : "text-green-600")}>{mark}</span>}</td>
                      <td className="py-2"><span className="flex items-center gap-2"><img src={t.logo || TEAM_LOGOS[ab] || ""} alt="" className="w-6 h-6 object-contain" style={logoTrim(ab)} /><span className="font-bold">{ab}</span>{tied(i) && <span className="text-[8px] font-bold text-slate-400">TB</span>}{divLeaders.has(t.id) && <span className="text-[8px] font-bold text-amber-500">★</span>}</span></td>
                      <td className="py-2 text-center font-extrabold">{t.wins ?? 0}-{t.losses ?? 0}</td>
                      <td className="py-2 text-center text-slate-500">{leader ? gbOf(t, leader) : "—"}</td>
                      <td className="py-2 text-center text-slate-500">{t.l10 || "—"}</td>
                      <td className={"py-2 pr-3 text-center font-bold " + (/^W/.test(t.streak || "") ? "text-green-600" : /^L/.test(t.streak || "") ? "text-red-500" : "text-slate-400")}>{t.streak || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-2 text-[9px] text-slate-400 border-t border-slate-100 dark:border-slate-800">x clinched playoffs · p clinched play-in or better · e eliminated · ★ division leader · TB tied record, ordered by tiebreaker (division winner, then net rating)</div>
          </div>
        );
      })}
    </div>
  );
}

function TeamsTab({ teams, players, onSelect }) {
  const [q, setQ] = useState("");
  const [conf, setConf] = useState("all"); // all | east | west | standings | playoffs
  const [div, setDiv] = useState(null);    // division name or null
  const s = q.toLowerCase().trim();
  // Direct team-name matches, plus teams of any player whose name matches -
  // searching "Brunson" surfaces the Knicks.
  const playerTeamAbbrs = new Set(
    s
      ? players
          .filter((p) => p.name.toLowerCase().includes(s))
          .map((p) => teamOfPlayer(p))
          .filter(Boolean)
      : []
  );
  const confOf = (t) => {
    const c = String(t.conference).toLowerCase();
    return c.startsWith("east") ? "east" : c.startsWith("west") ? "west" : "other";
  };
  // Divisional rank across ALL teams (unaffected by search/filters)
  const divRank = {};
  {
    const byDiv = {};
    for (const t of teams) { if (t.division) (byDiv[t.division] ??= []).push(t); }
    for (const arr of Object.values(byDiv)) {
      arr.sort((a, b) => winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0));
      arr.forEach((t, i) => { divRank[t.id] = ORDINALS[i] || `${i + 1}th`; });
    }
  }
  const divisions = conf === "all" ? [] :
    [...new Set(teams.filter((t) => confOf(t) === conf).map((t) => t.division).filter(Boolean))].sort();
  let list = teams.filter((t) => {
    if (conf !== "all" && conf !== "standings" && conf !== "playoffs" && confOf(t) !== conf) return false;
    if (div && t.division !== div) return false;
    if (!s) return true;
    if ((t.name + " " + t.abbr).toLowerCase().includes(s)) return true;
    const abbr = t.abbr || toAbbr(t.name);
    return playerTeamAbbrs.has(abbr);
  });
  list = [...list].sort((a, b) =>
    (isFaTeam(a) ? 1 : 0) - (isFaTeam(b) ? 1 : 0) ||   // Free Agents always last
    (conf === "all"
      ? String(a.name).localeCompare(String(b.name))
      : winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0))
  );
  const pickConf = (k) => { setConf(k); setDiv(null); };
  return (
    <div>
      <div className="px-4 pb-28" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex gap-2 mt-1">
          {[["all", "Teams"], ["east", "East"], ["west", "West"], ["standings", "Standings"], ["playoffs", "Playoffs"]].map(([k, lbl]) => (
            <button key={k} onClick={() => pickConf(k)}
              className={"flex-1 py-2 rounded-full text-[11px] font-bold transition-colors " + (conf === k
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
              {lbl}
            </button>
          ))}
        </div>
        {divisions.length > 0 && (
          <div className="flex gap-2 mt-2">
            {divisions.map((d) => (
              <button key={d} onClick={() => setDiv(div === d ? null : d)}
                className={"flex-1 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap text-center transition-colors " + (div === d
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
                {d}
              </button>
            ))}
          </div>
        )}
        {conf === "standings" && <StandingsTable teams={teams} onSelect={onSelect} />}
        {conf === "playoffs" && <PlayoffBracket teams={teams} onSelect={onSelect} />}
        <div className={"space-y-2.5 mt-4" + (conf === "standings" || conf === "playoffs" ? " hidden" : "")}>
          {list.map((t) => {
            const abbr = t.abbr || toAbbr(t.name);
            const c1 = teamColor(abbr), c2 = teamColor2(abbr);
            return (
              <button key={t.id} onClick={() => onSelect(t)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left rounded-2xl shadow-sm active:opacity-90 overflow-hidden relative"
                style={{ background: `linear-gradient(105deg, ${c1} 0%, ${mixHex(c1, c2, 0.45)} 100%)` }}>
                <span className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.10) 0%,rgba(0,0,0,0) 45%,rgba(0,0,0,0.12) 100%)" }} />
                {t.logo ? (
                  <img src={t.logo} alt="" className="w-12 h-12 object-contain shrink-0 relative" style={{ filter: (abbr === "HOU" ? "brightness(0) invert(1) " : "") + "drop-shadow(0 1px 2px rgba(0,0,0,0.35))", ...logoTrim(abbr) }} />
                ) : (
                  <span className="w-12 h-12 rounded-full shrink-0 bg-white/20 relative" />
                )}
                <span className="flex-1 min-w-0 relative">
                  <span className="block text-[17px] font-extrabold text-white truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>{isFaTeam(t) ? "Free Agents" : t.name}</span>
                  <span className="block text-[12px] text-white/75 font-medium truncate">
                    {t.division ? (divRank[t.id] ? `${divRank[t.id]} in ${t.division} Division` : t.division + " Division") : "—"}
                  </span>
                </span>
                {(t.wins != null || t.losses != null) && (
                  <span className="flex gap-3 shrink-0 relative">
                    {[["W", t.wins ?? 0], ["L", t.losses ?? 0]].map(([lbl, v]) => (
                      <span key={lbl} className="w-7 text-center">
                        <span className="block text-[9px] font-bold text-white/60 uppercase">{lbl}</span>
                        <span className="block text-lg font-extrabold text-white tabular-nums">{v}</span>
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {list.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No teams match{q ? ` "${q}"` : " the selected filters"}.</div>}
      </div>
    </div>
  );
}


function StatusBadge({ status }) {
  if (!status) return null;
  const s = String(status).toLowerCase().trim();
  let cls = "bg-slate-100 text-slate-500 dark:text-slate-400";
  if (s.includes("season")) cls = "bg-red-900 text-white";
  else if (s === "ir" || s.includes("injured reserve") || s.includes("out") || s.includes("suspend")) cls = "bg-red-600 text-white";
  else if (s.includes("active") || s.includes("available")) cls = "bg-green-600 text-white";
  else if (/overseas|abroad|retire/.test(s)) cls = "bg-slate-700 text-white";
  else if (s.includes("game time") || s === "gtd" || s.includes("injur") || s.includes("day") || s.includes("question") || s.includes("doubt") || s.includes("probable")) cls = "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
  return (
    <span className={"shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide " + cls}>
      {status}
    </span>
  );
}


// Committed salary for a player in a given season (active deals only)
function salaryInSeason(p, season) {
  for (const c of p.contracts || []) {
    if (c.status !== "Active") continue;
    for (const y of c.years || []) {
      if (y.season === season && y.salary != null) return { salary: y.salary, type: y.type, decision: y.decision };
    }
  }
  return null;
}
function seasonsAhead(n) {
  const out = [CURRENT_SEASON];
  for (let i = 1; i < n; i++) out.push(nextSeason(out[i - 1]));
  return out.filter(Boolean);
}
const LINE_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#f59e0b", "#0891b2"];

// ═══════════════ COURT VIEW (starting five on a half court) ══════
// Basketball's answer to the NFL formation field. Five slots on a hardwood
// half court; the paint is painted in the team color; the bench scrolls
// underneath. Health rings + badges read the Airtable Status field
// (Active / Game Time Decision / IR) that the injury sync keeps current.
const POS_ALIASES = {
  PG: ["PG", "G", "G-F", "F-G"], SG: ["SG", "G", "G-F", "F-G"],
  SF: ["SF", "F", "G-F", "F-G", "F-C"], PF: ["PF", "F", "F-C", "C-F"], C: ["C", "F-C", "C-F"],
};
// Symmetric: point at the top of the key, wings mirrored, bigs mirrored on
// the blocks. Same spacing left-to-right and top-to-bottom.
// Court box shows 6 ft beyond half court (full center circle + logo), then
// the 47 ft half court. Slot y values are % of that 53 ft box.
const COURT_TOP_FT = 8, APRON_FT = 3, COURT_FT = 47 + COURT_TOP_FT + APRON_FT;
const ftY = (ft) => ((ft + COURT_TOP_FT) / COURT_FT) * 100;
const COURT_SLOTS = [
  { lbl: "PG", x: 50, y: ftY(13.5), big: false }, // top of the key, above the arc
  { lbl: "SF", x: 24, y: ftY(22), big: false },   // sitting on the 3-pt arc
  { lbl: "SG", x: 76, y: ftY(22), big: false },
  { lbl: "PF", x: 24, y: ftY(37), big: true },
  { lbl: "C",  x: 76, y: ftY(37), big: true },
];
// Guard / Forward / Center bucket for the bench summary
function posGroup(p) {
  const x = courtPos(p);
  if (/^(PG|SG|G)/.test(x)) return "G";
  if (/^C/.test(x)) return "C";
  if (/^(SF|PF|F)/.test(x)) return "F";
  return null;
}
// "out" | "q" | "ok"  — from the Airtable Status field
function healthOf(p) {
  const s = String(p ? effectiveStatus(p) : "").toLowerCase().trim();
  if (!s) return "ok";
  if (s === "ir" || s.includes("injured reserve") || s.includes("out") || s.includes("suspend")) return "out";
  if (s.includes("active") || s.includes("available")) return "ok";          // Active is Active, even if an old note is still in the cell
  return "q"; // Game Time Decision, questionable, day-to-day…
}
const posOf = courtPos;
const lastNameOf = (p) => {
  const parts = String(p.name).split(" ");
  return /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(parts[parts.length - 1] || "") ? parts.slice(-2).join(" ") : parts.slice(-1)[0];
};
const bySort = (a, b) => (a.sort ?? 9999) - (b.sort ?? 9999) || currentSalary(b) - currentSalary(a);

// Pick the five. Starters (Airtable Role = "Starter") claim their natural
// slot first, then any open slot. An OUT/IR starter is skipped and the
// next healthy body at that position steps up from the bench; he keeps his
// OUT badge on the bench strip. A game-time decision stays on the court.
// abbr -> { starters: [{name,pos}], date, opp, result } from /api/lineups
const LINEUPS = {};
// Lineup lookup tolerant of every spelling of a team code (SA / SAS, NO / NOP, GS / GSW …)
function lineupFor(abbr) {
  const u = String(abbr || "").toUpperCase(); const m = modernAbbr(u);
  for (const k of [u, m, ...(ABBR_VARIANTS[m] || []), ...Object.entries(ABBR_VARIANTS).filter(([, v]) => v.includes(u)).flatMap(([k, v]) => [k, ...v])]) if (LINEUPS[k]) return LINEUPS[k];
  return undefined;
}
function espnStartersFor(roster, abbr) {
  const lu = lineupFor(abbr);
  if (!lu) return null;
  const names = new Set(lu.starters.map((a) => espnNrm(a.name)));
  const lastKey = (n) => espnNrm(n).split(" ").pop();
  const lasts = new Set(lu.starters.map((a) => lastKey(a.name)));
  const hits = roster.filter((p) => names.has(espnNrm(p.name)) || (lasts.has(lastKey(p.name)) && roster.filter((q) => lastKey(q.name) === lastKey(p.name)).length === 1));
  return hits.length >= 4 ? hits : null; // need most of the five to trust it
}
// Airtable is the single source of truth until ESPN confirms a lineup:
//   Role           → Starter / Bench / Reserve / Two-Way
//   Sort Priority  → position number for EVERY player: 1 PG · 2 SG · 3 SF · 4 PF · 5 C
// The five with Role = Starter go on the court in their Sort Priority slot.
// A starter who is OUT/IR drops to the bench and the healthy Bench/Reserve
// player with the same position number (most minutes first) takes his spot.
const SLOT_OF_SORT = { 1: "PG", 2: "SG", 3: "SF", 4: "PF", 5: "C" };
const roleOf = (p) => { const r = String(p.role || "").toLowerCase(); return r.includes("start") ? "Starter" : r.includes("bench") ? "Bench" : r.includes("reserve") ? "Reserves" : /two\s*-?\s*way/.test(r) ? "Two-Way" : "Reserves"; };
const mpgOf = (p) => { const c = curStats(p); if (c && c.gp > 0 && c.min != null) return c.min; return -1; };   // this season only; no game yet = bottom
const isTwoWay = (p) => roleOf(p) === "Two-Way" || /two\s*-?\s*way/i.test(String(activeOf(p)?.kind || ""));
const slotOfPlayer = (p) => SLOT_OF_SORT[Number(p.sort)] || (POS_ALIASES.PG.includes(courtPos(p)) && courtPos(p) === "PG" ? "PG" : courtPos(p));
const byMinutes = (a, b) => mpgOf(b) - mpgOf(a) || ((latestStats(b)?.min ?? -1) - (latestStats(a)?.min ?? -1)) || (Number(a.sort) || 99) - (Number(b.sort) || 99);

function pickStartingFive(roster, abbr) {
  const used = new Set();
  const assigned = new Array(COURT_SLOTS.length).fill(null);
  const nextUp = new Array(COURT_SLOTS.length).fill(false);
  const take = (i, p, stepped) => { assigned[i] = p; used.add(p.id); nextUp[i] = !!stepped; };
  const slotIdx = (lbl) => COURT_SLOTS.findIndex((s) => s.lbl === lbl);
  const espnFive = espnStartersFor(roster, abbr);

  if (espnFive) {
    // Confirmed lineup from ESPN's last box score: slot by position number,
    // then by position label, then wherever is open.
    // ESPN's box score lists each starter as G / F / C. That is the position
    // he actually played, so it beats the Airtable label: the C goes to C,
    // forwards to SF/PF, guards to PG/SG. Ties inside a group break on the
    // Airtable number, then height (taller → PF / C).
    const lu = lineupFor(abbr);
    const espnPos = (p) => { const hit = (lu?.starters || []).find((a) => espnNrm(a.name) === espnNrm(p.name) || espnNrm(a.name).split(" ").pop() === espnNrm(p.name).split(" ").pop()); return String(hit?.pos || "").toUpperCase(); };
    // Position score: Sort Priority (1 PG … 5 C) if set, else the Airtable
    // label, else height. Luka is a 1 no matter how tall he is.
    const LBL_SCORE = { PG: 1, G: 1.5, SG: 2, "G-F": 2.5, SF: 3, F: 3.5, "F-G": 3, PF: 4, "F-C": 4.5, "C-F": 4.5, C: 5 };
    const posScore = (p) => Number(p.sort) || LBL_SCORE[courtPos(p)] || (heightIn(p) >= 82 ? 4.5 : heightIn(p) >= 79 ? 3.5 : 2);
    const rankIn = (p) => posScore(p) * 1000 + heightIn(p);
    const grp = { C: [], F: [], G: [] };
    for (const p of espnFive) { const e = espnPos(p); const k = e.startsWith("C") ? "C" : e.startsWith("F") ? "F" : e.startsWith("G") ? "G" : (POS_ALIASES.C.includes(courtPos(p)) ? "C" : /F/.test(courtPos(p)) ? "F" : "G"); grp[k].push(p); }
    // more than one C → the taller stays at C, the other plays PF; more than two of a kind spill to the neighbor group
    const byScore = (a, b) => rankIn(a) - rankIn(b);                        // most guard-like first
    grp.C.sort(byScore); while (grp.C.length > 1) grp.F.push(grp.C.shift()); // extra C → the more forward-like one plays PF
    grp.F.sort(byScore); while (grp.F.length > 2) { if (!grp.C.length) grp.C.push(grp.F.pop()); else grp.G.push(grp.F.shift()); }   // 3 forwards: most center-like to C if empty, else most guard-like to G
    grp.G.sort(byScore); while (grp.G.length > 2) grp.F.unshift(grp.G.pop()); // 3 guards: the most forward-like one (highest number) moves up
    if (!grp.C.length && grp.F.length) { grp.F.sort(byScore); grp.C.push(grp.F.pop()); }   // no center listed → most center-like forward is the 5
    while (grp.F.length < 2 && grp.G.length > 2) grp.F.unshift(grp.G.pop());
    grp.F.sort(byScore);                                                    // SF = lower number, PF = higher
    grp.G.sort(byScore);                                                    // PG = lower number (1), SG = 2
    // Your Airtable number wins first: a 1 is the point guard no matter how
    // tall he is (Dončić, Conley). Only the leftover starters go by ESPN's
    // G/F/C and height.
    for (const p of espnFive) { const lbl = SLOT_OF_SORT[Number(p.sort)]; const i = lbl ? slotIdx(lbl) : -1; if (i >= 0 && !assigned[i]) take(i, p); }
    const plan = [["C", grp.C[0]], ["SF", grp.F[0]], ["PF", grp.F[1]], ["PG", grp.G[0]], ["SG", grp.G[1]]];
    for (const [lbl, p] of plan) { if (!p || used.has(p.id)) continue; const i = slotIdx(lbl); if (i >= 0 && !assigned[i]) take(i, p); }
    // anyone still standing: nearest open slot by position, else any open slot
    for (const p of espnFive) { if (used.has(p.id)) continue; const i = COURT_SLOTS.findIndex((s, k) => !assigned[k] && POS_ALIASES[s.lbl].includes(courtPos(p))); if (i >= 0) take(i, p); }
    for (const p of espnFive) { if (used.has(p.id)) continue; const i = assigned.findIndex((x) => !x); if (i >= 0) take(i, p); }
  } else {
    // Airtable: Role = Starter, slot = Sort Priority
    const starters = roster.filter((p) => roleOf(p) === "Starter").sort(byMinutes);
    for (const p of starters) {
      if (healthOf(p) === "out") continue;
      const i = slotIdx(slotOfPlayer(p));
      if (i >= 0 && !assigned[i]) take(i, p);
    }
    // a healthy starter whose slot was taken (two 3s, or no number) → first open compatible slot
    for (const p of starters) {
      if (used.has(p.id) || healthOf(p) === "out") continue;
      const i = COURT_SLOTS.findIndex((s, k) => !assigned[k] && POS_ALIASES[s.lbl].includes(courtPos(p)));
      if (i >= 0) take(i, p);
    }
  }
  // Holes (OUT starter, or fewer than five tagged): next man up — same
  // position number first, then a compatible position, most minutes first.
  const bench = roster.filter((p) => !used.has(p.id) && healthOf(p) !== "out" && !isTwoWay(p)).sort(byMinutes);
  const benchAny = roster.filter((p) => !used.has(p.id) && healthOf(p) !== "out").sort(byMinutes);
  COURT_SLOTS.forEach((s, i) => {
    if (assigned[i]) return;
    const hit = bench.find((p) => !used.has(p.id) && slotOfPlayer(p) === s.lbl)
      || bench.find((p) => !used.has(p.id) && POS_ALIASES[s.lbl].includes(courtPos(p)))
      || benchAny.find((p) => !used.has(p.id) && POS_ALIASES[s.lbl].includes(courtPos(p)))
      || benchAny.find((p) => !used.has(p.id));
    if (hit) take(i, hit, true);
  });
  // last resort: nobody healthy — show the hurt starter rather than a hole
  COURT_SLOTS.forEach((s, i) => {
    if (assigned[i]) return;
    const hit = roster.filter((p) => !used.has(p.id)).sort(byMinutes)[0];
    if (hit) take(i, hit);
  });
  return { assigned, nextUp, used, automated: !!espnFive, source: espnFive ? "espn" : "airtable" };
}

// Everything the court and the list view share: the five (in slot order),
// then Bench / Reserves / Two-Way by Role, each ordered by minutes. An OUT
// starter shows up in the Bench group with his IR badge.
function lineupOf(roster, abbr) {
  const r = pickStartingFive(roster, abbr);
  const notFive = roster.filter((p) => !r.used.has(p.id)).sort(byMinutes);
  // one Bench group: Bench + Reserves by minutes, two-way players at the end
  // Standard contracts fill the Bench; Exhibit 9/10 camp invites and two-way
  // players go in their own group so the 15-man roster stays readable.
  const isCamp = (p) => /exhibit/i.test(String(activeOf(p)?.kind || "")) || /exhibit|camp/i.test(String(p.role || ""));
  const bench = notFive.filter((p) => !isTwoWay(p) && !isCamp(p));
  const camp = [...notFive.filter((p) => isCamp(p) && !isTwoWay(p)), ...notFive.filter(isTwoWay)];
  const benchGroups = [["Bench", bench], ["Camp & Two-Way", camp]].filter(([, l]) => l.length);
  const LIST_ORDER = ["PG", "SG", "SF", "PF", "C"];
  const starters = COURT_SLOTS.map((s, i) => ({ slot: s.lbl, p: r.assigned[i] })).filter((x) => x.p).sort((a, b) => LIST_ORDER.indexOf(a.slot) - LIST_ORDER.indexOf(b.slot));
  return { ...r, benchGroups, bench: notFive, starters };
}

// ── Half-court line work, shared by the team court and the full-court matchup view ──
function HalfCourtLines({ th, color, abbr, team, nick }) {
  return (
    <>
          {/* painted key in the team color, with the paint texture the NFL end zone uses */}
          <defs>
            <pattern id="paintTex" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="0.6" height="1.2" fill="rgba(255,255,255,0.06)" />
            </pattern>
          </defs>
          {th.paint !== "none" && <rect x="17" y="28" width="16" height="19" fill={th.paint || color} opacity={th.paint ? 1 : 0.88} />}
          {th.paintSides && <>
            <rect x="15.6" y="28" width="1.4" height="19" fill={th.paintSides} />
            <rect x="33" y="28" width="1.4" height="19" fill={th.paintSides} />
          </>}
          {th.paint !== "none" && <rect x="17" y="28" width="16" height="19" fill="url(#paintTex)" />}
          {/* half-court line + full center circle */}
          <line x1="0" y1="0" x2="50" y2="0" stroke={th.half || "rgba(255,255,255,0.8)"} strokeWidth="0.3" />
          {th.centerStroke !== "none" && <circle cx="25" cy="0" r={th.circleR || 4.5} fill={th.center ?? centerColor(abbr)} stroke={th.centerStroke || "rgba(255,255,255,0.9)"} strokeWidth="0.3" />}
          {/* three-point line: corners + arc (23.75ft from the rim) */}
          <path d="M 3 47 L 3 33.3 A 23.75 23.75 0 0 1 47 33.3 L 47 47" fill="none" stroke={th.threePt || th.lines || color} strokeWidth="0.35" />
          {/* key outline in the team color, free-throw circle in the secondary color */}
          <rect x="17" y="28" width="16" height="19" fill="none" stroke={th.lines || color} strokeWidth="0.35" />
          {th.ftFillTop && <path d="M 19 28 A 6 6 0 0 1 31 28 Z" fill={th.ftFillTop} />}
          {th.ftFillBottom && <path d="M 19 28 A 6 6 0 0 0 31 28 Z" fill={th.ftFillBottom} />}
          {th.ftTopFill && <path d="M 19 28 A 6 6 0 0 1 31 28 Z" fill={th.ftTopFill} />}
          {th.ftBottomFill && <path d="M 19 28 A 6 6 0 0 0 31 28 Z" fill={th.ftBottomFill} />}
          <path d="M 19 28 A 6 6 0 0 1 31 28" fill="none" stroke={th.ftTop || th.ft || teamColor2(abbr)} strokeWidth="0.35" />
          <path d="M 19 28 A 6 6 0 0 0 31 28" fill="none" stroke={th.ftBottom || th.ft || teamColor2(abbr)} strokeWidth="0.35" strokeDasharray="1.2 0.9" opacity="0.8" />
          {/* lane hash marks */}
          {[36, 39, 42, 44.5].map((y) => (
            <React.Fragment key={y}>
              <line x1="16.2" y1={y} x2="17" y2={y} stroke={th.lines || "rgba(255,255,255,0.8)"} strokeWidth="0.3" />
              <line x1="33" y1={y} x2="33.8" y2={y} stroke={th.lines || "rgba(255,255,255,0.8)"} strokeWidth="0.3" />
            </React.Fragment>
          ))}
          {/* restricted area, backboard, rim */}
          <path d="M 21 45.75 A 4 4 0 0 1 29 45.75" fill="none" stroke={th.restricted || th.lines || "rgba(255,255,255,0.8)"} strokeWidth="0.25" />
          <line x1="22" y1="43" x2="28" y2="43" stroke="rgba(255,255,255,0.95)" strokeWidth="0.45" />
          <circle cx="25" cy="41.75" r="0.75" fill="none" stroke="#f97316" strokeWidth="0.35" />
          {/* out-of-bounds apron below the baseline, with the team name */}
          {th.apron !== "none" && <rect x="0" y="47" width="50" height={APRON_FT} fill={th.apron || color} />}
          {th.apronLine && <line x1="0" y1="47" x2="50" y2="47" stroke={th.apronLine} strokeWidth="0.4" />}
          <text x="25" y={47 + APRON_FT * (th.apronScript ? 0.72 : 0.68)} fontSize={th.apronScript ? "2.1" : "1.7"} fontWeight={th.apronScript ? "600" : "900"}
            fontFamily={th.apronScript ? "'Snell Roundhand', 'Brush Script MT', 'Segoe Script', cursive" : "system-ui, sans-serif"} fontStyle={th.apronScript ? "italic" : "normal"} letterSpacing={th.apronScript ? "0.05" : "0.45"}
            fill={th.apronText || "#FFFFFF"} textAnchor="middle">{th.apronLabel || String(team?.name || nick).toUpperCase()}</text>
          {/* baseline + sidelines */}
          <rect x="0.15" y={-COURT_TOP_FT} width="49.7" height={47 + COURT_TOP_FT - 0.15} fill="none" stroke={th.side === "none" ? "transparent" : th.side || "rgba(255,255,255,0.7)"} strokeWidth={th.sideW || 0.3} />
          {/* floor lettering along the left sideline, just below half court (reads bottom → top) */}
          {th.floorText && (() => {
            const norm = th.floorText.map((ln) => (Array.isArray(ln) ? { parts: ln } : ln));
            const gap = th.tight ? 0 : 1.1;
            const cwOf = (fs) => fs * 0.72;
            const lineLen = (ln, fs) => ln.parts.reduce((a, pt) => a + pt.t.trim().length * cwOf(fs), 0) + (ln.parts.length - 1) * gap;
            const longestChars = Math.max(...norm.map((ln) => ln.parts.reduce((a, pt) => a + pt.t.trim().length, 0)));
            const base = th.fs || (longestChars > 12 ? 1.15 : 1.5);
            const lens = norm.map((ln) => lineLen(ln, base * (ln.size || 1)));
            const T = Math.max(...lens);
            const top = th.textTop ?? 2.8, bottom = top + T;      // text runs bottom → top, clear of half court
            let x = 2.2;
            return norm.map((ln, i) => {
              const fs = base * (ln.size || 1);
              const cx = x + (fs - base) / 2; x += fs + 0.4;
              const total = lens[i], ind = ln.indent || 0;
              // where this line's first character sits
              const start = ln.align === "end" ? top + total          // last letters line up
                : ln.align === "start" ? bottom - ind                  // first letters line up (indent steps in)
                : (top + bottom) / 2 + total / 2;                      // centered (default)
              let cursor = start;
              return ln.parts.map((pt, k) => {
                const w = pt.t.trim().length * cwOf(fs); const yc = cursor - w / 2; cursor -= w + gap;
                return (
                  <g key={i + "-" + k}>
                    {pt.box && <rect x={cx - fs * 0.62} y={yc - w / 2 - 0.2} width={fs * 1.24} height={w + 0.4} fill={pt.box} rx="0.25" />}
                    <text x={cx} y={yc} fontSize={fs} fontWeight={pt.weight || ln.weight || 800}
                      fontFamily={ln.script ? "'Snell Roundhand', 'Brush Script MT', 'Segoe Script', cursive" : "system-ui, sans-serif"} fontStyle={ln.script ? "italic" : "normal"} letterSpacing={ln.script ? "0" : "0.2"}
                      fill={pt.color === "none" ? "none" : pt.color} stroke={pt.color === "none" ? (pt.outline || "#111111") : "none"} strokeWidth={pt.color === "none" ? 0.12 : 0}
                      textAnchor="middle" dominantBaseline="middle" transform={`rotate(-90 ${cx} ${yc})`}>{pt.t}</text>
                  </g>
                );
              });
            });
          })()}
    </>
  );
}

function CourtView({ roster, abbr, team, teams, onSelectPlayer }) {
  const { assigned, nextUp, used, automated, source, benchGroups, bench } = useMemo(() => lineupOf(roster, abbr), [roster, abbr, lineupFor(abbr)]);
  const lineup = lineupFor(abbr);
  const mpg = (p) => mpgOf(p);
  const color = teamColor(abbr);
  const th = courtTheme(abbr);
  // Net rating (PPG − opp PPG) ranked against the league — the NBA version
  // of the NFL app's offense/defense rank tags.
  const netRating = useMemo(() => {
    if (!team || team.ppg == null || team.oppPpg == null) return null;
    const all = (teams || []).filter((t) => t.ppg != null && t.oppPpg != null && !isFaTeam(t)).map((t) => [t.id, t.ppg - t.oppPpg]).sort((a, b) => b[1] - a[1]);
    const rank = all.findIndex(([id]) => id === team.id) + 1;
    return { value: team.ppg - team.oppPpg, rank: rank || null };
  }, [team, teams]);
  const ringCls = ringClsOf;
  const HealthBadge = ({ p, small }) => {
    const h = healthOf(p);
    if (h === "ok") return null;
    const s = String(effectiveStatus(p) || "").toUpperCase();
    const txt = h === "out" ? (s.includes("SEASON") ? "OUT · SEASON" : s === "IR" || s.includes("INJURED RESERVE") ? "IR" : "OUT") : (s.includes("GAME") ? "GTD" : s.includes("DOUBT") ? "DOUBTFUL" : s.includes("PROB") ? "PROBABLE" : "GTD");
    return (
      <span className={"absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 rounded-full font-extrabold text-white border-2 border-white shadow whitespace-nowrap flex items-center justify-center " +
        (h === "out" ? "bg-red-600 " : "bg-amber-500 ") + (small ? "h-[13px] text-[6px] " : "h-[15px] text-[7px] ")}>
        {txt}
      </span>
    );
  };
  const RatingPill = ({ r, small }) => r == null ? null : (
    <span className={"absolute left-1/2 -translate-x-1/2 rounded-full font-extrabold tabular-nums shadow " +
      (small ? "-bottom-1 px-1 text-[8px] " : "-bottom-1.5 px-1.5 text-[9px] ") +
      (Math.round(r) >= 90 ? "bg-amber-400 text-slate-900" : Math.round(r) >= 85 ? "bg-emerald-500 text-white" : Math.round(r) >= 70 ? "bg-slate-900/85 text-white" : "bg-rose-600 text-white")}>
      {Math.round(r)}
    </span>
  );
  const nick = team && team.name ? String(team.name).trim().split(" ").pop() : abbr;
  const outCount = roster.filter((p) => healthOf(p) === "out").length;
  const gtdCount = roster.filter((p) => healthOf(p) === "q").length;

  return (
    <div className="mt-4">
      {/* Half court, hoop at the bottom. Aspect = 50ft × 47ft. Lines are an
          SVG in real feet so the arcs stay true circles at any width. */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm"
        style={{ paddingBottom: (COURT_FT / 50 * 100).toFixed(1) + "%", background: th.floor || "repeating-linear-gradient(90deg,#e3b77c 0 6.5%,#dbad70 6.5% 13%)" }}>
        {/* plank seams + top-down light so it reads as hardwood, not a flat panel */}
        <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.045) 0 1px, transparent 1px 22px)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.14) 0%,rgba(0,0,0,0) 35%,rgba(0,0,0,0.16) 100%)" }} />
        <svg viewBox={`0 ${-COURT_TOP_FT} 50 ${COURT_FT}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
          <HalfCourtLines th={th} color={color} abbr={abbr} team={team} nick={nick} />
        </svg>
        {/* center-court logo, sitting inside the center circle the way a
            real floor has it — we see the bottom half of it on a half court */}
        {team && (team.courtLogo || th.courtLogo || team.logo) && (
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden pointer-events-none select-none"
            style={{ top: ftY(0) + "%", width: Math.min((th.logoW || 26) * 1.2, 40) + "%", aspectRatio: "1 / 1", animation: "hrbLogoIn .5s ease-out both",
              ...(th.logoRing ? { boxShadow: "0 0 0 2px " + th.logoRing } : {}) }}>
            {th.logoRing && <span className="absolute inset-0 rounded-full" style={{ border: "0.35vw solid " + th.logoRing }} />}
            <img src={team.courtLogo || th.courtLogo || team.logo} alt="" className="absolute inset-[6%] w-[88%] h-[88%] object-contain" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))", transform: "rotate(-90deg)" + (logoTrim(abbr).transform ? " " + logoTrim(abbr).transform : ""), clipPath: logoTrim(abbr).clipPath }}
              onError={(e) => { if (e.currentTarget.src !== team.logo && team.logo) e.currentTarget.src = team.logo; }} />

          </div>
        )}

        {/* small logos flanking the free-throw line (Bulls-style) */}
        {th.ftLogos && team && team.logo && [9, 41].map((x) => (
          <img key={x} src={team.logo} alt="" className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
            style={{ left: (x / 50) * 100 + "%", top: ftY(29) + "%", width: "9%", opacity: 0.95 }} />
        ))}
        {/* availability tag, top-left, same frosted style as the NFL personnel tag */}
        {/* where the five came from — last game's actual starters, or Airtable */}
        {(() => {
          // "Confirmed" only while it's still the day of that game (NBA day rolls over at 3 AM Eastern).
          // After that the same five shows as "Projected · last game" until tonight's starters post.
          const isToday = automated && lineup && lineup.date && (() => { const d = new Date(lineup.date); const now = new Date(); const et = (x) => new Date(x.toLocaleString("en-US", { timeZone: "America/New_York" })); const a = et(d), b = et(now); b.setHours(b.getHours() - 3); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); })();
          const when = lineup && lineup.date ? new Date(lineup.date).toLocaleDateString([], { month: "numeric", day: "numeric" }) : "";
          return (
            <span className={"absolute right-2 top-2 rounded-md bg-black/40 backdrop-blur-sm px-2 py-1 text-[9px] font-extrabold shadow-sm text-right leading-tight " + (isToday ? "text-emerald-300" : "text-amber-300")}>
              {automated && lineup
                ? (isToday
                  ? <><span className="block">Confirmed lineup · {(lineup.home ? "vs " : "@ ") + lineup.opp}</span><span className="block text-[8px] font-bold opacity-80">{when}</span></>
                  : <><span className="block">Projected lineup</span><span className="block text-[8px] font-bold opacity-80">last game {(lineup.home ? "vs " : "@ ") + lineup.opp} · {when}</span></>)
                : "Projected lineup"}
            </span>
          );
        })()}
        {(outCount > 0 || gtdCount > 0) && (
          <span className="absolute left-2 top-2 rounded-md bg-black/35 backdrop-blur-sm px-2 py-1 text-[10px] font-extrabold text-white/90 shadow-sm">
            {outCount > 0 && <span className="text-red-400">{outCount} out</span>}
            {outCount > 0 && gtdCount > 0 && <span className="text-white/60"> · </span>}
            {gtdCount > 0 && <span className="text-amber-300">{gtdCount} GTD</span>}
          </span>
        )}
        <style>{`@keyframes hrbPop { from { opacity: 0; transform: translate(-50%, -50%) scale(.6); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
.hrb-pulse-q { animation: hrbPulseQ 1.9s ease-in-out infinite; }
.hrb-pulse-out { animation: hrbPulseOut 1.9s ease-in-out infinite; }
@keyframes hrbPulseQ { 0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); } 50% { box-shadow: 0 0 0 4px rgba(251,191,36,0.45); } }
@keyframes hrbPulseOut { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } 50% { box-shadow: 0 0 0 4px rgba(239,68,68,0.45); } }
@keyframes hrbLogoIn { from { opacity: 0; transform: translate(-50%, -50%) scale(.85); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
@keyframes hrbSweepOld { 0% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
@keyframes hrbGlow { 0%, 100% { filter: drop-shadow(0 0 0px rgba(255,255,255,0)); } 50% { filter: drop-shadow(0 0 6px rgba(255,255,255,0.55)); } }`}</style>
        {COURT_SLOTS.map((s, i) => {
          const p = assigned[i];
          return (
            <button key={i + (p ? p.id : "")} disabled={!p} onClick={p ? () => onSelectPlayer(p) : undefined}
              className="absolute flex flex-col items-center"
              style={{ left: s.x + "%", top: s.y + "%", transform: "translate(-50%, -50%)", animation: `hrbPop .35s ease-out ${i * 45}ms both` }}>
              <span className="relative">
                {p && photoOf(p) ? (
                  <img src={photoOf(p)} alt="" loading="lazy" className={"w-16 h-16 rounded-full object-cover object-top bg-white border-[3px] shadow-md " + ringCls(p)} />
                ) : (
                  <span className={"w-16 h-16 rounded-full flex items-center justify-center text-[11px] font-extrabold shadow-md border-[3px] " + ringCls(p) + (p ? " bg-white/90 text-slate-700" : " bg-white/20 text-white/70 border-dashed")}>
                    {p ? lastNameOf(p).slice(0, 3).toUpperCase() : s.lbl}
                  </span>
                )}
                {p && (
                  <span className="absolute top-1/2 -translate-y-1/2 -left-3 px-1 rounded text-[8px] font-extrabold bg-white/90 text-slate-700 shadow">
                    {s.lbl}
                  </span>
                )}
                {p && <RatingPill r={p.rating2k} />}
                {p && <HealthBadge p={p} />}
              </span>
              <span className="mt-2 text-[10px] font-bold text-white max-w-[110px] truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
                {p ? (cleanNo(p.no) ? "#" + cleanNo(p.no) + " " : "") + lastNameOf(p) : ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* The bench: everyone not in the five. Horizontal scroll, rotation order. */}
      {bench.length > 0 && (
        <div className="mt-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-2 pt-2 pb-1">
          <div className="flex items-baseline justify-between px-1 mb-1.5">
            <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">{benchGroups[0] ? benchGroups[0][0] : "Bench"}</span>
            <span className="text-[9px] font-bold text-slate-400 tabular-nums truncate ml-3">
              {(() => {
                const counts = { G: 0, F: 0, C: 0 };
                for (const b of bench) { const k = posGroup(b); if (k) counts[k]++; }
                return [["G", "Guards"], ["F", "Forwards"], ["C", "Centers"]].filter(([k]) => counts[k]).map(([k, lbl]) => `${lbl} (${counts[k]})`).join(" · ");
              })()}
            </span>
          </div>
          {benchGroups.map(([grp, list], gi) => (
          <div key={grp} className={gi ? "mt-1.5" : "-mt-3"}>
            {gi > 0 && <div className="text-[9px] font-semibold tracking-widest uppercase text-slate-400 px-1">{grp}</div>}
            <div className="grid grid-cols-5 gap-x-1 gap-y-2 pt-3 pb-1.5 px-0.5">
            {list.map((p) => (
              <button key={p.id} onClick={() => onSelectPlayer(p)} className="flex flex-col items-center min-w-0">
                <span className="relative">
                  {photoOf(p) ? (
                    <img src={photoOf(p)} alt="" loading="lazy"
                      className={"w-[60px] h-[60px] rounded-full object-cover object-top bg-white border-[3px] " + ringCls(p).replace("border-white", "border-slate-200 dark:border-slate-700")} />
                  ) : (
                    <span className={"w-[60px] h-[60px] rounded-full flex items-center justify-center text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500 border-[3px] " + ringCls(p).replace("border-white", "border-slate-200 dark:border-slate-700")}>
                      {lastNameOf(p).slice(0, 3).toUpperCase()}
                    </span>
                  )}
                  <span className="absolute top-1/2 -translate-y-1/2 -left-2 px-1 rounded text-[7px] font-extrabold bg-white/95 dark:bg-slate-700 text-slate-700 dark:text-slate-100 shadow border border-slate-200 dark:border-slate-600">
                    {posOf(p) || "—"}
                  </span>
                  <HealthBadge p={p} small />
                  <RatingPill r={p.rating2k} small />
                </span>
                <span className="mt-2 text-[9px] font-bold text-slate-600 dark:text-slate-300 max-w-full truncate">
                  {(cleanNo(p.no) ? "#" + cleanNo(p.no) + " " : "") + lastNameOf(p)}
                </span>
                <span className="text-[8px] font-semibold text-slate-400">{curStats(p)?.min != null && curStats(p).gp > 0 ? fmt1(curStats(p).min) + " min" : "\u00a0"}</span>
              </button>
            ))}
            </div>
          </div>
          ))}
        </div>
      )}
      {/* Coaching staff — reads the Teams table's "Head Coach" and
          "Assistant Coach" columns; hidden until at least one is filled */}
      {team && (team.headCoach || team.asstCoach || team.asstCoach2) && (() => {
        // "Since" years become tenure: 2023 → "2023 · 4th season"
        const yrs = (since) => {
          const y = Number(String(since || "").match(/\d{4}/)?.[0]);
          if (!y) return since ? String(since) : null;
          const n = startYear(CURRENT_SEASON) - y + 1;
          return n > 0 ? (ORDINALS[n - 1] || n + "th") + " season" : String(y);
        };
        const rows = [["Head Coach", team.headCoach, team.hcSince], ["Assistant Coach", team.asstCoach, team.acSince], ["Assistant Coach", team.asstCoach2, team.acSince2]].filter(([, v]) => v);
        return (
          <div className={"mt-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-3 py-2.5 grid gap-2 " + (rows.length > 2 ? "grid-cols-3" : "grid-cols-2")}>
            {rows.map(([k, v, since], i) => (
              <div key={i} className="min-w-0 text-center">
                <div className="text-[8px] font-semibold tracking-widest uppercase text-slate-400">{k}</div>
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">{v}</div>
                {yrs(since) && <div className="text-[9px] font-semibold text-slate-400 truncate">{yrs(since)}</div>}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════ TEAM STATS PANEL (grid: every player × every stat) ══
// One table per pill. Tap a column header to rank the whole roster by it;
// cells are tinted by where that value sits between the team's low and
// high, so a row's strengths jump out without reading numbers.
const STAT_NAMES = { pts: "Points", fgm: "Field goals made", fg: "Field goal %", p3m: "3-pointers made", p3: "3-point %", ftm: "Free throws made", ft: "Free throw %", ast: "Assists", tov: "Turnovers", min: "Minutes", reb: "Rebounds", oreb: "Offensive rebounds", dreb: "Defensive rebounds", stl: "Steals", blk: "Blocks", fga: "Field goal attempts", p3a: "3-point attempts", fta: "Free throw attempts" };
const TEAM_BARS = {
  offense:    { label: "Offense",    cols: [["pts", "PTS"], ["fgm", "FGM"], ["fg", "FG%"], ["p3m", "3PM"], ["p3", "3P%"], ["ftm", "FTM"], ["ft", "FT%"]], pct: ["fg", "p3", "ft"], gate: { fg: ["fga", 3], p3: ["p3a", 1.5], ft: ["fta", 1] }, names: STAT_NAMES },
  defense:    { label: "Defense",    cols: [["stl", "STL"], ["blk", "BLK"], ["dreb", "DREB"]], names: STAT_NAMES },
  rebounds:   { label: "Rebounds",   cols: [["reb", "REB"], ["oreb", "OREB"], ["dreb", "DREB"]], names: STAT_NAMES },
  playmaking: { label: "Playmaking", cols: [["ast", "AST"], ["tov", "TO"], ["min", "MIN"]], names: STAT_NAMES },
  volume:     { label: "Volume",     cols: [["fga", "FGA"], ["p3a", "3PA"], ["fta", "FTA"], ["min", "MIN"], ["tov", "TO"]], share: true, names: STAT_NAMES },
};
const STAT_SETS = {
  leaders:  { label: "Leaders",  cols: [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["stl", "STL"], ["blk", "BLK"], ["p3m", "3PM"]] },
  volume:   { label: "Volume",   cols: [["min", "MIN"], ["fga", "FGA"], ["p3a", "3PA"], ["fta", "FTA"], ["tov", "TO"]] },
  shooting: { label: "Shooting", cols: [["fg", "FG%"], ["p3", "3P%"], ["ft", "FT%"], ["fga", "FGA"], ["p3a", "3PA"], ["fta", "FTA"]], pct: ["fg", "p3", "ft"], gate: { fg: ["fga", 3], p3: ["p3a", 1.5], ft: ["fta", 1.5] } },
};
// ── Team Schedule: every game with results, plus opponent-strength tiles ──
// Opponent strength = net rating (PPG − Opp PPG) from live standings.
const SCHED_CACHE = {};
function TeamSchedule({ team, abbr, teams, onSelectTeam, onOpenGame, tilesOnly }) {
  const [d, setD] = useState(SCHED_CACHE[abbr] || null);
  useEffect(() => {
    let alive = true;
    if (SCHED_CACHE[abbr] && Date.now() - (SCHED_CACHE[abbr].at || 0) < 5 * 60 * 1000) { setD(SCHED_CACHE[abbr]); return; }
    fetch("/api/lineups?schedule=" + encodeURIComponent(modernAbbr(abbr))).then((r) => r.json()).then((x) => { const v = { ...x, at: Date.now() }; SCHED_CACHE[abbr] = v; if (alive) setD(v); }).catch(() => alive && setD({ games: [], error: "unreachable" }));
    return () => { alive = false; };
  }, [abbr]);
  const byAbbr = (ab) => (teams || []).find((t) => modernAbbr(t.abbr || toAbbr(t.name)) === modernAbbr(ab));
  const netOf = (ab) => { const t = byAbbr(ab); return t && t.ppg != null && t.oppPpg != null ? t.ppg - t.oppPpg : null; };
  const recOf = (ab) => { const t = byAbbr(ab); return t ? `${t.wins ?? 0}-${t.losses ?? 0}` : ""; };
  const games = d?.games || [];
  const played = games.filter((g) => g.completed), upcoming = games.filter((g) => !g.completed);
  const avgNet = (list) => { const v = list.map((g) => netOf(g.opp)).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const sumRec = (list) => { let w = 0, l = 0; for (const g of list) { const t = byAbbr(g.opp); if (t) { w += t.wins ?? 0; l += t.losses ?? 0; } } return `OPP ${w}-${l}`; };
  const fmtNet = (v) => (v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(1));
  const netCls = (v) => (v == null ? "text-slate-400" : v <= -1 ? "text-green-600" : v >= 1 ? "text-red-500" : "text-amber-600");  // easier opponents = green
  // Basketball tiles: form (last 10), what's next (next 5), where you win (home / road)
  const last10 = played.slice(-10);
  const rec = (list) => { const w = list.filter((g) => g.win).length; return `${w}-${list.length - w}`; };
  const margin = (list) => { const v = list.map((g) => Number(g.my) - Number(g.their)).filter((x) => !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const homeP = played.filter((g) => g.home), roadP = played.filter((g) => !g.home);
  const next5 = upcoming.slice(0, 5); const next5Home = next5.filter((g) => g.home).length;
  const n5 = avgNet(next5);
  const tiles = [
    { lbl: "Last 10", big: played.length ? rec(last10) : "—", bigCls: margin(last10) == null ? "text-slate-400" : margin(last10) > 0 ? "text-green-600" : margin(last10) < 0 ? "text-red-500" : "text-amber-600", sub: margin(last10) != null ? `${fmtNet(margin(last10))} margin` : "no games yet" },
    { lbl: "Next 5", big: next5.length ? fmtNet(n5) : "—", bigCls: netCls(n5), sub: next5.length ? `opp net · ${next5Home} home, ${next5.length - next5Home} away` : "season over" },
    { lbl: "Home", big: homeP.length ? rec(homeP) : "—", bigCls: margin(homeP) == null ? "text-slate-400" : margin(homeP) > 0 ? "text-green-600" : margin(homeP) < 0 ? "text-red-500" : "text-amber-600", sub: homeP.length ? `${fmtNet(margin(homeP))} margin` : "no home games yet" },
    { lbl: "Away", big: roadP.length ? rec(roadP) : "—", bigCls: margin(roadP) == null ? "text-slate-400" : margin(roadP) > 0 ? "text-green-600" : margin(roadP) < 0 ? "text-red-500" : "text-amber-600", sub: roadP.length ? `${fmtNet(margin(roadP))} margin` : "no road games yet" },
  ];
  let w = 0, l = 0;
  if (tilesOnly) return (
      <div className="grid grid-cols-4 gap-1.5">
        {tiles.map((t) => (
          <div key={t.lbl} className="bg-white dark:bg-slate-900 rounded-2xl border-2 px-1 py-2.5 text-center shadow-sm flex flex-col items-center justify-center" style={{ borderColor: tileBorder(abbr) }}>
            <div className="text-[8px] font-extrabold tracking-widest uppercase leading-tight" style={{ color: teamColor(abbr) }}>{t.lbl}</div>
            <div className={"text-base font-extrabold mt-1 tabular-nums whitespace-nowrap " + t.bigCls}>{t.big}</div>
            <div className="text-[8px] font-semibold text-slate-400 mt-0.5 leading-tight">{t.sub}</div>
          </div>
        ))}
      </div>
  );
  return (
    <div className="mt-2">
      <div className="grid grid-cols-4 gap-1.5 hidden">
        {tiles.map((t) => (
          <div key={t.lbl} className="bg-white dark:bg-slate-900 rounded-2xl border-2 px-1 py-2.5 text-center shadow-sm flex flex-col items-center justify-center" style={{ borderColor: tileBorder(abbr) }}>
            <div className="text-[8px] font-extrabold tracking-widest uppercase leading-tight" style={{ color: teamColor(abbr) }}>{t.lbl}</div>
            <div className={"text-base font-extrabold mt-1 tabular-nums whitespace-nowrap " + t.bigCls}>{t.big}</div>
            <div className="text-[8px] font-semibold text-slate-400 mt-0.5 leading-tight">{t.sub}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-5 mb-2 px-1">
        <span className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase">Schedule</span>
        <span className="flex gap-1.5"><span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-600">tough</span><span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-700">favorable</span></span>
      </div>
      {!d && <div className="text-center text-xs text-slate-400 py-8">Loading schedule…</div>}
      {d && d.error && <div className="text-center text-xs text-slate-400 py-8">Couldn't load the schedule. Try again in a minute.</div>}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {games.map((g) => {
          if (g.completed) { if (g.win) w++; else l++; }
          const net = netOf(g.opp);
          const dt = new Date(g.date);
          const oppT = byAbbr(g.opp);
          return (
            <button key={g.id} onClick={() => {
                if ((g.completed || g.state === "in") && onOpenGame) {
                  // open the game view (box score) for played / live games; upcoming games open the opponent
                  const me = { abbr, score: g.my, record: `${team.wins ?? 0}-${team.losses ?? 0}`, winner: g.win === true, logo: team.logo };
                  const them = { abbr: g.opp, score: g.their, record: oppT ? `${oppT.wins ?? 0}-${oppT.losses ?? 0}` : "", winner: g.win === false, logo: oppT?.logo || g.oppLogo };
                  onOpenGame({ id: g.id, date: g.date, state: g.state, seasonType: 2, detail: g.detail, away: g.home ? them : me, home: g.home ? me : them, broadcast: g.broadcast });
                } else if (oppT && onSelectTeam) onSelectTeam(oppT);
              }} className="w-full text-left px-4 py-3 active:bg-slate-50 dark:active:bg-slate-800">
              <div className="flex items-center gap-3">
                <span className="w-11 shrink-0 text-center leading-tight self-center"><span className="block text-[10px] font-bold text-slate-400 uppercase">{dt.toLocaleDateString([], { month: "short" })}</span><span className="block text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">{dt.getDate()}</span></span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-3">
                    <img src={oppT?.logo || g.oppLogo || ""} alt="" className="w-9 h-9 object-contain shrink-0" style={logoTrim(g.opp)} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-slate-900 dark:text-white truncate"><span className="text-slate-400 mr-1">{g.home ? "vs" : "@"}</span>{g.oppName || g.opp}</span>
                      <span className="block text-[11px] text-slate-400 font-medium truncate">{dt.toLocaleDateString([], { weekday: "short" })} · {dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{g.broadcast ? " · " + g.broadcast : ""}</span>
                    </span>
                  </span>
                  <span className="flex gap-1 mt-1.5 overflow-x-auto whitespace-nowrap" style={{ scrollbarWidth: "none" }}>
                    <span className={"shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold " + (net == null ? "bg-slate-100 text-slate-500" : net <= -1 ? "bg-green-100 text-green-700" : net >= 1 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700")}>OPP {fmtNet(net)} net</span>
                    {oppT && oppT.ppg != null && <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{oppT.ppg.toFixed(1)} PPG</span>}
                    {oppT && oppT.oppPpg != null && <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{oppT.oppPpg.toFixed(1)} allowed</span>}
                  </span>
                </span>
                <span className="text-right shrink-0 self-end pb-0.5">
                  {g.completed ? (
                    <>
                      <span className="block text-sm font-extrabold tabular-nums"><span className={g.win ? "text-green-600" : "text-red-500"}>{g.win ? "W" : "L"}</span> <span className="text-slate-900 dark:text-white">{g.my}-{g.their}</span></span>
                      <span className="block text-[11px] font-semibold text-slate-400 tabular-nums">({w}-{l})</span>
                    </>
                  ) : g.state === "in" ? (
                    <span className="block text-xs font-extrabold text-red-500">LIVE {g.my}-{g.their}</span>
                  ) : (
                    <span className="block text-[11px] font-semibold text-slate-400">{recOf(g.opp)}</span>
                  )}
                </span>
              </div>
            </button>
          );
        })}
        {d && !d.error && games.length === 0 && <div className="text-center text-sm text-slate-400 py-10">No schedule published yet.</div>}
      </div>
    </div>
  );
}

// ── Team Injuries: this roster's sidelined players, same data as the league Injury Report ──
function TeamInjuries({ roster, abbr, onSelectPlayer }) {
  const color = teamColor(abbr);
  const order = (p) => { const st = String(effectiveStatus(p) || "").toLowerCase(); return /out|ir|injured reserve|suspend/.test(st) ? 0 : /doubt/.test(st) ? 1 : /quest|gtd|game.time|day/.test(st) ? 2 : /prob/.test(st) ? 3 : 4; };
  const hurt = roster.filter((p) => isSidelined(p)).sort((a, b) => order(a) - order(b) || (mpgOf(b) - mpgOf(a)));
  const counts = { out: hurt.filter((p) => order(p) === 0).length, gtd: hurt.filter((p) => order(p) > 0).length };
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase">Injury report</span>
        <span className="text-[11px] font-semibold text-slate-400 text-right">{hurt.length ? `${counts.out} out · ${counts.gtd} questionable` : "everyone available"}</span>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {hurt.map((p) => (
          <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-start gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800" style={{ borderLeft: "3px solid " + color }}>
            <Avatar p={p} />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{cleanNo(p.no) && <span className="text-slate-400 font-extrabold mr-1.5">#{cleanNo(p.no)}</span>}{p.name}<span className="ml-1.5 text-[10px] font-semibold text-slate-400">{courtPos(p)}</span></span>
              <span className="mt-1 block"><StatusBadge status={effectiveStatus(p) || "Injured"} /></span>
              {(() => { const r = injOf(p); const detail = injuryDetailOf(p) || r?.detail || espnOf(p)?.injuryDetail; const ret = injuryReturnOf(p) || fmtRet(r?.returnDate); const note = injuryCommentOf(p) || r?.comment || r?.longComment; return (
                <>
                  {detail && <span className="block text-[11px] font-semibold text-red-500 mt-1">({detail})</span>}
                  {ret && <span className="block text-[11px] font-semibold text-slate-900 dark:text-white mt-0.5">Estimated Return Date: {ret}</span>}
                  {note && <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">{note}</span>}
                  {!detail && !ret && !note && <span className="block text-[10px] text-slate-400 mt-1">No details on the ESPN report yet</span>}
                </>
              ); })()}
            </span>
          </button>
        ))}
        {hurt.length === 0 && <div className="text-center text-sm text-slate-400 py-10">No one on the injury report.</div>}
      </div>
    </div>
  );
}

// ── Team Leaders: box-score-style leader rows, grouped ──
function TeamLeaders({ roster, abbr, onSelectPlayer }) {
  const color = teamColor(abbr);
  const rows = roster.map((p) => ({ p, s: curStats(p) })).filter((x) => x.s && (x.s.gp ?? 0) > 0);
  const GROUPS = [
    ["Offense", [["pts", "Points"], ["fgm", "Field goals"], ["p3m", "Threes"], ["ftm", "Free throws"]]],
    ["Playmaking", [["ast", "Assists"], ["min", "Minutes"]]],
    ["Rebounding", [["reb", "Rebounds"], ["oreb", "Offensive"], ["dreb", "Defensive"]]],
    ["Defense", [["stl", "Steals"], ["blk", "Blocks"]]],
  ];
  const top = (k) => rows.filter((x) => x.s[k] != null).sort((a, b) => b.s[k] - a.s[k])[0];
  return (
    <div className="space-y-3">
      {GROUPS.map(([g, cats]) => {
        const items = cats.map(([k, l]) => [k, l, top(k)]).filter(([, , x]) => x);
        if (!items.length) return null;
        return (
          <div key={g} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-4 py-1.5 text-[10px] font-extrabold tracking-widest uppercase text-white" style={{ backgroundColor: color }}>{g}</div>
            {items.map(([k, l, x]) => (
              <button key={k} onClick={() => onSelectPlayer(x.p)} className="w-full flex items-center gap-3 px-4 py-2 text-left active:bg-slate-50 dark:active:bg-slate-800">
                <Avatar p={x.p} />
                <span className="flex-1 min-w-0"><span className="block text-[13px] font-bold text-slate-900 dark:text-white truncate">{x.p.name}</span><span className="block text-[9px] font-semibold tracking-wider uppercase text-slate-400">{l}</span></span>
                <span className="text-right"><span className="block text-lg font-extrabold text-slate-900 dark:text-white tabular-nums leading-none">{Math.round(x.s[k] * (x.s.gp || 1)).toLocaleString()}</span><span className="block text-[10px] font-semibold text-slate-400 tabular-nums mt-0.5">{fmt1(x.s[k])}/g</span></span>
              </button>
            ))}
          </div>
        );
      })}
      {rows.length === 0 && <div className="text-center text-xs text-slate-400 py-10">No {seasonTick({ season: CURRENT_SEASON })} games for this roster yet.</div>}
    </div>
  );
}

// ── Team Bars: one card per stat, football-style bars (Volume shows team share) ──
function TeamBars({ roster, abbr, set, onSelectPlayer }) {
  const color = teamColor(abbr);
  const rows = roster.map((p) => ({ p, s: curStats(p) })).filter((x) => x.s && (x.s.gp ?? 0) > 0);
  return (
    <div className="space-y-4">
      {set.cols.map(([k, lbl]) => {
        const isPct = (set.pct || []).includes(k); const gate = set.gate?.[k];
        const list = rows.filter((x) => x.s[k] != null && (!gate || (x.s[gate[0]] ?? 0) >= gate[1])).sort((a, b) => b.s[k] - a.s[k]).slice(0, 8);
        if (!list.length) return null;
        const max = list[0].s[k] || 1;
        const teamTotal = rows.reduce((a, x) => a + (x.s[k] || 0), 0) || 1;
        return (
          <div key={k}>
            <div className="text-[11px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mb-2 px-1">{set.names?.[k] || lbl}{set.share ? " · share of team" : (set.pct || []).includes(k) ? "" : " · season total"}</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-2">
              {list.map(({ p, s: st }) => {
                const share = (st[k] / teamTotal) * 100;
                return (
                  <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full py-2 text-left">
                    <span className="flex items-baseline justify-between">
                      <span className="text-[12px] font-bold text-slate-900 dark:text-white truncate">{p.name} <span className="text-[9px] font-semibold text-slate-400 ml-1">{courtPos(p)}</span></span>
                      <span className="text-[12px] font-extrabold text-slate-900 dark:text-white tabular-nums ml-2">
                        {set.share ? Math.round(share) + "%" : isPct ? Number(st[k]).toFixed(1) + "%" : Math.round(st[k] * (st.gp || 1)).toLocaleString()}
                        <span className="text-[10px] font-semibold text-slate-400 ml-1">{set.share ? `(${fmt1(st[k])}/g)` : isPct ? "" : `(${fmt1(st[k])}/g)`}</span>
                      </span>
                    </span>
                    <span className="block h-2 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
                      <span className="block h-full rounded-full" style={{ width: Math.max(3, (set.share ? share / ((list[0].s[k] / teamTotal) * 100) : st[k] / max) * 100) + "%", backgroundColor: color }} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {rows.length === 0 && <div className="text-center text-xs text-slate-400 py-10">No {seasonTick({ season: CURRENT_SEASON })} games for this roster yet.</div>}
    </div>
  );
}

// ── Team Trends: points scored / allowed / margin by game, plus who scores ──
function TeamTrends({ roster, abbr, onSelectPlayer }) {
  // A matrix: rows are players (by minutes), columns are stats. Each cell is a
  // circle sized by that player's share of the team leader in that stat — no
  // digits. Tap a column to sort by it; tap a player to open a radar of his
  // profile vs the team. Current season only.
  const COLS = [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["stl", "STL"], ["blk", "BLK"], ["p3m", "3PM"], ["tov", "TO"], ["min", "MIN"]];
  const [sortKey, setSortKey] = useState("min");
  const [open, setOpen] = useState(null);
  const color = teamColor(abbr);
  const rows = roster.map((p) => ({ p, s: curStats(p) })).filter((x) => x.s && (x.s.gp ?? 0) > 0).sort((a, b) => (b.s[sortKey] ?? 0) - (a.s[sortKey] ?? 0));
  const max = {}; for (const [k] of COLS) max[k] = Math.max(0.1, ...rows.map((x) => x.s[k] ?? 0));
  const waiting = roster.filter((p) => !(curStats(p)?.gp > 0)).length;
  const R = 11;
  const radarKeys = [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["stl", "STL"], ["blk", "BLK"], ["p3m", "3PM"]];
  const radar = (s0) => {
    const cx = 70, cy = 70, r = 52, n = radarKeys.length;
    const pt = (i, f) => { const a = -Math.PI / 2 + (i / n) * 2 * Math.PI; return [cx + r * f * Math.cos(a), cy + r * f * Math.sin(a)]; };
    const me = radarKeys.map(([k], i) => pt(i, Math.min(1, (s0[k] ?? 0) / max[k])));
    const ring = (f) => radarKeys.map((_, i) => pt(i, f).join(",")).join(" ");
    return (
      <svg viewBox="0 0 140 140" className="w-36 h-36 shrink-0">
        {[0.33, 0.66, 1].map((f) => <polygon key={f} points={ring(f)} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" />)}
        {radarKeys.map(([, l], i) => { const [x, y] = pt(i, 1.18); return <text key={l} x={x} y={y + 3} fontSize="8" fontWeight="700" textAnchor="middle" fill="currentColor" className="text-slate-500 dark:text-slate-400">{l}</text>; })}
        <polygon points={me.map((q) => q.join(",")).join(" ")} fill={color} opacity="0.35" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {me.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={color} />)}
      </svg>
    );
  };
  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex items-center px-3 py-2 border-b border-slate-100 dark:border-slate-800">
          <span className="w-[108px] shrink-0 text-[9px] font-extrabold tracking-widest uppercase text-slate-900 dark:text-white">Tap a stat</span>
          <span className="flex-1 flex">
            {COLS.map(([k, l]) => (
              <button key={k} onClick={() => setSortKey(k)} className={"flex-1 text-center text-[9px] font-extrabold py-1 rounded-md " + (sortKey === k ? "text-white" : "text-slate-500 dark:text-slate-400")} style={sortKey === k ? { backgroundColor: color } : undefined}>{l}</button>
            ))}
          </span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map(({ p, s: st }) => (
            <div key={p.id}>
              <button onClick={() => setOpen(open === p.id ? null : p.id)} className={"w-full flex items-center px-3 py-1.5 text-left " + (open === p.id ? "bg-slate-50 dark:bg-slate-800/60" : "active:bg-slate-50 dark:active:bg-slate-800")}>
                <span className="w-[108px] shrink-0 flex items-center gap-2 min-w-0">
                  <Avatar p={p} />
                  <span className="min-w-0"><span className="block text-[12px] font-bold text-slate-900 dark:text-white truncate">{lastNameOf(p)}</span><span className="block text-[9px] font-semibold text-slate-400">{courtPos(p)}</span></span>
                </span>
                <span className="flex-1 flex">
                  {COLS.map(([k]) => { const f = Math.min(1, (st[k] ?? 0) / max[k]); const lead = f >= 0.999; return (
                    <span key={k} className="flex-1 flex items-center justify-center h-7">
                      <span className="rounded-full" style={{ width: Math.max(4, 2 * R * Math.sqrt(f)), height: Math.max(4, 2 * R * Math.sqrt(f)), backgroundColor: color, opacity: 0.25 + 0.75 * f, boxShadow: lead ? `0 0 0 2px white, 0 0 0 3.5px ${color}` : "none" }} />
                    </span>
                  ); })}
                </span>
              </button>
              {open === p.id && (
                <div className="flex items-center gap-3 px-3 pb-3 pt-1">
                  {radar(st)}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-extrabold text-slate-900 dark:text-white">{p.name} <span className="text-slate-400 font-semibold">· {Math.round(st.gp)} GP</span></div>
                    <div className="grid grid-cols-4 gap-x-2 gap-y-1 mt-1.5">
                      {COLS.map(([k, l]) => <div key={k}><div className="text-[8px] font-bold text-slate-400">{l}</div><div className="text-[12px] font-extrabold text-slate-900 dark:text-white tabular-nums">{fmt1(st[k])}</div></div>)}
                    </div>
                    <button onClick={() => onSelectPlayer(p)} className="mt-2 text-[10px] font-extrabold" style={{ color }}>Open player card ›</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && <div className="text-center text-xs text-slate-400 py-10">No {seasonTick({ season: CURRENT_SEASON })} games for this roster yet.</div>}
        </div>
        <div className="px-3 py-2 text-[9px] text-slate-400 border-t border-slate-100 dark:border-slate-800">Circle = share of the team leader in that stat · ringed = team leader{waiting ? ` · ${waiting} yet to play` : ""}</div>
      </div>
    </div>
  );
}

// ── Team Profile: each stat as a league-wide dot plot, this team highlighted ──
// Team per-game numbers are the roster's per-game stats added up; percentages
// are weighted by attempts. Shows rank AND distance from the pack.
const PROFILE_STATS = [["pts", "PTS"], ["reb", "REB"], ["oreb", "OREB"], ["dreb", "DREB"], ["ast", "AST"], ["stl", "STL"], ["blk", "BLK"], ["tov", "TO", true], ["fga", "FGA"], ["p3a", "3PA"], ["fta", "FTA"], ["fg", "FG%", false, "pct"], ["p3", "3P%", false, "pct"], ["ft", "FT%", false, "pct"]];
function teamStatLine(roster, key, pct) {
  const rows = roster.map(latestStats).filter((s) => s && (s.gp ?? 0) > 0);
  if (!rows.length) return null;
  if (pct) {
    const att = { fg: ["fgm", "fga"], p3: ["p3m", "p3a"], ft: ["ftm", "fta"] }[key];
    const m = rows.reduce((a, s) => a + (s[att[0]] ?? 0) * (s.gp ?? 0), 0), t = rows.reduce((a, s) => a + (s[att[1]] ?? 0) * (s.gp ?? 0), 0);
    return t ? (m / t) * 100 : null;
  }
  // roster per-game sum, scaled to a team game (minutes ÷ 240)
  const mins = rows.reduce((a, s) => a + (s.min ?? 0), 0) || 240;
  return rows.reduce((a, s) => a + (s[key] ?? 0), 0) * (240 / Math.max(mins, 240));
}
function TeamProfile({ roster, abbr, teams, players }) {
  const league = useMemo(() => (teams || []).filter((t) => !isFaTeam(t)).map((t) => {
    const ab = t.abbr || toAbbr(t.name);
    const live = LIVE_STATS.teams && (LIVE_STATS.teams[modernAbbr(ab)] || LIVE_STATS.teams[ab] || Object.entries(LIVE_STATS.teams).find(([k]) => modernAbbr(k) === modernAbbr(ab))?.[1]);
    if (live && live.gp > 0) return { abbr: ab, ...live };
    if (LIVE_STATS.teams) return { abbr: ab };          // live season: a team with no game yet has no line
    const r = rosterOf(t, players);
    const o = { abbr: ab }; for (const [k, , , kind] of PROFILE_STATS) o[k] = teamStatLine(r, k, kind === "pct"); return o;
  }), [teams, players, LIVE_STATS.teams]);
  const color = teamColor(abbr);
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3">
      <div className="text-[10px] font-semibold text-slate-400 mb-2">{abbr} vs the league · bar = {abbr} · tick = league average</div>
      {PROFILE_STATS.map(([k, lbl, lowerBetter, kind]) => {
        const vals = league.map((t) => t[k]).filter((v) => v != null);
        const mine = league.find((t) => t.abbr === abbr)?.[k];
        if (!vals.length || mine == null) return null;
        const max = Math.max(...vals), avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const rank = (lowerBetter ? vals.filter((v) => v < mine).length : vals.filter((v) => v > mine).length) + 1;
        const tone = rank <= 10 ? "#16a34a" : rank <= 20 ? "#d97706" : "#dc2626";
        const pct = (v) => Math.max(2, (v / max) * 100);
        return (
          <div key={k} className="flex items-center gap-3 py-2.5 border-t first:border-0 border-slate-100 dark:border-slate-800">
            <div className="w-10 shrink-0 text-[11px] font-extrabold text-slate-900 dark:text-white">{lbl}</div>
            <div className="flex-1 relative h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-visible">
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(mine) + "%", backgroundColor: color }} />
              <div className="absolute -top-1 w-0.5 h-5 bg-slate-500 dark:bg-slate-300 rounded" style={{ left: `calc(${pct(avg)}% - 1px)` }} title="league avg" />
            </div>
            <div className="w-12 shrink-0 text-right text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">{kind === "pct" ? mine.toFixed(1) + "%" : mine.toFixed(1)}</div>
            <div className="w-10 shrink-0 text-right text-[11px] font-extrabold" style={{ color: tone }}>{ordinal(rank)}</div>
          </div>
        );
      })}
    </div>
  );
}

function TeamStatsPanel({ roster, abbr, mode, setMode, onSelectPlayer }) {
  // One stat at a time, drawn as bars: pick a stat pill, every player gets a
  // bar scaled to the team leader, numbers kept small. Current season only.
  const set = STAT_SETS[mode] || STAT_SETS.leaders;
  const [stat, setStat] = useState(set.cols[0][0]);
  useEffect(() => { setStat(set.cols[0][0]); }, [mode]);
  const color = teamColor(abbr);
  const isPct = (set.pct || []).includes(stat);
  const gate = set.gate?.[stat];
  const rows = roster.map((p) => ({ p, s: curStats(p) }))
    .filter((x) => x.s && (x.s.gp ?? 0) > 0 && x.s[stat] != null && (!gate || (x.s[gate[0]] ?? 0) >= gate[1]))
    .sort((a, b) => b.s[stat] - a.s[stat]);
  const max = rows.length ? Math.max(...rows.map((x) => x.s[stat])) : 1;
  const waiting = roster.filter((p) => !curStats(p) || !(curStats(p).gp > 0)).length;
  const fmtV = (v) => (isPct ? Number(v).toFixed(1) + "%" : fmt1(v));
  const label = set.cols.find(([k]) => k === stat)?.[1] || stat.toUpperCase();
  return (
    <div>
      <div className="flex gap-2 mb-2">
        {Object.entries(STAT_SETS).map(([k, v]) => (
          <button key={k} onClick={() => setMode(k)}
            className={"flex-1 py-1.5 rounded-full text-[11px] font-extrabold border " + (mode === k ? "text-white border-transparent" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800")}
            style={mode === k ? { backgroundColor: color } : undefined}>{v.label}</button>
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
        {set.cols.map(([k, lbl]) => (
          <button key={k} onClick={() => setStat(k)}
            className={"shrink-0 px-3 py-1 rounded-full text-[10px] font-extrabold border " + (stat === k ? "text-white border-transparent" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800")}
            style={stat === k ? { backgroundColor: color } : undefined}>{lbl}</button>
        ))}
      </div>
      <div className="flex items-baseline justify-between mt-3 mb-2 px-1">
        <span className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase">{seasonTick({ season: CURRENT_SEASON })} · {label} per game</span>
        {waiting > 0 && <span className="text-[10px] font-semibold text-slate-400">{waiting} yet to play</span>}
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map(({ p, s }, i) => {
          const w = Math.max(3, (s[stat] / max) * 100);
          return (
            <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800">
              <span className={"w-5 text-center text-[11px] font-extrabold tabular-nums " + (i < 3 ? "text-slate-900 dark:text-white" : "text-slate-400")}>{i + 1}</span>
              <Avatar p={p} />
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{lastNameOf(p)}<span className="ml-1 text-[9px] font-semibold text-slate-400">{courtPos(p)}</span></span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums ml-2">{fmtV(s[stat])}</span>
                </span>
                <span className="block h-2 rounded-full bg-slate-100 dark:bg-slate-800 mt-1.5 overflow-hidden">
                  <span className="block h-full rounded-full" style={{ width: w + "%", backgroundColor: color, opacity: i === 0 ? 1 : 0.75 }} />
                </span>
              </span>
            </button>
          );
        })}
        {rows.length === 0 && <div className="text-center text-xs text-slate-400 py-10">No {seasonTick({ season: CURRENT_SEASON })} games for this roster yet.</div>}
      </div>
    </div>
  );
}

// ═══════════════ CAP OUTLOOK (Payroll tile) ══════════════════════
// League thresholds in $M. 2025-26 and 2026-27 are the NBA's official
// numbers; later seasons are projected at the league's stated +5.5%.
const CAP_TABLE = {
  2025: { cap: 154.647, tax: 187.895, apron1: 195.945, apron2: 207.824 },
  2026: { cap: 164.961, tax: 200.428, apron1: 209.015, apron2: 221.686 },
};
function capFor(year) {
  if (CAP_TABLE[year]) return { ...CAP_TABLE[year], projected: false };
  const known = Math.max(...Object.keys(CAP_TABLE).map(Number));
  const base = CAP_TABLE[known], g = Math.pow(1.055, year - known);
  return { cap: base.cap * g, tax: base.tax * g, apron1: base.apron1 * g, apron2: base.apron2 * g, projected: true };
}
const seasonLabel = (y) => "'" + String(y).slice(2) + "-'" + String(y + 1).slice(2);
// Bucket a contract year by how firm the money is
function bucketOf(y) {
  const t = String(y.type || "").toUpperCase();
  if (t === "UFA" || t === "RFA") return null;                 // cap hold, not salary
  if (t === "PO") return y.decision ? "committed" : "playerOpt";
  if (t === "TO") return y.decision ? "committed" : "teamOpt";
  if (t === "NG" || t === "PG") return "nonGtd";
  return "committed";
}
const BUCKETS = [
  ["committed", "Guaranteed", "#2563eb"],
  ["nonGtd", "Non-guaranteed", "#94a3b8"],
  ["playerOpt", "Player option", "#16a34a"],
  ["teamOpt", "Team option", "#dc2626"],
];

// Payroll bars in the team's own colors: guaranteed = primary, player option =
// primary lightened, team option = primary blended toward the secondary,
// non-guaranteed stays neutral gray.
function bucketColor(b, color, fallback) {
  if (b === "committed") return color;
  if (b === "playerOpt") return mixHex(color, "#ffffff", 0.45);
  if (b === "teamOpt") return mixHex(color, "#000000", 0.35);
  return fallback;
}
function CapOutlook({ roster, color, onSelectPlayer }) {
  const tileBorder = () => color, teamColor = () => color, abbr = "";
  const y0 = startYear(CURRENT_SEASON);
  const years = [y0, y0 + 1, y0 + 2, y0 + 3];
  const [sel, setSel] = useState(y0);
  // per season: { total, byBucket, rows: [{p, salary, bucket, type}] }
  const data = useMemo(() => years.map((yr) => {
    const rows = [];
    for (const p of roster) {
      const act = activeOf(p); if (!act) continue;
      const y = (act.years || []).find((yy) => startYear(yy.season) === yr && yy.salary != null);
      if (!y) continue;
      const b = bucketOf(y); if (!b) continue;
      rows.push({ p, salary: y.salary, bucket: b, type: String(y.type || "G").toUpperCase() });
    }
    rows.sort((a, b) => b.salary - a.salary);
    const byBucket = {}; for (const r of rows) byBucket[r.bucket] = (byBucket[r.bucket] || 0) + r.salary;
    return { yr, rows, byBucket, total: rows.reduce((a, r) => a + r.salary, 0), lines: capFor(yr) };
  }), [roster, y0]);

  const W = 340, H = 250, padL = 8, padR = 82, padT = 12, padB = 26;
  const maxY = Math.max(...data.map((d) => Math.max(d.total, d.lines.apron2))) * 1.06;
  const yOf = (v) => padT + (H - padT - padB) * (1 - v / maxY);
  const slot = (W - padL - padR) / years.length, bw = slot * 0.52;
  const cur = data.find((d) => d.yr === sel);
  const room = cur ? cur.lines.cap - cur.total : 0;
  const vsTax = cur ? cur.total - cur.lines.tax : 0;
  const status = !cur ? "" : cur.total > cur.lines.apron2 ? "Over 2nd apron" : cur.total > cur.lines.apron1 ? "Over 1st apron" : cur.total > cur.lines.tax ? "Taxpayer" : cur.total > cur.lines.cap ? "Over the cap" : "Under the cap";
  const statusCls = !cur ? "" : cur.total > cur.lines.apron1 ? "text-red-500" : cur.total > cur.lines.tax ? "text-amber-500" : cur.total > cur.lines.cap ? "text-slate-600 dark:text-slate-300" : "text-emerald-600";

  return (
    <div className="mt-4">
      <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mb-1.5 px-1">Salary cap outlook</div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-3 pt-3 pb-2">
        <style>{`@keyframes capRise { from { transform: scaleY(0); } to { transform: scaleY(1); } }`}</style>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: "auto" }}>
          {/* threshold lines */}
          {[["cap", "Cap", "#64748b"], ["tax", "Tax", "#f59e0b"], ["apron1", "1st apron", "#f97316"], ["apron2", "2nd apron", "#ef4444"]].map(([k, lbl, c]) => {
            const v = cur ? cur.lines[k] : capFor(y0)[k];
            return (
              <g key={k}>
                <line x1={padL} x2={W - padR + 4} y1={yOf(v)} y2={yOf(v)} stroke={c} strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
                <text x={W - padR + 7} y={yOf(v) + 2.5} fontSize="7" fontWeight="700" fill={c}>{lbl} ${Math.round(v)}M</text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const x = padL + slot * i + (slot - bw) / 2;
            let acc = 0;
            const on = d.yr === sel;
            return (
              <g key={d.yr} onClick={() => setSel(d.yr)} style={{ cursor: "pointer" }}>
                <rect x={padL + slot * i} y={padT} width={slot} height={H - padT - padB} fill={on ? color : "transparent"} opacity={on ? 0.06 : 0} rx="8" />
                {BUCKETS.map(([b, , c]) => {
                  const v = d.byBucket[b] || 0; if (!v) return null;
                  const y1 = yOf(acc + v), h = yOf(acc) - yOf(acc + v); acc += v;
                  return <rect key={b} x={x} y={y1} width={bw} height={h} fill={bucketColor(b, color, c)} rx={1.5}
                    opacity={on ? 1 : 0.55} style={{ transformOrigin: `${x}px ${H - padB}px`, animation: `capRise .5s ease-out ${i * 80}ms both` }} />;
                })}
                <text x={x + bw / 2} y={yOf(d.total) - 4} textAnchor="middle" fontSize="9" fontWeight="800" fill="currentColor" className="text-slate-800 dark:text-slate-100">{d.total ? "$" + Math.round(d.total) + "M" : ""}</text>
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fontWeight={on ? 800 : 600} fill={on ? color : "#94a3b8"}>{seasonLabel(d.yr)}</text>
                {d.lines.projected && <text x={x + bw / 2} y={H + 0} textAnchor="middle" fontSize="6" fill="#94a3b8">proj. lines</text>}
              </g>
            );
          })}
        </svg>
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 mt-1">
          {BUCKETS.map(([b, lbl, c]) => (
            <span key={b} className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: bucketColor(b, color, c) }} />{lbl}
            </span>
          ))}
        </div>
      </div>

      {cur && (
        <>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Tile borderColor={tileBorder(abbr)} labelColor={teamColor(abbr)} value={cur.total ? fmtM(cur.total) : "—"} label={seasonLabel(cur.yr) + " Payroll"} sub={cur.rows.length + " under contract"} />
            <Tile borderColor={tileBorder(abbr)} labelColor={teamColor(abbr)} value={(room >= 0 ? "+" : "−") + fmtM(Math.abs(room)).slice(1)} label="vs Cap" valueClass={room >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"} sub={room >= 0 ? "cap space" : "over the cap"} />
            <Tile borderColor={tileBorder(abbr)} labelColor={teamColor(abbr)} value={(vsTax >= 0 ? "+" : "−") + fmtM(Math.abs(vsTax)).slice(1)} label="vs Tax" valueClass={vsTax > 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"} sub={{ label: status, cls: statusCls }} />
          </div>
          <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mt-5 mb-1.5 px-1">{seasonLabel(cur.yr)} on the books</div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {cur.rows.length === 0 && <div className="text-center text-sm text-slate-400 py-8 px-6">No salary on the books for {seasonLabel(cur.yr)} yet.</div>}
            {cur.rows.map(({ p, salary, bucket, type }) => (
              <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800">
                <Avatar p={p} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                    <span className="text-xs font-extrabold tabular-nums text-slate-700 dark:text-slate-200 ml-2 shrink-0">{fmtM(salary)}</span>
                  </span>
                  <span className="flex items-center gap-2 mt-1">
                    <span className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <span className="block h-full rounded-full" style={{ width: Math.max(2, (salary / cur.rows[0].salary) * 100) + "%", backgroundColor: bucket === "committed" ? color : BUCKETS.find(([b]) => b === bucket)[2] }} />
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 w-14 text-right shrink-0">{TYPE_LABEL[type] || type}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="text-[9px] text-slate-400 mt-2 px-1">Tap a season bar to switch. Cap holds for free agents aren't counted. {cur.lines.projected ? "Threshold lines for this season are projected at +5.5%/yr." : ""}</div>
        </>
      )}
    </div>
  );
}

// ═══════════════ BIO PANEL (Avg Age tile) ════════════════════════
function BioPanel({ roster, abbr, teams, players, color, onSelectPlayer }) {
  const ages = roster.map((p) => Number(p.age)).filter((a) => a > 0);
  const buckets = [["≤ 23", (a) => a <= 23], ["24–27", (a) => a >= 24 && a <= 27], ["28–31", (a) => a >= 28 && a <= 31], ["32+", (a) => a >= 32]]
    .map(([lbl, f]) => [lbl, ages.filter(f).length]);
  const maxB = Math.max(1, ...buckets.map(([, n]) => n));
  const exp = (p) => seasonsPlayed(p);
  const exps = roster.map(exp).filter((e) => e != null);
  const avgExp = exps.length ? exps.reduce((a, b) => a + b, 0) / exps.length : null;
  const rookies = roster.filter((p) => exp(p) === 0 || (exp(p) === 1 && seasonStarted())).length;
  // Homegrown: drafted by this same team (Draft Team field, or "(NY)" at the end of the Draft text)
  const draftAb = (p) => { const t = p.draftTeam ? (toAbbr(p.draftTeam) || String(p.draftTeam).toUpperCase()) : draftedBy(p); return t ? String(t).toUpperCase() : null; };
  const drafted = roster.filter((p) => !isUndrafted(p) && draftAb(p) && draftAb(p) === String(abbr).toUpperCase()).length;
  // Avg experience ranked against the league (1st = most experienced)
  const expRank = (() => {
    const teamAvg = (t) => { const ab = t.abbr || toAbbr(t.name); const rs = (players || []).filter((q) => teamOfPlayer(q) === ab); const es = rs.map(seasonsPlayed).filter((e) => e != null); return es.length >= 5 ? es.reduce((a, b) => a + b, 0) / es.length : null; };
    const ranked = (teams || []).filter((t) => !isFaTeam(t)).map((t) => [t.id, teamAvg(t)]).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
    const i = ranked.findIndex(([id]) => (teams || []).find((t) => t.id === id && (t.abbr || toAbbr(t.name)) === abbr));
    return i >= 0 ? { rank: i + 1, of: ranked.length } : null;
  })();
  const list = roster.slice().sort((a, b) => (Number(b.age) || 0) - (Number(a.age) || 0) || a.name.localeCompare(b.name));
  const draftLine = (p) => {
    if (isUndrafted(p)) return "Undrafted";
    const parts = [];
    if (p.draftYear) parts.push(String(p.draftYear));
    if (p.draftRound || p.draftPick) parts.push([p.draftRound ? "R" + p.draftRound : "", p.draftPick ? "#" + p.draftPick : ""].filter(Boolean).join(" "));
    else if (p.draft) parts.push(p.draft);
    return parts.length ? parts.join(" · ") : "";
  };
  return (
    <div className="mt-4">
      <div className="grid grid-cols-3 gap-2">
        <Tile borderColor={tileBorder(abbr)} labelColor={teamColor(abbr)} value={avgExp != null ? avgExp.toFixed(1) : "—"} label="Avg Exp" sub={expRank ? { label: ordinal(expRank.rank), cls: expRank.rank <= 10 ? "text-green-600 dark:text-green-400" : expRank.rank <= 20 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500 dark:text-red-400" } : "seasons"} />
        <Tile borderColor={tileBorder(abbr)} labelColor={teamColor(abbr)} value={rookies} label="Rookies" />
        <Tile borderColor={tileBorder(abbr)} labelColor={teamColor(abbr)} value={roster.length ? Math.round((drafted / roster.length) * 100) + "%" : "—"} label="Drafted" sub={drafted + " drafted by " + abbr} />
      </div>
      <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mt-5 mb-1.5 px-1">Age profile</div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3">
        <div className="grid grid-cols-4 gap-2 items-end h-20">
          {buckets.map(([lbl, n]) => (
            <div key={lbl} className="flex flex-col items-center justify-end h-full">
              <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 mb-1">{n}</span>
              <div className="w-full rounded-t-md" style={{ height: Math.max(4, (n / maxB) * 52) + "px", backgroundColor: color, opacity: n ? 1 : 0.15 }} />
              <span className="text-[9px] font-semibold text-slate-400 mt-1.5">{lbl}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mt-5 mb-1.5 px-1">Roster bios · oldest first</div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {list.map((p) => (
          <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800">
            <Avatar p={p} />
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                <span className="text-xs font-extrabold tabular-nums text-slate-700 dark:text-slate-200 shrink-0">{p.age ? p.age + " yrs" : "—"}</span>
              </span>
              <span className="block text-[11px] text-slate-400 font-medium truncate">
                {[p.height, p.weight ? String(p.weight).replace(/\s*lbs?$/i, "") + " lbs" : "", experienceOf(p) ? experienceOf(p) : ""].filter(Boolean).join(" · ")}
              </span>
              <span className="block text-[10px] text-slate-400 truncate">
                {[draftLine(p), p.college, p.birthplace].filter(Boolean).join(" · ") || "No bio fields yet"}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Horizontal swipe detector. Fires only on a clear sideways flick so
// vertical scrolling never triggers it.
function TeamDetail({ team, teams, players, onBack, onSelectPlayer, onSelectTeam, backLabel, onJumpToTeamStats, onOpenGame }) {
  // swipe right = back; swipe left = next team alphabetically
  const ordered = useMemo(() => (teams || []).filter((t) => !isFaTeam(t)).slice().sort((a, b) => String(a.name).localeCompare(String(b.name))), [teams]);
  const idx = ordered.findIndex((t) => t.id === team.id);
  const nextTeam = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  const prevTeam = idx > 0 ? ordered[idx - 1] : null;
  // Swipe left: next team. Swipe right: previous team if you've been
  // flipping through teams, otherwise back to the list.
  const mem = TEAM_VIEW_MEMORY[team.id] || (TEAM_VIEW_MEMORY[team.id] = {});
  const [seg, setSeg_] = useState(mem.seg || "roster");
  const setSeg = (k) => { mem.seg = k; setSeg_(k); };
  const segRef = useRef(seg); segRef.current = seg;
  const swipe = useSwipe(
    () => { if (nextTeam && onSelectTeam) { SWIPE_DEPTH.n++; onSelectTeam(nextTeam); window.scrollTo(0, 0); } },
    () => { if (SWIPE_DEPTH.n > 0 && prevTeam && onSelectTeam) { SWIPE_DEPTH.n--; onSelectTeam(prevTeam); window.scrollTo(0, 0); } else { SWIPE_DEPTH.n = 0; onBack(); } }
  );
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const abbr = team.abbr || toAbbr(team.name);
  const [rosterView, setRosterView_] = useState(mem.rosterView || "court"); // court | list | injuries
  const setRosterView = (k) => { mem.rosterView = k; setRosterView_(k); };
  const [statMode, setStatMode] = useState("leaders");
  const [statsLayout, setStatsLayout_] = useState(mem.statsLayout || "profile");
  const setStatsLayout = (k) => { mem.statsLayout = k; setStatsLayout_(k); };
  const [cView, setCView_] = useState(mem.cView || "list"); // list | cap | fa | bio | moves
  const setCView = (k) => { mem.cView = k; setCView_(k); };
  const faOnly = cView === "fa";
  const toggleC = (k) => setCView((v) => (v === k ? "list" : k));
  const faTeam = isFaTeam(team);
  const roster = rosterOf(team, players);
  const payroll = roster.reduce((a, p) => a + currentSalary(p), 0);

  const groups = {};
  for (const p of roster) {
    const role = ROLE_ORDER.includes(p.role) ? p.role : "Roster";
    (groups[role] ??= []).push(p);
  }
  const roleGroups = [...ROLE_ORDER.filter((r) => groups[r]), ...(groups["Roster"] ? ["Roster"] : [])].map((r) => [r, groups[r]]);
  // List view mirrors the court: Starters PG→C, then Bench/Reserves/Two-Way by minutes.
  const listGroups = useMemo(() => {
    if (isFaTeam(team)) return [["Free Agents", roster.slice().sort(byMinutes)]];   // one list, by minutes
    const lu = lineupOf(roster, abbr);
    return [["Starters", lu.starters.map((x) => Object.assign(Object.create(x.p), { _slot: x.slot }))], ...lu.benchGroups];
  }, [roster, abbr, team, lineupFor(abbr)]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24" {...swipe}>
      <div className="px-5 pb-6 text-white" style={{ backgroundColor: teamColor(abbr), paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <button onClick={onBack} className="text-sm font-semibold opacity-80 mb-4">‹ {backLabel || "Teams"}</button>
        <div className="flex items-center gap-4">
          {team.logo ? (
            <img src={team.logo} alt="" className="w-16 h-16 object-contain shrink-0" style={{ filter: (abbr === "HOU" ? "brightness(0) invert(1) " : "") + "drop-shadow(0 1px 3px rgba(0,0,0,0.35))", ...logoTrim(abbr) }} />
          ) : (
            <span className="text-3xl">🏀</span>
          )}
          <div className="min-w-0">
            <div className="text-2xl font-extrabold leading-tight">{team.name} {!faTeam && team.wins != null && <span className="text-base font-bold text-white/80 whitespace-nowrap">({team.wins ?? 0}-{team.losses ?? 0})</span>}</div>
            <div className="text-sm opacity-80 font-medium mt-0.5 truncate">
              {(() => {
                if (!team.division) return [team.conference].filter(Boolean).join(" · ") || "—";
                const rivals = (teams || []).filter((t) => t.division === team.division)
                  .sort((a, b) => winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0));
                const i = rivals.findIndex((t) => t.id === team.id);
                const ord = i >= 0 ? (ORDINALS[i] || `${i + 1}th`) : null;
                return ord ? `${ord} in ${team.division} Division` : `${team.division} Division`;
              })()}
            </div>
            {team.arena && <div className="text-[11px] opacity-70 font-semibold mt-0.5 truncate">🏟 {team.arena}</div>}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3">
        {seg === "schedule" && <TeamSchedule team={team} abbr={abbr} teams={teams} tilesOnly />}
        <div className={"grid grid-cols-3 gap-2" + ((faTeam && seg !== "contracts") || seg === "schedule" ? " hidden" : "")}>
          {seg === "contracts" ? (() => {
            // Contracts view tiles: payroll · free agents next offseason · avg age (ranked youngest → oldest)
            const fa = faEligible(roster).length;
            const ages = roster.map((p) => Number(p.age)).filter((a) => a > 0);
            const avgAge = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null;
            const teamAvg = (t) => {
              const ab = t.abbr || toAbbr(t.name);
              const rs = players.filter((q) => (q.teamId && q.teamId === t.id) || teamOfPlayer(q) === ab || String(q.teamName || "").toLowerCase() === String(t.name || "").toLowerCase());
              const as = rs.map((q) => Number(q.age)).filter((a) => a > 0);
              return as.length >= 5 ? as.reduce((a, b) => a + b, 0) / as.length : null;
            };
            const ageRanked = (teams || []).filter((t) => !isFaTeam(t)).map((t) => [t.id, teamAvg(t)]).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1]);
            const ageRank = ageRanked.findIndex(([id]) => id === team.id) + 1;
            const ageCls = ageRank ? (ageRank <= 10 ? "text-green-600 dark:text-green-400" : ageRank <= 20 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500 dark:text-red-400") : null;
            return (
              <>
                <Tile borderColor={tileBorder(abbr)} labelColor={teamColor(abbr)} value={payroll ? fmtM(payroll) : "—"} label="Payroll" sub={roster.length + " players"} onClick={() => toggleC("cap")} active={cView === "cap"} activeColor={teamColor(abbr)} />
                <Tile borderColor={tileBorder(abbr)} labelColor={teamColor(abbr)} value={fa} label="Free Agents" sub={"(Summer " + (startYear(CURRENT_SEASON) + 1) + ")"} onClick={() => toggleC("fa")} active={faOnly} activeColor={teamColor(abbr)} />
                <Tile borderColor={tileBorder(abbr)} labelColor={teamColor(abbr)} value={avgAge != null ? avgAge.toFixed(1) : "—"} label="Avg Age" sub={ageRank ? { label: ordinal(ageRank) + (ageRank <= 3 ? " youngest" : ageRank >= ageRanked.length - 2 ? " oldest" : ""), cls: ageCls } : null} onClick={() => toggleC("bio")} active={cView === "bio"} activeColor={teamColor(abbr)} />
              </>
            );
          })() : (
            <>

              <Tile value={team.ppg != null ? team.ppg.toFixed(1) : "—"} label={STANDINGS_PHASE.v === "preseason" ? "PPG · Pre" : "PPG"} sub={rankOf(teams, team, "ppg", "desc")} borderColor={tileBorder(abbr)} labelColor={teamColor(abbr)} onClick={onJumpToTeamStats ? () => onJumpToTeamStats(team, "ppg") : undefined} />
              <Tile value={team.oppPpg != null ? team.oppPpg.toFixed(1) : "—"} label={STANDINGS_PHASE.v === "preseason" ? "Opp PPG · Pre" : "Opp PPG"} sub={rankOf(teams, team, "oppPpg", "asc")} borderColor={tileBorder(abbr)} labelColor={teamColor(abbr)} onClick={onJumpToTeamStats ? () => onJumpToTeamStats(team, "oppPpg") : undefined} />
              <Tile value={team.ppg != null && team.oppPpg != null ? ((team.ppg - team.oppPpg) > 0 ? "+" : "") + (team.ppg - team.oppPpg).toFixed(1) : "—"} label="Net" valueClass={team.ppg != null && team.oppPpg != null ? ((team.ppg - team.oppPpg) > 0 ? "text-green-600 dark:text-green-400" : (team.ppg - team.oppPpg) < 0 ? "text-red-500" : "text-slate-900 dark:text-white") : undefined} sub={rankOf(teams.map((t) => ({ ...t, net: t.ppg != null && t.oppPpg != null ? t.ppg - t.oppPpg : null })), { ...team, net: team.ppg != null && team.oppPpg != null ? team.ppg - team.oppPpg : null }, "net", "desc")} borderColor={tileBorder(abbr)} labelColor={teamColor(abbr)} onClick={onJumpToTeamStats ? () => onJumpToTeamStats(team, "net") : undefined} />
            </>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          {[["roster", "Roster"], ["schedule", "Schedule"], ["contracts", "Contracts"], ["stats", "Stats"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setSeg(k)}
              className={"flex-1 py-2 rounded-full text-xs font-bold transition-colors " + (seg === k
                ? "text-white"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
              style={seg === k ? { backgroundColor: teamColor(abbr) } : undefined}>
              {lbl}
            </button>
          ))}
        </div>

        {seg === "roster" && !faTeam && (
          <div className="flex gap-2 mt-4">
            {[["court", "Court"], ["list", "List"], ["injuries", "Injuries"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setRosterView(k)}
                className={"flex-1 py-1.5 rounded-full text-[11px] font-extrabold " + (rosterView === k
                  ? "text-white"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
                style={rosterView === k ? { backgroundColor: teamColor(abbr) } : undefined}>
                {lbl}
              </button>
            ))}
          </div>
        )}
        {seg === "roster" && rosterView === "injuries" && <TeamInjuries roster={roster} abbr={abbr} onSelectPlayer={onSelectPlayer} />}
        {seg === "roster" && rosterView === "court" && !faTeam && (
          <CourtView roster={roster} abbr={abbr} team={team} teams={teams} onSelectPlayer={onSelectPlayer} />
        )}
        {seg === "stats" && (
          <>
            <div className="grid grid-cols-4 gap-2 mt-3 mb-3">
              {[["profile", "Profile"], ["leaders", "Leaders"], ["offense", "Offense"], ["defense", "Defense"], ["rebounds", "Rebounds"], ["playmaking", "Playmaking"], ["volume", "Volume"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setStatsLayout(k)}
                  className={"flex items-center gap-1.5 pl-2 pr-1 py-1.5 rounded-lg text-[10px] font-extrabold border truncate " + (statsLayout === k ? "text-slate-900 dark:text-white" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800")}
                  style={statsLayout === k ? { borderColor: teamColor(abbr), backgroundColor: teamColor(abbr) + "1A" } : undefined}>
                  <span className="w-2.5 h-2.5 rounded-full border-2 shrink-0" style={{ borderColor: statsLayout === k ? teamColor(abbr) : "#94a3b8", backgroundColor: statsLayout === k ? teamColor(abbr) : "transparent" }} />
                  <span className="truncate">{lbl}</span>
                </button>
              ))}
            </div>
            {statsLayout === "profile" && <TeamProfile roster={roster} abbr={abbr} teams={teams} players={players} />}
            {statsLayout === "table" && <TeamTrends roster={roster} abbr={abbr} onSelectPlayer={onSelectPlayer} />}
            {statsLayout === "leaders" && <TeamLeaders roster={roster} abbr={abbr} onSelectPlayer={onSelectPlayer} />}
            {TEAM_BARS[statsLayout] && <TeamBars roster={roster} abbr={abbr} set={TEAM_BARS[statsLayout]} onSelectPlayer={onSelectPlayer} />}
          </>
        )}
        {seg === "roster" && (rosterView === "list" || faTeam) && listGroups.map(([role, members]) => (
          <div key={role}>
            <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mt-6 mb-2 px-1">{role}</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {(faTeam ? members.slice().sort((a, b) => currentSalary(b) - currentSalary(a)) : members)
                .map((p) => (
                  <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-start gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                    <span className="w-8 h-8 shrink-0 self-center rounded-lg flex items-center justify-center text-[10px] font-extrabold uppercase text-white" style={{ backgroundColor: teamColor(abbr) }}>{p._slot || courtPos(p) || "—"}</span>
                    <Avatar p={p} size="md" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {cleanNo(p.no) && <span className="text-slate-400 font-semibold mr-1.5">#{cleanNo(p.no)}</span>}{p.name}
                      </span>
                      <span className="flex items-start gap-1.5 mt-0.5 min-w-0">
                        {!isActiveStatus(p) && <span className="mt-0.5"><StatusBadge status={/game\s*time|gtd/i.test(effectiveStatus(p)) ? "GTD" : effectiveStatus(p)} /></span>}
                        <span className="flex-1" />
                        {(() => {
                          const st = curStats(p); const pv = (p.stats || []).find((x) => startYear(x.season) === startYear(CURRENT_SEASON) - 1) || null;   // arrows: vs last season
                          if (!st || !(st.gp > 0) || (st.pts == null && st.reb == null && st.ast == null)) return null;
                          const Arrow = ({ k }) => {
                            if (!pv || st[k] == null || pv[k] == null) return null;
                            const d = st[k] - pv[k];
                            if (Math.abs(d) < 0.05) return null;
                            return <span className={"text-[7px] leading-none " + (d > 0 ? "text-emerald-500" : "text-red-500")}>{d > 0 ? "▲" : "▼"}</span>;
                          };
                          return (
                            <span className="flex gap-1.5 shrink-0">
                              {[["PTS", "pts"], ["REB", "reb"], ["AST", "ast"]].map(([lbl, k]) => (
                                <span key={lbl} className="w-[52px] rounded-lg overflow-hidden border text-center" style={{ borderColor: teamColor(abbr) }}>
                                  <span className="block text-[8px] font-extrabold text-white uppercase tracking-wide py-[3px]" style={{ backgroundColor: teamColor(abbr) }}>{lbl}</span>
                                  <span className="flex items-center justify-center gap-[2px] text-[13px] font-extrabold text-slate-800 dark:text-slate-100 tabular-nums py-1 bg-slate-50 dark:bg-slate-800">
                                    <span>{fmt1(st[k]) ?? "—"}</span><Arrow k={k} />
                                  </span>
                                </span>
                              ))}
                            </span>
                          );
                        })()}
                      </span>
                      {!isActiveStatus(p) && (injuryDetailOf(p) || injuryReturnOf(p)) && (
                        <span className="block text-[11px] mt-1 leading-snug truncate">
                          {injuryDetailOf(p) && <span className="font-semibold text-red-500">({injuryDetailOf(p)})</span>}
                          {injuryDetailOf(p) && injuryReturnOf(p) && <span className="text-slate-300 dark:text-slate-600"> · </span>}
                          {injuryReturnOf(p) && <span className="font-semibold text-slate-500 dark:text-slate-400">Returns {injuryReturnOf(p)}</span>}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        ))}
        {seg === "contracts" && cView === "cap" && <CapOutlook roster={roster} color={teamColor(abbr)} onSelectPlayer={onSelectPlayer} />}
        {seg === "contracts" && cView === "bio" && <BioPanel roster={roster} abbr={abbr} teams={teams} players={players} color={teamColor(abbr)} onSelectPlayer={onSelectPlayer} />}
        {seg === "schedule" && <TeamSchedule team={team} abbr={abbr} teams={teams} onSelectTeam={onSelectTeam} onOpenGame={onOpenGame} />}
        {seg === "contracts" && (
          <div className="flex gap-2 mt-3">
            {[["list", "Contracts"], ["moves", "Transactions"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setCView(k)}
                className={"flex-1 py-1.5 rounded-full text-[11px] font-extrabold border " + ((cView === k || (k === "list" && cView !== "moves")) ? "text-white border-transparent" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800")}
                style={(cView === k || (k === "list" && cView !== "moves")) ? { backgroundColor: teamColor(abbr) } : undefined}>{lbl}</button>
            ))}
          </div>
        )}
        {seg === "contracts" && cView === "moves" && <div className="-mx-4"><TransactionsFeed players={players} teams={teams} onSelect={onSelectPlayer} onlyTeam={abbr} embedded /></div>}
        {seg === "contracts" && (cView === "list" || cView === "fa") && (
          <>
            <div className="flex items-baseline justify-between mt-6 mb-2 pl-1 pr-4">
              <span className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase">{faOnly ? "Free Agents · " + (startYear(CURRENT_SEASON) + 1) : "Team Contracts"}</span>
              {faOnly
                ? <span className="w-24 text-center text-[10px] font-bold tracking-widest uppercase text-slate-400">Deadline</span>
                : <span className="text-[11px] font-bold text-slate-400">{roster.length} players</span>}
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {(() => { const fe = new Set(faEligible(roster).map((x) => x.id)); const dlT = (p) => { const ev = nextEvent(p); const d = ev ? eventDeadline(ev) : null; return d && d.date ? d.date.getTime() : Infinity; };
                const lu = lineupOf(roster, abbr); const slot = {}; lu.starters.forEach((x, i) => { slot[x.p.id] = i; });
                const starterOrder = (a, b) => ((slot[a.id] ?? 9) - (slot[b.id] ?? 9)) || (mpgOf(b) - mpgOf(a)) || a.name.localeCompare(b.name);
                return roster.slice().sort((a, b) => faOnly
                  ? (fe.has(b.id) - fe.has(a.id)) || (dlT(a) - dlT(b)) || starterOrder(a, b)
                  : (currentSalary(b) - currentSalary(a)) || starterOrder(a, b)); })()
                .map((p) => {
                  const act = activeOf(p);
                  const hot = faOnly && faEligible(roster).some((x) => x.id === p.id);   // free agent this coming summer
                  return (
                    <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-start gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800"
                      style={hot ? { borderLeft: "4px solid " + teamColor(abbr), paddingLeft: 12, backgroundColor: teamColor(abbr) + "14" } : undefined}>
                      <Avatar p={p} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                        <span className="block text-[11px] text-slate-400 font-medium truncate">
                          {act ? <ContractLine c={act} noTerms /> : "No contract"}
                        </span>
                        {nextEvent(p) && (
                          <span className="block mt-1"><EventPill ev={nextEvent(p)} withDate={!faOnly} noYear={faOnly} /></span>
                        )}
                      </span>
                      <span className={faOnly ? "w-24 text-center shrink-0" : "text-right shrink-0 self-center"}>
                        {faOnly ? (() => { const ev = nextEvent(p); const dl = ev ? eventDeadline(ev) : null; return dl ? (
                          <span className={"block text-xs font-extrabold tabular-nums " + (hot ? "text-slate-900 dark:text-white" : "text-slate-400")}>{dl.label}</span>
                        ) : <span className="text-xs font-extrabold text-slate-400">—</span>; })()
                        : <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 whitespace-nowrap">{act ? terms(act) : "—"}</span>}
                      </span>
                    </button>
                  );
                })}
              {roster.length === 0 && <div className="text-center text-sm text-slate-400 py-10">No players linked yet.</div>}
            </div>
          </>
        )}

        {seg === "roster" && roster.length === 0 && (
          <div className="text-center text-sm text-slate-400 mt-16">
            No players linked to {team.name} yet.
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════ TAB: DRAFT ══════════════════════════════════════

function roundOf(p) {
  if (isUndrafted(p)) return null;
  if (p.draftRound != null) return Number(p.draftRound) || null;
  const t = String(p.draft || "");
  let m = t.match(/(?:round|rnd|rd|r)\s*\.?\s*(\d)/i) || t.match(/(\d)(?:st|nd)\s*round/i);
  if (m) return Number(m[1]);
  // fall back to the pick number: 1-30 first round, 31-60 second
  const pk = pickOf(p);
  if (pk !== 999) return pk <= 30 ? 1 : 2;
  return null;
}
function isUndrafted(p) {
  return /undrafted/i.test(String(p.draft || ""));
}
function draftedBy(p) {
  const m = String(p.draft || "").match(/\(([A-Za-z]{2,4})\)\s*$/);
  return m ? m[1].toUpperCase() : null;
}
function pickOf(p) {
  if (p.draftPick != null) return p.draftPick;
  const m = String(p.draft || "").match(/pick\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : 999;
}


const STAT_CATS = [
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TO" },
];

const STAT_GROUPS = [
  { key: "scoring", label: "Scoring", cats: [["pts", "PTS"], ["fgm", "FGM"], ["p3m", "3PM"], ["ftm", "FTM"]] },
  { key: "rebounds", label: "Rebounds", cats: [["reb", "Total"], ["oreb", "Offensive"], ["dreb", "Defensive"]] },
  { key: "playmaking", label: "Playmaking", cats: [["ast", "AST"], ["tov", "TO"]] },
  { key: "defense", label: "Defense", cats: [["stl", "STL"], ["blk", "BLK"]] },
  { key: "shooting", label: "Shooting", cats: [["fg", "FG%"], ["p3", "3P%"], ["ft", "FT%"]], pct: true },
  { key: "minutes", label: "Minutes", cats: [["min", "MIN"]] },
  { key: "teams", label: "Teams", cats: [["ppg", "PPG"], ["oppPpg", "OPP PPG"], ["net", "NET"], ["winPct", "WIN %"]], team: true },
];
function StatsTab({ players, teams, onSelect, focus, onBackToPlayer }) {
  const swipe = useSwipe(null, focus && onBackToPlayer ? onBackToPlayer : null);
  const seasons = Array.from(new Set([CURRENT_SEASON, ...players.flatMap((p) => (p.stats || []).map((s) => s.season)).filter(Boolean)])).sort((a, b) => String(b).localeCompare(String(a)));
  const [selSeason, setSelSeason] = useState(null);
  const season = selSeason && seasons.includes(selSeason) ? selSeason : (seasons.includes(CURRENT_SEASON) ? CURRENT_SEASON : seasons[0]);
  const [group, setGroup] = useState("scoring");
  const [cat, setCat] = useState("pts");
  // A jump from a player card lands on that stat and highlights the row
  useEffect(() => {
    if (!focus) return;
    const g = STAT_GROUPS.find((g) => (focus.teamId ? g.team : !g.team) && g.cats.some(([k]) => k === focus.cat));
    if (g) { setGroup(g.key); setCat(focus.cat); }
    setTimeout(() => { const el = document.getElementById("stat-row-" + (focus.teamId || focus.id)); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 120);
  }, [focus?.n]);
  const grp = STAT_GROUPS.find((g) => g.key === group) || STAT_GROUPS[0];
  const pickGroup = (k) => { setGroup(k); setCat(STAT_GROUPS.find((g) => g.key === k).cats[0][0]); };
  const gate = grp.pct ? { fg: ["fga", 3], p3: ["p3a", 1.5], ft: ["fta", 1.5] }[cat] : null;
  const rows = players.map((p) => { const st = (p.stats || []).find((s) => s.season === season); return st && st[cat] != null && (!gate || (st[gate[0]] ?? 0) >= gate[1]) ? { p, st, tot: grp.pct ? st[cat] : totalOf(st, cat) } : null; })
    .filter(Boolean).sort((a, b) => b.tot - a.tot);
  const catLabel = grp.cats.find(([k]) => k === cat)?.[1] || "";
  const abbrOf = (p) => teamOfPlayer(p) || toAbbr(p.teamName) || "";
  return (
    <div {...swipe}>
      <div className="bg-blue-600 pb-4 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex items-baseline gap-2 mb-3">
          <h1 className="text-3xl font-extrabold text-white">Leaders</h1>
          <span className="text-sm font-semibold text-blue-200">{season ? seasonTick({ season }) : ""} · season totals</span>
          {seasons.length > 1 && (
            <select value={season || ""} onChange={(e) => setSelSeason(e.target.value)} className="ml-auto bg-blue-500/60 text-blue-100 text-[11px] font-bold rounded-full px-2 py-1 outline-none">
              {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {STAT_GROUPS.map((g) => (
            <button key={g.key} onClick={() => pickGroup(g.key)}
              className={"shrink-0 px-4 py-1.5 rounded-full text-sm font-bold " + (g.key === group ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100 active:bg-blue-500")}>{g.label}</button>
          ))}
        </div>
        {grp.cats.length > 1 && (
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
            {grp.cats.map(([k, lbl]) => (
              <button key={k} onClick={() => setCat(k)}
                className={"shrink-0 px-3.5 py-1 rounded-full text-xs font-bold " + (k === cat ? "bg-white/90 text-blue-700" : "bg-blue-500/60 text-blue-100 active:bg-blue-500")}>{lbl}</button>
            ))}
          </div>
        )}
      </div>
      {grp.team ? (() => {
        const val = (t) => cat === "ppg" ? t.ppg : cat === "oppPpg" ? t.oppPpg : cat === "net" ? (t.ppg != null && t.oppPpg != null ? t.ppg - t.oppPpg : null) : winPct(t);
        const trows = (teams || []).filter((t) => !isFaTeam(t)).map((t) => ({ t, v: val(t) })).filter((r) => r.v != null).sort((a, b) => cat === "oppPpg" ? a.v - b.v : b.v - a.v);
        return (
          <div className="px-4 pb-28 mt-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="flex justify-between px-4 py-2 text-[10px] font-extrabold tracking-widest uppercase text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800">
                <span>Team</span><span>{catLabel}</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {trows.map(({ t, v }, i) => {
                  const ab = t.abbr || toAbbr(t.name); const hot = focus && focus.teamId === t.id;
                  return (
                    <div key={t.id} id={"stat-row-" + t.id} className={"flex items-center gap-3 pr-4 py-3 " + (hot ? "bg-slate-100 dark:bg-slate-800 ring-2 ring-inset ring-slate-400" : "")} style={{ borderLeft: "4px solid " + teamColor(ab), paddingLeft: 12 }}>
                      <span className="w-6 text-center text-sm font-extrabold shrink-0 tabular-nums text-slate-400">{i + 1}</span>
                      {t.logo && <img src={t.logo} alt="" className="w-9 h-9 object-contain shrink-0" style={logoTrim(ab)} />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{t.name}</span>
                        <span className="block text-[11px] text-slate-400 font-semibold">{t.wins ?? 0}-{t.losses ?? 0}</span>
                      </span>
                      <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">{cat === "winPct" ? (v * 100).toFixed(1) + "%" : cat === "net" ? (v >= 0 ? "+" : "") + v.toFixed(1) : v.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })() : (
      <div className="px-4 pb-28 mt-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="flex justify-between px-4 py-2 text-[10px] font-extrabold tracking-widest uppercase text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800">
            <span>Player</span><span>{catLabel}{grp.pct ? "" : " · total"}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map(({ p, st, tot }, i) => {
              const ab = abbrOf(p); const hot = focus && focus.id === p.id;
              const rankNo = rows.findIndex((r) => r.tot === tot) + 1;   // ties share a rank
              return (
                <button key={p.id} id={"stat-row-" + p.id} onClick={() => onSelect(p)}
                  className={"w-full flex items-center gap-3 pr-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800 " + (hot ? "bg-slate-100 dark:bg-slate-800 ring-2 ring-inset ring-slate-400" : "")}
                  style={{ borderLeft: "4px solid " + teamColor(ab), paddingLeft: 12 }}>
                  <span className="w-6 text-center text-sm font-extrabold shrink-0 tabular-nums text-slate-400">{rankNo}</span>
                  <Avatar p={p} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                    <span className="flex items-center gap-1.5 mt-0.5">
                      {TEAM_LOGOS[ab] && <img src={TEAM_LOGOS[ab]} alt="" className="w-4 h-4 object-contain" style={logoTrim(ab)} />}
                      <span className="text-[11px] text-slate-400 font-semibold">{ab}</span>
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-lg font-extrabold text-slate-900 dark:text-slate-100 tabular-nums leading-none">{grp.pct ? Number(st[cat]).toFixed(1) + "%" : tot.toLocaleString()}</span>
                    <span className="block text-[10px] font-semibold text-slate-400 mt-1">{grp.pct ? (st.gp != null ? Math.round(st.gp) + " g" : "") : fmt1(st[cat]) + "/g"}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {rows.length === 0 && <div className="text-center text-sm text-slate-400 py-12 px-6">No {catLabel} entries for {season || "any season"} yet.</div>}
        </div>
      </div>
      )}
    </div>
  );
}

function DraftTab({ players, onSelect, pills }) {
  const byYear = {};
  const noData = [];
  for (const p of players) {
    if (p.draftYear) (byYear[p.draftYear] ??= []).push(p);
    else noData.push(p);
  }
  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
  const [selYear, setSelYear] = useState(null);
  const [q, setQ] = useState("");
  const yr = selYear && byYear[selYear] ? selYear : years[0]; // default: newest class
  const s0 = q.toLowerCase().trim();
  const match = (p) => !s0 || p.name.toLowerCase().includes(s0) || String(draftedBy(p) || teamOfPlayer(p) || "").toLowerCase().includes(s0) || String(p.college || "").toLowerCase().includes(s0);
  return (
    <div>
      <ListHeader title="Draft" q={q} setQ={setQ} pills={pills} placeholder="Search players or teams…" />
      <div className="px-4 pb-28 mt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase">Draft class</span>
          {years.length > 0 && (
            <span className="relative">
              <select value={yr || ""} onChange={(e) => setSelYear(Number(e.target.value))}
                className="appearance-none bg-blue-600 text-white text-sm font-bold rounded-full pl-4 pr-8 py-2 outline-none">
                {years.map((y) => <option key={y} value={y}>{y} Class</option>)}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white text-xs">▼</span>
            </span>
          )}
        </div>
        {[yr].filter((y) => y != null).map((yr) => {
          const cls = byYear[yr].filter(match);
          const rounds = [
            ["Round 1", cls.filter((p) => roundOf(p) === 1)],
            ["Round 2", cls.filter((p) => roundOf(p) === 2)],
            ["Undrafted", cls.filter((p) => isUndrafted(p))],
            ["Round Unknown", cls.filter((p) => !isUndrafted(p) && (roundOf(p) == null || roundOf(p) > 2))],
          ].filter(([, g]) => g.length > 0);
          return (
            <div key={yr}>
              {rounds.map(([label, group]) => (
                <div key={label}>
                  <div className="flex items-baseline gap-2 mt-5 mb-2 px-1">
                    <span className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase">{label}</span>
                    <span className="text-[11px] font-semibold text-slate-400">· {group.length} player{group.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                    {group.sort((a, b) => pickOf(a) - pickOf(b)).map((p) => {
                      const ab = draftedBy(p) || teamOfPlayer(p) || "";
                      const c = teamColor(ab);
                      return (
                        <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 pr-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800" style={{ borderLeft: "3px solid " + c, paddingLeft: 13 }}>
                          <span className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 text-white" style={{ backgroundColor: c }}>
                            <span className="text-[8px] font-bold uppercase tracking-wider leading-none opacity-90">{isUndrafted(p) ? "UDFA" : "Pick"}</span>
                            <span className="text-base font-extrabold leading-tight tabular-nums">{pickOf(p) !== 999 ? pickOf(p) : "—"}</span>
                          </span>
                          <Avatar p={p} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                            <span className="flex items-center gap-2 mt-1 min-w-0">
                              {courtPos(p) && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold text-white shrink-0" style={{ backgroundColor: c }}>{courtPos(p)}</span>}
                              <span className="text-[11px] text-slate-400 font-medium truncate">{p.college || "—"}</span>
                            </span>
                          </span>
                          {logoFor(ab)
                            ? <span className="flex flex-col items-center shrink-0 w-12"><img src={logoFor(ab)} alt="" className="w-11 h-11 object-contain" style={logoTrim(modernAbbr(ab))} />{modernAbbr(ab) !== String(ab).toUpperCase() && <span className="text-[9px] font-bold text-slate-400 leading-none mt-0.5">{ab}</span>}</span>
                            : <TeamPill team={ab} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        {noData.length > 0 && (
          <div className="text-center text-xs text-slate-400 mt-8">
            {noData.length} player{noData.length === 1 ? "" : "s"} without draft data yet
          </div>
        )}
        {years.length === 0 && (
          <div className="text-center text-sm text-slate-400 mt-16">
            No draft data yet. Fill in the Draft Year field in Airtable and classes will appear here.
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════ PLACEHOLDER TABS ════════════════════════════════
function ComingSoon({ icon, title, blurb }) {
  return (
    <div>
      <div className="bg-blue-600 px-5 pb-5 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
        <div className="text-2xl font-extrabold tracking-tight">{title}</div>
      </div>
      <div className="px-8 pt-24 pb-28 text-center">
        <div className="text-5xl mb-4">{icon}</div>
        <div className="text-lg font-extrabold text-slate-700 dark:text-slate-200">{title} is coming soon</div>
        <div className="text-sm text-slate-400 mt-2 leading-relaxed">{blurb}</div>
      </div>
    </div>
  );
}

// ═══════════════ TAB: TONIGHT (daily matchups) ═══════════════════
// The first thing you see. Basketball is a daily sport, so instead of the
// NFL's "Week N" this is a day strip: yesterday, tonight, and the week ahead.
const ymdOf = (d) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const ymdStr = (d) => String(ymdOf(d));
function dayLabel(d, today) {
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return "Tonight";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString([], { weekday: "short" });
}

function TonightTab({ players, teams, onSelect, onSelectTeam, onOpenGame }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [dayOff, setDayOff] = useState(0);           // days from today
  const [view, setView] = useState("games");         // games | cheat
  const [sb, setSb] = useState(null);
  const days = useMemo(() => Array.from({ length: 8 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() + i - 1); return d; }), [today]);
  const day = days[dayOff + 1];

  useEffect(() => {
    let alive = true;
    setSb(null);
    const load = () => fetch(`/api/scoreboard?date=${ymdStr(day)}`).then((r) => r.json())
      .then((d) => { if (alive && d && d.games) setSb(d); else if (alive && d && d.error) setSb({ games: [], error: d.error }); })
      .catch(() => { if (alive) setSb({ games: [], error: "unreachable" }); });
    load();
    const t = setInterval(load, 60000);              // live scores tick along
    return () => { alive = false; clearInterval(t); };
  }, [dayOff]);

  // Roster lookups so a game card can jump into a team, and so "your"
  // hurt players on tonight's slate get flagged on the card.
  const teamByAbbr = (abbr) => (teams || []).find((t) => (t.abbr || toAbbr(t.name)) === abbr || toAbbr(t.name) === toAbbr(abbr));
  const hurtOn = (abbr) => players.filter((p) => teamOfPlayer(p) === abbr && isHurt(p));

  const games = sb ? sb.games : [];
  const liveCount = games.filter((g) => g.state === "in").length;
  const finalCount = games.filter((g) => g.state === "post").length;
  const stamp = sb && sb.updatedAt ? new Date(sb.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
  const preseason = games.length > 0 && games.every((g) => g.seasonType === 1);

  return (
    <div>
      <div className="bg-blue-600 pb-3 px-4 sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="text-xl font-extrabold text-white">
            {dayLabel(day, today)} <span className="text-blue-200">({day.toLocaleDateString([], { month: "short", day: "numeric" })})</span>
          </h1>
          <span className="text-[11px] font-semibold text-blue-200">
            {!sb ? "loading…" : sb.error ? "scores unavailable" : liveCount > 0 ? `${liveCount} live · ${stamp} ↻` : stamp ? `scores ${stamp} ↻` : ""}
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto mt-3 -mx-1 px-1 pb-0.5" style={{ scrollbarWidth: "none" }}>
          {days.map((d, i) => {
            const off = i - 1, on = off === dayOff;
            return (
              <button key={i} onClick={() => setDayOff(off)}
                className={"shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold leading-none " + (on ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100 active:bg-blue-500")}>
                <div>{dayLabel(d, today)}</div>
                <div className={"text-[9px] font-semibold mt-0.5 " + (on ? "text-blue-500" : "text-blue-200")}>{d.toLocaleDateString([], { month: "numeric", day: "numeric" })}</div>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 mt-2">
          {[["games", "Games"], ["cheat", "Cheat Sheet"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setView(k)} className={"flex-1 py-1.5 rounded-full text-[11px] font-extrabold " + (view === k ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100")}>{lbl}</button>
          ))}
        </div>
      </div>

      {view === "cheat" && <CheatSheet games={games} teams={teams} players={players} onSelect={onSelect} />}
      <div className={"px-4 pt-3 pb-28" + (view === "cheat" ? " hidden" : "")}>
        <style>{`@keyframes hrbRise { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes hrbPing { 75%, 100% { transform: scale(2.2); opacity: 0; } }`}</style>
        {!sb && <div className="p-6 text-center text-xs text-slate-400">Loading games…</div>}
        {sb && sb.error && (
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 text-center">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Couldn't reach the scoreboard</div>
            <div className="text-[11px] text-slate-400 mt-1">ESPN didn't answer. Pull down or check back in a minute.</div>
          </div>
        )}
        {sb && !sb.error && games.length === 0 && (
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 text-center">
            <div className="text-3xl mb-2">🏀</div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">No games {dayLabel(day, today).toLowerCase()}</div>
            <div className="text-[11px] text-slate-400 mt-1">Swipe the day strip to find the next slate.</div>
          </div>
        )}
        {preseason && <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">Preseason</div>}
        {games.length > 0 && !preseason && (
          <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">
            {games.length} game{games.length === 1 ? "" : "s"}{finalCount > 0 ? ` · ${finalCount} final` : ""}
          </div>
        )}
        <div className="space-y-1.5">
          {games.slice().sort((a, b) => ({ in: 0, pre: 1, post: 2 }[a.state] ?? 1) - ({ in: 0, pre: 1, post: 2 }[b.state] ?? 1) || new Date(a.date) - new Date(b.date)).map((g, gi) => {
            const isLive = g.state === "in", isFinal = g.state === "post";
            const tip = new Date(g.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
            const Row = ({ t }) => {
              const lost = isFinal && !t.winner;
              const hurt = hurtOn(t.abbr);
              const tm = teamByAbbr(t.abbr);
              return (
                <button onClick={tm && onSelectTeam ? () => onSelectTeam(tm) : undefined} className="w-full flex items-center gap-2.5 text-left">
                  <img src={t.logo || TEAM_LOGOS[t.abbr] || ""} alt="" className="w-7 h-7 object-contain shrink-0" style={logoTrim(t.abbr)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className={"text-[13px] font-extrabold tracking-wide " + (lost ? "text-slate-400" : "text-slate-900 dark:text-white")}>{t.abbr}</span>
                      {t.record && <span className="text-[10px] font-semibold text-slate-400 tabular-nums">{t.record}</span>}
                      {hurt.length > 0 && <span className="text-[9px] font-extrabold text-red-500">{hurt.length} on report</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate leading-tight">{t.name}</div>
                  </div>
                  <div className={"w-9 text-right text-lg font-extrabold tabular-nums " + (lost ? "text-slate-400" : "text-slate-900 dark:text-white")}>
                    {g.state === "pre" ? "" : (t.score ?? 0)}
                  </div>
                </button>
              );
            };
            const ca = teamColor(g.away.abbr), ch = teamColor(g.home.abbr);
            const hurtA = hurtOn(g.away.abbr).length, hurtH = hurtOn(g.home.abbr).length;
            const Side = ({ t, hurt, right }) => (
              <div className={"flex flex-col items-center w-20 shrink-0 " + (right ? "items-end" : "items-start")}>
                <img src={t.logo || TEAM_LOGOS[t.abbr] || ""} alt="" className="w-12 h-12 object-contain" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))", ...logoOnColor(t.abbr) }} />
                <div className="mt-0.5 text-[13px] font-extrabold text-white tracking-wide">{t.abbr}</div>
                <div className="text-[11px] font-semibold text-white/75 tabular-nums">{t.record || ""}</div>

              </div>
            );
            return (
              <button key={g.id} onClick={() => onOpenGame && onOpenGame(g)}
                className="w-full rounded-2xl shadow-sm overflow-hidden text-left active:opacity-90"
                style={{ background: `linear-gradient(100deg, ${ca} 0%, ${ca} 42%, ${ch} 58%, ${ch} 100%)`, animation: `hrbRise .3s ease-out ${gi * 40}ms both` }}>
                <div className="px-3 py-2.5 flex items-center justify-between gap-2" style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.18))" }}>
                  <Side t={g.away} hurt={hurtA} />
                  <div className="flex-1 min-w-0 text-center text-white">
                    {isLive ? (
                      <>
                        <div className="text-xl font-extrabold tabular-nums leading-none">{g.away.score ?? 0} <span className="opacity-60">–</span> {g.home.score ?? 0}</div>
                        <div className="text-[11px] font-extrabold text-white uppercase mt-1 flex items-center justify-center gap-1">
                          <span className="relative flex w-2 h-2"><span className="absolute inline-flex h-full w-full rounded-full bg-rose-300 opacity-75" style={{ animation: "hrbPing 1.4s cubic-bezier(0,0,.2,1) infinite" }} /><span className="relative inline-flex rounded-full w-2 h-2 bg-rose-400" /></span>
                          {g.detail}
                        </div>
                      </>
                    ) : isFinal ? (
                      <>
                        <div className="text-xl font-extrabold tabular-nums leading-none"><span className={g.away.winner ? "" : "opacity-60"}>{g.away.score ?? 0}</span> <span className="opacity-60">–</span> <span className={g.home.winner ? "" : "opacity-60"}>{g.home.score ?? 0}</span></div>
                        <div className="text-[11px] font-extrabold uppercase mt-1 opacity-90">{g.detail || "Final"}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-lg font-extrabold tabular-nums leading-none">{tip}</div>
                        {g.broadcast && <div className="text-xs font-semibold opacity-85 mt-1">{g.broadcast}</div>}
                      </>
                    )}
                    {g.odds && (g.odds.details || g.odds.overUnder != null) && !isFinal && (
                      <div className="text-[11px] font-semibold opacity-80 mt-1 tabular-nums">{g.odds.details}{g.odds.overUnder != null ? ` · O/U ${g.odds.overUnder}` : ""}</div>
                    )}
                    {g.note && <div className="text-[10px] font-bold opacity-80 mt-0.5 truncate">{g.note}</div>}
                    {isLive && g.lastPlay && <div className="text-[10px] opacity-80 mt-1 line-clamp-2 leading-tight">{g.lastPlay}</div>}
                  </div>
                  <Side t={g.home} hurt={hurtH} right />
                </div>
              </button>
            );
          })}
        </div>
        {games.length > 0 && (
          <div className="text-[9px] text-slate-400 mt-3 px-1">Tap a game for live scoring, leaders, and the latest plays.</div>
        )}
      </div>
    </div>
  );
}

// ═══════════════ APP SHELL ═══════════════════════════════════════
const TABS = [
  { id: "tonight", label: "Matchups", icon: "🗓️" },
  { id: "teams", label: "Teams", icon: "🏀" },
  { id: "players", label: "Players", icon: "👤" },
  { id: "stats", label: "Stats", icon: "📊" },
];

// Branded loading state: a ball bouncing on a hardwood strip.
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center">
      <style>{`@keyframes hrbBounce { 0%, 100% { transform: translateY(0) scale(1, 1); } 45% { transform: translateY(-36px) scale(0.98, 1.02); } 55% { transform: translateY(-36px); } 100% { transform: translateY(0) scale(1.08, 0.92); } }
@keyframes hrbShadow { 0%, 100% { transform: scaleX(1); opacity: .35; } 50% { transform: scaleX(.55); opacity: .15; } }`}</style>
      <div className="text-5xl" style={{ animation: "hrbBounce .9s cubic-bezier(.3,0,.5,1) infinite" }}>🏀</div>
      <div className="mt-2 h-1.5 w-10 rounded-full bg-slate-400" style={{ animation: "hrbShadow .9s cubic-bezier(.3,0,.5,1) infinite" }} />
      <div className="mt-6 text-sm font-bold text-slate-500 dark:text-slate-400 tracking-wide">Loading…</div>
    </div>
  );
}

// One rule for every pill in the app: unselected pills get a visible edge and a
// hairline shadow so they read as buttons; selected pills get a soft lift.
const PILL_CSS = `
button.rounded-full { -webkit-tap-highlight-color: transparent; transition: transform .08s ease, box-shadow .12s ease; }
button.rounded-full:active { transform: scale(.97); }
button.rounded-full.border-slate-200 { border-color: #cbd5e1; box-shadow: 0 1px 2px rgba(15,23,42,.06); }
.dark button.rounded-full.border-slate-800, button.rounded-full.dark\:border-slate-800 { }
@media (prefers-color-scheme: dark) { button.rounded-full.border-slate-200 { border-color: #334155; box-shadow: 0 1px 2px rgba(0,0,0,.4); } }
button.rounded-full.text-white { box-shadow: 0 2px 6px rgba(15,23,42,.18); }
`;
export default function App() {
  const [tab, setTab] = useState("tonight"); // land on tonight's games
  const [sel, setSel] = useState(null);
  const [players, setPlayers] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selTeam, setSelTeam] = useState(null);
  const [error, setError] = useState(null);

  const [, setEspnTick] = useState(0);
  const injury = useInjuryFeed(players || []);
  // Retired / overseas players aren't on any ESPN roster — look their headshots up by name once
  useEffect(() => {
    const need = (players || []).filter((p) => isRetired(p) && !p.photo && !espnOf(p)?.headshot).map((p) => p.name);
    if (!need.length) return;
    fetch("/api/espn-rosters?lookup=" + encodeURIComponent(need.slice(0, 40).join("|"))).then((r) => r.json()).then((d) => {
      if (!d || !d.headshots) return;
      for (const [n, url] of Object.entries(d.headshots)) ESPN_BY_NAME[espnNrm(n)] = { ...(ESPN_BY_NAME[espnNrm(n)] || {}), headshot: url };
      setEspnTick((t) => t + 1);
    }).catch(() => {});
  }, [players]);
  // Lock pinch/focus zoom app-wide (Safari zooms into any input smaller than 16px)
  useEffect(() => {
    let m = document.querySelector('meta[name="viewport"]');
    if (!m) { m = document.createElement("meta"); m.name = "viewport"; document.head.appendChild(m); }
    m.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
  }, []);
  const [statsFocus, setStatsFocus] = useState(null); // { id, cat } — highlight a player on the Stats tab
  const [selGame, setSelGame] = useState(null);       // matchup opened from the Matchups tab
  useEffect(() => {
    // Headshots + positions for anyone Airtable is missing them for.
    const loadLineups = () => fetch("/api/lineups").then((r) => r.json())
      .then((d) => { if (d && d.lineups) { Object.assign(LINEUPS, d.lineups); setEspnTick((t) => t + 1); } })
      .catch(() => {});
    loadLineups();
    setInterval(loadLineups, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadLineups(); });
    fetch("/api/espn-rosters").then((r) => r.json())
      .then((d) => { if (d && d.players) { Object.assign(ESPN_BY_NAME, d.players); setEspnTick((t) => t + 1); } })
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else {
        for (const t of d.teams || []) { const a = t.abbr || toAbbr(t.name); if (a && t.logo) TEAM_LOGOS[a] = t.logo; if (a) TEAM_NAMES[a] = t.name; }
        setPlayers(d.players); setTeams(d.teams || []);
        // Live standings (ESPN) replace the hand-entered Wins / Losses / PPG /
        // Opp PPG. Airtable's numbers stay as the fallback if ESPN is down.
        // Live season stats (ESPN): this season's averages become each player's
        // top Stats row, replacing a hand-entered row for the same season.
        const loadLive = () => fetch("/api/season-stats").then((r) => r.json()).then((ls) => {
          if (!ls || !ls.players || !ls.players.length) return;
          const by = {}; for (const r of ls.players) by[espnNrm(r.name)] = r;
          LIVE_STATS.updatedAt = ls.updatedAt; LIVE_STATS.season = CURRENT_SEASON;
          if (ls.teams) LIVE_STATS.teams = ls.teams;   // true team per-game lines (from box scores)
          setPlayers((prev) => prev.map((p) => {
            const r = by[espnNrm(p.name)];
            if (!r || !(r.gp > 0)) return p;
            const row = { season: CURRENT_SEASON, live: true, espnId: r.id || null, gp: r.gp, min: r.min, pts: r.pts, reb: r.reb, oreb: r.oreb, dreb: r.dreb, ast: r.ast, stl: r.stl, blk: r.blk, tov: r.tov,
              fg: r.fg, p3: r.p3, ft: r.ft, fgm: r.fgm, fga: r.fga, p3m: r.p3m, p3a: r.p3a, ftm: r.ftm, fta: r.fta };
            const rest = (p.stats || []).filter((x) => x.season !== CURRENT_SEASON);
            return { ...p, stats: [row, ...rest] };
          }));
        }).catch(() => {});
        loadLive();
        setInterval(loadLive, 2 * 60 * 1000);                           // every 2 min while open
        document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadLive(); });
        const loadStandings = () => fetch("/api/standings").then((r) => r.json()).then((sd) => {
          if (!sd || !sd.teams || !sd.teams.length) return;
          const by = {}; for (const t of sd.teams) { by[t.abbr] = t; by[modernAbbr(t.abbr)] = t; for (const v of ABBR_VARIANTS[modernAbbr(t.abbr)] || []) by[v] = t; }
          STANDINGS_PHASE.v = sd.phase || "regular";
          setTeams((prev) => prev.map((t) => {
            if (isFaTeam(t)) return t;
            const a = t.abbr || toAbbr(t.name); const e = by[String(a).toUpperCase()] || by[modernAbbr(a)] || sd.teams.find((x) => String(x.name).toLowerCase() === String(t.name).toLowerCase());
            // once the live table is in, every team is live — a team ESPN didn't match shows 0-0 rather than last year's Airtable numbers
            return e ? { ...t, wins: e.wins ?? 0, losses: e.losses ?? 0, ppg: e.ppg ?? null, oppPpg: e.oppPpg ?? null, streak: e.streak || null, gb: e.gb ?? null, l10: e.l10 || null, home: e.home || null, road: e.road || null, live: true }
                     : { ...t, wins: 0, losses: 0, ppg: null, oppPpg: null, live: true };
          }));
        }).catch(() => {});
        loadStandings();
        setInterval(loadStandings, 2 * 60 * 1000);
        document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadStandings(); });
      } })
      .catch((e) => setError(String(e)));
  }, []);

  if (sel) {
    return (<>
      <style>{PILL_CSS}</style>
      <PlayerDetail
        p={sel}
        teams={teams}
        players={players}
        onBack={() => setSel(null)}
        backLabel={selTeam ? selTeam.name : tab === "teams" ? "Teams" : tab === "tonight" ? "Matchups" : "Players"}
        mode="full"
        onJumpToStats={(pl, cat) => { setStatsFocus({ id: pl.id, cat, n: Date.now(), from: { tab, team: selTeam } }); setSel(null); setSelTeam(null); setTab("stats"); }}
      />
    </>);
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <style>{PILL_CSS}</style>
      {error && (
        <div className="m-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl px-4 py-3">
          Couldn't load data: {error}
        </div>
      )}
      {!players && !error && <LoadingScreen />}

      {players && tab === "tonight" && !selTeam && !selGame && (
        <TonightTab players={players} teams={teams} onSelect={setSel} onSelectTeam={setSelTeam} onOpenGame={setSelGame} />
      )}
      {players && tab === "tonight" && selGame && !selTeam && (
        <GameView game={selGame} teams={teams} players={players} onBack={() => setSelGame(null)} onSelectTeam={setSelTeam} onSelectPlayer={setSel} />
      )}
      {players && tab === "teams" && !selTeam && (
        <TeamsTab teams={teams} players={players} onSelect={(t) => { SWIPE_DEPTH.n = 0; setSelTeam(t); }} />
      )}
      {players && (tab === "teams" || tab === "tonight") && selTeam && selGame && (
        <GameView game={selGame} teams={teams} players={players} onBack={() => setSelGame(null)} onSelectTeam={(t) => { setSelGame(null); setSelTeam(t); }} onSelectPlayer={setSel} />
      )}
      {players && (tab === "teams" || tab === "tonight") && selTeam && !selGame && (
        <TeamDetail
          team={selTeam} teams={teams}
          players={players}
          onOpenGame={setSelGame}
          onBack={() => setSelTeam(null)}
          onSelectPlayer={setSel}
          onSelectTeam={setSelTeam}
          onJumpToTeamStats={(t, cat) => { setStatsFocus({ teamId: t.id, cat, n: Date.now(), from: { tab, team: t } }); setSel(null); setSelTeam(null); setTab("stats"); }}
          backLabel={tab === "tonight" ? "Matchups" : "Teams"}
        />
      )}
      {players && tab === "players" && <PlayersHub players={players} teams={teams} onSelect={setSel} injury={injury} />}
      {players && tab === "stats" && <StatsTab players={players} teams={teams} onSelect={setSel} focus={statsFocus} onBackToPlayer={() => { const f = statsFocus; if (!f) return; setStatsFocus(null); if (f.teamId) { const t = (teams || []).find((x) => x.id === f.teamId); setTab(f.from?.tab || "teams"); setSelTeam(t || null); return; } const pl = (players || []).find((x) => x.id === f.id); if (pl) { if (f.from) { setTab(f.from.tab); setSelTeam(f.from.team || null); } setSel(pl); } }} />}

      <div className="fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex pb-[env(safe-area-inset-bottom)] z-20">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { if (t.id !== "stats") setStatsFocus(null); for (const k of Object.keys(TEAM_VIEW_MEMORY)) delete TEAM_VIEW_MEMORY[k]; setTab(t.id); setSel(null); setSelTeam(null); setSelGame(null); }}
            className={"flex-1 py-2.5 text-center " + (tab === t.id ? "text-blue-600" : "text-slate-400")}
          >
            <div className="text-lg leading-none relative inline-block">{t.icon}{t.id === "players" && <Badge n={injury.unseen} />}</div>
            <div className="text-[10px] font-bold mt-1">{t.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
