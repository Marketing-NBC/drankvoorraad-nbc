-- ═══════════════════════════════════════════════════════════════════
-- Fase 6 — digitale pakbonnen (overdracht magazijn → evenement)
-- Draai dit ná schema.sql, seed.sql, fase2.sql en fase5.sql. Eén keer.
--
-- Een pakbon is één overdrachtsmoment met meerdere producten erop, plus
-- de naam en handtekening van degene die ze in ontvangst neemt. De
-- bijbehorende voorraadmutaties dragen allemaal hetzelfde pakbon_id, zodat
-- een pakbon achteraf exact te reconstrueren is uit het audit trail.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Pakbon vastleggen ────────────────────────────────────────────
-- Pakbon + alle regels in één transactie: een pakbon zonder producten of
-- uitgeboekte producten zonder pakbon kan zo niet ontstaan.
--
-- p_regels is een json-array: [{"product_id": "…", "aantal": 3}, …]
create or replace function maak_pakbon(
  p_evenement_id text,
  p_van_locatie_id uuid,
  p_ontvanger_naam text,
  p_handtekening text,
  p_regels jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_pakbon_id uuid;
  v_regel record;
  v_aantal_regels integer;
begin
  if huidige_rol() not in ('beheerder', 'magazijnmedewerker') then
    raise exception 'Geen rechten om een pakbon vast te leggen.';
  end if;

  if not exists (select 1 from evenementen where id = p_evenement_id) then
    raise exception 'Evenement bestaat niet.';
  end if;

  if not exists (select 1 from locaties where id = p_van_locatie_id) then
    raise exception 'Locatie bestaat niet.';
  end if;

  if coalesce(trim(p_ontvanger_naam), '') = '' then
    raise exception 'Vul de naam van de ontvanger in.';
  end if;

  select count(*) into v_aantal_regels
  from jsonb_array_elements(coalesce(p_regels, '[]'::jsonb));

  if v_aantal_regels = 0 then
    raise exception 'Een pakbon heeft minstens één product nodig.';
  end if;

  -- Alle regels vooraf controleren. Een ongeldige regel halverwege zou
  -- anders de hele transactie terugdraaien nádat er al mutaties geboekt zijn
  -- — functioneel hetzelfde, maar de foutmelding is zo een stuk duidelijker.
  for v_regel in
    select
      (waarde ->> 'product_id')::uuid as product_id,
      (waarde ->> 'aantal')::integer  as aantal
    from jsonb_array_elements(p_regels) as waarde
  loop
    if v_regel.aantal is null or v_regel.aantal <= 0 then
      raise exception 'Elk product op de pakbon heeft een aantal groter dan 0 nodig.';
    end if;
    if not exists (select 1 from producten where id = v_regel.product_id) then
      raise exception 'Product bestaat niet.';
    end if;
  end loop;

  insert into pakbonnen (evenement_id, van_locatie_id, ontvanger_naam, handtekening, gebruiker_id)
  values (
    p_evenement_id,
    p_van_locatie_id,
    trim(p_ontvanger_naam),
    nullif(p_handtekening, ''),
    auth.uid()
  )
  returning id into v_pakbon_id;

  -- De trigger op mutaties werkt de voorraad bij; hier alleen boeken.
  insert into mutaties (
    product_id, aantal, type, van_locatie_id, evenement_id, pakbon_id, gebruiker_id, notitie
  )
  select
    (waarde ->> 'product_id')::uuid,
    (waarde ->> 'aantal')::integer,
    'magazijn-naar-evenement',
    p_van_locatie_id,
    p_evenement_id,
    v_pakbon_id,
    auth.uid(),
    'Pakbon'
  from jsonb_array_elements(p_regels) as waarde;

  return v_pakbon_id;
end;
$$;

-- ─── Realtime ─────────────────────────────────────────────────────
alter publication supabase_realtime add table pakbonnen;
