-- ═══════════════════════════════════════════════════════════════════
-- 019 — bedragen alleen voor de beheerder
--
-- Inkoopprijzen, statiegeld en omzet waren voor iedereen leesbaar. Alleen
-- de beheerder hoort bedragen en marges te zien. Een scherm dat ze
-- verbergt is geen afscherming — wie de API aanroept krijgt ze dan nog
-- steeds. Daarom gaat het hier net als bij het e-mailadres in 017:
--
--   * de geldkolommen worden ingetrokken voor `authenticated`;
--   * de rest van de kolommen wordt per kolom teruggegeven;
--   * de beheerder leest en zet bedragen via vier functies die zelf
--     controleren of de aanvrager beheerder is.
--
-- Boeken blijft voor alle drie de rollen open: ook de evenementmanager
-- boekt. Daar verandert deze migratie niets aan.
--
-- NOG NIET DRAAIEN zolang de app niet is bijgewerkt: de huidige app leest
-- `select *` op deze tabellen en laadt na deze migratie niet meer.
--
-- Let op voor later: een NIEUWE kolom op `producten` of `evenementen` is
-- na deze migratie niet vanzelf leesbaar. Geef hem in dezelfde migratie
-- een `grant select (kolom)` (en zo nodig insert/update), anders faalt
-- het laden van de app voor iedereen.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Geldkolommen afschermen ───────────────────────────────────
-- Volgorde zoals in 017: eerst op tabelniveau intrekken, dan per kolom
-- teruggeven. Een grant op tabelniveau overschaduwt elke kolominstelling.
revoke select, insert, update on public.producten from authenticated;
grant select (
  id, naam, sku, barcode, categorie, leverancier, eenheid, inhoud, verpakking,
  stuks_per_verpakking, alleen_per_verpakking, voorraadloos, aangemaakt_op
) on public.producten to authenticated;
grant insert (
  naam, sku, barcode, categorie, leverancier, eenheid, inhoud, verpakking,
  stuks_per_verpakking, alleen_per_verpakking, voorraadloos
) on public.producten to authenticated;
grant update (
  naam, sku, barcode, categorie, leverancier, eenheid, inhoud, verpakking,
  stuks_per_verpakking, alleen_per_verpakking, voorraadloos
) on public.producten to authenticated;

revoke select, insert, update on public.evenementen from authenticated;
grant select (id, naam, datum, merk, opdrachtgever, status, aangemaakt_op)
  on public.evenementen to authenticated;
grant insert (id, naam, datum, merk, opdrachtgever, status)
  on public.evenementen to authenticated;
grant update (naam, datum, merk, opdrachtgever, status)
  on public.evenementen to authenticated;

-- ─── Lezen: alleen voor de beheerder ──────────────────────────────
create or replace function productbedragen()
returns table (
  id uuid,
  inkoopprijs numeric,
  statiegeld_per_stuk numeric,
  statiegeld_per_verpakking numeric
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not is_beheerder() then
    raise exception 'Alleen een beheerder ziet bedragen.';
  end if;

  return query
    select p.id, p.inkoopprijs, p.statiegeld_per_stuk, p.statiegeld_per_verpakking
    from producten p;
end;
$$;

create or replace function evenementomzet()
returns table (id text, omzet numeric)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not is_beheerder() then
    raise exception 'Alleen een beheerder ziet omzet.';
  end if;

  return query select e.id, e.omzet from evenementen e;
end;
$$;

-- ─── Schrijven: alleen voor de beheerder ──────────────────────────
create or replace function stel_productbedragen(
  p_product_id uuid,
  p_inkoopprijs numeric,
  p_statiegeld_per_stuk numeric,
  p_statiegeld_per_verpakking numeric
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_beheerder() then
    raise exception 'Alleen een beheerder past bedragen aan.';
  end if;
  if p_inkoopprijs < 0 or p_statiegeld_per_stuk < 0 or p_statiegeld_per_verpakking < 0 then
    raise exception 'Bedragen kunnen niet negatief zijn.';
  end if;

  update producten
  set inkoopprijs = p_inkoopprijs,
      statiegeld_per_stuk = p_statiegeld_per_stuk,
      statiegeld_per_verpakking = p_statiegeld_per_verpakking
  where id = p_product_id;

  if not found then
    raise exception 'Product bestaat niet.';
  end if;
end;
$$;

create or replace function stel_omzet(p_evenement_id text, p_omzet numeric)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not is_beheerder() then
    raise exception 'Alleen een beheerder vult de omzet in.';
  end if;
  if p_omzet < 0 then
    raise exception 'Omzet kan niet negatief zijn.';
  end if;

  update evenementen set omzet = p_omzet where id = p_evenement_id;

  if not found then
    raise exception 'Evenement bestaat niet.';
  end if;
end;
$$;

-- ─── Controle ─────────────────────────────────────────────────────
-- Moet voor beide tabellen false geven: geen gewone gebruiker leest geld.
select
  has_column_privilege('authenticated', 'public.producten', 'inkoopprijs', 'select') as inkoopprijs_leesbaar,
  has_column_privilege('authenticated', 'public.evenementen', 'omzet', 'select')     as omzet_leesbaar;
