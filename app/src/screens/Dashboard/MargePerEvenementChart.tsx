import { BarChart } from "../../components/ui/BarChart";
import { berekenMarge } from "../../data/calculations";
import type { Evenement, Mutatie, Product } from "../../data/types";

export function MargePerEvenementChart({
  evenementen,
  mutatiesPerEvenement,
  producten,
}: {
  evenementen: Evenement[];
  mutatiesPerEvenement: Map<string, Mutatie[]>;
  producten: Product[];
}) {
  const data = evenementen
    .map((e) => {
      const marge = berekenMarge(e.omzet, mutatiesPerEvenement.get(e.id) ?? [], producten);
      return marge.brutomarge === null ? null : { label: e.naam, value: marge.brutomarge };
    })
    .filter((d): d is { label: string; value: number } => d !== null);

  if (data.length === 0) {
    return <p style={{ color: "var(--fg-secondary)" }}>Nog geen evenementen met een berekenbare brutomarge.</p>;
  }

  return <BarChart data={data} />;
}
