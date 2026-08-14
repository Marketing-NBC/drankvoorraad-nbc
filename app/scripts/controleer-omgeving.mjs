/**
 * Controleert vóór het bouwen of de Supabase-instellingen aanwezig zijn.
 *
 * Waarom dit bestaat: de app leest deze waarden pas uit wanneer iemand de
 * pagina opent. Ontbreken ze, dan slaagt de build gewoon — inclusief tests
 * en typecontrole — en gaat er een witte pagina live. Dat is precies wat er
 * op 14 augustus 2026 gebeurde bij het aanzetten van automatisch publiceren.
 *
 * Beter een rode build dan een dode site.
 */

import { loadEnv } from "vite";

/*
 * Op Netlify staan de waarden in process.env; lokaal staan ze in app/.env,
 * dat Vite zelf inleest en dus níét in process.env terechtkomt. loadEnv
 * kijkt op allebei de plekken, precies zoals Vite dat bij het bouwen doet.
 */
const omgeving = loadEnv(process.env.NODE_ENV ?? "production", process.cwd(), "");

const vereist = [
  {
    naam: "VITE_SUPABASE_URL",
    uitleg: "het adres van je Supabase-project, bijv. https://xxxx.supabase.co",
  },
  {
    naam: "VITE_SUPABASE_ANON_KEY",
    uitleg: "de anon public key uit Supabase → Project Settings → API",
  },
];

const ontbreekt = vereist.filter(({ naam }) => !omgeving[naam]?.trim());

if (ontbreekt.length > 0) {
  const opNetlify = Boolean(process.env.NETLIFY);

  console.error("\n  De build is gestopt: er ontbreken instellingen.\n");
  for (const { naam, uitleg } of ontbreekt) {
    console.error(`    ${naam} — ${uitleg}`);
  }

  console.error(
    opNetlify
      ? "\n  Voeg ze toe in Netlify onder Site configuration → Environment variables\n" +
          "  en start daarna een nieuwe deploy.\n"
      : "\n  Zet ze in app/.env. Zie app/.env.example voor de opzet.\n"
  );

  process.exit(1);
}
