// Vercel serverless function: pulls the NBA injury report from TWO sources
// and writes it into the Airtable Players table.
//   - ESPN's JSON feed  (rich detail: "Right Ankle Sprain"; sleeps in the offseason)
//   - CBS Sports' injuries page (updates year-round; body part + return date)
// For each player the source with the NEWER update wins.
//
//   Status        -> "Active" | "Game Time Decision" | "IR"
//   Injury Notes  -> e.g. "Left Ankle Sprain (est. return Nov 12)"
//
// How a run works:
//   1. Fetch every player from Airtable + every injury from ESPN.
//   2. Match ESPN athletes to Airtable players by normalized name
//      (case, accents, punctuation and Jr./III suffixes ignored).
//   3. Players on the report -> Status + Injury Notes are set, and the
//      "Auto Injury" checkbox is ticked so we know the sync wrote it.
//      Players NOT on the report:
//        - if "Auto Injury" is ticked  -> back to Active, notes cleared
//        - if Status is blank          -> set to Active
//        - anything you typed by hand  -> LEFT ALONE (offseason injuries,
//          Two-Way, Suspended, etc.). The sync only clears its own work.
//      If the "Auto Injury" checkbox field doesn't exist in Airtable the
//      sync still adds injuries but never clears anything.
//   4. Only records that actually changed are written (batches of 10).
//
// Triggering:
//   - Vercel Cron (see vercel.json) sends  Authorization: Bearer <CRON_SECRET>
//   - Manually from a browser:  /api/sync-injuries?key=<CRON_SECRET>
//   - Dry run (shows the plan, writes nothing):  add  &dry=1
//
// Env vars: AIRTABLE_TOKEN (needs data.records:WRITE scope), AIRTABLE_BASE_ID,
//           CRON_SECRET (any long random string).
// Optional overrides: INJURY_STATUS_FIELD, INJURY_NOTES_FIELD

const ESPN_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries";
const CBS_URL = "https://www.cbssports.com/nba/injuries/";

// In the offseason CBS tags almost everyone who ended the year hurt as
// "Questionable for start of season" (Giannis, Bam, Tatum...). Flip to true
// if you want those shown as Game Time Decision too.
const INCLUDE_PRESEASON_QUESTIONABLE = false;

const TABLES = { players: "Players", teams: "Teams" };

// Candidate field names, matched fuzzily (same idea as contracts.js).
const CANDIDATES = {
  name: ["Name", "Player Name", "Full Name"],
  status: ["Status", "Player Status", "Availability"],
  injury: ["Injury Notes", "Injury Note", "Injury", "Injury Status", "Injury Report"],
  team: ["Team Name", "Team", "Current Team"],
  teamAbbr: ["TM", "Abbreviation", "Abbr", "Short Name", "Code"],
  teamName: ["Name", "Team Name", "Team"],
};

// Checkbox field in Players that marks "this injury was written by the sync".
const AUTO_FIELD = process.env.INJURY_AUTO_FIELD || "Auto Injury";

// The three values the sync manages.
const STATUS = { active: "Active", gtd: "Game Time Decision", ir: "IR" };

// Put "(est. return Nov 12)" at the end of the note when ESPN has a date.
const INCLUDE_RETURN_DATE = true;

// ESPN abbreviations that differ from the common ones. Only used to break
// ties when two players in your base share a name.
const ESPN_ABBR = { GS: "GSW", NY: "NYK", NO: "NOP", SA: "SAS", UTAH: "UTA", WSH: "WAS", PHO: "PHX" };

// ---------------------------------------------------------------- helpers

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const isRecId = (v) => typeof v === "string" && /^rec[a-zA-Z0-9]{14}$/.test(v);

