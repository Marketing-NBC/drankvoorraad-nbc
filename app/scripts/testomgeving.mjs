/* Testomgeving: een lokale Supabase (in Docker) met een kopie van productie.
   Zo probeer je iets uit zonder de echte voorraad te raken.

     npm run lokaal:start    lokale Supabase starten, app erop aansluiten
     npm run lokaal:kopie    verse kopie van productie ophalen en inladen
     npm run lokaal:herstel  laatste kopie opnieuw inladen (testwerk weg)
     npm run lokaal:app      de app starten tegen de lokale Supabase
     npm run lokaal:stop     lokale Supabase stoppen

   Werkt op Windows, macOS en Linux. Nodig: Docker Desktop en Node. De
   Supabase CLI komt via npx. Zie TESTOMGEVING.md voor de uitleg.

   Waarom zo: de kopie wordt gemaakt met `supabase db dump` (schema en
   gegevens apart) en teruggezet met psql in de databasecontainer, met
   triggers uit tijdens het laden. Anders telt de voorraadtrigger elke
   mutatie uit de kopie nóg een keer op, en weigert de rolcontrole
   boekingen omdat er tijdens het laden niemand ingelogd is. */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const appMap = fileURLToPath(new URL("..", import.meta.url));
const projectMap = fileURLToPath(new URL("../..", import.meta.url));
const kopieMap = `${projectMap}supabase/.kopie`;
const productieBestand = `${appMap}.env.productie-db`;
const lokaalBestand = `${appMap}.env.lokaal`;

/* Vast versienummer, zodat iedereen dezelfde lokale Supabase krijgt. */
const SUPABASE = "supabase@2.121.0";
/* Naam volgt uit project_id in supabase/config.toml. */
const DB_CONTAINER = "supabase_db_drankvoorraad-nbc";
const isWindows = process.platform === "win32";

function stop(melding) {
  console.error(`\n✗ ${melding}\n`);
  process.exit(1);
}

function stap(tekst) {
  console.log(`\n→ ${tekst}`);
}

/* De Supabase CLI via npx. Met een shell, want npx is op Windows een .cmd.
   De database-URL van productie gaat er als omgevingsvariabele in en wordt
   door de shell zelf ingevuld: dan doen tekens als & of % in het
   wachtwoord niets geks. */
function supabase(args, { stil = false, env = {} } = {}) {
  const r = spawnSync(`npx -y ${SUPABASE} ${args}`, {
    cwd: projectMap,
    shell: true,
    stdio: stil ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return { ok: r.status === 0, uit: r.stdout ?? "", fout: r.stderr ?? "" };
}

function dockerDraait() {
  const r = spawnSync("docker", ["info"], { stdio: "ignore" });
  return r.status === 0;
}

function lokaleStatus() {
  const r = supabase("status -o env", { stil: true });
  if (!r.ok) return null;
  const waarden = {};
  for (const regel of r.uit.split(/\r?\n/)) {
    const m = regel.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) waarden[m[1]] = m[2];
  }
  return waarden.API_URL && waarden.ANON_KEY ? waarden : null;
}

/* SQL in de lokale databasecontainer, met de psql die daar al in zit: op
   Windows hoeft er dus geen PostgreSQL geïnstalleerd te worden. */
function psql(sql, { invoer } = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      "exec", "-i", "-e", "PGPASSWORD=postgres", DB_CONTAINER,
      "psql", "-h", "localhost", "-U", "postgres", "-d", "postgres",
      "-v", "ON_ERROR_STOP=1", "-q", "-At",
      ...(invoer ? ["--single-transaction", "-f", "-"] : ["-c", sql]),
    ];
    const p = spawn("docker", args, { stdio: [invoer ? "pipe" : "ignore", "pipe", "pipe"] });
    let uit = "";
    let fout = "";
    p.stdout.on("data", (d) => (uit += d));
    p.stderr.on("data", (d) => (fout += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(uit.trim()) : reject(new Error(fout.trim() || `psql stopte met ${code}`))));
    if (invoer) {
      p.stdin.on("error", () => {}); // psql kan eerder stoppen bij een fout; die melding komt via stderr
      p.stdin.end(invoer);
    }
  });
}

