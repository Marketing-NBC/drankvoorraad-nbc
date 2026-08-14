import { Badge, type BadgeProps } from "../../design-system";
import type { Merk } from "../../data/types";

/**
 * Single place to map merk -> badge variant. NBC uses the real brand teal
 * tint. Green Village has no supplied palette yet in the design system, so
 * it renders as a neutral badge with just the brand name until Abel provides
 * an actual Green Village color to plug in here.
 */
const merkVariant: Record<Merk, BadgeProps["variant"]> = {
  NBC: "tint",
  "Green Village": "neutral",
};

export function BrandBadge({ merk }: { merk: Merk }) {
  return <Badge variant={merkVariant[merk]}>{merk}</Badge>;
}
