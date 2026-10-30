-- ═══════════════════════════════════════════════════════════════════
-- 034 — emballage telt mee als de voorraad met een telling binnenkomt
--
-- Robin voert de drankvoorraad in met een telling, niet als inkoop. In
-- 030 ving de beginstand dat op: één keer, op het moment dat 030 draaide,
-- werd de emballage uit de drankvoorraad afgeleid. Daarna telde alleen de
-- inkoop nog mee.
--
-- Dat gaat mis zodra de beginstand weg is. Zet de beheerder de voorraad
-- terug naar een moment vóór de beginstand (032/033), dan gaat die eruit,
-- en wie daarna de voorraad opnieuw met een telling invoert, ziet de
-- kratten, fusten en PET-flessen die erbij horen niet terug in de stand.
-- Dat is op productie gebeurd (terugzetting naar 21-10, nieuwe telling op
-- 30-10).
--
-- Nu telt `binnen` naast de inkoop ook de correcties mee: wat er met een
-- telling (of een correctie met de hand) aan drank bijkomt, kwam in een
-- krat, fust of PET-fles; wat er zo afgaat, is er met zijn emballage niet
-- meer. Netto, dus een telfout die later rechtgezet wordt valt weg.
--
-- Wat níét meetelt, net als voorheen:
--   - uitgifte, verplaatsen en personeelsverbruik: de emballage blijft van
--     ons tot de leverancier hem ophaalt;
--   - `beschadigd` (over datum, kapot): de fles gaat weg, de krat blijft.
--
-- Afronden blijft zoals in 030: per soort naar beneden, over alles samen.
-- En zoals in 030 telt alleen wat ná een eventuele beginstand geboekt is.
--
-- Herhaalbaar: `create or replace`.
-- ═══════════════════════════════════════════════════════════════════

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
  -- Inkoop komt altijd binnen; een correctie heeft óf een naar-locatie
  -- (erbij) óf een van-locatie (eraf).
  drank as (
    select m.product_id, m.datum_tijd,
           case when m.type = 'correctie' and m.naar_locatie_id is null then -m.aantal else m.aantal end as stuks
    from mutaties m
    where m.type in ('inkoop', 'correctie')
  ),
  binnen as (
    select
      p.emballage_id,
      floor(sum(
        d.stuks::numeric
        / case when p.emballage_per = 'verpakking' then greatest(p.stuks_per_verpakking, 1) else 1 end
      ))::integer as aantal
    from drank d
    join producten p on p.id = d.product_id
    cross join begin_moment b
    where d.datum_tijd > b.vanaf
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

-- ─── Controle ─────────────────────────────────────────────────────
select e.naam, s.binnen, s.handmatig, s.retour, s.in_huis
from emballage_stand() s join emballage e on e.id = s.emballage_id
order by e.naam;
