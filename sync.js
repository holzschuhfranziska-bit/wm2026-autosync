// ═══════════════════════════════════════════════════════════════
//  WM 2026 Auto-Sync + Backup
//  1. Holt Ergebnisse von football-data.org → schreibt in Google Sheets
//  2. Erstellt regelmäßige Backups der Tipps als JSON-Datei im Repo
//  Läuft alle 5 Minuten via GitHub Actions
// ═══════════════════════════════════════════════════════════════

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
const GAS_URL          = process.env.GAS_URL;
const fs               = require("fs");
const path             = require("path");

// ─── Team-Mapping ─────────────────────────────────────────────
const TEAM_MAP = {
  "Mexico":"Mexiko","South Africa":"Südafrika","Korea Republic":"Südkorea",
  "Czechia":"Tschechien","Czech Republic":"Tschechien",
  "Canada":"Kanada","Bosnia and Herzegovina":"Bosnien-Herzegowina",
  "Qatar":"Katar","Switzerland":"Schweiz",
  "Brazil":"Brasilien","Morocco":"Marokko","Haiti":"Haiti","Scotland":"Schottland",
  "USA":"USA","United States":"USA","Paraguay":"Paraguay",
  "Australia":"Australien","Turkey":"Türkei","Türkiye":"Türkei",
  "Germany":"Deutschland","Curaçao":"Curaçao","Curacao":"Curaçao",
  "Ivory Coast":"Elfenbeinküste","Côte d'Ivoire":"Elfenbeinküste","Ecuador":"Ecuador",
  "Netherlands":"Niederlande","Japan":"Japan","Sweden":"Schweden","Tunisia":"Tunesien",
  "Belgium":"Belgien","Egypt":"Ägypten","Iran":"Iran","New Zealand":"Neuseeland",
  "Spain":"Spanien","Cape Verde":"Kap Verde","Saudi Arabia":"Saudi-Arabien","Uruguay":"Uruguay",
  "France":"Frankreich","Senegal":"Senegal","Iraq":"Irak","Norway":"Norwegen",
  "Argentina":"Argentinien","Algeria":"Algerien","Austria":"Österreich","Jordan":"Jordanien",
  "Portugal":"Portugal","DR Congo":"DR Kongo","Congo DR":"DR Kongo","Uzbekistan":"Usbekistan",
  "Colombia":"Kolumbien","England":"England","Croatia":"Kroatien","Ghana":"Ghana","Panama":"Panama",
};

const OUR_GAMES = [
  {id:1,h:"Mexiko",a:"Südafrika"},{id:2,h:"Südkorea",a:"Tschechien"},
  {id:3,h:"Tschechien",a:"Südafrika"},{id:4,h:"Mexiko",a:"Südkorea"},
  {id:5,h:"Tschechien",a:"Mexiko"},{id:6,h:"Südafrika",a:"Südkorea"},
  {id:7,h:"Kanada",a:"Bosnien-Herzegowina"},{id:8,h:"Katar",a:"Schweiz"},
  {id:9,h:"Schweiz",a:"Bosnien-Herzegowina"},{id:10,h:"Kanada",a:"Katar"},
  {id:11,h:"Schweiz",a:"Kanada"},{id:12,h:"Bosnien-Herzegowina",a:"Katar"},
  {id:13,h:"Brasilien",a:"Marokko"},{id:14,h:"Haiti",a:"Schottland"},
  {id:15,h:"Schottland",a:"Marokko"},{id:16,h:"Brasilien",a:"Haiti"},
  {id:17,h:"Schottland",a:"Brasilien"},{id:18,h:"Marokko",a:"Haiti"},
  {id:19,h:"USA",a:"Paraguay"},{id:20,h:"Australien",a:"Türkei"},
  {id:21,h:"USA",a:"Australien"},{id:22,h:"Türkei",a:"Paraguay"},
  {id:23,h:"Türkei",a:"USA"},{id:24,h:"Paraguay",a:"Australien"},
  {id:25,h:"Deutschland",a:"Curaçao"},{id:26,h:"Elfenbeinküste",a:"Ecuador"},
  {id:27,h:"Deutschland",a:"Elfenbeinküste"},{id:28,h:"Ecuador",a:"Curaçao"},
  {id:29,h:"Ecuador",a:"Deutschland"},{id:30,h:"Curaçao",a:"Elfenbeinküste"},
  {id:31,h:"Niederlande",a:"Japan"},{id:32,h:"Schweden",a:"Tunesien"},
  {id:33,h:"Niederlande",a:"Schweden"},{id:34,h:"Tunesien",a:"Japan"},
  {id:35,h:"Tunesien",a:"Niederlande"},{id:36,h:"Japan",a:"Schweden"},
  {id:37,h:"Belgien",a:"Ägypten"},{id:38,h:"Iran",a:"Neuseeland"},
  {id:39,h:"Belgien",a:"Iran"},{id:40,h:"Neuseeland",a:"Ägypten"},
  {id:41,h:"Ägypten",a:"Iran"},{id:42,h:"Neuseeland",a:"Belgien"},
  {id:43,h:"Spanien",a:"Kap Verde"},{id:44,h:"Saudi-Arabien",a:"Uruguay"},
  {id:45,h:"Spanien",a:"Saudi-Arabien"},{id:46,h:"Uruguay",a:"Kap Verde"},
  {id:47,h:"Kap Verde",a:"Saudi-Arabien"},{id:48,h:"Uruguay",a:"Spanien"},
  {id:49,h:"Frankreich",a:"Senegal"},{id:50,h:"Irak",a:"Norwegen"},
  {id:51,h:"Frankreich",a:"Irak"},{id:52,h:"Norwegen",a:"Senegal"},
  {id:53,h:"Norwegen",a:"Frankreich"},{id:54,h:"Senegal",a:"Irak"},
  {id:55,h:"Argentinien",a:"Algerien"},{id:56,h:"Österreich",a:"Jordanien"},
  {id:57,h:"Argentinien",a:"Österreich"},{id:58,h:"Jordanien",a:"Algerien"},
  {id:59,h:"Jordanien",a:"Argentinien"},{id:60,h:"Algerien",a:"Österreich"},
  {id:61,h:"Portugal",a:"DR Kongo"},{id:62,h:"Usbekistan",a:"Kolumbien"},
  {id:63,h:"Portugal",a:"Usbekistan"},{id:64,h:"Kolumbien",a:"DR Kongo"},
  {id:65,h:"Kolumbien",a:"Portugal"},{id:66,h:"DR Kongo",a:"Usbekistan"},
  {id:67,h:"England",a:"Kroatien"},{id:68,h:"Ghana",a:"Panama"},
  {id:69,h:"England",a:"Ghana"},{id:70,h:"Panama",a:"Kroatien"},
  {id:71,h:"Panama",a:"England"},{id:72,h:"Kroatien",a:"Ghana"},
];

