/* Alleen voor de visuele preview (npm run preview:ui) — niet in de app. */
import type { ReactNode } from "react";
import type { GebruikerRol } from "../src/data/types";

/* Rol kiezen met ?rol=medewerker of ?rol=housekeeping, om te
   zien wat een andere rol wel en niet te zien krijgt. Standaard beheerder. */
const rolUitAdres = new URLSearchParams(window.location.search).get("rol") as GebruikerRol | null;
const profiel = { id: "u1", naam: "Abel Bakker", rol: rolUitAdres ?? ("beheerder" as GebruikerRol) };

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAuth(): any {
  return {
    session: { user: { id: "u1" } },
    profiel,
    profielFout: null,
    laden: false,
    inloggen: async () => ({ fout: null }),
    uitloggen: async () => {},
    mag: (...rollen: GebruikerRol[]) => rollen.includes(profiel.rol),
    zietBedragen: profiel.rol === "beheerder",
  };
}
