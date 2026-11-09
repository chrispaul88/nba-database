// /api/lineups — the actual starting five for every NBA team, taken from
// ESPN's box score of each team's most recent completed game. The court
// uses this instead of the Airtable Role field whenever it's available, so
// lineups follow what the coach actually ran last night. Cached 6h and
// refreshed by the app on every open, so it rolls forward daily.
//
// Why "last game" and not "tonight": ESPN doesn't publish starters until
// tip-off, so last game's five is the best pre-game truth. Once a game is
// live, the roster's injury status handles the rest (Out → next man up).

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}
const ABBR_FIX = { SA: "SAS", NO: "NOP" };
const fix = (a) => { const u = String(a || "").toUpperCase(); return ABBR_FIX[u] || u; };

export default async function handler(req, res) {
  try {
    const list = await getJson("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=40");
    const teams = ((list.sports || [])[0]?.leagues?.[0]?.teams || []).map((x) => x.team).filter(Boolean);

    // ?schedule=NY → that team's regular-season schedule with results so far
    if (req.query?.schedule) {
      const want = fix(req.query.schedule);
      const t = teams.find((x) => fix(x.abbreviation) === want || [want, req.query.schedule].includes(String(x.abbreviation).toUpperCase()));
      if (!t) return res.status(404).json({ error: "unknown team" });
      const sch = await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${t.id}/schedule?seasontype=2`);
      const games = (sch.events || []).map((e, i) => {
        const c = e.competitions?.[0] || {};
        const me = (c.competitors || []).find((x) => String(x.team?.id) === String(t.id)) || {};
        const opp = (c.competitors || []).find((x) => String(x.team?.id) !== String(t.id)) || {};
        const st = c.status?.type || {};
        return {
          id: e.id, n: i + 1, date: e.date, home: me.homeAway === "home",
          opp: fix(opp.team?.abbreviation), oppName: opp.team?.displayName || "", oppLogo: opp.team?.logos?.[0]?.href || opp.team?.logo || null,
          state: st.state || "pre", completed: !!st.completed, detail: st.shortDetail || "",
          my: me.score?.value ?? me.score?.displayValue ?? null, their: opp.score?.value ?? opp.score?.displayValue ?? null,
          win: me.winner === true ? true : me.winner === false ? false : null,
          broadcast: (c.broadcasts || [])[0]?.media?.shortName || (c.broadcasts || [])[0]?.names?.[0] || null,
        };
      });
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json({ team: want, games, updatedAt: new Date().toISOString() });
    }

    // Latest completed game per team (regular season or playoffs; preseason too if that's all there is)
    const schedules = await Promise.all(teams.map((t) =>
      getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${t.id}/schedule`).catch(() => null)
    ));
    const lastGame = {};
    teams.forEach((t, i) => {
      // completed games, plus tonight's game once it has tipped off (starters are known at tip)
      const evs = (schedules[i]?.events || []).filter((e) => { const st = e.competitions?.[0]?.status?.type || {}; return st.completed || st.state === "in"; });
      evs.sort((a, b) => new Date(b.date) - new Date(a.date));
      if (evs[0]) lastGame[fix(t.abbreviation)] = evs[0];
    });

    // One summary per distinct game (two teams share a box score)
    const eventIds = [...new Set(Object.values(lastGame).map((e) => e.id))];
    const summaries = await Promise.all(eventIds.map((id) =>
      getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${id}`).then((s) => [id, s]).catch(() => [id, null])
    ));
    const byEvent = Object.fromEntries(summaries);

    const lineups = {};
    for (const [abbr, ev] of Object.entries(lastGame)) {
      const s = byEvent[ev.id];
      if (!s) continue;
      const side = (s.boxscore?.players || []).find((p) => fix(p.team?.abbreviation) === abbr);
      const athletes = side?.statistics?.[0]?.athletes || [];
      const starters = athletes.filter((a) => a.starter).map((a) => ({
        name: a.athlete?.displayName || "",
        pos: String(a.athlete?.position?.abbreviation || "").toUpperCase(),
        espnId: a.athlete?.id || null,
        minutes: (a.stats || [])[0] || null,
      })).filter((a) => a.name);
      if (starters.length < 5) continue;
      const comp = ev.competitions?.[0] || {};
      const oppSide = (comp.competitors || []).find((c) => fix(c.team?.abbreviation) !== abbr);
      const mine = (comp.competitors || []).find((c) => fix(c.team?.abbreviation) === abbr);
      lineups[abbr] = {
        starters,
        date: ev.date,
        opp: fix(oppSide?.team?.abbreviation),
        home: mine?.homeAway === "home",
        result: mine && oppSide ? `${mine.winner ? "W" : "L"} ${mine.score?.displayValue ?? mine.score ?? ""}-${oppSide.score?.displayValue ?? oppSide.score ?? ""}` : null,
        eventId: ev.id,
        seasonType: ev.seasonType?.type ?? ev.season?.type ?? null,
      };
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600"); // 5 min — tonight's starters show up during the game
    return res.status(200).json({ count: Object.keys(lineups).length, lineups, updatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
