-- ═══════════════════════════════════════════════════════════════════
-- Fase 5 — voorraadtellingen (inventarisatie)
-- Draai dit ná schema.sql, seed.sql en fase2.sql. Eén keer.
--
-- Twee functies, allebei security definer en in één transactie, zodat een
-- telling nooit half wordt toegepast: óf alle correcties worden geboekt,
-- óf geen enkele.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Telling starten ──────────────────────────────────────────────
-- Maakt een telling voor één locatie en zet er direct een regel in voor
-- elk product, met de op dat moment verwachte voorraad als momentopname.
create or replace function start_telling(p_locatie_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_telling_id uuid;
begin
  if huidige_rol() not in ('beheerder', 'magazijnmedewerker') then
    raise exception 'Geen rechten om een telling te starten.';
  end if;

  if exists (select 1 from tellingen where locatie_id = p_locatie_id and status = 'open') then
    raise exception 'Er loopt al een telling voor deze locatie.';
  end if;

  insert into tellingen (locatie_id, gebruiker_id)
  values (p_locatie_id, auth.uid())
  returning id into v_telling_id;

  insert into tellingregels (telling_id, product_id, verwacht_aantal)
  select v_telling_id, p.id, coalesce(v.aantal, 0)
  from producten p
  left join voorraad v on v.product_id = p.id and v.locatie_id = p_locatie_id;

  return v_telling_id;
end;
$$;

-- ─── Telling afronden ─────────────────────────────────────────────
-- Boekt voor elk geteld product een correctie zodat de voorraad exact op
-- het getelde aantal uitkomt.
--
-- Let op: de correctie wordt berekend tegen de HUIDIGE voorraad, niet tegen
-- de momentopname bij het starten. Als iemand tijdens het tellen nog iets
-- heeft uitgegeven, zou rekenen met de oude stand dat namelijk ongedaan
-- maken. Producten die niet geteld zijn (geteld_aantal is null) blijven
-- ongemoeid.
create or replace function rond_telling_af(p_telling_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_locatie_id uuid;
  v_status telling_status;
  v_regel record;
  v_huidig integer;
  v_verschil integer;
  v_aantal_correcties integer := 0;
begin
  if huidige_rol() not in ('beheerder', 'magazijnmedewerker') then
    raise exception 'Geen rechten om een telling af te ronden.';
  end if;

  select locatie_id, status into v_locatie_id, v_status
  from tellingen where id = p_telling_id
  for update;

  if v_locatie_id is null then
    raise exception 'Telling bestaat niet.';
  end if;
  if v_status <> 'open' then
    raise exception 'Deze telling is al afgerond.';
  end if;

  for v_regel in
    select product_id, geteld_aantal
    from tellingregels
    where telling_id = p_telling_id and geteld_aantal is not null
  loop
    select coalesce(aantal, 0) into v_huidig
    from voorraad
    where locatie_id = v_locatie_id and product_id = v_regel.product_id;

    v_huidig := coalesce(v_huidig, 0);
    v_verschil := v_regel.geteld_aantal - v_huidig;

    if v_verschil <> 0 then
      insert into mutaties (product_id, aantal, type, van_locatie_id, naar_locatie_id, gebruiker_id, notitie)
      values (
        v_regel.product_id,
        abs(v_verschil),
        'correctie',
        case when v_verschil < 0 then v_locatie_id else null end,
        case when v_verschil > 0 then v_locatie_id else null end,
        auth.uid(),
        'Voorraadtelling'
      );
      v_aantal_correcties := v_aantal_correcties + 1;
    end if;
  end loop;

  update tellingen
  set status = 'afgerond', afgerond_op = now()
  where id = p_telling_id;

  return v_aantal_correcties;
end;
$$;

-- ─── Telling annuleren ────────────────────────────────────────────
-- Verwijdert een lopende telling zonder correcties te boeken.
create or replace function annuleer_telling(p_telling_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if huidige_rol() not in ('beheerder', 'magazijnmedewerker') then
    raise exception 'Geen rechten om een telling te annuleren.';
  end if;

  delete from tellingen where id = p_telling_id and status = 'open';
end;
$$;

-- ─── Realtime ─────────────────────────────────────────────────────
alter publication supabase_realtime add table tellingen;
alter publication supabase_realtime add table tellingregels;
