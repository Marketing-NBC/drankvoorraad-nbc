import type { Product } from "./types";

/**
 * Hoort deze gescande code bij dit product? Een product heeft er twee: die
 * op het losse stuk en die op de krat of doos (migratie 022). Beide leiden
 * naar hetzelfde product — wat er geboekt wordt blijft in stuks.
 */
export function hoortBijProduct(product: Product, code: string): boolean {
  const c = code.trim();
  if (!c) return false;
  return product.barcode === c || product.barcodeVerpakking === c;
}

export function zoekOpBarcode(producten: Product[], code: string): Product | undefined {
  return producten.find((p) => hoortBijProduct(p, code));
}
