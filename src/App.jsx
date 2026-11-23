import React, { useState, useMemo, useEffect, useRef } from "react";

// ═══════════════ THEME (edit these to restyle the app) ═══════════
// Player detail header color:
//   "team"   -> uses the player's CURRENT team color
//   any hex  -> one fixed color for everyone, e.g. "#1e293b"
const HEADER_COLOR = "team";

// Season used for team payroll totals (must match your Season select format)
// The league year: a season is named for the year it kicks off, and the new
// league year opens in March — so Jan/Feb still belong to last season. This
// used to be a hard-coded "2025", which quietly under-counted every player's
// experience and every coach's tenure once 2026 started.
const CURRENT_SEASON = (() => { const d = new Date(); return String(d.getMonth() >= 2 ? d.getFullYear() : d.getFullYear() - 1); })();

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
const ACCENT_BORDER = "border-emerald-200";

const TEAM_COLORS = {
  ARI: "#97233F", ATL: "#A71930", BAL: "#241773", BUF: "#00338D",
  CAR: "#0085CA", CHI: "#0B162A", CIN: "#FB4F14", CLE: "#311D00",
  DAL: "#003594", DEN: "#FB4F14", DET: "#0076B6", GB: "#134827",
  HOU: "#07203A", IND: "#002C5F", JAX: "#006778", JAC: "#006778",
  KC: "#E31837", LV: "#000000", LAC: "#0080C6", LAR: "#003594",
  MIA: "#008E97", MIN: "#4F2683", NE: "#001833", NO: "#D3BC8D",
  NYG: "#0B2265", NYJ: "#125740", PHI: "#004C54", PIT: "#101010",
  SF: "#AA0000", SEA: "#002244", TB: "#C50909", TEN: "#0C2340",
  WAS: "#5A1414", WSH: "#5A1414",
};

// Full team names -> abbreviations, so a player's current team
// (which may be stored as "New York Knicks") maps to its color.
const NAME_TO_ABBR = {
  "arizona cardinals": "ARI", "atlanta falcons": "ATL", "baltimore ravens": "BAL",
  "buffalo bills": "BUF", "carolina panthers": "CAR", "chicago bears": "CHI",
  "cincinnati bengals": "CIN", "cleveland browns": "CLE", "dallas cowboys": "DAL",
  "denver broncos": "DEN", "detroit lions": "DET", "green bay packers": "GB",
  "houston texans": "HOU", "indianapolis colts": "IND", "jacksonville jaguars": "JAX",
  "kansas city chiefs": "KC", "las vegas raiders": "LV", "los angeles chargers": "LAC",
  "los angeles rams": "LAR", "miami dolphins": "MIA", "minnesota vikings": "MIN",
  "new england patriots": "NE", "new orleans saints": "NO", "new york giants": "NYG",
  "new york jets": "NYJ", "philadelphia eagles": "PHI", "pittsburgh steelers": "PIT",
  "san francisco 49ers": "SF", "seattle seahawks": "SEA", "tampa bay buccaneers": "TB",
  "tennessee titans": "TEN", "washington commanders": "WAS",
};

