import { useState } from "react";
import { Icon } from "../../design-system";
import { Select } from "../../components/ui/Select";
import type { EvenementStatus, Merk } from "../../data/types";

export interface EventFiltersValue {
  zoek: string;
  merk: Merk | "";
  status: EvenementStatus | "";
}

export function EventFilters({
  value,
  onChange,
}: {
  value: EventFiltersValue;
  onChange: (value: EventFiltersValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const actieveFilters = [value.merk, value.status].filter(Boolean).length;

  return (
    <div className={["filters-bar", open && "filters-bar--open"].filter(Boolean).join(" ")}>
      <div className="search">
        <Icon name="search" size={18} className="search__icoon" />
        <input
          className="input search__veld"
          placeholder="Zoek op evenementnaam…"
          value={value.zoek}
          onChange={(e) => onChange({ ...value, zoek: e.target.value })}
        />
      </div>

      {/* Alleen op mobiel: de keuzelijsten zitten standaard ingeklapt. */}
      <button
        type="button"
        className="filters-bar__schakelaar"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Filters
        {actieveFilters > 0 ? <span className="filters-bar__teller">{actieveFilters}</span> : null}
        <Icon name="chevron-down" size={16} />
      </button>

      <div className="filters-bar__keuzes">
        <Select
          aria-label="Filter op merk"
          placeholder="Alle merken"
          value={value.merk}
          onChange={(e) => onChange({ ...value, merk: e.target.value as Merk | "" })}
          options={[
            { value: "NBC", label: "NBC" },
            { value: "Green Village", label: "Green Village" },
          ]}
        />
        <Select
          aria-label="Filter op status"
          placeholder="Alle statussen"
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value as EvenementStatus | "" })}
          options={[
            { value: "Gepland", label: "Gepland" },
            { value: "Actief", label: "Actief" },
            { value: "Afgerond", label: "Afgerond" },
          ]}
        />
      </div>
    </div>
  );
}
