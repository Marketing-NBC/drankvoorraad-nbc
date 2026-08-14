# Drankvoorraad — NBC & Green Village

Voorraadbeheer voor drank rond evenementen, voor NBC en Green Village.
Draait op **https://drankvoorraad-nbc.netlify.app**

Wat het doet: voorraad per locatie bijhouden, drank uitgeven aan een evenement
met een ondertekende pakbon, retouren verwerken, voorraadtellingen uitvoeren,
en automatisch de brutomarge per evenement berekenen.

## Hoe het in elkaar zit

| | |
|---|---|
| **App** | React + TypeScript, gebouwd met Vite. Alles staat in `app/` |
| **Database** | Supabase (Postgres). Schema en migraties in `supabase/` |
| **Hosting** | Netlify, configuratie in `netlify.toml` |
| **Huisstijl** | NBC design system in `app/src/design-system/` |

De volledige voorraadstand is altijd af te leiden uit de tabel `mutaties`:
die is append-only, wordt nooit gewijzigd of verwijderd, en vormt daarmee
het audit trail. `voorraad` wordt uitsluitend door een databasetrigger
bijgewerkt — nooit rechtstreeks.

## Aan de slag op een nieuwe computer

```bash
cd app
npm install
cp .env.example .env    # daarna de echte waarden invullen
npm run dev
```

De app draait dan op http://localhost:5173

## Veelgebruikte commando's

Allemaal vanuit `app/`:

```bash
npm run dev      # ontwikkelserver
npm run test     # tests draaien
npm run build    # controleert types en bouwt naar dist/
```

## Publiceren

Gaat vanzelf. Een push naar `main` laat Netlify de tests en de
typecontrole draaien; slagen die, dan gaat het live. Faalt er iets, dan
blijft de vorige versie gewoon draaien.

```bash
git add -A && git commit -m "wat er veranderd is" && git push
```

**Voorwaarde:** het Netlify-account moet gekoppeld zijn aan het
GitHub-account (Netlify → User settings → Connected accounts). Zonder die
koppeling weigert Netlify op dit abonnement elke push naar een privé-repo
met *"Unrecognized Git contributor"*, ongeacht het e-mailadres in de
commit. Commit daarnaast op het adres dat op je GitHub-profiel staat;
voor deze map staat dat goed via `git config user.email`.

Handmatig publiceren kan nog steeds, bijvoorbeeld om de site snel te
herstellen. Vanuit de projectmap, niet vanuit `app/`:

```bash
npx netlify deploy --prod --no-build --dir "app\dist"
```

Bouw dan eerst met `npm run build` in `app/`. De Netlify-token staat in
`app/.env` en gaat nooit mee naar GitHub.

### Instellingen die Netlify zelf moet kennen

De app leest `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY`. Lokaal komen
die uit `app/.env`; op Netlify staan ze onder Site configuration →
Environment variables. Ontbreken ze daar, dan stopt de build met een
duidelijke melding — zie `app/scripts/controleer-omgeving.mjs`.

## Database

De bestanden in `supabase/` zijn in volgorde uitgevoerd in de SQL Editor
van Supabase. Ze staan hier zodat de opbouw terug te lezen is:

| bestand | wat het toevoegde |
|---|---|
| `schema.sql` | tabellen, rollen, beveiligingsregels, mutatietrigger |
| `seed.sql` | beginproducten en locaties |
| `fase2.sql` | minimumvoorraad per locatie |
| `fase5.sql` | voorraadtellingen |
| `fase6.sql` | pakbonnen met handtekening |
| `fase9.sql` | emballage — later teruggedraaid |
| `fase9-terugdraaien.sql` | emballage uit gebruik genomen |
| `reset-testdata.sql` | alle testdata wissen en magazijn vullen |

## Rollen

| rol | mag |
|---|---|
| **beheerder** | alles, inclusief gebruikers, producten, locaties en prijzen |
| **magazijnmedewerker** | inboeken, pakbonnen, tellingen, producten aanmaken |
| **evenementmanager** | evenementen beheren, boeken en retourneren, alles inzien |

De rollen worden afgedwongen in de database, niet alleen in het scherm.

## Wat bewust niet is gebouwd

Geen native app (de mobiele browser volstaat), geen offline synchronisatie
(conflicten oplossen is te risicovol), geen RFID (metaal en vloeistof
verstoren het signaal). De koppeling met SEM is een apart traject; het
datamodel is er al op voorbereid met een vrij invulbaar evenementnummer.
