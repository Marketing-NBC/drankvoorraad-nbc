import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Supabase-configuratie ontbreekt. Maak een .env-bestand in app/ met VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY " +
      "(zie .env.example)."
  );
}

export const supabase = createClient<Database>(url, anonKey);