// ─── Helpers ──────────────────────────────────────────────────
function mapTeam(name) { return TEAM_MAP[name] || name; }

function findGame(home, away) {
  const h = mapTeam(home), a = mapTeam(away);
  return OUR_GAMES.find(g => g.h === h && g.a === a);
}

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

// ─── Backup ───────────────────────────────────────────────────
async function createBackup() {
  console.log("📦 Erstelle Backup...");

  const backupDir = path.join("backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

  // Alle Daten aus Google Sheets lesen
  const [tips, results, koTeams] = await Promise.all([
    gasGet("tips").catch(() => ({})),
    gasGet("results").catch(() => ({})),
    gasGet("koTeams").catch(() => ({})),
  ]);

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dateStr = now.toISOString().slice(0, 10);

  const backup = {
    erstellt: now.toISOString(),
    tips,
    results,
    koTeams,
  };

  // Tagesaktuelles Backup (wird täglich überschrieben)
  const dailyPath = path.join(backupDir, `backup-${dateStr}.json`);
  fs.writeFileSync(dailyPath, JSON.stringify(backup, null, 2), "utf8");
  console.log(`✅ Tages-Backup: ${dailyPath}`);

  // Letztes Backup immer aktuell halten
  const latestPath = path.join(backupDir, "backup-latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(backup, null, 2), "utf8");
  console.log(`✅ Letztes Backup: ${latestPath}`);

  // Statistik ausgeben
  const participants = Object.keys(tips || {});
  console.log(`📊 Backup-Inhalt:`);
  for (const p of participants) {
    const count = Object.keys(tips[p] || {}).length;
    console.log(`   ${p}: ${count} Tipps`);
  }
  console.log(`   Ergebnisse: ${Object.keys(results || {}).length}`);

  // Alte Backups aufräumen — nur die letzten 10 Tages-Backups behalten
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith("backup-20") && f.endsWith(".json"))
    .sort();
  if (files.length > 10) {
    const toDelete = files.slice(0, files.length - 10);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(backupDir, f));
      console.log(`🗑️  Altes Backup gelöscht: ${f}`);
    }
  }
}

// ─── Fußballergebnisse synchronisieren ────────────────────────
async function syncResults() {
  console.log("⚽ Synchronisiere Ergebnisse...");

  const currentResults = await gasGet("results").catch(() => ({})) || {};
  const url = "https://api.football-data.org/v4/competitions/WC/matches?season=2026";
  const r = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_API_KEY } });
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  const data = await r.json();
  const matches = data.matches || [];
  console.log(`📊 ${matches.length} Spiele von der API erhalten`);

  let updated = { ...currentResults };
  let changes = 0;

  for (const match of matches) {
    if (match.status !== "FINISHED") continue;
    const home = match.homeTeam?.name || "";
    const away = match.awayTeam?.name || "";
    const rh = match.score?.fullTime?.home;
    const ra = match.score?.fullTime?.away;
    if (rh === null || rh === undefined) continue;

    const game = findGame(home, away);
    if (!game) continue;

    const key = String(game.id);
    if (!updated[key] || String(updated[key].h) !== String(rh) || String(updated[key].a) !== String(ra)) {
      updated[key] = { h: String(rh), a: String(ra) };
      changes++;
      console.log(`✅ Spiel ${game.id}: ${game.h} ${rh}:${ra} ${game.a}`);
    }
  }

  if (changes > 0) {
    await gasSet("results", updated);
    console.log(`💾 ${changes} Ergebnis(se) gespeichert`);
  } else {
    console.log("✓ Keine neuen Ergebnisse");
  }
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("🚀 WM 2026 Sync gestartet:", new Date().toISOString());

  if (!GAS_URL) throw new Error("GAS_URL fehlt");

  // Backup immer erstellen
  await createBackup();

  // Ergebnisse nur wenn API-Key vorhanden
  if (FOOTBALL_API_KEY) {
    await syncResults();
  } else {
    console.log("ℹ️  FOOTBALL_API_KEY nicht gesetzt — nur Backup");
  }

  console.log("✅ Fertig:", new Date().toISOString());
}

main().catch(err => {
  console.error("❌ Fehler:", err.message);
  process.exit(1);
});
