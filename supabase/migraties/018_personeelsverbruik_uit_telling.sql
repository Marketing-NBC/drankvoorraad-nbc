-- ═══════════════════════════════════════════════════════════════════
-- 018 — in de kantine en de kroeg meet de telling het verbruik
--
-- Niemand gaat achter de bar bijhouden wie wat pakt. Wat er opgaat blijkt
-- uit de telling: er ging 96 in, er staat nog 36, dus er is 60 doorheen.
--
-- Daarom boekt een telling op een personeelslocatie een tekort voortaan
-- als `personeelsverbruik` in plaats van als `correctie`. Dat is geen
-- cosmetisch verschil:
--
--   * Het personeelsverbruik komt zo vanzelf in de cijfers terecht, zonder
--     dat iemand iets dubbel invoert.
--   * Het rapport met telverschillen blijft gaan over wat het hoort te
--     zijn: voorraad die zoek is. Zou gewoon leegdrinken daar als
--     "verschil" tussen staan, dan wordt dat rapport betekenisloos en kijkt
--     niemand er meer naar.
--
-- Een overschot blijft wél een correctie. Meer vinden dan verwacht is geen
-- verbruik maar een telfout of een aanvulling die niet geboekt is, en dat
-- is precies iets waar je naar wilt kunnen kijken.
--
-- Op alle andere locaties verandert er niets.
-- ═══════════════════════════════════════════════════════════════════

create or replace function rond_telling_af(p_telling_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_locatie_id uuid;
  v_status telling_status;
  v_voor_personeel boolean;
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

  select voor_personeel into v_voor_personeel from locaties where id = v_locatie_id;
  v_voor_personeel := coalesce(v_voor_personeel, false);

  for v_regel in
    select product_id, geteld_aantal
    from tellingregels
    where telling_id = p_telling_id and geteld_aantal is not null
  loop
    -- Let op: tegen de HUIDIGE voorraad, niet tegen de momentopname bij het
    -- starten. Heeft iemand tijdens het tellen nog iets geboekt, dan zou
    -- rekenen met de oude stand dat ongedaan maken.
    select coalesce(aantal, 0) into v_huidig
    from voorraad
    where locatie_id = v_locatie_id and product_id = v_regel.product_id;

    v_huidig := coalesce(v_huidig, 0);
    v_verschil := v_regel.geteld_aantal - v_huidig;

    if v_verschil <> 0 then
      if v_voor_personeel and v_verschil < 0 then
        insert into mutaties (product_id, aantal, type, van_locatie_id, gebruiker_id, notitie)
        values (
          v_regel.product_id,
          abs(v_verschil),
          'personeelsverbruik',
          v_locatie_id,
          auth.uid(),
          'Uit telling'
        );
      else
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
      end if;
      v_aantal_correcties := v_aantal_correcties + 1;
    end if;
  end loop;

  update tellingen
  set status = 'afgerond', afgerond_op = now()
  where id = p_telling_id;

  return v_aantal_correcties;
end;
$$;

-- ─── Controle ─────────────────────────────────────────────────────
select l.naam, m.type, count(*) as boekingen
from mutaties m
join locaties l on l.id = m.van_locatie_id
where m.notitie in ('Uit telling', 'Voorraadtelling')
group by l.naam, m.type
order by l.naam;
