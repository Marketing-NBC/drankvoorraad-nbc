import { Badge, type BadgeProps } from "../../design-system";
import type { Merk } from "../../data/types";

/**
 * Eén plek waar merk op een badge-variant wordt gemapt: NBC in het petrol
 * van de huisstijl, Green Village in de eigen groentint.
 */
const merkVariant: Record<Merk, BadgeProps["variant"]> = {
  NBC: "tint",
  "Green Village": "merk-gv",
};

export function BrandBadge({ merk }: { merk: Merk }) {
  return <Badge variant={merkVariant[merk]}>{merk}</Badge>;
}
