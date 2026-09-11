/**
 * Gebruikersbeheer — de enige plek waar de servicesleutel gebruikt wordt.
 *
 * Accounts aanmaken, een wachtwoord opnieuw zetten en toegang intrekken kan
 * alleen met die sleutel. Die hoort nooit in een browser: wie hem heeft, kan
 * langs elke RLS-policy. Daarom gebeurt dit werk hier, op de server, en roept
 * de app deze functie aan met het gewone token van degene die ingelogd is.
 *
 * De controle staat dus twee keer aan:
 *   1. Het token moet van een bestaande gebruiker zijn.
 *   2. Die gebruiker moet volgens `profiles` beheerder zijn.
 *
 * Er wordt geen e-mail verstuurd. Een nieuw account krijgt meteen een
 * wachtwoord dat de beheerder zelf doorgeeft, en `email_confirm` staat aan
 * zodat er geen bevestigingsmail nodig is die in een spamfilter blijft hangen.
 *
 * ── Neerzetten ──────────────────────────────────────────────────────────
 *   supabase functions deploy gebruikers
 *
 * SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY worden door Supabase zelf
 * meegegeven; daar hoef je niets voor in te stellen.
 *
 * Zet daarnaast in het dashboard zelfregistratie uit
 * (Authentication → Sign In / Providers → "Allow new users to sign up").
 * Zonder dat kan iemand met het adres van de app alsnog zelf een account
 * maken, en dan is deze functie een dichte deur in een open muur.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLLEN = ["beheerder", "magazijnmedewerker", "evenementmanager"];

/** Lang genoeg om "voor altijd" te betekenen; Supabase kent geen oneindig. */
const VOORGOED = "876000h";

function antwoord(inhoud: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(inhoud), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (verzoek: Request) => {
  if (verzoek.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (verzoek.method !== "POST") return antwoord({ fout: "Alleen POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceSleutel = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const beheer = createClient(url, serviceSleutel, { auth: { persistSession: false } });

  // ─── Wie klopt er aan? ───────────────────────────────────────────
  const token = verzoek.headers.get("Authorization")?.replace(/^Bearer /i, "");
  if (!token) return antwoord({ fout: "Niet ingelogd." }, 401);

  const { data: gebruikerData, error: tokenFout } = await beheer.auth.getUser(token);
  if (tokenFout || !gebruikerData?.user) return antwoord({ fout: "Niet ingelogd." }, 401);

  const { data: profiel } = await beheer
    .from("profiles")
    .select("rol")
    .eq("id", gebruikerData.user.id)
    .single();

  if (profiel?.rol !== "beheerder") {
    return antwoord({ fout: "Alleen een beheerder beheert gebruikers." }, 403);
  }

  // ─── Wat moet er gebeuren? ───────────────────────────────────────
  let opdracht: Record<string, unknown>;
  try {
    opdracht = await verzoek.json();
  } catch {
    return antwoord({ fout: "Onleesbaar verzoek." }, 400);
  }

  const actie = String(opdracht.actie ?? "");

  if (actie === "aanmaken") {
    const naam = String(opdracht.naam ?? "").trim();
    const email = String(opdracht.email ?? "").trim().toLowerCase();
    const wachtwoord = String(opdracht.wachtwoord ?? "");
    const rol = String(opdracht.rol ?? "evenementmanager");

    if (!naam) return antwoord({ fout: "Vul een naam in." }, 400);
    if (!email.includes("@")) return antwoord({ fout: "Vul een geldig e-mailadres in." }, 400);
    if (wachtwoord.length < 8) return antwoord({ fout: "Een wachtwoord is minstens 8 tekens." }, 400);
    if (!ROLLEN.includes(rol)) return antwoord({ fout: "Onbekende rol." }, 400);

    const { data: nieuw, error } = await beheer.auth.admin.createUser({
      email,
      password: wachtwoord,
      email_confirm: true,
      user_metadata: { naam },
    });

    if (error) {
      const bestaat = error.message.toLowerCase().includes("already");
      return antwoord(
        { fout: bestaat ? "Er is al een account met dit e-mailadres." : error.message },
        bestaat ? 409 : 400
      );
    }

    /* Het profiel is al aangemaakt door de trigger op auth.users; hier komt
       alleen de rol erbij, want die weet de trigger niet. */
    const { error: profielFout } = await beheer
      .from("profiles")
      .update({ naam, rol, actief: true })
      .eq("id", nieuw.user.id);

    if (profielFout) return antwoord({ fout: profielFout.message }, 400);

    return antwoord({ id: nieuw.user.id });
  }

  if (actie === "wachtwoord") {
    const id = String(opdracht.gebruiker_id ?? "");
    const wachtwoord = String(opdracht.wachtwoord ?? "");
    if (!id) return antwoord({ fout: "Geen gebruiker opgegeven." }, 400);
    if (wachtwoord.length < 8) return antwoord({ fout: "Een wachtwoord is minstens 8 tekens." }, 400);

    const { error } = await beheer.auth.admin.updateUserById(id, { password: wachtwoord });
    if (error) return antwoord({ fout: error.message }, 400);
    return antwoord({ gelukt: true });
  }

  if (actie === "toegang") {
    const id = String(opdracht.gebruiker_id ?? "");
    const actief = Boolean(opdracht.actief);
    if (!id) return antwoord({ fout: "Geen gebruiker opgegeven." }, 400);

    /* Een beheerder die zichzelf buitensluit kan niemand meer binnenlaten. */
    if (id === gebruikerData.user.id && !actief) {
      return antwoord({ fout: "Je kunt je eigen toegang niet intrekken." }, 400);
    }

    const { error } = await beheer.auth.admin.updateUserById(id, {
      ban_duration: actief ? "none" : VOORGOED,
    });
    if (error) return antwoord({ fout: error.message }, 400);

    /* De blokkade staat in auth; `profiles.actief` is de kopie waar de app
       op filtert en sorteert. Loopt die uiteen, dan klopt het scherm niet
       meer met de werkelijkheid — dus altijd allebei. */
    const { error: profielFout } = await beheer.from("profiles").update({ actief }).eq("id", id);
    if (profielFout) return antwoord({ fout: profielFout.message }, 400);

    return antwoord({ gelukt: true });
  }

  return antwoord({ fout: "Onbekende actie." }, 400);
});
