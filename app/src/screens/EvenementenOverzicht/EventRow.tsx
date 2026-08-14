import { Link } from "react-router-dom";
import { Card } from "../../design-system";
import { BrandBadge } from "../../components/ui/BrandBadge";
import { StatusBadge } from "../../components/ui/StatusBadge";
import type { Evenement, Mutatie, Product } from "../../data/types";
import { berekenMarge } from "../../data/calculations";
import { formatBrutomarge, formatDateKort } from "../../utils/format";
import { ROUTES } from "../../routes/routes";

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
    <Link
      to={ROUTES.evenementDetail(evenement.id)}
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      <Card hover>
        <div className="event-row">
          <div className="event-row__main">
            <span className="event-row__title">{evenement.naam}</span>
            <span className="event-row__meta">
              <span>{formatDateKort(evenement.datum)}</span>
              <span className="event-row__badges">
                <BrandBadge merk={evenement.merk} />
                <StatusBadge status={evenement.status} />
              </span>
            </span>
          </div>
          <div className="event-row__marge">
            <span className="event-row__marge-label">brutomarge</span>
            <span className="event-row__marge-value">{formatBrutomarge(marge.brutomarge)}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
