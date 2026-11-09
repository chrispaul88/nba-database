// /api/scoreboard — NBA games for one day with live scores, tip times,
// records, and betting lines, from ESPN's public scoreboard. Cached 60s so
// live games tick along without hammering ESPN.
//
// Default: today (US Eastern, since that's the NBA's calendar).
// Optional: /api/scoreboard?date=20261025 for a specific day (YYYYMMDD).

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

// ESPN's abbreviations differ from the app's in a few places.
const ABBR_FIX = { GS: "GS", SA: "SAS", NO: "NOP", NY: "NY", UTAH: "UTAH", WSH: "WSH" };

// "Today" in New York — an 11pm PT game is still tonight's slate.
function easternYmd(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(d).reduce((a, p) => ((a[p.type] = p.value), a), {});
  return `${parts.year}${parts.month}${parts.day}`;
}

function side(comp, homeAway) {
  const c = (comp.competitors || []).find((x) => x.homeAway === homeAway) || {};
  const t = c.team || {};
  const rec = (c.records || []).find((r) => r.type === "total" || r.name === "overall") || (c.records || [])[0];
  const raw = String(t.abbreviation || "").toUpperCase();
  const leaders = (c.leaders || []).map((l) => {
    const top = (l.leaders || [])[0];
    return top ? { cat: l.shortDisplayName || l.name, value: top.displayValue, name: top.athlete?.shortName || top.athlete?.displayName } : null;
  }).filter(Boolean);
  return {
    id: t.id,
    abbr: ABBR_FIX[raw] || raw,
    name: t.displayName || t.name || "",
    short: t.shortDisplayName || t.name || "",
    logo: t.logo || null,
    color: t.color ? "#" + t.color : null,
    score: c.score != null && c.score !== "" ? Number(c.score) : null,
    record: rec ? rec.summary : null,
    winner: !!c.winner,
    linescores: (c.linescores || []).map((q) => Number(q.value)),
    leaders,
  };
}

export default async function handler(req, res) {
  try {
    const date = req.query && req.query.date && /^\d{8}$/.test(req.query.date) ? req.query.date : easternYmd();
    const d = await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}`);

    const games = (d.events || []).map((ev) => {
      const comp = (ev.competitions || [])[0] || {};
      const st = comp.status || ev.status || {};
      const type = st.type || {};
      const odds = (comp.odds || [])[0] || null;
      const sit = comp.situation || {};
      return {
        id: ev.id,
        date: ev.date,                                  // ISO tip-off
        state: type.state || "pre",                     // pre | in | post
        detail: type.shortDetail || type.detail || "",  // "7:30 PM EDT" / "Final" / "3rd 7:42"
        completed: !!type.completed,
        period: st.period ?? null,
        clock: st.displayClock ?? null,
        home: side(comp, "home"),
        away: side(comp, "away"),
        venue: comp.venue?.fullName || null,
        broadcast: ((comp.broadcasts || [])[0]?.names || [])[0] || null,
        odds: odds ? { details: odds.details || null, overUnder: odds.overUnder ?? null } : null,
        lastPlay: sit.lastPlay?.text || null,
        seasonType: ev.season?.type ?? null,            // 1 pre · 2 regular · 3 post
        note: (ev.competitions?.[0]?.notes || [])[0]?.headline || null, // "Play-In", "Game 3", etc.
      };
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({
      date,
      season: d.season?.year ?? null,
      games,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
