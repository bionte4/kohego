import { productById } from "@/lib/catalog";
import type { StockLine, VariantId } from "@/lib/types";

export function stockQty(stock: StockLine[], warehouseId: string, variant: VariantId) {
  return stock.find((line) => line.warehouseId === warehouseId && line.variant === variant)?.qty ?? 0;
}

/**
 * Change on-hand stock in packages. A sale of ten 25 kg sacks subtracts 10
 * from that SKU only. Mass and volume are derived later from the catalog.
 */
export function adjustStock(
  stock: StockLine[],
  warehouseId: string,
  variant: VariantId,
  delta: number,
): StockLine[] {
  const index = stock.findIndex(
    (line) => line.warehouseId === warehouseId && line.variant === variant,
  );
  if (index === -1) {
    return [...stock, { warehouseId, variant, qty: delta }];
  }
  return stock.map((line, lineIndex) =>
    lineIndex === index ? { ...line, qty: line.qty + delta } : line,
  );
}

export function stockKilograms(stock: StockLine[], warehouseId?: string) {
  return stock.reduce((sum, line) => {
    if (warehouseId && line.warehouseId !== warehouseId) return sum;
    return sum + line.qty * productById(line.variant).weightKg;
  }, 0);
}

export function stockLiters(stock: StockLine[], warehouseId?: string) {
  return stock.reduce((sum, line) => {
    if (warehouseId && line.warehouseId !== warehouseId) return sum;
    return sum + line.qty * productById(line.variant).volumeL;
  }, 0);
}
