import { getCatalogPricing } from "./pricing";

export const MAX_QUANTITY_PER_ITEM = 10;

export function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined).filter((item) => item !== undefined);
  }
  if (typeof obj !== "object") return obj;

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const cleanedValue = cleanUndefined(value);
    if (cleanedValue !== undefined) {
      cleaned[key] = cleanedValue;
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export type CheckoutRequestItem = {
  id: string;
  cantidad?: number;
  cartKey?: string;
  variantKey?: string;
  selectedTalla?: string;
  selectedColor?: string;
  selectedVariations?: Record<string, string>;
  variationAttributeIds?: string[];
  variacionPersonalizada?: string;
};

type VariantMatch = {
  index: number;
  variant: any;
};

function normalizeSelectedVariations(item: CheckoutRequestItem) {
  if (!item?.selectedVariations || !Array.isArray(item.variationAttributeIds)) {
    return null;
  }

  const cleaned: Record<string, string> = {};
  for (const attrId of item.variationAttributeIds) {
    const value = item.selectedVariations[attrId];
    if (value) {
      cleaned[attrId] = value;
    }
  }

  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

export function findMatchingVariant(
  productData: any,
  item: CheckoutRequestItem
): VariantMatch | null {
  const variants = Array.isArray(productData?.stockVariants)
    ? productData.stockVariants
    : [];

  if (variants.length === 0) {
    return null;
  }

  if (item?.variantKey) {
    const index = variants.findIndex((variant: any) => variant?.variantKey === item.variantKey);
    if (index >= 0) {
      return { index, variant: variants[index] };
    }
  }

  const selectedVariations = normalizeSelectedVariations(item);
  const variationAttributeIds = Array.isArray(item?.variationAttributeIds)
    ? item.variationAttributeIds
    : [];

  if (selectedVariations && variationAttributeIds.length > 0) {
    const index = variants.findIndex((variant: any) => {
      const attrs = variant?.attributes || {};
      return variationAttributeIds.every(
        (attrId) => attrs[attrId] === selectedVariations[attrId]
      );
    });

    if (index >= 0) {
      return { index, variant: variants[index] };
    }
  }

  if (item?.selectedTalla || item?.selectedColor) {
    const index = variants.findIndex((variant: any) => {
      const sameTalla =
        item.selectedTalla === undefined || variant?.talla === item.selectedTalla;
      const sameColor =
        item.selectedColor === undefined || variant?.color === item.selectedColor;
      return sameTalla && sameColor;
    });

    if (index >= 0) {
      return { index, variant: variants[index] };
    }
  }

  return null;
}

function getSelectionSummary(item: CheckoutRequestItem, variant?: any) {
  const parts: string[] = [];
  const selectedVariations = normalizeSelectedVariations(item);

  if (selectedVariations) {
    for (const attrId of item.variationAttributeIds || []) {
      const value = selectedVariations[attrId];
      if (value) {
        parts.push(value);
      }
    }
  } else {
    if (item.selectedTalla || variant?.talla) {
      parts.push(`Talla: ${item.selectedTalla || variant?.talla}`);
    }
    if (item.selectedColor || variant?.color) {
      parts.push(`Color: ${item.selectedColor || variant?.color}`);
    }
  }

  return parts.join(" · ");
}

export function buildOrderProductLine(item: CheckoutRequestItem, productData: any) {
  const cantidad = Number(item?.cantidad || 1);

  if (!item?.id) {
    throw new Error("Hay un producto inválido en el checkout.");
  }
  if (cantidad < 1) {
    throw new Error(`La cantidad del producto "${productData?.nombre || item.id}" debe ser al menos 1.`);
  }
  if (cantidad > MAX_QUANTITY_PER_ITEM) {
    throw new Error(
      `La cantidad máxima permitida por producto es ${MAX_QUANTITY_PER_ITEM}.`
    );
  }

  const variantMatch = findMatchingVariant(productData, item);
  const hasRequestedDynamicVariations =
    !!normalizeSelectedVariations(item) && Array.isArray(item?.variationAttributeIds) && item.variationAttributeIds.length > 0;
  const hasRequestedLegacyVariant = !!item?.selectedTalla || !!item?.selectedColor;

  if ((hasRequestedDynamicVariations || hasRequestedLegacyVariant || item?.variantKey) && !variantMatch) {
    throw new Error(`No se encontró la variante seleccionada para "${productData?.nombre || item.id}".`);
  }

  const variant = variantMatch?.variant;
  const availableStock = variantMatch
    ? Number(variant?.cantidad ?? variant?.stock ?? 0)
    : Number(productData?.stock ?? 0);

  if (availableStock < cantidad) {
    throw new Error(
      `Stock insuficiente para "${productData?.nombre}". Disponibles: ${availableStock}, solicitados: ${cantidad}.`
    );
  }

  const variantBasePrice = variantMatch
    ? Number(variant?.precio ?? productData?.precio ?? 0)
    : Number(productData?.precio ?? 0);

  const { basePrice, discount, hasDiscount, finalPrice } = getCatalogPricing({
    ...productData,
    precio: variantBasePrice,
    precioBase: variantBasePrice,
  });

  const subtotal = Math.round(finalPrice * cantidad * 100) / 100;
  const variantSelectionSummary = getSelectionSummary(item, variant);

  const lineItem = {
    id: item.id,
    cartKey: item.cartKey || item.variantKey || item.id,
    nombre: productData?.nombre || "Producto",
    cantidad,
    precioBase: basePrice,
    descuento: hasDiscount ? discount : 0,
    precioUnitario: finalPrice,
    precioFinal: finalPrice,
    subtotal,
    imagen: productData?.imagenes?.[0] || null,
    bodegaId: productData?.bodegaId || "principal",
    hasVariations: Boolean(productData?.hasVariations || variantMatch),
    selectedVariations: normalizeSelectedVariations(item) || undefined,
    variationAttributeIds: Array.isArray(item?.variationAttributeIds)
      ? item.variationAttributeIds
      : undefined,
    selectedTalla: item?.selectedTalla || variant?.talla || undefined,
    selectedColor: item?.selectedColor || variant?.color || undefined,
    variantKey: item?.variantKey || variant?.variantKey || undefined,
    variantSelectionSummary: variantSelectionSummary || undefined,
    variacionPersonalizada: item?.variacionPersonalizada || undefined,
    stockTracking: variantMatch
      ? {
          type: "variant",
          variantKey: item?.variantKey || variant?.variantKey || undefined,
          attributes: variant?.attributes || undefined,
          talla: variant?.talla || item?.selectedTalla || undefined,
          color: variant?.color || item?.selectedColor || undefined,
        }
      : {
          type: "product",
        },
  };
  return cleanUndefined(lineItem);
}

export function applyStockDeltaToProduct(productData: any, orderItem: any, delta: number) {
  console.log("[applyStockDeltaToProduct] Inputs:", {
    productId: productData?.id,
    productName: productData?.nombre,
    orderItem,
    delta,
  });

  const variantMatch = findMatchingVariant(productData, {
    id: orderItem?.id,
    variantKey: orderItem?.stockTracking?.variantKey || orderItem?.variantKey,
    selectedVariations: orderItem?.selectedVariations,
    variationAttributeIds: orderItem?.variationAttributeIds,
    selectedTalla: orderItem?.stockTracking?.talla || orderItem?.selectedTalla,
    selectedColor: orderItem?.stockTracking?.color || orderItem?.selectedColor,
  });

  console.log("[applyStockDeltaToProduct] variantMatch:", variantMatch);

  if (orderItem?.stockTracking?.type === "variant" || variantMatch) {
    if (!variantMatch) {
      throw new Error(`No se encontró la variante para actualizar el stock de "${productData?.nombre}".`);
    }

    const variants = Array.isArray(productData?.stockVariants)
      ? [...productData.stockVariants]
      : [];

    const currentQty = Number(
      variants[variantMatch.index]?.cantidad ??
        variants[variantMatch.index]?.stock ??
        0
    );
    const nextQty = currentQty + delta;

    console.log("[applyStockDeltaToProduct] Variant details:", {
      index: variantMatch.index,
      variant: variants[variantMatch.index],
      currentQty,
      nextQty,
    });

    if (nextQty < 0) {
      throw new Error(`Stock insuficiente para la variante de "${productData?.nombre}".`);
    }

    variants[variantMatch.index] = {
      ...variants[variantMatch.index],
      cantidad: nextQty,
    };

    const totalStock = variants.reduce(
      (sum: number, variant: any) => sum + Number(variant?.cantidad ?? variant?.stock ?? 0),
      0
    );

    console.log("[applyStockDeltaToProduct] Result:", {
      stockVariants: variants,
      totalStock,
    });

    return {
      stockVariants: variants,
      stock: totalStock,
    };
  }

  const currentStock = Number(productData?.stock ?? 0);
  const nextStock = currentStock + delta;

  if (nextStock < 0) {
    throw new Error(`Stock insuficiente para "${productData?.nombre}".`);
  }

  return {
    stock: nextStock,
  };
}
