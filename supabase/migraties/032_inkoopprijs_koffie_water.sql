-- ═══════════════════════════════════════════════════════════════════
-- 032 — inkoopprijs van koffie en water
--
-- Koffie en water stonden sinds 010 op een inkoopprijs van 0, omdat die
-- nog niet aangeleverd was. Het verbruik uit de machines telde daardoor
-- voor € 0,00 mee in de brutomarge. Nu zijn de gemiddelde prijzen
-- doorgegeven:
--
--   * Koffie € 0,17 per kopje. Een gemiddelde van cappuccino, koffie en
--     thee, dus Thee krijgt dezelfde prijs.
--   * Aquablu € 0,23 per glas, koud en bruis.
--
-- Verder hoeft er niets: de app rekent een meting al om tegen de
-- inkoopprijs van het product achter de machine (`verbruikUitMetingen`)
-- en telt dat mee in de kostprijs van het evenement.
--
-- Herhaalbaar: het zet steeds dezelfde prijs.
-- ═══════════════════════════════════════════════════════════════════

update producten
set inkoopprijs = 0.17
where lower(naam) in ('koffie', 'thee')
  and voorraadloos;

update producten
set inkoopprijs = 0.23
where lower(naam) in ('water koud', 'water bruis')
  and voorraadloos;

-- ─── Controle ─────────────────────────────────────────────────────
select naam, categorie, eenheid, inkoopprijs
from producten
where voorraadloos
order by categorie, naam;
