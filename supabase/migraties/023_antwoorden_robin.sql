-- ═══════════════════════════════════════════════════════════════════
-- 023 — antwoorden van Robin op de openstaande vragen uit 020 en 021
--
--   * Fust Swinckels 0%: inkoopprijs € 93,21 (stond voorlopig op € 40,70).
--   * Bar HOS 1: 24 Jus d'orange in plaats van 21.
--   * Emballage erbij: blikjes, rolcontainer en koolzuurcilinder.
--
-- Bevestigd en daarom niet gewijzigd: een doos wijn of mocktail is 6
-- flessen, "Cava" is Prosecco, de Coca Cola op de bars is de 1,25 L, en de
-- borg op de vijf bestaande soorten emballage klopt.
--
-- Leverancier van de nieuwe soorten is 'Overig': Robin noemde alleen de
-- borg. Het scherm Emballage retour groepeert per leverancier, dus een
-- soort zonder leverancier zou daar niet te kiezen zijn. Past de
-- leverancier niet, dan zet een volgende migratie hem recht.
--
-- Een migratie die 020 of 021 aanpast kan niet: die zijn al gedraaid.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Inkoopprijs fust 0% ──────────────────────────────────────────
update producten
set inkoopprijs = 93.21
where lower(naam) = lower('Fust Swinckels 0% 20 L');

-- ─── Jus d'orange op Bar HOS 1 ────────────────────────────────────
update vulplek_standaard s
set aantal = 24
from vulplekken vp, producten p
where vp.id = s.vulplek_id
  and p.id = s.product_id
  and vp.naam = 'Bar HOS 1'
  and lower(p.naam) = lower('Jus d''orange 0,2 L');

-- ─── Nieuwe soorten emballage ─────────────────────────────────────
-- Borg per stuk: één blikje, één rolcontainer, één cilinder.
insert into emballage (naam, leverancier, borg) values
  ('Blikje',            'Overig',   0.10),
  ('Rolcontainer',      'Overig', 150.00),
  ('Koolzuurcilinder',  'Overig', 180.00)
on conflict (naam) do update set
  borg   = excluded.borg,
  actief = true;

-- ─── Controle ─────────────────────────────────────────────────────
select naam, inkoopprijs from producten where lower(naam) = lower('Fust Swinckels 0% 20 L');
select vp.naam as vulplek, p.naam as product, s.aantal
from vulplek_standaard s
join vulplekken vp on vp.id = s.vulplek_id
join producten p on p.id = s.product_id
where vp.naam = 'Bar HOS 1' and lower(p.naam) like 'jus%';
select naam, leverancier, borg, actief from emballage where actief order by leverancier, naam;
