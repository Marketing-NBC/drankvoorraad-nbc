import { Badge, type BadgeProps } from "../../design-system";
import type { EvenementStatus } from "../../data/types";

const statusVariant: Record<EvenementStatus, BadgeProps["variant"]> = {
  Gepland: "neutral",
  Actief: "tint",
  Afgerond: "success",
};

export function StatusBadge({ status }: { status: EvenementStatus }) {
  return <Badge variant={statusVariant[status]}>{status}</Badge>;
}
