/**
 * Een foto van de afleverbon lezen.
 *
 * Bij een levering maakt het magazijn een foto van de bon van de
 * leverancier. Deze functie stuurt die naar Claude en krijgt terug wat er
 * op staat: het bonnummer, de leverancier en per regel het artikelnummer,
 * de omschrijving en hoeveel er besteld en uitgeleverd is. De app vult
 * daarmee "op de bon" in; wat er werkelijk stond telt het magazijn zelf.
 *
 * Er wordt hier niets geboekt en niets opgeslagen — ook de foto niet. Deze
 * functie leest alleen. Welk product bij welk artikelnummer hoort, zoekt de
 * app op in `leverancier_artikelen` (migratie 027).
 *
 * De API-sleutel van Anthropic staat alleen hier, als geheim in Supabase.
 * Hij komt nooit in de browser. Daarom controleert de functie zelf of de
 * aanvrager ingelogd is en leveringen mag aannemen (beheerder of
 * medewerker): anders kan iedereen met het adres van de app op onze
 * rekening foto's laten lezen.
 *
 * ── Neerzetten ──────────────────────────────────────────────────────────
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   supabase functions deploy lees-bon
 *
 * SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY geeft Supabase zelf mee.
 */

import Anthropic from "npm:@anthropic-ai/sdk@0.132.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Wie een levering mag aannemen, mag ook een bon laten lezen. */
const ROLLEN = ["beheerder", "medewerker"];

/** Een bon heeft zelden meer dan drie pagina's; meer is waarschijnlijk een vergissing. */
const MAX_FOTOS = 4;

/** Claude neemt tot 5 MB per afbeelding. Base64 is een derde groter dan het bestand. */
const MAX_BASE64 = Math.floor((5 * 1024 * 1024 * 4) / 3);

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type MediaType = (typeof MEDIA_TYPES)[number];

/** Wat er terugkomt. Onbekend of onleesbaar is null, nooit een gok. */
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["leverancier", "bonnummer", "datum", "regels"],
  properties: {
    leverancier: { type: ["string", "null"] },
    bonnummer: { type: ["string", "null"] },
    datum: { type: ["string", "null"] },
    regels: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["artikelnummer", "omschrijving", "besteld", "uitgeleverd"],
        properties: {
          artikelnummer: { type: ["string", "null"] },
          omschrijving: { type: "string" },
          besteld: { type: ["integer", "null"] },
          uitgeleverd: { type: ["integer", "null"] },
        },
      },
    },
  },
};

const OPDRACHT = `Dit zijn foto's van een afleverbon van een drankleverancier (meestal Swinkels of Bidfood) aan N.B.C. Exploitatie B.V. Lees de bon uit.

- leverancier: de naam van de leverancier zoals in het logo of de kop, bijvoorbeeld "Swinkels" of "Bidfood".
- bonnummer: het nummer van deze levering. Op een bon van Swinkels is dat het nummer onder "Levering" (bijvoorbeeld 800758649), niet het SFB-ordernummer en niet de transportreferentie. Bij een andere leverancier: het afleverbon- of leveringsnummer.
- datum: de afleverdatum als JJJJ-MM-DD.
- regels: elke artikelregel uit de tabel met geleverde artikelen, in de volgorde van de bon. Per regel het artikelnummer, de omschrijving zoals gedrukt, het aantal besteld en het aantal uitgeleverd, in de eenheid van de bon (kratten, trays, fusten). Neem de gedrukte getallen over; handgeschreven aantekeningen tellen niet.

Neem geen ladingdragers, rolcontainers, afmetingen of regels van een emballage-retourbon op. Is iets niet te lezen, vul dan null in in plaats van te gokken. Staan er meerdere pagina's op de foto's, voeg de regels samen en neem elke regel één keer op.`;

interface Foto {
  data: string;
  mediaType: MediaType;
}

