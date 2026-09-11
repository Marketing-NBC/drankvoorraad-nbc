# Edge Functions

Serverwerk dat niet in de browser kan. Nu één functie: `gebruikers`.

## Neerzetten

```
supabase link --project-ref <project-ref>
supabase functions deploy gebruikers
```

`SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` zet Supabase zelf klaar. Er hoeft
dus geen sleutel ergens ingevuld te worden — en dat is precies de bedoeling:
die sleutel komt nergens anders voor.

## Wat je daarna nog moet doen

Zet zelfregistratie uit in het dashboard: **Authentication → Sign In /
Providers → "Allow new users to sign up"**. Zonder dat kan iemand met het adres
van de app alsnog zelf een account aanmaken, en is gebruikersbeheer in de app
een dichte deur in een open muur.

## Nog te schrijven: de koppeling met Franke en Aquablu

De plek waar die binnenkomt ligt vast: de databasefunctie `importeer_metingen`
(zie `supabase/migraties/013_koppelingen.sql`). Wat er nog ontbreekt is een
functie die periodiek bij hun API langsgaat en het resultaat daarin gooit:

```ts
const { data } = await beheer.rpc("importeer_metingen", {
  p_soort: "franke",
  p_metingen: [{ machine: "FR-001", datum: "2026-09-11", aantal: 84, extern_id: "r-1" }],
});
```

De sleutel van Franke of Aquablu hoort in de omgeving van die functie
(`supabase secrets set FRANKE_API_KEY=…`), niet in de tabel `koppelingen` —
die kan elke ingelogde gebruiker lezen.

Dezelfde regel twee keer aanleveren is geen probleem: de import is idempotent.
