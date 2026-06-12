// ═══════════════════════════════════════════════════════════════
//  WM 2026 Auto-Sync + Backup
//  Holt Ergebnisse von API-Football → schreibt in Google Sheets
//  Erstellt regelmäßige Backups der Tipps
//  Läuft alle 5 Minuten via GitHub Actions
// ═══════════════════════════════════════════════════════════════

const GAS_URL        = process.env.GAS_URL;
const APIFOOTBALL_KEY = "42417879b61b66d01ada41794b24b205";
const fs             = require("fs");
const path           = require("path");

// ─── Name-Normalisierung ──────────────────────────────────────
const NAME_MAP = {
  "mexico":"mexiko","south africa":"südafrika",
  "korea republic":"südkorea","south korea":"südkorea",
  "czechia":"tschechien","czech republic":"tschechien",
  "canada":"kanada","bosnia":"bosnien-herzegowina",
  "bosnia and herzegovina":"bosnien-herzegowina",
  "qatar":"katar","switzerland":"schweiz",
  "brazil":"brasilien","morocco":"marokko",
  "haiti":"haiti","scotland":"schottland",
  "usa":"usa","united states":"usa","paraguay":"paraguay",
  "australia":"australien","turkey":"türkei","türkiye":"türkei",
  "germany":"deutschland","curaçao":"curaçao","curacao":"curaçao",
  "ivory coast":"elfenbeinküste","côte d'ivoire":"elfenbeinküste",
  "ecuador":"ecuador","netherlands":"niederlande",
  "japan":"japan","sweden":"schweden","tunisia":"tunesien",
  "belgium":"belgien","egypt":"ägypten","iran":"iran",
  "new zealand":"neuseeland","spain":"spanien",
  "cape verde":"kap verde","saudi arabia":"saudi-arabien",
  "uruguay":"uruguay","france":"frankreich","senegal":"senegal",
  "iraq":"irak","norway":"norwegen","argentina":"argentinien",
  "algeria":"algerien","austria":"österreich","jordan":"jordanien",
  "portugal":"portugal","dr congo":"dr kongo","congo dr":"dr kongo",
  "uzbekistan":"usbekistan","colombia":"kolumbien",
  "england":"england","croatia":"kroatien",
  "ghana":"ghana","panama":"panama",
};

const GAME_MAP = {
  "mexiko|südafrika":1,"südkorea|tschechien":2,
  "tschechien|südafrika":3,"mexiko|südkorea":4,
  "tschechien|mexiko":5,"südafrika|südkorea":6,
  "kanada|bosnien-herzegowina":7,"katar|schweiz":8,
  "schweiz|bosnien-herzegowina":9,"kanada|katar":10,
  "schweiz|kanada":11,"bosnien-herzegowina|katar":12,
  "brasilien|marokko":13,"haiti|schottland":14,
  "schottland|marokko":15,"brasilien|haiti":16,
  "schottland|brasilien":17,"marokko|haiti":18,
  "usa|paraguay":19,"australien|türkei":20,
  "usa|australien":21,"türkei|paraguay":22,
  "türkei|usa":23,"paraguay|australien":24,
  "deutschland|curaçao":25,"elfenbeinküste|ecuador":26,
  "deutschland|elfenbeinküste":27,"ecuador|curaçao":28,
  "ecuador|deutschland":29,"curaçao|elfenbeinküste":30,
  "niederlande|japan":31,"schweden|tunesien":32,
  "niederlande|schweden":33,"tunesien|japan":34,
  "tunesien|niederlande":35,"japan|schweden":36,
  "belgien|ägypten":37,"iran|neuseeland":38,
  "belgien|iran":39,"neuseeland|ägypten":40,
  "ägypten|iran":41,"neuseeland|belgien":42,
  "spanien|kap verde":43,"saudi-arabien|uruguay":44,
  "spanien|saudi-arabien":45,"uruguay|kap verde":46,
  "kap verde|saudi-arabien":47,"uruguay|spanien":48,
  "frankreich|senegal":49,"irak|norwegen":50,
  "frankreich|irak":51,"norwegen|senegal":52,
  "norwegen|frankreich":53,"senegal|irak":54,
  "argentinien|algerien":55,"österreich|jordanien":56,
  "argentinien|österreich":57,"jordanien|algerien":58,
  "jordanien|argentinien":59,"algerien|österreich":60,
  "portugal|dr kongo":61,"usbekistan|kolumbien":62,
  "portugal|usbekistan":63,"kolumbien|dr kongo":64,
  "kolumbien|portugal":65,"dr kongo|usbekistan":66,
  "england|kroatien":67,"ghana|panama":68,
  "england|ghana":69,"panama|kroatien":70,
  "panama|england":71,"kroatien|ghana":72,
};

