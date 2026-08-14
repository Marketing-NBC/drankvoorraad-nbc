import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { RequireAuth } from "./components/layout/RequireAuth";
import { ROUTES } from "./routes/routes";
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
                <Route path={ROUTES.overzicht} element={<EvenementenOverzicht />} />
                <Route path={ROUTES.evenementDetailPattern} element={<EvenementDetail />} />
                <Route path={ROUTES.pakbonNieuwPattern} element={<PakbonNieuw />} />
                <Route path={ROUTES.pakbonPattern} element={<PakbonWeergave />} />
                <Route path={ROUTES.producten} element={<Productbeheer />} />
                <Route path={ROUTES.magazijn} element={<Magazijn />} />
                <Route path={ROUTES.tellingen} element={<Tellingen />} />
                <Route path={ROUTES.tellingDetailPattern} element={<TellingDetail />} />
                <Route path={ROUTES.historie} element={<Historie />} />
                <Route
                  path={ROUTES.gebruikers}
                  element={
                    <RequireAuth rollen={["beheerder"]}>
                      <Gebruikers />
                    </RequireAuth>
                  }
                />
                <Route path={ROUTES.dashboard} element={<Dashboard />} />
              </Routes>
            </AppShell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
