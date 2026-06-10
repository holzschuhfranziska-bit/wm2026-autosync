// ═══════════════════════════════════════════════════════════════
//  WM 2026 Auto-Sync Script
//  Holt Ergebnisse von football-data.org → schreibt in Firebase
//  Läuft alle 5 Minuten via GitHub Actions
// ═══════════════════════════════════════════════════════════════

const FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY;
const FIREBASE_URL     = process.env.FIREBASE_URL;     // https://sbo-wm-tippspiel-default-rtdb.europe-west1.firebasedatabase.app
const FIREBASE_KEY     = process.env.FIREBASE_KEY;     // AIzaSy...

// Mapping: football-data.org Team-Namen → unsere App-Namen
const TEAM_MAP = {
  "Mexico":              "Mexiko",
  "South Africa":        "Südafrika",
  "Korea Republic":      "Südkorea",
  "Czechia":             "Tschechien",
  "Canada":              "Kanada",
  "Bosnia and Herzegovina": "Bosnien-Herzegowina",
  "Qatar":               "Katar",
  "Switzerland":         "Schweiz",
  "Brazil":              "Brasilien",
  "Morocco":             "Marokko",
  "Haiti":               "Haiti",
  "Scotland":            "Schottland",
  "USA":                 "USA",
  "Paraguay":            "Paraguay",
  "Australia":           "Australien",
  "Turkey":              "Türkei",
  "Germany":             "Deutschland",
  "Curaçao":             "Curaçao",
  "Ivory Coast":         "Elfenbeinküste",
  "Ecuador":             "Ecuador",
  "Netherlands":         "Niederlande",
  "Japan":               "Japan",
  "Sweden":              "Schweden",
  "Tunisia":             "Tunesien",
  "Belgium":             "Belgien",
  "Egypt":               "Ägypten",
  "Iran":                "Iran",
  "New Zealand":         "Neuseeland",
  "Spain":               "Spanien",
  "Cape Verde":          "Kap Verde",
  "Saudi Arabia":        "Saudi-Arabien",
  "Uruguay":             "Uruguay",
  "France":              "Frankreich",
  "Senegal":             "Senegal",
  "Iraq":                "Irak",
  "Norway":              "Norwegen",
  "Argentina":           "Argentinien",
  "Algeria":             "Algerien",
  "Austria":             "Österreich",
  "Jordan":              "Jordanien",
  "Portugal":            "Portugal",
  "DR Congo":            "DR Kongo",
  "Uzbekistan":          "Usbekistan",
  "Colombia":            "Kolumbien",
  "England":             "England",
  "Croatia":             "Kroatien",
  "Ghana":               "Ghana",
  "Panama":              "Panama",
};

