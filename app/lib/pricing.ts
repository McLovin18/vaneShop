export type CatalogPricing = {
  basePrice: number;
  discount: number;
  hasDiscount: boolean;
  fakeOldPrice: number | null;
  finalPrice: number;
};

export type SnapshotPricing = {
  basePrice: number;
  discount: number;
  hasDiscount: boolean;
  fakeOldPrice: number | null;
  finalPrice: number;
};

export function getCatalogPricing(product: any): CatalogPricing {
  const basePrice = Number(product?.precioBase ?? product?.precio ?? 0);
  const discount = Number(product?.descuento || 0);
  const hasDiscount = !isNaN(discount) && discount > 0 && discount < 100;
  const finalPrice = hasDiscount ? Math.round(basePrice * (1 - discount / 100) * 100) / 100 : basePrice;
  const fakeOldPrice = hasDiscount ? basePrice : null;

  return { basePrice, discount, hasDiscount, fakeOldPrice, finalPrice };
}

export function getSnapshotPricing(item: any): SnapshotPricing {
  const discount = Number(item?.descuento || 0);
  const hasDiscount = !isNaN(discount) && discount > 0 && discount < 100;
  const basePrice = Number(item?.precioBase ?? item?.precio ?? 0);
  // Priorizar precioUnitario guardado (ya incluye variaciones) sobre precioFinal o cálculo
  const finalPrice = Number(item?.precioUnitario ?? item?.precioFinal ?? (hasDiscount ? basePrice * (1 - discount / 100) : basePrice));
  const fakeOldPrice = hasDiscount ? basePrice : null;

  return { basePrice, discount, hasDiscount, fakeOldPrice, finalPrice };
}