import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { GebruikerRol } from "../../data/types";
import { ROUTES } from "../../routes/routes";
import { EmptyState } from "../ui/EmptyState";

/**
 * Route-guard. Stuurt niet-ingelogde bezoekers naar /login. Met `rollen`
 * beperk je een route bovendien tot bepaalde rollen — de database dwingt
 * dat óók af via RLS, dit is puur om de UI netjes te houden.
 */
export function RequireAuth({ children, rollen }: { children: ReactNode; rollen?: GebruikerRol[] }) {
  const { session, profiel, laden } = useAuth();

  if (laden) {
    return <div className="app-laden">Bezig met laden…</div>;
  }

  if (!session) {
    return <Navigate to={ROUTES.login} replace />;
  }

  if (rollen && profiel && !rollen.includes(profiel.rol)) {
    return (
      <EmptyState
        title="Geen toegang"
        body="Je hebt niet de juiste rol voor dit scherm. Vraag een beheerder om hulp."
      />
    );
  }

  return <>{children}</>;
}