// "Nikola Jokić" / "De'Aaron Fox" / "Jaren Jackson Jr." all normalize cleanly.
function normName(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Find the real field name used in this base for a list of candidates.
function detectField(records, candidates, fallback) {
  const keys = new Set();
  for (const r of records) for (const k of Object.keys(r.fields || {})) keys.add(k);
  for (const cand of candidates) {
    for (const k of keys) if (norm(k) === norm(cand)) return k;
  }
  return fallback;
}

function getField(fields, candidates) {
  for (const cand of candidates) {
    for (const k of Object.keys(fields)) if (norm(k) === norm(cand)) return fields[k];
  }
  return undefined;
}

function asText(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(", ");
  if (typeof v === "object") return v.name || v.text || "";
  return String(v);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function airtableFetchAll(base, table, token) {
  const out = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Airtable "${table}": ${res.status} ${await res.text()}`);
    const data = await res.json();
    out.push(...data.records);
    offset = data.offset;
  } while (offset);
  return out;
}

// Does a field exist? Asking for an unknown field name returns a 422.
async function fieldExists(base, table, token, field) {
  const url = new URL(`https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`);
  url.searchParams.append("fields[]", field);
  url.searchParams.set("maxRecords", "1");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.ok;
}

async function airtablePatch(base, table, token, records) {
  const url = `https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`;
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(url, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // typecast lets Airtable create the select options "Game Time Decision"
      // / "IR" the first time they're used.
      body: JSON.stringify({ records: batch, typecast: true }),
    });
    if (!res.ok) throw new Error(`Airtable write failed: ${res.status} ${await res.text()}`);
    if (i + 10 < records.length) await sleep(250); // stay under 5 req/sec
  }
}

// ------------------------------------------------------------ ESPN parsing

// ESPN groups by team: { injuries: [ { team, injuries: [athleteEntry,...] } ] }
// but be tolerant of a flat list too.
function flattenEspn(json) {
  const out = [];
  const walk = (item, team) => {
    if (!item || typeof item !== "object") return;
    if (item.athlete) {
      out.push({ ...item, teamAbbr: item.athlete?.team?.abbreviation || team?.abbreviation || "" });
      return;
    }
    if (Array.isArray(item.injuries)) for (const x of item.injuries) walk(x, item.team || team);
  };
  for (const item of json.injuries || []) walk(item, item.team);
  return out;
}

function mapStatus(entry) {
  const s = norm(entry.status);                       // "out", "daytoday", "questionable"...
  const t = norm(entry.type?.name);                   // "injurystatusout", ...
  if (s === "out" || t.endsWith("out")) return STATUS.ir;
  return STATUS.gtd;                                  // Day-To-Day, Questionable, Doubtful, Probable
}

function fmtDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1];
  return `${mon} ${d}`;
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// "Left Ankle Sprain", "Hamstring Strain", "Abdomen Surgery", "Illness"
function buildNote(entry) {
  const d = entry.details || {};
  const clean = (v) => (v && !/not specified|unknown|n\/a|^none$/i.test(v) ? String(v).trim() : "");
  let parts = [clean(d.side), clean(d.type), clean(d.detail)].filter(Boolean);
  parts = parts.filter((p, i) => parts.findIndex((q) => q.toLowerCase() === p.toLowerCase()) === i);
  let note = parts.join(" ");
  if (!note) {
    // Fall back to the "(ankle)" style tag in the headline, else the headline.
    const m = /\(([^)]+)\)/.exec(entry.shortComment || "");
    note = m ? cap(m[1]) : String(entry.shortComment || "").slice(0, 80);
  }
  if (INCLUDE_RETURN_DATE && d.returnDate) {
    const f = fmtDate(d.returnDate);
    if (f) note += ` (est. return ${f})`;
  }
  return note;
}

// ------------------------------------------------------------- CBS parsing

const stripTags = (h) => String(h).replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// "Mon, Aug 24" -> ISO date, assuming the most recent past occurrence.
function cbsDate(txt) {
  const m = /([A-Z][a-z]{2})\.? (\d{1,2})/.exec(txt || "");
  if (!m) return "";
  const mon = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(m[1].toLowerCase());
  if (mon < 0) return "";
  const now = new Date();
  let d = new Date(Date.UTC(now.getUTCFullYear(), mon, Number(m[2])));
  if (d.getTime() > now.getTime() + 86400e3) d = new Date(Date.UTC(now.getUTCFullYear() - 1, mon, Number(m[2])));
  return d.toISOString();
}

// "Expected to be out until at least Mar 1" -> "Mar 1" (next occurrence)
function cbsReturn(status) {
  const m = /until at least ([A-Z][a-z]{2})\.? (\d{1,2})/.exec(status || "");
  return m ? `${m[1]} ${m[2]}` : "";
}

// Walks the CBS HTML in order: remembers the last team header seen, then
// turns every table row that links to a player page into an entry.
function parseCbs(html) {
  const out = [];
  let team = "";
  const re = /\/nba\/teams\/([A-Z]{2,4})\/[a-z0-9-]+\/|<tr[\s\S]*?<\/tr>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) { team = m[1]; continue; }
    const row = m[0];
    const links = [...row.matchAll(/href="[^"]*\/nba\/players\/\d+\/([a-z0-9-]+)\/?"[^>]*>([^<]*)</g)];
    if (!links.length) continue;
    const slug = links[0][1];
    const name = links.map((l) => stripTags(l[2])).sort((a, b) => b.length - a.length)[0] || slug.replace(/-/g, " ");
    const cells = [...row.matchAll(/<td[\s\S]*?<\/td>/g)].map((c) => stripTags(c[0]));
    if (cells.length < 4) continue;
    const [pos, updated, injury, status] = cells.slice(-4);
    out.push({ source: "cbs", name, slug, teamAbbr: team, pos, updated: cbsDate(updated), injury, status });
  }
  return out;
}

// Turn a CBS row into the same shape the ESPN path produces.
function cbsToTarget(e) {
  const st = (e.status || "").toLowerCase();
  const preseasonQ = /questionable for (the )?start of (the )?season/.test(st);
  if (preseasonQ && !INCLUDE_PRESEASON_QUESTIONABLE) return null;
  const status = /\bout\b/.test(st) ? STATUS.ir : STATUS.gtd;
  let note = cap((e.injury || "").trim());
  if (/undisclosed|rest|not injury related/i.test(note)) note = e.status;
  else if (preseasonQ) note += " (questionable for season start)";
  const ret = cbsReturn(e.status);
  if (INCLUDE_RETURN_DATE && ret) note += ` (est. return ${ret})`;
  return { status, note, espnName: e.name, date: e.updated || "", source: "cbs" };
}

// ---------------------------------------------------------------- handler

export default async function handler(req, res) {
  try {
    const token = process.env.AIRTABLE_TOKEN;
    const base = process.env.AIRTABLE_BASE_ID;
    const secret = process.env.CRON_SECRET;
    if (!token || !base) return res.status(500).json({ error: "Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID" });

    // Auth: Vercel Cron sends the bearer header automatically; humans use ?key=
    const auth = req.headers.authorization || "";
    const key = req.query?.key;
    if (secret && auth !== `Bearer ${secret}` && key !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const dry = String(req.query?.dry || "") === "1";

    // 1. Load everything.
    const UA = "Mozilla/5.0 (compatible; nba-database-sync/1.0)";
    const [players, espnRes, cbsRes] = await Promise.all([
      airtableFetchAll(base, TABLES.players, token),
      fetch(ESPN_URL, { headers: { "User-Agent": UA } }).catch(() => null),
      fetch(CBS_URL, { headers: { "User-Agent": UA, Accept: "text/html" } }).catch(() => null),
    ]);
    let espn = [], espnTimestamp = null, espnError = null;
    if (espnRes && espnRes.ok) {
      const espnJson = await espnRes.json();
      espn = flattenEspn(espnJson);
      espnTimestamp = espnJson.timestamp || null;
    } else espnError = `ESPN ${espnRes ? espnRes.status : "unreachable"}`;
    let cbs = [], cbsError = null;
    if (cbsRes && cbsRes.ok) cbs = parseCbs(await cbsRes.text());
    else cbsError = `CBS ${cbsRes ? cbsRes.status : "unreachable"}`;
    if (!espn.length && !cbs.length) throw new Error(`No injury data: ${espnError || ""} ${cbsError || ""}`.trim());

    // Optional Teams table -> lets us break name ties by team.
    const teamAbbrById = {};
    try {
      for (const t of await airtableFetchAll(base, TABLES.teams, token)) {
        teamAbbrById[t.id] = norm(asText(getField(t.fields, CANDIDATES.teamAbbr)) || asText(getField(t.fields, CANDIDATES.teamName)));
      }
    } catch { /* no Teams table - fine */ }

    const hasAuto = await fieldExists(base, TABLES.players, token, AUTO_FIELD);

    const nameField = detectField(players, CANDIDATES.name, "Name");
    const statusField = process.env.INJURY_STATUS_FIELD || detectField(players, CANDIDATES.status, "Status");
    const notesField = process.env.INJURY_NOTES_FIELD || detectField(players, CANDIDATES.injury, "Injury Notes");

    // 2. Index Airtable players by normalized name.
    const byName = new Map();
    for (const p of players) {
      const n = normName(p.fields[nameField]);
      if (!n) continue;
      (byName.get(n) || byName.set(n, []).get(n)).push(p);
    }
    const teamOf = (p) => {
      const v = getField(p.fields, CANDIDATES.team);
      const id = Array.isArray(v) ? v[0] : v;
      return isRecId(id) ? teamAbbrById[id] || "" : norm(asText(v));
    };

    // 3. Decide the target state for every player.
    const target = new Map(); // recordId -> { status, note, espnName, date, source }
    const unmatched = [];
    const findRecord = (name, teamAbbr, altKey) => {
      let matches = byName.get(normName(name)) || [];
      if (!matches.length && altKey) matches = byName.get(normName(altKey)) || [];
      if (matches.length > 1) {
        const abbr = norm(ESPN_ABBR[teamAbbr] || teamAbbr);
        const narrowed = matches.filter((p) => teamOf(p) === abbr);
        if (narrowed.length) matches = narrowed;
      }
      return matches[0] || null;
    };
    // Newer update wins; on a tie ESPN wins (its notes are more detailed).
    const consider = (rec, next) => {
      const prev = target.get(rec.id);
      if (!prev) return target.set(rec.id, next);
      if (next.date > prev.date) return target.set(rec.id, next);
      if (next.date === prev.date && next.source === "espn" && prev.source !== "espn") target.set(rec.id, next);
    };

    for (const e of espn) {
      const espnName = e.athlete?.displayName || `${e.athlete?.firstName || ""} ${e.athlete?.lastName || ""}`;
      const rec = findRecord(espnName, e.teamAbbr);
      if (!rec) { unmatched.push(`${espnName} (${e.teamAbbr}, ESPN)`); continue; }
      consider(rec, { status: mapStatus(e), note: buildNote(e), espnName, date: e.date || "", source: "espn" });
    }
    for (const e of cbs) {
      const t = cbsToTarget(e);
      if (!t) continue;
      const rec = findRecord(e.name, e.teamAbbr, e.slug.replace(/-/g, " "));
      if (!rec) { unmatched.push(`${e.name} (${e.teamAbbr}, CBS)`); continue; }
      consider(rec, t);
    }

    // 4. Build the update list (only real changes).
    const updates = [];
    const plan = [];
    for (const p of players) {
      const curStatus = asText(p.fields[statusField]);
      const curNote = asText(p.fields[notesField]).trim();
      const curAuto = hasAuto ? p.fields[AUTO_FIELD] === true : false;
      const t = target.get(p.id);
      let nextStatus = curStatus, nextNote = curNote, nextAuto = curAuto;

      if (t) {
        // On ESPN's report: ESPN wins.
        nextStatus = t.status;
        nextNote = t.note;
        nextAuto = true;
      } else if (curAuto) {
        // The sync put this injury there and ESPN no longer lists it: clear it.
        nextStatus = STATUS.active;
        nextNote = "";
        nextAuto = false;
      } else if (!curStatus.trim()) {
        // Never touched: default to Active. Leave any hand-typed note alone.
        nextStatus = STATUS.active;
      }
      // else: a status/note you set by hand -> untouched.

      const fields = {};
      if (norm(nextStatus) !== norm(curStatus)) fields[statusField] = nextStatus;
      if (nextNote !== curNote) fields[notesField] = nextNote;
      if (hasAuto && nextAuto !== curAuto) fields[AUTO_FIELD] = nextAuto;
      if (Object.keys(fields).length) {
        updates.push({ id: p.id, fields });
        plan.push(`${asText(p.fields[nameField])}: ${curStatus || "(blank)"} -> ${nextStatus}${nextNote ? " | " + nextNote : ""}`);
      }
    }

    // 5. Write.
    if (!dry && updates.length) await airtablePatch(base, TABLES.players, token, updates);

    return res.status(200).json({
      ok: true,
      dryRun: dry,
      espnEntries: espn.length,
      cbsEntries: cbs.length,
      cbsFeedError: cbsError,
      espnFeedError: espnError,
      matched: target.size,
      changed: updates.length,
      fields: { name: nameField, status: statusField, notes: notesField, auto: hasAuto ? AUTO_FIELD : `MISSING - add a checkbox field named "${AUTO_FIELD}" so the sync can clear healed players` },
      espnFeedUpdated: espnTimestamp,
      changes: plan,
      unmatchedEspnPlayers: unmatched,
      ranAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