// Unsere Game-IDs basieren auf Heim+Auswärtsteam-Kombination
// Diese Liste mappt football-data Match-ID → unsere App Game-ID
// Wird dynamisch beim ersten Lauf aufgebaut
const OUR_GAMES = [
  {id:1,  h:"Mexiko",              a:"Südafrika"},
  {id:2,  h:"Südkorea",            a:"Tschechien"},
  {id:3,  h:"Tschechien",          a:"Südafrika"},
  {id:4,  h:"Mexiko",              a:"Südkorea"},
  {id:5,  h:"Tschechien",          a:"Mexiko"},
  {id:6,  h:"Südafrika",           a:"Südkorea"},
  {id:7,  h:"Kanada",              a:"Bosnien-Herzegowina"},
  {id:8,  h:"Katar",               a:"Schweiz"},
  {id:9,  h:"Schweiz",             a:"Bosnien-Herzegowina"},
  {id:10, h:"Kanada",              a:"Katar"},
  {id:11, h:"Schweiz",             a:"Kanada"},
  {id:12, h:"Bosnien-Herzegowina", a:"Katar"},
  {id:13, h:"Brasilien",           a:"Marokko"},
  {id:14, h:"Haiti",               a:"Schottland"},
  {id:15, h:"Schottland",          a:"Marokko"},
  {id:16, h:"Brasilien",           a:"Haiti"},
  {id:17, h:"Schottland",          a:"Brasilien"},
  {id:18, h:"Marokko",             a:"Haiti"},
  {id:19, h:"USA",                 a:"Paraguay"},
  {id:20, h:"Australien",          a:"Türkei"},
  {id:21, h:"USA",                 a:"Australien"},
  {id:22, h:"Türkei",              a:"Paraguay"},
  {id:23, h:"Türkei",              a:"USA"},
  {id:24, h:"Paraguay",            a:"Australien"},
  {id:25, h:"Deutschland",         a:"Curaçao"},
  {id:26, h:"Elfenbeinküste",      a:"Ecuador"},
  {id:27, h:"Deutschland",         a:"Elfenbeinküste"},
  {id:28, h:"Ecuador",             a:"Curaçao"},
  {id:29, h:"Ecuador",             a:"Deutschland"},
  {id:30, h:"Curaçao",             a:"Elfenbeinküste"},
  {id:31, h:"Niederlande",         a:"Japan"},
  {id:32, h:"Schweden",            a:"Tunesien"},
  {id:33, h:"Niederlande",         a:"Schweden"},
  {id:34, h:"Tunesien",            a:"Japan"},
  {id:35, h:"Tunesien",            a:"Niederlande"},
  {id:36, h:"Japan",               a:"Schweden"},
  {id:37, h:"Belgien",             a:"Ägypten"},
  {id:38, h:"Iran",                a:"Neuseeland"},
  {id:39, h:"Belgien",             a:"Iran"},
  {id:40, h:"Ägypten",             a:"Neuseeland"},
  {id:41, h:"Ägypten",             a:"Belgien"},
  {id:42, h:"Neuseeland",          a:"Iran"},
  {id:43, h:"Spanien",             a:"Uruguay"},
  {id:44, h:"Saudi-Arabien",       a:"Kap Verde"},
  {id:45, h:"Spanien",             a:"Saudi-Arabien"},
  {id:46, h:"Uruguay",             a:"Kap Verde"},
  {id:47, h:"Saudi-Arabien",       a:"Spanien"},
  {id:48, h:"Kap Verde",           a:"Uruguay"},
  {id:49, h:"Frankreich",          a:"Senegal"},
  {id:50, h:"Norwegen",            a:"Irak"},
  {id:51, h:"Frankreich",          a:"Norwegen"},
  {id:52, h:"Senegal",             a:"Irak"},
  {id:53, h:"Irak",                a:"Frankreich"},
  {id:54, h:"Norwegen",            a:"Senegal"},
  {id:55, h:"Argentinien",         a:"Algerien"},
  {id:56, h:"Österreich",          a:"Jordanien"},
  {id:57, h:"Argentinien",         a:"Österreich"},
  {id:58, h:"Jordanien",           a:"Algerien"},
  {id:59, h:"Jordanien",           a:"Argentinien"},
  {id:60, h:"Algerien",            a:"Österreich"},
  {id:61, h:"Portugal",            a:"DR Kongo"},
  {id:62, h:"Kolumbien",           a:"Usbekistan"},
  {id:63, h:"Portugal",            a:"Kolumbien"},
  {id:64, h:"Usbekistan",          a:"DR Kongo"},
  {id:65, h:"DR Kongo",            a:"Kolumbien"},
  {id:66, h:"Usbekistan",          a:"Portugal"},
  {id:67, h:"England",             a:"Kroatien"},
  {id:68, h:"Ghana",               a:"Panama"},
  {id:69, h:"England",             a:"Ghana"},
  {id:70, h:"Panama",              a:"Kroatien"},
  {id:71, h:"Kroatien",            a:"England"},
  {id:72, h:"Panama",              a:"Ghana"},
];

