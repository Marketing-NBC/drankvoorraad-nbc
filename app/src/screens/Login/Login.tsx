import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Button, Card, Input, Logo } from "../../design-system";
import { useAuth } from "../../context/AuthContext";
import { ROUTES } from "../../routes/routes";

export function Login() {
  const { session, inloggen } = useAuth();
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  if (session) return <Navigate to={ROUTES.overzicht} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBezig(true);
    setFout(null);
    const { fout: inlogFout } = await inloggen(email, wachtwoord);
    setFout(inlogFout);
    setBezig(false);
  }

  return (
    <div className="login">
      <Card padding="feature" className="login__card">
        <Logo variant="color" height={40} className="login__logo" />
        <h1 className="login__title">Drankvoorraad</h1>
        <p className="login__intro">Log in om verder te gaan.</p>

        <form className="product-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-group__label" htmlFor="login-email">E-mailadres</label>
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label className="field-group__label" htmlFor="login-wachtwoord">Wachtwoord</label>
            <Input
              id="login-wachtwoord"
              type="password"
              autoComplete="current-password"
              value={wachtwoord}
              onChange={(e) => setWachtwoord(e.target.value)}
              required
            />
          </div>
          {fout ? <p className="form-error">{fout}</p> : null}
          <Button type="submit" icon={null} disabled={bezig}>
            {bezig ? "Bezig met inloggen…" : "Inloggen"}
          </Button>
        </form>

        <p className="login__hint">
          Nog geen account? Vraag een beheerder om er een voor je aan te maken.
        </p>
      </Card>
    </div>
  );
}
