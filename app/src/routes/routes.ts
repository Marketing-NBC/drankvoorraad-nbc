export const ROUTES = {
  login: "/login",
  overzicht: "/",
  evenementDetail: (id: string) => `/evenementen/${encodeURIComponent(id)}`,
  evenementDetailPattern: "/evenementen/:id",
  pakbonNieuw: (evenementId: string) => `/evenementen/${encodeURIComponent(evenementId)}/pakbon`,
  pakbonNieuwPattern: "/evenementen/:id/pakbon",
  pakbon: (id: string) => `/pakbonnen/${id}`,
  pakbonPattern: "/pakbonnen/:id",
  producten: "/producten",
  magazijn: "/magazijn",
  tellingen: "/tellingen",
  tellingDetail: (id: string) => `/tellingen/${id}`,
  tellingDetailPattern: "/tellingen/:id",
  historie: "/historie",
  /** Mutaties, op de emballage in plaats van de drank. */
  historieEmballage: "/historie?soort=emballage",
  gebruikers: "/gebruikers",
  koppelingen: "/koppelingen",
  leveringen: "/leveringen",
  leveringNieuw: "/leveringen/nieuw",
  /** Wat er aan emballage in huis staat — onder Magazijn. */
  emballage: "/magazijn/emballage",
  /** De retourbon invullen — onder Leveringen. */
  emballageRetour: "/leveringen/emballage",
  personeel: "/personeel",
  dashboard: "/dashboard",
} as const;
