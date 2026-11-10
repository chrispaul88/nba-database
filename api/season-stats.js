export const config = { maxDuration: 60 };

// /api/season-stats — this season's per-game averages for every NBA player
// from ESPN's stats table (one request for the whole league). The app lays
// these over the Airtable Stats table as the current-season row, so stats
// move on their own as games are played. Cached 30 minutes.
//
// Optional: ?season=2027 (ESPN's season = the year it ends) · ?seasontype=1 for preseason

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}
const ABBR_FIX = { GS: "GS", SA: "SAS", NO: "NOP", NY: "NY", UTAH: "UTAH", WSH: "WSH" };

// ESPN stat name → app key
const KEYS = {
  gamesPlayed: "gp", avgMinutes: "min", avgPoints: "pts", avgRebounds: "reb", avgAssists: "ast",
  avgSteals: "stl", avgBlocks: "blk", avgTurnovers: "tov",
  fieldGoalPct: "fg", threePointFieldGoalPct: "p3", freeThrowPct: "ft",
  avgFieldGoalsMade: "fgm", avgFieldGoalsAttempted: "fga",
  avgThreePointFieldGoalsMade: "p3m", avgThreePointFieldGoalsAttempted: "p3a",
  avgFreeThrowsMade: "ftm", avgFreeThrowsAttempted: "fta",
  avgOffensiveRebounds: "oreb", avgDefensiveRebounds: "dreb", avgFouls: "pf", plusMinus: "pm",
  offensiveRebounds: "oreb_t", defensiveRebounds: "dreb_t",
};

