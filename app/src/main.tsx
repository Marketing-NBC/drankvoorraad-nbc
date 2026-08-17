import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./design-system/styles.css";
import "./app.css";
import { AuthProvider } from "./context/AuthContext";
import { AppStateProvider } from "./context/AppStateContext";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/*
      BASE_URL is de submap uit vite.config.ts: lokaal "/" en op GitHub Pages
      "/drankvoorraad-nbc/". Zo blijven de paden in routes.ts kort en klopt de
      adresbalk in beide gevallen.
    */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
