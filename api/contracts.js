// Vercel serverless function: fetches your Airtable base server-side and
// returns ALL players (for the Player Hub) with bio, photo, and contract
// history (for the Contracts tab).
//
// Robustness:
//  1. Link fields between tables are AUTO-DETECTED by record ids.
//  2. Field names are matched fuzzily (case/space/punctuation-insensitive)
//     against candidate lists below.
//  3. Linked "Team Name" values (record ids) are resolved via the Teams table.
//
// Env vars required: AIRTABLE_TOKEN, AIRTABLE_BASE_ID

const TABLES = {
  players: "Players",
  contracts: "Contracts",
  years: "Contract Years",
  teams: "Teams", // optional - used to resolve linked team names
  stats: "Stats", // optional - season averages, one row per player per season
};

const FIELDS = {
  playerName: ["Name", "Player Name", "Full Name"],
  playerPos: ["Position", "Pos"],
  playerNo: ["No.", "No", "Number", "Jersey", "Jersey Number"],
  playerTeamName: ["Team Name", "Team", "Current Team"],
  playerStatus: ["Status", "Player Status", "Availability"],
  player2K: ["2K Rating", "2K", "NBA 2K Rating", "2K26 Rating", "2K Overall"],
  playerInjury: ["Injury Notes", "Injury Note", "Injury", "Injury Status", "Injury Report"],
  playerPhoto: ["Photo", "Headshot", "Headshots", "Player Photo", "Image", "Img", "Pic", "Picture", "Attachment", "Attachments"],
  playerHeight: ["Height"],
  playerWeight: ["Weight"],
  playerAge: ["Age"],
  playerStatus: ["Status"],
  playerArchetype: ["Archetype", "Player Type", "Play Style"],
  playerRole: ["Role", "Depth Chart", "Depth", "Lineup Role", "Rotation"],
  playerSort: ["Sort Priority", "Sort", "Priority", "Depth Order", "Order"],
  playerDraft: ["Draft", "Draft Info", "Drafted"],
  playerDraftTeam: ["Draft Team", "Drafted By", "Drafting Team"],
  playerDraftYear: ["Draft Year"],
  playerDraftRound: ["Draft Round", "Round", "Rd"],
  playerDraftPick: ["Draft Pick", "Pick", "Pick No", "Pick Number"],
  playerBirthplace: ["Birthplace", "Birth Place", "Born", "Hometown"],
  playerDob: ["DOB", "Date of Birth", "Birthdate", "Birth Date", "Birthday"],
  playerLastSeason: ["Last Season", "Retired", "Retired Year", "Final Season", "Retirement Year"],
  playerReturnDate: ["Return Date", "Est Return", "Estimated Return", "Estimated Return Date"],
  playerCollege: ["College", "School", "College/Country"],
  playerAwards: ["Awards", "Accolades", "Honors"],
  teamConference: ["Conference", "Conf"],
  teamHeadCoach: ["Head Coach", "Coach", "HC"],
  teamArena: ["Arena", "Home Arena", "Venue", "Stadium"],
  teamCourtLogo: ["Court Logo", "Floor Logo", "Center Court Logo"],
  teamAsstCoach: ["Assistant Coach", "Assistant", "Asst Coach", "Associate Head Coach", "Lead Assistant", "AC1"],
  teamHcSince: ["HC Since", "Head Coach Since", "HC Start"],
  teamAcSince: ["AC1 Since", "AC Since", "Assistant Coach Since", "AC1 since"],
  teamAsstCoach2: ["AC2", "Assistant Coach 2", "Second Assistant"],
  teamAcSince2: ["AC2 Since", "AC2 since"],
  teamDivision: ["Division", "Div"],
  teamWins: ["W", "Wins"],
  teamPPG: ["PPG", "Points Per Game", "Team PPG", "Offense PPG", "PTS/G"],
  teamOppPPG: ["OPP PPG", "Opp PPG", "PPG Allowed", "Points Allowed", "OPPG", "Defense PPG", "Opp PTS/G"],
  teamLosses: ["L", "Losses"],
  teamName: ["Name", "Team Name", "Team"],
  teamAbbr: ["TM", "Abbreviation", "Abbr", "Short Name", "Code"],
  cKind: ["Contract Type", "Kind", "Type", "Deal Type"],
  cStatus: ["Status", "Contract Status"],
  cTeam: ["Team", "Signing Team"],
  cSigned: ["Signed Date", "Signed", "Date Signed", "Signed Year"],
  ySeason: ["Season", "Year"],
  sSeason: ["Season", "Year"],
  sGP: ["GP", "G", "Games", "Games Played", "Gms", "# Games", "Game Count", "GP (Games Played)"],
  sMIN: ["MIN", "MPG", "Minutes", "MP"],
  sPTS: ["PTS", "P", "PPG", "Points"],
  sREB: ["REB", "R", "RPG", "Rebounds", "TRB"],
  sAST: ["AST", "A", "APG", "Assists"],
  sSTL: ["STL", "S", "SPG", "Steals"],
  sBLK: ["BLK", "B", "BPG", "Blocks"],
  sTOV: ["TOV", "TO", "Turnovers", "TOs", "Turnover"],
  sFG: ["FG%", "FG Pct", "Field Goal %", "FG"],
  s3P: ["3P%", "3PT%", "3P Pct", "Three Point %"],
  sFT: ["FT%", "FT Pct", "Free Throw %"],
  sFGM: ["FGM", "FG Made"],
  sFGA: ["FGA", "FG Att", "FG Attempts"],
  s3PM: ["3PM", "3PTM"],
  s3PA: ["3PA", "3PTA"],
  sFTM: ["FTM"],
  sFTA: ["FTA"],
  ySalary: ["Salary", "Amount", "Cap Hit"],
  yType: ["Type", "Year Type", "Guarantee"],
  yDecision: ["Result", "Decision", "Option Decision", "Option Result"],
  yDeadline: ["Deadline", "Decision Deadline", "Option Deadline", "Due Date"],
  yGuaranteed: ["Guaranteed $", "Guaranteed", "Guaranteed Amount", "Gtd"],
};