function toAbbr(team) {
  if (!team) return "";
  const t = String(team).trim();
  if (TEAM_COLORS[t.toUpperCase()]) return t.toUpperCase();
  return NAME_TO_ABBR[t.toLowerCase()] || "";
}
const teamColorSafe = (a) => { try { return teamColor(a) || "#334155"; } catch { return "#334155"; } };
// Logo chips sit on the team's own color instead of plain white, the way the
// matchup header does. Dark colors get a subtle top gloss so the mark reads.
// Luminance of a hex color, 0 (black) to 1 (white)
// Is the app currently rendering dark? Inline styles can't use Tailwind's
// dark: variant, so team colors have to be computed.
function useDark() {
  const [dark, setDark] = useState(() => typeof window !== "undefined" && window.matchMedia
    && window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = (e) => setDark(e.matches);
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on); };
  }, []);
  return dark;
}
const lumOf = (hex) => {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// Nudge a hex lighter (+) or darker (−) by a percentage — used for the subtle
// gradient on team-colored rows.
const shade = (hex, pct) => {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return hex;
  const v = [0, 2, 4].map((i) => {
    const n = parseInt(h.slice(i, i + 2), 16) + Math.round(255 * (pct / 100));
    return Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  });
  return "#" + v.join("");
};
// The readable version of a team color for the current theme: dark navies get
// lifted on dark backgrounds, pale golds get deepened on light ones.
const teamInk = (abbr, dark) => {
  const c = teamColorSafe(abbr), l = lumOf(c);
  if (dark) return l < 0.34 ? shade(c, 34 - l * 100) : c;
  return l > 0.68 ? shade(c, -(l * 100 - 55)) : c;
};
// ESPN publishes a light "dark-background" mark for every team. Giants, Jets,
// Rams and friends vanish on their own navy without it.
const darkLogo = (abbr) => (abbr ? `https://a.espncdn.com/i/teamlogos/nfl/500-dark/${String(abbr).toLowerCase()}.png` : null);
const logoFor = (abbr, fallback, onDark) => (onDark && abbr ? darkLogo(abbr) : (fallback || TEAM_LOGOS[abbr] || null));
// White disc keeps every mark legible (they're drawn for white); identity comes
// from a team-color ring with an alternate-color hairline inside it.
const LOGO_BG = { BUF: "#00338D", DET: "#B0B7BC" };
// Roster/team-page accent when the primary colour is the wrong one for chips and
// tabs (Steelers: black backdrop, gold accents)
const TEAM_ACCENT = { PIT: "#FFB612" };
// A plain disc, no ring. (Rings were tried and retired — they fought the mark.)
const logoChip = (abbr) => ({ background: LOGO_BG[abbr] || "#ffffff" });
// On a dark chip the standard mark disappears, so use ESPN's dark-background art.
const chipLogo = (abbr, fallback) => (LOGO_BG[abbr] && lumOf(LOGO_BG[abbr]) < 0.5 ? darkLogo(abbr) : (fallback || TEAM_LOGOS[abbr] || null));
const teamColor = (abbr) => TEAM_COLORS[String(abbr).toUpperCase()] || "#334155";
// Current-team color first; falls back to the contract team if no current team.
// Sleeper carries birth_date for every rostered player ("1994-10-31"); the
// Airtable base doesn't need a field for it.
function birthDateOf(p) {
  const inj = injFor(p.name, toAbbr(teamOfPlayer(p) || p.teamName || ""));
  const raw = (inj && inj.birth_date) || p.birthDate || null;
  if (!raw) return null;
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(raw);
  if (isNaN(d)) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function playerHeaderColor(p, dark) {
  if (HEADER_COLOR !== "team") return HEADER_COLOR;
  const abbr = toAbbr(p.teamName) || activeOf(p)?.team || "";
  return dark ? teamInk(abbr, true) : teamColor(abbr);
}

const TYPE_LABEL = { G: "Guaranteed", PO: "Player Option", TO: "Team Option", NG: "Non-Guaranteed", PG: "Partially Gtd", UFA: "Free Agent", RFA: "Restricted FA" };
const BADGE = { PO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300", TO: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300", NG: "bg-slate-100 text-slate-500 dark:text-slate-400", PG: "bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", UFA: "bg-slate-100 text-slate-500 dark:text-slate-400", RFA: "bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300" };

const fmtM = (v) => "$" + v.toFixed(1) + "M";
const cleanNo = (no) => String(no || "").replace(/^#+/, "");
const salaried = (c) => c.years.filter((y) => y.salary != null);
const total = (c) => salaried(c).reduce((a, y) => a + y.salary, 0);
const terms = (c) => salaried(c).length + " yrs / " + fmtM(total(c));
const displayLine = (c) => terms(c) + (c.team ? " (" + c.team + ")" : "") + " · " + c.kind;
const activeOf = (p) => p.contracts.find((c) => c.status === "Active") || p.contracts[0] || null;

// Years in the league, computed from Draft Year vs the current season.
function latestStats(p) {
  return p.stats && p.stats.length > 0 ? p.stats[0] : null;
}
const fmt1 = (v) => (v == null ? null : Number(v).toFixed(1));

// Inclusive season count: drafted 2014 -> 2025-26 is season #12.
function experienceOf(p) {
  if (!p.draftYear) return "";
  const nowYear = parseInt(String(CURRENT_SEASON).slice(0, 4), 10);
  const seasons = nowYear - p.draftYear + 1;
  if (isNaN(seasons) || seasons < 1) return "";
  return seasons === 1 ? "Rookie" : ordinal(seasons) + " season";
}

// Search matches player name, current team (full name or abbreviation),
// or the active contract's team. "knicks", "NY", "jalen" all work.
function matchesQuery(p, q, namesOnly) {
  if (!q) return true;
  const s = q.toLowerCase().trim();
  if (p.name.toLowerCase().includes(s)) return true;
  if (namesOnly) return false;
  const team = String(p.teamName || "").toLowerCase();
  if (team.includes(s)) return true;
  const abbr = toAbbr(p.teamName) || (activeOf(p) && activeOf(p).team) || "";
  if (String(abbr).toLowerCase().includes(s)) return true;
  const actTeam = activeOf(p) ? String(activeOf(p).team).toLowerCase() : "";
  if (actTeam.includes(s)) return true;
  for (const c of p.contracts) {
    if (String(c.kind).toLowerCase().includes(s)) return true;
  }
  return false;
}


// ═══════════════ SHARED PIECES ═══════════════════════════════════
function Avatar({ p, size }) {
  const px = size === "xl" ? "w-[6.5rem] h-[6.5rem] text-3xl" : size === "md" ? "w-14 h-14 text-base" : size === "lg" ? "w-20 h-20 text-2xl" : size === "sm" ? "w-9 h-9 text-xs" : "w-11 h-11 text-sm";
  const url = photoOf(p);
  const no = cleanNo(p.no);
  const label = no ? "#" + no : p.name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  // Initials render underneath; the img sits on top and removes itself if the
  // CDN 404s, so a bad fallback URL degrades to initials instead of a broken icon.
  return (
    <div className={px + " relative rounded-full bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 overflow-hidden"}>
      {label}
      {url && <Headshot p={p} alt={p.name} className="absolute inset-0 w-full h-full object-cover object-top bg-white" />}
    </div>
  );
}


function rankOf(teams, team, key, dir) {
  if (!teams || team[key] == null) return null;
  const vals = teams.filter((t) => t[key] != null);
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

// Team-page tiles take a border in the team's alternate colour; set once on
// the grid, read by every Tile inside it.
const TileBorderCtx = React.createContext(null);
function Tile({ value, label, label2, sub, accent, valueClass, compact, tint, trend, onClick }) {
  const Tag = onClick ? "button" : "div";
  const edgeRaw = React.useContext(TileBorderCtx);
  const dark = useDark();
  // a white border vanishes on a white tile (light mode); black on a dark one
  const edge = !edgeRaw ? null : (!dark && lumOf(edgeRaw) > 0.92) ? "#94a3b8" : (dark && lumOf(edgeRaw) < 0.08) ? "#64748b" : edgeRaw;
  const style = edge ? { borderColor: edge, borderWidth: 2, ...(tint ? { boxShadow: `inset 0 2px 0 0 ${tint}` } : {}) }
    : tint ? { borderColor: tint + "66", boxShadow: `inset 0 2px 0 0 ${tint}` } : undefined;
  return (
    <Tag onClick={onClick} className={"bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-sm flex flex-col items-center justify-center " + (compact ? "px-1 py-2.5" : "px-2 py-4") + (onClick ? " active:scale-[0.97] transition-transform w-full" : "")}
      style={style}>
      <div className={"font-semibold tracking-widest uppercase mb-1 text-slate-700 dark:text-white " + (compact ? "text-[8px] " : "text-[10px] ")}>{label}{label2 && <span className="block">{label2}</span>}</div>
      <div className={(compact ? "text-lg " : "text-2xl ") + "font-extrabold tracking-tight " + (valueClass ? valueClass : accent ? ACCENT_TEXT : "text-slate-900 dark:text-slate-100")}>{value}<Trend t={trend} /></div>
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
  const raw = String(y.season || "");
  const m = raw.match(/(\d{4})\s*-\s*(\d{4})/);
  if (m) return "'" + m[1].slice(2) + "-'" + m[2].slice(2);
  const single = raw.match(/(\d{4})/);
  if (single) return single[1];
  return y.s;
}

function SalaryBars({ years }) {
  const max = Math.max(...years.map((y) => y.salary ?? 0), 1);
  return (
    <div className="flex items-end gap-2 h-32 mt-2">
      {years.map((y, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
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
          <div className="text-[11px] font-bold tracking-widest text-slate-400 uppercase truncate">
            {c.kind}{c.team ? " · " + c.team : ""}{c.signed ? " · " + c.signed : ""}
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
          <span key={i} className={"text-[11px] font-semibold px-2 py-1 rounded-full " + (BADGE[y.type] || "bg-slate-100 text-slate-500 dark:text-slate-400")}>
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
// ── Swipe gestures: left→right = back/previous, right→left = next ──
function useSwipe({ onLeft, onRight }) {
  const start = useRef(null);
  return {
    onTouchStart: (e) => { const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY, t: Date.now() }; },
    onTouchEnd: (e) => {
      if (!start.current) return;
      const t = e.changedTouches[0], dx = t.clientX - start.current.x, dy = t.clientY - start.current.y, dt = Date.now() - start.current.t;
      start.current = null;
      if (dt > 700 || Math.abs(dy) > 70 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx > 0) onRight && onRight(); else onLeft && onLeft();
    },
  };
}
// Spinning-football loader (the basketball app's bouncing ball, football edition)
function GlobalPulseStyles() {
  return <style>{`@keyframes hrbSoftPulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.55 } }`}</style>;
}
function Loader({ label = "Loading" }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <style>{`@keyframes hrbSpin { 0% { transform: rotate(-20deg) translateY(0) } 50% { transform: rotate(20deg) translateY(-10px) } 100% { transform: rotate(-20deg) translateY(0) } }`}</style>
      <div className="text-4xl" style={{ animation: "hrbSpin 0.9s ease-in-out infinite", display: "inline-block" }}>🏈</div>
      <div className="text-xs font-bold tracking-widest uppercase text-slate-400">{label}</div>
    </div>
  );
}
// One-time attention pulse (used on injury badges when a formation opens)
const PULSE_CSS = `@keyframes hrbPulse { 0%, 100% { transform: translate(-50%,0) scale(1); opacity: 1 } 50% { transform: translate(-50%,0) scale(1.1); opacity: 0.72 } }`;

// Position group for stat tiles / peer ranking
function posGroup(pos) {
  const p = String(pos || "").toUpperCase();
  if (p === "WR") return "WR";
  if (p === "TE") return "TE";
  if (["RB", "HB", "FB"].includes(p)) return "RB";
  if (p === "QB") return "QB";
  if (/^(DE|DT|NT|EDGE|DL|LB|ILB|OLB|MLB|CB|S|FS|SS|DB|NB|LDE|RDE|LDT|RDT|LOLB|ROLB|DEF)$/.test(p)) return "DEF";
  return null;
}
// [label, statKey, ascending?]  (ascending = fewer is better, e.g. INT)
// Tapping a stat anywhere on a player page opens the Leaders board for that
// stat, filtered to the player's position group, scrolled to his row.
const STAT_JUMP = {
  passYds: ["passing", "passYds"], passTd: ["passing", "passTd"], cmp: ["passing", "cmp"], att: ["passing", "att"], int: ["passing", "int"],
  rushYds: ["rushing", "rushYds"], rushTd: ["rushing", "rushTd"], car: ["rushing", "car"], ypcar: ["rushing", "ypcar"], carShare: ["rushing", "car"],
  recYds: ["receiving", "recYds"], recTd: ["receiving", "recTd"], rec: ["receiving", "rec"], tgt: ["receiving", "tgt"], tgtShare: ["receiving", "tgt"],
  touches: ["rushing", "car"],
  tkl: ["defense", "tkl"], solo: ["defense", "tkl"], sacks: ["defense", "sacks"], defInt: ["defense", "defInt"], tfl: ["defense", "tfl"], pd: ["defense", "pd"],
};
const STAT_TILES = {
  WR: [["Rec", "rec"], ["Rec Yds", "recYds"], ["Rec TD", "recTd"]],
  TE: [["Rec", "rec"], ["Rec Yds", "recYds"], ["Rec TD", "recTd"]],
  RB: [["Carries", "car"], ["Rush Yds", "rushYds"], ["Rush TD", "rushTd"]],
  QB: [["Pass Yds", "passYds"], ["Pass TD", "passTd"], ["INT", "int", true]],
  DEF: [["Tackles", "tkl"], ["Sacks", "sacks"], ["INT", "defInt"]],
};
// ── Season stats box + game-by-game graph (from /api/season-stats) ──
const pctOf = (v) => (v != null ? Math.round(v * 100) + "%" : null);
// Airtable "Return Date" is free text. Parse it when it's a date (adding the
// current year if it has none), otherwise show it as typed ("week 8", "tbd").
// Lowercase injury copy, but medical/roster acronyms stay upper: "torn ACL",
// "MCL sprain", "PUP list".
const INJ_ACRONYMS = ["ACL", "MCL", "PCL", "LCL", "UCL", "AC", "SC", "IR", "PUP", "NFI", "COVID", "TBD", "IT", "MRI", "CT"];
// A note that's only a body part ("toe", "left knee") reads as "toe injury".
const INJ_BODY = new Set(["toe", "toes", "foot", "feet", "ankle", "knee", "leg", "hamstring", "groin", "hip", "quad", "quadriceps", "thigh", "calf",
  "achilles", "shin", "back", "neck", "shoulder", "elbow", "wrist", "hand", "finger", "fingers", "thumb", "arm", "forearm", "chest", "rib", "ribs",
  "abdomen", "abdominal", "oblique", "head", "face", "eye", "jaw", "pectoral", "pec", "biceps", "triceps", "heel", "pelvis", "spine", "collarbone",
  "glute", "core", "lower back", "upper back"]);
function injCase(str) {
  let t = String(str || "").replace(/\s+/g, " ").trim().toLowerCase();
  for (const a of INJ_ACRONYMS) t = t.replace(new RegExp(`\\b${a.toLowerCase()}\\b`, "g"), a);
  const bare = t.replace(/^(left|right|l|r)\s+/, "");
  if (bare && INJ_BODY.has(bare)) t += " injury";
  return t;
}
function fmtReturn(raw) {
  if (raw == null || raw === "") return null;
  let t = String(raw).trim();
  if (!t) return null;
  const hasYear = /\b(19|20)\d{2}\b/.test(t);
  let d = new Date(hasYear ? t : `${t} ${new Date().getFullYear()}`);
  if (isNaN(d) && /^\d{1,2}\/\d{1,2}$/.test(t)) d = new Date(`${t}/${new Date().getFullYear()}`);
  if (isNaN(d)) return t.replace(/\b\w/g, (c) => c.toUpperCase());     // "Week 8", "TBD"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); // "Oct 20"
}
// Direction of travel for a team stat: compare the most recent game with the
// average of every game before it. null until there are two games to compare.
// lowerBetter flips the colour (giving up fewer points is an improvement).
function trendOf(log, key, lowerBetter) {
  if (!Array.isArray(log) || log.length < 2) return null;
  const vals = log.map((g) => Number(g[key]) || 0);
  const last = vals[vals.length - 1];
  const prior = vals.slice(0, -1);
  const avg = prior.reduce((a, b) => a + b, 0) / prior.length;
  if (!avg && !last) return null;
  const diff = last - avg;
  if (Math.abs(diff) < Math.max(0.5, avg * 0.03)) return null;   // flat enough to leave alone
  const up = diff > 0;
  return { up, good: lowerBetter ? !up : up, delta: Math.abs(diff) };
}
function Trend({ t }) {
  if (!t) return null;
  return <span className={"ml-1 text-[10px] font-black align-middle " + (t.good ? "text-emerald-500" : "text-rose-500")}>{t.up ? "▲" : "▼"}</span>;
}
// ── Roster-style stat tile, shared by the player card ────────────
// Same architecture as the per-game chips on the roster row: a solid
// team-color band carrying the label, a faintly team-tinted body with a
// team-tinted hairline border. `ink` is the theme-corrected team color.
function StatTile({ ink, dark, label, value, sub, subClass, foot, onClick, big }) {
  const tint = (a) => ink + a;
  return (
    <button onClick={onClick} className={"flex flex-col items-stretch rounded-xl border overflow-hidden text-center " + (onClick ? "active:scale-[0.97] transition-transform" : "")}
      style={{ backgroundColor: tint(dark ? "24" : "14"), borderColor: tint(dark ? "59" : "33") }}>
      <span className="block text-[8px] font-extrabold tracking-widest uppercase leading-none whitespace-nowrap overflow-hidden text-ellipsis text-white px-1 py-[5px]" style={{ backgroundColor: ink }}>{label}</span>
      <span className="flex-1 flex flex-col items-center justify-center px-1 pt-2 pb-1.5">
        <span className={(big ? "text-[26px]" : "text-[17px]") + " leading-none font-black tabular-nums text-slate-900 dark:text-white"}>{value ?? "—"}</span>
        <span className={"text-[10px] font-extrabold tabular-nums mt-1 h-3.5 " + (subClass || "text-slate-400")}>{sub || ""}</span>
        {foot && <span className="text-[8px] font-semibold tracking-wide uppercase text-slate-400 leading-none">{foot}</span>}
      </span>
    </button>
  );
}
function SeasonStatsBox({ p, seasonStats, onStatJump }) {
  const [metric, setMetric] = useState(null);
  const dark = useDark();
  if (!seasonStats || !seasonStats.players) return null;
  // match by name (+team when ambiguous)
  const nm = hrbNrmSafe(p.name);
  const abbr = toAbbr(teamOfPlayer(p) || p.teamName || "");
  const cands = Object.values(seasonStats.players).filter((q) => hrbNrmSafe(q.name) === nm);
  const P = cands.length > 1 ? cands.find((q) => injTeamEq(q.team, abbr)) || cands[0] : cands[0];
  if (!P || !P.totals || !P.totals.gp) return null;
  const T = P.totals, G = P.perGame;
  const ink = playerHeaderColor(p, dark) || "#2563eb";   // team color, theme-corrected
  const pos = String(p.pos || P.pos || "").toUpperCase();
  const isQB = pos === "QB", isRB = ["RB", "HB", "FB"].includes(pos), isRec = ["WR", "TE"].includes(pos);
  const isDef = !isQB && !isRB && !isRec && (T.tkl > 0 || T.sacks > 0 || T.defInt > 0);
  // Columns per position: [label, total, per-game, graphKey]
  const cols = isQB ? [["Cmp", T.cmp, G.cmp, "cmp"], ["Att", T.att, G.att, "att"], ["Pass Yds", T.passYds, G.passYds, "passYds"], ["Pass TD", T.passTd, G.passTd, "passTd"], ["INT", T.int, G.int, "int"], ["Rush Yds", T.rushYds, G.rushYds, "rushYds"], ["Rush TD", T.rushTd, G.rushTd, "rushTd"]]
    : isRB ? [["Carries", T.car, G.car, "car"], ["Rush Yds", T.rushYds, G.rushYds, "rushYds"], ["Y/Car", T.ypcar, null, null, "ypcar"], ["Rush TD", T.rushTd, G.rushTd, "rushTd"], ["Targets", T.tgt, G.tgt, "tgt"], ["Rec", T.rec, G.rec, "rec"], ["Rec Yds", T.recYds, G.recYds, "recYds"], ["Rec TD", T.recTd, G.recTd, "recTd"], ["Car Share", pctOf(T.carShare), null, null, "carShare"], ["Tgt Share", pctOf(T.tgtShare), null, null, "tgtShare"], ["Touches", T.touches ?? null, null, null, "touches"]]
    : isRec ? [["Rec", T.rec, G.rec, "rec"], ["Targets", T.tgt, G.tgt, "tgt"], ["Rec Yds", T.recYds, G.recYds, "recYds"], ["Rec TD", T.recTd, G.recTd, "recTd"], ["Y/Rec", T.ypc, null, null], ["Tgt Share", pctOf(T.tgtShare), null, null, "tgtShare"], ["Carries", T.car, G.car, "car"], ["Rush TD", T.rushTd, G.rushTd, "rushTd"]]
    : isDef ? [["Tackles", T.tkl, G.tkl, "tkl"], ["Solo", T.solo, G.solo, "solo"], ["Sacks", T.sacks, G.sacks, "sacks"], ["TFL", T.tfl, G.tfl, "tfl"], ["INT", T.defInt, G.defInt, "defInt"], ["PD", T.pd, G.pd, "pd"], ["TD", T.defTd, G.defTd, "defTd"]]
    : [];
  if (!cols.length) return null;
  const graphable = cols.filter((c) => c[3]);
  const key = metric || (isRec ? "tgt" : isRB ? "car" : isQB ? "passYds" : "tkl");
  const series = P.games.map((g) => ({ week: g.week, opp: g.opp, v: g[key] || 0 }));
  const raw = Math.max(1, ...series.map((d) => d.v));
  const max = raw * 1.18;                 // headroom so the top value label clears the frame
  const W = 320, H = 150, padL = 24, padB = 20, padT = 18;
  const x = (i) => padL + (series.length > 1 ? (i * (W - padL - 6)) / (series.length - 1) : (W - padL) / 2);
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const path = series.map((d, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(d.v).toFixed(1)).join(" ");
  const label = graphable.find((c) => c[3] === key)?.[0] || key;
  const gid = String(p.id || p.name || "g").replace(/\W/g, "");
  return (
    <>
      <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mt-6 mb-2 px-1">{seasonStats.season} Season · {T.gp} GP</div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="grid grid-cols-4 gap-1.5 p-2">
          {cols.map((c, i) => (
            <StatTile key={i} ink={ink} dark={dark} label={c[0]} value={c[1] ?? "—"} sub={c[2] != null ? c[2] + "/g" : ""}
              onClick={STAT_JUMP[c[4] || c[3]] && onStatJump ? () => onStatJump({ key: c[4] || c[3], name: p.name, team: abbr, pos: posGroup(pos) }) : undefined} />
          ))}
        </div>
        {/* game-by-game line: is the role trending up or down? */}
        <div className="border-t border-slate-100 dark:border-slate-800 px-3 pt-2.5 pb-2">
          <div className="flex items-center gap-1.5 overflow-x-auto mb-1" style={{ scrollbarWidth: "none" }}>
            {graphable.map(([lbl,,, k]) => (
              <button key={k} onClick={() => { if (key === k && onStatJump && STAT_JUMP[k]) onStatJump({ key: k, name: p.name, team: abbr, pos: posGroup(pos) }); else setMetric(k); }}
                className={"shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold " + (key === k ? "text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300")}
                style={key === k ? { backgroundColor: ink } : undefined}>
                {lbl}
              </button>
            ))}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
            <defs>
              <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ink} stopOpacity="0.32" />
                <stop offset="100%" stopColor={ink} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={padL} x2={W - 6} y1={y(raw * f)} y2={y(raw * f)} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" strokeDasharray={f === 0 ? "" : "3 3"} />
                <text x={padL - 5} y={y(raw * f) + 3} fontSize="8" textAnchor="end" className="fill-slate-400">{Math.round(raw * f)}</text>
              </g>
            ))}
            {/* filled area under the line, in the team's color */}
            <path d={`${path} L ${x(series.length - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`} fill={`url(#area-${gid})`} />
            <path d={path} fill="none" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {series.map((d, i) => (
              <g key={i}>
                <circle cx={x(i)} cy={y(d.v)} r="4" fill={ink} stroke="white" strokeWidth="1.8" />
                <text x={x(i)} y={y(d.v) - 9} fontSize="8.5" textAnchor="middle" fontWeight="800" className="fill-slate-700 dark:fill-slate-200">{d.v}</text>
                <text x={x(i)} y={H - 5} fontSize="7.5" textAnchor="middle" className="fill-slate-400">W{d.week}</text>
              </g>
            ))}
          </svg>
          <div className="text-[9px] text-slate-400 text-center">{label} by game · tap the selected pill for league ranks</div>
        </div>
      </div>
    </>
  );
}

function PlayerDetail({ p, onBack, backLabel, mode = "full", seasonStats, onStatJump }) {
  const dark = useDark();
  // Deeper injury record for this one player (ESPN's athlete feed), which
  // carries a return date far more often than the league-wide report does.
  const [deepInj, setDeepInj] = useState(null);
  useEffect(() => {
    setDeepInj(null);
    const a = toAbbr(teamOfPlayer(p) || p.teamName || "");
    if (!injHasFlag(p, a)) return;
    const inj = injFor(p.name, a);
    const id = inj && inj.espn_id;
    if (!id) return;
    let alive = true;
    fetch(`/api/injuries?espn=${id}`).then((r) => r.json())
      .then((d) => { if (alive && d && d.injury) setDeepInj(d.injury); }).catch(() => {});
    return () => { alive = false; };
  }, [p.id, p.name]);
  const swipe = useSwipe({ onRight: onBack });
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const act = activeOf(p);
  const past = p.contracts.filter((c) => c !== act);
  const no = cleanNo(p.no);
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24" {...swipe}>
      <div className="relative isolate px-5 pb-5 text-white overflow-hidden" style={{ backgroundColor: playerHeaderColor(p, dark), paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        {/* faint team logo behind the header, like the logo on the 50 */}
        {(() => { const ab = toAbbr(teamOfPlayer(p) || p.teamName || ""); const lg = TEAM_LOGOS[ab]; return lg ? (
          <img src={lg} alt="" aria-hidden="true" className="absolute -z-10 pointer-events-none select-none opacity-[0.10] w-56 h-56 object-contain"
            style={{ right: "-2.5rem", top: "50%", transform: "translateY(-38%)" }} />
        ) : null; })()}
        <button onClick={onBack} className="relative text-sm font-semibold opacity-80 mb-4">‹ {backLabel}</button>
        <div className="relative flex items-center gap-4">
          <div className="rounded-full bg-white shadow-lg shrink-0 overflow-hidden"><Avatar p={p} size="xl" /></div>
          <div className="min-w-0">
            <div className="text-[26px] font-extrabold leading-tight truncate drop-shadow-sm">
              {p.name}
            </div>
            <div className="mt-1 text-[12px] font-semibold text-white/90 truncate">
              {(() => { const a = toAbbr(teamOfPlayer(p) || p.teamName || ""); return [TEAM_NAMES[a] || teamOfPlayer(p) || p.teamName, cleanNo(p.no) ? "#" + cleanNo(p.no) : null, POS_FULL[String(p.pos || "").toUpperCase()] || p.pos].filter(Boolean).join(" · "); })()}
            </div>
            <div className="flex items-center gap-2 mt-1.5 min-w-0 flex-wrap">
              {injHasFlag(p, toAbbr(teamOfPlayer(p) || p.teamName || ""))
                ? <InjBadge p={p} team={toAbbr(teamOfPlayer(p) || p.teamName || "")} lg noNote />
                : <span className="inline-block rounded-full bg-emerald-600 text-white text-[10px] font-extrabold tracking-wider px-2.5 py-1">ACTIVE</span>}
            </div>
            <InjuryLine p={p} deep={deepInj} />
          </div>
        </div>
      </div>

      <div className="px-4 pt-3">
        {(() => {
          // Three season tiles by position, each ranked against every player at
          // that position league-wide (Nacua's rec yards vs all WRs).
          const pos = String(p.pos || "").toUpperCase();
          const grp = posGroup(pos);
          if (!grp || !seasonStats || !seasonStats.players) return null;
          const S = playerSeasonRow(p, seasonStats); const T = S ? S.totals : null;
          const yr = seasonStats.season;
          const spec = STAT_TILES[grp];
          const peers = Object.values(seasonStats.players).filter((q) => posGroup(q.pos) === grp && q.totals && q.totals.gp);
          const rankOf = (k, asc) => {
            if (!T) return null;
            const mine = T[k] || 0;
            const vals = peers.map((q) => q.totals[k] || 0).sort((a, b) => (asc ? a - b : b - a));
            // standard competition ranking: five backs on 4 TDs are all 1st (tie)
            return { r: vals.indexOf(mine) + 1, tie: vals.filter((v) => v === mine).length > 1 };
          };
          const tier = (r, n) => (r == null ? "text-slate-400" : r <= Math.max(5, n * 0.15) ? "text-emerald-500" : r <= n * 0.5 ? "text-amber-500" : "text-slate-400");
          return (
            <div className="grid grid-cols-3 gap-2">
              {spec.map(([lbl, k, asc]) => {
                const rk = rankOf(k, asc);
                const r = rk ? rk.r : null;
                const jump = STAT_JUMP[k];
                return (
                  <StatTile key={k} big ink={playerHeaderColor(p, dark) || "#2563eb"} dark={dark} label={lbl}
                    value={T ? (T[k] ?? "—") : "—"}
                    sub={r ? ordinal(r) + (rk.tie ? " (tie)" : "") : "—"} subClass={tier(r, peers.length)}
                    foot={grp === "WR" || grp === "TE" ? grp + " Rank" : undefined}
                    onClick={jump && onStatJump ? () => onStatJump({ key: k, name: p.name, team: toAbbr(teamOfPlayer(p) || p.teamName || ""), pos: grp }) : undefined} />
                );
              })}
            </div>
          );
        })()}

        {mode === "full" && (p.height || p.weight || p.age || p.draft || p.birthplace || p.draftYear) && (
          <>
            <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mt-6 mb-2 px-1">Bio</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
              <BioRow k="Height / Weight" v={[p.height, p.weight].filter(Boolean).join(", ")} />
              <BioRow k="Date of Birth" v={birthDateOf(p)} />
              <BioRow k="Age" v={p.age} />
              <BioRow k="Draft" v={[p.draftYear, p.draft].filter(Boolean).join(": ")} />
              <BioRow k="Experience" v={experienceOf(p)} />
              <BioRow k="College" v={p.college} />
              <BioRow k="Birthplace" v={p.birthplace} />
            </div>
          </>
        )}
        {mode === "full" && <SeasonStatsBox p={p} seasonStats={seasonStats} onStatJump={onStatJump} />}

        {mode === "full" && p.stats && p.stats.length > 0 && (
          <>
            <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mt-6 mb-2 px-1">Stats</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
              {p.stats.map((st, i) => {
                const fmtPct = (v) => (v == null ? null : Number(v).toFixed(1) + "%");
                return (
                  <div key={i} className="px-4 py-3">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{st.season || "—"}</div>
                    <div className="flex justify-between">
                      {[["G", st.gp != null ? Math.round(st.gp) : null], ["PASS", st.passYds != null ? Math.round(st.passYds) : null], ["RUSH", st.rushYds != null ? Math.round(st.rushYds) : null], ["REC YDS", st.recYds != null ? Math.round(st.recYds) : null], ["REC", st.rec != null ? Math.round(st.rec) : null]].map(([lbl, v]) => (
                        <span key={lbl} className="flex-1 text-center">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                          <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v ?? "—"}</span>
                        </span>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2">
                      {[["TD", st.td != null ? Math.round(st.td) : null], ["INT", st.ints != null ? Math.round(st.ints) : null], ["TKL", st.tkl != null ? Math.round(st.tkl) : null], ["SCK", fmt1(st.sck)]].map(([lbl, v]) => (
                        <span key={lbl} className="flex-1 text-center">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase">{lbl}</span>
                          <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{v ?? "—"}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

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
const NFL_VERSION = "v34";
// Until the current season has results, fall back to last season's numbers
const seasonStarted = (teams) => (teams || []).some((t) => (t.wins ?? 0) + (t.losses ?? 0) + (t.ties ?? 0) > 0);
function teamRec(t, started) {
  const w = started ? t.wins : (t.winsPrev ?? t.wins);
  const l = started ? t.losses : (t.lossesPrev ?? t.losses);
  const ti = started ? t.ties : (t.tiesPrev ?? t.ties);
  return { w: w ?? 0, l: l ?? 0, t: ti ?? 0, str: (w ?? 0) + "-" + (l ?? 0) + ((ti ?? 0) > 0 ? "-" + ti : "") };
}
const teamPts = (t, started) => ({
  pf: started ? t.pf : (t.pfPrev ?? t.pf),
  pa: started ? t.pa : (t.paPrev ?? t.pa),
});

// ═══════════════ LIVE INJURY LAYER (Sleeper API) ═════════════════
// Fetched once at load; free public feed, no key. Statuses:
//   injury_status: Questionable / Doubtful / Out
//   status: Active / Injured Reserve / PUP / NFI / Inactive
const INJ_BY_NAME = {}; // normalized name -> [sleeper players] (dupes kept)
const INJ_BY_LAST = {}; // "TEAM|lastname" -> [sleeper players] — nickname-proof fallback
const lastNameKey = (name) => {
  const parts = injNrm(name).split(" ").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
};
const injNrm = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "").replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();
const injTeamEq = (a, b) => {
  const n = (t) => String(t || "").toUpperCase();
  if (n(a) === n(b)) return true;
  const AL = [["WAS", "WSH"], ["JAX", "JAC"], ["LAR", "LA"], ["ARI", "ARZ"], ["BAL", "BLT"], ["CLE", "CLV"], ["HOU", "HST"]];
  return AL.some(([x, y]) => (n(a) === x && n(b) === y) || (n(a) === y && n(b) === x));
};
// Sleeper's "not playing" vocabulary — shared by the formation and the unit rankings
const OUT_CODES = new Set(["OUT", "IR", "PUP", "NA", "SUS", "COV", "DNR", "NFI", "RET"]);
function injIsOut(inj) {
  return !!inj && (OUT_CODES.has(String(inj.injury_status || "").toUpperCase()) ||
    /injured reserve|pup|non football|suspend|inactive/i.test(String(inj.status || "")));
}

function injFor(name, teamAbbr) {
  const list = INJ_BY_NAME[injNrm(name)];
  if (list && list.length) {
    if (list.length > 1 && teamAbbr) {
      const hit = list.find((p) => injTeamEq(p.team, teamAbbr));
      if (hit) return hit;
      return null; // duplicate name, wrong/unknown team — don't guess
    }
    return list[0];
  }
  // Full name missed (nickname: "Bam Knight" vs Sleeper's "Zonovan Knight").
  // Fall back to team + last name, but only when exactly one player on that
  // team has the last name — never guess between two Smiths.
  if (teamAbbr) {
    for (const t of Object.keys(INJ_BY_LAST)) {
      const [team, last] = t.split("|");
      if (last === lastNameKey(name) && injTeamEq(team, teamAbbr)) {
        const cands = INJ_BY_LAST[t];
        if (cands.length === 1) return cands[0];
      }
    }
  }
  return null;
}
// Automated headshots: if Airtable has no photo, fall back to Sleeper's CDN
// (keyed by the player_id we already matched for injuries). Covers every
// rostered player with zero manual uploads.
function photoOf(p, teamAbbr) {
  return photoUrls(p, teamAbbr)[0] || null;
}
// Every headshot source we have for a player, best first. Sleeper's CDN has
// no picture for many QB3s, practice-squad call-ups and fresh signings; ESPN
// usually does, so it's the second try before falling back to initials.
function photoUrls(p, teamAbbr) {
  const out = [];
  if (p.photo) out.push(p.photo);
  const inj = injFor(p.name, teamAbbr || toAbbr(teamOfPlayer(p) || p.teamName || ""));
  if (inj && inj.player_id) out.push(`https://sleepercdn.com/content/nfl/players/${inj.player_id}.jpg`);
  if (inj && inj.espn_id) out.push(`https://a.espncdn.com/i/headshots/nfl/players/full/${inj.espn_id}.png`);
  return out;
}
// Steps through photoUrls on load errors; renders `fallback` once every source fails.
function Headshot({ p, abbr, className, fallback, alt = "", lazy = true }) {
  const urls = photoUrls(p, abbr);
  const [i, setI] = useState(0);
  if (i >= urls.length) return fallback || null;
  return <img src={urls[i]} alt={alt} loading={lazy ? "lazy" : undefined} className={className} onError={() => setI(i + 1)} />;
}

// Badge only when NOT plain healthy-active (keeps rows quiet)
// Player-page injury line: "Ankle sprain · Est. return Oct 20". Body part +
// type from Sleeper (instant); return date from ESPN when the team gave one.
function InjuryLine({ p, deep }) {
  const abbr = toAbbr(teamOfPlayer(p) || p.teamName || "");
  if (!injHasFlag(p, abbr)) return p.injuryNotes ? <div className="inline-block mt-1.5 text-[11px] font-bold text-white bg-rose-600 rounded-full px-2 py-0.5 truncate max-w-full lowercase">({p.injuryNotes})</div> : null;
  const d = injuryDetail(p, abbr, deep);
  if (!d) return null;
  const inj = injFor(p.name, abbr);
  const e = inj && inj.espn_id ? INJ_ESPN[String(inj.espn_id)] : null;
  const rawC = (deep && deep.comment) || (e && e.comment) || null;
  const comment = rawC && !/^\s*(inactive|active|out|questionable|doubtful|probable)\.?\s*$/i.test(rawC) ? rawC : null;
  return (
    <div className="mt-1.5">
      {d.note && <div className="text-[11px] font-bold text-white bg-rose-600 rounded-full px-2.5 py-0.5 inline-block max-w-full truncate">{d.note}</div>}
      {d.retLine && <div className="text-[11px] font-semibold text-white/90 mt-1">{d.retLine}</div>}
      {comment && <div className="text-[11px] text-white/80 mt-1 leading-snug">{comment}</div>}
    </div>
  );
}

function InjBadge({ p, team, lg = false, noNote = false }) {
  const inj = injFor(p.name, team);
  if (!inj) return null;
  let label = null, cls = "";
  const is2 = inj.injury_status;
  if (is2 === "Questionable") { label = "QUESTIONABLE"; cls = "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"; }
  else if (is2 === "Doubtful") { label = "DOUBTFUL"; cls = "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"; }
  else if (is2 === "Out") { label = "OUT"; cls = "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"; }
  // Sleeper also uses short codes in injury_status itself (IR, PUP, NA, Sus, COV)
  else if (/^(IR|PUP|NA|SUS|COV|DNR|NFI)$/i.test(String(is2 || ""))) { label = String(is2).toUpperCase() === "NA" ? "OUT" : String(is2).toUpperCase(); cls = "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"; }
  else {
    const st = String(inj.status || "");
    if (/injured reserve/i.test(st)) { label = "IR"; cls = "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"; }
    else if (/pup|physically unable/i.test(st)) { label = "PUP"; cls = "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"; }
    else if (/non football/i.test(st)) { label = "NFI"; cls = "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"; }
  }
  if (!label) return null;
  const note = inj.injury_body_part || null; // e.g. "Hamstring", "Knee"
  return (
    <span className="inline-flex flex-col items-start gap-0.5 min-w-0">
      <span className={"font-extrabold rounded px-1.5 shrink-0 " + (lg ? "text-[11px] py-0.5 rounded-full px-2.5 text-white " + (label === "QUESTIONABLE" ? "bg-amber-500" : label === "DOUBTFUL" ? "bg-rose-600" : "bg-rose-600") : "text-[9px] py-px " + cls)}>
        {label}
      </span>

    </span>
  );
}

// Live status wins over the Airtable status field when they disagree
// (this is what makes Teams and Players views tell the same story)
// How many players per position count as "starters" (tune to your labels)
const STARTER_DEPTH = { WR: 3, CB: 2, LB: 2, OLB: 2, ILB: 2, DT: 2, DE: 2, EDGE: 2, S: 2, G: 2, T: 2 };
const depthOf = (p) => (p.sort != null ? (p.sort % 100 === 0 ? 1 : p.sort % 100) : null);
const isStarter = (p) => {
  const d = depthOf(p);
  if (d == null) return false;
  return d <= (STARTER_DEPTH[String(p.pos || "").toUpperCase()] || 1);
};

// ── Depth chart: Sleeper drives it, Airtable overrides it ──────────────────
// Sleeper tags every player with depth_chart_position ("LWR", "RG", "LOLB",
// "NB"…) and depth_chart_order, and keeps it current as teams reshuffle. We
// turn that into the same labels the app already understands ("WR3", "RG1",
// "LDE1"). A value in Airtable's Sort Priority still wins for that player —
// that's the override for when the feed is wrong.
const POS_SEQ_UI = ["QB", "RB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT", "OT", "OG", "G", "OL",
  "DE", "EDGE", "DT", "NT", "DL", "LB", "ILB", "MLB", "OLB", "CB", "NB", "S", "FS", "SS", "DB", "K", "P", "LS", "KR", "PR"];
function rankOfLabel(label) {
  if (!label) return null;
  const m = String(label).toUpperCase().match(/^([A-Z]+)\s*(\d*)$/);
  if (!m) return null;
  let base = m[1], side = 0;
  if (!POS_SEQ_UI.includes(base) && /^[LR]/.test(base) && POS_SEQ_UI.includes(base.slice(1))) { side = base[0] === "L" ? 0 : 0.5; base = base.slice(1); }
  const i = POS_SEQ_UI.indexOf(base);
  if (i === -1) return null;
  return i * 100 + (m[2] ? Number(m[2]) : 0) + side;
}
function autoDepthLabels(roster, abbr) {
  const out = {};
  const FAMILY = { LWR: "WR", RWR: "WR", SWR: "WR", WR: "WR", RB: "RB", HB: "RB", TE: "TE", QB: "QB", FB: "FB" };
  const SLOT_PRI = { LWR: 0, RWR: 1, SWR: 2, WR: 3 };
  const groups = {};
  for (const p of roster) {
    const sp = injFor(p.name, abbr);
    if (!sp || !sp.depth_chart_position) continue;
    const slot = String(sp.depth_chart_position).toUpperCase();
    const order = Number(sp.depth_chart_order) || 99;   // unknown order sorts last
    const fam = FAMILY[slot] || slot;                   // LT, LDE, NB, K… number within their own slot
    (groups[fam] ??= []).push({ p, slot, order });
  }
  // Positions Chris numbers as one sequence: WR1..WRn across LWR/RWR/SWR slots
  for (const [fam, list] of Object.entries(groups)) {
    list.sort((a, b) => a.order - b.order || (SLOT_PRI[a.slot] ?? 9) - (SLOT_PRI[b.slot] ?? 9) || String(a.p.name).localeCompare(String(b.p.name)));
    list.forEach((e, i) => { out[e.p.id] = fam + (i + 1); });
  }
  return out;
}
// unit state lives in TeamDetail now so the stat tiles up top can react to
// the Offense/Defense toggle. lineRank = this team's OL/DL league ranks.
function FormationView({ roster, abbr, unit, setUnit, onSelectPlayer, lineRank, team }) {
  const lblOf = (p) => String(p.sortLabel || "").toUpperCase();
  const depthNo = (p) => { const m = lblOf(p).match(/(\d+)$/); return m ? Number(m[1]) : 1; };
  const baseOf = (p) => { const m = lblOf(p).match(/^([A-Z]+)/); return m ? m[1] : null; };
  const norm = (b) => (b && b.length > 2 && /^[LR]/.test(b) && !["LB", "RB"].includes(b) ? b.slice(1) : b);
  const injOf = (p) => (p ? injFor(p.name, abbr) : null);
  // Sleeper's injury_status vocabulary is wider than Q/D/Out — IR, PUP, NA,
  // Sus, COV, DNR all mean "not playing". Missing any of these = a hurt
  // player shown as healthy (the Charbonnet bug).
  // Out = Sleeper says so, OR you marked Status = Out / Inactive / IR in Airtable
  // (healthy scratches never hit the injury report, so the manual flag matters).
  const airtableOut = (p) => /^(out|inactive|ir|injured reserve|pup|suspended)$/i.test(String((p && p.status) || "").trim());
  const isOut = injIsOut;
  const outP = (p) => !!p && (injIsOut(injOf(p)) || airtableOut(p));
  // Health state: "out" | "d" | "q" | "ok" | null (no Sleeper match)
  const healthOf = (p) => {
    if (airtableOut(p)) return "out";
    const inj = injOf(p);
    if (!inj) return null;
    if (isOut(inj)) return "out";
    const st = String(inj.injury_status || "").toUpperCase();
    if (st === "DOUBTFUL") return "d";
    if (st === "QUESTIONABLE") return "q";
    return "ok";
  };
  // Who sits: OUT/IR/PUP/suspended, and DOUBTFUL — a doubtful player is
  // inactive far more often than not, so he goes to the sideline and the next
  // man up takes his spot. QUESTIONABLE stays on the field (usually plays).
  const sitP = (p) => outP(p) || healthOf(p) === "d";
  // Ring: white = healthy (reads on grass), gray = no data, orange = Q, red = D/Out
  const ringCls = (p) => {
    if (!p) return "border-white/40";
    const h = healthOf(p);
    if (h == null) return "border-slate-400";
    if (h === "ok") return "border-white";
    return "border-red-500"; // anyone banged up = red; the badge says how badly
  };
  // High-contrast status badge at the top-right of the circle — the thing
  // you actually read, since ring hue alone gets lost against green turf.
  const HealthBadge = ({ p, small }) => {
    const h = healthOf(p);
    if (!h || h === "ok") return null;
    const inj = injOf(p) || {};
    const txt = h === "q" ? "QUESTIONABLE" : h === "d" ? "DOUBTFUL"
      : (String(inj.injury_status || "").toUpperCase() === "IR" || /injured reserve|^ir$/i.test(String(inj.status || p.status || ""))) ? "IR"
      : String(inj.injury_status || "").toUpperCase() === "PUP" ? "PUP" : "OUT";
    return (
      <span className={"absolute -top-2 left-1/2 px-1.5 rounded-full font-extrabold text-white bg-red-600 border-2 border-white shadow whitespace-nowrap flex items-center justify-center " +
        (small ? "h-[13px] text-[6px] " : "h-[15px] text-[7px] ")}
        style={{ transform: "translate(-50%,0)", animation: "hrbPulse 1.8s ease-in-out infinite" }}>
        {txt}
      </span>
    );
  };
  const used = new Set();
  let SLOTS, assigned, formationLabel = null; // defense sets this ("4-3 · Nickel"); offense stays clean

  if (unit === "offense") {
    // Offense keeps the 11-man template — it's stable across the league.
    SLOTS = [
      { lbl: "WR", x: 11, y: 18, exact: ["WR1"], aliases: ["WR"] },
      { lbl: "WR", x: 89, y: 18, exact: ["WR2"], aliases: ["WR"] },
      { lbl: "WR", x: 31, y: 34, exact: ["WR3"], aliases: ["WR"] },
      { lbl: "TE", x: 70, y: 34, exact: ["TE1"], aliases: ["TE"] },
      { lbl: "LT", x: 10, y: 52, exact: ["LT1"], aliases: ["LT", "OT", "T"] },
      { lbl: "LG", x: 30, y: 52, exact: ["LG1"], aliases: ["LG", "G", "OG"] },
      { lbl: "C", x: 50, y: 52, exact: ["C1"], aliases: ["C", "OC"] },
      { lbl: "RG", x: 70, y: 52, exact: ["RG1"], aliases: ["RG", "G", "OG"] },
      { lbl: "RT", x: 90, y: 52, exact: ["RT1"], aliases: ["RT", "OT", "T"] },
      { lbl: "QB", x: 50, y: 70, exact: ["QB1"], aliases: ["QB"] },
      { lbl: "RB", x: 50, y: 88, exact: ["RB1", "HB1"], aliases: ["RB", "HB", "FB"] },
    ];
    // Two-pass slot assignment.
    //   Pass 1 — exact depth labels claim their exact slot: "WR3" lands at the
    //   3rd WR spot even if no WR2 exists, leaving the WR2 slot visibly open.
    //   Pass 2 — remaining slots fill in depth order by label, then Position.
    assigned = new Array(SLOTS.length).fill(null);
    // Next man up: an OUT/IR/PUP/suspended starter is skipped in pass 1 and
    // his slot fills from the depth chart in pass 2 (WR4 steps into WR3's
    // spot). He goes to the sideline wearing his OUT badge. Q starters stay
    // on the field — those are game-time calls, not lineup changes.
    const outStarter = new Array(SLOTS.length).fill(null);
    SLOTS.forEach((s, i) => {
      for (const want of s.exact || []) {
        const hit = roster.find((p) => !used.has(p.id) && lblOf(p) === want);
        if (hit) {
          if (sitP(hit)) { outStarter[i] = hit; continue; }
          assigned[i] = hit; used.add(hit.id); break;
        }
      }
    });
    SLOTS.forEach((s, i) => {
      if (assigned[i]) return;
      const aliasIdx = (p) => s.aliases.findIndex((a) => new RegExp("^" + a + "\\d*$").test(lblOf(p)));
      const healthy = (p) => !sitP(p);
      const byLabel = roster
        .filter((p) => !used.has(p.id) && aliasIdx(p) !== -1 && healthy(p))
        .sort((a, b) => aliasIdx(a) - aliasIdx(b) || depthNo(a) - depthNo(b));
      const byPos = roster
        .filter((p) => !used.has(p.id) && s.aliases.includes(String(p.pos || "").toUpperCase()) && healthy(p))
        .sort((a, b) => (a.sort ?? 9999) - (b.sort ?? 9999));
      // Offensive line backups are interchangeable across the interior (a C2 is
      // the backup guard too) and across tackle spots — so if the slot's own
      // position has no healthy backup, borrow from the line family before
      // showing a hole. Depth-1 starters at other spots are never pulled.
      const OL_INTERIOR = ["C", "OC", "LG", "RG", "G", "OG", "OL"], OL_TACKLE = ["LT", "RT", "OT", "T", "OL"];
      const fam = ["LG", "C", "RG"].includes(s.lbl) ? OL_INTERIOR : ["LT", "RT"].includes(s.lbl) ? OL_TACKLE : null;
      const byFamily = fam ? roster
        .filter((p) => !used.has(p.id) && healthy(p) && depthNo(p) >= 2 && (fam.some((a) => new RegExp("^" + a + "\\d*$").test(lblOf(p))) || fam.includes(String(p.pos || "").toUpperCase())))
        .sort((a, b) => depthNo(a) - depthNo(b) || (b.rating2k ?? 0) - (a.rating2k ?? 0)) : [];
      // no healthy body at all -> show the injured starter rather than a hole
      const hit = byLabel[0] || byPos[0] || byFamily[0] || outStarter[i] || null;
      if (hit) { assigned[i] = hit; used.add(hit.id); if (outStarter[i] && hit !== outStarter[i]) s.nextUp = true; }
    });
    // Fullback: only about a third of the league carries one, so the slot
    // exists only when a healthy FB is on the depth chart. He lines up
    // offset in front of the RB (offset-I look) rather than leaving a hole.
    const fb = roster
      .filter((p) => !used.has(p.id) && !sitP(p) && (/^FB\d*$/.test(lblOf(p)) || String(p.pos || "").toUpperCase() === "FB"))
      .sort((a, b) => depthNo(a) - depthNo(b) || (a.sort ?? 9999) - (b.sort ?? 9999))[0];
    if (fb) {
      SLOTS.push({ lbl: "FB", x: 30, y: 81, exact: ["FB1"], aliases: ["FB"] });
      assigned.push(fb); used.add(fb.id);
    }
  } else {
    // ── Defense: NOT a template. Every declared starter takes the field. ──
    // Real depth charts don't have exactly 11 starters (4 LBs + a nickel is
    // 12). Each row lays itself out for however many starters it has, so a
    // 4-3, 3-4, nickel, or 3-4-with-four-LBs all render without dropping
    // anyone. Rule: "X1" (or a side label like LOLB1) in Airtable = starter.
    // Base label normalized: strip a side prefix (LILB -> ILB, RDE -> DE) so
    // any naming style classifies into the right row. Nicknames included
    // (MIKE/WILL/SAM/JACK/BUCK/MACK for LBs, STAR/DIME/NICKEL for DBs).
    const ROW_OF = (b0) => {
      const b = norm(b0);
      if (/^(DE|DT|NT|EDGE|DL)$/.test(b)) return "dl";
      if (/^(OLB|ILB|MLB|LB|WLB|SLB|MIKE|WILL|SAM|JACK|BUCK|MACK)$/.test(b)) return "lb";
      if (/^(CB|NB|NCB|SLOT|DB|STAR|DIME|NICKEL)$/.test(b)) return "db";
      if (/^(S|FS|SS)$/.test(b)) return "s";
      return null;
    };
    // How many depth numbers count as "starter" per label. Side-prefixed
    // labels (LDE, RILB) are one-per-side, so they're always depth 1.
    const STARTER_MAX = {
      DE: 2, DT: 2, NT: 1, EDGE: 2, DL: 4,
      OLB: 2, ILB: 2, MLB: 1, LB: 4, WLB: 1, SLB: 1, MIKE: 1, WILL: 1, SAM: 1, JACK: 1, BUCK: 1, MACK: 1,
      CB: 3, NB: 1, NCB: 1, SLOT: 1, DB: 2, STAR: 1, DIME: 1, NICKEL: 1, FS: 1, SS: 1, S: 2,
    };
    const maxFor = (b0) => (b0 !== norm(b0) ? 1 : (STARTER_MAX[b0] ?? 1));
    // Left-to-right ordering inside a row: L-side labels, then the "1" of an
    // edge position (SAM/WILL/OLB1/DE1/CB1), interior, "2" of an edge, R-side.
    const EDGE_BASES = new Set(["DE", "EDGE", "OLB", "CB", "S"]);
    // Strong side = the tight end's side, and the offense view draws the TE on
    // the right, so SAM lines up on the right and WILL on the left.
    const LEFT_NAMES = new Set(["WILL", "WLB", "FS"]), RIGHT_NAMES = new Set(["SAM", "SLB", "SS"]);   // strong safety on the strong side too
    // 0 = left edge · 1 = left interior · 2 = middle · 3 = right interior · 4 = right edge
    // So LDE · LDT · RDT · RDE lines up as a real front, not LDT · LDE · RDE · RDT.
    const sideKey = (b0, d) => {
      const b = norm(b0);
      const edge = EDGE_BASES.has(b);
      if (b0 !== b) return b0.startsWith("L") ? (edge ? 0 : 1) : (edge ? 4 : 3);
      if (LEFT_NAMES.has(b)) return 0;
      if (RIGHT_NAMES.has(b)) return 4;
      return edge ? (d <= 1 ? 0 : 4) : 2;
    };
    const rows = { dl: [], lb: [], db: [], s: [] };
    // Airtable decides who starts. If any player in a row has an Airtable
    // label, Sleeper-filled players in that row are depth only (next man up),
    // never extra starters. Rows with no Airtable labels fall back to Sleeper.
    const airRows = new Set(roster.filter((p) => p.depthSrc === "airtable" && baseOf(p) && ROW_OF(baseOf(p))).map((p) => ROW_OF(baseOf(p))));
    const starters = roster
      .filter((p) => { const b = baseOf(p); return b && ROW_OF(b) && depthNo(p) <= maxFor(b) && !(p.depthSrc === "sleeper" && airRows.has(ROW_OF(b))); })
      .sort((a, b) => sideKey(baseOf(a), depthNo(a)) - sideKey(baseOf(b), depthNo(b)) || depthNo(a) - depthNo(b));
    // Two players can carry the same label (an "NT" and an "NT1", or a stale
    // duplicate). Only the first `maxFor` at each label are starters; any
    // extra is a backup, which is exactly who next-man-up should find.
    const seenAt = {};
    const capped = starters.filter((p) => { const b = baseOf(p); seenAt[b] = (seenAt[b] || 0) + 1; return seenAt[b] <= maxFor(b); });
    starters.length = 0; starters.push(...capped);
    const starterIds = new Set(starters.map((p) => p.id));
    starters.forEach((p) => {
      let who = p, nextUp = false;
      if (sitP(p)) {
        // Next man up: same position family first (WLB1 out -> WLB2), then
        // any healthy non-starter in the same row, shallowest depth first.
        // The exact same label wins before anything else: LDE1 out -> LDE2,
        // never an RDE2 or DE2 who happens to sit earlier in the roster.
        const own = baseOf(p), fam = norm(own), row = ROW_OF(own);
        const fit = (q) => (baseOf(q) === own ? 0 : norm(baseOf(q)) === fam ? 1 : 2);
        const repl = roster
          .filter((q) => !used.has(q.id) && !starterIds.has(q.id) && q.id !== p.id && baseOf(q) && ROW_OF(baseOf(q)) === row && !sitP(q))
          .sort((a, b) => fit(a) - fit(b) || depthNo(a) - depthNo(b) || (a.depthSrc === "airtable" ? 0 : 1) - (b.depthSrc === "airtable" ? 0 : 1))[0];
        if (repl) { who = repl; nextUp = true; }
        else { rows[ROW_OF(baseOf(p))].push({ p: null, lbl: baseOf(p), vacant: true }); return; }   // nobody behind him: open slot, he's on the sideline
      }
      rows[ROW_OF(baseOf(p))].push({ p: who, lbl: baseOf(p), nextUp });
      used.add(who.id);
    });
    // Fallback for rosters without depth labels: fill each row by Position.
    const FALLBACK = { dl: ["DE", "DT", "NT", "EDGE", "DL"], lb: ["LB", "ILB", "OLB", "MLB"], db: ["CB", "NB", "DB"], s: ["S", "FS", "SS"] };
    const MIN_ROW = { dl: 3, lb: 2, db: 2, s: 2 };
    const BASE_ROW = { dl: 4, lb: 3, db: 2, s: 2 };
    for (const r of Object.keys(rows)) {
      if (rows[r].length === 0) {
        roster.filter((p) => !used.has(p.id) && FALLBACK[r].includes(String(p.pos || "").toUpperCase()))
          .sort((a, b) => (a.sort ?? 9999) - (b.sort ?? 9999)).slice(0, BASE_ROW[r])
          .forEach((p) => { rows[r].push({ p, lbl: String(p.pos || "").toUpperCase() }); used.add(p.id); });
      }
      while (rows[r].length < MIN_ROW[r]) rows[r].push({ p: null, lbl: r === "s" ? "S" : r === "db" ? "CB" : r.toUpperCase() });
    }
    // Row geometry mirrors real alignments instead of even columns:
    //   DL hugs the box, LBs sit inside the ends (OLBs wide in a 3-4),
    //   corners pin to the sidelines with the nickel tucked closer to the
    //   line, safeties split the deep middle.
    const XS = {
      dl: { 3: [22, 50, 78], 4: [14, 38, 62, 86], 5: [13, 31.5, 50, 68.5, 87] },
      lb: { 2: [33, 67], 3: [26, 50, 74], 4: [12, 38, 62, 88], 5: [10, 30, 50, 70, 90] },
      s: { 1: [50], 2: [33, 67], 3: [25, 50, 75] },
    };
    const spread = (n, i) => (n === 1 ? 50 : 10 + (80 * i) / (n - 1));
    const xFor = (r, n, i) => (XS[r] && XS[r][n] ? XS[r][n][i] : spread(n, i));
    const Y = { dl: 80, lb: 58, db: 40, s: 18 };
    SLOTS = []; assigned = [];
    // Personnel label from what's actually on the field: "4-3 · Nickel"
    const dbN = rows.db.filter((x) => x.p).length + rows.s.filter((x) => x.p).length;
    formationLabel = `${rows.dl.filter((x) => x.p).length}-${rows.lb.filter((x) => x.p).length}` +
      (dbN >= 7 ? " · Quarter" : dbN >= 6 ? " · Dime" : dbN >= 5 ? " · Nickel" : " · Base");
    for (const r of ["dl", "lb", "db", "s"]) {
      const n = rows[r].length;
      rows[r].forEach((it, i) => {
        let x = xFor(r, n, i), y = Y[r];
        if (r === "db") {
          // corners pinned to the sidelines, interior DBs (nickel/dime)
          // spread between them on the same row — never on top of a LB
          const inner = n - 2;
          if (i === 0) x = 11;
          else if (i === n - 1) x = 89;
          else { x = inner === 1 ? 50 : 32 + (36 * (i - 1)) / (inner - 1); y -= 3; }   // nickel/dime sit a touch shallower
          if (n === 1) x = 50;
        }
        SLOTS.push({ lbl: it.lbl, x, y, nextUp: !!it.nextUp });
        assigned.push(it.p);
      });
    }
  }
  // Sideline: everyone on this side of the ball who didn't crack the 11.
  const sideOf = (p) => {
    const u = unitOf(p);
    if (u === "Offense" || u === "Offensive Line") return "offense";
    if (u === "Defense" || u === "Defensive Line") return "defense";
    const m = lblOf(p).match(/^([A-Z]+)/);
    const b = m ? m[1] : null;
    if (b && (OL_POS.has(b) || ["QB", "RB", "FB", "HB", "WR", "TE"].includes(b))) return "offense";
    if (b && /^[LR]?(DE|DT|NT|EDGE|DL|OLB|ILB|MLB|LB|WLB|SLB|MIKE|WILL|SAM|JACK|BUCK|MACK|CB|NB|NCB|SLOT|DB|STAR|DIME|NICKEL|S|FS|SS)$/.test(b)) return "defense";
    return null;
  };
  // Sideline order: by positional importance (the question a bench answers
  // is "who's behind my starter at X"), then depth number within position.
  // Offense: QB > RB > WR > TE > line. Defense: edge > interior > LB > CB > S.
  const SIDELINE_ORDER = unit === "offense"
    ? ["QB", "RB", "HB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT", "OT", "OG", "G", "OC", "OL"]
    : ["DE", "LDE", "RDE", "EDGE", "DT", "LDT", "RDT", "NT", "DL", "LB", "ILB", "MLB", "OLB", "LLB", "RLB", "WLB", "SLB", "CB", "LCB", "RCB", "NB", "NCB", "DB", "S", "FS", "SS"];
  const posRank = (p) => {
    const m = lblOf(p).match(/^([A-Z]+)/);
    const base = (m && SIDELINE_ORDER.includes(m[1])) ? m[1] : String(p.pos || "").toUpperCase();
    const i = SIDELINE_ORDER.indexOf(base);
    return i === -1 ? 99 : i;
  };
  const bench = roster
    .filter((p) => !used.has(p.id) && sideOf(p) === unit)
    .sort((a, b) => posRank(a) - posRank(b) || depthNo(a) - depthNo(b) || (b.rating2k ?? -1) - (a.rating2k ?? -1));
  // Ring scheme (no yellow — it collided with the gold 90+ OVR chip):
  //   emerald = Sleeper confirms healthy · orange = Questionable
  //   red = Doubtful · red + faded photo = Out/IR/PUP · slate = no Sleeper data
  return (
    <div className="mt-4">
      {setUnit && <div className="flex gap-2 mb-3">
        {[["offense", "Offense"], ["defense", "Defense"]].map(([k, lbl]) => (
          <button key={k} onClick={() => setUnit(k)}
            className={"flex-1 py-1.5 rounded-full text-[11px] font-extrabold " + (unit === k
              ? "text-white"
              : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
            style={unit === k ? { backgroundColor: teamColor(abbr) } : undefined}>
            {lbl}
          </button>
        ))}
      </div>}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm"
        style={{ paddingBottom: "118%", background: "repeating-linear-gradient(180deg,#1c7c40 0 9%,#166534 9% 18%)" }}>
        {/* subtle top-down light so it reads as turf, not a flat panel */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.10) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0.18) 100%)" }} />
        {/* end zone: team color with painted diagonal texture and big
            stenciled letters — reads like turf paint, not a UI header */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-center overflow-hidden"
          style={{ height: "9%", background: TEAM_ALT[abbr] || teamColor(abbr) }}>
          <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 10px, transparent 10px 20px)" }} />
          <div className="absolute inset-x-0 top-[18%] h-px bg-white/25" />
          <div className="absolute inset-x-0 bottom-[18%] h-px bg-white/25" />
          {/* painted end-zone lettering: team nickname, outlined like turf paint */}
          <span className="font-black text-[22px] tracking-[0.3em] pl-[0.3em] uppercase select-none"
            style={{ color: ENDZONE_INK[abbr] || teamColor(abbr), WebkitTextStroke: "1px rgba(255,255,255,0.35)", textShadow: "0 2px 0 rgba(0,0,0,0.35), 0 0 14px rgba(0,0,0,0.25)" }}>
            {(team && team.name ? String(team.name).trim().split(" ").pop() : abbr)}
          </span>
        </div>
        <div className="absolute inset-x-0 h-[2.5px] bg-white/90" style={{ top: "9%" }} />
        {/* line rank: frosted tag sitting just below the line it grades —
            under the OL row on offense, under the DL front on defense */}
        {(() => {
          const lr = unit === "offense" ? lineRank?.ol : lineRank?.def;
          if (!lr || lr.rank == null) return null;
          const tierText = lr.rank <= 10 ? "text-emerald-300"
            : lr.rank <= 20 ? "text-yellow-300"
            : "text-rose-300";
          return (
            <span className={"absolute right-2 flex items-baseline gap-1 rounded-md bg-black/35 backdrop-blur-sm px-2 py-1 text-[10px] font-extrabold text-white/90 shadow-sm " + (unit === "offense" ? "" : "bottom-2")}
              style={unit === "offense" ? { top: "62.5%" } : undefined}>
              {unit === "offense" ? "OL" : "DEF"}
              <span className={"tabular-nums " + tierText}>{ordinal(lr.rank)}</span>
            </span>
          );
        })()}
        {/* faint team logo watermark at midfield */}
        {TEAM_LOGOS[abbr] && (
          <img src={TEAM_LOGOS[abbr]} alt="" className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-2/5 opacity-[0.09] pointer-events-none select-none" style={{ top: "48%" }} />
        )}
        {/* personnel tag: what's on the field right now */}
        {formationLabel && (
          <span className="absolute left-2 rounded-md bg-black/35 backdrop-blur-sm px-2 py-1 text-[10px] font-extrabold text-white/90 shadow-sm" style={{ top: "11%" }}>
            {formationLabel}
          </span>
        )}
        <style>{`@keyframes hrbPop { from { opacity: 0; transform: translate(-50%, -50%) scale(.6); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } } ${PULSE_CSS}`}</style>
        {/* yard lines (no side numbers — quieter field) */}
        {[16, 24, 32, 40, 48, 56, 64, 72, 80, 88].map((y) => (
          <div key={y} className="absolute inset-x-0 h-px bg-white/45" style={{ top: y + "%" }} />
        ))}
        {/* hash marks */}
        {Array.from({ length: 21 }, (_, i) => 12 + i * 4).map((y) => (
          <React.Fragment key={y}>
            <div className="absolute w-1.5 h-px bg-white/30" style={{ left: "39%", top: y + "%" }} />
            <div className="absolute w-1.5 h-px bg-white/30" style={{ left: "59.5%", top: y + "%" }} />
          </React.Fragment>
        ))}
        {/* sidelines */}
        <div className="absolute inset-y-0 left-0 w-[3px] bg-white/60" />
        <div className="absolute inset-y-0 right-0 w-[3px] bg-white/60" />
        {SLOTS.map((s, i) => {
          const p = assigned[i];
          return (
            <button key={unit + i + (p ? p.id : "")} disabled={!p} onClick={p ? () => onSelectPlayer(p) : undefined}
              className="absolute flex flex-col items-center"
              style={{ left: s.x + "%", top: s.y + "%", width: 112, transform: "translate(-50%, -50%)", animation: `hrbPop .35s ease-out ${i * 30}ms both` }}>
              <span className="relative">
                {p && photoOf(p, abbr) ? (
                  <Headshot p={p} abbr={abbr} className={"w-14 h-14 max-w-none shrink-0 rounded-full object-cover bg-white border-[3px] shadow-md " + ringCls(p)}
                    fallback={<span className={"w-14 h-14 rounded-full flex items-center justify-center text-[10px] font-extrabold shadow-md border-[3px] bg-white/90 text-slate-700 " + ringCls(p)}>{s.lbl}</span>} />
                ) : (
                  <span className={"w-14 h-14 rounded-full flex items-center justify-center text-[10px] font-extrabold shadow-md border-[3px] " + ringCls(p) + (p ? " bg-white/90 text-slate-700" : " bg-white/20 text-white/70 border-dashed")}>
                    {s.lbl}
                  </span>
                )}
                {/* Layout: position = left-edge tag (quietest info, proven
                    spot), rating = bottom pill (the scan target), number
                    merged into the single name line below. One row of text,
                    nothing above the head. */}
                {p && (
                  <span className="absolute top-1/2 -translate-y-1/2 -left-3 px-1 rounded text-[8px] font-extrabold bg-white/85 text-slate-700 shadow">
                    {s.lbl}
                  </span>
                )}
                {p && p.rating2k != null && (
                  <span className={"absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 rounded-full text-[9px] font-extrabold tabular-nums shadow " +
                    (Math.round(p.rating2k) >= 90 ? "bg-amber-400 text-slate-900"
                      : Math.round(p.rating2k) >= 85 ? "bg-emerald-500 text-white"
                      : Math.round(p.rating2k) >= 70 ? "bg-slate-900/85 text-white"
                      : "bg-rose-600 text-white")}>
                    {Math.round(p.rating2k)}
                  </span>
                )}
                {p && <HealthBadge p={p} />}
              </span>
              <span className={"mt-2 text-[9px] font-bold text-white/95 drop-shadow text-center leading-tight " + (["LG", "C", "RG"].includes(s.lbl) || /^(L|R)?(DE|DT|NT|DL|EDGE)\d*$/.test(s.lbl) ? "max-w-[104px] truncate" : ["LT", "RT"].includes(s.lbl) ? "max-w-[104px] whitespace-normal break-words" : "whitespace-nowrap")}>
                {p ? (() => {
                  const parts = p.name.split(" ");
                  const last = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(parts[parts.length - 1] || "")
                    ? parts.slice(-2).join(" ")
                    : parts.slice(-1)[0];
                  const no = cleanNo(p.no);
                  return (no ? "#" + no + " " : "") + last;
                })() : ""}
              </span>
            </button>
          );
        })}
      </div>
      {/* Special teams: one compact strip, same on offense and defense.
          K / P / LS from the depth chart (K1, P1, LS1), returners from KR1 / PR1;
          falls back to the Position field when nobody is labelled. */}
      {(() => {
        const pick = (lbl, pos) => {
          const byLbl = roster.filter((p) => new RegExp("^" + lbl + "\\d*$").test(lblOf(p)) && !sitP(p)).sort((a, b) => depthNo(a) - depthNo(b))[0];
          if (byLbl) return byLbl;
          return pos ? roster.filter((p) => String(p.pos || "").toUpperCase() === pos && !sitP(p)).sort((a, b) => (a.sort ?? 9999) - (b.sort ?? 9999))[0] : null;
        };
        const spots = [["K", pick("K", "K")], ["P", pick("P", "P")], ["LS", pick("LS", "LS")], ["KR", pick("KR", null)], ["PR", pick("PR", null)]].filter(([, p]) => p);
        if (!spots.length) return null;
        const lastOf = (p) => { const parts = String(p.name).split(" "); return /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(parts[parts.length - 1] || "") ? parts.slice(-2).join(" ") : parts.slice(-1)[0]; };
        return (
          <div className="mt-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-3 pt-2 pb-2.5">
            <div className="text-[9px] font-semibold tracking-widest uppercase text-slate-400 mb-2">Special Teams</div>
            <div className="flex justify-around gap-1">
              {spots.map(([k, p]) => (
                <button key={k} onClick={() => onSelectPlayer(p)} className="flex flex-col items-center min-w-0 flex-1">
                  <span className="relative">
                    <Headshot p={p} abbr={abbr} className="w-11 h-11 max-w-none shrink-0 rounded-full object-cover bg-white border-2 border-slate-200 dark:border-slate-700"
                      fallback={<span className="w-11 h-11 rounded-full flex items-center justify-center text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500 border-2 border-slate-200 dark:border-slate-700">{k}</span>} />
                    <span className="absolute -top-1 -left-1.5 px-1 rounded bg-slate-900/85 text-white text-[8px] font-extrabold">{k}</span>
                  </span>
                  <span className="mt-1 text-[9px] font-bold text-slate-600 dark:text-slate-300 max-w-full truncate">{(cleanNo(p.no) ? "#" + cleanNo(p.no) + " " : "") + lastOf(p)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })()}
      {/* The sideline: everyone on this side of the ball who isn't in the 11.
          Horizontal scroll, best-rated first — depth at a glance without
          stealing space from the formation. */}
      {bench.length > 0 && (
        <div className="mt-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-2 pt-2 pb-1">
          <div className="px-1 mb-1.5">
            <div className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">Sideline <span className="text-slate-500 dark:text-slate-300 tabular-nums">({bench.length})</span></div>
            <div className="flex flex-wrap justify-around gap-x-3 gap-y-0.5 mt-1">
              {(() => {
                const counts = {};
                // Group by the Position field from Airtable, shown as its abbreviation
                for (const b of bench) { const k = String(b.pos || "").toUpperCase().trim() || (baseOf(b) && norm(baseOf(b))) || "?"; counts[k] = (counts[k] || 0) + 1; }
                return Object.entries(counts).map(([k, n]) => <span key={k} className="text-[9px] font-bold text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">{k} ({n})</span>);
              })()}
            </div>
          </div>
          <div className="grid grid-cols-5 gap-y-3 gap-x-1 pt-3 pb-1.5 px-1">
            {bench.map((p) => (
              <button key={p.id} onClick={() => onSelectPlayer(p)} className="flex flex-col items-center min-w-0">
                <span className="relative">
                  {photoOf(p, abbr) ? (
                    <Headshot p={p} abbr={abbr} className={"w-14 h-14 max-w-none shrink-0 rounded-full object-cover bg-white border-[3px] " + ringCls(p).replace("border-white", "border-slate-200 dark:border-slate-700")}
                      fallback={<span className={"w-14 h-14 rounded-full flex items-center justify-center text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500 border-[3px] " + ringCls(p).replace("border-white", "border-slate-200 dark:border-slate-700")}>{String(p.pos || "").toUpperCase() || "—"}</span>} />
                  ) : (
                    <span className={"w-14 h-14 rounded-full flex items-center justify-center text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-500 border-[3px] " + ringCls(p).replace("border-white", "border-slate-200 dark:border-slate-700")}>
                      {String(p.pos || "").toUpperCase() || "—"}
                    </span>
                  )}
                  <HealthBadge p={p} small />
                  {p.rating2k != null && (
                    <span className={"absolute -bottom-1 left-1/2 -translate-x-1/2 px-1 rounded-full text-[8px] font-extrabold tabular-nums shadow " +
                      (Math.round(p.rating2k) >= 90 ? "bg-amber-400 text-slate-900"
                        : Math.round(p.rating2k) >= 85 ? "bg-emerald-500 text-white"
                        : Math.round(p.rating2k) >= 70 ? "bg-slate-900/85 text-white"
                        : "bg-rose-600 text-white")}>
                      {Math.round(p.rating2k)}
                    </span>
                  )}
                </span>
                <span className="mt-2 text-[9px] font-bold text-slate-600 dark:text-slate-300 max-w-full truncate">
                  {(() => {
                    const parts = String(p.name).split(" ");
                    const last = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(parts[parts.length - 1] || "")
                      ? parts.slice(-2).join(" ")
                      : parts.slice(-1)[0];
                    const no = cleanNo(p.no);
                    return (no ? "#" + no + " " : "") + last;
                  })()}
                </span>
                <span className="text-[8px] font-semibold text-slate-400 uppercase">{p.sortLabel || p.pos || ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {(team && (team.headCoach || team.offCoord || team.defCoord)) && (
        <div className="mt-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm px-3 py-2.5 grid grid-cols-3 gap-2">
          {[["Head Coach", team.headCoach, team.hcSince, team.hcWith], ["Off. Coordinator", team.offCoord, team.ocSince, team.ocWith], ["Def. Coordinator", team.defCoord, team.dcSince, team.dcWith]].map(([k, v, since, withTeam]) => {
            // "3rd season" = current season minus the year he took THIS role, plus one.
            // If he'd already been on staff under another title, add the org tenure.
            const yrs = since ? Math.max(1, Number(CURRENT_SEASON) - Number(since) + 1) : null;
            const tenure = withTeam && (!since || Number(withTeam) < Number(since)) ? Number(withTeam) : null;
            return (
              <div key={k} className="min-w-0 text-center">
                <div className="text-[8px] font-semibold tracking-widest uppercase text-slate-400">{k}</div>
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">{v || "—"}</div>
                {yrs && <div className="text-[9px] font-semibold text-slate-400 truncate">{ordinal(yrs)} season</div>}
                {tenure && <div className="text-[8px] font-semibold text-slate-400/90 truncate">w/ team since {tenure}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function injHasFlag(p, team) {
  const inj = injFor(p.name, team);
  return !!(inj && (inj.injury_status || !/^active$/i.test(String(inj.status || ""))));
}
function LiveStatus({ p, team }) {
  return injHasFlag(p, team)
    ? <InjBadge p={p} team={team} />
    : <StatusBadge status={p.status} />;
}

function ListHeader({ title, q, setQ, placeholder, pills, noSearch }) {
  return (
    <div className="bg-blue-600 px-5 pb-5 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
      <div className="text-2xl font-extrabold tracking-tight">{title}</div>
      {!noSearch && <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder || "Search players or teams…"}
        className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 bg-white/95 dark:bg-slate-900/80 placeholder-slate-400 outline-none"
      />}
      {pills}
    </div>
  );
}

// Populated once data loads: abbr -> logo URL
const TEAM_LOGOS = {};
const TEAM_NAMES = {};   // abbr -> full name
// Official secondary colours, so every team has one even on a bye week; the
// scoreboard feed overwrites these with ESPN's values as games load.
const TEAM_ALT = {
  ARI: "#000000", ATL: "#000000", BAL: "#000000", BUF: "#C60C30", CAR: "#0085CA", CHI: "#C83803", CIN: "#000000", CLE: "#FF3C00",
  DAL: "#869397", DEN: "#002244", DET: "#B0B7BC", GB: "#FFB612", HOU: "#A71930", IND: "#A2AAAD", JAX: "#D7A22A", KC: "#FFB81C",
  LV: "#A5ACAF", LAC: "#FFC20E", LAR: "#FFA300", MIA: "#FC4C02", MIN: "#FFC62F", NE: "#C60C30", NO: "#D3BC8D", NYG: "#A71930",
  NYJ: "#000000", PHI: "#A5ACAF", PIT: "#FFB612", SF: "#B3995D", SEA: "#69BE28", TB: "#FF7900", TEN: "#4B92DB", WSH: "#FFB612", WAS: "#FFB612",
};     // abbr -> alternate color
const TEAM_SECONDARY = { ...TEAM_ALT, ATL: "#A5ACAF", BAL: "#9E7C0C", ARI: "#FFFFFF", CIN: "#FB4F14", NYJ: "#FFFFFF" };   // tile borders
const INJ_ESPN = {};     // ESPN athlete id -> ESPN injury record (type/location/side/detail/returnDate)
const INJ_META = { count: 0, error: null, at: null };   // what the last /api/injuries call returned
// Unread injury updates: ESPN records touched since the Injury Report was last
// opened. "Last opened" lives in this phone's browser storage. First visit
// starts the clock at now, so it doesn't open with hundreds of "new" items.
const INJ_SEEN_KEY = "nfl-inj-seen";
const injSeenAt = () => {
  try {
    const v = Number(localStorage.getItem(INJ_SEEN_KEY));
    if (v) return v;
    const now = Date.now(); localStorage.setItem(INJ_SEEN_KEY, String(now)); return now;
  } catch { return Date.now(); }
};
const markInjSeen = () => { try { localStorage.setItem(INJ_SEEN_KEY, String(Date.now())); } catch {} };
function injUnreadCount() {
  const since = injSeenAt();
  let n = 0;
  for (const e of Object.values(INJ_ESPN)) {
    if (!e || !e.date || /^active$/i.test(String(e.status || ""))) continue;
    const t = new Date(e.date).getTime();
    if (t > since) n++;
  }
  return n;
}
function UnreadDot({ n, className = "" }) {
  if (!n) return null;
  return <span className={"inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black tabular-nums leading-none " + className}>{n > 99 ? "99+" : n}</span>;
}
const POS_FULL = { QB: "Quarterback", RB: "Running Back", HB: "Running Back", FB: "Fullback", WR: "Wide Receiver", TE: "Tight End", LT: "Left Tackle", RT: "Right Tackle", OT: "Offensive Tackle", T: "Offensive Tackle", LG: "Left Guard", RG: "Right Guard", G: "Guard", OG: "Guard", C: "Center", OL: "Offensive Line", DE: "Defensive End", LDE: "Defensive End", RDE: "Defensive End", DT: "Defensive Tackle", LDT: "Defensive Tackle", RDT: "Defensive Tackle", NT: "Nose Tackle", EDGE: "Edge Rusher", DL: "Defensive Line", LB: "Linebacker", ILB: "Inside Linebacker", OLB: "Outside Linebacker", MLB: "Middle Linebacker", LOLB: "Outside Linebacker", ROLB: "Outside Linebacker", CB: "Cornerback", LCB: "Cornerback", RCB: "Cornerback", NB: "Nickel Back", DB: "Defensive Back", S: "Safety", FS: "Free Safety", SS: "Strong Safety", K: "Kicker", P: "Punter", LS: "Long Snapper" };
// "Right ankle sprain (Est. return Oct 20)" — ESPN's injury detail for a player, via Sleeper's espn_id
function injuryDetail(p, abbr, deep) {
  const inj = injFor(p.name, abbr);
  const e = inj && inj.espn_id ? INJ_ESPN[String(inj.espn_id)] : null;
  let label = "";
  if (e) {
    // ESPN fills blanks with "Not Specified" / "Other" / "Unknown"; those aren't notes
    const clean = (x) => { const t = String(x || "").trim(); return /^(not specified|unspecified|other|unknown|n\/a|none|active|inactive|out|questionable|doubtful|probable|healthy|day.to.day)$/i.test(t) ? "" : t; };
    const parts = [e.side, e.location, e.detail].map(clean).filter(Boolean);
    label = [...new Set(parts.map((x) => x.toLowerCase()))].join(" ");   // drop exact repeats
    if (!label && clean(e.type)) label = clean(e.type);
  }
  if (!label && inj && (inj.injury_body_part || inj.injury_notes)) {
    label = [inj.injury_body_part, inj.injury_notes].filter(Boolean).join(" ");
  }
  label = injCase(label);
  if (/^(active|inactive|out|questionable|doubtful|probable|healthy)( injury)?$/i.test(label)) label = "";   // a status, not a note
  // Airtable's "Return Date" wins when ESPN hasn't published a date of its own.
  const raw = p.estReturn || (e && e.returnDate) || (deep && deep.returnDate) || null;
  const retTxt = fmtReturn(raw);
  if (!label && !retTxt) return null;
  const inner = [label || "injury", retTxt ? `est. return ${retTxt}` : null].filter(Boolean).join(" · ");
  // label: "(ankle sprain)" · retLine: "Estimated return date: Oct 20" · text: both inline
  return { label, retTxt, note: label ? `(${label})` : null, retLine: retTxt ? `Estimated Return Date: ${retTxt}` : null, text: `(${inner})` };
}

function TeamPill({ team }) {
  const abbr = toAbbr(team) || team;
  if (!abbr) return null;
  const logo = TEAM_LOGOS[abbr];
  if (logo) {
    return <img src={logo} alt={abbr} className="w-11 h-11 object-contain shrink-0 drop-shadow" />;
  }
  return (
    <span className="text-[10px] font-bold text-white px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: teamColor(abbr) }}>
      {abbr}
    </span>
  );
}

// ═══════════════ TAB: PLAYER HUB ═════════════════════════════════
// Hub for the Players bottom tab: one place for players, injuries, contracts, draft
function PlayersHub({ players, onSelect }) {
  const [view, setView] = useSticky("hub.view", "players");
  const [seenBefore, setSeenBefore] = useState(null);   // the mark from BEFORE this visit, for NEW tags
  const unread = view === "injury" ? 0 : injUnreadCount();
  const open = (k) => {
    if (k === "injury" && view !== "injury") { setSeenBefore(injSeenAt()); markInjSeen(); }
    setView(k);
  };
  const pills = (
    <div className="flex gap-2 mt-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {[["players", "Players"], ["injury", "🏥 Injury Report"], ["contracts", "Contracts"], ["draft", "Draft"]].map(([k, lbl]) => (
        <button key={k} onClick={() => open(k)}
          className={"shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-extrabold " + (view === k ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100 active:bg-blue-500")}>
          {lbl}{k === "injury" && <UnreadDot n={unread} />}
        </button>
      ))}
    </div>
  );
  if (view === "contracts") return <ContractsTab players={players} onSelect={onSelect} pills={pills} />;
  if (view === "draft") return <DraftTab players={players} onSelect={onSelect} pills={pills} />;
  return <PlayersTab players={players} onSelect={onSelect} pills={pills} forceInj={view === "injury"} since={seenBefore} key={view} />;
}

function PlayersTab({ players, onSelect, pills, forceInj, since }) {
  const [q, setQ] = useSticky(forceInj ? "inj.q" : "players.q", "");
  const dark = useDark();
  const injOnly = !!forceInj;
  // Injury report also searches by team: "bills", "buffalo", "BUF"
  const teamHit = (p) => {
    const s = q.toLowerCase().trim();
    if (!s) return true;
    const a = toAbbr(teamOfPlayer(p) || p.teamName || "");
    const full = String(TEAM_NAMES[a] || p.teamName || "").toLowerCase();
    return String(a).toLowerCase() === s || (s.length >= 3 && full.includes(s));
  };
  const list = useMemo(
    () => players
      .filter((p) => matchesQuery(p, q, true) || (injOnly && teamHit(p)))
      .filter((p) => !injOnly || (() => {
        const inj = injFor(p.name, toAbbr(teamOfPlayer(p) || p.teamName || ""));
        // injured = a designation, or a reserve-list roster status (not plain "Inactive")
        return inj && (inj.injury_status || /injured reserve|pup|physically unable|non football/i.test(String(inj.status || "")));
      })()),
    [players, q, injOnly]
  );
  if (injOnly) return <InjuryFeed players={list} onSelect={onSelect} q={q} setQ={setQ} pills={pills} dark={dark} since={since} />;
  return (
    <div>
      <ListHeader title={<>Players <span className="text-[10px] font-bold text-white/50 align-middle">{NFL_VERSION}</span></>} q={q} setQ={setQ} pills={pills} placeholder="Search players…" />
      <div className="px-4 pb-28 mt-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {list.map((p) => (
            <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-start gap-3 pr-4 pl-3 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800"
              style={(() => { const a = toAbbr(teamOfPlayer(p) || p.teamName || ""); return a ? { borderLeft: `3px solid ${teamInk(a, dark)}${dark ? "66" : "33"}` } : undefined; })()}>
              {/* chip and photo hold the top row beside the name, same as the injury report */}
              <span className="w-9 mt-2 text-center text-[10px] font-extrabold uppercase shrink-0 rounded-md py-1 text-white tabular-nums"
                style={(() => { const a = toAbbr(teamOfPlayer(p) || p.teamName || ""); return a ? { backgroundColor: teamInk(a, dark) } : { backgroundColor: "#64748b" }; })()}>{cleanNo(p.no) ? "#" + cleanNo(p.no) : "—"}</span>
              <div className="shrink-0"><Avatar p={p} /></div>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  <span className="font-extrabold mr-1.5 text-slate-400">{p.pos || "—"}</span>{p.name}
                </span>
                <span className="block text-[11px] text-slate-400 font-medium truncate">
                  {[p.height, p.weight, p.age ? p.age + " yrs" : ""].filter(Boolean).join(" · ") || "—"}
                </span>
                {(() => { const a = toAbbr(teamOfPlayer(p) || p.teamName || ""); if (!injHasFlag(p, a)) return null; const d = injuryDetail(p, a); return (
                  <span className="block mt-1 min-w-0">
                    <InjBadge p={p} team={a} />
                    {d && d.note && <span className="block text-[11px] font-semibold text-rose-500 truncate mt-0.5">{d.note}</span>}
                    {d && d.retLine && <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{d.retLine}</span>}
                  </span>
                ); })()}
              </span>
              <TeamPill team={teamOfPlayer(p) || p.teamName || activeOf(p)?.team} />
            </button>
          ))}
          {list.length === 0 && injOnly && <div className="text-center text-sm text-slate-400 py-12 px-6">No injuries reported right now.</div>}
          {list.length === 0 && !injOnly && <div className="text-center text-sm text-slate-400 py-12">No players match "{q}".</div>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ INJURY FEED (newest update first) ═══════════════
// One row per injured player, sorted by the time ESPN last touched the record.
// Return date: ESPN's returnDate, else Airtable's Est Return, else "—".
// ═══════════════ NEWS TICKER ═══════════════════════════════════════
// A one-line wire above the bottom nav: injury designations, newest first,
// one item every few seconds. "JETS · GARRETT WILSON · QUESTIONABLE" with the
// injury, ESPN's note and the estimated return underneath.
function injuryWire(players) {
  const out = [];
  for (const p of players) {
    const a = toAbbr(teamOfPlayer(p) || p.teamName || "");
    const inj = injFor(p.name, a);
    const e = inj && inj.espn_id ? INJ_ESPN[String(inj.espn_id)] : null;
    let status = (e && e.status && !/^(active|inactive)$/i.test(e.status)) ? e.status
      : (inj && inj.injury_status) || (inj && /injured reserve/i.test(String(inj.status || "")) ? "IR" : "") || "";
    const rawWhen = (e && e.date) || (inj && inj.injury_start_date) || null;
    const when = rawWhen ? new Date(rawWhen) : null;
    const ageDays = when && !isNaN(when) ? (Date.now() - when.getTime()) / 864e5 : null;
    const cm = String((e && e.comment) || "");
    // Reserve moves are news for a week; a player who's been sitting on IR
    // since September is not. Activations off IR count as news too.
    if (/activated|designated to return|return(ed)? from (the )?(injured )?reserve/i.test(cm) && (ageDays == null || ageDays <= 7)) status = "ACTIVATED";
    else if (/^(ir|injured reserve|pup|nfi)$/i.test(status)) { if (ageDays == null || ageDays > 10) continue; status = "PLACED ON " + String(status).toUpperCase(); }
    if (!status) continue;
    const d = injuryDetail(p, a);
    const note = (e && e.comment && !/^\s*(inactive|active|out|questionable|doubtful|probable)\.?\s*$/i.test(e.comment)) ? e.comment : "";
    out.push({ p, a, status: String(status).toUpperCase(), injury: d ? d.label : (p.injuryNotes ? injCase(p.injuryNotes) : ""), note, ret: fmtReturn(p.estReturn || (e && e.returnDate) || null), when: when && !isNaN(when) ? when : null });
  }
  return out.sort((x, y) => (y.when ? y.when.getTime() : 0) - (x.when ? x.when.getTime() : 0));
}
// Ticker items are built per game: before kickoff a "NOTES" item for each
// team (its injury designations), during the game a live score, after it the
// final. The whole week's slate cycles.
function tickerItems(games, wire) {
  const posOf = (p) => String(p.pos || "").toUpperCase();
  const byTeam = {};
  for (const w of wire) (byTeam[w.a] ??= []).push(w);
  const notes = (abbr) => (byTeam[abbr] || []).filter((w) => /out|placed|activated|doubt|quest|sus/i.test(w.status))
    .map((w) => `${posOf(w.p)} ${w.p.name}${w.injury ? " (" + w.injury + ")" : ""} ${w.status}`);
  const out = [];
  for (const g of games) {
    const base = { g, away: g.away, home: g.home };
    if (g.state === "pre") {
      for (const t of [g.away, g.home]) {
        const n = notes(t.abbr);
        out.push({ ...base, kind: "notes", team: t, head: `${(HELMET_NICK[t.abbr] || t.abbr)} NOTES`, text: n.length ? n.join(",  ") : "No injury designations reported.", items: (byTeam[t.abbr] || []) });
      }
    } else if (g.state === "in") {
      out.push({ ...base, kind: "live", head: `LIVE · ${g.away.abbr} ${g.away.score ?? 0}, ${g.home.abbr} ${g.home.score ?? 0}`, text: [g.detail, g.downDistance, g.spot ? "ball on " + g.spot : "", g.redZone ? "RED ZONE" : ""].filter(Boolean).join(" · ") });
    } else {
      const w = (g.away.score ?? 0) >= (g.home.score ?? 0) ? g.away : g.home, l = w === g.away ? g.home : g.away;
      out.push({ ...base, kind: "final", head: `FINAL · ${(HELMET_NICK[w.abbr] || w.abbr)} ${w.score}, ${(HELMET_NICK[l.abbr] || l.abbr)} ${l.score}`, text: `${w.name} ${w.record ? "move to " + w.record : "win"}${l.record ? "; " + l.short + " fall to " + l.record : ""}.` });
    }
  }
  return out;
}
function NewsTicker({ players, onSelect, games, week }) {
  const wire = useMemo(() => injuryWire(players), [players]);
  const items = useMemo(() => tickerItems(games || [], wire), [games, wire]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  if (!items.length) return null;
  const it = items[i % items.length];
  const tone = it.kind === "live" ? "bg-rose-600" : it.kind === "final" ? "bg-slate-500" : "bg-blue-600";
  const scrolling = it.text.length > 44;
  // One full pass of the scrolling line, plus a beat, before the next item.
  const marqueeSec = Math.max(10, it.text.length / 5);
  const dwellMs = (scrolling ? marqueeSec + 1.5 : 6) * 1000;
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((n) => (n + 1) % items.length), dwellMs);
    return () => clearTimeout(t);
  }, [i, items.length, paused, dwellMs]);
  const tileLogo = (t) => { const bg = t.color || teamColorSafe(t.abbr); return (lumOf(bg) < 0.5 ? darkLogo(t.abbr) : null) || t.logo || TEAM_LOGOS[t.abbr]; };
  const onTap = () => {
    if (it.kind !== "notes") return;
    const first = it.items.find((w) => /out|placed|activated|doubt|quest|sus/i.test(w.status));
    if (first) onSelect(first.p);
  };
  return (
    <div className="fixed inset-x-0 z-20 bg-[#0b0d12] border-t border-slate-800 text-white select-none" style={{ bottom: "calc(env(safe-area-inset-bottom) + 3.75rem)" }}
      onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}>
      <div className="flex items-stretch h-12">
        {/* WEEK block, bottom-left like the broadcast bar */}
        <div className="shrink-0 w-14 flex items-center justify-center bg-[#15181f] border-r border-slate-800">
          <span className="text-[9px] font-extrabold tracking-widest text-slate-300">WEEK {week || ""}</span>
        </div>
        {/* the two teams in this game, home side darker-tinted */}
        {[it.away, it.home].map((t, k) => (
          <span key={k} className="shrink-0 w-14 flex items-center justify-center" style={{ backgroundColor: t.color || teamColorSafe(t.abbr) }}>
            <img src={tileLogo(t)} alt="" className="w-10 h-10 object-contain drop-shadow" onError={(e) => { const f = t.logo || TEAM_LOGOS[t.abbr]; if (f && e.currentTarget.src !== f) e.currentTarget.src = f; }} />
          </span>
        ))}
        <button onClick={onTap} className="min-w-0 flex-1 flex flex-col justify-center pl-2.5 pr-2 text-left">
          <span key={"h" + i} className="block text-[10px] font-black tracking-widest uppercase truncate" style={{ animation: "hrbFadeIn .4s ease-out" }}>
            {it.kind === "live" && <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 align-middle" style={{ animation: "hrbBlink 1.2s infinite" }} />}{it.head}
          </span>
          <span className="block overflow-hidden whitespace-nowrap text-[11px] text-slate-200">
            <span key={"d" + i} className="inline-block" style={scrolling ? { animation: `hrbMarquee ${marqueeSec}s linear 1 forwards`, paddingLeft: "100%" } : undefined}>{it.text}</span>
          </span>
        </button>
        <span className={"w-1 shrink-0 " + tone} />
      </div>
      <style>{`@keyframes hrbMarquee { 0% { transform: translateX(0) } 100% { transform: translateX(-100%) } } @keyframes hrbFadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } } @keyframes hrbBlink { 0%,100% { opacity: 1 } 50% { opacity: .2 } }`}</style>
    </div>
  );
}
// Roster moves (signed, waived, practice squad, IR/PUP) for every team, from
// /api/injuries?tx=1. One fetch per session, refreshed after 15 minutes.
const MOVES_CACHE = { at: 0, data: null, wait: null };
function useMoves(on) {
  const [d, setD] = useState(MOVES_CACHE.data);
  useEffect(() => {
    if (!on) return;
    if (MOVES_CACHE.data && Date.now() - MOVES_CACHE.at < 9e5) { setD(MOVES_CACHE.data); return; }
    let alive = true;
    (MOVES_CACHE.wait ??= fetch("/api/injuries?tx=1").then((r) => r.json())
      .then((x) => { MOVES_CACHE.wait = null; if (x && x.moves && Object.keys(x.moves).length) { MOVES_CACHE.data = x; MOVES_CACHE.at = Date.now(); return x; } return { moves: {}, error: (x && x.error) || "no moves returned" }; })
      .catch((e) => { MOVES_CACHE.wait = null; return { moves: {}, error: String(e.message || e) }; }))
      .then((x) => { if (alive) setD(x); });
    return () => { alive = false; };
  }, [on]);
  return d;
}
// One short tag for a transaction line, and whether it's good or bad news.
function moveTag(text) {
  const t = String(text || "");
  if (/injured reserve|reserve\/injured|\bIR\b/i.test(t) && /activated|designated (to|for) return|return(ed)? from/i.test(t)) return ["ACTIVATED", "good"];
  if (/injured reserve|reserve\/injured/i.test(t)) return ["IR", "bad"];
  if (/physically unable|\bPUP\b/i.test(t)) return ["PUP", "bad"];
  if (/non-football|\bNFI\b/i.test(t)) return ["NFI", "bad"];
  if (/suspend/i.test(t)) return ["SUSPENDED", "bad"];
  if (/\btraded?\b|acquired/i.test(t)) return ["TRADE", "info"];
  if (/waived|released|terminated|\bcut\b/i.test(t)) return [/practice squad/i.test(t) ? "PS RELEASED" : /waived/i.test(t) ? "WAIVED" : "RELEASED", "bad"];
  if (/elevated|promoted|from (the )?practice squad/i.test(t)) return ["PS CALL-UP", "good"];
  if (/practice squad/i.test(t)) return ["PRACTICE SQUAD", "info"];
  if (/activated/i.test(t)) return ["ACTIVATED", "good"];
  if (/claimed/i.test(t)) return ["CLAIMED", "good"];
  if (/signed|re-signed|extension/i.test(t)) return ["SIGNED", "good"];
  return ["ROSTER MOVE", "info"];
}
function InjuryFeed({ players, onSelect, q, setQ, pills, dark, since, embedded, moves, movesState, abbr }) {
  const rows = useMemo(() => {
    const out = [];
    for (const p of players) {
      const a = toAbbr(teamOfPlayer(p) || p.teamName || "");
      const inj = injFor(p.name, a);
      const e = inj && inj.espn_id ? INJ_ESPN[String(inj.espn_id)] : null;
      const d = injuryDetail(p, a);
      // Timestamp: ESPN's last-touched date; else Sleeper's injury start date
      const rawWhen = (e && e.date) || (inj && inj.injury_start_date) || null;
      const when = rawWhen ? new Date(rawWhen) : null;
      const ret = p.estReturn || (e && e.returnDate) || null;
      out.push({
        p, a, when: when && !isNaN(when) ? when : null,
        // one tag: ESPN's designation when it's a real one, else Sleeper's
        status: (e && e.status && !/^(active|inactive)$/i.test(e.status)) ? e.status
          : (inj && inj.injury_status) || (inj && /injured reserve/i.test(String(inj.status || "")) ? "IR" : "") || "",
        injury: d ? d.label : (p.injuryNotes ? injCase(p.injuryNotes) : ""),
        note: (e && e.comment && !/^\s*(inactive|active|out|questionable|doubtful|probable)\.?\s*$/i.test(e.comment)) ? e.comment : "",
        ret: fmtReturn(ret),
      });
    }
    // A team page passes its whole roster: keep only players with something to
    // report, then fold the roster moves into the same dated list.
    const list = embedded ? out.filter((r) => r.status || r.injury) : out;
    for (const [i, m] of (moves || []).entries()) {
      const when = new Date(m.date);
      list.push({ move: true, id: "mv" + i, a: abbr, when: isNaN(when) ? null : when, text: m.text, tag: moveTag(m.text) });
    }
    return list.sort((x, y) => (y.when ? y.when.getTime() : 0) - (x.when ? x.when.getTime() : 0));
  }, [players, moves, embedded, abbr]);
  const fmtDay = (d) => d.toLocaleDateString([], { month: "short", day: "numeric" });
  const fmtTime = (d) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const statusCls = (st) => /out|ir|injured reserve|pup|nfi|sus|doubt/i.test(st) ? "bg-rose-600 text-white" : /quest/i.test(st) ? "bg-amber-400 text-slate-900" : "bg-slate-500 text-white";
  // group by day so the feed reads like a log
  const groups = [];
  for (const r of rows) {
    const key = r.when ? fmtDay(r.when) : "Undated";
    const g = groups[groups.length - 1];
    if (g && g.key === key) g.rows.push(r); else groups.push({ key, rows: [r] });
  }
  return (
    <div>
      {!embedded && <ListHeader title={<>Injury Report <span className="text-[10px] font-bold text-white/50 align-middle">{NFL_VERSION}</span></>} q={q} setQ={setQ} pills={pills} />}
      <div className={embedded ? "mt-3 space-y-4" : "px-4 pb-28 mt-4 space-y-4"}>
        <div className={"text-[10px] font-semibold px-1 " + (INJ_META.error || !INJ_META.count ? "text-rose-500" : "text-slate-400")}>
          {INJ_META.error ? "ESPN injury feed error: " + INJ_META.error
            : INJ_META.count ? `ESPN feed · ${INJ_META.count} records${INJ_META.at ? " · " + INJ_META.at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""} · newest update first`
            : INJ_META.at ? "ESPN injury feed returned no records — dates and return dates come from it" : "Loading ESPN injury feed…"}
        </div>
        {embedded && movesState && movesState !== "ok" && <div className={"text-[10px] font-semibold px-1 " + (movesState === "error" ? "text-rose-500" : "text-slate-400")}>{movesState === "error" ? "Roster moves feed returned nothing — showing injuries only." : "Loading roster moves…"}</div>}
        {rows.length === 0 && <div className="text-center text-sm text-slate-400 py-12 px-6">{embedded ? "No injury or roster updates right now." : "No injuries reported right now."}</div>}
        {groups.map((g) => (
          <div key={g.key}>
            <div className="text-[10px] font-extrabold tracking-widest uppercase text-slate-400 mb-1.5 px-1">{g.key}</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {g.rows.map((r) => r.move ? (
                <div key={r.id} className="pr-3 pl-3 py-2.5" style={{ borderLeft: `3px solid ${teamInk(r.a, dark)}${dark ? "66" : "33"}` }}>
                  <div className="flex items-start gap-2.5">
                    <span className={"mt-0.5 shrink-0 text-[9px] font-extrabold uppercase rounded-full px-2 py-0.5 " + (r.tag[1] === "good" ? "bg-emerald-600 text-white" : r.tag[1] === "bad" ? "bg-rose-600 text-white" : "bg-slate-500 text-white")}>{r.tag[0]}</span>
                    <span className="flex-1 min-w-0 text-[12px] leading-snug font-semibold text-slate-800 dark:text-slate-100">{r.text}</span>
                  </div>
                </div>
              ) : (
                <button key={r.p.id} onClick={() => onSelect(r.p)} className="w-full text-left pr-3 pl-3 py-2.5 active:bg-slate-50 dark:active:bg-slate-800"
                  style={{ borderLeft: `3px solid ${teamInk(r.a, dark)}${dark ? "66" : "33"}` }}>
                  <div className="flex items-start gap-2.5">
                    {/* number chip and photo share the top row, both beside the name */}
                    <span className="w-9 mt-2 text-center text-[10px] font-extrabold uppercase shrink-0 rounded-md py-1 text-white tabular-nums" style={{ backgroundColor: r.a ? teamInk(r.a, dark) : "#64748b" }}>{cleanNo(r.p.no) ? "#" + cleanNo(r.p.no) : "—"}</span>
                    <div className="shrink-0"><Avatar p={r.p} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          <span className="font-extrabold mr-1.5 text-slate-400">{r.p.pos || "—"}</span>{r.p.name}
                        </span>
                        {r.a && <img src={TEAM_LOGOS[r.a]} alt="" className="w-7 h-7 object-contain shrink-0" />}
                      </div>
                      {(r.status || r.when) && (
                        <div className="mt-1 flex items-center justify-between gap-2">
                          {r.status ? <span className={"inline-block text-[9px] font-extrabold uppercase rounded-full px-2 py-0.5 " + statusCls(r.status)}>{r.status}</span> : <span />}
                          <span className="inline-flex items-center gap-1.5 shrink-0">{since && r.when && r.when.getTime() > since && <span className="text-[9px] font-black tracking-wider text-white bg-rose-600 rounded px-1.5 py-0.5">NEW</span>}<span className="text-[10px] font-bold text-slate-400 tabular-nums">{r.when ? fmtTime(r.when) : ""}</span></span>
                        </div>
                      )}
                      {r.injury && <div className="mt-0.5 text-[11px] font-semibold text-rose-500 truncate">({r.injury})</div>}
                      {r.ret && <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">Estimated Return Date: {r.ret}</div>}
                      {r.note && <div className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{r.note}</div>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════ TAB: DRAFT ══════════════════════════════════════
// Draft classes from the Airtable fields (Draft Year + "Round 1, Pick 12 (DET)").
function DraftTab({ players, onSelect, pills }) {
  const [q, setQ] = useSticky("DraftTab.q", "");
  const dark = useDark();
  const parsed = useMemo(() => players
    .filter((p) => p.draftYear)
    .map((p) => {
      const m = String(p.draft || "").match(/round\s*(\d+)[^\d]*pick\s*(\d+)/i);
      const team = String(p.draft || "").match(/\(([A-Z]{2,4})\)/);
      return { p, year: Number(p.draftYear), round: m ? Number(m[1]) : 99, pick: m ? Number(m[2]) : 999, by: team ? team[1] : null };
    }), [players]);
  const years = useMemo(() => [...new Set(parsed.map((x) => x.year))].sort((a, b) => b - a), [parsed]);
  const [year, setYear] = useSticky("DraftTab.year", null);
  const yr = year || years[0] || null;
  const list = useMemo(() => parsed
    .filter((x) => x.year === yr && matchesQuery(x.p, q))
    .sort((a, b) => a.round - b.round || a.pick - b.pick || String(a.p.name).localeCompare(String(b.p.name))), [parsed, yr, q]);
  const rounds = [];
  for (const x of list) { const g = rounds[rounds.length - 1]; if (g && g.round === x.round) g.rows.push(x); else rounds.push({ round: x.round, rows: [x] }); }
  return (
    <div>
      <ListHeader title={<>Draft <span className="text-[10px] font-bold text-white/50 align-middle">{NFL_VERSION}</span></>} q={q} setQ={setQ} pills={pills} />
      <div className="px-4 pb-28 mt-4">
        {years.length === 0 && <div className="text-center text-sm text-slate-400 py-12 px-6">No draft data yet — fill Draft Year and Draft on the Players table in Airtable.</div>}
        {years.length > 0 && (
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-extrabold tracking-widest uppercase text-slate-400">Draft class</div>
            <label className="relative inline-flex items-center">
              <select value={yr || ""} onChange={(e) => setYear(Number(e.target.value))}
                className="appearance-none bg-blue-600 text-white text-[13px] font-extrabold rounded-full pl-4 pr-9 py-1.5 shadow-sm focus:outline-none">
                {years.map((y) => <option key={y} value={y}>{y} class</option>)}
              </select>
              <span className="pointer-events-none absolute right-3 text-white text-[10px]">▼</span>
            </label>
          </div>
        )}
        <div className="space-y-4">
          {rounds.map((g) => (
            <div key={g.round}>
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <span className="text-[10px] font-extrabold tracking-widest uppercase text-slate-400">{g.round === 99 ? "Round unknown" : "Round " + g.round}</span>
                <span className="text-[9px] font-bold text-slate-400">· {g.rows.length} {g.rows.length === 1 ? "player" : "players"}</span>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {g.rows.map(({ p, pick, by }) => {
                  const a = toAbbr(teamOfPlayer(p) || p.teamName || "");
                  const c = a ? teamInk(a, dark) : "#64748b";
                  return (
                    <button key={p.id} onClick={() => onSelect(p)} className="w-full flex items-center gap-3 pr-3 pl-3 py-2.5 text-left active:bg-slate-50 dark:active:bg-slate-800"
                      style={{ borderLeft: `3px solid ${c}${dark ? "66" : "33"}` }}>
                      <span className="w-9 h-9 rounded-xl flex flex-col items-center justify-center shrink-0 text-white" style={{ backgroundColor: c }}>
                        <span className="text-[6px] font-bold uppercase tracking-wider leading-none opacity-80">pick</span>
                        <span className="text-[14px] font-black tabular-nums leading-none mt-0.5">{pick === 999 ? "—" : pick}</span>
                      </span>
                      <Avatar p={p} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                        <span className="flex items-center gap-1.5 mt-0.5 min-w-0">
                          <span className="text-[9px] font-extrabold uppercase rounded px-1.5 py-0.5 text-white shrink-0" style={{ backgroundColor: c }}>{p.pos || "—"}</span>
                          <span className="text-[11px] text-slate-400 font-medium truncate">{[p.college, by && by !== a ? "drafted by " + by : null].filter(Boolean).join(" · ")}</span>
                        </span>
                      </span>
                      {a && <img src={TEAM_LOGOS[a]} alt="" className="w-11 h-11 object-contain shrink-0 drop-shadow" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {years.length > 0 && list.length === 0 && <div className="text-center text-sm text-slate-400 py-12">No players match "{q}".</div>}
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
    n >= 90 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"        // superstar
    : n >= 85 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" // great
    : n >= 70 ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"          // solid
    : "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300";                    // liability
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
    if (String(c.status).toLowerCase() === "expired") continue; // blank status still counts
    for (const y of c.years || []) {
      if (startYear(y.season) != null && startYear(y.season) < startYear(CURRENT_SEASON)) continue;
      const t = String(y.type || "").toUpperCase();
      let kind = null;
      if ((t === "PO" || t === "TO") && !y.decision) kind = t;
      else if (t === "UFA" || t === "RFA") kind = t;
      if (!kind) continue;
      if (!best || String(y.season) < String(best.season)) best = { kind, season: y.season };
    }
  }
  if (!best) return null;
  return { ...best, label: best.kind + " " + String(best.season).slice(0, 4) };
}

const EVENT_WORDS = { PO: "Player Option", TO: "Team Option", UFA: "Free Agent", RFA: "Restricted FA" };
const EVENT_COLORS = {
  PO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  TO: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300",
  UFA: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  RFA: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
};

function EventPill({ ev }) {
  if (!ev) return null;
  const cls = EVENT_COLORS[ev.kind] || EVENT_COLORS.UFA;
  return (
    <span className={"inline-flex shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide " + cls}>
      {EVENT_WORDS[ev.kind] || ev.kind} {seasonTick({ season: ev.season })}
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
  const [q, setQ] = useSticky("ContractsTab.q", "");
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
                    {act ? displayLine(act) : "No contract"}
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

const ROLE_ORDER = ["Offense", "Offensive Line", "Defense", "Defensive Line", "Special Teams"];
// Position -> unit. Position wins over the Role field so an OT always rolls
// up to Offensive Line; Role is the fallback for unknown positions.
const POS_UNIT = {};
for (const p of ["QB", "RB", "FB", "HB", "WR", "TE"]) POS_UNIT[p] = "Offense";
for (const p of ["LT", "LG", "C", "RG", "RT", "OT", "OG", "G", "OL"]) POS_UNIT[p] = "Offensive Line";
for (const p of ["DE", "DT", "NT", "EDGE", "DL"]) POS_UNIT[p] = "Defensive Line";
for (const p of ["LB", "ILB", "OLB", "MLB", "CB", "S", "FS", "SS", "DB"]) POS_UNIT[p] = "Defense";
for (const p of ["K", "P", "LS", "KR", "PR"]) POS_UNIT[p] = "Special Teams";
function unitOf(p) {
  const pos = String(p.pos || "").toUpperCase().trim();
  if (POS_UNIT[pos]) return POS_UNIT[pos];
  if (ROLE_ORDER.includes(p.role)) return p.role;
  return "Roster";
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

// NFL playoff picture from the standings: per conference, the 4 division
// winners seeded 1–4 by record, then 3 wild cards. Ties broken by point
// differential (the real tiebreakers need head-to-head and common-games
// results we don't carry).
const NFL_DIVISION = {
  BUF: "AFC East", MIA: "AFC East", NE: "AFC East", NYJ: "AFC East", BAL: "AFC North", CIN: "AFC North", CLE: "AFC North", PIT: "AFC North",
  HOU: "AFC South", IND: "AFC South", JAX: "AFC South", TEN: "AFC South", DEN: "AFC West", KC: "AFC West", LV: "AFC West", LAC: "AFC West",
  DAL: "NFC East", NYG: "NFC East", PHI: "NFC East", WSH: "NFC East", WAS: "NFC East", CHI: "NFC North", DET: "NFC North", GB: "NFC North", MIN: "NFC North",
  ATL: "NFC South", CAR: "NFC South", NO: "NFC South", TB: "NFC South", ARI: "NFC West", LAR: "NFC West", SF: "NFC West", SEA: "NFC West",
};
const divisionOf = (t) => t.division || NFL_DIVISION[String(t.abbr || toAbbr(t.name)).toUpperCase()] || null;
function seedPlayoffs(teams) {
  const confOf = (t) => { const c = String(t.conference || divisionOf(t) || "").toLowerCase(); return c.startsWith("afc") ? "afc" : c.startsWith("nfc") ? "nfc" : null; };
  const diff = (t) => (t.pf != null && t.pa != null ? t.pf - t.pa : 0);
  const cmp = (a, b) => winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0) || diff(b) - diff(a) || String(a.name).localeCompare(String(b.name));
  const out = { afc: [], nfc: [] };
  for (const c of ["afc", "nfc"]) {
    const mine = teams.filter((t) => confOf(t) === c);
    const byDiv = {};
    for (const t of mine) (byDiv[divisionOf(t) || "?"] ??= []).push(t);
    const leaders = [], rest = [];
    for (const arr of Object.values(byDiv)) { arr.sort(cmp); if (arr.length) leaders.push(arr[0]); rest.push(...arr.slice(1)); }
    leaders.sort(cmp); rest.sort(cmp);
    out[c] = [...leaders.map((t) => ({ t, divLeader: true })), ...rest.map((t) => ({ t, divLeader: false }))];
  }
  return out;
}
function winPct(t) {
  const w = t.wins ?? 0, l = t.losses ?? 0;
  return w + l > 0 ? w / (w + l) : -1;
}

function TeamsTab({ teams, players, onSelect }) {
  const [q, setQ] = useState("");
  const [conf, setConf] = useSticky("teams.conf", "all"); // all | afc | nfc | standings | playoffs
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
    const c = String(t.conference || divisionOf(t) || "").toLowerCase();
    return c.startsWith("afc") ? "afc" : c.startsWith("nfc") ? "nfc" : "other";
  };
  // Divisional rank across ALL teams (unaffected by search/filters)
  const divRank = {};
  {
    const byDiv = {};
    for (const t of teams) { const dv = divisionOf(t); if (dv) (byDiv[dv] ??= []).push(t); }
    for (const arr of Object.values(byDiv)) {
      arr.sort((a, b) => winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0));
      arr.forEach((t, i) => { divRank[t.id] = ORDINALS[i] || `${i + 1}th`; });
    }
  }
  const divisions = conf === "all" ? [] :
    [...new Set(teams.filter((t) => confOf(t) === conf).map((t) => t.division).filter(Boolean))].sort();
  let list = teams.filter((t) => {
    if (conf === "standings" || conf === "playoffs") return false;
    if (conf !== "all" && confOf(t) !== conf) return false;
    if (div && t.division !== div) return false;
    if (!s) return true;
    if ((t.name + " " + t.abbr).toLowerCase().includes(s)) return true;
    const abbr = t.abbr || toAbbr(t.name);
    return playerTeamAbbrs.has(abbr);
  });
  list = [...list].sort((a, b) =>
    conf === "all"
      ? String(a.name).localeCompare(String(b.name))
      : winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0)
  );
  const pickConf = (k) => { setConf(k); setDiv(null); };
  const dark = useDark();
  const seeded = useMemo(() => seedPlayoffs(teams), [teams]);
  const confTitle = { afc: "AFC", nfc: "NFC" };
  return (
    <div>
      <div className="px-4 pb-28" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex gap-2 mt-1">
          {[["all", "Teams"], ["afc", "AFC"], ["nfc", "NFC"], ["standings", "Standings"], ["playoffs", "Playoffs"]].map(([k, lbl]) => (
            <button key={k} onClick={() => pickConf(k)}
              className={"flex-1 py-2 rounded-full text-[11px] font-bold transition-colors " + (conf === k
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
              {lbl}
            </button>
          ))}
        </div>
        {conf === "standings" && (
          <div className="mt-4 space-y-4">
            {["afc", "nfc"].map((c) => {
              const rows = seeded[c] || [];
              return (
                <div key={c} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-[12px] font-extrabold tracking-widest uppercase text-slate-900 dark:text-white">{confTitle[c]}</span>
                    <span className="text-[10px] font-semibold text-slate-400">1–7 make the playoffs · 1 seed gets the bye</span>
                  </div>
                  <div className="grid grid-cols-[1.5rem_1fr_3rem_2.75rem_2.5rem_2.5rem_2.75rem] gap-1 px-3 py-1 text-[8px] font-extrabold tracking-widest uppercase text-slate-400 border-t border-slate-100 dark:border-slate-800">
                    <span>#</span><span>Team</span><span className="text-center">W-L</span><span className="text-center">Pct</span><span className="text-center">PF</span><span className="text-center">PA</span><span className="text-center">Diff</span>
                  </div>
                  {rows.map((r, i) => {
                    const t = r.t, d = (t.pf != null && t.pa != null) ? t.pf - t.pa : null;
                    return (
                      <React.Fragment key={t.id}>
                        {i === 7 && <div className="h-[2px] bg-emerald-500/80" />}
                        <button onClick={() => onSelect(t)} className="w-full grid grid-cols-[1.5rem_1fr_3rem_2.75rem_2.5rem_2.5rem_2.75rem] gap-1 items-center px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-left active:bg-slate-50 dark:active:bg-slate-800">
                          <span className={"text-[11px] font-black tabular-nums " + (i < 7 ? "text-slate-900 dark:text-white" : "text-slate-400")}>{i + 1}</span>
                          <span className="flex items-center gap-1.5 min-w-0">
                            <img src={t.logo || TEAM_LOGOS[t.abbr || toAbbr(t.name)]} alt="" className="w-6 h-6 object-contain shrink-0" />
                            <span className="text-[12px] font-black text-slate-900 dark:text-white truncate">{t.abbr || toAbbr(t.name)}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">{String(divisionOf(t) || "").replace(/^(AFC|NFC)\s*/i, "").slice(0, 1)}</span>
                            {r.divLeader && <span className="text-amber-400 text-[10px]">★</span>}
                          </span>
                          <span className="text-center text-[11px] font-black tabular-nums text-slate-900 dark:text-white">{t.wins ?? 0}-{t.losses ?? 0}{t.ties ? "-" + t.ties : ""}</span>
                          <span className="text-center text-[10px] font-bold tabular-nums text-slate-500 dark:text-slate-400">{winPct(t).toFixed(3).replace(/^0/, "")}</span>
                          <span className="text-center text-[10px] font-bold tabular-nums text-slate-500 dark:text-slate-400">{t.pf ?? "—"}</span>
                          <span className="text-center text-[10px] font-bold tabular-nums text-slate-500 dark:text-slate-400">{t.pa ?? "—"}</span>
                          <span className={"text-center text-[10px] font-black tabular-nums " + (d == null ? "text-slate-400" : d > 0 ? "text-emerald-600 dark:text-emerald-400" : d < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500")}>{d == null ? "—" : (d > 0 ? "+" : "") + d}</span>
                        </button>
                      </React.Fragment>
                    );
                  })}
                  <div className="px-3 py-2 text-[9px] text-slate-400 border-t border-slate-100 dark:border-slate-800">★ division leader · seeds 1–4 are division winners by record, 5–7 wild cards · ties broken by point differential (the NFL's full tiebreakers need head-to-head results)</div>
                </div>
              );
            })}
          </div>
        )}
        {conf === "playoffs" && (
          <div className="mt-4 space-y-5">
            <div className="text-[10px] font-semibold text-slate-400 px-1">Seeding if the season ended today. Wild Card round: 7 @ 2, 6 @ 3, 5 @ 4 · the 1 seed rests.</div>
            {["afc", "nfc"].map((c) => {
              const rows = (seeded[c] || []).slice(0, 7);
              const at = (n) => rows[n - 1];
              const Card = ({ t, seed }) => t ? (
                <button onClick={() => onSelect(t)} className="flex items-center gap-1.5 px-2 py-1.5 text-left w-full">
                  <img src={t.logo || TEAM_LOGOS[t.abbr || toAbbr(t.name)]} alt="" className="w-5 h-5 object-contain shrink-0" />
                  <span className="text-[9px] font-bold text-slate-400 w-3">{seed}</span>
                  <span className="text-[11px] font-black text-slate-900 dark:text-white truncate">{t.abbr || toAbbr(t.name)}</span>
                  <span className="text-[9px] font-bold text-slate-400 tabular-nums ml-auto">{t.wins ?? 0}-{t.losses ?? 0}{t.ties ? "-" + t.ties : ""}</span>
                </button>
              ) : <div className="flex items-center gap-1.5 px-2 py-1.5"><span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" /><span className="text-[11px] font-black text-slate-400">TBD</span></div>;
              const Box = ({ children }) => <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">{children}</div>;
              return (
                <div key={c}>
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <span className="text-[12px] font-extrabold tracking-widest uppercase text-slate-900 dark:text-white">{confTitle[c]}</span>
                    <span className="text-[9px] font-semibold text-slate-400">Wild Card · Divisional · Championship</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <div className="space-y-2">
                      <Box><Card t={at(7)} seed={7} /><Card t={at(2)} seed={2} /></Box>
                      <Box><Card t={at(6)} seed={6} /><Card t={at(3)} seed={3} /></Box>
                      <Box><Card t={at(5)} seed={5} /><Card t={at(4)} seed={4} /></Box>
                    </div>
                    <div className="space-y-2">
                      <Box><Card t={at(1)} seed={1} /><Card t={null} /></Box>
                      <Box><Card t={null} /><Card t={null} /></Box>
                    </div>
                    <div><Box><Card t={null} /><Card t={null} /></Box></div>
                  </div>
                </div>
              );
            })}
            <div className="mx-auto max-w-xs rounded-2xl border-2 border-amber-400 bg-white dark:bg-slate-900 px-4 py-3 text-center">
              <div className="text-[9px] font-extrabold tracking-widest uppercase text-amber-500">Super Bowl</div>
              <div className="text-[12px] font-bold text-slate-500 dark:text-slate-300">AFC champ · NFC champ</div>
            </div>
          </div>
        )}
        {conf !== "standings" && conf !== "playoffs" && divisions.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
            {divisions.map((d) => (
              <button key={d} onClick={() => setDiv(div === d ? null : d)}
                className={"px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors " + (div === d
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
                {d}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-2 mt-4">
          {list.map((t) => {
            const abbr = t.abbr || toAbbr(t.name);
            const bg = teamColor(abbr);
            // light shells (Chargers powder, Packers gold) need dark type
            const ink = lumOf(bg) > 0.62 ? "#0f172a" : "#ffffff";
            const sub = lumOf(bg) > 0.62 ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.72)";
            return (
              <button key={t.id} onClick={() => onSelect(t)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-2xl shadow-sm active:opacity-90 transition-opacity"
                style={{ background: `linear-gradient(100deg, ${bg} 0%, ${bg} 62%, ${shade(bg, -14)} 100%)`, color: ink }}>
                {t.logo ? (
                  <img src={darkLogo(abbr) || t.logo || TEAM_LOGOS[abbr]} alt="" className="w-[52px] h-[52px] object-contain shrink-0 drop-shadow-md" />
                ) : (
                  <span className="w-11 h-11 rounded-full shrink-0 bg-white/90" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-extrabold truncate">{t.name}</span>
                  <span className="block text-[11px] font-semibold truncate" style={{ color: sub }}>
                    {t.division ? (divRank[t.id] ? `${divRank[t.id]} in ${t.division}` : t.division) : "—"}
                  </span>
                </span>
                {(() => { const r = teamRec(t, seasonStarted(teams)); return (r.w + r.l + r.t) >= 0; })() && (
                  <span className="flex gap-2.5 shrink-0">
                    {(() => { const r = teamRec(t, seasonStarted(teams)); return [["W", r.w], ["L", r.l], ...(r.t > 0 ? [["T", r.t]] : [])]; })().map(([lbl, v]) => (
                      <span key={lbl} className="w-7 text-center">
                        <span className="block text-[8px] font-bold uppercase" style={{ color: sub }}>{lbl}</span>
                        <span className="block text-sm font-black tabular-nums">{v}</span>
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
  if (s === "ir" || s.includes("injured reserve") || s.includes("out")) cls = "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300";
  else if (s.includes("active") || s.includes("available")) cls = "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300";
  else if (s.includes("injur") || s.includes("day") || s.includes("question") || s.includes("doubt")) cls = "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
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

// League-wide OL/DL rankings from Madden OVRs: average of the top-5 offensive
// linemen and top-4 defensive linemen per team (typical starting fronts).
// Needs 3+ rated players to count — thin data shouldn't produce a fake rank.
const OL_POS = new Set(["LT", "LG", "C", "RG", "RT", "OT", "OG", "G", "T", "OC", "OL"]);
const DL_POS = new Set(["DE", "DT", "NT", "EDGE", "DL", "LDE", "RDE", "LDT", "RDT"]);
const DEF_POS = new Set([...DL_POS, "LB", "ILB", "OLB", "MLB", "LOLB", "ROLB", "LLB", "RLB", "WLB", "SLB", "CB", "LCB", "RCB", "NB", "NCB", "SLOT", "DB", "S", "FS", "SS"]);
function computeLineRanks(players, teams) {
  // A player counts toward a line by Position OR by depth label — so an
  // "LDE1" whose Position field says LB still counts as a defensive lineman.
  const baseLabel = (p) => {
    const m = String(p.sortLabel || "").toUpperCase().match(/^([A-Z]+)/);
    return m ? m[1] : null;
  };
  const per = {};
  for (const t of teams || []) {
    const a = t.abbr || toAbbr(t.name);
    if (!a) continue;
    // IDENTICAL matching to TeamDetail's roster — including the full
    // team-name fallback. Without it, teams whose players only match by
    // name (e.g. Buffalo) render a formation but compute no line rank.
    const roster = players.filter((p) => {
      if (p.teamId && p.teamId === t.id) return true;
      const tm = teamOfPlayer(p);
      return tm && (tm === a || String(p.teamName || "").toLowerCase() === String(t.name || "").toLowerCase());
    });
    const avgTop = (posSet, n, min = 3) => {
      // Injury-aware: a starter on IR/OUT doesn't count toward the unit's grade,
      // so a team that loses its 95-OVR corner sees its DEF rank drop.
      const rated = roster
        .filter((p) => (posSet.has(String(p.pos || "").toUpperCase()) || posSet.has(baseLabel(p))) && p.rating2k != null && !injIsOut(injFor(p.name, a)))
        .map((p) => Number(p.rating2k))
        .sort((x, y) => y - x)
        .slice(0, n);
      return rated.length >= min ? rated.reduce((s, v) => s + v, 0) / rated.length : null;
    };
    // def = whole defense: top-11 rated defenders, needs 7+ to count.
    // Scheme-agnostic on purpose — a 3-4 and a 4-3 team compare fairly.
    // Needs 5+ rated healthy defenders (was 7): rookie-heavy units like a
    // team starting several unrated draft picks still get a grade.
    per[a] = { ol: { avg: avgTop(OL_POS, 5) }, dl: { avg: avgTop(DL_POS, 4) }, def: { avg: avgTop(DEF_POS, 11, 5) } };
  }
  for (const key of ["ol", "dl", "def"]) {
    const ranked = Object.entries(per)
      .filter(([, v]) => v[key].avg != null)
      .sort((x, y) => y[1][key].avg - x[1][key].avg);
    ranked.forEach(([a], i) => { per[a][key].rank = i + 1; });
  }
  return per;
}

// ── Team Stats: Leaders (with trend arrows) · Volume (carry/target share bars) · Defense ──
function playerSeasonRow(p, seasonStats) {
  if (!seasonStats || !seasonStats.players) return null;
  const nm = hrbNrmSafe(p.name), abbr = toAbbr(teamOfPlayer(p) || p.teamName || "");
  const c = Object.values(seasonStats.players).filter((q) => hrbNrmSafe(q.name) === nm);
  return (c.length > 1 ? c.find((q) => injTeamEq(q.team, abbr)) || c[0] : c[0]) || null;
}
// ▲ / ▼ / → : last 3 games vs season average for a per-game stat
function TrendArrow({ row, k }) {
  if (!row || !row.games || row.games.length < 2) return null;
  const g = row.games, last = g.slice(-3), avg = row.perGame[k] || 0;
  const recent = last.reduce((a, x) => a + (x[k] || 0), 0) / last.length;
  if (!avg && !recent) return null;
  const r = avg ? recent / avg : 2;
  const up = r >= 1.15, down = r <= 0.85;
  return <span className={"text-[10px] font-extrabold " + (up ? "text-emerald-500" : down ? "text-rose-500" : "text-slate-400")}>{up ? "▲" : down ? "▼" : "→"}</span>;
}
function TeamStatsPanel({ roster, abbr, seasonStats, mode, setMode, onSelectPlayer }) {
  const rows = roster.map((p) => ({ p, s: playerSeasonRow(p, seasonStats) })).filter((x) => x.s && x.s.totals && x.s.totals.gp);
  const yr = seasonStats ? seasonStats.season : "";
  const rz = useRedzone(yr || null);   // end-zone / red-zone targets from play-by-play
  const Bar = ({ label, sub, pct, val, arrow, color, onClick }) => (
    <button onClick={onClick} className="w-full text-left py-1.5">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">{label}{arrow}<span className="text-slate-400 font-medium">{sub}</span></span>
        <span className="font-extrabold tabular-nums text-slate-700 dark:text-slate-200 ml-2 shrink-0">{val}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: Math.max(2, Math.min(100, pct)) + "%", backgroundColor: color }} />
      </div>
    </button>
  );
  const Section = ({ title, children }) => (
    <div className="mt-4">
      <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mb-1.5 px-1">{title}</div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-2 divide-y divide-slate-100 dark:divide-slate-800">{children}</div>
    </div>
  );
  const dark = useDark();
  const color = TEAM_ACCENT[abbr] || teamInk(abbr, dark);   // Steelers bars in gold; dark colours lightened at night
  const sumBy = (k) => rows.reduce((a, x) => a + (x.s.totals[k] || 0), 0);
  const empty = <div className="text-center text-xs text-slate-400 py-10">No {yr} box-score stats for this roster yet.</div>;
  return (
    <>
      <div className="flex gap-2 mt-4">
        {[["leaders", "Leaders"], ["volume", "Volume"], ["defense", "Defense"]].map(([k, lbl]) => (
          <button key={k} onClick={() => setMode(k)}
            className={"flex-1 py-1.5 rounded-full text-[11px] font-bold " + (mode === k ? "text-white" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
            style={mode === k ? { backgroundColor: color } : undefined}>{lbl}</button>
        ))}
      </div>
      {!rows.length ? empty : mode === "leaders" ? (() => {
        const top = (k, n = 5) => rows.filter((x) => (x.s.totals[k] || 0) > 0).sort((a, b) => b.s.totals[k] - a.s.totals[k]).slice(0, n);
        const block = (title, k, unit, pgKey) => {
          const list = top(k); if (!list.length) return null;
          const max = list[0].s.totals[k];
          return (
            <Section key={title} title={title}>
              {list.map(({ p, s }) => <Bar key={p.id} label={p.name} sub={" " + (p.pos || "")} arrow={<TrendArrow row={s} k={pgKey || k} />} pct={(s.totals[k] / max) * 100} val={s.totals[k] + unit} color={color} onClick={() => onSelectPlayer(p)} />)}
            </Section>
          );
        };
        return (
          <>
            {block(yr + " Rushing Yards", "rushYds", " yds", "rushYds")}
            {block(yr + " Receiving Yards", "recYds", " yds", "recYds")}
            {block(yr + " Touchdowns", "td", " TD", "recTd")}
            {block(yr + " Targets", "tgt", "", "tgt")}
            {(() => {
              // targets thrown into the end zone, with red-zone targets alongside
              if (!rz) return null;
              const list = roster.map((p) => { const q = rzFind(rz, p.name, abbr); const t = q ? rzSum(q) : null; return { p, ez: t ? t.ezTgt : 0, rzT: t ? t.rzTgt : 0 }; })
                .filter((x) => x.ez > 0).sort((a, b) => b.ez - a.ez || b.rzT - a.rzT).slice(0, 5);
              if (!list.length) return null;
              return (
                <Section title={yr + " End Zone Targets"}>
                  {list.map(({ p, ez }) => <Bar key={p.id} label={p.name} sub={" " + (p.pos || "")} pct={(ez / list[0].ez) * 100} val={String(ez)} color={color} onClick={() => onSelectPlayer(p)} />)}
                  <div className="text-[9px] text-slate-400 mt-1.5">Passes thrown to him in the end zone.</div>
                </Section>
              );
            })()}
            {block(yr + " Tackles", "tkl", "", "tkl")}
            {block(yr + " Sacks", "sacks", "", "sacks")}
            <div className="text-[9px] text-slate-400 mt-2 px-1">▲ ▼ = last 3 games vs season average (up 15%+ / down 15%+)</div>
          </>
        );
      })() : mode === "volume" ? (() => {
        const carries = sumBy("car"), targets = sumBy("tgt");
        const rush = rows.filter((x) => (x.s.totals.car || 0) > 0).sort((a, b) => b.s.totals.car - a.s.totals.car).slice(0, 8);
        const rec = rows.filter((x) => (x.s.totals.tgt || 0) > 0).sort((a, b) => b.s.totals.tgt - a.s.totals.tgt).slice(0, 10);
        return (
          <>
            <Section title={yr + " Rushing · carry share"}>
              {rush.map(({ p, s }) => <Bar key={p.id} label={p.name} sub={" " + (p.pos || "")} arrow={<TrendArrow row={s} k="car" />} pct={(s.totals.car / Math.max(1, carries)) * 100} val={Math.round((s.totals.car / Math.max(1, carries)) * 100) + "% · " + s.totals.car + " car"} color={color} onClick={() => onSelectPlayer(p)} />)}
            </Section>
            <Section title={yr + " Receiving · target share"}>
              {rec.map(({ p, s }) => <Bar key={p.id} label={p.name} sub={" " + (p.pos || "")} arrow={<TrendArrow row={s} k="tgt" />} pct={(s.totals.tgt / Math.max(1, targets)) * 100} val={Math.round((s.totals.tgt / Math.max(1, targets)) * 100) + "% · " + s.totals.tgt + " tgt"} color={color} onClick={() => onSelectPlayer(p)} />)}
            </Section>
            {(() => {
              // What the team does inside the 20: every red-zone carry and
              // target is one "look"; each player's share of all of them.
              if (!rz) return null;
              let tCar = 0, tTgt = 0;
              for (const q of Object.values(rz.players || {})) if (injTeamEq(q.team, abbr)) { const t = rzSum(q); tCar += t.rzCar; tTgt += t.rzTgt; }
              const total = tCar + tTgt;
              if (!total) return null;
              const list = roster.map((p) => { const q = rzFind(rz, p.name, abbr); const t = q ? rzSum(q) : null; return { p, car: t ? t.rzCar : 0, tgt: t ? t.rzTgt : 0 }; })
                .map((x) => ({ ...x, looks: x.car + x.tgt })).filter((x) => x.looks > 0).sort((a, b) => b.looks - a.looks).slice(0, 8);
              if (!list.length) return null;
              const pct = (x) => Math.round((x / total) * 100);
              return (
                <Section title={yr + " Red Zone Share"}>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Inside the 20: {pct(tCar)}% run · {pct(tTgt)}% pass</div>
                  {list.map((x) => <Bar key={x.p.id} label={x.p.name} sub={" " + (x.p.pos || "")} pct={(x.looks / list[0].looks) * 100}
                    val={pct(x.looks) + "% · " + [x.car ? x.car + " car" : null, x.tgt ? x.tgt + " tgt" : null].filter(Boolean).join(" + ")} color={color} onClick={() => onSelectPlayer(x.p)} />)}
                  <div className="text-[9px] text-slate-400 mt-1.5">Share of the team's red-zone carries and targets. Carries are designed runs; quarterback scrambles aren't counted.</div>
                </Section>
              );
            })()}
          </>
        );
      })() : (() => {
        const block = (title, k, n = 8) => {
          const list = rows.filter((x) => (x.s.totals[k] || 0) > 0).sort((a, b) => b.s.totals[k] - a.s.totals[k]).slice(0, n);
          if (!list.length) return null;
          const max = list[0].s.totals[k];
          return (
            <Section key={title} title={title}>
              {list.map(({ p, s }) => <Bar key={p.id} label={p.name} sub={" " + (p.pos || "")} arrow={<TrendArrow row={s} k={k} />} pct={(s.totals[k] / max) * 100} val={String(s.totals[k])} color={color} onClick={() => onSelectPlayer(p)} />)}
            </Section>
          );
        };
        return (
          <>
            {block(yr + " Tackles", "tkl")}
            {block(yr + " Sacks", "sacks", 6)}
            {block(yr + " Interceptions", "defInt", 6)}
            {block(yr + " Passes Defended", "pd", 6)}
            {block(yr + " Tackles for Loss", "tfl", 6)}
          </>
        );
      })()}
    </>
  );
}

// ═══════════════ TEAM SCHEDULE ═══════════════════════════════════
// Full regular season for one team from /api/scoreboard?team=XXX, plus four
// pills per game grading the opponent from season-to-date box scores:
// their offense (pass / rush yds per game) and their defense (pass / rush
// yds allowed per game). Colour = how hard that matchup is for THIS team:
// red = opponent ranks top 10 (tough), amber = 11-22, green = 23rd+ (soft).
const SCHED_CACHE = {};
function TeamSchedule({ abbr, teams, ink, onTeam, onLoaded }) {
  const [data, setData] = useState(SCHED_CACHE[abbr] || null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (SCHED_CACHE[abbr]) { setData(SCHED_CACHE[abbr]); return; }
    let live = true;
    fetch(`/api/scoreboard?team=${encodeURIComponent(abbr)}`)
      .then((r) => r.json())
      .then((d) => { if (!live) return; if (d && d.games) { SCHED_CACHE[abbr] = d; setData(d); onLoaded && onLoaded(); } else setErr(d && d.error ? d.error : "No schedule"); })
      .catch((e) => live && setErr(String(e.message || e)));
    return () => { live = false; };
  }, [abbr]);
  const fmtDate = (iso, timeValid) => {
    if (!iso) return "TBD";
    const d = new Date(iso);
    const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    return timeValid ? day + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : day + " · TBD";
  };
  if (err) return <div className="text-center text-sm text-slate-400 mt-10">Schedule unavailable right now.</div>;
  if (!data) return <div className="mt-6"><Loader /></div>;
  // Three plain-English chips per game: how good the opponent is (point diff
  // per game), what their offense does, and where their defense is soft/stout.
  const GOOD = "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  const BAD = "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300";
  const MID = "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";
  const NEU = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  const chip = (txt, cls) => <span className={"rounded-md px-1.5 py-[3px] text-[9px] font-extrabold whitespace-nowrap " + cls}>{txt}</span>;
  const matchup = (opp) => {
    const t = teams.find((x) => injTeamEq(x.abbr || toAbbr(x.name), opp));
    const o = t && t.stx ? t.stx : null;
    if (!t) return null;
    const gp = (t.wins || 0) + (t.losses || 0) + (t.ties || 0);
    const pf = t.pf, pa = t.pa;
    const d = gp && pf != null && pa != null ? (pf - pa) / gp : null;
    const out = [];
    if (d != null) out.push(chip(`OPP ${d > 0 ? "+" : ""}${d.toFixed(1)}/G`, d >= 2 ? BAD : d <= -2 ? GOOD : MID));
    if (o) {
      const pr = o.offPassYpgRank, rr = o.offRushYpgRank;
      if (rr != null && pr != null) {
        const id = rr <= 10 && pr > rr + 5 ? "Run-heavy O" : pr <= 10 && rr > pr + 5 ? "Pass-heavy O" : rr <= 10 && pr <= 10 ? "Explosive O" : rr >= 23 && pr >= 23 ? "Weak O" : "Balanced O";
        out.push(chip(id, id === "Explosive O" ? BAD : id === "Weak O" ? GOOD : NEU));
      }
      const dp = o.defPassYpgRank, dr = o.defRushYpgRank;
      if (dp != null && dr != null) {
        // what you can attack (green) or must respect (red)
        if (dp >= 23 && dr >= 23) out.push(chip("Soft D", GOOD));
        else if (dp >= 23) out.push(chip("Soft vs pass", GOOD));
        else if (dr >= 23) out.push(chip("Soft vs run", GOOD));
        else if (dp <= 10 && dr <= 10) out.push(chip("Stout D", BAD));
        else if (dp <= 10) out.push(chip("Stout vs pass", BAD));
        else if (dr <= 10) out.push(chip("Stout vs run", BAD));
        else out.push(chip("Average D", NEU));
      }
    }
    return out.length ? out : null;
  };
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between px-1 mb-2">
        <span className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase">Schedule</span>
        <span className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
          <span className="px-1.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">tough</span>
          <span className="px-1.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">favorable</span>
        </span>
      </div>
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {(() => { let w = 0, l = 0, t = 0; return data.games.map((g) => {
          if (g.result) { if (g.result === "W") w++; else if (g.result === "L") l++; else t++; }
          const recAfter = g.result ? `${w}-${l}${t ? "-" + t : ""}` : null;
          if (g.bye) return (
            <div key={"bye" + g.week} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-9 text-[10px] font-extrabold text-slate-400 tabular-nums">WK {g.week}</span>
              <span className="text-xs font-extrabold tracking-widest text-slate-400">BYE</span>
            </div>
          );
          const live = g.state === "in";
          return (
            <div key={g.week} className="px-3 py-2.5">
              <div className="flex items-center gap-2.5 active:opacity-70" onClick={() => onTeam && onTeam(g.opp)} role="button">
                <span className="w-9 shrink-0 text-[10px] font-extrabold text-slate-400 tabular-nums">WK {g.week}</span>
                <img src={g.oppLogo || TEAM_LOGOS[g.opp]} alt="" className="w-7 h-7 object-contain shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">
                    <span className="text-slate-400 font-bold mr-1">{g.neutral ? "vs" : g.home ? "vs" : "@"}</span>{g.oppName || g.opp}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400 truncate">{fmtDate(g.date, g.timeValid)}{g.tv ? " · " + g.tv : ""}</div>
                </div>
                {g.result ? (
                  <span className="shrink-0 text-right">
                    <span className={"text-[13px] font-black " + (g.result === "W" ? "text-emerald-600 dark:text-emerald-400" : g.result === "L" ? "text-rose-600 dark:text-rose-400" : "text-slate-500")}>{g.result}</span>
                    <span className="text-[13px] font-black tabular-nums text-slate-900 dark:text-white ml-1.5">{g.my}-{g.their}</span>
                    <span className="block text-[10px] font-bold tabular-nums text-slate-400">({recAfter})</span>
                  </span>
                ) : live ? (
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-black tabular-nums text-slate-900 dark:text-white">{g.my ?? 0}-{g.their ?? 0}</span>
                    <span className="block text-[9px] font-extrabold text-rose-500">LIVE</span>
                  </span>
                ) : null}
              </div>
              {matchup(g.opp) && <div className="flex flex-wrap gap-1 mt-2 pl-[2.875rem]">{matchup(g.opp)}</div>}
            </div>
          );
        }); })()}
      </div>
    </div>
  );
}

// Last-used tabs per team page (survives the page unmounting for a player card)
const TEAM_VIEW_MEMO = {};
// Same idea for every other screen: a player card replaces the whole tab, so
// any tab state (sub-view, search text, filters) lives here by key and is
// restored when you come back. Cleared only when you tap a bottom tab.
const STICKY = {};
function useSticky(key, init) {
  const [v, setV] = useState(() => (key in STICKY ? STICKY[key] : init));
  useEffect(() => { STICKY[key] = v; }, [key, v]);
  return [v, setV];
}
const SCROLL_MEMO = { y: 0 };
function TeamDetail({ team, teams, players, onBack, onSelectPlayer, seasonStats, onSwitchTeam, onStatJump }) {
  useEffect(() => { window.scrollTo(0, 0); }, [team.id]);
  const alpha = useMemo(() => [...(teams || [])].sort((a, b) => String(a.name).localeCompare(String(b.name))), [teams]);
  const idx = alpha.findIndex((t) => t.id === team.id);
  const swipe = useSwipe({
    onLeft: () => idx !== -1 && idx < alpha.length - 1 && onSwitchTeam && onSwitchTeam(alpha[idx + 1]),
    onRight: () => idx > 0 && onSwitchTeam && onSwitchTeam(alpha[idx - 1]),
  });
  const abbr = team.abbr || toAbbr(team.name);
  // The team page unmounts when a player card opens. Remember which tabs were
  // showing so coming back lands on the same view (field, contracts, ...).
  const remembered = TEAM_VIEW_MEMO[team.id] || {};
  const [seg, setSeg] = useState(remembered.seg || "roster");
  // Inside Roster: "list" (full roster), "offense" or "defense" (formation)
  const [rosterView, setRosterView] = useState(remembered.rosterView || "list");
  // Roster moves load the first time the Updates pill is opened.
  const movesAll = useMoves(rosterView === "injury");
  const teamMoves = useMemo(() => {
    const m = movesAll && movesAll.moves; if (!m) return [];
    const k = Object.keys(m).find((x) => injTeamEq(x, abbr));
    return k ? m[k] : [];
  }, [movesAll, abbr]);
  useEffect(() => { TEAM_VIEW_MEMO[team.id] = { seg, rosterView }; }, [team.id, seg, rosterView]);
  const unit = rosterView === "list" || rosterView === "injury" ? null : rosterView;
  const lineRanks = useMemo(() => computeLineRanks(players, teams), [players, teams]);
  const [roleFilter, setRoleFilter] = useState(null);
  const [, setSchedTick] = useState(0);   // re-render the SOS tiles once the schedule arrives
  const [chartMode, setChartMode] = useState("leaders");
  const [capSeason, setCapSeason] = useState(null);
  const rosterRaw = players.filter((p) => {
    if (p.teamId && p.teamId === team.id) return true; // exact Airtable link - no naming needed
    const t = teamOfPlayer(p);
    return t && (t === abbr || String(p.teamName).toLowerCase() === String(team.name).toLowerCase());
  });
  // Depth chart: Airtable Sort Priority when set, otherwise Sleeper's live chart
  // (computed every render: the Sleeper feed arrives after first paint and
  // this is a 53-man list, so it's cheap and always current)
  const roster = (() => {
    const auto = autoDepthLabels(rosterRaw, abbr);
    // Airtable = the healthy depth chart and always wins. Players it doesn't
    // label get Sleeper's order, numbered AFTER the Airtable ones at that spot
    // (Airtable QB1 + Sleeper's next QB -> QB2, never a second QB1).
    const baseOf = (l) => { const m = String(l || "").toUpperCase().match(/^([A-Z]+)(\d*)$/); return m ? [m[1], Number(m[2] || 1)] : [null, 0]; };
    const top = {};
    for (const p of rosterRaw) { const [b, n] = baseOf(p.sortLabel); if (b) top[b] = Math.max(top[b] || 0, n); }
    const fill = rosterRaw.filter((p) => !p.sortLabel && auto[p.id])
      .map((p) => ({ p, b: baseOf(auto[p.id])[0], n: baseOf(auto[p.id])[1] }))
      .sort((x, y) => x.n - y.n);
    const next = {}, lbl = {};
    for (const { p, b } of fill) { next[b] = (next[b] ?? (top[b] || 0)) + 1; lbl[p.id] = b + next[b]; }
    return rosterRaw.map((p) => {
      if (p.sortLabel) return { ...p, depthSrc: "airtable" };
      const l = lbl[p.id] || null;
      return { ...p, sortLabel: l, sort: p.sort ?? rankOfLabel(l), depthSrc: l ? "sleeper" : null };
    });
  })();
  const payroll = roster.reduce((a, p) => a + currentSalary(p), 0);
  const dark = useDark();
  const ink = TEAM_ACCENT[abbr] || teamInk(abbr, dark);   // readable on the current theme
  const onInk = lumOf(ink) > 0.55 ? "#111827" : "#ffffff"; // label text on an ink fill
  const tint = (a) => ink + a;                // team-tinted fill
  const fill = LOGO_BG[abbr] || teamColor(abbr);  // big filled areas: the real shade
  // tap a stat tile → Stats → Teams board for that stat, scrolled to this team
  const jumpTeam = (teamStat) => (onStatJump ? () => onStatJump({ teamStat, team: abbr }) : undefined);

  // Offense absorbs the offensive line, Defense absorbs the defensive line;
  // Special Teams stays its own section for when that depth chart is filled in.
  const SECTION_OF = { "Offense": "Offense", "Offensive Line": "Offense", "Defense": "Defense", "Defensive Line": "Defense", "Special Teams": "Special Teams" };
  const groups = {};
  for (const p of roster) {
    const role = SECTION_OF[unitOf(p)] || "Roster";
    (groups[role] ??= []).push(p);
  }
  const orderedRoles = [...["Offense", "Defense", "Special Teams"].filter((r) => groups[r]), ...(groups["Roster"] ? ["Roster"] : [])];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-24" {...swipe}>
      <div className="px-5 pb-6 text-white" style={{ backgroundColor: fill, paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)" }}>
        <button onClick={onBack} className="text-sm font-semibold opacity-80 mb-4">‹ Teams</button>
        <div className="flex items-center gap-4">
          {team.logo ? (
            <img src={lumOf(fill) < 0.5 ? (darkLogo(abbr) || team.logo || TEAM_LOGOS[abbr]) : (team.logo || TEAM_LOGOS[abbr])} alt="" className="w-[4.5rem] h-[4.5rem] object-contain shrink-0" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.45))" }} onError={(e) => { const f = team.logo || TEAM_LOGOS[abbr]; if (f && e.currentTarget.src !== f) e.currentTarget.src = f; }} />
          ) : (
            <span className="text-3xl">🏈</span>
          )}
          <div className="min-w-0">
            <div className="text-2xl font-extrabold leading-tight truncate">
              {team.name}
              {(() => {
                // Record lives next to the name now (freed the tile up top).
                // teamRec already drops the tie unless there is one.
                const r = teamRec(team, seasonStarted(teams));
                return (r.w + r.l + r.t) > 0
                  ? <span className="ml-2 text-base font-bold opacity-80 tabular-nums align-middle">({r.str})</span>
                  : null;
              })()}
            </div>
            <div className="text-sm opacity-80 font-medium mt-0.5 truncate">
              {(() => {
                if (!team.division) return [team.conference].filter(Boolean).join(" · ") || "—";
                const rivals = (teams || []).filter((t) => t.division === team.division)
                  .sort((a, b) => winPct(b) - winPct(a) || (b.wins ?? 0) - (a.wins ?? 0));
                const i = rivals.findIndex((t) => t.id === team.id);
                const ord = i >= 0 ? (ORDINALS[i] || `${i + 1}th`) : null;
                return ord ? `${ord} in ${team.division}` : team.division;
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3">
        <TileBorderCtx.Provider value={TEAM_SECONDARY[abbr] || TEAM_ACCENT[abbr] || null}>
        <div className={"grid gap-2 " + (seg === "roster" && unit ? "grid-cols-4" : "grid-cols-3")}>
          {(() => {
            const started = seasonStarted(teams);
            // Live points: box scores (including in-progress games) beat the
            // season feed, which only updates after games go final.
            const pts = (() => {
              const base = teamPts(team, started);
              const bx = seasonStats && seasonStats.teams ? Object.entries(seasonStats.teams).find(([k]) => injTeamEq(k, abbr)) : null;
              if (bx && bx[1] && (bx[1].pf != null || bx[1].pa != null)) return { pf: bx[1].pf ?? base.pf, pa: bx[1].pa ?? base.pa };
              return base;
            })();
            const sx = team.stx || {}; // per-team stats merged from /api/standings
            // Rank line under each stat: top 10 green, 11-20 yellow, bottom 12 red.
            // (Passed as {label, cls} — the format Tile's sub actually renders;
            // a JSX element here silently displays nothing, which is why ranks
            // were invisible before.)
            const tLog = (() => {
              const bx = seasonStats && seasonStats.teams ? Object.entries(seasonStats.teams).find(([k]) => injTeamEq(k, abbr)) : null;
              return bx && bx[1] ? bx[1].log : null;
            })();
            const rk = (rank, tieKey) => rank == null ? null : {
              label: ordinal(rank) + (tieKey && sx.ties && sx.ties[tieKey] ? " (tie)" : ""),
              cls: rank <= 10 ? "text-green-600 dark:text-green-400"
                : rank <= 20 ? "text-yellow-600 dark:text-yellow-400"
                : "text-red-500 dark:text-red-400",
            };
            if (seg === "roster" && unit === "offense") {
              return (
                <>
                  <Tile compact onClick={jumpTeam("offPassYds")} trend={trendOf(tLog, "offPassYds", false)} value={sx.offPassYpg != null ? sx.offPassYpg.toFixed(1) : "—"} label="Pass Yds" sub={rk(sx.offPassYpgRank, "offPassYds")} />
                  <Tile compact onClick={jumpTeam("offPassTd")} trend={trendOf(tLog, "offPassTd", false)} value={sx.offPassTd != null ? sx.offPassTd : "—"} label="Pass TD" sub={rk(sx.offPassTdRank, "offPassTd")} />
                  <Tile compact onClick={jumpTeam("offRushYds")} trend={trendOf(tLog, "offRushYds", false)} value={sx.offRushYpg != null ? sx.offRushYpg.toFixed(1) : "—"} label="Rush Yds" sub={rk(sx.offRushYpgRank, "offRushYds")} />
                  <Tile compact onClick={jumpTeam("offRushTd")} trend={trendOf(tLog, "offRushTd", false)} value={sx.offRushTd != null ? sx.offRushTd : "—"} label="Rush TD" sub={rk(sx.offRushTdRank, "offRushTd")} />
                </>
              );
            }
            if (seg === "roster" && unit === "defense") {
              return (
                <>
                  <Tile compact onClick={jumpTeam("defPassYds")} trend={trendOf(tLog, "defPassYds", true)} value={sx.defPassYpg != null ? sx.defPassYpg.toFixed(1) : "—"} label="Pass Yds" label2="Allowed" sub={rk(sx.defPassYpgRank, "defPassYds")} />
                  <Tile compact onClick={jumpTeam("defPassTd")} trend={trendOf(tLog, "defPassTd", true)} value={sx.defPassTd != null ? sx.defPassTd : "—"} label="Pass TD" label2="Allowed" sub={rk(sx.defPassTdRank, "defPassTd")} />
                  <Tile compact onClick={jumpTeam("defRushYds")} trend={trendOf(tLog, "defRushYds", true)} value={sx.defRushYpg != null ? sx.defRushYpg.toFixed(1) : "—"} label="Rush Yds" label2="Allowed" sub={rk(sx.defRushYpgRank, "defRushYds")} />
                  <Tile compact onClick={jumpTeam("defRushTd")} trend={trendOf(tLog, "defRushTd", true)} value={sx.defRushTd != null ? sx.defRushTd : "—"} label="Rush TD" label2="Allowed" sub={rk(sx.defRushTdRank, "defRushTd")} />
                </>
              );
            }
            if (seg === "charts" && (chartMode === "volume" || chartMode === "defense")) {
              // Team volume / defense totals from the box-score players, ranked across the league
              const agg = {};
              for (const P of Object.values((seasonStats && seasonStats.players) || {})) {
                const a = (agg[P.team] ??= { passAtt: 0, rushAtt: 0, sacks: 0, defInt: 0, tfl: 0 });
                a.passAtt += P.totals.att || 0; a.rushAtt += P.totals.car || 0; a.sacks += P.totals.sacks || 0; a.defInt += P.totals.defInt || 0; a.tfl += P.totals.tfl || 0;
              }
              const mineKey = Object.keys(agg).find((k) => injTeamEq(k, abbr));
              const mine = mineKey ? agg[mineKey] : null;
              const rankOf = (get) => {
                if (!mine) return null;
                const vals = Object.values(agg).map(get).sort((a, b) => b - a);
                return vals.indexOf(get(mine)) + 1;
              };
              const passRate = (a) => (a.passAtt + a.rushAtt ? a.passAtt / (a.passAtt + a.rushAtt) : 0);
              if (chartMode === "volume") return (
                <>
                  <Tile value={mine ? mine.passAtt : "—"} label="Pass Att" sub={rk(rankOf((a) => a.passAtt))} />
                  <Tile value={mine ? mine.rushAtt : "—"} label="Rush Att" sub={rk(rankOf((a) => a.rushAtt))} />
                  <Tile value={mine ? Math.round(passRate(mine) * 100) + "%" : "—"} label="Pass Rate" sub={rk(rankOf(passRate))} />
                </>
              );
              return (
                <>
                  <Tile value={mine ? mine.sacks : "—"} label="Sacks" sub={rk(rankOf((a) => a.sacks))} />
                  <Tile value={mine ? mine.defInt : "—"} label="INT" sub={rk(rankOf((a) => a.defInt))} />
                  <Tile value={mine ? mine.tfl : "—"} label="TFL" sub={rk(rankOf((a) => a.tfl))} />
                </>
              );
            }
            if (seg === "schedule") {
              // Strength of schedule from opponents' season-to-date point
              // differential per game (better than win% this early). Positive
              // = opponents outscore people = a tough slate.
              const sched = SCHED_CACHE[abbr];
              const oppOf = (g) => teams.find((x) => injTeamEq(x.abbr || toAbbr(x.name), g.opp));
              const diffPg = (t) => { if (!t) return null; const gp = (t.wins || 0) + (t.losses || 0) + (t.ties || 0); const { pf, pa } = teamPts(t, started); return gp && pf != null && pa != null ? (pf - pa) / gp : null; };
              const rec = (ts) => { const w = ts.reduce((a, t) => a + (t.wins || 0), 0), l = ts.reduce((a, t) => a + (t.losses || 0), 0), tt = ts.reduce((a, t) => a + (t.ties || 0), 0); return w + l + tt ? `OPP ${w}-${l}${tt ? "-" + tt : ""}` : null; };
              const games = sched ? sched.games.filter((g) => !g.bye) : [];
              const played = games.filter((g) => g.result), left = games.filter((g) => !g.result);
              const sos = (gs, label) => {
                const ts = gs.map(oppOf).filter(Boolean);
                const ds = ts.map(diffPg).filter((d) => d != null);
                const avg = ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null;
                const cls = avg == null ? null : avg >= 2 ? "text-red-500 dark:text-red-400" : avg <= -2 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400";
                return <Tile onClick={jumpTeam("ppg")} value={avg == null ? "—" : (avg > 0 ? "+" : "") + avg.toFixed(1)} valueClass={cls} label="Opp Point Diff" label2={label} sub={rec(ts) ? { label: rec(ts), cls: "text-slate-400" } : (gs.length ? null : "none")} />;
              };
              return (
                <>
                  {sos(played, "Played")}
                  {sos(left.slice(0, 5), "Next 5")}
                  {sos(left, "Rest of Season")}
                </>
              );
            }
            if (seg === "contracts") {
              const fa = roster.filter((p) => { const e = nextEvent(p); return e && (e.kind === "UFA" || e.kind === "RFA"); }).length;
              const ages = roster.map((p) => Number(p.age)).filter((a) => a > 0);
              const avgAge = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null;
              // Rank every team's average age: 1st = youngest, 32nd = oldest
              const teamAvg = (t) => {
                const ab = t.abbr || toAbbr(t.name);
                const rs = players.filter((q) => (q.teamId && q.teamId === t.id) || teamOfPlayer(q) === ab || String(q.teamName || "").toLowerCase() === String(t.name || "").toLowerCase());
                const as = rs.map((q) => Number(q.age)).filter((a) => a > 0);
                return as.length >= 5 ? as.reduce((a, b) => a + b, 0) / as.length : null;
              };
              const ageRanked = teams.map((t) => [t.id, teamAvg(t)]).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1]);
              const ageRank = ageRanked.findIndex(([id]) => id === team.id) + 1;
              const ageCls = ageRank ? (ageRank <= 10 ? "text-green-600 dark:text-green-400" : ageRank <= 20 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500 dark:text-red-400") : null;
              return (
                <>
                  <Tile value={payroll ? fmtM(payroll) : "—"} label="Payroll" sub={roster.length + " players"} />
                  <Tile value={fa} label="Free Agents" sub={"next offseason"} />
                  <Tile value={avgAge != null ? avgAge.toFixed(1) : "—"} label="Avg Age" sub={ageRank ? { label: ordinal(ageRank) + (ageRank <= 3 ? " youngest" : ageRank >= ageRanked.length - 2 ? " oldest" : ""), cls: ageCls } : null} />
                </>
              );
            }
            const diff = pts.pf != null && pts.pa != null ? Math.round(pts.pf - pts.pa) : null;
            // League ranks for the three headline numbers. Same value = same rank,
            // flagged as a tie, exactly like the player boards.
            const allPts = teams.map((t) => {
              const ab = t.abbr || toAbbr(t.name);
              const base = teamPts(t, started);
              const bx = seasonStats && seasonStats.teams ? Object.entries(seasonStats.teams).find(([k]) => injTeamEq(k, ab)) : null;
              const pf = bx && bx[1] && bx[1].pf != null ? bx[1].pf : base.pf;
              const pa = bx && bx[1] && bx[1].pa != null ? bx[1].pa : base.pa;
              // Rank per game, not on totals: mid-week some teams have a game in
              // hand and their smaller totals would leapfrog a better defense.
              const g = bx && bx[1] && bx[1].games ? bx[1].games : (((t.wins || 0) + (t.losses || 0) + (t.ties || 0)) || 1);
              return { abbr: ab, pf: pf != null ? pf / g : null, pa: pa != null ? pa / g : null, d: pf != null && pa != null ? (pf - pa) / g : null };
            });
            const mine = allPts.find((x) => injTeamEq(x.abbr, abbr)) || {};
            const rankIn = (vals, mine, asc) => {
              if (mine == null) return null;
              const v = vals.filter((x) => x != null).sort((a, b) => (asc ? a - b : b - a));
              const r = v.indexOf(mine) + 1;
              return r ? { rank: r, tie: v.filter((x) => x === mine).length > 1 } : null;
            };
            // scoring: most is best. allowed: fewest is best. differential: most is best.
            const rkT = (o) => o == null ? null : {
              label: ordinal(o.rank) + (o.tie ? " (tie)" : ""),
              cls: o.rank <= 10 ? "text-green-600 dark:text-green-400" : o.rank <= 20 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500 dark:text-red-400",
            };
            const tlog = (() => {
              const bx = seasonStats && seasonStats.teams ? Object.entries(seasonStats.teams).find(([k]) => injTeamEq(k, abbr)) : null;
              return bx && bx[1] ? bx[1].log : null;
            })();
            const pfRank = rankIn(allPts.map((x) => x.pf), mine.pf, false);
            const paRank = rankIn(allPts.map((x) => x.pa), mine.pa, true);
            const dRank = rankIn(allPts.map((x) => x.d), mine.d, false);
            return (
              <>
                <Tile tint={ink} onClick={jumpTeam("ppg")} trend={trendOf(tlog, "pf", false)} value={pts.pf != null ? Math.round(pts.pf) : "—"} label="Points Scored" sub={rkT(pfRank)} />
                <Tile tint={ink} onClick={jumpTeam("papg")} trend={trendOf(tlog, "pa", true)} value={pts.pa != null ? Math.round(pts.pa) : "—"} label="Points Allowed" sub={rkT(paRank)} />
                <Tile tint={ink} value={diff != null ? (diff > 0 ? "+" + diff : String(diff)) : "—"} label="Point Diff" sub={rkT(dRank)}
                  valueClass={diff == null ? null : diff > 0 ? "text-emerald-600 dark:text-emerald-400" : diff < 0 ? "text-red-600 dark:text-red-400" : null} />
              </>
            );
          })()}
        </div>
        </TileBorderCtx.Provider>

        <div className="flex gap-2 mt-4">
          {[["roster", "Roster"], ["schedule", "Schedule"], ["contracts", "Contracts"], ["charts", "Stats"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setSeg(k)}
              className={"flex-1 py-2 rounded-full text-xs font-bold transition-colors " + (seg === k
                ? ""
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
              style={seg === k ? { backgroundColor: ink, color: onInk } : undefined}>
              {lbl}
            </button>
          ))}
        </div>

        {seg === "roster" && (
          <div className="flex gap-2 mt-3">
            {[["offense", "Offense"], ["defense", "Defense"], ["injury", "Updates"]].map(([k, lbl]) => (
              <button key={k} onClick={() => setRosterView(rosterView === k ? "list" : k)}
                className={"flex-1 py-1.5 rounded-full text-[11px] font-extrabold transition-colors " + (rosterView === k
                  ? ""
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}
                style={rosterView === k ? { backgroundColor: ink, color: onInk } : undefined}>
                {lbl}
              </button>
            ))}
          </div>
        )}
        {seg === "roster" && unit && <FormationView roster={roster} abbr={abbr} unit={unit} onSelectPlayer={onSelectPlayer} lineRank={lineRanks[abbr]} team={team} />}
        {seg === "roster" && rosterView === "injury" && (
          <InjuryFeed embedded players={rosterRaw} onSelect={onSelectPlayer} q="" setQ={() => {}} dark={dark} moves={teamMoves} movesState={movesAll ? (movesAll.error ? "error" : "ok") : "loading"} abbr={abbr} />
        )}
        {seg === "roster" && rosterView !== "injury" && !unit && orderedRoles.map((role) => (
          <div key={role}>
            <div className="text-[12px] font-extrabold tracking-widest text-slate-900 dark:text-white uppercase mt-6 mb-2 px-1">{role}</div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {(() => {
                const sorted = groups[role].slice().sort((a, b) => {
                  if (a.sort != null && b.sort != null) return a.sort - b.sort;
                  if (a.sort != null) return -1;
                  if (b.sort != null) return 1;
                  return currentSalary(b) - currentSalary(a);
                });
                const starters = sorted.filter(isStarter);
                const BENCH_ORDER = ["QB", "RB", "HB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT", "OT", "OG", "G", "OL", "DE", "LDE", "RDE", "EDGE", "DT", "LDT", "RDT", "NT", "DL", "LB", "ILB", "OLB", "MLB", "LOLB", "ROLB", "CB", "LCB", "RCB", "NB", "DB", "S", "FS", "SS", "K", "P", "LS"];
                const benchKey = (p) => {
                  const m = String(p.sortLabel || "").toUpperCase().match(/^([A-Z]+)(\d*)$/);
                  const base = m ? m[1] : String(p.pos || "").toUpperCase();
                  const i = BENCH_ORDER.indexOf(base);
                  return [i === -1 ? 99 : i, m && m[2] ? Number(m[2]) : 99];
                };
                const bench = sorted.filter((p) => !isStarter(p)).sort((a, b) => { const ka = benchKey(a), kb = benchKey(b); return ka[0] - kb[0] || ka[1] - kb[1]; });
                // No Starters/Bench headers — the depth-chart label already says
                // WR3 or RB2, so the split would just be telling you twice.
                return [...starters, ...bench];
              })()
                .map((p) => (
                  <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 pr-4 pl-3 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800"
                    style={{ borderLeft: `3px solid ${tint(dark ? "66" : "33")}` }}>
                    <span className="w-9 text-center text-[10px] font-extrabold uppercase shrink-0 rounded-md py-1"
                      style={{ backgroundColor: ink, color: onInk }}>{p.sortLabel || p.pos || "—"}</span>
                    <Avatar p={p} size="md" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {cleanNo(p.no) && <span className="text-slate-400 font-semibold mr-1.5">#{cleanNo(p.no)}</span>}{p.name}
                      </span>
                      {/* row 2: injury tag on the left, per-game tiles on the right */}
                      <span className="flex items-center gap-2 mt-1.5">
                        <span className="min-w-0 flex-1 self-center"><LiveStatus p={p} team={abbr} /></span>
                        {(() => {
                          const grp = posGroup(p.pos), S = playerSeasonRow(p, seasonStats);
                          if (!grp) return null;
                          const G = S && S.totals && S.totals.gp ? S.perGame : null;
                          return (
                            <span className="flex gap-1 shrink-0 items-stretch">
                              {STAT_TILES[grp].map(([lbl, k]) => (
                                // fixed height + no label wrap, so "RUSH YDS" can't push its
                                // number a line lower than the tiles beside it
                                <span key={k} className="w-[52px] h-[38px] flex flex-col items-stretch justify-start rounded-md border overflow-hidden"
                                  style={{ backgroundColor: tint(dark ? "24" : "14"), borderColor: tint(dark ? "59" : "33") }}>
                                  <span className="block text-[7px] font-extrabold tracking-wide uppercase leading-none whitespace-nowrap text-center py-[3px]" style={{ backgroundColor: ink, color: onInk }}>{lbl}</span>
                                  <span className="flex-1 flex items-center justify-center text-[13px] font-extrabold tabular-nums text-slate-800 dark:text-slate-100 leading-none">{G && G[k] != null ? G[k] : "—"}</span>
                                </span>
                              ))}
                            </span>
                          );
                        })()}
                      </span>
                      {/* row 3: the detailed note, directly under the tag, nothing blocking it */}
                      {(() => {
                        const d = injHasFlag(p, abbr) ? injuryDetail(p, abbr) : null;
                        if (!d) return p.injuryNotes ? <span className="block text-[11px] font-semibold text-red-500 mt-1">({injCase(p.injuryNotes)})</span> : null;
                        return (<>
                          {d.note && <span className="block text-[11px] font-semibold text-rose-500 mt-1">{d.note}</span>}
                          {d.retLine && <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{d.retLine}</span>}
                        </>);
                      })()}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        ))}
        {seg === "contracts" && (
          <>
            <div className="flex items-baseline justify-between mt-6 mb-2 px-1">
              <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">Team Contracts</span>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              {roster
                .slice()
                .sort((a, b) => currentSalary(b) - currentSalary(a) || a.name.localeCompare(b.name))
                .map((p) => {
                  const act = activeOf(p);
                  return (
                    <button key={p.id} onClick={() => onSelectPlayer(p)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                      <Avatar p={p} size="md" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.name}</span>
                        <span className="block text-[11px] text-slate-400 font-medium truncate">
                          {act ? (act.terms || displayLine(act)) : "No contract"}
                        </span>
                        {nextEvent(p) && (
                          <span className="block mt-1"><EventPill ev={nextEvent(p)} /></span>
                        )}
                      </span>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 shrink-0">
                        {currentSalary(p) > 0 ? fmtM(currentSalary(p)) : "—"}
                      </span>
                    </button>
                  );
                })}
              {roster.length === 0 && <div className="text-center text-sm text-slate-400 py-10">No players linked yet.</div>}
            </div>
          </>
        )}

        {seg === "charts" && <TeamStatsPanel roster={roster} abbr={abbr} seasonStats={seasonStats} mode={chartMode} setMode={setChartMode} onSelectPlayer={onSelectPlayer} />}

        {seg === "schedule" && <TeamSchedule abbr={abbr} teams={teams} ink={ink} onTeam={(opp) => { const t = teams.find((x) => injTeamEq(x.abbr || toAbbr(x.name), opp)); if (t && onSwitchTeam) { TEAM_VIEW_MEMO[t.id] = { seg: "roster", rosterView: "list" }; setSeg("roster"); setRosterView("list"); onSwitchTeam(t); } }} onLoaded={() => setSchedTick((n) => n + 1)} />}

        {seg === "roster" && !unit && roster.length === 0 && (
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
  // fall back to the pick number: 32 picks per round, 7 rounds
  const pk = pickOf(p);
  if (pk !== 999) return Math.min(7, Math.ceil(pk / 32));
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
  { key: "passYds", label: "PASS" },
  { key: "rushYds", label: "RUSH" },
  { key: "recYds", label: "REC" },
  { key: "td", label: "TD" },
  { key: "tkl", label: "TKL" },
  { key: "sck", label: "SCK" },
  { key: "ints", label: "INT" },
];

// ═══════════════ STATS: league leaders from the box-score pipeline ═══
// Standard PPR fantasy scoring
const fantasyPts = (T) => (T.passYds || 0) / 25 + (T.passTd || 0) * 4 - (T.int || 0) * 2 + (T.rushYds || 0) / 10 + (T.rushTd || 0) * 6 + (T.rec || 0) + (T.recYds || 0) / 10 + (T.recTd || 0) * 6;
const LEADER_CATS = [
  { id: "passing", label: "Passing", positions: null, stats: [["passYds", "Yards"], ["passTd", "TD"], ["cmp", "Cmp"], ["att", "Att"], ["int", "INT"]] },
  { id: "rushing", label: "Rushing", positions: ["QB", "RB", "WR"], stats: [["rushYds", "Yards"], ["rushTd", "TD"], ["car", "Carries"], ["ypcar", "Y/Car"]] },
  { id: "receiving", label: "Receiving", positions: ["WR", "TE", "RB"], stats: [["recYds", "Yards"], ["recTd", "TD"], ["rec", "Rec"], ["tgt", "Targets"]] },
  { id: "defense", label: "Defense", positions: null, stats: [["tkl", "Tackles"], ["sacks", "Sacks"], ["defInt", "INT"], ["tfl", "TFL"], ["pd", "PD"]] },
  { id: "fantasy", label: "Fantasy", positions: ["QB", "RB", "WR", "TE"], stats: [["fpts", "Points"]] },
  { id: "teams", label: "Teams", positions: null, stats: [["ppg", "Points"], ["papg", "Pts Allowed"], ["offPassYds", "Pass Yds/G"], ["offPassTd", "Pass TD"], ["offRushYds", "Rush Yds/G"], ["offRushTd", "Rush TD"], ["defPassYds", "Pass Yds Alwd"], ["defPassTd", "Pass TD Alwd"], ["defRushYds", "Rush Yds Alwd"], ["defRushTd", "Rush TD Alwd"], ["passRate", "Pass Rate"], ["passAtt", "Pass Att"], ["rushAtt", "Rush Att"], ["ydsFor", "Yards/G"], ["ydsAgainst", "Yds Allowed"], ["sacks", "Sacks"], ["takeaways", "Takeaways"]] },
];
// Team-level rows built from the same box-score pipeline the player stats use
function teamLeaderRows(seasonStats, key) {
  const T = (seasonStats && seasonStats.teams) || {};
  const players = Object.values((seasonStats && seasonStats.players) || {});
  const vol = {};
  for (const P of players) {
    const a = (vol[P.team] ??= { passAtt: 0, rushAtt: 0, sacks: 0, defInt: 0 });
    a.passAtt += P.totals.att || 0; a.rushAtt += P.totals.car || 0; a.sacks += P.totals.sacks || 0; a.defInt += P.totals.defInt || 0;
  }
  const rows = Object.entries(T).map(([abbr, t]) => {
    const v = vol[abbr] || { passAtt: 0, rushAtt: 0, sacks: 0, defInt: 0 };
    const gp = t.games || 1;
    const plays = v.passAtt + v.rushAtt;
    return { abbr, gp, val: {
      passRate: plays ? (v.passAtt / plays) * 100 : 0,
      passAtt: v.passAtt, rushAtt: v.rushAtt,
      ppg: (t.pf || 0) / gp, papg: (t.pa || 0) / gp, pfTot: t.pf || 0, paTot: t.pa || 0,
      ydsFor: ((t.off?.passYds || 0) + (t.off?.rushYds || 0)) / gp,
      ydsAgainst: ((t.def?.passYds || 0) + (t.def?.rushYds || 0)) / gp,
      offPassYds: (t.off?.passYds || 0) / gp, offPassTd: t.off?.passTd || 0,
      offRushYds: (t.off?.rushYds || 0) / gp, offRushTd: t.off?.rushTd || 0,
      defPassYds: (t.def?.passYds || 0) / gp, defPassTd: t.def?.passTd || 0,
      defRushYds: (t.def?.rushYds || 0) / gp, defRushTd: t.def?.rushTd || 0,
      sacks: v.sacks, takeaways: v.defInt,
    } };
  });
  // fewer is better for anything allowed
  const asc = key === "papg" || key === "ydsAgainst" || key.startsWith("def");
  // zero is a legitimate value on the "allowed" boards (nine teams with 0 rush
  // TDs allowed are the leaders, not missing data)
  const keep = (r) => (asc ? r.gp > 0 : r.val[key] > 0);
  const sorted = rows.filter(keep).sort((a, b) => (asc ? a.val[key] - b.val[key] : b.val[key] - a.val[key]));
  let lastV = null, lastR = 0;
  sorted.forEach((r, i) => { const v = r.val[key]; if (v !== lastV) { lastR = i + 1; lastV = v; } r.rank = lastR; });
  for (const r of sorted) r.tie = sorted.filter((o) => o.val[key] === r.val[key]).length > 1;
  return sorted;
}
// ═══════════════ RED-ZONE USAGE (nflverse via /api/redzone) ═══════
// One fetch per season, shared by every screen. The payload is per player per
// week, so "through week N" views filter on the client instead of refetching.
const RZ_CACHE = {}, RZ_WAIT = {};
function useRedzone(season) {
  const [d, setD] = useState(season && RZ_CACHE[season] ? RZ_CACHE[season] : null);
  useEffect(() => {
    if (!season) return;
    if (RZ_CACHE[season]) { setD(RZ_CACHE[season]); return; }
    let alive = true;
    (RZ_WAIT[season] ??= fetch(`/api/redzone?season=${season}`).then((r) => r.json())
      .then((x) => { if (x && x.players) RZ_CACHE[season] = x; else delete RZ_WAIT[season]; return x; })
      .catch(() => { delete RZ_WAIT[season]; return null; }))
      .then((x) => { if (alive && x && x.players) setD(x); });
    return () => { alive = false; };
  }, [season]);
  return d;
}
// nflverse names are "C.Lamb" / "A.St. Brown". Match on the league id Sleeper
// carries (some of Sleeper's have a stray leading space), else initial + last name.
const rzKey = (x) => String(x || "").toLowerCase().replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, "").replace(/[^a-z]/g, "");
function rzFind(rz, name, abbr) {
  if (!rz || !rz.players || !name) return null;
  const inj = injFor(name, abbr);
  const gid = inj && inj.gsis_id ? String(inj.gsis_id).trim() : "";
  if (gid && rz.players[gid]) return rz.players[gid];
  const parts = String(name).replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, "").trim().split(/\s+/);
  if (parts.length < 2) return null;
  const want = rzKey(parts[0][0] + parts.slice(1).join(""));
  return Object.values(rz.players).find((q) => injTeamEq(q.team, abbr) && rzKey(q.name) === want) || null;
}
function rzSum(q, through) {
  const t = { rzTgt: 0, ezTgt: 0, rzCar: 0, glCar: 0, tgt: 0, car: 0 };
  for (const [wk, w] of Object.entries((q && q.weeks) || {})) {
    if (through && Number(wk) > through) continue;
    for (const k of Object.keys(t)) t[k] += w[k] || 0;
  }
  return t;
}

// ═══════════════ MATCHUP BREAKDOWN ════════════════════════════════
// Team profile for the matchup dropdown: every board rank a team needs,
// keyed by abbreviation. Ranks come from the same boards as the Stats tab.
const TAPE_KEYS = ["passRate", "passAtt", "rushAtt", "ppg", "papg", "offPassYds", "offPassTd", "offRushYds", "offRushTd", "defPassYds", "defPassTd", "defRushYds", "defRushTd"];
function tapeRows(seasonStats) {
  const out = {};
  for (const k of TAPE_KEYS) for (const r of teamLeaderRows(seasonStats, k)) {
    const o = (out[r.abbr] ??= { abbr: r.abbr, gp: r.gp, val: r.val, rank: {} });
    o.rank[k] = r.rank;
  }
  // Efficiency, which game script can't fake. Yards allowed per GAME flatters a
  // bad team (opponents lead, run the clock, stop throwing), so the breakdown
  // grades defenses on yards per pass attempt and per carry instead. Attempts
  // and carries faced come from every player-game logged against that team.
  const own = {}, faced = {};
  for (const P of Object.values((seasonStats && seasonStats.players) || {})) for (const gm of P.games || []) {
    const t = gm.team || P.team, op = gm.opp;
    if (t) { const a = (own[t] ??= { att: 0, car: 0 }); a.att += gm.att || 0; a.car += gm.car || 0; }
    if (op) { const a = (faced[op] ??= { att: 0, car: 0 }); a.att += gm.att || 0; a.car += gm.car || 0; }
  }
  const pick = (m, abbr) => m[abbr] || m[Object.keys(m).find((k) => injTeamEq(k, abbr))] || { att: 0, car: 0 };
  const T = (seasonStats && seasonStats.teams) || {};
  for (const o of Object.values(out)) {
    const t = T[o.abbr] || {}, ow = pick(own, o.abbr), fc = pick(faced, o.abbr), gp = o.gp || 1;
    o.val.offPassYpa = ow.att >= 30 ? (t.off?.passYds || 0) / ow.att : null;
    o.val.offRushYpc = ow.car >= 30 ? (t.off?.rushYds || 0) / ow.car : null;
    o.val.defPassYpa = fc.att >= 30 ? (t.def?.passYds || 0) / fc.att : null;
    o.val.defRushYpc = fc.car >= 30 ? (t.def?.rushYds || 0) / fc.car : null;
    o.val.defPassAttPg = fc.att / gp; o.val.defRushAttPg = fc.car / gp;
  }
  const rankBy = (k, asc) => {
    const arr = Object.values(out).filter((o) => o.val[k] != null).sort((a, b) => (asc ? a.val[k] - b.val[k] : b.val[k] - a.val[k]));
    let lastV = null, lastR = 0;
    arr.forEach((o, i) => { const v = Math.round(o.val[k] * 100); if (v !== lastV) { lastR = i + 1; lastV = v; } o.rank[k] = lastR; });
  };
  rankBy("offPassYpa", false); rankBy("offRushYpc", false); rankBy("defPassYpa", true); rankBy("defRushYpc", true);
  rankBy("defPassAttPg", true); rankBy("defRushAttPg", true);
  return out;
}
// The players worth knowing for one offense: the current passer, the top two
// targets (plus the end-zone target leader if he isn't one of them), and the
// lead back (plus the goal-line back if that's someone else). OUT/IR players
// are skipped so the list is who's actually playing.
function tapePlayers(stats, rz, through, abbr) {
  const all = Object.values((stats && stats.players) || {}).filter((P) => injTeamEq(P.team, abbr) && P.games && P.games.length);
  if (!all.length) return null;
  const weeks = new Set(), maxWk = all.reduce((m, P) => { for (const g of P.games) { weeks.add(g.week); if ((g.week || 0) > m) m = g.week || 0; } return m; }, 0);
  const minG = Math.min(3, weeks.size || 1);
  const rows = all.map((P) => {
    const inj = injFor(P.name, abbr), n = P.games.length;
    const sum = (k) => P.games.reduce((a, g) => a + (g[k] || 0), 0);
    const r = rzFind(rz, P.name, abbr);
    return {
      P, inj, n, out: !!(inj && injIsOut(inj)), pos: String(P.pos || "").toUpperCase(),
      att: sum("att"), passYds: sum("passYds"), passTd: sum("passTd"),
      car: sum("car"), rushYds: sum("rushYds"), rushTd: sum("rushTd"),
      tgt: sum("tgt"), recYds: sum("recYds"), recTd: sum("recTd"),
      recentAtt: P.games.reduce((a, g) => a + ((g.week || 0) > maxWk - 3 ? (g.att || 0) : 0), 0),
      tdGames: P.games.filter((g) => (g.rushTd || 0) + (g.recTd || 0) > 0).length,
      multiPassTd: P.games.filter((g) => (g.passTd || 0) >= 2).length,
      rz: r ? rzSum(r, through) : null,
      // still here? on Sleeper's roster for this team, or played in the team's last three weeks
      current: !!(inj && injTeamEq(inj.team, abbr)) || P.games.some((g) => (g.week || 0) > maxWk - 3),
    };
  }).filter((x) => !x.out && x.current);
  // the passer is whoever has thrown the most over the last three weeks (handles a QB change)
  const qb = rows.filter((x) => x.att >= 10).sort((a, b) => b.recentAtt - a.recentAtt || b.att - a.att)[0] || null;
  const skill = rows.filter((x) => x !== qb && x.pos !== "QB");
  const catchers = skill.filter((x) => x.tgt >= 5 && x.n >= minG).sort((a, b) => b.tgt / b.n - a.tgt / a.n).slice(0, 2);
  // the leaders in red-zone work always make the list, and are tagged as such
  const lead = (list, key, min) => list.filter((x) => x.rz && x.rz[key] >= min).sort((a, b) => b.rz[key] - a.rz[key] || b.tgt + b.car - (a.tgt + a.car))[0] || null;
  const rzLead = lead(skill, "rzTgt", 3), ezLead = lead(skill, "ezTgt", 2);
  for (const L of [rzLead, ezLead]) if (L && !catchers.includes(L)) catchers.push(L);
  const isBack = (x) => x.pos === "RB" || x.pos === "FB" || x.car > x.tgt;
  const backs = skill.filter((x) => x.car >= 5 && x.n >= minG && isBack(x)).sort((a, b) => b.car / b.n - a.car / a.n).slice(0, 1);
  const glLead = lead(skill.filter(isBack), "glCar", 3);
  if (glLead && !backs.includes(glLead)) backs.push(glLead);
  // A quarterback who runs (Allen, Hurts, Jackson) is part of the run game:
  // 4+ carries a game, or 3+ rushing TDs. Slots in right behind the lead back.
  if (qb && (qb.car / qb.n >= 4 || qb.rushTd >= 3)) backs.splice(Math.min(1, backs.length), 0, { ...qb, asRunner: true });
  const tagOf = (x) => [x === rzLead && x === ezLead ? "RZ + EZ leader" : x === rzLead ? "RZ leader" : x === ezLead ? "EZ leader" : null, x === glLead ? "GL leader" : null].filter(Boolean).join(" · ") || null;
  return { qb, catchers: catchers.map((x) => ({ ...x, tag: tagOf(x) })), backs: backs.map((x) => (x.asRunner ? x : { ...x, tag: tagOf(x) })) };
}
function MatchupBreakdown({ g, rows, stats, rz, through, players, onSelect }) {
  const n = Object.keys(rows || {}).length || 32, soft = n - 11;   // 21st or worse of 32
  const rowOf = (abbr) => { const k = Object.keys(rows || {}).find((x) => injTeamEq(x, abbr)); return k ? rows[k] : null; };
  const GOOD = "text-emerald-600 dark:text-emerald-400", BAD = "text-rose-600 dark:text-rose-400", MID = "text-slate-900 dark:text-white";
  const BAR_G = "bg-emerald-500", BAR_R = "bg-rose-500", BAR_N = "bg-slate-400 dark:bg-slate-500";
  const CHIP_G = "bg-emerald-500 text-white", CHIP_R = "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300", CHIP_N = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  // "good" always means good for the team WITH the ball: a top-10 offense, or
  // a defense ranked 21st or worse across from it. 11th-20th is neutral.
  const offGrade = (r) => (r == null ? 0 : r <= 10 ? 1 : r >= soft ? -1 : 0);
  const defGrade = (r) => (r == null ? 0 : r >= soft ? 1 : r <= 10 ? -1 : 0);
  const tone = (gr) => (gr > 0 ? GOOD : gr < 0 ? BAD : MID);
  const bar = (gr) => (gr > 0 ? BAR_G : gr < 0 ? BAR_R : BAR_N);
  const ord = (r) => (r == null ? "" : "(" + ordinal(r) + ")");
  const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
  const R = Math.round;
  // Vegas' expected points: half the over/under, plus half the spread for the
  // favourite and minus half for the underdog. Pre-game only.
  const vegas = (() => {
    const o = g.odds;
    if (!o || g.state !== "pre" || o.overUnder == null || o.spread == null) return null;
    const ou = Number(o.overUnder), sp = Math.abs(Number(o.spread));
    if (!isFinite(ou) || !isFinite(sp) || ou <= 0) return null;
    const homeFav = o.homeFav || (!o.awayFav && Number(o.spread) < 0);
    const fav = ou / 2 + sp / 2, dog = ou / 2 - sp / 2;
    return { home: homeFav ? fav : dog, away: homeFav ? dog : fav, homeBy: sp ? (homeFav ? sp : -sp) : 0 };
  })();
  const fullOf = (P) => { const key = hrbNrmSafe(P.name); return players.find((x) => hrbNrmSafe(x.name) === key) || null; };
  const lastName = (x) => { const parts = String(x.P.name).split(" "); return /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(parts[parts.length - 1] || "") ? parts.slice(-2, -1)[0] : parts[parts.length - 1]; };
  const cell = (v, lbl, hot) => (
    <span key={lbl} className="w-[2.6rem] shrink-0 text-center leading-none">
      <span className={"block text-[13px] font-black tabular-nums " + (hot ? "text-amber-500" : "text-slate-900 dark:text-white")}>{v}</span>
      <span className="block text-[7px] font-extrabold tracking-wider uppercase text-slate-400 mt-1">{lbl}</span>
    </span>
  );
  const person = (x, abbr, pos, sub, cells) => {
    const st = x.inj && x.inj.injury_status ? String(x.inj.injury_status).toUpperCase() : null;
    const full = fullOf(x.P);
    const initials = String(x.P.name).split(" ").map((w) => w[0]).slice(0, 2).join("");
    return (
      <button key={x.P.id + (x.asRunner ? "run" : "")} onClick={() => full && onSelect(full)} className="w-full flex items-center gap-2 px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-left active:bg-slate-50 dark:active:bg-slate-800">
        <Headshot p={full || { name: x.P.name }} abbr={abbr} className="w-9 h-9 max-w-none shrink-0 rounded-full object-cover object-top bg-slate-100 dark:bg-slate-800"
          fallback={<span className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-400">{initials}</span>} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-[12px] font-black text-slate-900 dark:text-white truncate">{x.P.name}</span>
            {st && <span className={"shrink-0 rounded px-1 py-px text-[7px] font-extrabold " + (st === "QUESTIONABLE" ? "bg-amber-500/20 text-amber-500" : "bg-rose-500/20 text-rose-500")}>{st.slice(0, 1)}</span>}
          </span>
          <span className="block text-[9px] font-semibold text-slate-400 truncate">
            <span className="font-extrabold text-slate-500 dark:text-slate-300">{pos}</span>
            {x.tag ? <span className="rounded px-1 py-px ml-1 text-[7px] font-extrabold uppercase tracking-wide bg-amber-500/20 text-amber-600 dark:text-amber-400">{x.tag}</span> : " · " + sub}
          </span>
        </span>
        <span className="flex shrink-0">{cells}</span>
      </button>
    );
  };
  // One stat row: the offense's number on the left, what the defense allows on
  // the right, a meter under each. Longer and greener is better for the offense.
  // perPlay = the defense's per-attempt / per-carry grade; when it says the
  // opposite of the per-game number (a losing team nobody needs to throw on),
  // the per-game colour is dropped rather than shown as a strength.
  const defShown = (dr, playRank) => {
    const dg = defGrade(dr), pp = playRank != null ? defGrade(playRank) : null;
    return pp != null && dg !== 0 && pp === -dg ? 0 : dg;
  };
  const line = (label, ov, or_, dv, dr, dg) => {
    const og = offGrade(or_);
    const edge = og > 0 && dg > 0, tough = dg < 0 && og <= 0, clash = og > 0 && dg < 0;
    const ow = or_ == null ? 0 : ((n + 1 - or_) / n) * 100, dw = dr == null ? 0 : (dr / n) * 100;
    return (
      <div key={label} className={"grid grid-cols-[1fr_4.75rem_1fr] items-center gap-x-1 px-3 py-1.5 " + (edge ? "bg-emerald-50 dark:bg-emerald-500/10" : "")}>
        <span className="min-w-0">
          <span className="block whitespace-nowrap leading-none"><span className={"text-[15px] font-black tabular-nums " + tone(og)}>{ov}</span> <span className="text-[9px] font-bold text-slate-400">{ord(or_)}</span></span>
          <span className="block mt-1 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><span className={"block h-full rounded-full " + bar(og)} style={{ width: ow + "%" }} /></span>
        </span>
        <span className="text-center leading-none">
          <span className="block text-[8px] font-extrabold tracking-widest uppercase text-slate-500 dark:text-slate-400">{label}</span>
          {edge ? <span className="block text-[8px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 mt-1">EDGE</span> : tough ? <span className="block text-[8px] font-black tracking-widest text-rose-500 mt-1">TOUGH</span> : clash ? <span className="block text-[7px] font-black tracking-wider text-amber-500 mt-1">BEST VS BEST</span> : null}
        </span>
        <span className="min-w-0 text-right">
          <span className="block whitespace-nowrap leading-none"><span className="text-[9px] font-bold text-slate-400">{ord(dr)}</span> <span className={"text-[15px] font-black tabular-nums " + tone(dg)}>{dv}</span></span>
          <span className="flex justify-end mt-1 h-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><span className={"block h-full rounded-full " + bar(dg)} style={{ width: dw + "%" }} /></span>
        </span>
      </div>
    );
  };
  // Is this side of the offense in a good spot? Count the colours on its two
  // rows (yards and touchdowns, offense and defense): each green number is +1,
  // each red is -1. +2 or better is a good spot, -2 or worse a tough one.
  const CHIP_g = "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300";
  const spotChip = (v) => <span className={"rounded-full px-2 py-0.5 text-[9px] font-extrabold tracking-wide whitespace-nowrap " + (v >= 2 ? CHIP_G : v === 1 ? CHIP_g : v <= -2 ? "bg-rose-500 text-white" : v === -1 ? CHIP_R : CHIP_N)}>{v >= 2 ? "GOOD SPOT" : v === 1 ? "SLIGHT EDGE" : v <= -2 ? "TOUGH SPOT" : v === -1 ? "SLIGHTLY TOUGH" : "EVEN"}</span>;
  const groupHead = (title, v) => (
    <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1.5">
      <span className="text-[10px] font-black tracking-widest uppercase text-slate-900 dark:text-white">{title}</span>
      {spotChip(v)}
    </div>
  );
  const side = (off, def, pts, by) => {
    const o = rowOf(off.abbr), d = rowOf(def.abbr);
    const pr = o ? o.rank.passRate : null;
    const identity = pr == null ? null : pr <= 8 ? "Pass-heavy" : pr >= n - 7 ? "Run-heavy" : "Balanced";
    const who = tapePlayers(stats, rz, through, off.abbr);
    const newQb = !!(who && who.qb && who.qb.n < 3);
    const dg = o && d ? { py: defShown(d.rank.defPassYds, d.rank.defPassYpa), pt: defGrade(d.rank.defPassTd), ry: defShown(d.rank.defRushYds, d.rank.defRushYpc), rt: defGrade(d.rank.defRushTd) } : { py: 0, pt: 0, ry: 0, rt: 0 };
    let passSpot = o && d ? offGrade(o.rank.offPassYds) + offGrade(o.rank.offPassTd) + dg.py + dg.pt : 0;
    const runSpot = o && d ? offGrade(o.rank.offRushYds) + offGrade(o.rank.offRushTd) + dg.ry + dg.rt : 0;
    if (newQb) passSpot = Math.min(passSpot, 0);   // the team's passing numbers aren't his
    // who to look at: at most three names, from the side(s) with an edge
    const runNames = [], passNames = [];
    const rzWork = (x) => (x.rz ? x.rz.rzTgt + x.rz.ezTgt + x.rz.rzCar + x.rz.glCar : 0);
    if (who && runSpot >= 1) for (const b of who.backs.slice(0, 2)) if (b.asRunner ? b.rushTd >= 3 || b.car / b.n >= 6 : b.car / b.n >= 12 || b.rushTd + b.recTd >= 3) runNames.push(lastName(b));
    if (who && passSpot >= 1) {
      if (who.qb && who.qb.passTd / who.qb.n >= 1.2) passNames.push(lastName(who.qb));
      for (const c of [...who.catchers].sort((a, b) => rzWork(b) - rzWork(a) || b.tgt / b.n - a.tgt / a.n)) if (passNames.length < 3 && (c.tgt / c.n >= 6 || c.recTd + c.rushTd >= 3 || c.tag)) passNames.push(lastName(c));
    }
    // the stronger side's players come first; the headline only names the side(s)
    // that actually earned the headline's grade
    const names = [];
    for (const x of (passSpot > runSpot ? [...passNames, ...runNames] : [...runNames, ...passNames])) if (names.length < 3 && !names.includes(x)) names.push(x);
    const best = Math.max(runSpot, passSpot), bar = best >= 2 ? 2 : 1;
    const which = runSpot >= bar && passSpot >= bar ? "run and pass" : runSpot >= bar ? "run game" : "passing game";
    const lean = best >= 2 ? "Good spot: " + which : best === 1 ? "Slight edge: " + which : runSpot <= -2 && passSpot <= -2 ? "Tough spot" : "No clear edge";
    const good = best >= 1;
    const base = off.color || teamColorSafe(off.abbr), l = lumOf(base || "#334155");
    const bg = l > 0.55 ? shade(base, -(l * 100 - 42)) : base;
    const logo = (lumOf(bg) < 0.5 ? darkLogo(off.abbr) : null) || off.logo || TEAM_LOGOS[off.abbr];
    return (
      <div key={off.abbr}>
        {/* broadcast-style team bar */}
        <div className="flex items-center gap-2.5 px-3 py-2 text-white" style={{ background: `linear-gradient(100deg, ${bg} 0%, ${bg} 60%, ${shade(bg, -18)} 100%)` }}>
          <img src={logo} alt="" className="w-9 h-9 object-contain shrink-0 drop-shadow" onError={(e) => { const f = off.logo || TEAM_LOGOS[off.abbr]; if (f && e.currentTarget.src !== f) e.currentTarget.src = f; }} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[13px] font-black tracking-wide uppercase truncate">{HELMET_NICK[off.abbr] || off.abbr} offense</div>
            {o && <div className="text-[10px] font-semibold text-white/80 truncate">{identity} · {R(o.val.passRate)}% pass {ord(pr)}{by ? (by > 0 ? ` · Fav −${by}` : ` · Dog +${-by}`) : ""}</div>}
          </div>
          {pts != null && <span className="shrink-0 text-center leading-none rounded-lg bg-black/25 px-2.5 py-1.5">
            <span className="block text-[15px] font-black tabular-nums">{f1(pts)}</span>
            <span className="block text-[7px] font-extrabold tracking-wider uppercase text-white/75 mt-0.5">Vegas pts</span>
          </span>}
        </div>
        {/* the one-line read */}
        {o && d && <div className={"flex items-center gap-2 px-3 py-2 " + (good ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-slate-50 dark:bg-slate-800/60")}>
          <span className={"shrink-0 text-[10px] font-black tracking-wide uppercase " + (good ? GOOD : runSpot <= -2 && passSpot <= -2 ? BAD : "text-slate-500 dark:text-slate-300")}>{lean}</span>
          {names.length > 0 && <span className="min-w-0 truncate text-[11px] font-bold text-slate-800 dark:text-slate-100">→ {names.slice(0, 3).join(", ")}</span>}
        </div>}
        {o && d ? (
          <>
            <div className="grid grid-cols-[1fr_4.75rem_1fr] gap-x-1 px-3 pt-2.5 pb-0.5 text-[8px] font-extrabold tracking-widest uppercase text-slate-400">
              <span>{off.abbr} offense</span><span /><span className="text-right">{def.abbr} defense allows</span>
            </div>
            {line("Pass yds/g", R(o.val.offPassYds), o.rank.offPassYds, R(d.val.defPassYds), d.rank.defPassYds, dg.py)}
            {line("Pass TD", o.val.offPassTd, o.rank.offPassTd, d.val.defPassTd, d.rank.defPassTd, dg.pt)}
            {line("Rush yds/g", R(o.val.offRushYds), o.rank.offRushYds, R(d.val.defRushYds), d.rank.defRushYds, dg.ry)}
            {line("Rush TD", o.val.offRushTd, o.rank.offRushTd, d.val.defRushTd, d.rank.defRushTd, dg.rt)}
          </>
        ) : <div className="px-3 py-2 text-[10px] text-slate-400">Team stats aren't in yet.</div>}
        {who && (who.qb || who.catchers.length > 0) && groupHead("Passing game", passSpot)}
        {who && who.qb && person(newQb ? { ...who.qb, tag: "New QB" } : who.qb, off.abbr, "QB", `${who.qb.n} game${who.qb.n === 1 ? "" : "s"}`, [
          cell(R(who.qb.passYds / who.qb.n), "Yds/g"), cell(f1(who.qb.passTd / who.qb.n), "TD/g"), cell(f1(who.qb.att / who.qb.n), "Att/g"), cell(`${who.qb.multiPassTd}/${who.qb.n}`, "2+ TD gm"),
        ])}
        {who && who.catchers.map((x) => person(x, off.abbr, x.pos || "WR", `TD in ${x.tdGames} of ${x.n}`, [
          cell(f1(x.tgt / x.n), "Tgt/g"), cell(x.recTd + x.rushTd, "TD"), cell(x.rz ? x.rz.rzTgt : "—", "RZ tgt", x.rz && /RZ/.test(x.tag || "")), cell(x.rz ? x.rz.ezTgt : "—", "EZ tgt", x.rz && /EZ/.test(x.tag || "")),
        ]))}
        {who && who.backs.length > 0 && groupHead("Run game", runSpot)}
        {who && who.backs.map((x) => person(x, off.abbr, x.asRunner ? "QB" : (x.pos || "RB"), x.asRunner ? `rush TD in ${x.P.games.filter((gm) => (gm.rushTd || 0) > 0).length} of ${x.n}` : `TD in ${x.tdGames} of ${x.n}`, [
          cell(f1(x.car / x.n), "Car/g"), cell(x.asRunner ? x.rushTd : x.rushTd + x.recTd, x.asRunner ? "Rush TD" : "TD"), cell(x.rz ? x.rz.rzCar : "—", "RZ car"), cell(x.rz ? x.rz.glCar : "—", "GL car", x.rz && /GL/.test(x.tag || "")),
        ]))}
        {!who && <div className="px-3 py-3 text-[10px] text-slate-400">No player stats yet.</div>}
        <div className="h-2" />
      </div>
    );
  };
  return (
    <div className="rounded-b-xl border border-t-0 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      {side(g.away, g.home, vegas ? vegas.away : null, vegas ? -vegas.homeBy : 0)}
      {side(g.home, g.away, vegas ? vegas.home : null, vegas ? vegas.homeBy : 0)}
      <div className="px-3 py-2 text-[9px] leading-snug text-slate-400 border-t border-slate-100 dark:border-slate-800">
        <span className={GOOD + " font-bold"}>Green</span> is good for the team with the ball (offense ranked 1st–10th, or defense ranked 21st–32nd), <span className={BAD + " font-bold"}>red</span> is the reverse, and gray is the middle (11th–20th). Good spot = at least two more green numbers than red on that side's two rows. Defense ranks: (1st) allows the fewest. RZ = inside the 20 · EZ = thrown into the end zone · GL = inside the 5.{through ? ` Through Week ${through}.` : ""}{rz ? "" : " Red-zone data is still loading."}
      </div>
    </div>
  );
}
function StatsTab({ players, onSelect, seasonStats, jump, onJumpUsed, backTo, onBack }) {
  // A right-swipe (or the back pill) returns to the team/player page a stat tile came from
  const swipe = useSwipe({ onRight: onBack || undefined });
  const [catId, setCatId] = useSticky("stats.cat", "passing");
  const [statKey, setStatKey] = useSticky("stats.key", null);
  const [posPick, setPosPick] = useSticky("stats.pos", "ALL");
  const [hilite, setHilite] = useState(null);   // normalized name of the row we jumped to
  const [teamHilite, setTeamHilite] = useState(null); // team abbr we jumped to (Teams board)
  const rowRef = useRef(null);
  // A tap on a player-page stat lands here: switch the board to that stat and
  // position group, then scroll his row into the middle of the screen.
  useEffect(() => {
    if (!jump) return;
    if (jump.teamStat) {
      // a team-page tile: open the Teams board on that stat, find the team
      setCatId("teams"); setStatKey(jump.teamStat); setPosPick("ALL");
      setHilite(null); setTeamHilite(jump.team);
      onJumpUsed && onJumpUsed();
      return;
    }
    const j = STAT_JUMP[jump.key];
    if (!j) return;
    setTeamHilite(null);
    setCatId(j[0]); setStatKey(j[1]);
    const c = LEADER_CATS.find((x) => x.id === j[0]);
    setPosPick(c && c.positions && c.positions.includes(jump.pos) ? jump.pos : "ALL");
    setHilite(hrbNrmSafe(jump.name));
    onJumpUsed && onJumpUsed();
  }, [jump]);
  useEffect(() => {
    if ((!hilite && !teamHilite) || !rowRef.current) return;
    const t = setTimeout(() => rowRef.current && rowRef.current.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
    return () => clearTimeout(t);
  }, [hilite, teamHilite, catId, statKey, posPick]);
  const cat = LEADER_CATS.find((c) => c.id === catId);
  const key = statKey && cat.stats.some(([k]) => k === statKey) ? statKey : cat.stats[0][0];
  const teamRows = useMemo(() => (cat.id === "teams" ? teamLeaderRows(seasonStats, key) : []), [seasonStats, catId, key]);
  const rows = useMemo(() => {
    if (cat.id === "teams") return [];
    const all = Object.values((seasonStats && seasonStats.players) || {});
    const grp = (P) => posGroup(P.pos);
    const inCat = (P) => {
      const g = grp(P);
      if (cat.id === "passing") return g === "QB";
      if (cat.id === "defense") return g === "DEF";
      if (cat.id === "fantasy") return ["QB", "RB", "WR", "TE"].includes(g) && (posPick === "ALL" || g === posPick);
      return ["QB", "RB", "WR", "TE"].includes(g) && (posPick === "ALL" || g === posPick);
    };
    const val = (P) => (key === "fpts" ? fantasyPts(P.totals) : (P.totals[key] || 0));
    const sorted = all.filter((P) => P.totals && P.totals.gp && inCat(P) && val(P) > 0)
      .map((P) => ({ P, v: val(P) }))
      .sort((a, b) => b.v - a.v);
    // ranks are shared: same value, same number, flagged as a tie
    let lastV = null, lastR = 0;
    sorted.forEach((row, i) => {
      if (row.v !== lastV) { lastR = i + 1; lastV = row.v; }
      row.rank = lastR;
    });
    for (const row of sorted) row.tie = sorted.filter((o) => o.v === row.v).length > 1;
    // if we jumped to a player outside the top 50, extend the list far enough to show him
    const hi = sorted.findIndex((r) => hrbNrmSafe(r.P.name) === hilite);
    return sorted.slice(0, Math.max(50, hi + 1));
  }, [seasonStats, catId, key, posPick, hilite]);
  const yr = seasonStats ? seasonStats.season : "";
  const findP = (P) => players.find((p) => hrbNrmSafe(p.name) === hrbNrmSafe(P.name));
  const statLabel = cat.stats.find(([k]) => k === key)?.[1] || key;
  const fmt = (v) => (key === "fpts" || key === "ypcar" ? Number(v).toFixed(1) : v);
  return (
    <div {...swipe}>
      <div className="bg-blue-600 pb-3 px-4 text-white sticky top-0 z-10 shadow-md" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        {backTo && onBack && <button onClick={onBack} className="text-sm font-semibold opacity-90 mb-1 block">‹ {backTo}</button>}
        <div className="flex items-baseline gap-2"><h1 className="text-xl font-extrabold">Leaders</h1><span className="text-[11px] font-semibold text-blue-200">{yr}{seasonStats && seasonStats.weeksWithGames ? ` · thru Wk ${seasonStats.weeksWithGames}` : ""}</span></div>
        <div className="flex gap-1.5 mt-3">
          {LEADER_CATS.map((c) => (
            <button key={c.id} onClick={() => { setCatId(c.id); setStatKey(null); setPosPick("ALL"); setHilite(null); setTeamHilite(null); }}
              className={"flex-1 py-1.5 rounded-full text-[10px] font-extrabold " + (catId === c.id ? "bg-white text-blue-700" : "bg-blue-500/60 text-blue-100")}>{c.label}</button>
          ))}
        </div>
        <div className="flex gap-1.5 mt-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {cat.stats.map(([k, lbl]) => (
            <button key={k} onClick={() => setStatKey(k)}
              className={"shrink-0 px-3 py-1 rounded-full text-[10px] font-bold " + (key === k ? "bg-white/90 text-blue-700" : "bg-blue-700/50 text-blue-100")}>{lbl}</button>
          ))}
        </div>
        {cat.positions && (
          <div className="flex gap-1.5 mt-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {["ALL", ...cat.positions].map((k) => (
              <button key={k} onClick={() => setPosPick(k)}
                className={"shrink-0 px-3 py-1 rounded-full text-[10px] font-bold " + (posPick === k ? "bg-white/90 text-blue-700" : "bg-blue-700/50 text-blue-100")}>{k === "ALL" ? "All" : k}</button>
            ))}
          </div>
        )}
      </div>
      <div className="px-4 pt-3">
        {!seasonStats && <Loader label="Loading leaders" />}
        {seasonStats && catId === "teams" && (
          teamRows.length === 0 ? <div className="text-center text-xs text-slate-400 py-10">No {yr} team stats yet.</div> : (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">Team</span>
                <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">{statLabel}{key === "ppg" ? " · ranked per game" : key === "papg" ? " · fewest per game" : key === "ydsAgainst" ? " · fewest first" : ""}</span>
              </div>
              {teamRows.map((r, i) => {
                const pct = key === "passRate";
                const perGame = ["ppg", "papg", "ydsFor", "ydsAgainst", "offPassYds", "offRushYds", "defPassYds", "defRushYds"].includes(key);
                const v = pct || perGame ? r.val[key].toFixed(1) : Math.round(r.val[key]);
                const on = teamHilite && injTeamEq(r.abbr, teamHilite);
                // bars scale against the best value; on "allowed" boards the best is the smallest
                const best = teamRows[0].val[key], worst = teamRows[teamRows.length - 1].val[key];
                const asc = key === "papg" || key === "ydsAgainst" || key.startsWith("def");
                const width = asc ? (worst ? (1 - (r.val[key] - best) / ((worst - best) || 1)) * 100 : 100) : (r.val[key] / (best || 1)) * 100;
                return (
                  <div key={r.abbr} ref={on ? rowRef : undefined} className={"px-3 py-2 flex items-center gap-2.5 " + (on ? "bg-slate-200/80 dark:bg-slate-700/60" : "")}>
                    <div className={"w-8 text-center shrink-0 " + ((r.rank || i + 1) <= 3 ? "text-blue-600" : "text-slate-400")}>
                      <div className="text-[13px] font-black tabular-nums leading-none">{r.rank || i + 1}</div>
                      {r.tie && <div className="text-[7px] font-bold lowercase tracking-wide opacity-70">tie</div>}
                    </div>
                    {TEAM_LOGOS[r.abbr] && <img src={TEAM_LOGOS[r.abbr]} alt="" className="w-9 h-9 object-contain shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-extrabold text-slate-900 dark:text-white">{TEAM_NAMES[r.abbr] || r.abbr}</div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: Math.max(3, width) + "%", backgroundColor: teamColorSafe(r.abbr) }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {key === "ppg" || key === "papg" ? <>
                        <div className="text-lg font-black tabular-nums text-slate-900 dark:text-white leading-none">{key === "ppg" ? r.val.pfTot : r.val.paTot}</div>
                        <div className="text-[9px] font-semibold tabular-nums text-slate-400 mt-0.5">{v} /G</div>
                      </> : <>
                        <div className="text-lg font-black tabular-nums text-slate-900 dark:text-white leading-none">{v}{pct ? "%" : ""}</div>
                        <div className="text-[9px] font-semibold tabular-nums text-slate-400 mt-0.5">{r.gp} GP</div>
                      </>}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
        {seasonStats && catId !== "teams" && rows.length === 0 && <div className="text-center text-xs text-slate-400 py-10">No {yr} stats yet for this filter.</div>}
        {rows.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60">
              <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">Player</span>
              <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">{statLabel}{key !== "fpts" && key !== "ypcar" ? " · per game" : ""}</span>
            </div>
            {rows.map(({ P, v, rank, tie }, i) => {
              const p = findP(P);
              const pg = P.totals.gp ? v / P.totals.gp : null;
              const on = hilite && hrbNrmSafe(P.name) === hilite;
              return (
                <button key={P.id} ref={on ? rowRef : undefined} onClick={p ? () => onSelect(p) : undefined}
                  className={"w-full text-left pr-3 py-2 flex items-center gap-2.5 active:bg-slate-50 dark:active:bg-slate-800/60 " + (on ? "bg-slate-200/80 dark:bg-slate-700/60" : "")}>
                  <div className="self-stretch w-1 rounded-r" style={{ backgroundColor: teamColor(P.team) }} />
                  <div className={"w-8 text-center shrink-0 " + ((rank || i + 1) <= 3 ? "text-blue-600" : "text-slate-400")}>
                    <div className="text-[13px] font-black tabular-nums leading-none">{rank || i + 1}</div>
                    {tie && <div className="text-[7px] font-bold lowercase tracking-wide opacity-70">tie</div>}
                  </div>
                  <img src={`https://a.espncdn.com/i/headshots/nfl/players/full/${P.id}.png`} alt="" className="w-10 h-10 rounded-full object-cover object-top bg-white shrink-0 ring-2 ring-white dark:ring-slate-800 shadow" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">{P.name}</div>
                    <div className="flex items-center gap-1 mt-0.5">{TEAM_LOGOS[P.team] && <img src={chipLogo(P.team)} alt="" className="w-3.5 h-3.5 rounded-full object-contain p-px" style={logoChip(P.team)} onError={(e) => { e.currentTarget.src = TEAM_LOGOS[P.team] || ""; }} />}<span className="text-[10px] font-semibold text-slate-400">{P.team}</span></div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-black tabular-nums text-slate-900 dark:text-white leading-none">{fmt(v)}</div>
                    {pg != null && key !== "ypcar" && <div className="text-[9px] font-semibold tabular-nums text-slate-400 mt-0.5">{(key === "fpts" ? pg.toFixed(1) : Number.isInteger(pg) ? pg : pg.toFixed(1))}/g</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="text-[9px] text-slate-400 mt-2 px-1">{catId === "teams" ? "Pass rate = pass attempts ÷ total plays — the quickest read on an offense's identity. " : ""}{catId === "fantasy" ? "PPR scoring: 1 pt per 25 pass yds · 4 per pass TD · −2 per INT · 1 per 10 rush/rec yds · 6 per rush/rec TD · 1 per catch. " : ""}Every box score this season, including games in progress. Tap a player in your Airtable to open his page.</div>
      </div>
    </div>
  );
}

// ═══════════════ TD BOARD ════════════════════════════════════════
// Weekly anytime-TD board. Each card is "player vs this week's defense":
//   rank · headshot · POS Name · [opp logo] vs OPP
//   ROLE | OPP vs POS: TD/G · YDS/G | TD SHARE · IMP TOTAL |  big TD%
// Real data only — if the endpoint isn't live, the tab says so plainly.
// Rank colors on the opponent tiles: high rank number = defense allows a
// lot to this position = good for the scorer (green).
const rankTile = (rank) => (rank == null ? "bg-slate-100 text-slate-400 dark:bg-slate-800"
  : rank >= 23 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
  : rank >= 11 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
  : "bg-rose-500/15 text-rose-600 dark:text-rose-400");
const valTile = (val, good, ok) => (val == null ? "bg-slate-100 text-slate-400 dark:bg-slate-800"
  : val >= good ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
  : val >= ok ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
  : "bg-rose-500/15 text-rose-600 dark:text-rose-400");

const LOCKED_STATS = {};   // `${season}:${week}` -> season stats through the prior week
function TdBoardTab({ players, teams, onSelect, navTick, seasonStats }) {
  // Tale-of-the-tape numbers freeze for the whole week: they use games through
  // the previous week only, so a 1pm game can't change a 4pm team's ranks.
  const [locked, setLocked] = useState(null);
  const [openTape, setOpenTape] = useSticky("week.tape", {});   // game id -> dropdown open
  const [board, setBoard] = useState(null);
  const [sb, setSb] = useState(null);
  const [seg, setSeg] = useSticky("week.seg", "matchups");
  const [digestWeek, setDigestWeek] = useState(null);
  const [selGame, setSelGame] = useState(null);
  // The bottom nav lives outside this tab, so it can't reach selGame directly.
  // Every nav tap bumps navTick; the open game closes in response.
  useEffect(() => { if (navTick) setSelGame(null); }, [navTick]);
  const [digest, setDigest] = useState(null);       // { week, stats, games }
  const [history, setHistory] = useState(null);
  const [bet, setBet] = useState("ml"); // ml | td | props
  const [nextSb, setNextSb] = useState(null); // next week's board, for lines once this week ends
  const season = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  useEffect(() => {
    if (seg !== "digest") return;
    const w = digestWeek ?? (sb?.week ?? 1);
    let alive = true;
    setDigest(null);
    Promise.all([
      fetch(`/api/week-stats?season=${season}&week=${w}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/scoreboard?week=${w}`).then((r) => r.json()).catch(() => null),
    ]).then(([stats, games]) => { if (alive) setDigest({ week: w, stats, games }); });
    return () => { alive = false; };
  }, [seg, digestWeek, sb?.week]);
  // Lines disappear from a game once it's final, so when the slate is done we
  // pull the following week to keep the Moneyline tab useful.
  useEffect(() => {
    if (!sb || !sb.games || !sb.games.length) return;
    const allDone = sb.games.every((g) => g.state === "post");
    if (!allDone || nextSb) return;
    fetch(`/api/scoreboard?week=${(sb.week || 1) + 1}`).then((r) => r.json()).then((d) => { if (d && d.games) setNextSb(d); }).catch(() => {});
  }, [sb, nextSb]);
  // Stats locked through LAST week, loaded as soon as the week is known.
  const lockWk = sb ? (sb.week || 1) : null;
  const lockYr = sb ? (sb.season || (seasonStats && seasonStats.season) || new Date().getFullYear()) : null;
  useEffect(() => {
    if (!lockWk || !lockYr) return;
    const key = `${lockYr}:${lockWk}`;
    if (LOCKED_STATS[key]) { setLocked(LOCKED_STATS[key]); return; }
    setLocked(null);
    if (lockWk <= 1) return;   // week 1: nothing to lock to, use what's there
    let alive = true;
    fetch(`/api/season-stats?season=${lockYr}&through=${lockWk - 1}`).then((r) => r.json())
      .then((d) => { if (d && d.players) { LOCKED_STATS[key] = d; if (alive) setLocked(d); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [lockWk, lockYr]);
  const rz = useRedzone(lockYr);                       // whole season; weeks filtered client-side
  const tapeStats = locked || seasonStats;
  const tapeThrough = locked && lockWk ? lockWk - 1 : null;
  const tape = useMemo(() => tapeRows(tapeStats), [tapeStats]);
  useEffect(() => {
    if (history) return;
    fetch(`/api/td?mode=history&season=${season}`).then((r) => r.json()).then(setHistory).catch(() => setHistory({ weeks: [], error: "unreachable" }));
  }, []);
  useEffect(() => {
    fetch("/api/td").then((r) => r.json()).then(setBoard).catch(() => setBoard({ ready: false, cards: [], reason: "Couldn't reach the board endpoint." }));
  }, []);
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/scoreboard").then((r) => r.json()).then((d) => { if (alive && d && d.games) setSb(d); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const live = board && board.ready;
  const cards = live ? board.cards : [];
  const findPlayer = (c) => players.find((p) => hrbNrmSafe(p.name) === hrbNrmSafe(c.name));
  const week = sb?.week ?? board?.week ?? 1;
  // Live games first (two-minute drills at the very top), then upcoming by
  // kickoff, finals at the bottom. Day labels ride inside each section.
  const isTwoMin = (g) => { if (g.state !== "in") return false; const [m, sec] = String(g.clock || "").split(":").map(Number); return (g.period === 2 || g.period === 4) && Number.isFinite(m) && m * 60 + (sec || 0) <= 120; };
  const gamesByDay = useMemo(() => {
    const games = [...(sb?.games || [])];
    const bucket = (g) => (g.state === "in" ? 0 : g.state === "pre" ? 1 : 2);
    games.sort((a, b) => bucket(a) - bucket(b) || (isTwoMin(b) ? 1 : 0) - (isTwoMin(a) ? 1 : 0) || new Date(a.date) - new Date(b.date));
    const out = [];
    for (const g of games) {
      const b = bucket(g);
      const day = new Date(g.date).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
      const key = b === 0 ? "● Live" : b === 2 ? "Final · " + day : day;
      let grp = out.find((x) => x.key === key);
      if (!grp) { grp = { key, live: b === 0, games: [] }; out.push(grp); }
      grp.games.push(g);
    }
    return out;
  }, [sb]);

  if (selGame) {
    const order = gamesByDay.flatMap((grp) => grp.games);
    const i = order.findIndex((x) => x.id === selGame.id);
    return <GameDetail game={selGame} teams={teams} onBack={() => setSelGame(null)}
      onPrev={i > 0 ? () => setSelGame(order[i - 1]) : null} onNext={i !== -1 && i < order.length - 1 ? () => setSelGame(order[i + 1]) : null}
      index={i + 1} total={order.length} />;
  }
  return (
    <div>
      <style>{`@keyframes hrbBlink { 0%,100% { opacity: 1 } 50% { opacity: .25 } } @keyframes hrbSoftPulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.55 } } @keyframes hrbSpin { 0% { transform: rotate(-20deg) translateY(0) } 50% { transform: rotate(20deg) translateY(-10px) } 100% { transform: rotate(-20deg) translateY(0) } }`}</style>
      <div className="bg-blue-600 pb-3 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="text-xl font-extrabold text-white">Week {seg === "digest" ? (digestWeek ?? week) : week} <span className="text-[10px] font-bold text-white/60 align-middle">{NFL_VERSION}</span></h1>
          <span className="text-[11px] font-semibold text-blue-200">
            {seg === "matchups"
              ? (sb ? "scores " + new Date(sb.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " ↻" : "loading…")
              : (live ? "v1 · " + new Date(board.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "v1")}
          </span>
        </div>
      </div>
      <div className="px-4 pt-3">
        <div className="flex gap-2 mb-3">
          {[["matchups", "Matchups"], ["digest", "Digest"], ["bets", "Bets"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setSeg(k)}
              className={"flex-1 py-1.5 rounded-full text-xs font-bold " + (seg === k ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>
              {lbl}
            </button>
          ))}
        </div>

        {seg === "matchups" ? (
          <>
            {!sb && <Loader label="Loading games" />}
            {sb && sb.games.length === 0 && <div className="p-6 text-center text-xs text-slate-400">No games scheduled this week.</div>}
            {gamesByDay.map((grp) => (
              <div key={grp.key} className="mb-4">
                {grp.live
                  ? <div className="mb-1.5"><RedTag pulse className="h-[18px] text-[9px] px-2.5">LIVE</RedTag></div>
                  : <div className="text-[10px] font-semibold tracking-widest uppercase mb-1.5 text-slate-400">{grp.key}</div>}
                <div className="space-y-3">
                  {grp.games.map((g) => {
                    const open = !!openTape[g.id];
                    return (
                      <div key={g.id}>
                        <MatchCard g={g} onClick={() => setSelGame(g)} />
                        <button onClick={() => setOpenTape((o) => ({ ...o, [g.id]: !o[g.id] }))} aria-expanded={open}
                          className={"w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-extrabold tracking-widest uppercase border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 " + (open ? "rounded-t-xl text-blue-600 dark:text-blue-400" : "rounded-xl text-slate-500 dark:text-slate-400")}>
                          Matchup breakdown <span className={"text-[11px] leading-none transition-transform " + (open ? "rotate-180" : "")}>▾</span>
                        </button>
                        {open && <MatchupBreakdown g={g} rows={tape} stats={tapeStats} rz={rz} through={tapeThrough} players={players} onSelect={onSelect} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        ) : seg === "digest" ? (() => {
          const wk = digestWeek ?? week;
          const weeksList = Array.from({ length: Math.max(1, sb?.week ?? 1) }, (_, i) => i + 1);
          const st = digest && digest.stats, gm = digest && digest.games;
          const plist = st && st.players ? Object.values(st.players) : [];
          const top = (k, n = 8) => plist.map((p) => ({ p, v: p.games.reduce((a, g) => a + (g[k] || 0), 0), g: p.games[0] })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, n);
          const tdList = plist.map((p) => ({ p, v: p.games.reduce((a, g) => a + (g.rushTd || 0) + (g.recTd || 0), 0), g: p.games[0] })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);
          const teamsArr = st && st.teams ? Object.entries(st.teams) : [];
          const defWorst = teamsArr.map(([a, t]) => ({ a, y: (t.def.passYds || 0) + (t.def.rushYds || 0), pa: t.pa })).sort((x, y) => y.y - x.y).slice(0, 5);
          const defBest = teamsArr.map(([a, t]) => ({ a, y: (t.def.passYds || 0) + (t.def.rushYds || 0), pa: t.pa })).sort((x, y) => x.y - y.y).slice(0, 5);
          const Row = ({ x, val }) => (
            <div className="flex items-center gap-2 py-1.5 text-[12px]">
              {TEAM_LOGOS[x.p.team] && <img src={chipLogo(x.p.team)} alt="" className="w-4 h-4 rounded-full object-contain p-px" style={logoChip(x.p.team)} />}
              <span className="flex-1 truncate font-bold text-slate-800 dark:text-slate-100">{x.p.name}<span className="text-slate-400 font-medium"> {x.p.pos || ""} · {x.p.team}{x.g ? " vs " + x.g.opp : ""}</span></span>
              <span className="font-extrabold tabular-nums text-slate-700 dark:text-slate-200">{val}</span>
            </div>
          );
          const Card = ({ title, children }) => (
            <div className="mb-3">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">{title}</div>
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1 divide-y divide-slate-100 dark:divide-slate-800">{children}</div>
            </div>
          );
          return (
            <>
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: "none" }}>
                {weeksList.map((w) => (
                  <button key={w} onClick={() => setDigestWeek(w)}
                    className={"shrink-0 px-3 py-1 rounded-full text-[11px] font-bold " + (wk === w ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>Wk {w}</button>
                ))}
              </div>
              {!digest && <div className="p-6 text-center text-xs text-slate-400">Building the Week {wk} digest…</div>}
              {digest && (!st || !st.gamesFinal) && <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-400">No finished games in Week {wk} yet — the digest fills in as games go final.</div>}
              {digest && st && st.gamesFinal > 0 && (
                <>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">{st.gamesFinal} of {st.gamesScheduled} games final.</div>
                  {gm && gm.games && (
                    <div className="mb-3">
                      <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">Scores</div>
                      <div className="space-y-1.5">
                        {gm.games.filter((g) => g.state !== "pre").map((g) => <MatchCard key={g.id} g={g} onClick={() => setSelGame(g)} />)}
                      </div>
                    </div>
                  )}
                  <Card title="Touchdown scorers">{tdList.map((x) => <Row key={x.p.id} x={x} val={x.v + " TD"} />)}</Card>
                  <Card title="Most targets">{top("tgt").map((x) => <Row key={x.p.id} x={x} val={x.v} />)}</Card>
                  <Card title="Most carries">{top("car").map((x) => <Row key={x.p.id} x={x} val={x.v} />)}</Card>
                  <Card title="Passing yards">{top("passYds", 6).map((x) => <Row key={x.p.id} x={x} val={x.v} />)}</Card>
                  <Card title="Defenses that got gashed · total yds allowed">
                    {defWorst.map((d) => <div key={d.a} className="flex items-center justify-between py-1.5 text-[12px]"><span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">{TEAM_LOGOS[d.a] && <img src={chipLogo(d.a)} alt="" className="w-4 h-4 rounded-full object-contain p-px" style={logoChip(d.a)} />}{d.a}</span><span className="font-extrabold tabular-nums text-rose-500">{d.y} yds · {d.pa} pts</span></div>)}
                  </Card>
                  <Card title="Defenses that shut it down">
                    {defBest.map((d) => <div key={d.a} className="flex items-center justify-between py-1.5 text-[12px]"><span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">{TEAM_LOGOS[d.a] && <img src={chipLogo(d.a)} alt="" className="w-4 h-4 rounded-full object-contain p-px" style={logoChip(d.a)} />}{d.a}</span><span className="font-extrabold tabular-nums text-emerald-500">{d.y} yds · {d.pa} pts</span></div>)}
                  </Card>
                </>
              )}
            </>
          );
        })() : (
          <>
            <div className="flex gap-2 mb-3">
              {[["ml", "Moneyline"], ["td", "Touchdowns"], ["props", "Props"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setBet(k)}
                  className={"flex-1 py-1.5 rounded-full text-[11px] font-extrabold " + (bet === k ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800")}>{lbl}</button>
              ))}
            </div>
            {bet === "ml" && (() => {
              // American odds -> implied win probability (vig included)
              const prob = (ml) => (ml == null ? null : ml < 0 ? (-ml) / (-ml + 100) : 100 / (ml + 100));
              const withOdds = (d) => (d?.games || []).filter((g) => g.odds && (g.odds.homeML != null || g.odds.awayML != null || g.odds.details));
              const thisWk = withOdds(sb), nextWk = withOdds(nextSb);
              const useNext = thisWk.filter((g) => g.state !== "post").length === 0 && nextWk.length > 0;
              const games = useNext ? nextWk : thisWk;
              const shownWeek = useNext ? (nextSb.week || (sb.week || 1) + 1) : (sb?.week || week);
              if (!sb) return <Loader label="Loading lines" />;
              if (!games.length) return <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-400">No lines posted yet — books usually hang the next week's numbers by Monday night.</div>;
              const fmtML = (ml) => (ml == null ? "—" : ml > 0 ? "+" + ml : String(ml));
              return (
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 text-[9px] font-semibold tracking-widest uppercase text-slate-400"><span>Week {shownWeek}</span><span className="w-12 text-right">ML</span><span className="w-10 text-right">Win%</span><span className="w-12 text-right">Spread</span></div>
                  {games.map((g) => {
                    const o = g.odds; const pa = prob(o.awayML), ph = prob(o.homeML);
                    const norm = pa != null && ph != null ? pa + ph : null;
                    const Row = ({ t, ml, p, fav }) => (
                      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center py-1">
                        <span className="flex items-center gap-2 min-w-0">{TEAM_LOGOS[t.abbr] && <img src={chipLogo(t.abbr, t.logo)} alt="" className="w-6 h-6 rounded-full object-contain p-0.5" style={logoChip(t.abbr)} />}<span className={"text-[12px] font-extrabold truncate " + (g.state === "post" ? (t.winner ? "text-emerald-600" : "text-slate-400") : "text-slate-900 dark:text-white")}>{t.abbr}</span>{g.state === "post" && <span className="text-[11px] font-bold tabular-nums text-slate-500">{t.score}</span>}</span>
                        <span className={"w-12 text-right text-[12px] font-extrabold tabular-nums " + (ml != null && ml < 0 ? "text-slate-900 dark:text-white" : "text-slate-500")}>{fmtML(ml)}</span>
                        <span className="w-10 text-right text-[11px] font-bold tabular-nums text-slate-500">{p != null ? Math.round((norm ? p / norm : p) * 100) + "%" : "—"}</span>
                        <span className="w-12 text-right text-[11px] font-bold tabular-nums text-slate-500">{fav && o.spread != null ? (o.spread > 0 ? "-" + o.spread : String(o.spread)) : ""}</span>
                      </div>
                    );
                    return (
                      <button key={g.id} onClick={() => setSelGame(g)} className="w-full text-left px-3 py-2 active:bg-slate-50 dark:active:bg-slate-800/60">
                        <Row t={g.away} ml={o.awayML} p={pa} fav={o.awayFav} />
                        <Row t={g.home} ml={o.homeML} p={ph} fav={o.homeFav} />
                        <div className="text-[9px] text-slate-400 mt-1 flex justify-between"><span>{new Date(g.date).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}{g.state === "in" ? " · LIVE" : g.state === "post" ? " · Final" : ""}</span><span>{o.details}{o.overUnder != null ? ` · O/U ${o.overUnder}` : ""}</span></div>
                      </button>
                    );
                  })}
                  <div className="px-3 py-2 text-[9px] text-slate-400">Win% is the market's implied probability from the moneyline, with the vig removed. Lines from ESPN; they move until kickoff.</div>
                </div>
              );
            })()}
            {bet === "props" && <PropsBoard />}
            {bet === "td" && (() => {
              // Once the Thursday-morning snapshot exists for this week, the board is
              // LOCKED to it —
              // graded against what's happened so far. The live recompute only shows pre-lock.
              const locked = history && history.weeks ? history.weeks.find((w) => w.week === week) : null;
              if (locked) {
                const hits = locked.picks.filter((p) => p.hit).length, played = locked.picks.filter((p) => p.hit != null).length;
                return (
                  <>
                    <div className="mb-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-2 flex items-center justify-between">
                      <div><div className="text-[10px] font-extrabold tracking-widest uppercase">Week {week} board · locked</div><div className="text-[10px] opacity-70">Snapshotted before kickoff — this is what gets graded.</div></div>
                      <div className="text-right"><div className="text-lg font-black tabular-nums leading-none">{hits}<span className="text-xs opacity-60">/{played}</span></div><div className="text-[9px] opacity-70">hit · {locked.expected} exp.</div></div>
                    </div>
                    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                      {locked.picks.map((p) => (
                        <div key={p.rank + p.player} className={"px-3 py-2 flex items-center gap-2 " + (p.hit ? "bg-emerald-50/60 dark:bg-emerald-900/10" : "")}>
                          <span className="w-5 text-xs font-extrabold text-slate-400 tabular-nums">{p.rank}</span>
                          <div className="flex-1 min-w-0"><div className="text-[12px] font-extrabold text-slate-900 dark:text-white truncate">{p.player}</div><div className="text-[9px] text-slate-400">{p.team} vs {p.opp}{p.tds != null ? ` · ${p.tds} TD` : p.played ? "" : " · not yet played"}</div></div>
                          <span className="text-[11px] font-bold tabular-nums text-slate-500">{Math.round((p.tdPct || 0) * 100)}%</span>
                          <span className={"w-5 text-center text-base font-black " + (p.hit == null ? "text-slate-300" : p.hit ? "text-emerald-500" : "text-rose-400")}>{p.hit == null ? "·" : p.hit ? "✓" : "✗"}</span>
                        </div>
                      ))}
                    </div>
                  </>
                );
              }
              return null;
            })()}
            {bet === "td" && !(history && history.weeks && history.weeks.find((w) => w.week === week)) && (
              <>
                {!board && <div className="p-6 text-center text-xs text-slate-400">Building this week's board…</div>}
            {board && !live && (
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Board isn't live yet</div>
                <div className="text-[11px] text-slate-400 mt-1">{board.reason || "The data source didn't return player stats."} Nothing is shown rather than guessed numbers.</div>
              </div>
            )}
            {live && (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {cards.map((c, i) => {
                  const p = findPlayer(c);
                  const pct = Math.round((c.tdPct || 0) * 100);
                  return (
                    <button key={c.sleeperId || c.name + i} onClick={p ? () => onSelect(p) : undefined}
                      className="w-full text-left px-3 py-2 active:bg-slate-50 dark:active:bg-slate-800/60">
                      {/* row 1: rank · headshot · POS Name · vs OPP */}
                      <div className="flex items-center gap-2">
                        <div className="w-4 text-xs font-extrabold text-slate-400 tabular-nums">{i + 1}</div>
                        {p ? <Avatar p={p} size="sm" /> : <img src={c.headshot} alt="" className="w-9 h-9 rounded-full object-cover object-top bg-white" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}
                        {TEAM_LOGOS[c.team] && <img src={chipLogo(c.team)} alt="" className="w-5 h-5 rounded-full object-contain p-px shrink-0" style={logoChip(c.team)} />}
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-extrabold text-slate-900 dark:text-white truncate">
                            {c.name}
                            {c.injury && <span className="ml-2 text-[9px] font-extrabold uppercase text-rose-500">{c.injury}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                          {TEAM_LOGOS[c.opp] && <img src={chipLogo(c.opp)} alt="" className="w-4 h-4 rounded-full object-contain p-px" style={logoChip(c.opp)} />}
                          <span>{(c.home ? "vs " : "@ ") + c.opp}</span>
                        </div>
                      </div>
                      {/* row 2: role | opponent vs position | player | TD% */}
                      <div className="mt-1.5 flex items-end gap-1.5">
                        <div className="w-9 text-center shrink-0">
                          <div className="text-[7px] font-semibold text-slate-400 tracking-wider">ROLE</div>
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white">{c.role || c.pos}</div>
                        </div>
                        <div className="w-px h-7 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                        <div className="flex-1 grid grid-cols-4 gap-1.5">
                          {[
                            [c.opp + " TD/G vs " + c.pos, c.oppTdAllowedPg != null ? c.oppTdAllowedPg.toFixed(1) : "—", rankTile(c.oppTdRank), c.oppTdRank ? ordinal(c.oppTdRank) : ""],
                            [c.opp + " YDS/G vs " + c.pos, c.oppYdsAllowedPg != null ? c.oppYdsAllowedPg : "—", rankTile(c.oppYdsRank), c.oppYdsRank ? ordinal(c.oppYdsRank) : ""],
                            ["TD SHARE", c.tdShare != null ? Math.round(c.tdShare * 100) + "%" : "—", valTile(c.tdShare, 0.22, 0.14), c.tdsLastSeason != null ? c.tdsLastSeason + " TD '" + String(board.baseSeason).slice(2) : ""],
                            ["IMP TOTAL", c.implTotal != null ? c.implTotal.toFixed(1) : "—", valTile(c.implTotal, 24, 20), c.spread != null ? (c.spread > 0 ? "+" + c.spread : String(c.spread)) : ""],
                          ].map(([lbl, val, cls, sub]) => (
                            <div key={lbl} className="text-center min-w-0">
                              <div className="text-[7px] font-semibold text-slate-400 tracking-wider truncate">{lbl}</div>
                              <div className={"mt-0.5 rounded-md py-0.5 text-[11px] font-extrabold tabular-nums " + cls}>{val}</div>
                              <div className="text-[8px] font-semibold text-slate-400 tabular-nums h-3">{sub}</div>
                            </div>
                          ))}
                        </div>
                        <div className="w-12 text-right shrink-0 pb-3">
                          <div className="text-[8px] font-semibold text-slate-400 tracking-wider">TD%</div>
                          <div className={"text-lg font-extrabold tabular-nums " + (pct >= 50 ? "text-emerald-500" : pct >= 35 ? "text-amber-500" : "text-slate-500")}>{pct}%</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {/* how it's scored — one summary, not a sentence per player */}
            <div className="mt-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">How the board is scored</div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 leading-snug">
                <div><b>Opponent vs position</b> — TDs and yards this defense allowed per game to RBs / WRs / TEs last season, ranked 1st (toughest) to 32nd (softest). Green = soft matchup.</div>
                <div><b>TD share</b> — the slice of his team's touchdowns he scored last season. Blends toward this season 12% per week.</div>
                <div><b>Imp total</b> — points Vegas expects his team to score this week (from the spread and over/under). More points, more touchdowns to go around.</div>
                <div><b>TD%</b> — expected touchdowns = (imp total × 0.105) × share × matchup, converted to the chance of at least one. That's the ranking.</div>
                <div className="text-slate-400">Out / IR players and teams that already played this week are excluded. Locks Thursday morning, before Thursday night kickoff; that snapshot is what History grades.</div>
              </div>
            </div>
              </>
            )}
            {bet === "td" && history && !history.error && history.weeks.filter((w) => w.week !== week).length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">Past weeks</div>
                {history.weeks.filter((w) => w.week !== week).map((w) => (
                  <div key={w.week} className="mb-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-3 py-2 flex items-baseline justify-between border-b border-slate-100 dark:border-slate-800">
                      <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100">Week {w.week} <span className="text-slate-400 font-semibold">· {w.picks.length} picks</span></div>
                      {w.n > 0 && <div className="text-[11px] font-bold tabular-nums"><span className={w.hits >= w.expected ? "text-emerald-500" : "text-amber-500"}>{w.hits} hit</span> <span className="text-slate-400">/ {w.expected} expected</span></div>}
                    </div>
                    {w.n > 0 && (
                      <div className="px-3 py-1.5 flex gap-1.5">
                        {w.buckets.map((b) => (
                          <div key={b.range} className="flex-1 text-center rounded-md bg-slate-50 dark:bg-slate-800 py-1">
                            <div className="text-[8px] text-slate-400 font-semibold">{b.range}</div>
                            <div className="text-[11px] font-extrabold tabular-nums text-slate-700 dark:text-slate-200">{b.n ? `${b.hits}/${b.n}` : "—"}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
// Badge in the field-view injury-tag style. pulse=true breathes like those tags.
function RedTag({ children, pulse, plain, className = "" }) {
  return (
    <span className={"inline-flex items-center justify-center h-[15px] px-1.5 text-[7px] font-extrabold tracking-wider text-white bg-red-600 whitespace-nowrap " + (plain ? "rounded-[3px] " : "rounded-full border-2 border-white shadow ") + className}
      style={pulse ? { animation: "hrbSoftPulse 1.6s ease-in-out infinite" } : undefined}>{children}</span>
  );
}
// ═══════════════ MATCH CARD (RedZone-style) — used by Matchups and Digest ═══
function gameTwoMin(g) {
  if (g.state !== "in") return false;
  const [m, sec] = String(g.clock || "").split(":").map(Number);
  return (g.period === 2 || g.period === 4) && Number.isFinite(m) && m * 60 + (sec || 0) <= 120;
}
function MatchCard({ g, onClick }) {
  const isLive = g.state === "in", isFinal = g.state === "post", twoMin = gameTwoMin(g);
  const kickoff = new Date(g.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const hasBall = (t) => isLive && g.possession && String(g.possession) === String(t.id);
  const lost = (t) => isFinal && !t.winner;
  // Deepen a pale shell (Chargers powder, Packers gold) so white type holds up
  const deep = (c) => { const l = lumOf(c || "#334155"); return l > 0.55 ? shade(c, -(l * 100 - 42)) : c; };
  const awayC = deep(g.away.color || teamColorSafe(g.away.abbr));
  const homeC = deep(g.home.color || teamColorSafe(g.home.abbr));
  const cardBg = { backgroundImage: `linear-gradient(100deg, ${awayC} 0%, ${awayC} 38%, ${shade(awayC, -12)} 47%, ${shade(homeC, -12)} 53%, ${homeC} 62%, ${homeC} 100%)` };
  // Logo sits straight on the team colour — no disc, no ring, nothing above or
  // below it. Dark-background art where the standard mark would vanish.
  const Side = ({ t }) => (
    <div className="flex items-center justify-center w-[68px] h-[64px] shrink-0">
      <img src={darkLogo(t.abbr) || t.logo || TEAM_LOGOS[t.abbr]} alt="" className={"w-[62px] h-[62px] object-contain drop-shadow-lg " + (lost(t) ? "opacity-50" : "")} />
    </div>
  );
  // Score, with record and timeouts stacked beneath it (broadcast-bug layout).
  const tos = (t, side) => { const n = side === "home" ? g.homeTimeouts : g.awayTimeouts; return isLive && n != null ? n : null; };
  const Score = ({ t }) => (
    <div className="w-14 h-[64px] flex items-center justify-center">
      <div className={"text-[32px] leading-none font-black tabular-nums drop-shadow " + (lost(t) ? "text-white/55" : "text-white")}>{g.state === "pre" ? "" : (t.score ?? 0)}</div>
    </div>
  );
  // Record over timeouts, stacked and centred in the score's own column so it
  // sits directly beneath the number.
  const Pips = ({ side }) => {
    const n = tos(null, side);
    if (n == null) return null;
    return <span className="flex items-center gap-[3px] shrink-0">{[0, 1, 2].map((i) => <span key={i} className={"block w-[9px] h-[4px] rounded-[1px] " + (i < n ? "bg-white" : "bg-white/25")} />)}</span>;
  };
  // Record only, pinned to the card edge, inside the logo column's width
  const Foot = ({ t, side }) => (
    <div className={"w-[68px] shrink-0 " + (side === "away" ? "pl-1 text-left" : "pr-1 text-right")}>
      {t.record && <span className="text-[10px] font-bold text-white/85 tabular-nums leading-none">{t.record}</span>}
    </div>
  );
  // Timeouts centred in the score column (same 56px the score uses up top)
  const PipCol = ({ side }) => <div className="w-14 shrink-0 flex justify-center"><Pips side={side} /></div>;
  // Possession: a still football beside the team that has it.
  const Ball = ({ on }) => (
    <span className={"w-4 text-[12px] leading-none text-center inline-block " + (on ? "" : "invisible")}>🏈</span>
  );
  return (
    <button onClick={onClick} style={cardBg}
      className="w-full text-left rounded-xl shadow-sm px-2 py-2.5 active:opacity-90 border overflow-hidden border-black/20 dark:border-white/10">
      <div className="flex items-center justify-between">
        <Side t={g.away} />
        <Score t={g.away} />
        <div className="flex-1 flex flex-col items-center px-0.5">
          <div className="flex items-center gap-1">
            <Ball on={hasBall(g.away)} />
            {isLive ? (
              <div className={"rounded-lg px-2.5 py-1 text-center " + (twoMin ? "bg-rose-600 text-white" : "bg-black/45 text-white backdrop-blur-sm")}>
                <div className="text-[13px] font-black tabular-nums leading-none">{g.clock || ""}</div>
                <div className="text-[9px] font-extrabold tracking-widest uppercase mt-0.5">{g.period > 4 ? "OT" : g.period ? ordinal(g.period) : ""}</div>
              </div>
            ) : isFinal ? (
              <div className="rounded-lg px-2.5 py-1.5 bg-black/40 text-[11px] font-black tracking-widest uppercase text-white/90">Final</div>
            ) : (
              <div className="text-center">
                <div className="text-[13px] font-extrabold tabular-nums text-white leading-none drop-shadow">{kickoff}</div>
                {g.broadcast && <div className="text-[9px] font-semibold text-white/75 mt-0.5">{g.broadcast}</div>}
              </div>
            )}
            <Ball on={hasBall(g.home)} />
          </div>
          {g.odds && (g.odds.details || g.odds.overUnder != null) && !isFinal && !isLive && (
            <div className="text-[9px] font-semibold text-white/80 mt-1 tabular-nums text-center">{g.odds.details}{g.odds.overUnder != null ? ` · O/U ${g.odds.overUnder}` : ""}</div>
          )}
        </div>
        <Score t={g.home} />
        <Side t={g.home} />
      </div>
      {/* bottom row mirrors the top row's columns: [logo][score][centre][score][logo],
          so each record lands directly under its score */}
      <div className="mt-0.5 flex items-start justify-between">
        <Foot t={g.away} side="away" />
        <PipCol side="away" />
        <div className="flex-1 flex flex-col items-center px-0.5">
          {isLive && g.redZone && g.possession && <RedTag plain className="mb-0.5">RED ZONE</RedTag>}
          {isLive && g.downDistance && <div className="text-center text-[11px] font-extrabold tracking-widest uppercase text-white/90">{g.downDistance}</div>}
        </div>
        <PipCol side="home" />
        <Foot t={g.home} side="home" />
      </div>
    </button>
  );
}

// Real helmet shells — a team's helmet is NOT always its primary color
// (Buffalo, Arizona, Indianapolis, Miami and the Chargers all wear white).
// [shell, facemask]
// [shell, facemask, centre stripe] — a helmet is often not the team's primary
// colour, and the crown stripe is usually a third colour again (Buffalo: white
// shell, white mask, red stripe).
const HELMET_KIT = {
  ARI: ["#ffffff", "#97233F", "#97233F"], ATL: ["#0b0b0d", "#0b0b0d", null], BAL: ["#12100f", "#12100f", "#241773"],
  BUF: ["#ffffff", "#f2f4f7", "#C60C30"], CAR: ["#a9afb7", "#101214", null], CHI: ["#0B162A", "#8d9298", "#C83803"],
  CIN: ["#FB4F14", "#111214", null], CLE: ["#FF3C00", "#d7dade", "#ffffff"], DAL: ["#b9bfc6", "#9aa1a9", "#003594"],
  DEN: ["#0C2340", "#FA4616", null], DET: ["#b8c2cb", "#0076B6", "#0076B6"], GB: ["#FFB612", "#1B5E34", "#ffffff"],
  HOU: ["#0B2C4F", "#0B2C4F", "#A71930"], IND: ["#ffffff", "#a7adb5", "#002C5F"], JAX: ["#101214", "#9F792C", "#9F792C"],
  KC: ["#E31837", "#f2f4f7", null], LV: ["#c3c8ce", "#0b0b0d", "#0b0b0d"], LAC: ["#ffffff", "#0080C6", "#FFC20E"],
  LAR: ["#003594", "#f2f4f7", null], MIA: ["#ffffff", "#008E97", "#008E97"], MIN: ["#4F2683", "#dfe3e8", "#FFC62F"],
  NE: ["#c3c8ce", "#C60C30", "#002244"], NO: ["#101214", "#9F8958", "#9F8958"], NYG: ["#0B2265", "#a7adb5", "#A71930"],
  NYJ: ["#115740", "#115740", "#ffffff"], PHI: ["#1A4E42", "#9aa1a9", "#A5ACAF"], PIT: ["#101214", "#9aa1a9", "#FFB612"],
  SF: ["#B3995D", "#f2f4f7", "#AA0000"], SEA: ["#002244", "#002244", "#69BE28"], TB: ["#5b6770", "#5b6770", "#C50909"],
  TEN: ["#0C2340", "#f2f4f7", "#4B92DB"], WSH: ["#5A1414", "#FFB612", "#FFB612"], WAS: ["#5A1414", "#FFB612", "#FFB612"],
};
// Real-world decal rules. Facing right you are looking at the helmet's LEFT
// side; flipped (home) you see its RIGHT side. Pittsburgh only decals the right
// side, Cleveland has no logo at all.
const DECAL_SIDE = { CLE: "none", CIN: "none" };
// Bengals: no logo, the shell itself is the tiger. Tapered black stripes drop
// from the crown; each is a closed shape so it thins to a point like paint.
const TIGER_STRIPES = [
  "M34 34 C40 52 36 70 46 92 C42 92 38 90 36 86 C28 70 30 52 28 38 Z",
  "M52 20 C58 42 52 62 62 84 C58 86 54 84 52 78 C44 60 50 40 46 24 Z",
  "M74 12 C80 36 74 58 86 80 C82 82 78 80 76 74 C66 56 72 34 70 16 Z",
  "M98 10 C104 34 98 54 110 76 C106 78 102 76 100 70 C90 52 96 32 94 14 Z",
  "M120 14 C128 34 122 52 134 70 C130 72 126 70 124 64 C114 48 120 32 116 18 Z",
  "M140 24 C146 38 142 48 152 60 C148 62 144 60 142 56 C136 46 138 36 136 28 Z",
  "M44 108 C54 116 68 120 82 122 C68 126 54 124 42 114 Z",
  "M72 96 C80 104 90 108 104 110 C92 114 80 110 70 102 Z",
  "M24 70 C28 82 34 96 44 106 C36 102 28 90 22 76 Z",
];
// End-zone lettering colour when the team colour is wrong on the alt background
const ENDZONE_INK = { BUF: "#ffffff" };
// Lettered marks (G, ny, SF, JETS, C, LA, W) are NOT mirrored on the far side
// of a real helmet — the letter reads the same both sides. Pictorial marks
// (falcon, bronco, eagle) are mirrored so they face forward. Listed = no mirror.
const NO_MIRROR = new Set(["GB", "NYG", "SF", "NYJ", "CHI", "LAR", "WSH", "WAS"]);
// Decal size per team, 1 = default
const LOGO_SCALE = { ATL: 1.12, SEA: 1.3, LAC: 1.3 };
// Decal tilt in degrees (negative = nose up / rotated left on the away helmet; mirrors on the home side)
const LOGO_ROT = { LAC: -14 };
// Multi-band crown stripes: [outer band colour]; the kit's stripe colour is the centre
const STRIPE_FLANK = { GB: "#1B5E34", CLE: "#311D00" };
// Nickname for the white name band along the back-bottom of the shell
const HELMET_NICK = { ARI: "CARDINALS", ATL: "FALCONS", BAL: "RAVENS", BUF: "BILLS", CAR: "PANTHERS", CHI: "BEARS", CIN: "BENGALS", CLE: "BROWNS",
  DAL: "COWBOYS", DEN: "BRONCOS", DET: "LIONS", GB: "PACKERS", HOU: "TEXANS", IND: "COLTS", JAX: "JAGUARS", KC: "CHIEFS", LV: "RAIDERS", LAC: "CHARGERS",
  LAR: "RAMS", MIA: "DOLPHINS", MIN: "VIKINGS", NE: "PATRIOTS", NO: "SAINTS", NYG: "GIANTS", NYJ: "JETS", PHI: "EAGLES", PIT: "STEELERS", SF: "49ERS",
  SEA: "SEAHAWKS", TB: "BUCCANEERS", TEN: "TITANS", WSH: "COMMANDERS", WAS: "COMMANDERS" };
// Side profile of a modern shell (Speedflex-ish): tall rounded crown, a fuller
// rear bulge, flatter brow, open face bridged by the cage, jaw pad, ear hole,
// nose bumper, rear vents. Facing right; flip mirrors it.
function Helmet({ abbr, logo, color, alt, flip, size = 128, style, onClick, photo }) {
  // A real helmet image (Airtable "Helmet" attachment on the team) beats the
  // drawn shell. It still flips for the home side and rides the same clash
  // animation, because the animation is on the wrapper, not the SVG.
  if (photo) {
    return (
      <div onClick={onClick} style={{ width: size, height: size * 0.82, ...style }} className="relative">
        <img src={photo} alt="" draggable="false" className="w-full h-full object-contain select-none"
          style={{ transform: flip ? "scaleX(-1)" : undefined, filter: "drop-shadow(0 8px 8px rgba(0,0,0,0.45))" }} />
      </div>
    );
  }
  const uid = `${String(abbr).replace(/\W/g, "")}-${flip ? "r" : "l"}`;
  const kit = HELMET_KIT[abbr] || [color || teamColor(abbr) || "#334155", alt || TEAM_ALT[abbr] || "#e5e7eb"];
  const shell = kit[0], mask = kit[1], stripe = kit.length >= 3 ? kit[2] : (alt || TEAM_ALT[abbr] || null);
  const flank = STRIPE_FLANK[abbr] || null;                  // outer bands either side of the centre stripe
  const lsc = LOGO_SCALE[abbr] || 1, lw = 90 * lsc, lh = 56 * lsc, lx = 80 - lw / 2, ly = 58 - lh / 2;
  const unmirror = flip && NO_MIRROR.has(abbr);              // decal reads the same on both sides of the shell
  const darkShell = lumOf(shell) < 0.42;
  const side = DECAL_SIDE[abbr];
  const showLogo = !!logo && side !== "none" && !(side === "right" && !flip) && !(side === "left" && flip);
  // Shell: brow at the front-top, high crown, fat rear bulge, tucks in under
  // the rear rim, comes forward along the jaw line to the face opening.
  const SHELL = "M158 52 C146 22 112 8 80 14 C46 21 20 48 20 82 C20 106 34 122 56 126 C76 130 100 130 116 126 C124 118 128 104 132 92 C138 74 146 60 158 52 Z";
  // Jaw pad: hangs below the shell's front-bottom, wraps the chin line.
  const JAW = "M112 126 C122 128 130 122 134 112 C140 122 140 134 132 142 C120 148 106 146 100 138 C104 132 108 128 112 126 Z";
  const STRIPE = "M22 84 C32 48 62 24 98 16 C122 11 144 20 156 36";
  return (
    <svg viewBox="0 0 200 170" width={size} height={size * 170 / 200} style={style} onClick={onClick} className={onClick ? "cursor-pointer" : undefined}>
      <defs>
        <clipPath id={`clip-${uid}`}><path d={SHELL} /></clipPath>
        {/* paint: light from upper-left, occlusion toward the rear-bottom */}
        <linearGradient id={`paint-${uid}`} x1="0.25" y1="0" x2="0.75" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="28%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="58%" stopColor="#000000" stopOpacity="0.03" />
          <stop offset="85%" stopColor="#000000" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
        </linearGradient>
        {/* hard clear-coat specular */}
        <radialGradient id={`gloss-${uid}`} cx="0.42" cy="0.2" r="0.36">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.9" /><stop offset="55%" stopColor="#fff" stopOpacity="0.16" /><stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {/* rim light along the back edge of the shell */}
        <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" /><stop offset="35%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`face-${uid}`} cx="0.4" cy="0.42" r="0.75">
          <stop offset="0%" stopColor="#3b3129" /><stop offset="55%" stopColor="#1c1612" /><stop offset="100%" stopColor="#07060a" />
        </radialGradient>
        <linearGradient id={`bar-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={lumOf(mask) < 0.3 ? 0.3 : 0.85} />
          <stop offset="30%" stopColor={mask} /><stop offset="75%" stopColor={mask} />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
        </linearGradient>
        <filter id={`halo-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="1.4" floodColor={darkShell ? "#ffffff" : "#000000"} floodOpacity={darkShell ? 0.8 : 0.25} />
        </filter>
        <filter id={`drop-${uid}`} x="-30%" y="-30%" width="170%" height="175%">
          <feDropShadow dx="0" dy="7" stdDeviation="6" floodColor="#000" floodOpacity="0.45" />
        </filter>
        <filter id={`soft-${uid}`}><feGaussianBlur stdDeviation="2.5" /></filter>
        {/* the name band's text runs along this curve in SCREEN space, so the
            letters are never mirrored: facing right it runs from past the back
            edge down to the bottom rim; flipped it runs the other way. */}
        <path id={`nick-${uid}`} d={flip ? "M124 124 C164 118 182 100 186 60" : "M14 60 C18 100 36 118 76 124"} />
      </defs>
      <g filter={`url(#drop-${uid})`} transform={flip ? "translate(200,0) scale(-1,1)" : undefined}>
        {/* the open face, drawn first; the shell covers all but the front crescent */}
        <path d="M130 92 C138 74 148 62 162 58 C178 64 190 82 188 102 C186 124 172 138 152 140 C136 141 124 132 122 118 Z" fill={`url(#face-${uid})`} />
        {/* shell + paint */}
        <path d={SHELL} fill={shell} />
        <path d={SHELL} fill={`url(#paint-${uid})`} />
        {abbr === "CIN" && (
          <g clipPath={`url(#clip-${uid})`} fill="#111214">
            {TIGER_STRIPES.map((d, i) => <path key={i} d={d} />)}
          </g>
        )}
        {/* centre stripe along the crown, with thin liners either side */}
        {stripe && (
          <g clipPath={`url(#clip-${uid})`}>
            {flank && <path d={STRIPE} fill="none" stroke={flank} strokeWidth="17" strokeLinecap="round" />}
            <path d={STRIPE} fill="none" stroke={stripe} strokeWidth={flank ? 6 : 11} strokeLinecap="round" />
            <path d={STRIPE} fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" transform={`translate(0,${flank ? -9.5 : -6.5})`} />
            <path d={STRIPE} fill="none" stroke="#000000" strokeOpacity="0.28" strokeWidth="1.6" transform={`translate(0,${flank ? 9.5 : 6.5})`} />
          </g>
        )}
        {/* decal on the flat of the side panel, above the ear hole. Not
            counter-flipped: a real decal is mirrored on the opposite side. */}
        {showLogo && (
          <g clipPath={`url(#clip-${uid})`}>
            <image href={darkShell ? (darkLogo(abbr) || logo) : logo} x={lx} y={ly} width={lw} height={lh} preserveAspectRatio="xMidYMid meet"
              transform={[unmirror ? `translate(${2 * (lx + lw / 2)},0) scale(-1,1)` : "", LOGO_ROT[abbr] ? `rotate(${LOGO_ROT[abbr]} ${lx + lw / 2} ${ly + lh / 2})` : ""].join(" ").trim() || undefined}
              filter={`url(#halo-${uid})`} onError={(e) => { if (e.currentTarget.getAttribute("href") !== logo) e.currentTarget.setAttribute("href", logo); }} />
          </g>
        )}
        {/* clear-coat: specular, rim light, reflection streak, floor occlusion */}
        <g clipPath={`url(#clip-${uid})`}>
          <ellipse cx="86" cy="36" rx="40" ry="16" fill={`url(#gloss-${uid})`} />
          <ellipse cx="130" cy="28" rx="16" ry="5" fill="#fff" opacity="0.45" filter={`url(#soft-${uid})`} />
          <rect x="0" y="0" width="200" height="170" fill={`url(#rim-${uid})`} />
          <path d="M22 118 C56 130 96 132 118 126" fill="none" stroke="#000" strokeOpacity="0.22" strokeWidth="12" filter={`url(#soft-${uid})`} />
          {/* white name band wrapping the back-bottom of the shell: you only
              ever see part of the name from the side, like the real thing */}
          {HELMET_NICK[abbr] && <>
            <path d="M24 102 C29 112 40 118 53 122" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="10" strokeLinecap="round" />
            <path d="M24 102 C29 112 40 118 53 122" fill="none" stroke="#ffffff" strokeWidth="7.5" strokeLinecap="round" />
            <mask id={`nickm-${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="170">
              <path d="M24 102 C29 112 40 118 53 122" fill="none" stroke="#fff" strokeWidth="7.5" strokeLinecap="round" />
            </mask>
            <g mask={`url(#nickm-${uid})`}>
            <text transform={flip ? "translate(200,0) scale(-1,1)" : undefined} fontSize="6.2" fontWeight="900" letterSpacing="0.6" fill="#0b0b0d"
              style={{ fontFamily: "Arial Black, Arial, Helvetica, sans-serif" }} dy="2.2">
              <textPath href={`#nick-${uid}`} startOffset={flip ? "22%" : "78%"} textAnchor={flip ? "start" : "end"}>{HELMET_NICK[abbr]}</textPath>
            </text>
            </g>
          </>}
          {/* rear vents */}
{lsc <= 1.1 && <>
          <rect x="36" y="46" width="4" height="16" rx="2" fill="#000" opacity="0.55" transform="rotate(-24 38 54)" />
          <rect x="45" y="36" width="4" height="16" rx="2" fill="#000" opacity="0.55" transform="rotate(-24 47 44)" />
          </>}
        </g>
        {/* shell edge + rear rim lip */}
        <path d={SHELL} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M22 88 C22 108 36 122 58 126" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="5" strokeLinecap="round" />
        {/* jaw pad */}
        <path d={JAW} fill={shell} />
        <path d={JAW} fill="rgba(0,0,0,0.32)" />
        <path d={JAW} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="2" strokeLinejoin="round" />
        {/* ear hole, recessed */}
        <g transform="rotate(14 98 106)">
          <ellipse cx="98" cy="106" rx="9.5" ry="13" fill="rgba(0,0,0,0.5)" />
          <ellipse cx="98" cy="106" rx="6.5" ry="10" fill="#07090d" />
          <ellipse cx="98" cy="106" rx="6.5" ry="10" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.4" />
        </g>
        {/* white brow strip across the front edge, just above the facemask */}
        <path d="M138 49 L166 49" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="6" strokeLinecap="round" clipPath={`url(#clip-${uid})`} />
        <path d="M138 49 L166 49" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" clipPath={`url(#clip-${uid})`} />
        {/* nose bumper: the rubber pad at the brow */}
        <path d="M150 50 C158 47 165 50 168 58 C162 60 156 58 151 55 Z" fill="#111318" />
        <path d="M153 51 C158 50 162 52 165 56" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="1.2" />
        {/* side clips that bolt the cage to the shell */}
        <rect x="126" y="100" width="9" height="16" rx="3" fill="#14171c" />
        <rect x="146" y="56" width="10" height="8" rx="2.5" fill="#14171c" />
        {/* cage: dark backing first, painted bars on top, highlight last */}
        {(() => {
          const bars = [
            "M160 56 C184 64 196 86 192 108 C188 128 172 140 152 142",   // top/outer bar
            "M128 96 C150 90 172 92 190 100",                             // upper horizontal
            "M128 112 C150 110 170 112 188 116",                          // middle horizontal
            "M134 128 C152 128 168 128 182 126",                          // lower horizontal
            "M176 78 C184 94 184 114 176 132",                            // vertical (front)
            "M160 88 C166 102 166 118 160 132",                           // vertical (inner)
          ];
          return (<>
            <g fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="8" strokeLinecap="round">{bars.map((d, i) => <path key={i} d={d} />)}</g>
            <g fill="none" stroke={`url(#bar-${uid})`} strokeWidth="5.5" strokeLinecap="round">{bars.map((d, i) => <path key={i} d={d} />)}</g>
            <g fill="none" stroke="#fff" strokeOpacity={lumOf(mask) < 0.3 ? 0.2 : 0.45} strokeWidth="1.4" strokeLinecap="round">
              <path d="M161 54 C184 62 195 84 191 106" /><path d="M129 94 C151 88 172 90 189 98" />
            </g>
          </>);
        })()}
        {/* chin strap + cup */}
        <path d="M96 112 C102 134 124 150 150 150" fill="none" stroke="#e2e8f0" strokeOpacity="0.9" strokeWidth="4.5" strokeLinecap="round" />
        <circle cx="96" cy="112" r="3" fill="#94a3b8" />
        <ellipse cx="152" cy="150" rx="7" ry="4" fill="#cbd5e1" />
      </g>
    </svg>
  );
}

// ═══════════════ PLAYER PROPS (The Odds API via /api/props) ══════
const AMER = (v) => (v == null ? "—" : v > 0 ? "+" + v : String(v));
function PropsBoard() {
  const [meta, setMeta] = useState(null);      // { configured, events }
  const [open, setOpen] = useState(null);      // event id being shown
  const [lines, setLines] = useState({});      // event id -> markets payload
  const [mkt, setMkt] = useState("player_anytime_td");
  useEffect(() => { fetch("/api/props").then((r) => r.json()).then(setMeta).catch(() => setMeta({ configured: false })); }, []);
  const load = (id) => {
    setOpen(open === id ? null : id);
    if (lines[id] || open === id) return;
    fetch(`/api/props?event=${id}`).then((r) => r.json()).then((d) => setLines((L) => ({ ...L, [id]: d }))).catch(() => {});
  };
  if (!meta) return <Loader label="Loading props" />;
  if (!meta.configured) {
    return (
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Props need an odds key</div>
        <div className="text-[11px] text-slate-400 mt-1 leading-snug">
          ESPN publishes spreads and moneylines but no player props, so this board reads The Odds API. Get a free key at the-odds-api.com,
          then in Vercel → your project → Settings → Environment Variables add <span className="font-bold">ODDS_API_KEY</span> and redeploy.
          Lines appear here automatically once it's set — no code change needed.
        </div>
      </div>
    );
  }
  const games = meta.events || [];
  return (
    <div className="space-y-2">
      {games.length === 0 && <div className="text-center text-xs text-slate-400 py-8">No upcoming games posted yet.</div>}
      {games.map((g) => {
        const d = lines[g.id];
        const isOpen = open === g.id;
        const av = d && d.markets ? Object.keys(d.markets) : [];
        const useKey = av.includes(mkt) ? mkt : av[0];
        return (
          <div key={g.id} className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button onClick={() => load(g.id)} className="w-full px-3 py-2.5 flex items-center justify-between text-left">
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">{g.away} @ {g.home}</div>
                <div className="text-[10px] font-semibold text-slate-400">{new Date(g.start).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</div>
              </div>
              <span className="text-slate-400 text-xs font-bold">{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && (
              <div className="border-t border-slate-100 dark:border-slate-800">
                {!d && <div className="px-3 py-4 text-[11px] text-slate-400">Loading lines…</div>}
                {d && av.length === 0 && <div className="px-3 py-4 text-[11px] text-slate-400">{d.error ? "Odds feed error: " + d.error : "No props posted for this game yet — books usually put them up 1–2 days out."}</div>}
                {d && av.length > 0 && (
                  <>
                    <div className="flex gap-1.5 px-3 py-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                      {av.map((k) => (
                        <button key={k} onClick={() => setMkt(k)}
                          className={"shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold " + (useKey === k ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300")}>
                          {d.markets[k].label}
                        </button>
                      ))}
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {d.markets[useKey].rows.map((r) => (
                        <div key={r.player} className="px-3 py-2 flex items-center justify-between gap-2">
                          <span className="text-[12px] font-bold text-slate-800 dark:text-slate-100 truncate">{r.player}</span>
                          <span className="shrink-0 flex items-center gap-2 tabular-nums">
                            {r.line != null && <span className="text-[12px] font-extrabold text-slate-900 dark:text-white">{r.line}</span>}
                            {r.price != null && <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">{AMER(r.price)}</span>}
                            {r.over != null && <span className="text-[10px] font-semibold text-slate-400">o {AMER(r.over)}</span>}
                            {r.under != null && <span className="text-[10px] font-semibold text-slate-400">u {AMER(r.under)}</span>}
                          </span>
                        </div>
                      ))}
                      <div className="px-3 py-2 text-[9px] text-slate-400">{d.markets[useKey].rows[0]?.book ? "Lines from " + d.markets[useKey].rows[0].book : ""}{meta.remaining ? ` · ${meta.remaining} API credits left this month` : ""}</div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════ GAME DETAIL (tap a matchup) ═════════════════════
function GameDetail({ game, teams, onBack, onPrev, onNext, index, total }) {
  // Real helmet art from Airtable, when the team record has one
  const helmetOf = (abbr) => { const t = (teams || []).find((x) => injTeamEq(x.abbr || toAbbr(x.name), abbr)); return t && t.helmet ? t.helmet : null; };
  const [d, setD] = useState(null);
  const [focus, setFocus] = useState(null); // team abbr -> box score view
  // The helmet clash plays once, when the game view first opens — not on every
  // swipe between games and not when tapping a team for its box score.
  const [clash, setClash] = useState(true);
  useEffect(() => { const t = setTimeout(() => setClash(false), 1500); return () => clearTimeout(t); }, []);
  const swipe = useSwipe({ onLeft: onNext || undefined, onRight: onPrev || undefined });
  useEffect(() => {
    let alive = true; setD(null); setFocus(null);
    const load = () => fetch(`/api/game?event=${game.id}`).then((r) => r.json()).then((x) => { if (alive && x && !x.error) setD(x); }).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [game.id]);
  const g = d || { home: game.home, away: game.away, state: game.state, detail: game.detail, period: game.period, clock: game.clock, scoring: [], leaders: [], teamStats: [], box: [], situation: {} };
  const isLive = g.state === "in", isFinal = g.state === "post";
  const [cm, cs] = String(g.clock || "").split(":").map(Number);
  const twoMin = isLive && (g.period === 2 || g.period === 4) && Number.isFinite(cm) && cm * 60 + (cs || 0) <= 120;
  const homeColor = g.home.color || "#1e3a8a", awayColor = g.away.color || "#334155";
  const statRow = (label, key) => {
    const a = g.teamStats.find((t) => t.team === g.away.abbr)?.stats?.[key], h = g.teamStats.find((t) => t.team === g.home.abbr)?.stats?.[key];
    if (a == null && h == null) return null;
    const na = Number(String(a).split("-")[0]) || 0, nh = Number(String(h).split("-")[0]) || 0, tot = na + nh || 1;
    return (
      <div key={key} className="py-2">
        <div className="flex justify-between text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-200"><span>{a ?? "—"}</span><span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span><span>{h ?? "—"}</span></div>
        <div className="mt-1 flex h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
          <div style={{ width: (na / tot) * 100 + "%", backgroundColor: awayColor }} /><div className="flex-1" /><div style={{ width: (nh / tot) * 100 + "%", backgroundColor: homeColor }} />
        </div>
      </div>
    );
  };
  const Team = ({ t, home }) => (
    <button onClick={() => setFocus(focus === t.abbr ? null : t.abbr)} className={"flex flex-col items-center rounded-2xl px-1 py-1 " + (focus === t.abbr ? "bg-white/15 ring-2 ring-white/70" : "")}>
      <div style={clash ? { animation: `${home ? "hrbHitR" : "hrbHitL"} 1.1s linear 1 both` } : undefined}>
        <Helmet abbr={t.abbr} photo={helmetOf(t.abbr)} logo={t.logo || TEAM_LOGOS[t.abbr]} color={t.color || teamColor(t.abbr)} alt={t.altColor || TEAM_ALT[t.abbr]} flip={!!home} size={134}
          style={focus === t.abbr ? { animation: "hrbNudge 0.45s ease-out 1" } : undefined} />
      </div>
      <div className="text-sm font-extrabold text-white -mt-1">{t.abbr}</div>
      {t.record && <div className="text-[10px] text-white/70 tabular-nums">{t.record}</div>}
    </button>
  );
  const hasBall = (t) => isLive && g.situation && g.situation.possession && String(g.situation.possession) === String(t.id);
  const LABEL = { passingYards: "Passing", rushingYards: "Rushing", receivingYards: "Receiving" };
  // Box score for the focused team: offense (passing / rushing / receiving) then defense
  const BoxTable = ({ cat }) => {
    if (!cat || !cat.rows.length) return null;
    // Four columns that matter per category, so the name column gets the room
    const WANT = { passing: ["C/ATT", "YDS", "TD", "INT"], rushing: ["CAR", "YDS", "AVG", "TD"], receiving: ["REC", "YDS", "AVG", "TD"], defensive: ["TOT", "SOLO", "SACKS", "TFL"], interceptions: ["INT", "YDS", "TD"] };
    const want = WANT[String(cat.name).toLowerCase()];
    const idxs = (want ? want.map((w) => cat.labels.findIndex((l) => String(l).toUpperCase() === w)).filter((i) => i !== -1) : []);
    const cols = idxs.length ? idxs : cat.labels.slice(0, 4).map((_, i) => i);
    const show = cols.map((i) => cat.labels[i]);
    return (
      <div className="mb-2">
        <div className="text-[9px] font-semibold tracking-widest uppercase text-slate-400 mb-1 capitalize">{cat.name}</div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="grid text-[8px] font-bold text-slate-400 uppercase px-2 py-1 border-b border-slate-100 dark:border-slate-800" style={{ gridTemplateColumns: `minmax(0,2.6fr) repeat(${show.length}, minmax(0,0.9fr))` }}>
            <span>Player</span>{show.map((l, i) => <span key={i} className="text-center">{l}</span>)}
          </div>
          {cat.rows.map((r) => (
            <div key={r.id || r.name} className="grid items-center px-2 py-1.5 border-b border-slate-50 dark:border-slate-800/60 last:border-0" style={{ gridTemplateColumns: `minmax(0,2.6fr) repeat(${show.length}, minmax(0,0.9fr))` }}>
              <span className="flex items-center gap-1.5 min-w-0">{r.headshot && <img src={r.headshot} alt="" className="w-6 h-6 rounded-full object-cover object-top bg-white shrink-0" onError={(e) => e.currentTarget.remove()} />}<span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">{r.name}</span></span>
              {cols.map((ci) => <span key={ci} className="text-center text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">{r.stats[ci] ?? "—"}</span>)}
            </div>
          ))}
        </div>
      </div>
    );
  };
  const fb = focus && g.box ? g.box.find((b) => b.team === focus) : null;
  const catOf = (n) => fb && fb.cats.find((c) => String(c.name).toLowerCase() === n);
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 pb-28" {...swipe}>
      <style>{`
        @keyframes hrbNudge { 0% { transform: scale(1) } 35% { transform: scale(1.22) } 70% { transform: scale(0.96) } 100% { transform: scale(1) } }
        @keyframes hrbBlink { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
        /* ── Helmet clash: one 1.1s clock for everything, contact at exactly 40% ──
           Charge accelerates INTO contact (ease-in per keyframe), heads dip like a
           player lowering his shoulder, then a hard squash, a whipped rebound and a
           damped rock to rest. Both helmets mirror each other. */
        @keyframes hrbHitL {
          0%   { transform: translate(-200px, 0) rotate(-6deg) scale(0.86); opacity: 0; animation-timing-function: cubic-bezier(.5,0,1,.6) }
          10%  { opacity: 1 }
          30%  { transform: translate(-30px, 6px) rotate(10deg) scale(1.02); animation-timing-function: cubic-bezier(.6,0,1,.4) }
          40%  { transform: translate(56px, 10px) rotate(14deg) scale(1.16, 0.9); animation-timing-function: ease-out }
          44%  { transform: translate(46px, 6px) rotate(8deg) scale(1.12, 0.94); animation-timing-function: cubic-bezier(.2,.8,.3,1) }
          58%  { transform: translate(-28px, -6px) rotate(-12deg) scale(0.98, 1.04); animation-timing-function: ease-in-out }
          72%  { transform: translate(12px, 2px) rotate(6deg) scale(1.02, 0.99) }
          85%  { transform: translate(-5px, 0) rotate(-2.5deg) scale(1) }
          94%  { transform: translate(2px, 0) rotate(1deg) }
          100% { transform: translate(0, 0) rotate(0deg) scale(1) }
        }
        @keyframes hrbHitR {
          0%   { transform: translate(200px, 0) rotate(6deg) scale(0.86); opacity: 0; animation-timing-function: cubic-bezier(.5,0,1,.6) }
          10%  { opacity: 1 }
          30%  { transform: translate(30px, 6px) rotate(-10deg) scale(1.02); animation-timing-function: cubic-bezier(.6,0,1,.4) }
          40%  { transform: translate(-56px, 10px) rotate(-14deg) scale(1.16, 0.9); animation-timing-function: ease-out }
          44%  { transform: translate(-46px, 6px) rotate(-8deg) scale(1.12, 0.94); animation-timing-function: cubic-bezier(.2,.8,.3,1) }
          58%  { transform: translate(28px, -6px) rotate(12deg) scale(0.98, 1.04); animation-timing-function: ease-in-out }
          72%  { transform: translate(-12px, 2px) rotate(-6deg) scale(1.02, 0.99) }
          85%  { transform: translate(5px, 0) rotate(2.5deg) scale(1) }
          94%  { transform: translate(-2px, 0) rotate(-1deg) }
          100% { transform: translate(0, 0) rotate(0deg) scale(1) }
        }
        /* camera shake starts at contact (40%), decays fast */
        @keyframes hrbShake {
          0%, 40% { transform: translate(0,0) }
          43% { transform: translate(-10px, 5px) rotate(-0.6deg) }
          47% { transform: translate(9px, -5px) rotate(0.5deg) }
          52% { transform: translate(-6px, 3px) }
          58% { transform: translate(4px, -2px) }
          66% { transform: translate(-2px, 1px) }
          74%, 100% { transform: translate(0,0) }
        }
        /* impact flash + expanding shockwave at the point of contact, on the same clock */
        @keyframes hrbFlash { 0%, 39% { opacity: 0; transform: translate(-50%,-50%) scale(0.3) } 42% { opacity: 1; transform: translate(-50%,-50%) scale(1.1) } 58% { opacity: 0; transform: translate(-50%,-50%) scale(1.6) } 100% { opacity: 0 } }
        @keyframes hrbWave  { 0%, 40% { opacity: 0; transform: translate(-50%,-50%) scale(0.2) } 45% { opacity: 0.9 } 80% { opacity: 0; transform: translate(-50%,-50%) scale(3) } 100% { opacity: 0 } }
        /* sparks: short streaks thrown out from contact along --sx/--sy */
        @keyframes hrbSpark {
          0%, 40% { opacity: 0; transform: translate(-50%,-50%) translate(0,0) scale(0.4) }
          43%     { opacity: 1; transform: translate(-50%,-50%) translate(calc(var(--sx) * .25), calc(var(--sy) * .25)) scale(1) }
          70%     { opacity: 0; transform: translate(-50%,-50%) translate(var(--sx), var(--sy)) scale(0.2) }
          100%    { opacity: 0 }
        }
      `}</style>
      <div className="px-4 pb-5 text-white overflow-hidden" style={{ background: `linear-gradient(90deg, ${awayColor} 0%, ${awayColor} 42%, ${homeColor} 58%, ${homeColor} 100%)`, paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <button onClick={onBack} className="text-sm font-semibold opacity-90 mb-1">‹ Matchups</button>

        <div className="relative flex items-center justify-between" style={clash ? { animation: "hrbShake 1.1s linear 1" } : undefined}>
          {clash && <>
            <span className="pointer-events-none absolute left-1/2 top-[38%] w-24 h-24 rounded-full opacity-0" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,240,180,0.6) 40%, rgba(255,255,255,0) 70%)", animation: "hrbFlash 1.1s linear 1 both" }} />
            <span className="pointer-events-none absolute left-1/2 top-[38%] w-16 h-16 rounded-full border-2 border-white/80 opacity-0" style={{ animation: "hrbWave 1.1s linear 1 both" }} />
            {[[-70, -46], [64, -52], [-58, 40], [70, 34], [0, -66], [-6, 58]].map(([sx, sy], i) => (
              <span key={i} className="pointer-events-none absolute left-1/2 top-[38%] w-2.5 h-1 rounded-full bg-amber-100 opacity-0"
                style={{ "--sx": sx + "px", "--sy": sy + "px", transform: "translate(-50%,-50%)", rotate: Math.atan2(sy, sx) + "rad", boxShadow: "0 0 6px 1px rgba(255,220,140,0.9)", animation: `hrbSpark 1.1s linear 1 both` }} />
            ))}
          </>}
          <Team t={g.away} />
          <div className="text-center">
            <div className="flex items-baseline gap-3 text-4xl font-black tabular-nums">
              <span className={g.away.score != null && isFinal && !g.away.winner ? "opacity-60" : ""}>{g.away.score ?? "–"}{hasBall(g.away) && <span className="text-sm align-middle ml-1">🏈</span>}</span>
              <span className="text-lg opacity-60">–</span>
              <span className={g.home.score != null && isFinal && !g.home.winner ? "opacity-60" : ""}>{hasBall(g.home) && <span className="text-sm align-middle mr-1">🏈</span>}{g.home.score ?? "–"}</span>
            </div>
            {isLive ? (
              <div className="mt-1.5 flex flex-col items-center">
                <div className={"inline-block rounded-lg px-2.5 py-1 text-center " + (twoMin ? "bg-rose-600 text-white" : "bg-black/45 text-white backdrop-blur-sm")}>
                  <div className="text-[13px] font-black tabular-nums leading-none">{g.clock || ""}</div>
                  <div className="text-[9px] font-extrabold tracking-widest uppercase mt-0.5">{g.period > 4 ? "OT" : g.period ? ordinal(g.period) : ""}</div>
                </div>
                {g.situation && g.situation.redZone && g.situation.possession && <RedTag plain className="mt-1">RED ZONE</RedTag>}
                {g.situation && g.situation.downDistance && <div className="text-[11px] font-extrabold tracking-widest uppercase text-white/90 mt-1">{g.situation.downDistance}{g.situation.yardLine ? " | " + g.situation.yardLine : ""}</div>}
              </div>
            ) : (
              <div className="mt-1 text-[11px] font-extrabold uppercase tracking-wider text-white">{g.detail}</div>
            )}
          </div>
          <Team t={g.home} home />
        </div>
        {g.homeWinPct != null && !isFinal && (
          <div className="mt-4">
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider opacity-80"><span>{g.away.abbr} {100 - g.homeWinPct}%</span><span>Win probability</span><span>{g.home.abbr} {g.homeWinPct}%</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-white/20 overflow-hidden"><div className="h-full bg-white/90" style={{ width: (100 - g.homeWinPct) + "%" }} /></div>
          </div>
        )}
      </div>
      <div className="px-4 pt-3">
        {!d && <Loader label="Loading game" />}
        {d && focus && (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400">{focus} box score</div>
              <button onClick={() => setFocus(null)} className="text-[10px] font-bold text-blue-600">Back to game</button>
            </div>
            <div className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500 mb-1">Offense</div>
            <BoxTable cat={catOf("passing")} /><BoxTable cat={catOf("rushing")} /><BoxTable cat={catOf("receiving")} />
            <div className="text-[9px] font-extrabold tracking-widest uppercase text-slate-500 mb-1 mt-3">Defense</div>
            <BoxTable cat={catOf("defensive")} /><BoxTable cat={catOf("interceptions")} />
            {!fb && <div className="text-xs text-slate-400 text-center py-6">No box score yet for {focus}.</div>}
          </>
        )}
        {d && !focus && (g.away.linescores?.length > 0 || g.home.linescores?.length > 0) && (() => {
          // Quarter-by-quarter, the way a broadcast score bug lays it out.
          const qs = Math.max(4, g.away.linescores?.length || 0, g.home.linescores?.length || 0);
          const cols = Array.from({ length: qs }, (_, i) => i);
          const head = (i) => (i < 4 ? ordinal(i + 1) : qs === 5 ? "OT" : "OT" + (i - 3));
          const Row = ({ t }) => (
            <div className="flex items-center px-3 py-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <img src={chipLogo(t.abbr, t.logo)} alt="" className="w-6 h-6 rounded-full object-contain p-0.5 shrink-0" style={logoChip(t.abbr)} />
                <span className="text-[12px] font-extrabold text-slate-900 dark:text-white">{t.abbr}</span>
              </div>
              {cols.map((i) => (
                <span key={i} className="w-8 text-center text-[12px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{t.linescores?.[i] ?? "-"}</span>
              ))}
              <span className="w-9 text-center text-[14px] font-black tabular-nums text-slate-900 dark:text-white">{t.score ?? 0}</span>
            </div>
          );
          return (
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-3 overflow-hidden">
              <div className="flex items-center px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60">
                <span className="flex-1 text-[9px] font-semibold tracking-widest uppercase text-slate-400">Scoring by quarter</span>
                {cols.map((i) => <span key={i} className="w-8 text-center text-[9px] font-bold uppercase text-slate-400">{head(i)}</span>)}
                <span className="w-9 text-center text-[9px] font-bold uppercase text-slate-400">T</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800"><Row t={g.away} /><Row t={g.home} /></div>
            </div>
          );
        })()}
        {d && !focus && isLive && g.situation && (g.situation.lastPlay || g.situation.drive) && (
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 mb-3">
            <div className="text-[9px] font-semibold tracking-widest uppercase text-rose-500 mb-1">● Last play</div>
            <div className="text-[12px] text-slate-800 dark:text-slate-100 leading-snug">{g.situation.lastPlay || g.situation.drive}</div>
            {g.situation.lastPlay && g.situation.drive && <div className="text-[10px] text-slate-400 mt-1">{g.situation.drive}</div>}
          </div>
        )}
        {d && !focus && g.scoring.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">Scoring</div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {g.scoring.map((p, i) => (
                <div key={i} className="px-3 py-2 flex items-start gap-2">
                  {TEAM_LOGOS[p.team] && <img src={chipLogo(p.team)} alt="" className="w-5 h-5 rounded-full object-contain p-px mt-0.5" style={logoChip(p.team)} />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-slate-800 dark:text-slate-100 leading-snug">{p.text}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{p.type ? p.type + " · " : ""}Q{p.q} {p.clock}</div>
                  </div>
                  <div className="text-[11px] font-extrabold tabular-nums text-slate-600 dark:text-slate-300 shrink-0">{p.away}–{p.home}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {d && !focus && g.leaders.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">Leaders</div>
            <div className="grid grid-cols-2 gap-2">
              {[g.away, g.home].map((t) => {
                const L = g.leaders.find((x) => x.team === t.abbr);
                return (
                  <div key={t.abbr} className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5">
                    <div className="text-[10px] font-extrabold text-slate-500 mb-1">{t.abbr}</div>
                    {(L ? L.items : []).filter((l) => LABEL[l.cat]).slice(0, 3).map((l) => (
                      <div key={l.cat} className="py-1">
                        <div className="text-[8px] font-semibold tracking-widest uppercase text-slate-400">{LABEL[l.cat]}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {l.headshot && <img src={l.headshot} alt="" className="w-7 h-7 rounded-full object-cover object-top bg-white" />}
                          <div className="min-w-0"><div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">{l.name}</div><div className="text-[9px] text-slate-400 truncate">{l.value}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {d && !focus && g.teamStats.length === 2 && (
          <div className="mb-3">
            <div className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-1.5">Team stats</div>
            <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 divide-y divide-slate-100 dark:divide-slate-800">
              {statRow("Total yards", "totalYards")}{statRow("Passing", "netPassingYards")}{statRow("Rushing", "rushingYards")}{statRow("First downs", "firstDowns")}{statRow("3rd down", "thirdDownEff")}{statRow("Turnovers", "turnovers")}{statRow("Possession", "possessionTime")}
            </div>
          </div>
        )}
        {d && !focus && (g.venue || g.weather) && <div className="text-[10px] text-slate-400 text-center mb-2">{[g.venue, g.weather].filter(Boolean).join(" · ")}{isLive ? " · updates every 30s" : ""} · tap a team for its box score</div>}

      </div>
    </div>
  );
}
// name normalizer local to the board (falls back gracefully if hrbNrm isn't in scope)
function hrbNrmSafe(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.'’]/g, "").replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "").trim().toLowerCase();
}

const TABS = [
  { id: "targets", label: "Week", icon: "🎯" }, // label becomes "Week N" from the live scoreboard
  { id: "teams", label: "Teams", icon: "🏈" },
  { id: "players", label: "Players", icon: "👤" },
  { id: "stats", label: "Stats", icon: "📊" },
];

export default function App() {
  const [tab, setTab] = useState("targets"); // land on the Week board
  const [sel, setSelRaw] = useState(null);
  // Opening a card remembers where you were scrolled; closing it puts you back.
  const setSel = (p) => { if (p) SCROLL_MEMO.y = window.scrollY; setSelRaw(p); };
  useEffect(() => {
    if (sel) { window.scrollTo(0, 0); return; }
    const y = SCROLL_MEMO.y; if (!y) return;
    requestAnimationFrame(() => window.scrollTo(0, y));
    const t = setTimeout(() => window.scrollTo(0, y), 120);   // again once lists finish painting
    return () => clearTimeout(t);
  }, [sel]);
  const [players, setPlayers] = useState(null);
  const [teams, setTeams] = useState([]);
  const [stand, setStand] = useState(null); // records + stat ranks from /api/standings
  const [tickerSb, setTickerSb] = useState(null);   // this week's slate for the news ticker
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/scoreboard").then((r) => r.json()).then((d) => { if (alive && d && d.games) setTickerSb(d); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const [nflWeek, setNflWeek] = useState(null);
  const [, setInjEspnTick] = useState(0); // current week, for the bottom-nav label
  const [seasonStats, setSeasonStats] = useState(null); // ESPN box-score aggregation (/api/season-stats)

  // Automated records/stats: merge ESPN data into the Airtable teams by abbr.
  // Airtable values still win when present; ESPN fills the blanks (and stx).
  const mergedTeams = useMemo(() => {
    if ((!stand || !stand.teams) && !seasonStats) return teams;
    // Standings and box scores are separate feeds. If standings hasn't loaded
    // (or ESPN hiccupped), the box-score tiles still fill in; only the record
    // and ESPN ranks wait for standings.
    const find = (abbr) => (stand && stand.teams ? stand.teams.find((s) => injTeamEq(s.abbr, abbr)) : null);
    return teams.map((t) => {
      const s = find(t.abbr || toAbbr(t.name)) || {};
      // Alias-safe lookup: ESPN files Washington as WSH, Airtable as WAS (same
      // story for JAX/JAC, LAR/LA). A direct key miss left the Commanders' tiles blank.
      const bx = (() => {
        if (!seasonStats || !seasonStats.teams) return null;
        const want = t.abbr || toAbbr(t.name);
        const hit = Object.entries(seasonStats.teams).find(([k]) => injTeamEq(k, want));
        return hit ? hit[1] : null;
      })();
      const stx = {
        // defense splits from box scores (pass/rush yds & TDs allowed, ranked)
        offPassYpg: bx ? bx.offPg.passYds : null, offPassYpgRank: bx ? bx.ranks.offPassYds : null,
        offPassTd: bx ? bx.off.passTd : null, offPassTdRank: bx ? bx.ranks.offPassTd : null,
        offRushYpg: bx ? bx.offPg.rushYds : null, offRushYpgRank: bx ? bx.ranks.offRushYds : null,
        offRushTd: bx ? bx.off.rushTd : null, offRushTdRank: bx ? bx.ranks.offRushTd : null,
        defPassYpg: bx ? bx.defPg.passYds : null, defPassYpgRank: bx ? bx.ranks.defPassYds : null,
        defPassTd: bx ? bx.def.passTd : null, defPassTdRank: bx ? bx.ranks.defPassTd : null,
        defRushYpg: bx ? bx.defPg.rushYds : null, defRushYpgRank: bx ? bx.ranks.defRushYds : null,
        defRushTd: bx ? bx.def.rushTd : null, defRushTdRank: bx ? bx.ranks.defRushTd : null,
        ties: bx && bx.ranksTie ? bx.ranksTie : {},
        defSeason: seasonStats ? seasonStats.season : null,
        passYpg: s.passYpg, passYpgRank: s.passYpgRank,
        rushYpg: s.rushYpg, rushYpgRank: s.rushYpgRank,
        offTd: s.offTd, offTdRank: s.offTdRank,
        passTd: s.passTd, passTdRank: s.passTdRank,
        rushTd: s.rushTd, rushTdRank: s.rushTdRank,
        sacks: s.sacks, sacksRank: s.sacksRank,
        takeaways: s.takeaways, takeawaysRank: s.takeawaysRank,
        toDiff: s.toDiff, toDiffRank: s.toDiffRank,
        paRank: s.paRank,
      };
      if (!stand || !stand.teams) return { ...t, stx };
      return stand.isCurrent
        ? { ...t, wins: t.wins ?? s.wins, losses: t.losses ?? s.losses, ties: t.ties ?? s.ties, pf: t.pf ?? s.pf, pa: t.pa ?? s.pa, stx }
        : { ...t, winsPrev: t.winsPrev ?? s.wins, lossesPrev: t.lossesPrev ?? s.losses, tiesPrev: t.tiesPrev ?? s.ties, pfPrev: t.pfPrev ?? s.pf, paPrev: t.paPrev ?? s.pa, stx };
    });
  }, [teams, stand, seasonStats]);
  const [selTeam, setSelTeam] = useState(null);
  const [statJump, setStatJump] = useState(null);   // stat tapped on a player page
  const [navTick, setNavTick] = useState(0);        // bumps on every bottom-nav tap
  const [jumpBack, setJumpBack] = useState(null);   // where a stat-tile jump came from
  const [error, setError] = useState(null);

  const [, setInjTick] = useState(0);
  useEffect(() => {
    let alive = true;
    // Injury/roster feed. Refreshed every 5 minutes and whenever the app comes
    // back to the foreground, so in-game designations (questionable to return,
    // IR moves) show up without a restart. No ?active=true — that excluded IR.
    const load = () => fetch("https://api.sleeper.app/v1/players/nfl")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        for (const k of Object.keys(INJ_BY_NAME)) delete INJ_BY_NAME[k];
        for (const k of Object.keys(INJ_BY_LAST)) delete INJ_BY_LAST[k];
        for (const p of Object.values(d || {})) {
          if (!p || !p.full_name || !p.team) continue;
          const k = injNrm(p.full_name);
          (INJ_BY_NAME[k] = INJ_BY_NAME[k] || []).push(p);
          const lk = String(p.team).toUpperCase() + "|" + lastNameKey(p.full_name);
          (INJ_BY_LAST[lk] = INJ_BY_LAST[lk] || []).push(p);
        }
        setInjTick((t) => t + 1);
      })
      .catch(() => {});
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, []);
  useEffect(() => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else {
        // Register each team under its Airtable abbreviation AND every alias ESPN
        // uses for it (WAS/WSH, JAX/JAC, LAR/LA…), so boards keyed by ESPN's code
        // find the same logo and name.
        const ALIASES = { WAS: ["WSH"], WSH: ["WAS"], JAX: ["JAC"], JAC: ["JAX"], LAR: ["LA"], LA: ["LAR"], ARI: ["ARZ"], BAL: ["BLT"], CLE: ["CLV"], HOU: ["HST"] };
        for (const t of d.teams || []) {
          const a = t.abbr || toAbbr(t.name);
          if (!a) continue;
          for (const k of [a, ...(ALIASES[a] || [])]) { if (t.logo) TEAM_LOGOS[k] = t.logo; if (t.name) TEAM_NAMES[k] = t.name; }
        }
        setPlayers(d.players); setTeams(d.teams || []);
      } })
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    fetch("/api/scoreboard").then((r) => r.json()).then((d) => {
      if (d && d.week) setNflWeek(d.week);
      for (const g of (d && d.games) || []) for (const t of [g.home, g.away]) { if (t && t.abbr && t.altColor) TEAM_ALT[t.abbr] = t.altColor; }
    }).catch(() => {});
    // ESPN league injury report (detail + est. return date). Refreshed every 10 min.
    const loadInj = () => fetch("/api/injuries").then((r) => r.json()).then((d) => {
      for (const k of Object.keys(INJ_ESPN)) delete INJ_ESPN[k];
      Object.assign(INJ_ESPN, (d && d.injuries) || {});
      INJ_META.count = Object.keys(INJ_ESPN).length; INJ_META.error = (d && d.error) || null; INJ_META.at = new Date();
      setInjEspnTick((t) => t + 1); // force a re-render so notes pick up the detail
    }).catch((e) => { INJ_META.error = String(e && e.message || e); INJ_META.at = new Date(); setInjEspnTick((t) => t + 1); });
    loadInj();
    const t = setInterval(loadInj, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    // Current season's box scores; until a week is final, show last season's so tiles aren't blank.
    const yr = new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    fetch(`/api/season-stats?season=${yr}`).then((r) => r.json())
      .then((d) => {
        if (d && d.weeksWithGames > 0) return setSeasonStats(d);
        return fetch(`/api/season-stats?season=${yr - 1}`).then((r) => r.json()).then((d2) => setSeasonStats(d2 && d2.players ? d2 : null));
      }).catch(() => {});
  }, []);
  useEffect(() => {
    // Non-fatal: if ESPN is down the app just shows Airtable's numbers.
    // Standings: retry a few times — one bad ESPN response used to blank
    // every team's record for the whole session.
    const loadStand = (attempt = 0) => fetch("/api/standings")
      .then((r) => r.json())
      .then((d) => { if (d && d.teams && d.teams.length) setStand(d); else throw new Error("empty"); })
      .catch(() => { if (attempt < 3) setTimeout(() => loadStand(attempt + 1), 3000 * (attempt + 1)); });
    loadStand();
  }, []);

  if (sel) {
    const hubView = STICKY["hub.view"];
    return (
      <PlayerDetail
        p={sel}
        onBack={() => setSel(null)}
        backLabel={tab === "teams" ? (selTeam ? selTeam.name : "Teams")
          : tab === "players" ? ({ draft: "Draft", contracts: "Contracts", injury: "Injury Report" }[hubView] || "Players")
          : tab === "stats" ? "Stats" : tab === "targets" ? "Week" : "Players"}
        mode="full"
        seasonStats={seasonStats}
        onStatJump={(j) => { setJumpBack({ tab, sel, selTeam, label: sel.name }); setStatJump(j); setSel(null); setSelTeam(null); setTab("stats"); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <GlobalPulseStyles />
      {error && (
        <div className="m-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl px-4 py-3">
          Couldn't load data: {error}
        </div>
      )}
      {!players && !error && <Loader />}

      {players && tab === "teams" && !selTeam && (
        <TeamsTab teams={mergedTeams} players={players} onSelect={setSelTeam} />
      )}
      {players && tab === "teams" && selTeam && (
        <TeamDetail
          team={mergedTeams.find((t) => t.id === selTeam.id) || selTeam} teams={mergedTeams} seasonStats={seasonStats}
          players={players}
          onBack={() => setSelTeam(null)}
          onSwitchTeam={(t) => setSelTeam(t)}
          onSelectPlayer={setSel}
          onStatJump={(j) => { setJumpBack({ tab, sel: null, selTeam, label: selTeam.name }); setStatJump(j); setSel(null); setSelTeam(null); setTab("stats"); }}
        />
      )}
      <div className="pb-40">
        {players && tab === "targets" && <TdBoardTab players={players} teams={mergedTeams} onSelect={setSel} navTick={navTick} seasonStats={seasonStats} />}
        {players && tab === "players" && <PlayersHub players={players} onSelect={setSel} />}
        {players && tab === "stats" && <StatsTab players={players} onSelect={setSel} seasonStats={seasonStats} jump={statJump} onJumpUsed={() => setStatJump(null)}
          backTo={jumpBack ? jumpBack.label : null}
          onBack={jumpBack ? () => { setTab(jumpBack.tab); setSelTeam(jumpBack.selTeam); setSel(jumpBack.sel); setJumpBack(null); } : undefined} />}
      </div>

      {players && <NewsTicker players={players} onSelect={setSel} games={tickerSb && tickerSb.games} week={tickerSb && tickerSb.week} />}
      <div className="fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex pb-[env(safe-area-inset-bottom)] z-20">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSel(null); setSelTeam(null); setJumpBack(null); setNavTick((n) => n + 1); for (const k of Object.keys(STICKY)) delete STICKY[k]; SCROLL_MEMO.y = 0; }}
            className={"flex-1 py-2.5 text-center " + (tab === t.id ? "text-blue-600" : "text-slate-400")}
          >
            <div className="relative inline-block text-lg leading-none">{t.icon}{t.id === "players" && <UnreadDot n={injUnreadCount()} className="absolute -top-1.5 -right-3.5" />}</div>
            <div className="text-[10px] font-bold mt-1">{t.id === "targets" && nflWeek ? "Week " + nflWeek : t.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── END OF FILE · v12 · if you do not see this line, the upload was truncated ───
