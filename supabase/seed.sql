-- ═══════════════════════════════════════════════════════════════════
-- Startdata — draai dit ná schema.sql, ook één keer.
-- Bevat de locaties en het productassortiment. Barcodes zijn nog leeg;
-- die koppel je later zelf door ze in de app te scannen.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Locaties ─────────────────────────────────────────────────────
-- Het hoofdmagazijn heeft merk NULL: gedeeld door NBC én Green Village.
insert into locaties (naam, type, merk) values
  ('Hoofdmagazijn',        'magazijn', null),
  ('Koelcel NBC',          'koelcel',  'NBC'),
  ('Bar NBC',              'bar',      'NBC'),
  ('Koelcel Green Village','koelcel',  'Green Village'),
  ('Bar Green Village',    'bar',      'Green Village');

-- ─── Producten ────────────────────────────────────────────────────
insert into producten (naam, categorie, inkoopprijs, verkoopprijs, eenheid) values
  ('Heineken Pils fust 50L',    'bier',         85.00, 180.00, 'fust'),
  ('Amstel Radler blik',        'bier',          0.55,   3.00, 'blik'),
  ('Chardonnay huiswijn fles',  'wijn',          6.50,  22.00, 'fles'),
  ('Merlot huiswijn fles',      'wijn',          6.50,  22.00, 'fles'),
  ('Coca-Cola fles',            'fris',          0.90,   3.50, 'fles'),
  ('Bronwater fles',            'fris',          0.40,   2.50, 'fles'),
  ('Gin fles 70cl',             'sterke drank', 14.00,  65.00, 'fles'),
  ('Vodka fles 70cl',           'sterke drank', 13.00,  60.00, 'fles');

-- ─── Beginvoorraad in het hoofdmagazijn ───────────────────────────
-- Rechtstreeks in de voorraadtabel (niet via mutaties), omdat dit de
-- nulmeting is: er is nog geen gebruiker om de mutatie aan te koppelen.
insert into voorraad (locatie_id, product_id, aantal, min_voorraad)
select
  (select id from locaties where naam = 'Hoofdmagazijn'),
  p.id,
  case p.eenheid when 'fust' then 20 when 'blik' then 600 else 200 end,
  case p.eenheid when 'fust' then 5  when 'blik' then 100 else 40  end
from producten p;