function norm(name) {
  const n = (name || "").toLowerCase().trim();
  return NAME_MAP[n] || n;
}

function findGameId(home, away) {
  return GAME_MAP[`${norm(home)}|${norm(away)}`] || null;
}

// ─── Google Sheets ────────────────────────────────────────────
async function gasGet(key) {
  const r = await fetch(`${GAS_URL}?key=${key}`, { redirect:"follow" });
  if (!r.ok) throw new Error(`GAS read error: ${r.status}`);
  return r.json();
}

async function gasSet(key, value) {
  const params = encodeURIComponent(JSON.stringify({ key, value }));
  const r = await fetch(`${GAS_URL}?action=set&data=${params}`, { redirect:"follow" });
  if (!r.ok) throw new Error(`GAS write error: ${r.status}`);
  return r.json();
}

// ─── API-Football ─────────────────────────────────────────────
async function fetchResults() {
  // WM 2026: league=1, season=2026, status=FT (finished)
  const url = "https://v3.football.api-sports.io/fixtures?league=1&season=2026&status=FT";
  const r = await fetch(url, {
    headers: {
      "x-apisports-key": APIFOOTBALL_KEY,
    }
  });
  if (!r.ok) throw new Error(`API-Football error: ${r.status}`);
  const data = await r.json();
  const fixtures = data.response || [];
  console.log(`📊 API-Football: ${fixtures.length} abgeschlossene Spiele`);
  return fixtures;
}

// ─── Backup ───────────────────────────────────────────────────
async function createBackup() {
  console.log("📦 Erstelle Backup...");
  const backupDir = "backups";
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

  const [tips, results, koTeams] = await Promise.all([
    gasGet("tips").catch(() => ({})),
    gasGet("results").catch(() => ({})),
    gasGet("koTeams").catch(() => ({})),
  ]);

  const now     = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const backup  = { erstellt: now.toISOString(), tips, results, koTeams };

  fs.writeFileSync(path.join(backupDir, `backup-${dateStr}.json`),
    JSON.stringify(backup, null, 2));
  fs.writeFileSync(path.join(backupDir, "backup-latest.json"),
    JSON.stringify(backup, null, 2));

  for (const p of Object.keys(tips || {})) {
    console.log(`   ${p}: ${Object.keys(tips[p] || {}).length} Tipps`);
  }
  console.log(`   Ergebnisse: ${Object.keys(results || {}).length}`);

  // Max 10 Tages-Backups behalten
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith("backup-20") && f.endsWith(".json")).sort();
  for (const f of files.slice(0, Math.max(0, files.length - 10))) {
    fs.unlinkSync(path.join(backupDir, f));
    console.log(`🗑️  Gelöscht: ${f}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log("🚀 WM 2026 Sync gestartet:", new Date().toISOString());
  if (!GAS_URL) throw new Error("GAS_URL fehlt");

  await createBackup();



  console.log("\n⚽ Hole Ergebnisse von API-Football...");
  const currentResults = await gasGet("results").catch(() => ({})) || {};
  const fixtures       = await fetchResults();

  let updated = { ...currentResults };
  let changes = 0;

  for (const fix of fixtures) {
    const home = fix.teams?.home?.name || "";
    const away = fix.teams?.away?.name || "";
    const rh   = fix.goals?.home;
    const ra   = fix.goals?.away;

    if (rh === null || rh === undefined) continue;

    const gameId = findGameId(home, away);
    if (!gameId) {
      console.log(`⚠️  Kein Match: ${home} vs ${away}`);
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

  if (changes > 0) {
    await gasSet("results", updated);
    console.log(`💾 ${changes} Ergebnis(se) gespeichert`);
  } else {
    console.log("✓ Keine neuen Ergebnisse");
  }

  console.log("\n✅ Fertig:", new Date().toISOString());
}

main().catch(err => {
  console.error("❌ Fehler:", err.message);
  process.exit(1);
});
