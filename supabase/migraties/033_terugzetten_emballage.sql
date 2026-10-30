-- ═══════════════════════════════════════════════════════════════════
-- 033 — terugzetten neemt de emballage mee
--
-- In 032 bleef de emballage staan bij het terugzetten, en telde de
-- teruggezette inkoop er zelfs nog in mee. Maar wie de drank terugzet en
-- opnieuw telt, wil dat de emballage daarbij past: anders staan er
-- kratten in huis bij drank die er niet meer is.
--
-- Nu gaat bij `zet_terug` vanaf hetzelfde moment ook de emballage eruit:
--   - alle regels in `emballage_mutaties` (beginstand, invoer met de
--     hand, tellingen en retourregels);
--   - de retourbonnen van na dat moment, met al hun regels.
-- Ze komen als JSON in `terugzettingen.verwijderd`; echt kwijt raakt
-- niets. En `emballage_stand` telt weer alleen de inkoop in `mutaties`,
-- zoals in 030: wat teruggezet is, telt niet meer.
--
-- Zet de beheerder terug naar vóór de beginstand (030), dan gaat ook die
-- eruit en staat alle emballage op nul. Daarna tellen: Magazijn →
-- Emballage → Tellen.
--
-- Herhaalbaar: `if not exists` en `create or replace`.
-- ═══════════════════════════════════════════════════════════════════

alter table terugzettingen add column if not exists aantal_emballage integer not null default 0;

-- ─── Vooraf kijken wat er gebeurt ─────────────────────────────────
create or replace function terugzetten_overzicht(p_vanaf timestamptz, p_evenementen boolean)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if not is_beheerder() then
    raise exception 'Alleen de beheerder kan de voorraad terugzetten.';
  end if;
  if p_vanaf is null then
    raise exception 'Kies vanaf wanneer.';
  end if;

  return jsonb_build_object(
    'mutaties', (select count(*) from mutaties where datum_tijd >= p_vanaf),
    'pakbonnen', (select count(*) from pakbonnen where aangemaakt_op >= p_vanaf),
    'tellingen', (
      select count(*) from tellingen
      where status = 'open' or afgerond_op >= p_vanaf
    ),
    'evenementen', case when p_evenementen then (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'naam', naam, 'datum', datum) order by datum), '[]'::jsonb)
      from evenementen where aangemaakt_op >= p_vanaf
    ) else '[]'::jsonb end,
    'leveringen', (select count(*) from leveringen where aangemaakt_op >= p_vanaf),
    'emballage', (select count(*) from emballage_mutaties where datum_tijd >= p_vanaf),
    'retourbonnen', (select count(*) from emballage_retouren where aangemaakt_op >= p_vanaf),
    'uitgezet_met_voorraad', uitgezet_met_voorraad_na(p_vanaf)
  );
end;
$$;

