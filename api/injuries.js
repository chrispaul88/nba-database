// /api/injuries — ESPN's NBA injury feed, flattened and newest-first.
// Each record: player, team, status, injury detail, estimated return, and
// ESPN's write-up. Cached 5 minutes.
//
// Lessons carried over from the NFL version of this feed:
//  - the feed nests as injuries[team].injuries[entry]
//  - the team level has an id + displayName but no abbreviation
//  - the athlete object has no id; it only appears in the player-card link

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

const idFromLinks = (a) => {
  for (const l of a?.links || []) { const m = String(l.href || "").match(/\/id\/(\d+)/); if (m) return m[1]; }
  return a?.id || null;
};

export default async function handler(req, res) {
  try {
    const d = await getJson("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries");
    const out = [];
    for (const team of d.injuries || []) {
      for (const e of team.injuries || []) {
        const a = e.athlete || {};
        const det = e.details || {};
        // "Right Ankle Sprain" → shown lowercase in parentheses by the app
        const detail = [det.side, det.type, det.detail].filter(Boolean).join(" ").trim() || null;
        out.push({
          id: e.id,
          espnId: idFromLinks(a),
          name: a.displayName || a.fullName || "",
          jersey: a.jersey || null,
          pos: String(a.position?.abbreviation || "").toUpperCase(),
          headshot: a.headshot?.href || null,
          team: team.displayName || "",
          teamId: team.id,
          status: e.status || null,                 // Out · Day-To-Day · Questionable · Doubtful …
          date: e.date || null,                     // when ESPN last updated this entry
          detail,
          returnDate: det.returnDate || null,
          comment: e.longComment || e.shortComment || null,
        });
      }
    }
    // Game-day report: ESPN's game pages carry the official Questionable / Doubtful /
    // Probable designations hours before the league-wide feed changes. Overlay them.
    try {
      const sb = await (await fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard", { headers: { accept: "application/json" } })).json();
      const todays = (sb.events || []).filter((e) => e.competitions?.[0]?.status?.type?.state !== "post");
      const sums = await Promise.all(todays.map((e) => fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${e.id}`, { headers: { accept: "application/json" } }).then((r) => r.json()).catch(() => null)));
      const byName = {}; for (const r of out) byName[r.name.toLowerCase()] = r;
      const SEV = (s) => { const x = String(s || "").toLowerCase(); return /out/.test(x) ? 5 : /doubt/.test(x) ? 4 : /quest/.test(x) ? 3 : /day/.test(x) ? 2 : /prob/.test(x) ? 1 : 0; };
      for (const s of sums) for (const tm of s?.injuries || []) for (const inj of tm.injuries || []) {
        const a = inj.athlete || {}; const name = a.displayName || a.fullName || ""; if (!name) continue;
        const status = inj.status || inj.type?.description || null; if (!status) continue;
        const det = inj.details || {};
        const detail = [det.side, det.type, det.detail].filter(Boolean).join(" ").trim() || null;
        const cur = byName[name.toLowerCase()];
        if (cur) {
          // the game-day designation wins over a generic Day-To-Day; never downgrade an Out
          if (SEV(cur.status) < 5 && /quest|doubt|prob|out/i.test(status)) { cur.status = status; cur.gameDay = true; cur.date = inj.date || cur.date; if (!cur.detail && detail) cur.detail = detail; }
        } else {
          const rec = { id: inj.id || "gd-" + a.id, espnId: a.id || null, name, jersey: a.jersey || null, pos: String(a.position?.abbreviation || "").toUpperCase(), headshot: a.headshot?.href || null,
            team: tm.team?.displayName || "", teamId: tm.team?.id, status, gameDay: true, date: inj.date || new Date().toISOString(), detail, returnDate: det.returnDate || null, comment: inj.longComment || inj.shortComment || null };
          out.push(rec); byName[name.toLowerCase()] = rec;
        }
      }
    } catch {}
    out.sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=240"); // 2-minute window
    return res.status(200).json({ count: out.length, records: out, updatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
