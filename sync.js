// ═══════════════════════════════════════════════════════════════
//  WM 2026 Auto-Sync + Backup
//  Holt Ergebnisse von der Sportschau-API → schreibt in Google Sheets
//  Erstellt regelmäßige Backups der Tipps
//  Läuft alle 5 Minuten via GitHub Actions
// ═══════════════════════════════════════════════════════════════

const GAS_URL = process.env.GAS_URL;
const fs      = require("fs");
const path    = require("path");

// ─── Spielplan: Paarung → unsere App-ID ──────────────────────
// Schlüssel: "Heim|Ausw" (normalisiert)
const GAME_MAP = {
  "mexiko|südafrika": 1,       "südkorea|tschechien": 2,
  "tschechien|südafrika": 3,   "mexiko|südkorea": 4,
  "tschechien|mexiko": 5,      "südafrika|südkorea": 6,
  "kanada|bosnien-herzegowina": 7, "katar|schweiz": 8,
  "schweiz|bosnien-herzegowina": 9, "kanada|katar": 10,
  "schweiz|kanada": 11,        "bosnien-herzegowina|katar": 12,
  "brasilien|marokko": 13,     "haiti|schottland": 14,
  "schottland|marokko": 15,    "brasilien|haiti": 16,
  "schottland|brasilien": 17,  "marokko|haiti": 18,
  "usa|paraguay": 19,          "australien|türkei": 20,
  "usa|australien": 21,        "türkei|paraguay": 22,
  "türkei|usa": 23,            "paraguay|australien": 24,
  "deutschland|curaçao": 25,   "elfenbeinküste|ecuador": 26,
  "deutschland|elfenbeinküste": 27, "ecuador|curaçao": 28,
  "ecuador|deutschland": 29,   "curaçao|elfenbeinküste": 30,
  "niederlande|japan": 31,     "schweden|tunesien": 32,
  "niederlande|schweden": 33,  "tunesien|japan": 34,
  "tunesien|niederlande": 35,  "japan|schweden": 36,
  "belgien|ägypten": 37,       "iran|neuseeland": 38,
  "belgien|iran": 39,          "neuseeland|ägypten": 40,
  "ägypten|iran": 41,          "neuseeland|belgien": 42,
  "spanien|kap verde": 43,     "saudi-arabien|uruguay": 44,
  "spanien|saudi-arabien": 45, "uruguay|kap verde": 46,
  "kap verde|saudi-arabien": 47, "uruguay|spanien": 48,
  "frankreich|senegal": 49,    "irak|norwegen": 50,
  "frankreich|irak": 51,       "norwegen|senegal": 52,
  "norwegen|frankreich": 53,   "senegal|irak": 54,
  "argentinien|algerien": 55,  "österreich|jordanien": 56,
  "argentinien|österreich": 57, "jordanien|algerien": 58,
  "jordanien|argentinien": 59, "algerien|österreich": 60,
  "portugal|dr kongo": 61,     "usbekistan|kolumbien": 62,
  "portugal|usbekistan": 63,   "kolumbien|dr kongo": 64,
  "kolumbien|portugal": 65,    "dr kongo|usbekistan": 66,
  "england|kroatien": 67,      "ghana|panama": 68,
  "england|ghana": 69,         "panama|kroatien": 70,
  "panama|england": 71,        "kroatien|ghana": 72,
};

