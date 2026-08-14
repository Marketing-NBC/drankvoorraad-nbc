import type { ReactNode } from "react";

export interface TableColumn<T> {
  header: string;
  align?: "left" | "right";
  /** Titel van het kaartje in de mobiele weergave (meestal de productnaam). */
  primair?: boolean;
  /** Verberg deze kolom op mobiel — voor secundaire info die op een klein scherm ruis is. */
  verbergOpMobiel?: boolean;
  render: (row: T) => ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  className?: string;
  emptyMessage?: string;
}

/**
 * Eén tabel, twee verschijningsvormen. Vanaf tablet een gewone tabel; op
 * mobiel vouwt elke rij zich via CSS open tot een kaartje, waarbij de
 * kolomkoppen als labels vóór de waarden verschijnen (`data-label`).
 * Zo blijft er één DOM-structuur — geen dubbele markup die uit elkaar loopt.
 */
export function Table<T>({ columns, rows, rowKey, className = "", emptyMessage = "Geen gegevens." }: TableProps<T>) {
  if (rows.length === 0) {
    return <p className="data-table__empty">{emptyMessage}</p>;
  }

  return (
    <div className="data-table-wrap">
      <table className={["data-table", className].filter(Boolean).join(" ")}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.header}
                className={[col.align === "right" && "num", col.verbergOpMobiel && "verberg-mobiel"]
                  .filter(Boolean).join(" ") || undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td
                  key={col.header}
                  data-label={col.header}
                  className={[
                    col.align === "right" && "num",
                    col.primair && "cel-primair",
                    col.verbergOpMobiel && "verberg-mobiel",
                  ].filter(Boolean).join(" ") || undefined}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
