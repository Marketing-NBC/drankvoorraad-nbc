import { Link } from "react-router-dom";
import { BrandBadge } from "../../components/ui/BrandBadge";
import { StatusBadge } from "../../components/ui/StatusBadge";
import type { Evenement, Mutatie, Product } from "../../data/types";
import { berekenMarge } from "../../data/calculations";
import { formatDateKort } from "../../utils/format";
import { ROUTES } from "../../routes/routes";

/** "66%" of een streepje — de lijst heeft geen ruimte voor "nog niet beschikbaar". */
function margeKort(waarde: number | null): string {
  return waarde === null ? "—" : `${Math.round(waarde)}%`;
}

export function EventRow({
  evenement,
  mutaties,
  producten,
}: {
  evenement: Evenement;
  mutaties: Mutatie[];
  producten: Product[];
}) {
  const marge = berekenMarge(evenement.omzet, mutaties, producten);

  return (
    <Link className="event-rij" to={ROUTES.evenementDetail(evenement.id)}>
      <span className="event-rij__main">
        <span className="event-rij__titel">{evenement.naam}</span>
        <span className="event-rij__meta">
          {formatDateKort(evenement.datum)}
          {/* Het merk valt op een telefoon weg: daar is de ruimte voor de
              status, en die zegt meer over wat je nu moet doen. */}
          <span className="verberg-mobiel"><BrandBadge merk={evenement.merk} /></span>
          <StatusBadge status={evenement.status} />
        </span>
      </span>

      <span className="event-rij__marge">
        <span className="event-rij__marge-label">brutomarge</span>
        <span className="event-rij__marge-waarde">{margeKort(marge.brutomarge)}</span>
      </span>

      {/* Geen knop in een link; dit vlak lift mee op de hele rij. */}
      <span className="event-rij__openen" aria-hidden="true">Openen</span>
    </Link>
  );
}
