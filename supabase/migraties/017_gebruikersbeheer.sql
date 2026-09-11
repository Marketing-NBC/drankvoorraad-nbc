-- ═══════════════════════════════════════════════════════════════════
-- 017 — gebruikers beheren vanuit de app
--
-- Jullie moeten accounts kunnen aanmaken zonder in het Supabase-dashboard
-- te komen. Aanmaken, een wachtwoord opnieuw zetten en toegang intrekken
-- kan alleen met de servicesleutel, en die hoort nooit in een browser.
-- Daarom doet een Edge Function dat werk (supabase/functions/gebruikers);
-- wat hier staat is het deel dat de database zelf moet regelen.
--
-- Drie dingen:
--
--   1. Het e-mailadres komt in `profiles` te staan. Anders is in de app
--      niet te zien onder welke inlognaam iemand bekend is — dat staat in
--      auth.users, en daar mag een ingelogde gebruiker niet bij.
--
--   2. Dat adres is NIET voor iedereen zichtbaar. De kolom wordt ingetrokken
--      voor gewone gebruikers en alleen via een functie teruggegeven aan een
--      beheerder. Namen mag iedereen zien — die staan bij elke boeking —
--      maar een lijst met alle adressen van collega's is iets anders.
--
--   3. `actief` laat zien of iemand nog in kan loggen. De werkelijke
--      blokkade zet de Edge Function in auth; dit is de kopie waar de app
--      op kan filteren en sorteren.
-- ═══════════════════════════════════════════════════════════════════

alter table profiles
  add column if not exists email  text,
  add column if not exists actief boolean not null default true;

comment on column profiles.email is
  'Inlognaam. Alleen zichtbaar voor een beheerder, via gebruikers_overzicht().';
comment on column profiles.actief is
  'False = toegang ingetrokken. De echte blokkade staat in auth; dit is de kopie voor de app.';

-- Bestaande profielen bijwerken.
update profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

-- Nieuwe accounts krijgen het adres er meteen bij.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, naam, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'naam', new.email),
    new.email
  );
  return new;
end;
$$;

-- ─── Het adres afschermen ─────────────────────────────────────────
-- Let op de volgorde: eerst de select op de hele tabel intrekken, dan per
-- kolom teruggeven. Andersom werkt niet — een grant op tabelniveau
-- overschaduwt elke kolominstelling.
revoke select on public.profiles from authenticated;
grant select (id, naam, rol, actief, aangemaakt_op) on public.profiles to authenticated;

-- ─── De lijst voor de beheerder ───────────────────────────────────
create or replace function gebruikers_overzicht()
returns table (
  id uuid,
  naam text,
  rol gebruiker_rol,
  email text,
  actief boolean,
  aangemaakt_op timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not is_beheerder() then
    raise exception 'Alleen een beheerder ziet de gebruikerslijst.';
  end if;

  return query
    select p.id, p.naam, p.rol, p.email, p.actief, p.aangemaakt_op
    from profiles p
    order by p.naam;
end;
$$;

-- ─── Controle ─────────────────────────────────────────────────────
select count(*) as profielen, count(email) as met_adres, count(*) filter (where not actief) as geblokkeerd
from profiles;
