# Testomgeving op je eigen computer

Een kopie van de echte app en de echte gegevens, die alleen op jouw computer
draait. Wat je hier boekt, wist of verandert, raakt de echte voorraad niet.
Je herkent hem aan de gele balk **Testomgeving** bovenaan elk scherm, en aan
"TEST ·" in de titel van het tabblad.

Hoe het werkt: Supabase (database, inloggen, realtime en de Edge Functions)
draait in Docker op je computer. Het script `app/scripts/testomgeving.mjs`
haalt een kopie van productie op, alleen lezend, en zet die daarin. De app
start je dan tegen die lokale kopie.

## Eenmalig installeren (Windows)

1. **Docker Desktop**: download het op docker.com ("Download for Windows") en
   installeer het. Laat het vinkje voor **WSL 2** aan staan. Herstart als het
   daarom vraagt. Open Docker Desktop daarna één keer en wacht tot linksonder
   "Engine running" staat.
2. **Node.js**: de LTS-versie van nodejs.org, als je die nog niet hebt.
3. **Git**: van git-scm.com, als je die nog niet hebt.
4. Open **PowerShell** en controleer of alles er is:
   ```
   docker --version
   node --version
   git --version
   ```
5. Haal de code op en installeer de app (sla over als je de map al hebt):
   ```
   git clone https://github.com/Marketing-NBC/drankvoorraad-nbc.git
   cd drankvoorraad-nbc\app
   npm install
   ```

## Eenmalig: het adres van productie

Voor de kopie heeft het script het adres van de productiedatabase nodig.

1. Draai in `drankvoorraad-nbc\app`:
   ```
   npm run lokaal:kopie
   ```
   De eerste keer stopt het meteen en maakt het het bestand
   `app\.env.productie-db` aan.
2. Ga in Supabase naar het project **Drankvoorraad NBC & GV**, klik bovenaan
   op **Connect** en kies **Session pooler**. Kopieer de URI. Die begint met
   `postgresql://postgres.wxvzrawdhpuzrhyxflrj:[YOUR-PASSWORD]@`.
3. Plak hem in `app\.env.productie-db` achter `PRODUCTIE_DB_URL=` en vervang
   `[YOUR-PASSWORD]` door het databasewachtwoord.
   Weet je dat wachtwoord niet? Onder **Project Settings → Database** kun je
   een nieuw instellen. De app merkt daar niets van: die logt niet met dit
   wachtwoord in.

`.env.productie-db` gaat nooit mee naar GitHub.

## Een kopie ophalen

```
npm run lokaal:kopie
```

De eerste keer downloadt Docker de onderdelen van Supabase (een paar GB, even
geduld). Daarna haalt het script het schema en de gegevens van productie op,
alleen lezend, en zet ze lokaal neer. Aan het eind staat hoeveel evenementen,
producten, mutaties en gebruikers erin zitten.

Inloggen gaat met je **gewone e-mailadres en wachtwoord**: de accounts zitten
in de kopie.

## Dagelijks gebruik

Start eerst Docker Desktop. Dan, in `drankvoorraad-nbc\app`:

| Opdracht | Wat het doet |
|---|---|
| `npm run lokaal:start` | De lokale Supabase starten |
| `npm run lokaal:app` | De app starten: open http://localhost:5173/drankvoorraad-nbc/ |
| `npm run lokaal:herstel` | Terug naar de laatste kopie. Al je testwerk is weg |
| `npm run lokaal:kopie` | Een verse kopie van productie ophalen |
| `npm run lokaal:stop` | De lokale Supabase stoppen (scheelt geheugen) |

In de gegevens zelf kijken kan in **Supabase Studio**:
http://127.0.0.1:54323. Dat is de lokale Studio, niet die van productie.

## Goed om te weten

- **Wat je wist of boekt, blijft lokaal.** Ook accounts aanmaken onder
  Gebruikers gebeurt alleen in de kopie.
- **`mutaties` blijft append-only, ook hier.** Een verkeerde testboeking haal
  je weg met `npm run lokaal:herstel`, niet door hem te wijzigen.
- **De kopie staat op je computer**, in `supabase\.kopie\`: alle gegevens,
  bedragen en de versleutelde wachtwoorden. Die map gaat niet mee naar
  GitHub. Haal hem weg als je de testomgeving niet meer gebruikt.
- **Op je telefoon testen**: `npm run lokaal:app` laat ook een "Network"-adres
  zien. Dat kun je openen op een telefoon in hetzelfde wifi-netwerk. De
  camera (barcode scannen, bon fotograferen) werkt daar niet: een telefoon
  geeft de camera alleen vrij via een beveiligde verbinding.
- **`npm run dev` blijft productie.** Alleen `npm run lokaal:app` praat met de
  kopie, en die start niet als de lokale Supabase niet aangesloten is.
