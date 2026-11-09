// Vercel serverless function: syncs NBA 2K overalls into the Airtable
// "2K Rating" field. Runs weekly via vercel.json cron (2K pushes rating
// updates roughly every couple of weeks in season).
//
// Source: nba2kapi.com — a free, maintained mirror of 2kratings.com with a
// one-call bulk export. It needs a free API key:
//   1. Sign up at https://nba2kapi.com (free), copy the key
//   2. Vercel → your project → Settings → Environment Variables →
//      add NBA2K_API_KEY = <the key>, then redeploy
// Airtable env vars are the same ones /api/contracts already uses.
// Test in a browser:  https://<your-app>.vercel.app/api/sync-ratings
//
// Safety: if the feed comes back short or reshaped, this fails loudly and
// writes NOTHING rather than zeroing your ratings.

const CONFIG = {
  table: "Players",
  nameField: ["Name", "Player Name", "Full Name"],
  teamField: ["Team Name", "Team", "Current Team"],
  ratingField: ["2K Rating", "2K", "NBA 2K Rating", "2K26 Rating", "2K27 Rating", "2K Overall", "OVR", "Overall"],
  bulkUrl: "https://api.nba2kapi.com/api/players/bulk?teamType=curr",
  minPlayers: 300, // a real pull is ~500+; fewer means the feed shape changed
};

const NICKNAMES = { pat: "patrick", kenny: "kenneth", ken: "kenneth", mike: "michael", rob: "robert", bob: "robert", josh: "joshua", alex: "alexander", cam: "cameron", matt: "matthew", dan: "daniel", danny: "daniel", chris: "christopher", zach: "zachary", nick: "nicholas", jake: "jacob", will: "william", tony: "anthony", drew: "andrew", jeff: "jeffrey", greg: "gregory", sam: "samuel", ben: "benjamin", joe: "joseph", jim: "james", tom: "thomas", steve: "stephen", dave: "david", herb: "herbert", tre: "trey" };
const nrm = (x) => {
  const s = String(x || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'’`]/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "")
    .replace(/\s+/g, " ").trim().toLowerCase();
  const parts = s.split(" ");
  if (parts.length > 1 && NICKNAMES[parts[0]]) parts[0] = NICKNAMES[parts[0]];
  return parts.join(" ");
};

// 2K names teams in full ("New York Knicks"); Airtable may hold either the
// full name or an abbreviation. Compare on the nickname (last word).
const NICK_TO_ABBR = {
  hawks: "ATL", celtics: "BOS", nets: "BKN", hornets: "CHA", bulls: "CHI", cavaliers: "CLE",
  mavericks: "DAL", nuggets: "DEN", pistons: "DET", warriors: "GS", rockets: "HOU", pacers: "IND",
  clippers: "LAC", lakers: "LAL", grizzlies: "MEM", heat: "MIA", bucks: "MIL", timberwolves: "MIN",
  pelicans: "NOP", knicks: "NY", thunder: "OKC", magic: "ORL", "76ers": "PHI", suns: "PHX",
  "blazers": "POR", kings: "SAC", spurs: "SAS", raptors: "TOR", jazz: "UTAH", wizards: "WSH",
};
const ABBR_ALIASES = [["GS", "GSW"], ["NY", "NYK"], ["NOP", "NO"], ["SAS", "SA"], ["UTAH", "UTA"], ["WSH", "WAS"], ["PHX", "PHO"], ["BKN", "BRK"], ["CHA", "CHO"]];
function toAbbr(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/^[A-Z]{2,4}$/i.test(s)) return s.toUpperCase();
  return NICK_TO_ABBR[s.toLowerCase().split(" ").pop()] || null;
}
const teamEq = (a, b) => {
  const x = toAbbr(a), y = toAbbr(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return ABBR_ALIASES.some(([p, q]) => (x === p && y === q) || (x === q && y === p));
};

async function fetch2kRatings(apiKey) {
  const r = await fetch(CONFIG.bulkUrl, { headers: { accept: "application/json", "X-API-Key": apiKey } });
  if (!r.ok) throw new Error(`nba2kapi HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const items = Array.isArray(d.data) ? d.data : [];
  const players = items
    .map((it) => ({ name: it.name, ovr: it.overall, team: it.team }))
    .filter((p) => p.name && p.ovr != null && isFinite(Number(p.ovr)));
  if (players.length < CONFIG.minPlayers) {
    throw new Error(`nba2kapi returned only ${players.length} usable players — feed shape likely changed, nothing written`);
  }
  const byName = {};
  for (const p of players) (byName[nrm(p.name)] = byName[nrm(p.name)] || []).push(p);
  return byName;
}

// ── Airtable (same fuzzy field matching as /api/contracts) ──
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
function getField(fields, candidates) {
  const keys = Object.keys(fields);
  for (const cand of candidates) {
    for (const k of keys) if (norm(k) === norm(cand)) return { key: k, val: fields[k] };
  }
  return null;
}

async function listAllRecords(base, token) {
  const records = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${base}/${encodeURIComponent(CONFIG.table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Airtable list HTTP ${r.status}: ${await r.text()}`);
    const d = await r.json();
    records.push(...(d.records || []));
    offset = d.offset;
  } while (offset);
  return records;
}