// Box-score column label → app key (for live overlay from in-progress games)
const BOX = { MIN: "min", PTS: "pts", REB: "reb", OREB: "oreb", DREB: "dreb", AST: "ast", STL: "stl", BLK: "blk", TO: "tov", FG: "fg_", "3PT": "p3_", FT: "ft_" };
const splitMade = (v) => { const m = String(v || "").match(/^(\d+)-(\d+)$/); return m ? [Number(m[1]), Number(m[2])] : [0, 0]; };
const nrm = (s) => String(s || "").toLowerCase().replace(/[.'’-]/g, "").replace(/\s+/g, " ").trim();

const TEAM_BOX = { PTS: "pts", REB: "reb", OREB: "oreb", DREB: "dreb", AST: "ast", STL: "stl", BLK: "blk", TO: "tov", FG: "fg_", "3PT": "p3_", FT: "ft_", FIELDGOALSMADE: "fgm", REBOUNDS: "reb", OFFENSIVEREBOUNDS: "oreb", DEFENSIVEREBOUNDS: "dreb", ASSISTS: "ast", STEALS: "stl", BLOCKS: "blk", TURNOVERS: "tov" };

// ── ?recap=7 → digest of the last N days: team records/margins, top performers, big games ──
async function recap(days) {
  const to = new Date(); const from = new Date(to.getTime() - days * 86400000);
  const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  let events = [];
  try { events = (await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${ymd(from)}-${ymd(to)}&limit=1000`)).events || []; } catch {}
  const done = events.filter((e) => (e.season?.type == null || e.season.type === 2) && e.competitions?.[0]?.status?.type?.completed);
  const T = {}, P = {}, games = [];
  const team = (ab) => T[ab] || (T[ab] = { team: ab, w: 0, l: 0, pf: 0, pa: 0, gp: 0 });
  for (const e of done) {
    const c = e.competitions?.[0] || {};
    const [x, y] = c.competitors || [];
    if (!x || !y) continue;
    for (const [me, them] of [[x, y], [y, x]]) {
      const raw = String(me.team?.abbreviation || "").toUpperCase(); const ab = ABBR_FIX[raw] || raw;
      const t = team(ab); t.gp++; t.pf += Number(me.score) || 0; t.pa += Number(them.score) || 0; if (me.winner) t.w++; else t.l++;
    }
  }
  for (let i = 0; i < done.length; i += 8) {
    const sums = await Promise.all(done.slice(i, i + 8).map((e) => getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${e.id}`).catch(() => null)));
    sums.forEach((s, j) => {
      const e = done[i + j]; const comp = (e.competitions || [])[0] || {};
      for (const tb of s?.boxscore?.players || []) {
        const grp = (tb.statistics || [])[0] || {}; const cols = grp.names || grp.labels || [];
        const raw = String(tb.team?.abbreviation || "").toUpperCase(); const ab = ABBR_FIX[raw] || raw;
        const mine = (comp.competitors || []).find((cc) => String(cc.team?.id) === String(tb.team?.id)); const opp = (comp.competitors || []).find((cc) => String(cc.team?.id) !== String(tb.team?.id));
        const oraw = String(opp?.team?.abbreviation || "").toUpperCase();
        for (const a of grp.athletes || []) {
          if (a.didNotPlay) continue;
          const name = a.athlete?.displayName || ""; const v = (k) => { const ix = cols.indexOf(k); return ix >= 0 ? a.stats?.[ix] : null; };
          const line = { pts: Number(v("PTS")) || 0, reb: Number(v("REB")) || 0, ast: Number(v("AST")) || 0, p3: splitMade(v("3PT")), stl: Number(v("STL")) || 0, blk: Number(v("BLK")) || 0 };
          const rec = P[nrm(name)] || (P[nrm(name)] = { name, team: ab, gp: 0, pts: 0, reb: 0, ast: 0, p3m: 0, p3a: 0 });
          rec.gp++; rec.pts += line.pts; rec.reb += line.reb; rec.ast += line.ast; rec.p3m += line.p3[0]; rec.p3a += line.p3[1]; rec.team = ab;
          games.push({ name, team: ab, opp: ABBR_FIX[oraw] || oraw, home: mine?.homeAway === "home", date: e.date, ...line });
        }
      }
    });
  }
  const teams = Object.values(T).map((t) => ({ ...t, ppg: t.pf / (t.gp || 1), oppPpg: t.pa / (t.gp || 1), margin: (t.pf - t.pa) / (t.gp || 1) })).filter((t) => t.gp > 0);
  const byMargin = teams.slice().sort((a, b) => (b.w - b.l) - (a.w - a.l) || b.margin - a.margin);
  const players = Object.values(P).filter((r) => r.gp >= Math.max(1, Math.floor(days / 7)));
  const top = (k, n = 5) => players.slice().sort((a, b) => b[k] - a[k]).slice(0, n);
  const per = (r) => ({ ...r, ppg: r.pts / r.gp, rpg: r.reb / r.gp, apg: r.ast / r.gp, p3pg: r.p3m / r.gp, p3pct: r.p3a ? Math.round((r.p3m / r.p3a) * 1000) / 10 : 0 });
  return {
    days, from: from.toISOString(), to: to.toISOString(), games: done.length,
    teamsBest: byMargin.slice(0, 5), teamsWorst: byMargin.slice(-5).reverse(),
    topScorers: players.map(per).sort((a, b) => b.ppg - a.ppg).slice(0, 8),
    topRebounders: players.map(per).sort((a, b) => b.rpg - a.rpg).slice(0, 5),
    topPassers: players.map(per).sort((a, b) => b.apg - a.apg).slice(0, 5),
    topShooters: players.map(per).filter((r) => r.p3a / r.gp >= 4).sort((a, b) => b.p3pg - a.p3pg).slice(0, 5),
    bigGames: games.slice().sort((a, b) => b.pts - a.pts).slice(0, 8),
    tripleDoubles: games.filter((g) => [g.pts, g.reb, g.ast, g.stl, g.blk].filter((x) => x >= 10).length >= 3).sort((a, b) => new Date(b.date) - new Date(a.date)),
  };
}


