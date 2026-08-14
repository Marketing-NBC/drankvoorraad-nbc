-- ═══════════════════════════════════════════════════════════════════
-- Fase 2 — magazijnbeheer
-- Draai dit ná schema.sql en seed.sql, ook één keer.
--
-- Waarom een aparte functie voor de minimumvoorraad?
-- De kolom `aantal` in `voorraad` mag NOOIT rechtstreeks bewerkt worden —
-- die wordt uitsluitend bijgewerkt door de mutatie-trigger, zodat de stand
-- altijd het optelsom van het audit trail blijft. `min_voorraad` is puur een
-- instelling en mag wél gezet worden, dus dat gaat via deze functie.
-- ═══════════════════════════════════════════════════════════════════

create or replace function stel_min_voorraad(
  p_locatie_id uuid,
  p_product_id uuid,
  p_min_voorraad integer
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if huidige_rol() not in ('beheerder', 'magazijnmedewerker') then
    raise exception 'Geen rechten om de minimumvoorraad aan te passen.';
  end if;

  if p_min_voorraad < 0 then
    raise exception 'Minimumvoorraad kan niet negatief zijn.';
  end if;

  insert into voorraad (locatie_id, product_id, aantal, min_voorraad)
  values (p_locatie_id, p_product_id, 0, p_min_voorraad)
  on conflict (locatie_id, product_id)
    do update set min_voorraad = p_min_voorraad;
end;
$$;

-- Locaties mogen ook door magazijnmedewerkers bekeken worden (stond al goed),
-- maar alleen de beheerder past ze aan — die policy staat al in schema.sql.

-- Realtime voor locaties zodat een nieuw aangemaakte locatie meteen
-- op andere apparaten verschijnt.
alter publication supabase_realtime add table locaties;
