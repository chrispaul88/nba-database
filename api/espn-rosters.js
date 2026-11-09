// /api/espn-rosters — every NBA roster from ESPN in one call: headshot,
// position (PG/SG/SF/PF/C), jersey number, height, per player. The app uses
// this the way the NFL app uses Sleeper: photos fill in automatically when
// the Airtable attachment is blank, and positions fill in when Airtable
// says just "G" or "F" (or nothing). Cached 6h — rosters don't move fast.

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

const ABBR_FIX = { SA: "SAS", NO: "NOP" };
// Same normalizer the app uses for name matching: strip accents, dots,
// apostrophes, Jr/Sr/II/III suffixes.
const nrm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.'’]/g, "").replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "").replace(/\s+/g, " ").trim().toLowerCase();

// ?lookup=Name|Name — headshots for players not on any roster (retired):
// ESPN keeps every player's last headshot, found by searching the name.
async function lookupHeadshots(names) {
  const out = {};
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  await Promise.all(names.slice(0, 40).map(async (n) => {
    try {
      const r = await fetch(`https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(n)}&limit=10`, { headers: { accept: "application/json" } });
      if (!r.ok) return;
      const d = await r.json();
      const players = (d.results || []).filter((x) => x.type === "player").flatMap((x) => x.contents || []);
      // NBA players only (league id 46), best name match first
      const nba = players.filter((c) => /l:46\b/.test(String(c.uid || "")) || /nba/i.test(String(c.defaultLeagueSlug || "")));
      // Exact name only — "Gary Payton" must never resolve to "Gary Payton II".
      const base = (x) => norm(x).replace(/\b(jr|sr|ii|iii|iv)\b/g, "").replace(/\s+/g, " ").trim();
      const words = (x) => norm(x).split(" ").length;
      const exact = nba.find((c) => norm(c.displayName) === norm(n))
        || nba.find((c) => base(c.displayName) === base(n) && words(c.displayName) === words(n));
      if (!exact) return;
      const id = String(exact.uid || "").split("a:").pop() || exact.id;
      out[n] = exact.image?.default || (id ? `https://a.espncdn.com/i/headshots/nba/players/full/${id}.png` : null);
    } catch {}
  }));
  return out;
}

export default async function handler(req, res) {
  if (req.query?.lookup) {
    const names = String(req.query.lookup).split("|").map((x) => x.trim()).filter(Boolean);
    const heads = await lookupHeadshots(names);
    res.setHeader("Cache-Control", "s-maxage=2592000, stale-while-revalidate=2592000"); // 30 days — retired players don't change
    return res.status(200).json({ headshots: heads });
  }
  try {
    const list = await getJson("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=40");
    const teams = ((list.sports || [])[0]?.leagues?.[0]?.teams || []).map((x) => x.team).filter(Boolean);
    const rosters = await Promise.all(teams.map((t) =>
      getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${t.id}/roster`).catch(() => null)
    ));
    const players = {};
    teams.forEach((t, i) => {
      const raw = String(t.abbreviation || "").toUpperCase();
      const abbr = ABBR_FIX[raw] || raw;
      for (const a of (rosters[i]?.athletes || [])) {
        const name = a.fullName || a.displayName || "";
        if (!name) continue;
        const rec = {
          name,
          team: abbr,
          pos: String(a.position?.abbreviation || "").toUpperCase(),
          no: a.jersey || null,
          height: a.displayHeight || null,
          headshot: a.headshot?.href || null,
          age: a.age ?? null,
          injury: (a.injuries || [])[0]?.status || null,
          // ESPN's injury write-up + estimated return, when it has one
          injuryDetail: (() => { const inj = (a.injuries || [])[0]; if (!inj) return null; const d = inj.details || {}; return [d.side, d.type, d.detail].filter(Boolean).join(" ") || null; })(),
          injuryReturn: (a.injuries || [])[0]?.details?.returnDate || null,
          injuryComment: (a.injuries || [])[0]?.longComment || (a.injuries || [])[0]?.shortComment || null,
          espnId: a.id,
        };
        players[nrm(name)] = rec;
        // second key: TEAM|lastname, for the odd spelling mismatch
        const last = nrm(name).split(" ").pop();
        players[abbr + "|" + last] ??= rec;
      }
    });
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    return res.status(200).json({ count: Object.keys(players).length, teams: teams.length, players, updatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