function antwoord(inhoud: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(inhoud), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function leesFotos(invoer: unknown): Foto[] | string {
  if (!Array.isArray(invoer) || invoer.length === 0) return "Stuur minstens één foto mee.";
  if (invoer.length > MAX_FOTOS) return `Hooguit ${MAX_FOTOS} foto's per bon.`;
  const fotos: Foto[] = [];
  for (const item of invoer) {
    const data = typeof item?.data === "string" ? item.data : "";
    const mediaType = item?.mediaType;
    if (!data) return "Een foto is leeg.";
    if (!MEDIA_TYPES.includes(mediaType)) return "Alleen JPEG, PNG of WebP.";
    if (data.length > MAX_BASE64) return "Een foto is te groot. Maak hem kleiner en probeer opnieuw.";
    fotos.push({ data, mediaType });
  }
  return fotos;
}

Deno.serve(async (verzoek: Request) => {
  if (verzoek.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (verzoek.method !== "POST") return antwoord({ fout: "Alleen POST." }, 405);

  const sleutel = Deno.env.get("ANTHROPIC_API_KEY");
  if (!sleutel) {
    return antwoord({ fout: "Bon lezen staat nog niet aan: de API-sleutel ontbreekt." }, 503);
  }

  // ─── Wie klopt er aan? ───────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const token = verzoek.headers.get("Authorization")?.replace(/^Bearer /i, "");
  if (!token) return antwoord({ fout: "Niet ingelogd." }, 401);

  const { data: gebruikerData, error: tokenFout } = await supabase.auth.getUser(token);
  if (tokenFout || !gebruikerData?.user) return antwoord({ fout: "Niet ingelogd." }, 401);

  const { data: profiel } = await supabase
    .from("profiles")
    .select("rol, actief")
    .eq("id", gebruikerData.user.id)
    .single();

  if (!profiel?.actief || !ROLLEN.includes(profiel.rol)) {
    return antwoord({ fout: "Alleen wie leveringen aanneemt, kan een bon laten lezen." }, 403);
  }

  // ─── De foto's ───────────────────────────────────────────────────
  let opdracht: Record<string, unknown>;
  try {
    opdracht = await verzoek.json();
  } catch {
    return antwoord({ fout: "Onleesbaar verzoek." }, 400);
  }

  const fotos = leesFotos(opdracht.fotos);
  if (typeof fotos === "string") return antwoord({ fout: fotos }, 400);

  // ─── Claude leest de bon ─────────────────────────────────────────
  const client = new Anthropic({ apiKey: sleutel });

  try {
    const bericht = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Weigert het model een verzoek, dan probeert de API het zelf op een
      // ander model in plaats van met lege handen terug te komen.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            ...fotos.map((foto) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: foto.mediaType, data: foto.data },
            })),
            { type: "text" as const, text: OPDRACHT },
          ],
        },
      ],
    });

    if (bericht.stop_reason === "refusal") {
      return antwoord({ fout: "De bon kon niet gelezen worden. Vul hem met de hand in." }, 422);
    }
    if (bericht.stop_reason === "max_tokens") {
      return antwoord({ fout: "De bon is te lang om in één keer te lezen. Vul hem met de hand in." }, 422);
    }

    const tekst = bericht.content
      .map((blok) => (blok.type === "text" ? blok.text : ""))
      .join("");

    let bon: unknown;
    try {
      bon = JSON.parse(tekst);
    } catch {
      return antwoord({ fout: "De bon kon niet gelezen worden. Vul hem met de hand in." }, 422);
    }

    return antwoord({ bon });
  } catch (fout) {
    if (fout instanceof Anthropic.RateLimitError) {
      return antwoord({ fout: "Het lezen van bonnen is even te druk. Probeer het over een minuut opnieuw." }, 429);
    }
    if (fout instanceof Anthropic.AuthenticationError) {
      return antwoord({ fout: "Bon lezen staat niet goed ingesteld: de API-sleutel klopt niet." }, 503);
    }
    if (fout instanceof Anthropic.BadRequestError) {
      return antwoord({ fout: "De foto kon niet verwerkt worden. Maak een nieuwe foto." }, 400);
    }
    if (fout instanceof Anthropic.APIError) {
      return antwoord({ fout: "Bon lezen lukt nu niet. Vul hem met de hand in." }, 502);
    }
    return antwoord({ fout: "Bon lezen lukt nu niet. Vul hem met de hand in." }, 502);
  }
});
