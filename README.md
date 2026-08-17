# Drankvoorraad — NBC & Green Village

Voorraadbeheer voor drank rond evenementen, voor NBC en Green Village.
Draait op **https://marketing-nbc.github.io/drankvoorraad-nbc/**

Wat het doet: voorraad per locatie bijhouden, drank uitgeven aan een evenement
met een ondertekende pakbon, retouren verwerken, voorraadtellingen uitvoeren,
en automatisch de brutomarge per evenement berekenen.

## Hoe het in elkaar zit

| | |
|---|---|
| **App** | React + TypeScript, gebouwd met Vite. Alles staat in `app/` |
| **Database** | Supabase (Postgres). Schema en migraties in `supabase/` |
| **Hosting** | GitHub Pages, workflow in `.github/workflows/deploy.yml` |
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

Gaat vanzelf. Een push naar `main` laat GitHub Actions de tests en de
typecontrole draaien; slagen die, dan gaat het live. Faalt er iets, dan
wordt er niets gepubliceerd en blijft de vorige versie gewoon draaien.

```bash
git add -A && git commit -m "wat er veranderd is" && git push
```

Meekijken kan in de **Actions**-tab. Daar kun je ook opnieuw publiceren
zonder iets te wijzigen: kies de workflow *Publiceren op GitHub Pages* en
klik op **Run workflow**.

### Instellingen die GitHub zelf moet kennen

De app leest `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY`. Lokaal komen
die uit `app/.env`; voor het publiceren staan ze in GitHub onder Settings →
Secrets and variables → Actions. Ontbreken ze daar, dan stopt de build met
een duidelijke melding — zie `app/scripts/controleer-omgeving.mjs`.

Er is geen deploy-token nodig: de workflow publiceert met de rechten die
er in `deploy.yml` aan toegekend zijn.

### Waarom de app in een submap staat

GitHub Pages serveert dit project vanaf `/drankvoorraad-nbc/` en niet vanaf
de hoofdmap. Dat pad staat op één plek, `base` in `app/vite.config.ts`; de
router in `app/src/main.tsx` leest dezelfde waarde uit
`import.meta.env.BASE_URL`. Lokaal is die `/`, dus `npm run dev` merkt er
niets van.

Pages kan verder niet, zoals een gewone webserver, elk pad naar
`index.html` sturen. Daarom zet de workflow een kopie van `index.html` neer
als `404.html`. Pages valt daarop terug bij een onbekend pad, de app start
alsnog op en de router leest het pad uit de adresbalk. Zo blijven diepe
links en F5 werken.

Twee dingen die Netlify wél deed en Pages niet kan: eigen
beveiligingsheaders meesturen, en een lange cachetijd op `/assets/*`
zetten. Het eerste maakte de app strenger dan de standaard, het tweede
scheelde wat netwerkverkeer — de bestandsnamen bevatten een hash, dus een
nieuwe versie komt nog altijd direct door.

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
