import { useState } from "react";
import { Icon } from "../../design-system";
import { Select } from "../../components/ui/Select";
import type { Product, ProductCategorie } from "../../data/types";

export interface ProductFiltersValue {
  zoek: string;
  categorie: ProductCategorie | "";
  leverancier: string;
}

export function ProductFilters({
  value,
  onChange,
  producten,
}: {
  value: ProductFiltersValue;
  onChange: (value: ProductFiltersValue) => void;
  producten: Product[];
}) {
  const [open, setOpen] = useState(false);
  const actieveFilters = [value.categorie, value.leverancier].filter(Boolean).length;

  // De keuzelijsten volgen de gegevens: alleen categorieën en leveranciers
  // die echt voorkomen, anders filter je op een lege lijst.
  const categorieen = [...new Set(producten.map((p) => p.categorie))].sort();
  const leveranciers = [...new Set(producten.map((p) => p.leverancier).filter(Boolean))].sort() as string[];

  return (
    <div className={["filters-bar", open && "filters-bar--open"].filter(Boolean).join(" ")}>
      <div className="search">
        <Icon name="search" size={16} className="search__icoon" />
        <input
          className="input search__veld"
          placeholder="Zoek op naam, categorie of barcode…"
          value={value.zoek}
          onChange={(e) => onChange({ ...value, zoek: e.target.value })}
        />
      </div>

      {/* Alleen op mobiel: de keuzelijsten zitten standaard ingeklapt. */}
      <button
        type="button"
        className="filters-bar__schakelaar"
        aria-expanded={open}
        aria-label="Filters tonen"
        onClick={() => setOpen(!open)}
      >
        Filters
        {actieveFilters > 0 ? <span className="filters-bar__teller">{actieveFilters}</span> : null}
      </button>

      <div className="filters-bar__keuzes">
        <Select
          aria-label="Filter op categorie"
          placeholder="Alle categorieën"
          value={value.categorie}
          onChange={(e) => onChange({ ...value, categorie: e.target.value as ProductCategorie | "" })}
          options={categorieen.map((c) => ({ value: c, label: c }))}
        />
        <Select
          aria-label="Filter op leverancier"
          placeholder="Alle leveranciers"
          value={value.leverancier}
          onChange={(e) => onChange({ ...value, leverancier: e.target.value })}
          options={leveranciers.map((l) => ({ value: l, label: l }))}
        />
      </div>
    </div>
  );
}
