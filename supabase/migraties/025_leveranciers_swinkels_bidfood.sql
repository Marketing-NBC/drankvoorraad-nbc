-- ═══════════════════════════════════════════════════════════════════
-- 025 — twee leveranciers: Swinkels en Bidfood
--
-- Robin: de enige leveranciers die we hier hebben zijn Swinkels en
-- Bidfood. De emballage-retourbon van Swinkels gaat over al het bier en
-- wat daarbij hoort; al het andere loopt via Bidfood.
--
--   * Alles dat op Coca-Cola of Spadel stond, is nu Bidfood. Dat geldt
--     voor de emballage én voor de producten.
--   * Blikje en Rolcontainer: Bidfood.
--   * Koolzuurcilinder: Swinkels — hij hoort bij de bierfusten.
--
-- VOORLOPIG: de leverancier van Blikje, Rolcontainer en Koolzuurcilinder
-- is een aanname; Robin noemde alleen de borg. Klopt het niet, dan zet
-- een volgende migratie het recht.
--
-- Niet aangeraakt: Franke en Aquablu. Dat zijn machines voor koffie en
-- water (013), geen leveranciers van drank.
-- ═══════════════════════════════════════════════════════════════════

update emballage
set leverancier = 'Bidfood'
where leverancier in ('Coca-Cola', 'Spadel', 'Overig')
  and naam <> 'Koolzuurcilinder';

update emballage
set leverancier = 'Swinkels'
where naam = 'Koolzuurcilinder';

update producten
set leverancier = 'Bidfood'
where leverancier in ('Coca-Cola', 'Spadel');

-- ─── Controle ─────────────────────────────────────────────────────
select naam, leverancier, actief from emballage where actief order by leverancier, naam;
select leverancier, count(*) from producten group by 1 order by 1;