// Name-Normalisierung: Sportschau → unsere Namen
const NAME_MAP = {
  "mexiko": "mexiko", "mexico": "mexiko",
  "südafrika": "südafrika", "south africa": "südafrika",
  "südkorea": "südkorea", "korea republik": "südkorea", "south korea": "südkorea",
  "tschechien": "tschechien", "czech republic": "tschechien", "czechia": "tschechien",
  "kanada": "kanada", "canada": "kanada",
  "bosnien-herzegowina": "bosnien-herzegowina", "bosnien": "bosnien-herzegowina",
  "katar": "katar", "qatar": "katar",
  "schweiz": "schweiz", "switzerland": "schweiz",
  "brasilien": "brasilien", "brazil": "brasilien",
  "marokko": "marokko", "morocco": "marokko",
  "haiti": "haiti",
  "schottland": "schottland", "scotland": "schottland",
  "usa": "usa", "vereinigte staaten": "usa",
  "paraguay": "paraguay",
  "australien": "australien", "australia": "australien",
  "türkei": "türkei", "turkey": "türkei", "türkiye": "türkei",
  "deutschland": "deutschland", "germany": "deutschland",
  "curaçao": "curaçao", "curacao": "curaçao",
  "elfenbeinküste": "elfenbeinküste", "ivory coast": "elfenbeinküste", "côte d'ivoire": "elfenbeinküste",
  "ecuador": "ecuador",
  "niederlande": "niederlande", "netherlands": "niederlande",
  "japan": "japan",
  "schweden": "schweden", "sweden": "schweden",
  "tunesien": "tunesien", "tunisia": "tunesien",
  "belgien": "belgien", "belgium": "belgien",
  "ägypten": "ägypten", "egypt": "ägypten",
  "iran": "iran",
  "neuseeland": "neuseeland", "new zealand": "neuseeland",
  "spanien": "spanien", "spain": "spanien",
  "kap verde": "kap verde", "cape verde": "kap verde",
  "saudi-arabien": "saudi-arabien", "saudi arabia": "saudi-arabien",
  "uruguay": "uruguay",
  "frankreich": "frankreich", "france": "frankreich",
  "senegal": "senegal",
  "irak": "irak", "iraq": "irak",
  "norwegen": "norwegen", "norway": "norwegen",
  "argentinien": "argentinien", "argentina": "argentinien",
  "algerien": "algerien", "algeria": "algerien",
  "österreich": "österreich", "austria": "österreich",
  "jordanien": "jordanien", "jordan": "jordanien",
  "portugal": "portugal",
  "dr kongo": "dr kongo", "demokratische republik kongo": "dr kongo", "dr congo": "dr kongo",
  "usbekistan": "usbekistan", "uzbekistan": "usbekistan",
  "kolumbien": "kolumbien", "colombia": "kolumbien",
  "england": "england",
  "kroatien": "kroatien", "croatia": "kroatien",
  "ghana": "ghana",
  "panama": "panama",
};

function normalizeName(name) {
  const n = name.toLowerCase().trim();
  return NAME_MAP[n] || n;
}

function findGameId(home, away) {
  const h = normalizeName(home);
  const a = normalizeName(away);
  const key = `${h}|${a}`;
  return GAME_MAP[key] || null;
}

// ─── Google Sheets Helpers ────────────────────────────────────
async function gasGet(key) {
  const r = await fetch(`${GAS_URL}?key=${key}`, { redirect: "follow" });
  if (!r.ok) throw new Error(`GAS read error: ${r.status}`);
  return r.json();
}

async function gasSet(key, value) {
  const params = encodeURIComponent(JSON.stringify({ key, value }));
  const r = await fetch(`${GAS_URL}?action=set&data=${params}`, { redirect: "follow" });
  if (!r.ok) throw new Error(`GAS write error: ${r.status}`);
  return r.json();
}

// ─── Sportschau API ───────────────────────────────────────────
async function fetchSportschauResults() {
  // Sportschau benutzt eine interne API für WM-Ergebnisse
  const urls = [
    "https://www.sportschau.de/live-und-ergebnisse/fussball/fifa-wm/ergebnisse-und-tabelle.json",
    "https://www.sportschau.de/sport/fussball/fifa-wm/data/matches.json",
    "https://ticker-data.sportschau.de/data/fifa-wm-2026/matches.json",
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
        }
      });
      console.log(`Sportschau ${url}: ${r.status}`);
      if (!r.ok) continue;
      const data = await r.json();
      if (data) return data;
    } catch (e) {
      console.log(`Sportschau ${url}: Fehler - ${e.message}`);
    }
  }
  return null;
}

// ─── OpenLigaDB (kostenlos, kein Key nötig) ───────────────────
async function fetchOpenLigaResults() {
  // OpenLigaDB hat WM-2026-Daten
  const urls = [
    "https://api.openligadb.de/getmatchdata/fifawc26/2026",
    "https://api.openligadb.de/getmatchdata/wm2026",
    "https://api.openligadb.de/getmatchdata/wm26",
  ];

  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { "Accept": "application/json" } });
      console.log(`OpenLigaDB ${url}: ${r.status}`);
      if (!r.ok) continue;
      const data = await r.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log(`✅ OpenLigaDB: ${data.length} Spiele gefunden`);
        return { source: "openligadb", matches: data };
      }
    } catch (e) {
      console.log(`OpenLigaDB ${url}: Fehler - ${e.message}`);
    }
  }
  return null;
}

