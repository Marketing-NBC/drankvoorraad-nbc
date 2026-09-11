/* Entrypunt van de visuele preview: de echte schermen met verzonnen gegevens,
   zodat de vormgeving te bekijken is zonder Supabase. Niet in de build. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "../src/design-system/styles.css";
import "../src/app.css";
import { AuthProvider } from "./stubAuth";
import { AppStateProvider } from "./stubAppState";
import { App } from "../src/App";

const start = new URLSearchParams(location.search).get("pad") ?? "/";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MemoryRouter initialEntries={[start]}>
      <AuthProvider>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </AuthProvider>
    </MemoryRouter>
  </StrictMode>
);
