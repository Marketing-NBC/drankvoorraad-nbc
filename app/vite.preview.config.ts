import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const hier = new URL(".", import.meta.url).pathname;

/**
 * Losse configuratie voor de visuele preview (`npm run preview:ui`): de echte
 * schermen met verzonnen gegevens, zodat de vormgeving te bekijken is zonder
 * Supabase. De twee contextmodules worden vervangen door stubs; verder draait
 * exact dezelfde code als in de app.
 */
export default defineConfig({
  root: "preview",
  base: "/",
  plugins: [
    react(),
    {
      name: "preview-context-stubs",
      enforce: "pre",
      resolveId(bron: string, importeur: string | undefined) {
        if (!importeur || importeur.includes("/preview/")) return null;
        if (!/(^|\/)(AppStateContext|AuthContext)$/.test(bron)) return null;
        const naam = bron.endsWith("AuthContext") ? "stubAuth.tsx" : "stubAppState.tsx";
        return `${hier}preview/${naam}`;
      },
    },
  ],
});
