/* Bouwt de ontwerpcheck: de echte schermen met verzonnen gegevens (dezelfde
   preview als `npm run preview:ui`), plus een pagina eromheen waarin je een
   scherm, een rol en een apparaat kiest.

   Resultaat in dist-preview/:
     ontwerpcheck.html   de pagina met de knoppen (publiceren als artifact)
     app/                de previewbuild die erin draait

   Alles staat met relatieve paden en de lettertypen zitten in de CSS, zodat
   de map los te hosten is — bijvoorbeeld als artifact op claude.ai, waar
   alleen bestanden uit de map zelf mogen laden. */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const app = fileURLToPath(new URL("..", import.meta.url));
const uit = `${app}dist-preview`;

execSync(
  `npx vite build --config vite.preview.config.ts --base ./ --assetsInlineLimit 100000000 --outDir ${uit}/app --emptyOutDir`,
  { cwd: app, stdio: "inherit" }
);

/* Een paar bibliotheken (exceljs) hebben het teken U+FFFD letterlijk in een
   string staan. Claude.ai weigert dat bij het publiceren als artifact; als
   escape betekent het in JavaScript precies hetzelfde. */
for (const bestand of readdirSync(`${uit}/app/assets`)) {
  if (!bestand.endsWith(".js")) continue;
  const pad = `${uit}/app/assets/${bestand}`;
  const code = readFileSync(pad, "utf8");
  if (code.includes("\ufffd")) writeFileSync(pad, code.replaceAll("\ufffd", "\\ufffd"));
}

function git(opdracht) {
  try {
    return execSync(`git ${opdracht}`, { cwd: app }).toString().trim();
  } catch {
    return "onbekend";
  }
}

const versie = {
  branch: git("rev-parse --abbrev-ref HEAD"),
  commit: git("rev-parse --short HEAD"),
  bericht: git("log -1 --format=%s"),
  gebouwd: new Date().toISOString(),
  /* Wijzigingen die nog niet gecommit zijn, staan wel in de build. */
  nietGecommit: git("status --porcelain") !== "",
};

const pagina = readFileSync(`${app}preview/ontwerpcheck.html`, "utf8").replace(
  "/*__VERSIE__*/null",
  JSON.stringify(versie)
);
writeFileSync(`${uit}/ontwerpcheck.html`, pagina);
console.log(`\nOntwerpcheck klaar in dist-preview/ (${versie.branch} @ ${versie.commit})`);