async function patchBatch(base, token, updates) {
  for (let i = 0; i < updates.length; i += 10) {
    const r = await fetch(`https://api.airtable.com/v0/${base}/${encodeURIComponent(CONFIG.table)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: updates.slice(i, i + 10) }),
    });
    if (!r.ok) throw new Error(`Airtable PATCH HTTP ${r.status}: ${await r.text()}`);
    if (i + 10 < updates.length) await new Promise((res) => setTimeout(res, 250));
  }
}

export default async function handler(req, res) {
  try {
    const token = (process.env.AIRTABLE_TOKEN || "").trim();
    const base = (process.env.AIRTABLE_BASE_ID || "").trim();
    const apiKey = (process.env.NBA2K_API_KEY || "").trim();
    if (!token || !base) return res.status(500).json({ error: "Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID env var" });
    if (!apiKey) return res.status(500).json({ error: "Missing NBA2K_API_KEY env var — get a free key at nba2kapi.com and add it in Vercel → Settings → Environment Variables" });

    const [byName, records] = await Promise.all([fetch2kRatings(apiKey), listAllRecords(base, token)]);

    const updates = [], unmatched = [], ambiguous = [];
    let matched = 0, ratingKey = null;

    for (const rec of records) {
      const f = rec.fields || {};
      const nameF = getField(f, CONFIG.nameField);
      if (!nameF || !nameF.val) continue;
      const name = Array.isArray(nameF.val) ? nameF.val[0] : nameF.val;
      const teamF = getField(f, CONFIG.teamField);
      const team = teamF ? (Array.isArray(teamF.val) ? teamF.val[0] : teamF.val) : null;
      const ratingF = getField(f, CONFIG.ratingField);
      if (ratingF && !ratingKey) ratingKey = ratingF.key;

      const cands = byName[nrm(name)];
      if (!cands || !cands.length) { unmatched.push(name); continue; }
      let hit = cands[0];
      if (cands.length > 1) {
        hit = cands.find((c) => teamEq(c.team, team));
        if (!hit) { ambiguous.push(name); continue; } // duplicate name, no team match — never guess
      }
      matched++;

      const newOvr = Math.round(Number(hit.ovr));
      const oldOvr = ratingF && ratingF.val != null ? Math.round(Number(ratingF.val)) : null;
      if (newOvr !== oldOvr && ratingKey) updates.push({ id: rec.id, fields: { [ratingKey]: newOvr } });
    }

    if (!ratingKey) throw new Error(`No rating field found on Players — expected one of: ${CONFIG.ratingField.join(", ")}`);

    await patchBatch(base, token, updates);

    return res.status(200).json({
      ok: true,
      airtableRecords: records.length,
      matched,
      updated: updates.length,
      ratingField: ratingKey,
      unmatchedSample: unmatched.slice(0, 15),
      ambiguousSample: ambiguous.slice(0, 15),
      syncedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e.message || e) });
  }
}
