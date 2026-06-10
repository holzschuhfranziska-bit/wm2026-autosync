// ═══════════════════════════════════════════════════════════════
//  WM 2026 Auto-Sync
//  Holt Ergebnisse von football-data.org → schreibt in Google Sheets
//  Läuft alle 5 Minuten via GitHub Actions
// ═══════════════════════════════════════════════════════════════

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
const GAS_URL          = process.env.GAS_URL; // Google Apps Script URL

// Team-Name Mapping: football-data.org → App
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
  {id:39,h:"Belgien",a:"Iran"},{id:40,h:"Ägypten",a:"Neuseeland"},
  {id:41,h:"Ägypten",a:"Belgien"},{id:42,h:"Neuseeland",a:"Iran"},
  {id:43,h:"Spanien",a:"Uruguay"},{id:44,h:"Saudi-Arabien",a:"Kap Verde"},
  {id:45,h:"Spanien",a:"Saudi-Arabien"},{id:46,h:"Uruguay",a:"Kap Verde"},
  {id:47,h:"Saudi-Arabien",a:"Spanien"},{id:48,h:"Kap Verde",a:"Uruguay"},
  {id:49,h:"Frankreich",a:"Senegal"},{id:50,h:"Norwegen",a:"Irak"},
  {id:51,h:"Frankreich",a:"Norwegen"},{id:52,h:"Senegal",a:"Irak"},
  {id:53,h:"Irak",a:"Frankreich"},{id:54,h:"Norwegen",a:"Senegal"},
  {id:55,h:"Argentinien",a:"Algerien"},{id:56,h:"Österreich",a:"Jordanien"},
  {id:57,h:"Argentinien",a:"Österreich"},{id:58,h:"Jordanien",a:"Algerien"},
  {id:59,h:"Jordanien",a:"Argentinien"},{id:60,h:"Algerien",a:"Österreich"},
  {id:61,h:"Portugal",a:"DR Kongo"},{id:62,h:"Kolumbien",a:"Usbekistan"},
  {id:63,h:"Portugal",a:"Kolumbien"},{id:64,h:"Usbekistan",a:"DR Kongo"},
  {id:65,h:"DR Kongo",a:"Kolumbien"},{id:66,h:"Usbekistan",a:"Portugal"},
  {id:67,h:"England",a:"Kroatien"},{id:68,h:"Ghana",a:"Panama"},
  {id:69,h:"England",a:"Ghana"},{id:70,h:"Panama",a:"Kroatien"},
  {id:71,h:"Kroatien",a:"England"},{id:72,h:"Panama",a:"Ghana"},
];

function mapTeam(name) {
  return TEAM_MAP[name] || name;
}

function findGame(home, away) {
  const h = mapTeam(home), a = mapTeam(away);
  return OUR_GAMES.find(g => g.h === h && g.a === a);
}

async function fetchMatches() {
  const url = "https://api.football-data.org/v4/competitions/WC/matches?season=2026";
  const r = await fetch(url, { headers: { "X-Auth-Token": FOOTBALL_API_KEY } });
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  const data = await r.json();
  return data.matches || [];
}

async function gasGet(key) {
  const r = await fetch(`${GAS_URL}?key=${key}`, { redirect: "follow" });
  if (!r.ok) return {};
  return r.json();
}

async function gasSet(key, value) {
  const params = encodeURIComponent(JSON.stringify({ key, value }));
  const r = await fetch(`${GAS_URL}?action=set&data=${params}`, { redirect: "follow" });
  if (!r.ok) throw new Error(`GAS write error: ${r.status}`);
  return r.json();
}

async function main() {
  console.log("🔄 Auto-Sync gestartet:", new Date().toISOString());

  if (!FOOTBALL_API_KEY) throw new Error("FOOTBALL_API_KEY fehlt");
  if (!GAS_URL)          throw new Error("GAS_URL fehlt");

  // Aktuelle Ergebnisse aus Google Sheets laden
  const currentResults = await gasGet("results") || {};
  console.log(`📊 ${Object.keys(currentResults).length} Ergebnisse bereits gespeichert`);

  // Matches von football-data.org holen
  const matches = await fetchMatches();
  console.log(`⚽ ${matches.length} Spiele von der API erhalten`);

  let updatedResults = { ...currentResults };
  let changes = 0;

  for (const match of matches) {
    if (match.status !== "FINISHED") continue;

    const home = match.homeTeam?.name || match.homeTeam?.shortName || "";
    const away = match.awayTeam?.name || match.awayTeam?.shortName || "";
    const rh   = match.score?.fullTime?.home;
    const ra   = match.score?.fullTime?.away;

    if (rh === null || rh === undefined || ra === null || ra === undefined) continue;

    const game = findGame(home, away);
    if (!game) {
      console.log(`⚠ Kein Match gefunden: ${home} vs ${away}`);
      continue;
    }

    const key = String(game.id);
    const existing = updatedResults[key];
    if (!existing || String(existing.h) !== String(rh) || String(existing.a) !== String(ra)) {
      updatedResults[key] = { h: String(rh), a: String(ra) };
      changes++;
      console.log(`✅ Spiel ${game.id}: ${game.h} ${rh}:${ra} ${game.a}`);
    }
  }

  if (changes > 0) {
    await gasSet("results", updatedResults);
    console.log(`💾 ${changes} Ergebnis(se) in Google Sheets gespeichert`);
  } else {
    console.log("✓ Keine neuen Ergebnisse");
  }

  console.log("✅ Sync abgeschlossen:", new Date().toISOString());
}

main().catch(err => {
  console.error("❌ Fehler:", err.message);
  process.exit(1);
});
