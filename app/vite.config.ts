import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  /*
   * GitHub Pages serveert deze app niet vanaf de hoofdmap maar vanaf
   * /drankvoorraad-nbc/. Vite zet dit pad voor alle verwijzingen naar scripts,
   * stijlen en fonts. Zonder deze regel zoekt de browser ze in de hoofdmap en
   * blijft het scherm leeg.
   *
   * De router leest dezelfde waarde uit import.meta.env.BASE_URL, zie
   * src/main.tsx. Verhuist de app naar een eigen domein, dan is dit de enige
   * regel die hoeft te wijzigen.
   */
  base: "/drankvoorraad-nbc/",
  plugins: [react()],
  test: {
    environment: "node",
  },
});