-- ─── Terugzetten ──────────────────────────────────────────────────
create or replace function zet_terug(p_vanaf timestamptz, p_evenementen boolean, p_reden text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_id uuid;
  v_evenement_ids text[];
  v_pakbon_ids uuid[];
  v_telling_ids uuid[];
  v_mutaties integer;
  v_emballage integer;
  v_retour_ids uuid[];
  v_uitgezet text;
begin
  if not is_beheerder() then
    raise exception 'Alleen de beheerder kan de voorraad terugzetten.';
  end if;
  if p_vanaf is null then
    raise exception 'Kies vanaf wanneer.';
  end if;
  if p_vanaf > now() then
    raise exception 'Dat moment ligt in de toekomst.';
  end if;
  if coalesce(trim(p_reden), '') = '' then
    raise exception 'Vul in waarom de voorraad wordt teruggezet.';
  end if;

  -- Niemand boekt tussendoor: een mutatie die halverwege binnenkomt zou
  -- anders net wel of net niet meegaan.
  lock table mutaties in share row exclusive mode;
  lock table emballage_mutaties in share row exclusive mode;

  select coalesce(array_agg(id), '{}') into v_evenement_ids
  from evenementen
  where p_evenementen and aangemaakt_op >= p_vanaf;

  select coalesce(array_agg(id), '{}') into v_pakbon_ids
  from pakbonnen
  where aangemaakt_op >= p_vanaf or evenement_id = any(v_evenement_ids);

  -- Een retourbon gaat er als geheel uit: zijn regels zijn de bon.
  select coalesce(array_agg(id), '{}') into v_retour_ids
  from emballage_retouren
  where aangemaakt_op >= p_vanaf
     or id in (select retour_id from emballage_mutaties where datum_tijd >= p_vanaf and retour_id is not null);

  select coalesce(array_agg(id), '{}') into v_telling_ids
  from tellingen
  where status = 'open' or afgerond_op >= p_vanaf;

  -- Kan een evenement niet weg omdat er van vóór dat moment nog een
  -- mutatie aan hangt? Dat kan alleen als de klok van een boeking vóór
  -- het aanmaken staat. Liever een duidelijke melding dan een halve klus.
  if exists (
    select 1 from mutaties
    where evenement_id = any(v_evenement_ids) and datum_tijd < p_vanaf
  ) then
    raise exception 'Een evenement van na dit moment heeft boekingen van ervoor. Kies een eerder moment.';
  end if;

  v_uitgezet := uitgezet_met_voorraad_na(p_vanaf);
  if v_uitgezet is not null then
    raise exception 'Dan komt er weer voorraad in %, en die locatie is niet meer in gebruik. Kies een later moment, of een moment vóór er iets geboekt was.', v_uitgezet;
  end if;

  insert into terugzettingen (vanaf, reden, gebruiker_id, verwijderd)
  values (
    p_vanaf,
    trim(p_reden),
    auth.uid(),
    jsonb_build_object(
      'evenementen', (
        select coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object(
          'zalen', (select coalesce(jsonb_agg(z.zaal_id), '[]'::jsonb) from evenement_zalen z where z.evenement_id = e.id)
        )), '[]'::jsonb)
        from evenementen e where e.id = any(v_evenement_ids)
      ),
      'pakbonnen', (
        select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
        from pakbonnen p where p.id = any(v_pakbon_ids)
      ),
      'tellingen', (
        select coalesce(jsonb_agg(to_jsonb(t) || jsonb_build_object(
          'regels', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from tellingregels r where r.telling_id = t.id)
        )), '[]'::jsonb)
        from tellingen t where t.id = any(v_telling_ids)
      ),
      'emballage_mutaties', (
        select coalesce(jsonb_agg(to_jsonb(em) order by em.datum_tijd), '[]'::jsonb)
        from emballage_mutaties em
        where em.datum_tijd >= p_vanaf or em.retour_id = any(v_retour_ids)
      ),
      'emballage_retouren', (
        select coalesce(jsonb_agg(to_jsonb(er)), '[]'::jsonb)
        from emballage_retouren er where er.id = any(v_retour_ids)
      )
    )
  )
  returning id into v_id;

  insert into teruggezette_mutaties (mutatie_id, terugzetting_id, product_id, type, aantal, datum_tijd, rij)
  select m.id, v_id, m.product_id, m.type, m.aantal, m.datum_tijd, to_jsonb(m)
  from mutaties m
  where m.datum_tijd >= p_vanaf;
  get diagnostics v_mutaties = row_count;

  -- De trigger `mutaties_verwijderd` zet de voorraad terug.
  delete from mutaties where datum_tijd >= p_vanaf;

  -- Emballage: alles vanaf dat moment eruit, ook de beginstand als die
  -- erna ligt. Dan staat de emballage weer zoals hij toen was, net als
  -- de drank, en tel je hem daarna opnieuw onder Magazijn → Emballage.
  delete from emballage_mutaties
  where datum_tijd >= p_vanaf or retour_id = any(v_retour_ids);
  get diagnostics v_emballage = row_count;
  delete from emballage_retouren where id = any(v_retour_ids);

  delete from pakbonnen where id = any(v_pakbon_ids);
  delete from tellingen where id = any(v_telling_ids);
  delete from evenementen where id = any(v_evenement_ids);

  update terugzettingen
  set aantal_mutaties = v_mutaties,
      aantal_evenementen = coalesce(array_length(v_evenement_ids, 1), 0),
      aantal_pakbonnen = coalesce(array_length(v_pakbon_ids, 1), 0),
      aantal_tellingen = coalesce(array_length(v_telling_ids, 1), 0),
      aantal_emballage = v_emballage
  where id = v_id;

  return jsonb_build_object(
    'mutaties', v_mutaties,
    'evenementen', coalesce(array_length(v_evenement_ids, 1), 0),
    'pakbonnen', coalesce(array_length(v_pakbon_ids, 1), 0),
    'tellingen', coalesce(array_length(v_telling_ids, 1), 0),
    'emballage', v_emballage
  );
end;
$$;

revoke execute on function terugzetten_overzicht(timestamptz, boolean) from public, anon;
revoke execute on function zet_terug(timestamptz, boolean, text) from public, anon;
grant execute on function terugzetten_overzicht(timestamptz, boolean) to authenticated;
grant execute on function zet_terug(timestamptz, boolean, text) to authenticated;

-- ─── Emballage: weer zoals in 030 ─────────────────────────────────
create or replace function emballage_stand()
returns table (
  emballage_id uuid,
  binnen integer,
  handmatig integer,
  retour integer,
  in_huis integer
)
language sql
stable
security definer set search_path = public
as $$
  with begin_moment as (
    select coalesce(max(datum_tijd), '-infinity'::timestamptz) as vanaf
    from emballage_mutaties
    where notitie = 'Beginstand uit de drankvoorraad'
  ),
  binnen as (
    select
      p.emballage_id,
      floor(sum(
        m.aantal::numeric
        / case when p.emballage_per = 'verpakking' then greatest(p.stuks_per_verpakking, 1) else 1 end
      ))::integer as aantal
    from mutaties m
    join producten p on p.id = m.product_id
    cross join begin_moment b
    where m.type = 'inkoop'
      and m.datum_tijd > b.vanaf
      and p.emballage_id is not null
    group by p.emballage_id
  ),
  bewegingen as (
    select
      em.emballage_id,
      coalesce(sum(case em.type::text
        when 'erbij' then em.aantal
        when 'eraf' then -em.aantal
        else 0 end), 0)::integer as handmatig,
      coalesce(sum(em.aantal) filter (where em.type = 'naar-leverancier'), 0)::integer as retour
    from emballage_mutaties em
    group by em.emballage_id
  )
  select
    e.id,
    coalesce(b.aantal, 0),
    coalesce(bw.handmatig, 0),
    coalesce(bw.retour, 0),
    coalesce(b.aantal, 0) + coalesce(bw.handmatig, 0) - coalesce(bw.retour, 0)
  from emballage e
  left join binnen b on b.emballage_id = e.id
  left join bewegingen bw on bw.emballage_id = e.id;
$$;

revoke execute on function emballage_stand() from public, anon;
grant execute on function emballage_stand() to authenticated;
