// /api/game?id=<espn event id> — one NBA game's live detail from ESPN's
// summary endpoint: status, line score by quarter, each team's leaders
// (PTS / REB / AST), and the latest plays. Cached 30s so a live game ticks.

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

const ABBR_FIX = { GS: "GS", SA: "SAS", NO: "NOP", NY: "NY", UTAH: "UTAH", WSH: "WSH" };

function teamSide(c) {
  const t = c.team || {};
  const raw = String(t.abbreviation || "").toUpperCase();
  const rec = (c.records || []).find((r) => r.type === "total" || r.name === "overall") || (c.records || [])[0];
  return {
    id: t.id, abbr: ABBR_FIX[raw] || raw, name: t.displayName || t.name || "", short: t.shortDisplayName || "",
    logo: t.logo || (t.logos || [])[0]?.href || null, color: t.color ? "#" + t.color : null,
    score: c.score != null && c.score !== "" ? Number(c.score) : null,
    record: rec ? rec.summary : null, winner: !!c.winner, homeAway: c.homeAway,
    linescores: (c.linescores || []).map((q) => Number(q.displayValue ?? q.value)),
  };
}

export default async function handler(req, res) {
  try {
    const id = String(req.query?.id || "").trim();
    if (!/^\d+$/.test(id)) return res.status(400).json({ error: "id required" });
    const d = await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${id}`);
    const comp = (d.header?.competitions || [])[0] || {};
    const st = comp.status || {};
    const type = st.type || {};
    const sides = (comp.competitors || []).map(teamSide);
    const home = sides.find((s) => s.homeAway === "home") || sides[0];
    const away = sides.find((s) => s.homeAway === "away") || sides[1];

    // leaders per team: ESPN gives a list of categories each with top athletes
    const leaders = {};
    for (const L of d.leaders || []) {
      const ab = ABBR_FIX[String(L.team?.abbreviation || "").toUpperCase()] || String(L.team?.abbreviation || "").toUpperCase();
      leaders[ab] = (L.leaders || []).map((cat) => {
        const top = (cat.leaders || [])[0];
        return top ? { cat: cat.shortDisplayName || cat.displayName || cat.name, value: top.displayValue, name: top.athlete?.shortName || top.athlete?.displayName || "", headshot: top.athlete?.headshot?.href || null } : null;
      }).filter(Boolean);
    }

    // latest plays, newest first
    const plays = (d.plays || []).slice(-40).reverse().map((p) => ({
      id: p.id, text: p.text || "", period: p.period?.number ?? null, clock: p.clock?.displayValue || "",
      team: ABBR_FIX[String(p.team?.abbreviation || "").toUpperCase()] || null,
      scoring: !!p.scoringPlay, away: p.awayScore ?? null, home: p.homeScore ?? null, scoreValue: p.scoreValue ?? 0,
    }));

    // box score: one block per team — column labels + a row per player
    const box = {};
    for (const tb of d.boxscore?.players || []) {
      const ab = ABBR_FIX[String(tb.team?.abbreviation || "").toUpperCase()] || String(tb.team?.abbreviation || "").toUpperCase();
      const grp = (tb.statistics || [])[0] || {};
      box[ab] = {
        cols: grp.names || grp.labels || [],
        rows: (grp.athletes || []).map((a) => ({
          id: a.athlete?.id, name: a.athlete?.shortName || a.athlete?.displayName || "", pos: a.athlete?.position?.abbreviation || "",
          starter: !!a.starter, dnp: !!a.didNotPlay, reason: a.reason || null, stats: a.stats || [],
        })),
      };
    }

    const info = d.gameInfo || {};
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({
      id, state: type.state || "pre", detail: type.shortDetail || type.detail || "", completed: !!type.completed,
      period: st.period ?? null, clock: st.displayClock ?? null, date: comp.date || d.header?.competitions?.[0]?.date || null,
      home, away, leaders, plays, box,
      venue: info.venue?.fullName || null, attendance: info.attendance ?? null,
      broadcast: ((comp.broadcasts || [])[0]?.media?.shortName) || null,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
