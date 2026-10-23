import type { ReactNode } from "react";

export interface TotaalCijfer {
  waarde: ReactNode;
  label: string;
}

/**
 * De petrolblauwe balk bovenaan Magazijn en Emballage: een titel met de
 * cijfers ernaast. Alleen om te lezen — de locatiekeuze staat eronder.
 */
export function TotaalBalk({
  titel,
  sub,
  cijfers,
}: {
  titel: ReactNode;
  sub?: ReactNode;
  cijfers: TotaalCijfer[];
}) {
  return (
    <section className="totaal-balk">
      <div>
        <h2 className="totaal-balk__titel">{titel}</h2>
        {sub ? <span className="totaal-balk__sub">{sub}</span> : null}
      </div>
      <dl className="totaal-balk__cijfers">
        {cijfers.map((c) => (
          <div className="totaal-balk__cijfer" key={c.label}>
            <dt>{c.label}</dt>
            <dd>{c.waarde}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