function zorgDatHetDraait() {
  if (!dockerDraait()) {
    stop("Docker draait niet. Start Docker Desktop, wacht tot het walvisje stil staat, en probeer het opnieuw.");
  }
  let status = lokaleStatus();
  if (!status) {
    stap("Lokale Supabase starten (de eerste keer downloadt dit een paar GB; dat duurt even)");
    if (!supabase("start").ok) stop("De lokale Supabase start niet. Kijk hierboven naar de melding.");
    status = lokaleStatus();
    if (!status) stop("De lokale Supabase draait, maar geeft geen adres of sleutel terug.");
  }
  /* De app leest dit bestand bij `vite --mode lokaal`; het gaat vóór .env. */
  writeFileSync(
    lokaalBestand,
    [
      "# Gemaakt door scripts/testomgeving.mjs — de app tegen de LOKALE Supabase.",
      "# Niet met de hand aanpassen; draai npm run lokaal:start opnieuw.",
      `VITE_SUPABASE_URL=${status.API_URL}`,
      `VITE_SUPABASE_ANON_KEY=${status.ANON_KEY}`,
      "",
    ].join("\n")
  );
  return status;
}

function productieUrl() {
  if (!existsSync(productieBestand)) {
    writeFileSync(
      productieBestand,
      [
        "# Adres van de PRODUCTIEdatabase, alleen om een kopie te maken.",
        "# Supabase → project → knop Connect → Session pooler → URI.",
        "# Vervang [YOUR-PASSWORD] door het databasewachtwoord (Project",
        "# Settings → Database; daar kun je het ook opnieuw instellen).",
        "# Dit bestand gaat nooit mee naar GitHub.",
        "PRODUCTIE_DB_URL=",
        "",
      ].join("\n")
    );
    stop(`Vul eerst het adres van de productiedatabase in, in:\n  ${productieBestand}\nDaar staat bij waar je het vindt.`);
  }
  const regel = readFileSync(productieBestand, "utf8")
    .split(/\r?\n/)
    .find((r) => r.startsWith("PRODUCTIE_DB_URL="));
  const url = regel?.slice("PRODUCTIE_DB_URL=".length).trim().replace(/^"|"$/g, "");
  if (!url) stop(`PRODUCTIE_DB_URL is nog leeg in ${productieBestand}.`);
  if (url.includes("[YOUR-PASSWORD]")) stop("Vervang [YOUR-PASSWORD] in de URL door het databasewachtwoord.");
  if (/127\.0\.0\.1|localhost/.test(url)) stop("PRODUCTIE_DB_URL wijst naar je eigen computer, niet naar productie.");
  return url;
}

function haalKopie() {
  const url = productieUrl();
  mkdirSync(kopieMap, { recursive: true });
  /* Alleen lezen: pg_dump verandert niets op productie. */
  const env = { PRODUCTIE_DB_URL: url };
  const ref = isWindows ? "%PRODUCTIE_DB_URL%" : "$PRODUCTIE_DB_URL";
  stap("Schema van productie ophalen (alleen lezen)");
  if (!supabase(`db dump --db-url "${ref}" -f supabase/.kopie/schema.sql`, { env }).ok) {
    stop("Het schema ophalen lukte niet. Klopt het adres en het wachtwoord in .env.productie-db?");
  }
  stap("Gegevens van productie ophalen (alleen lezen)");
  if (!supabase(`db dump --db-url "${ref}" -f supabase/.kopie/data.sql --use-copy --data-only`, { env }).ok) {
    stop("De gegevens ophalen lukte niet.");
  }
  writeFileSync(`${kopieMap}/opgehaald.txt`, `${new Date().toISOString()}\n`);
}