// ─── API-Football (kostenloser Tier) ──────────────────────────
async function fetchApiFootball() {
  // Versuche ohne Key (public endpoint)
  const url = "https://v3.football.api-sports.io/fixtures?league=1&season=2026&status=FT";
  try {
    const r = await fetch(url, {
      headers: { "x-rapidapi-host": "v3.football.api-sports.io" }
    });
    console.log(`API-Football: ${r.status}`);
    if (!r.ok) return null;
    const data = await r.json();
    return data;
  } catch (e) {
    console.log(`API-Football Fehler: ${e.message}`);
    return null;
  }
}

// ─── Ergebnisse verarbeiten ───────────────────────────────────
function processOpenLigaMatches(matches, currentResults) {
  const updated = { ...currentResults };
  let changes = 0;

  for (const match of matches) {
    // OpenLigaDB Format
    if (match.matchIsFinished !== true) continue;

    const home = match.team1?.teamName || match.team1?.shortName || "";
    const away = match.team2?.teamName || match.team2?.shortName || "";

    // Endergebnis aus matchResults
    const finalResult = match.matchResults?.find(r =>
      r.resultTypeID === 2 || r.resultName === "Endergebnis"
    );
    if (!finalResult) continue;

    const rh = finalResult.pointsTeam1;
    const ra = finalResult.pointsTeam2;
    if (rh === undefined || ra === undefined) continue;

    const gameId = findGameId(home, away);
    if (!gameId) {
      console.log(`⚠️  Kein Match für: ${home} vs ${away}`);
      continue;
    }

    const key = String(gameId);
    if (!updated[key] ||
        String(updated[key].h) !== String(rh) ||
        String(updated[key].a) !== String(ra)) {
      updated[key] = { h: String(rh), a: String(ra) };
      changes++;
      console.log(`✅ Spiel ${gameId}: ${home} ${rh}:${ra} ${away}`);
    }
  }

  return { updated, changes };
}

// ─── Backup erstellen ─────────────────────────────────────────
async function createBackup() {
  console.log("📦 Erstelle Backup...");
  const backupDir = "backups";
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

  const [tips, results, koTeams] = await Promise.all([
    gasGet("tips").catch(() => ({})),
    gasGet("results").catch(() => ({})),
    gasGet("koTeams").catch(() => ({})),
  ]);

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const backup = { erstellt: now.toISOString(), tips, results, koTeams };

  fs.writeFileSync(
    path.join(backupDir, `backup-${dateStr}.json`),
    JSON.stringify(backup, null, 2)
  );
  fs.writeFileSync(
    path.join(backupDir, "backup-latest.json"),
    JSON.stringify(backup, null, 2)
  );

  const participants = Object.keys(tips || {});
  for (const p of participants) {
    const count = Object.keys(tips[p] || {}).length;
    console.log(`   ${p}: ${count} Tipps`);
  }
  console.log(`   Ergebnisse gespeichert: ${Object.keys(results || {}).length}`);

  // Alte Backups aufräumen
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith("backup-20") && f.endsWith(".json"))
    .sort();
  if (files.length > 10) {
    for (const f of files.slice(0, files.length - 10)) {
      fs.unlinkSync(path.join(backupDir, f));
      console.log(`🗑️  Gelöscht: ${f}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("🚀 WM 2026 Sync gestartet:", new Date().toISOString());
  if (!GAS_URL) throw new Error("GAS_URL fehlt");

  // 1. Backup
  await createBackup();

  // 2. Ergebnisse holen — OpenLigaDB zuerst (kostenlos, kein Key)
  console.log("\n⚽ Hole Ergebnisse...");
  const currentResults = await gasGet("results").catch(() => ({})) || {};

  let result = await fetchOpenLigaResults();

  if (result?.source === "openligadb") {
    const { updated, changes } = processOpenLigaMatches(result.matches, currentResults);
    if (changes > 0) {
      await gasSet("results", updated);
      console.log(`💾 ${changes} Ergebnis(se) in Google Sheets gespeichert`);
    } else {
      console.log("✓ Keine neuen Ergebnisse");
    }
  } else {
    console.log("⚠️  Keine Ergebnisquelle verfügbar — bitte manuell eintragen");
  }

  console.log("\n✅ Fertig:", new Date().toISOString());
}

main().catch(err => {
  console.error("❌ Fehler:", err.message);
  process.exit(1);
});