async function fetchMatches() {
  const url = "https://api.football-data.org/v4/competitions/WC/matches?season=2026";
  const res = await fetch(url, {
    headers: { "X-Auth-Token": FOOTBALL_API_KEY }
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.matches || [];
}

async function firebaseGet(path) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json?auth=${FIREBASE_KEY}`);
  return res.json();
}

async function firebaseSet(path, val) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json?auth=${FIREBASE_KEY}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(val)
  });
  if (!res.ok) throw new Error(`Firebase error: ${res.status}`);
  return res.json();
}

function mapTeam(name) {
  return TEAM_MAP[name] || name;
}

function findOurGame(homeTeam, awayTeam) {
  const h = mapTeam(homeTeam);
  const a = mapTeam(awayTeam);
  return OUR_GAMES.find(g => g.h === h && g.a === a);
}

async function main() {
  console.log("🔄 WM 2026 Auto-Sync gestartet:", new Date().toISOString());

  if (!FOOTBALL_API_KEY || !FIREBASE_URL || !FIREBASE_KEY) {
    throw new Error("Fehlende Umgebungsvariablen: FOOTBALL_API_KEY, FIREBASE_URL oder FIREBASE_KEY");
  }

  // Aktuelle Ergebnisse aus Firebase laden
  const currentResults = await firebaseGet("results") || {};
  const currentKO = await firebaseGet("koTeams") || {};

  let updatedResults = { ...currentResults };
  let updatedKO = { ...currentKO };
  let changesResults = 0;
  let changesKO = 0;

  // Matches von football-data.org holen
  const matches = await fetchMatches();
  console.log(`📊 ${matches.length} Spiele von der API erhalten`);

  for (const match of matches) {
    // Nur abgeschlossene Spiele
    if (match.status !== "FINISHED") continue;

    const homeTeamName = match.homeTeam?.name || match.homeTeam?.shortName;
    const awayTeamName = match.awayTeam?.name || match.awayTeam?.shortName;
    const homeScore = match.score?.fullTime?.home;
    const awayScore = match.score?.fullTime?.away;

    if (homeScore === null || homeScore === undefined) continue;
    if (awayScore === null || awayScore === undefined) continue;

    // Unser Spiel finden
    const ourGame = findOurGame(homeTeamName, awayTeamName);

    if (!ourGame) {
      // K.O.-Spiel: Teamnamen in koTeams schreiben
      const stage = match.stage;
      const isKO = ["ROUND_OF_16","LAST_16","ROUND_OF_32","QUARTER_FINALS",
                     "SEMI_FINALS","THIRD_PLACE","FINAL"].includes(stage);
      if (isKO) {
        // Suche passendes KO-Spiel anhand Datum (grob)
        // Schreibe Teamnamen und Ergebnis in Firebase mit football-data match ID
        const fbKey = `ko_fd_${match.id}`;
        const h = mapTeam(homeTeamName);
        const a = mapTeam(awayTeamName);
        if (!updatedKO[fbKey] || updatedKO[fbKey].h !== h) {
          updatedKO[fbKey] = { h, a, score_h: String(homeScore), score_a: String(awayScore) };
          changesKO++;
          console.log(`🏆 KO-Spiel: ${h} ${homeScore}:${awayScore} ${a}`);
        }
      }
      continue;
    }

    // Ergebnis aktualisieren falls noch nicht vorhanden oder geändert
    const existing = updatedResults[ourGame.id];
    if (!existing || String(existing.h) !== String(homeScore) || String(existing.a) !== String(awayScore)) {
      updatedResults[ourGame.id] = { h: String(homeScore), a: String(awayScore) };
      changesResults++;
      console.log(`⚽ Spiel ${ourGame.id}: ${ourGame.h} ${homeScore}:${awayScore} ${ourGame.a}`);
    }
  }

  // Firebase updaten falls Änderungen
  if (changesResults > 0) {
    await firebaseSet("results", updatedResults);
    console.log(`✅ ${changesResults} Ergebnis(se) in Firebase gespeichert`);
  } else {
    console.log("✓ Keine neuen Ergebnisse");
  }

  if (changesKO > 0) {
    await firebaseSet("koTeams", updatedKO);
    console.log(`✅ ${changesKO} K.O.-Team(s) in Firebase gespeichert`);
  }

  console.log("✅ Sync abgeschlossen:", new Date().toISOString());
}

main().catch(err => {
  console.error("❌ Fehler:", err.message);
  process.exit(1);
});
