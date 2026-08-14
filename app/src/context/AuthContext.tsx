import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import type { GebruikerRol, Profiel } from "../data/types";

interface AuthContextValue {
  session: Session | null;
  profiel: Profiel | null;
  /** Gezet wanneer het profiel (en dus de rol) niet opgehaald kon worden. */
  profielFout: string | null;
  laden: boolean;
  inloggen: (email: string, wachtwoord: string) => Promise<{ fout: string | null }>;
  uitloggen: () => Promise<void>;
  /** true wanneer de ingelogde gebruiker een van de opgegeven rollen heeft */
  mag: (...rollen: GebruikerRol[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profiel, setProfiel] = useState<Profiel | null>(null);
  const [profielFout, setProfielFout] = useState<string | null>(null);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLaden(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nieuweSessie) => {
      setSession(nieuweSessie);
      if (!nieuweSessie) {
        setProfiel(null);
        setLaden(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let geannuleerd = false;

    // Zonder profiel weet de app je rol niet en zie je minder dan je mag.
    // Daarom één keer opnieuw proberen, en anders een expliciete melding
    // in plaats van stilletjes met minder rechten verder gaan.
    (async () => {
      for (let poging = 0; poging < 2; poging++) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, naam, rol")
          .eq("id", session.user.id)
          .single();

        if (geannuleerd) return;

        if (data) {
          setProfiel({ id: data.id, naam: data.naam, rol: data.rol });
          setProfielFout(null);
          setLaden(false);
          return;
        }

        if (!error) break;
        if (poging === 0) await new Promise((r) => setTimeout(r, 600));
      }

      if (geannuleerd) return;
      setProfielFout(
        "Je profiel kon niet opgehaald worden, waardoor je rol onbekend is. Ververs de pagina of log opnieuw in."
      );
      setLaden(false);
    })();

    return () => {
      geannuleerd = true;
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profiel,
      profielFout,
      laden,
      async inloggen(email, wachtwoord) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
        if (!error) return { fout: null };
        const fout =
          error.message === "Invalid login credentials"
            ? "E-mailadres of wachtwoord klopt niet."
            : "Inloggen is niet gelukt. Probeer het opnieuw.";
        return { fout };
      },
      async uitloggen() {
        await supabase.auth.signOut();
      },
      mag(...rollen) {
        return profiel !== null && rollen.includes(profiel.rol);
      },
    }),
    [session, profiel, profielFout, laden]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
