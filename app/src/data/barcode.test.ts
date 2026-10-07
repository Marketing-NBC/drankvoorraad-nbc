import { describe, expect, it } from "vitest";
import { hoortBijProduct, zoekOpBarcode } from "./barcode";
import type { Product } from "./types";

function product(velden: Partial<Product>): Product {
  return {
    id: "p", naam: "Coca Cola 0,2 L", categorie: "fris", inkoopprijs: 0, eenheid: "fles",
    stuksPerVerpakking: 24, alleenPerVerpakking: true, statiegeldPerStuk: 0,
    statiegeldPerVerpakking: 0, voorraadloos: false, ...velden,
  };
}

describe("barcodes", () => {
  const cola = product({ id: "cola", barcode: "5449000000996", barcodeVerpakking: "15449000000993" });
  const fanta = product({ id: "fanta", naam: "Fanta 0,2 L", barcode: "5449000011527" });

  it("vindt een product op de barcode van het flesje", () => {
    expect(zoekOpBarcode([fanta, cola], "5449000000996")?.id).toBe("cola");
  });

  it("vindt hetzelfde product op de barcode van de krat", () => {
    expect(zoekOpBarcode([fanta, cola], "15449000000993")?.id).toBe("cola");
  });

  it("negeert spaties rond een gescande code", () => {
    expect(hoortBijProduct(cola, " 15449000000993\n")).toBe(true);
  });

  it("koppelt een lege code nooit aan een product zonder barcode", () => {
    expect(hoortBijProduct(product({}), "")).toBe(false);
    expect(zoekOpBarcode([product({})], "  ")).toBeUndefined();
  });
});