async function laadKopie() {
  const schema = `${kopieMap}/schema.sql`;
  const data = `${kopieMap}/data.sql`;
  if (!existsSync(schema) || !existsSync(data)) {
    stop("Er is nog geen kopie. Draai eerst npm run lokaal:kopie.");
  }
  stap("Lokale database leegmaken (alleen op deze computer)");
  if (!supabase("db reset").ok) stop("De lokale database leegmaken lukte niet.");

  stap("Kopie inladen");
  const invoer =
    readFileSync(schema, "utf8") +
    /* Triggers uit tijdens het laden: de voorraad staat al goed in de
       kopie en mag niet nog eens bijgeteld worden. */
    "\nSET session_replication_role = replica;\n" +
    readFileSync(data, "utf8");
  try {
    await psql(null, { invoer });
  } catch (e) {
    stop(`Inladen mislukt:\n${e.message}`);
  }

  /* Een trigger op auth.users zit niet in de dump (auth is van Supabase
     zelf). Zonder deze trigger krijgt een nieuw account geen profiel. */
  await psql(`
    do $$ begin
      if exists (select 1 from pg_proc where proname = 'handle_new_user') then
        drop trigger if exists on_auth_user_created on auth.users;
        create trigger on_auth_user_created after insert on auth.users
          for each row execute function public.handle_new_user();
      end if;
    end $$;`);

  const telling = await psql(
    "select (select count(*) from evenementen) || ' evenementen, ' || (select count(*) from producten) || ' producten, ' || (select count(*) from mutaties) || ' mutaties, ' || (select count(*) from profiles) || ' gebruikers'"
  );
  const opgehaald = existsSync(`${kopieMap}/opgehaald.txt`)
    ? readFileSync(`${kopieMap}/opgehaald.txt`, "utf8").trim()
    : "onbekend";
  console.log(`\n✓ Kopie van ${new Date(opgehaald).toLocaleString("nl-NL")} staat klaar: ${telling}.`);
  console.log("  Inloggen gaat met je gewone e-mailadres en wachtwoord.");
  console.log("  Start de app met: npm run lokaal:app\n");
}

const opdracht = process.argv[2];
if (opdracht === "start") {
  const s = zorgDatHetDraait();
  console.log(`\n✓ Lokale Supabase draait op ${s.API_URL}`);
  console.log(`  Gegevens bekijken: ${s.STUDIO_URL ?? "http://127.0.0.1:54323"}`);
  console.log("  Nog leeg? Haal een kopie op met: npm run lokaal:kopie");
  console.log("  App starten: npm run lokaal:app\n");
} else if (opdracht === "kopie") {
  zorgDatHetDraait();
  haalKopie();
  await laadKopie();
} else if (opdracht === "herstel") {
  zorgDatHetDraait();
  await laadKopie();
} else if (opdracht === "app") {
  /* Zonder .env.lokaal valt vite terug op .env — en dat is productie. Dan
     liever niet starten. */
  const lokaal = existsSync(lokaalBestand) ? readFileSync(lokaalBestand, "utf8") : "";
  if (!/VITE_SUPABASE_URL=http:\/\/(127\.0\.0\.1|localhost)/.test(lokaal)) {
    stop("De app is nog niet op de lokale Supabase aangesloten. Draai eerst npm run lokaal:start.");
  }
  if (!lokaleStatus()) stop("De lokale Supabase draait niet. Start hem met npm run lokaal:start.");
  console.log("\nDe app draait straks op http://localhost:5173/drankvoorraad-nbc/ — tegen de LOKALE kopie.\n");
  spawnSync("npx vite --mode lokaal --host", { cwd: appMap, shell: true, stdio: "inherit" });
} else if (opdracht === "stop") {
  supabase("stop");
} else {
  stop("Gebruik: npm run lokaal:start | lokaal:kopie | lokaal:herstel | lokaal:app | lokaal:stop");
}
