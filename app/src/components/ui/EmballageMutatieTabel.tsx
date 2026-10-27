import { Badge } from "../../design-system";
import { Table } from "./Table";
import { emballageBeweging, emballageNotitie, emballageVerschil } from "../../data/emballage";
import { emballageBewegingLabels, emballageBewegingVariant } from "../../data/labels";
import type { EmballageMutatie, EmballageRetour, EmballageSoort, Profiel } from "../../data/types";
import { formatDateTimeKort, formatNumber } from "../../utils/format";

/**
 * Elke beweging van emballage: wat er onder Magazijn → Emballage erbij of
 * eraf ging of geteld werd, de beginstand, en de regels van de retourbon.
 * Wat er met de inkoop binnenkomt staat hier niet: dat is een drankmutatie
 * van het type inkoop, en de emballage telt de database daar zelf bij.
 *
 * Het aantal staat met teken: zo lees je meteen wat het met de stand in huis
 * deed.
 */
export function EmballageMutatieTabel({
  mutaties,
  soorten,
  retouren,
  profielen,
  legeMelding = "Nog geen emballage ingevoerd.",
}: {
  mutaties: EmballageMutatie[];
  soorten: EmballageSoort[];
  retouren: EmballageRetour[];
  profielen: Profiel[];
  legeMelding?: string;
}) {
  const soortNaam = new Map(soorten.map((s) => [s.id, s.naam]));
  const retourById = new Map(retouren.map((r) => [r.id, r]));
  const gebruikerNaam = new Map(profielen.map((p) => [p.id, p.naam]));

  return (
    <Table<EmballageMutatie>
      rowKey={(m) => m.id}
      rows={mutaties}
      emptyMessage={legeMelding}
      compact
      columns={[
        {
          header: "Datum en tijd",
          mobiel: "meta",
          render: (m) => <span className="tekst-zwak">{formatDateTimeKort(m.datumTijd)}</span>,
        },
        {
          header: "Soort",
          mobiel: "kop",
          render: (m) => {
            const beweging = emballageBeweging(m);
            return <Badge variant={emballageBewegingVariant[beweging]}>{emballageBewegingLabels[beweging]}</Badge>;
          },
        },
        {
          header: "Emballage",
          primair: true,
          render: (m) => soortNaam.get(m.emballageId) ?? "onbekend",
        },
        {
          header: "Aantal",
          align: "right",
          mobiel: "kop",
          render: (m) => {
            const verschil = emballageVerschil(m);
            return <strong>{verschil > 0 ? `+${formatNumber(verschil)}` : `−${formatNumber(-verschil)}`}</strong>;
          },
        },
        {
          header: "Door",
          mobiel: "meta",
          render: (m) => <span className="tekst-zwak">{gebruikerNaam.get(m.gebruikerId) ?? "onbekend"}</span>,
        },
        {
          header: "Notitie",
          verbergOpMobiel: true,
          render: (m) => {
            const notitie = emballageNotitie(m, m.retourId ? retourById.get(m.retourId) : undefined);
            return notitie ? <span className="tekst-zwak">{notitie}</span> : <span className="tekst-leeg">—</span>;
          },
        },
      ]}
    />
  );
}