// Keys are normalized (lowercase, no spaces/punctuation) to match norm()
const TYPE_MAP = {
  "guaranteed": "G",
  "playeroption": "PO",
  "teamoption": "TO",
  "nonguaranteed": "NG",
  "partiallyguaranteed": "PG",
  "ufa": "UFA",
  "rfa": "RFA",
};


// Accepts a number, a numeric string ("4"), or an array holding either
// (single selects and lookups often arrive as strings/arrays).
function coerceNum(v) {
  if (Array.isArray(v)) v = v[0];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? null : n;
  }
  return null;
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const isRecId = (v) => typeof v === "string" && /^rec[a-zA-Z0-9]{14}$/.test(v);

function getField(fields, candidates) {
  const keys = Object.keys(fields);
  for (const cand of candidates) {
    const target = norm(cand);
    for (const k of keys) {
      if (norm(k) === target) return fields[k];
    }
  }
  return undefined;
}

// Returns a clean string; resolves linked record ids via resolver map;
// never lets a raw rec id through.
function asText(val, resolver) {
  if (val == null) return "";
  if (Array.isArray(val)) {
    const parts = val
      .map((v) => asText(v, resolver))
      .filter(Boolean);
    return parts.join(", ");
  }
  if (isRecId(val)) return (resolver && resolver[val]) || "";
  return String(val);
}

function photoUrl(val) {
  if (Array.isArray(val) && val[0] && typeof val[0] === "object" && val[0].url) {
    const att = val[0];
    return (att.thumbnails && att.thumbnails.large && att.thumbnails.large.url) || att.url;
  }
  return null;
}

// Fallback: scan every field for an attachment-shaped value (array of
// objects with a url). Finds the headshot no matter what the field is named.
function findAnyPhoto(fields) {
  for (const val of Object.values(fields)) {
    const url = photoUrl(val);
    if (url) return url;
  }
  return null;
}

