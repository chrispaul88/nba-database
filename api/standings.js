// /api/standings — every team's record and scoring from ESPN, so Airtable's
// Wins / Losses / PPG / Opp PPG columns no longer need hand entry.
//
// Regular season is the default. Before opening night (all teams 0-0) it
// falls back to the preseason table and says so (phase: "preseason"), so the
// app shows preseason records in October and flips to the real ones on its
// own. Cached 10 minutes.

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}
const ABBR_FIX = { GS: "GS", SA: "SAS", NO: "NOP", NY: "NY", UTAH: "UTAH", WSH: "WSH" };

function parse(d) {
  const groups = d.children || (d.standings ? [d] : []);
  const out = [];
  for (const g of groups) {
    const entries = g.standings?.entries || [];
    for (const e of entries) {
      const t = e.team || {};
      const raw = String(t.abbreviation || "").toUpperCase();
      const stat = (n) => { const s = (e.stats || []).find((x) => x.name === n || x.abbreviation === n); return s ? Number(s.value) : null; };
      out.push({
        abbr: ABBR_FIX[raw] || raw, name: t.displayName || t.name || "",
        wins: stat("wins"), losses: stat("losses"),
        ppg: stat("avgPointsFor"), oppPpg: stat("avgPointsAgainst"),
        diff: stat("pointDifferential") ?? stat("differential"),
        streak: (e.stats || []).find((x) => x.name === "streak")?.displayValue || null,
        gb: (e.stats || []).find((x) => x.name === "gamesBehind")?.displayValue ?? null,
        l10: (e.stats || []).find((x) => /lastten|last ten|L10/i.test(x.name || "") || x.abbreviation === "L10")?.displayValue || null,
        home: (e.stats || []).find((x) => x.name === "Home" || x.abbreviation === "HOME")?.displayValue || null,
        road: (e.stats || []).find((x) => x.name === "Road" || x.abbreviation === "AWAY" || x.abbreviation === "ROAD")?.displayValue || null,
        conference: g.name || g.abbreviation || null,
      });
    }
  }
  return out;
}

export default async function handler(req, res) {
  try {
    const year = Number(req.query?.season) || (new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear()); // ESPN "season" = end year
    const base = `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${year}`;
    let phase = "regular";
    let teams = parse(await getJson(base + "&seasontype=2"));
    // Preseason numbers only until opening night (3rd week of October). Once the
    // regular season has started, 0-0 is the truth even before the first final.
    const opened = new Date() >= new Date(year - 1, 9, 15);
    const played = teams.some((t) => (t.wins || 0) + (t.losses || 0) > 0);
    if (!played && !opened) {
      try { const pre = parse(await getJson(base + "&seasontype=1")); if (pre.length) { teams = pre; phase = "preseason"; } } catch {}
    }
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=240"); // 2-minute window
    return res.status(200).json({ season: year, phase, count: teams.length, teams, updatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