// Every completed regular-season game between two dates, fetched one day at a time
// in parallel. ESPN's date-range query sometimes comes back empty; single days don't.
async function eventsBetween(from, to) {
  const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const days = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400000)) days.push(ymd(d));
  const out = []; const seen = new Set();
  for (let i = 0; i < days.length; i += 15) {
    const res = await Promise.all(days.slice(i, i + 15).map((x) => getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${x}`).catch(() => ({ events: [] }))));
    for (const r of res) for (const e of r.events || []) if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
  }
  return out;
}

export default async function handler(req, res) {
  try {
    const now = new Date();
    // ── per-player game logs, last N days (default 30), compact ──
    if (req.query?.logs) {
      // ?logs=season (default) → since opening night; ?logs=30 → last 30 days
      const to = new Date();
      const seasonStart = new Date((now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1), 9, 15);
      const from = String(req.query.logs) === "season" || !Number(req.query.logs) ? seasonStart : new Date(to.getTime() - Math.min(120, Math.max(7, Number(req.query.logs))) * 86400000);
      const days = Math.round((to - from) / 86400000);
      const events = await eventsBetween(from, to);
      // ?teams=BOS,NY,… → only read games involving those teams (tonight's slate) — far fewer box scores
      const want = String(req.query.teams || "").toUpperCase().split(",").map((x) => x.trim()).filter(Boolean);
      const fixA = (x) => { const u = String(x || "").toUpperCase(); return ABBR_FIX[u] || u; };
      const VAR = { GS: "GSW", GSW: "GS", SA: "SAS", SAS: "SA", NO: "NOP", NOP: "NO", NY: "NYK", NYK: "NY", UTAH: "UTA", UTA: "UTAH", WSH: "WAS", WAS: "WSH", PHX: "PHO", PHO: "PHX", BKN: "BRK", BRK: "BKN" };
      const wantSet = new Set(want.flatMap((x) => [x, fixA(x), VAR[x], VAR[fixA(x)]].filter(Boolean)));
      const involves = (e) => !wantSet.size || (e.competitions?.[0]?.competitors || []).some((c) => { const ab = String(c.team?.abbreviation || "").toUpperCase(); return wantSet.has(ab) || wantSet.has(fixA(ab)); });
      const done = events.filter((e) => (e.season?.type == null || e.season.type === 2) && e.competitions?.[0]?.status?.type?.completed && involves(e));
      const logs = {};
      for (let i = 0; i < done.length; i += 20) {
        const sums = await Promise.all(done.slice(i, i + 20).map((e) => getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${e.id}`).catch(() => null)));
        sums.forEach((s, j) => {
          const e = done[i + j]; const comp = (e.competitions || [])[0] || {};
          for (const tb of s?.boxscore?.players || []) {
            const grp = (tb.statistics || [])[0] || {}; const cols = grp.labels && grp.labels.includes("PTS") ? grp.labels : (grp.names || grp.labels || []);
            const raw = String(tb.team?.abbreviation || "").toUpperCase(); const ab = ABBR_FIX[raw] || raw;
            if (wantSet.size && !wantSet.has(raw) && !wantSet.has(ab)) continue;
            const opp = (comp.competitors || []).find((cc) => String(cc.team?.id) !== String(tb.team?.id)); const oraw = String(opp?.team?.abbreviation || "").toUpperCase();
            const mine = (comp.competitors || []).find((cc) => String(cc.team?.id) === String(tb.team?.id));
            for (const a of grp.athletes || []) {
              if (a.didNotPlay) continue;
              const v = (k) => { const ix = cols.indexOf(k); return ix >= 0 ? a.stats?.[ix] : null; };
              const minv = Number(String(v("MIN") || "0").split(":")[0]) || 0; if (minv <= 0) continue;
              const name = a.athlete?.displayName || ""; const rec = logs[nrm(name)] || (logs[nrm(name)] = { name, team: ab, g: [] });
              rec.team = ab;
              rec.g.push({ d: e.date, o: ABBR_FIX[oraw] || oraw, h: mine?.homeAway === "home", min: minv, pts: Number(v("PTS")) || 0, reb: Number(v("REB")) || 0, ast: Number(v("AST")) || 0, stl: Number(v("STL")) || 0, blk: Number(v("BLK")) || 0, p3m: splitMade(v("3PT"))[0], p3a: splitMade(v("3PT"))[1] });
            }
          }
        });
      }
      for (const r of Object.values(logs)) r.g.sort((x, y) => new Date(x.d) - new Date(y.d));
      res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
      return res.status(200).json({ days, from: from.toISOString(), games: done.length, scanned: events.length, players: Object.values(logs), updatedAt: new Date().toISOString() });
    }
    if (req.query?.recap) {
      const out = await recap(Math.min(60, Math.max(1, Number(req.query.recap) || 7)));
      res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
      return res.status(200).json(out);
    }
    // ── per-player game log (one ESPN call) ──
    if (req.query?.gamelog) {
      const id = String(req.query.gamelog).replace(/\D/g, "");
      const g = await getJson(`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/gamelog?region=us&lang=en&contentorigin=espn`);
      const names = g.labels || g.displayNames || g.names || [];
      const alias = { MIN: ["MIN", "minutes"], FG: ["FG", "fieldGoalsMade-fieldGoalsAttempted"], "3PT": ["3PT", "threePointFieldGoalsMade-threePointFieldGoalsAttempted"], FT: ["FT", "freeThrowsMade-freeThrowsAttempted"], REB: ["REB", "totalRebounds"], AST: ["AST", "assists"], BLK: ["BLK", "blocks"], STL: ["STL", "steals"], TO: ["TO", "turnovers"], PTS: ["PTS", "points"] };
      const idx = (n) => { for (const k of alias[n] || [n]) { const i = names.indexOf(k); if (i >= 0) return i; } return -1; };
      const games = [];
      for (const st of g.seasonTypes || []) {
        if (!/regular/i.test(st.displayName || "") ) continue;
        for (const cat of st.categories || []) for (const ev of cat.events || []) {
          const meta = g.events?.[ev.eventId] || {};
          const v = (n) => { const i = idx(n); return i >= 0 ? ev.stats?.[i] : null; };
          const made = (n) => splitMade(v(n));
          games.push({ id: ev.eventId, date: meta.gameDate || null, opp: meta.opponent?.abbreviation || "", home: meta.atVs === "vs", result: meta.gameResult || "", score: meta.score || "",
            min: Number(v("MIN")) || 0, pts: Number(v("PTS")) || 0, reb: Number(v("REB")) || 0, ast: Number(v("AST")) || 0, stl: Number(v("STL")) || 0, blk: Number(v("BLK")) || 0, tov: Number(v("TO")) || 0,
            fgm: made("FG")[0], fga: made("FG")[1], p3m: made("3PT")[0], p3a: made("3PT")[1], ftm: made("FT")[0], fta: made("FT")[1] });
        }
      }
      games.sort((x, y) => new Date(x.date || 0) - new Date(y.date || 0));
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json({ id, games, updatedAt: new Date().toISOString() });
    }
    const season = Number(req.query?.season) || (now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear());
    const seasontype = Number(req.query?.seasontype) || 2;
    const base = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&season=${season}&seasontype=${seasontype}&limit=1000`;

    // How many regular-season games have actually been played per team (sanity check)
    const teamGP = {};
    try {
      const st = await getJson(`https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=${season}&seasontype=2`);
      for (const g of st.children || []) for (const e of g.standings?.entries || []) {
        const raw = String(e.team?.abbreviation || "").toUpperCase(); const w = (e.stats || []).find((x) => x.name === "wins")?.value, l = (e.stats || []).find((x) => x.name === "losses")?.value;
        teamGP[ABBR_FIX[raw] || raw] = (Number(w) || 0) + (Number(l) || 0);
      }
    } catch {}
    const maxTeamGP = Math.max(0, ...Object.values(teamGP));

    // 1) Season averages for everyone. ESPN puts the column names on the
    //    top-level categories and only the values on each athlete.
    let tot = {};   // name → { gp, min_t, pts_t, … } running totals
    const young = maxTeamGP <= 25;        // early season: box scores only, don't even ask ESPN's table
    let page = 1, more = !young;
    while (more && page <= 3) {
      const d = await getJson(base + `&page=${page}`);
      const catNames = {};
      for (const c of d.categories || []) catNames[c.name] = c.names || [];
      for (const a of d.athletes || []) {
        const ath = a.athlete || {};
        const avg = {};
        for (const cat of a.categories || []) {
          const names = cat.names || catNames[cat.name] || [];
          const vals = cat.values || [];
          names.forEach((n, i) => { const k = KEYS[n]; if (k && avg[k] == null) { const v = Number(vals[i]); if (!isNaN(v)) avg[k] = v; } });
        }
        const gp = avg.gp || 0;
        const raw = String(ath.teamShortName || ath.team?.abbreviation || "").toUpperCase();
        const rec = { id: ath.id, name: ath.displayName || ath.name || "", team: ABBR_FIX[raw] || raw, pos: ath.position?.abbreviation || "", headshot: ath.headshot?.href || null, gp,
          tot: {}, live: false };
        for (const k of ["min", "pts", "reb", "oreb", "dreb", "ast", "stl", "blk", "tov", "fgm", "fga", "p3m", "p3a", "ftm", "fta"]) rec.tot[k] = (avg[k] || 0) * gp;
        tot[nrm(rec.name)] = rec;
      }
      const pg = d.pagination || {};
      more = pg.page != null && pg.pages != null ? pg.page < pg.pages : (d.athletes || []).length >= 1000;
      page++;
    }

    // Sanity: if ESPN handed back a different season (early in the year its
    // table can still point at last spring's playoffs), nobody's GP would fit
    // the standings. In that case rebuild from this season's box scores.
    const stale = Object.values(tot).some((r) => r.gp > maxTeamGP + 1) || (maxTeamGP > 0 && !Object.values(tot).some((r) => r.gp > 0));
    const fromBox = stale || young;             // early season: box scores are the ground truth anyway
    let gamesUsed = 0, gamesSeen = 0;
    const teamTot = {};
    if (fromBox) {
      tot = {};
      const start = new Date(season - 1, 9, 14), end = new Date();
      const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
      let events = [];
      try { events = (await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${ymd(start)}-${ymd(end)}&limit=1000`)).events || []; } catch {}
      if (!events.length) {   // some ESPN edges reject a range: walk day by day (capped)
        for (let d = new Date(start), n = 0; d <= end && n < 60; d.setDate(d.getDate() + 1), n++) {
          try { events.push(...((await getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${ymd(d)}`)).events || [])); } catch {}
        }
      }
      gamesSeen = events.length;
      const done = events.filter((e) => (e.season?.type == null || e.season.type === 2) && e.competitions?.[0]?.status?.type?.completed);
      gamesUsed = done.length;
      const addGame = (s) => {
        // team line for this game (REB/AST/STL/BLK/TO/FG from the team box, PTS from the header score)
        for (const tb of s?.boxscore?.teams || []) {
          const raw = String(tb.team?.abbreviation || "").toUpperCase(); const ab = ABBR_FIX[raw] || raw;
          const T = teamTot[ab] || (teamTot[ab] = { gp: 0, pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, p3m: 0, p3a: 0, ftm: 0, fta: 0 });
          T.gp += 1;
          const comp = (s.header?.competitions || [])[0] || {};
          const me = (comp.competitors || []).find((c) => String(c.team?.id) === String(tb.team?.id));
          T.pts += Number(me?.score) || 0;
          // what this team ALLOWED (the other team's line) — for the cheat sheet
          const other = (s?.boxscore?.teams || []).find((x) => String(x.team?.id) !== String(tb.team?.id));
          if (other) { const oc = (comp.competitors || []).find((cc) => String(cc.team?.id) === String(other.team?.id)); T.oppPts = (T.oppPts || 0) + (Number(oc?.score) || 0);
            for (const st of other.statistics || []) { const k = TEAM_BOX[(st.abbreviation || "").toUpperCase()] || TEAM_BOX[String(st.label || "").toUpperCase()] || TEAM_BOX[String(st.name || "").toUpperCase()]; if (!k || k === "fgm") continue;
              if (k.endsWith("_")) { const [m, att] = splitMade(st.displayValue); const pfx = k.slice(0, -1); T["opp_" + pfx + "m"] = (T["opp_" + pfx + "m"] || 0) + m; T["opp_" + pfx + "a"] = (T["opp_" + pfx + "a"] || 0) + att; }
              else T["opp_" + k] = (T["opp_" + k] || 0) + (Number(st.displayValue) || 0); } }
          for (const st of tb.statistics || []) {
            const k = TEAM_BOX[(st.abbreviation || "").toUpperCase()] || TEAM_BOX[String(st.label || "").toUpperCase()] || TEAM_BOX[String(st.name || "").toUpperCase()];
            if (!k) continue;
            if (k === "fgm") continue;   // ESPN's "fieldGoalsMade-fieldGoalsAttempted" comes through FG
            if (k.endsWith("_")) { const [m, att] = splitMade(st.displayValue); const pfx = k.slice(0, -1); T[pfx + "m"] += m; T[pfx + "a"] += att; }
            else T[k] += Number(st.displayValue) || 0;
          }
        }
        for (const tb of s?.boxscore?.players || []) {
          const grp = (tb.statistics || [])[0] || {}; const cols = grp.names || grp.labels || [];
          const raw = String(tb.team?.abbreviation || "").toUpperCase();
          for (const a of grp.athletes || []) {
            if (a.didNotPlay) continue;
            const name = a.athlete?.displayName || "";
            let rec = tot[nrm(name)];
            if (!rec) { rec = { id: a.athlete?.id, name, team: ABBR_FIX[raw] || raw, pos: a.athlete?.position?.abbreviation || "", headshot: a.athlete?.headshot?.href || null, gp: 0, tot: Object.fromEntries(["min", "pts", "reb", "oreb", "dreb", "ast", "stl", "blk", "tov", "fgm", "fga", "p3m", "p3a", "ftm", "fta"].map((k) => [k, 0])), live: false }; tot[nrm(name)] = rec; }
            rec.gp += 1;
            cols.forEach((c, i) => {
              const k = BOX[c]; if (!k) return; const v = a.stats?.[i];
              if (k.endsWith("_")) { const [m, att] = splitMade(v); const pfx = k.slice(0, -1); rec.tot[pfx + "m"] += m; rec.tot[pfx + "a"] += att; }
              else rec.tot[k] += Number(v) || 0;
            });
          }
        }
      };
      for (let i = 0; i < done.length; i += 8) {
        const chunk = done.slice(i, i + 8);
        const sums = await Promise.all(chunk.map((e) => getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${e.id}`).catch(() => null)));
        sums.forEach(addGame);
      }
    }

    // 2) Live overlay: games in progress right now aren't in the averages
    //    yet, so add each player's live line on top (gp + 1).
    try {
      const sb = await getJson("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard");
      const live = (sb.events || []).filter((e) => e.competitions?.[0]?.status?.type?.state === "in");
      const sums = await Promise.all(live.map((e) => getJson(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${e.id}`).catch(() => null)));
      for (const s of sums) {
        // team line for the game in progress (so the Profile and PPG move during the game too)
        for (const tb of s?.boxscore?.teams || []) {
          const raw = String(tb.team?.abbreviation || "").toUpperCase(); const ab = ABBR_FIX[raw] || raw;
          const T = teamTot[ab] || (teamTot[ab] = { gp: 0, pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, p3m: 0, p3a: 0, ftm: 0, fta: 0 });
          T.gp += 1; T.live = true;
          const comp = (s.header?.competitions || [])[0] || {};
          const me = (comp.competitors || []).find((c) => String(c.team?.id) === String(tb.team?.id));
          T.pts += Number(me?.score) || 0;
          // what this team ALLOWED (the other team's line) — for the cheat sheet
          const other = (s?.boxscore?.teams || []).find((x) => String(x.team?.id) !== String(tb.team?.id));
          if (other) { const oc = (comp.competitors || []).find((cc) => String(cc.team?.id) === String(other.team?.id)); T.oppPts = (T.oppPts || 0) + (Number(oc?.score) || 0);
            for (const st of other.statistics || []) { const k = TEAM_BOX[(st.abbreviation || "").toUpperCase()] || TEAM_BOX[String(st.label || "").toUpperCase()] || TEAM_BOX[String(st.name || "").toUpperCase()]; if (!k || k === "fgm") continue;
              if (k.endsWith("_")) { const [m, att] = splitMade(st.displayValue); const pfx = k.slice(0, -1); T["opp_" + pfx + "m"] = (T["opp_" + pfx + "m"] || 0) + m; T["opp_" + pfx + "a"] = (T["opp_" + pfx + "a"] || 0) + att; }
              else T["opp_" + k] = (T["opp_" + k] || 0) + (Number(st.displayValue) || 0); } }
          for (const st of tb.statistics || []) {
            const k = TEAM_BOX[(st.abbreviation || "").toUpperCase()] || TEAM_BOX[String(st.label || "").toUpperCase()] || TEAM_BOX[String(st.name || "").toUpperCase()];
            if (!k || k === "fgm") continue;
            if (k.endsWith("_")) { const [m, att] = splitMade(st.displayValue); const pfx = k.slice(0, -1); T[pfx + "m"] += m; T[pfx + "a"] += att; }
            else T[k] += Number(st.displayValue) || 0;
          }
        }
        for (const tb of s?.boxscore?.players || []) {
          const grp = (tb.statistics || [])[0] || {};
          const cols = grp.names || grp.labels || [];
          const raw = String(tb.team?.abbreviation || "").toUpperCase();
          for (const a of grp.athletes || []) {
            if (a.didNotPlay) continue;
            const name = a.athlete?.displayName || "";
            let rec = tot[nrm(name)];
            if (!rec) { rec = { id: a.athlete?.id, name, team: ABBR_FIX[raw] || raw, pos: a.athlete?.position?.abbreviation || "", headshot: a.athlete?.headshot?.href || null, gp: 0, tot: Object.fromEntries(["min", "pts", "reb", "oreb", "dreb", "ast", "stl", "blk", "tov", "fgm", "fga", "p3m", "p3a", "ftm", "fta"].map((k) => [k, 0])), live: false }; tot[nrm(name)] = rec; }
            rec.gp += 1; rec.live = true;
            cols.forEach((c, i) => {
              const k = BOX[c]; if (!k) return;
              const v = a.stats?.[i];
              if (k.endsWith("_")) { const [m, att] = splitMade(v); const pfx = k.slice(0, -1); rec.tot[pfx + "m"] += m; rec.tot[pfx + "a"] += att; }
              else rec.tot[k] += Number(v) || 0;
            });
          }
        }
      }
    } catch {}

    // 3) Back to per-game + percentages
    const players = Object.values(tot).filter((r) => r.gp > 0).map((r) => {
      const g = r.gp, t = r.tot;
      const pg = (k) => Math.round((t[k] / g) * 10) / 10;
      const pct = (m, a) => (t[a] ? Math.round((t[m] / t[a]) * 1000) / 10 : null);
      return { id: r.id, name: r.name, team: r.team, pos: r.pos, headshot: r.headshot, gp: g, live: r.live,
        min: pg("min"), pts: pg("pts"), reb: pg("reb"), oreb: pg("oreb"), dreb: pg("dreb"), ast: pg("ast"), stl: pg("stl"), blk: pg("blk"), tov: pg("tov"),
        fgm: pg("fgm"), fga: pg("fga"), p3m: pg("p3m"), p3a: pg("p3a"), ftm: pg("ftm"), fta: pg("fta"),
        fg: pct("fgm", "fga"), p3: pct("p3m", "p3a"), ft: pct("ftm", "fta") };
    });
    const teams = {};
    for (const [ab, T] of Object.entries(teamTot)) {
      const g = T.gp || 1; const pg = (k) => Math.round((T[k] / g) * 10) / 10; const pct = (m, at) => (T[at] ? Math.round((T[m] / T[at]) * 1000) / 10 : null);
      const opg = (k) => Math.round(((T[k] || 0) / g) * 10) / 10;
      teams[ab] = { gp: T.gp, live: !!T.live, oppPts: opg("oppPts"), opp3pm: opg("opp_p3m"), opp3pa: opg("opp_p3a"), opp3p: T.opp_p3a ? Math.round((T.opp_p3m / T.opp_p3a) * 1000) / 10 : null, oppReb: opg("opp_reb"), oppAst: opg("opp_ast"), oppFta: opg("opp_fta"), pts: pg("pts"), reb: pg("reb"), oreb: pg("oreb"), dreb: pg("dreb"), ast: pg("ast"), stl: pg("stl"), blk: pg("blk"), tov: pg("tov"), fga: pg("fga"), p3a: pg("p3a"), fta: pg("fta"), fg: pct("fgm", "fga"), p3: pct("p3m", "p3a"), ft: pct("ftm", "fta") };
    }
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=240"); // 2-minute window
    return res.status(200).json({ season: `${season - 1}-${season}`, seasontype, source: fromBox ? "box scores" : "espn table", gamesSeen, gamesUsed, maxTeamGP, count: players.length, players, teams, updatedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