async function fetchAll(base, table, token) {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable table "${table}": ${res.status} ${await res.text()}`);
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

function findLink(fields, targetIds) {
  for (const val of Object.values(fields)) {
    if (Array.isArray(val)) {
      for (const item of val) {
        if (isRecId(item) && targetIds.has(item)) return item;
      }
    }
  }
  return null;
}

function seasonLabel(s) {
  if (!s) return "";
  const parts = String(s).split("-");
  const end = parts[1] || parts[0];
  return "'" + String(end).slice(-2);
}

export default async function handler(req, res) {
  try {
    const token = process.env.AIRTABLE_TOKEN;
    const base = process.env.AIRTABLE_BASE_ID;
    if (!token || !base) {
      return res.status(500).json({ error: "Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID env var" });
    }

    const [players, contracts, years] = await Promise.all([
      fetchAll(base, TABLES.players, token),
      fetchAll(base, TABLES.contracts, token),
      fetchAll(base, TABLES.years, token),
    ]);

    // Stats are optional: prefer a single "Stats" table; fall back to the
    // legacy per-season table name if it exists.
    let statRecords = [];
    let impliedSeason = null;
    try {
      statRecords = await fetchAll(base, TABLES.stats, token);
    } catch {
      try {
        statRecords = await fetchAll(base, "2025-2026 Stats", token);
        impliedSeason = "2025-2026";
      } catch {
        statRecords = [];
      }
    }

    // Teams table is optional - used only to translate linked ids to names.
    let teamNameById = {};
    let teamsOut = [];
    try {
      const teams = await fetchAll(base, TABLES.teams, token);
      for (const t of teams) {
        const abbr = asText(getField(t.fields, FIELDS.teamAbbr));
        const name = asText(getField(t.fields, FIELDS.teamName));
        teamNameById[t.id] = abbr || name || "";
        teamsOut.push({
          id: t.id,
          name: name || abbr,
          abbr,
          conference: asText(getField(t.fields, FIELDS.teamConference)),
          division: asText(getField(t.fields, FIELDS.teamDivision)),
          wins: coerceNum(getField(t.fields, FIELDS.teamWins)),
          ppg: coerceNum(getField(t.fields, FIELDS.teamPPG)),
          oppPpg: coerceNum(getField(t.fields, FIELDS.teamOppPPG)),
          losses: coerceNum(getField(t.fields, FIELDS.teamLosses)),
          logo: findAnyPhoto(t.fields),
          headCoach: asText(getField(t.fields, FIELDS.teamHeadCoach)),
          arena: asText(getField(t.fields, FIELDS.teamArena)),
          courtLogo: (() => { const v = getField(t.fields, FIELDS.teamCourtLogo); return Array.isArray(v) && v[0] ? (v[0].thumbnails?.large?.url || v[0].url) : (typeof v === "string" ? v : null); })(),
          asstCoach: asText(getField(t.fields, FIELDS.teamAsstCoach)),
          hcSince: asText(getField(t.fields, FIELDS.teamHcSince)),
          acSince: asText(getField(t.fields, FIELDS.teamAcSince)),
          asstCoach2: asText(getField(t.fields, FIELDS.teamAsstCoach2)),
          acSince2: asText(getField(t.fields, FIELDS.teamAcSince2)),
        });
      }
      teamsOut.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    } catch {
      teamNameById = {};
      teamsOut = [];
    }

    const playerIds = new Set(players.map((p) => p.id));
    const contractIds = new Set(contracts.map((c) => c.id));

    const statsByPlayer = {};
    for (const r of statRecords) {
      const pid = findLink(r.fields, playerIds);
      if (!pid) continue;
      (statsByPlayer[pid] ??= []).push({
        season: asText(getField(r.fields, FIELDS.sSeason)) || impliedSeason || "",
        gp: coerceNum(getField(r.fields, FIELDS.sGP)),
        min: coerceNum(getField(r.fields, FIELDS.sMIN)),
        pts: coerceNum(getField(r.fields, FIELDS.sPTS)),
        reb: coerceNum(getField(r.fields, FIELDS.sREB)),
        ast: coerceNum(getField(r.fields, FIELDS.sAST)),
        stl: coerceNum(getField(r.fields, FIELDS.sSTL)),
        blk: coerceNum(getField(r.fields, FIELDS.sBLK)),
        tov: coerceNum(getField(r.fields, FIELDS.sTOV)),
        fg: coerceNum(getField(r.fields, FIELDS.sFG)),
        p3: coerceNum(getField(r.fields, FIELDS.s3P)),
        ft: coerceNum(getField(r.fields, FIELDS.sFT)),
        fgm: coerceNum(getField(r.fields, FIELDS.sFGM)),
        fga: coerceNum(getField(r.fields, FIELDS.sFGA)),
        p3m: coerceNum(getField(r.fields, FIELDS.s3PM)),
        p3a: coerceNum(getField(r.fields, FIELDS.s3PA)),
        ftm: coerceNum(getField(r.fields, FIELDS.sFTM)),
        fta: coerceNum(getField(r.fields, FIELDS.sFTA)),
      });
    }
    for (const [pid, arr] of Object.entries(statsByPlayer)) {
      const bySeason = {};
      for (const st of arr) {
        const key = String(st.season);
        if (!bySeason[key] || (st.gp ?? 0) > (bySeason[key].gp ?? 0)) bySeason[key] = st;
      }
      statsByPlayer[pid] = Object.values(bySeason);
    }
    for (const arr of Object.values(statsByPlayer)) {
      for (const st of arr) {
        // Airtable stores SEASON TOTALS. Convert every counting stat to
        // per-game whenever we know games played (GP > 1).
        // Example: 1927 PTS / 65 GP = 29.6 PPG.
        // Percentages: makes ÷ attempts is the source of truth whenever both
        // columns exist (computed on season totals, before per-game rounding).
        // The stored FG%/3P%/FT% column is only a fallback.
        if (st.fgm != null && st.fga) st.fg = Math.round((st.fgm / st.fga) * 1000) / 10;
        if (st.p3m != null && st.p3a) st.p3 = Math.round((st.p3m / st.p3a) * 1000) / 10;
        if (st.ftm != null && st.fta) st.ft = Math.round((st.ftm / st.fta) * 1000) / 10;
        if (st.gp != null && st.gp > 1) {
          for (const k of ["min", "pts", "reb", "ast", "stl", "blk", "tov", "fgm", "fga", "p3m", "p3a", "ftm", "fta"]) {
            if (st[k] != null) st[k] = Math.round((st[k] / st.gp) * 10) / 10;
          }
        }
        // A shooting percentage must be 0-100. Values above 100 mean the
        // column holds something else (e.g. total makes) - discard those.
        for (const k of ["fg", "p3", "ft"]) if (st[k] != null && (st[k] > 100 || st[k] < 0)) st[k] = null;
        // a "48.7%"-style text or 0.487 fraction both normalize to 48.7
        for (const k of ["fg", "p3", "ft"]) if (st[k] != null && st[k] > 0 && st[k] <= 1) st[k] = Math.round(st[k] * 1000) / 10;
      }
      arr.sort((a, b) => String(b.season).localeCompare(String(a.season)));
    }

    const yearsByContract = {};
    for (const y of years) {
      const cid = findLink(y.fields, contractIds);
      if (!cid) continue;
      const rawSalary = getField(y.fields, FIELDS.ySalary);
      const rawType = asText(getField(y.fields, FIELDS.yType));
      const rawGtd = getField(y.fields, FIELDS.yGuaranteed);
      const season = asText(getField(y.fields, FIELDS.ySeason));
      (yearsByContract[cid] ??= []).push({
        s: seasonLabel(season),
        season,
        salary: typeof rawSalary === "number" ? rawSalary / 1e6 : null,
        type: TYPE_MAP[norm(rawType)] || rawType || "G",
        decision: asText(getField(y.fields, FIELDS.yDecision)) || null,
        deadline: asText(getField(y.fields, FIELDS.yDeadline)) || null,
        gtd: typeof rawGtd === "number" ? rawGtd / 1e6 : null,
      });
    }

    const contractsByPlayer = {};
    for (const c of contracts) {
      const pid = findLink(c.fields, playerIds);
      if (!pid) continue;
      const yrs = (yearsByContract[c.id] || []).sort((a, b) =>
        a.season.localeCompare(b.season)
      );
      const signedRaw = getField(c.fields, FIELDS.cSigned);
      let signed = null;
      if (typeof signedRaw === "number") signed = signedRaw;
      else if (signedRaw) {
        const d = new Date(signedRaw);
        if (!isNaN(d)) signed = d.getFullYear();
      }
      (contractsByPlayer[pid] ??= []).push({
        kind: asText(getField(c.fields, FIELDS.cKind), teamNameById) || "Contract",
        team: asText(getField(c.fields, FIELDS.cTeam), teamNameById),
        status: asText(getField(c.fields, FIELDS.cStatus)) || "Active",
        signed,
        years: yrs,
      });
    }

    const out = players
      .map((p) => ({
        id: p.id,
        name: asText(getField(p.fields, FIELDS.playerName)) || "Unknown",
        pos: asText(getField(p.fields, FIELDS.playerPos)),
        no: asText(getField(p.fields, FIELDS.playerNo)),
        teamName: asText(getField(p.fields, FIELDS.playerTeamName), teamNameById),
        teamId: (() => {
          const v = getField(p.fields, FIELDS.playerTeamName);
          return Array.isArray(v) && typeof v[0] === "string" && /^rec[a-zA-Z0-9]{14}$/.test(v[0]) ? v[0] : null;
        })(),
        status: asText(getField(p.fields, FIELDS.playerStatus)),
        rating2k: coerceNum(getField(p.fields, FIELDS.player2K)),
        injuryNotes: asText(getField(p.fields, FIELDS.playerInjury)),
        returnDate: asText(getField(p.fields, FIELDS.playerReturnDate)),
        dob: asText(getField(p.fields, FIELDS.playerDob)),
        lastSeason: asText(getField(p.fields, FIELDS.playerLastSeason)),
        photo: photoUrl(getField(p.fields, FIELDS.playerPhoto)) || findAnyPhoto(p.fields),
        height: asText(getField(p.fields, FIELDS.playerHeight)),
        weight: asText(getField(p.fields, FIELDS.playerWeight)),
        age: asText(getField(p.fields, FIELDS.playerAge)),
        status: asText(getField(p.fields, FIELDS.playerStatus)),
        rating2k: coerceNum(getField(p.fields, FIELDS.player2K)),
        archetype: asText(getField(p.fields, FIELDS.playerArchetype)),
        role: asText(getField(p.fields, FIELDS.playerRole)),
        sort: coerceNum(getField(p.fields, FIELDS.playerSort)),
        draft: asText(getField(p.fields, FIELDS.playerDraft)).replace(/^\s*\d{4}\s*[:\u00b7\-]?\s*/, ""),
        draftYear: coerceNum(getField(p.fields, FIELDS.playerDraftYear)),
        draftTeam: asText(getField(p.fields, FIELDS.playerDraftTeam)),
        birthplace: asText(getField(p.fields, FIELDS.playerBirthplace)),
        college: asText(getField(p.fields, FIELDS.playerCollege)),
        draftRound: coerceNum(getField(p.fields, FIELDS.playerDraftRound)),
        draftPick: coerceNum(getField(p.fields, FIELDS.playerDraftPick)),
        stats: statsByPlayer[p.id] || [],
        awards: (() => { const v = getField(p.fields, FIELDS.playerAwards); return Array.isArray(v) ? v.filter((x) => typeof x === "string" && !isRecId(x)) : (v ? [String(v)] : []); })(),
        contracts: (contractsByPlayer[p.id] || []).sort(
          (a, b) => (b.signed || 0) - (a.signed || 0)
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ apiVersion: "v33.0", players: out, teams: teamsOut });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
