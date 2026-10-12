import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { RequireAuth } from "./components/layout/RequireAuth";
import { ROUTES } from "./routes/routes";
import type { GebruikerRol } from "./data/types";
import { Login } from "./screens/Login/Login";
import { EvenementenOverzicht } from "./screens/EvenementenOverzicht/EvenementenOverzicht";
import { EvenementDetail } from "./screens/EvenementDetail/EvenementDetail";
import { PakbonNieuw } from "./screens/Pakbon/PakbonNieuw";
import { PakbonWeergave } from "./screens/Pakbon/PakbonWeergave";
import { Productbeheer } from "./screens/Productbeheer/Productbeheer";
import { Magazijn } from "./screens/Magazijn/Magazijn";
import { Tellingen } from "./screens/Tellingen/Tellingen";
import { TellingDetail } from "./screens/Tellingen/TellingDetail";
import { Historie } from "./screens/Historie/Historie";
import { Gebruikers } from "./screens/Gebruikers/Gebruikers";
import { Dashboard } from "./screens/Dashboard/Dashboard";
import { Koppelingen } from "./screens/Koppelingen/Koppelingen";
import { Leveringen } from "./screens/Leveringen/Leveringen";
import { LeveringNieuw } from "./screens/Leveringen/LeveringNieuw";
import { EmballageRetour } from "./screens/Emballage/EmballageRetour";
import { Personeelsverbruik } from "./screens/Personeel/Personeelsverbruik";

/** Housekeeping komt alleen bij het personeelsverbruik en de tellingen daarvan. */
const WERK: GebruikerRol[] = ["beheerder", "medewerker"];

export function App() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<Login />} />
      <Route
        path="*"
        element={
          <RequireAuth>
            <AppShell>
              <Routes>
                <Route path={ROUTES.overzicht} element={<RequireAuth rollen={WERK}><EvenementenOverzicht /></RequireAuth>} />
                <Route path={ROUTES.evenementDetailPattern} element={<RequireAuth rollen={WERK}><EvenementDetail /></RequireAuth>} />
                <Route path={ROUTES.pakbonNieuwPattern} element={<RequireAuth rollen={WERK}><PakbonNieuw /></RequireAuth>} />
                <Route path={ROUTES.pakbonPattern} element={<RequireAuth rollen={WERK}><PakbonWeergave /></RequireAuth>} />
                <Route path={ROUTES.producten} element={<RequireAuth rollen={WERK}><Productbeheer /></RequireAuth>} />
                <Route path={ROUTES.magazijn} element={<RequireAuth rollen={WERK}><Magazijn /></RequireAuth>} />
                <Route path={ROUTES.tellingen} element={<Tellingen />} />
                <Route path={ROUTES.tellingDetailPattern} element={<TellingDetail />} />
                <Route path={ROUTES.historie} element={<RequireAuth rollen={WERK}><Historie /></RequireAuth>} />
                <Route
                  path={ROUTES.gebruikers}
                  element={
                    <RequireAuth rollen={["beheerder"]}>
                      <Gebruikers />
                    </RequireAuth>
                  }
                />
                <Route
                  path={ROUTES.dashboard}
                  element={
                    <RequireAuth rollen={["beheerder"]}>
                      <Dashboard />
                    </RequireAuth>
                  }
                />
                <Route path={ROUTES.personeel} element={<Personeelsverbruik />} />
                <Route path={ROUTES.leveringen} element={<RequireAuth rollen={WERK}><Leveringen /></RequireAuth>} />
                <Route
                  path={ROUTES.leveringNieuw}
                  element={
                    <RequireAuth rollen={WERK}>
                      <LeveringNieuw />
                    </RequireAuth>
                  }
                />
                <Route path={ROUTES.emballage} element={<RequireAuth rollen={WERK}><EmballageRetour /></RequireAuth>} />
                <Route
                  path={ROUTES.koppelingen}
                  element={
                    <RequireAuth rollen={["beheerder"]}>
                      <Koppelingen />
                    </RequireAuth>
                  }
                />
              </Routes>
            </AppShell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
