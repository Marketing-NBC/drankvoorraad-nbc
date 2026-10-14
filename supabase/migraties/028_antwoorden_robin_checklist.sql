-- ═══════════════════════════════════════════════════════════════════
-- 028 — antwoorden van Robin op de checklist na 027
--
--   * Swinkels levert in principe alles; Bidfood alleen bij een tekort,
--     omdat die dagelijks kan uitleveren. Spa en het blikje gaan dus ook
--     naar Swinkels. Bidfood blijft een geldige leverancier bij een
--     levering (027).
--   * Chaudfontaine blauw op de bon van Swinkels (art. 205570, krat
--     12 × 1 L) is wat wij Spa blauw noemen. Die krat gaat terug als
--     "krat fris handel 8 t/m 28 vaks" (800163); de aparte Spa-krat is
--     daarom niet meer nodig. Hij is nooit gebruikt, dus uitzetten
--     verliest niets.
--   * Geen Prosecco in de kantine en de kroeg.
--
-- Bevestigd en ongewijzigd: borg koolzuurcilinder € 120, big bag PET op
-- € 0 (de fabriek weegt hem en bepaalt dan pas de waarde), PET-fles
-- € 0,25 (gaat in de big bag mee), Fanta Zero = "Fanta 0,2 L", Minute
-- Maid = "Jus d'orange 0,2 L", bierkrat op regel 800022.
--
-- Glazen wijn van 125 ml (in plaats van 25 cl) zit in de app, niet in
-- de database: zie app/src/data/consumpties.ts.
-- ═══════════════════════════════════════════════════════════════════

update producten set leverancier = 'Swinkels'
where naam in ('Spa blauw 1 L', 'Spa rood 1 L') and leverancier = 'Bidfood';

update emballage set leverancier = 'Swinkels'
where naam = 'Blikje' and leverancier = 'Bidfood';

update emballage set actief = false
where naam = 'Krat Spa 12 × 1 L';

insert into leverancier_artikelen (leverancier, artikelnummer, omschrijving, product_id, stuks_per_eenheid)
select 'Swinkels', '205570', 'Chaudf. Blauw Crate 12x100', p.id, 12
from producten p
where p.naam = 'Spa blauw 1 L'
on conflict (leverancier, artikelnummer) do nothing;

update producten set voor_personeel = false
where naam in ('Prosecco 0,7 L', 'Prosecco 0% 0,7 L');

-- ─── Controle ─────────────────────────────────────────────────────
select leverancier, count(*) from producten group by 1 order by 1;
select naam, leverancier, actief from emballage order by actief desc, naam;
select naam from producten where voor_personeel order by naam;
