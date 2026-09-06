"use client";
import React, { useState, useEffect } from "react";
import { obtenerBodegas } from "../lib/bodegas-db";
import { getSnapshotPricing } from "../lib/pricing";
import { useUser } from "../context/UserContext";
import BottomBarPublic from "../components/BottomBarPublic";
import { obtenerAtributos } from "../lib/atributos-db";
import {
  CiudadEntrega,
  obtenerCiudadesEntrega,
  obtenerConfiguracionEntrega,
} from "../lib/zonas-entrega-db";

function resolveCartItemKey(item: any) {
  if (!item) return "";
  return item.cartKey || item.variantKey || item.id;
}

function resolveAvailableStock(item: any) {
  if (!item) return 0;

  // Soportar variaciones dinámicas (nuevo sistema)
  if (item.selectedVariations && item.variationAttributeIds && Array.isArray(item.stockVariants)) {
    const allSelected = item.variationAttributeIds.every((attrId: string) => item.selectedVariations[attrId]);
    if (allSelected) {
      const variant = item.stockVariants.find((v: any) => {
        return item.variationAttributeIds.every(
          (attrId: string) => v.attributes?.[attrId] === item.selectedVariations[attrId]
        );
      });
      if (variant) {
        return Number(variant.cantidad ?? 0);
      }
    }
  }

  // Soportar variaciones legacy (talla/color)
  if (item.selectedTalla && item.selectedColor && Array.isArray(item.stockVariants)) {
    const variant = item.stockVariants.find(
      (v: any) => v.talla === item.selectedTalla && v.color === item.selectedColor
    );
    const variantStock = Number(variant?.cantidad ?? variant?.stock ?? variant?.variantStock ?? 0);
    if (variantStock > 0 || variantStock === 0) {
      return variantStock;
    }
  }

  return Number(item.variantStock ?? item.stock ?? 0);
}

// --- Pagina principal del carrito
export default function CartPage() {
  const { carrito: carritoRaw, removeCarrito, addCarrito } = useUser();
  const carrito = carritoRaw as any[];
  const [error, setError] = useState("");
  const { isLogged } = useUser();
  const [atributos, setAtributos] = useState<any[]>([]);
  const [ciudadesEntrega, setCiudadesEntrega] = useState<CiudadEntrega[]>([]);
  const [configuracionEntrega, setConfiguracionEntrega] = useState({ montoMinimoGratis: 25 });
  const [ciudadEntregaId, setCiudadEntregaId] = useState("");
  const [zonaEntregaId, setZonaEntregaId] = useState("");

  const calcularPrecioData = (p: any) => {
    const { basePrice, discount, hasDiscount, fakeOldPrice, finalPrice } = getSnapshotPricing(p);
    return { basePrice, discount, hasDiscount, fakeOldPrice, finalPrice };
  };

  useEffect(() => {
    async function loadAtributos() {
      const data = await obtenerAtributos();
      setAtributos(data);
    }

    loadAtributos();

    Promise.all([obtenerCiudadesEntrega(), obtenerConfiguracionEntrega()])
      .then(([cities, config]) => {
        setCiudadesEntrega(cities);
        setConfiguracionEntrega(config);
      })
      .catch(() => setError("No se pudo cargar la configuración de entregas."));
  }, []);

  const subtotal = carrito.reduce((sum, p) => {
    const { finalPrice } = calcularPrecioData(p);
    return sum + finalPrice * (p.cantidad || 1);
  }, 0);

  const ciudadEntrega = ciudadesEntrega.find((city) => city.id === ciudadEntregaId);
  const zonaEntrega = ciudadEntrega?.zonas?.find((zone) => zone.id === zonaEntregaId);
  const precioCiudadEntrega = Number(ciudadEntrega?.precio ?? 0);
  const envioGratis = subtotal >= configuracionEntrega.montoMinimoGratis;
  const costoEnvio = envioGratis ? 0 : (Number(zonaEntrega?.precio ?? precioCiudadEntrega));
  const total = subtotal + costoEnvio;

  // Arma el texto de la variación seleccionada (talla/color legacy o variaciones dinámicas)
  const getVariationText = (p: any): string => {
    if (p.selectedTalla && p.selectedColor) {
      return ` (Talla: ${p.selectedTalla}, Color: ${p.selectedColor})`;
    }

    if (p.selectedVariations && p.variationAttributeIds && p.variationAttributeIds.length > 0) {
      const parts = p.variationAttributeIds
        .map((attrId: string) => {
          const atributo = atributos.find((a: any) => a.id === attrId);
          const attrName = atributo?.nombre || "Opción";
          const value = p.selectedVariations?.[attrId];
          return value ? `${attrName}: ${value}` : null;
        })
        .filter(Boolean);
      return parts.length > 0 ? ` (${parts.join(", ")})` : "";
    }

    return "";
  };

  const generateWhatsAppMessage = async (): Promise<string> => {
    const bodegas = await obtenerBodegas();
    const bodegasMap = new Map(bodegas.map((b) => [b.id, b.tiempoEntrega]));

    const productosText = carrito
      .map((p) => {
        const tiempoEntrega = bodegasMap.get(p.bodegaId || "technothings") || 72;
        const cantidad = p.cantidad || 1;
        const variationText = getVariationText(p);
        return `• ${cantidad}x ${p.nombre}${variationText} (Entrega Aproximada en: ${tiempoEntrega}h)`;
      })
      .join("\n");

    const headerMsg = "Hola, Me gustaría realizar una compra:";
    const footerMsg = "Quiero confirmar disponibilidad y conocer más detalles. Gracias!";

    const deliveryText = `Ciudad de entrega: ${ciudadEntrega?.nombre}\nZona de entrega: ${zonaEntrega?.nombre}\nEnvío: ${envioGratis ? "GRATIS" : `$${costoEnvio.toFixed(2)}`}`;
    const totalWhatsApp = total;

    const message = `${headerMsg}\n\n${productosText}\n\n${deliveryText}\n\n--------------------\nSubtotal: $${subtotal.toFixed(2)}\nTotal: $${totalWhatsApp.toFixed(2)}\n--------------------\n\n${footerMsg}`;
    return encodeURIComponent(message);
  };

  const handleGenerarOrden = async () => {
    setError("");

    if (carrito.length === 0) {
      setError("El carrito está vacío");
      return;
    }

    if (!ciudadEntrega || !zonaEntrega) {
      setError("Selecciona una ciudad y una zona de entrega para continuar.");
      return;
    }

    for (const p of carrito) {
      const availableStock = resolveAvailableStock(p);
      if (p.cantidad > availableStock) {
        setError(`Solo hay ${availableStock} unidades disponibles de "${p.nombre}".`);
        return;
      }
    }

    const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || "593984880468";
    const message = await generateWhatsAppMessage();
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  };

  const handleCantidad = (id: string, cantidad: number) => {
    if (cantidad < 1) return;
    const prod = carrito.find((p) => resolveCartItemKey(p) === id);
    if (prod) {
      const availableStock = resolveAvailableStock(prod);
      if (cantidad > availableStock) {
        setError(
          `Solo hay ${availableStock} unidades disponibles en stock de "${prod.nombre}".`
        );
        return;
      }
      setError("");
      removeCarrito(id);
      addCarrito({ ...prod, cantidad });
    }
  };

  const EmptyCart = () => (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-20 h-20 rounded-full bg-[var(--muted)] flex items-center justify-center">
        <span className="material-icons-round text-4xl text-[var(--mutedForeground)]">
          shopping_bag
        </span>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-[var(--text)]">
          Tu carrito está vacío
        </h3>
        <p className="text-sm text-[var(--textSecondary)] mt-1">
          Agrega productos para continuar
        </p>
      </div>
      <a
        href="/products-by-category"
        className="mt-2 inline-flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--primary)] hover:shadow-md font-semibold px-6 py-2.5 rounded-xl transition-colors shadow"
      >
        <span className="material-icons-round text-base">storefront</span>
        Ver productos
      </a>
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors">
        <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)]">
              Carrito
            </h1>
            {carrito.length > 0 && (
              <span className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] text-xs font-bold px-2.5 py-1 rounded-full">
                {carrito.length} {carrito.length === 1 ? "producto" : "productos"}
              </span>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-6">
              <span className="material-icons-round text-base mt-0.5 shrink-0">error_outline</span>
              {error}
            </div>
          )}

          {carrito.length === 0 ? (
            <EmptyCart />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-3">
                {carrito.map((p) => {
                  const itemKey = resolveCartItemKey(p);
                  const { hasDiscount, fakeOldPrice, finalPrice, discount } = calcularPrecioData(p);
                  const lineTotal = finalPrice * (p.cantidad || 1);
                  const availableStock = resolveAvailableStock(p);

                  return (
                    <div
                      key={itemKey}
                      className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-sm p-4 flex gap-3 sm:gap-4 items-start"
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden bg-[var(--muted)] border border-[var(--border)] flex items-center justify-center">
                        <img
                          src={p.imagenes?.[0] || "/no-image.png"}
                          alt={p.nombre}
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm sm:text-base leading-tight line-clamp-2 text-[var(--text)]">
                          {p.nombre}
                        </p>
                        {p.selectedTalla && p.selectedColor && (
                          <p className="text-xs text-[var(--textSecondary)] mt-0.5">
                            Talla {p.selectedTalla} · Color {p.selectedColor}
                          </p>
                        )}
                        {p.selectedVariations && p.variationAttributeIds && p.variationAttributeIds.length > 0 && (
                          <p className="text-xs text-[var(--textSecondary)] mt-0.5">
                            {p.variationAttributeIds
                              .map((attrId: string) => {
                                const atributo = atributos.find((a: any) => a.id === attrId);
                                const attrName = atributo?.nombre || "Opción";
                                const value = p.selectedVariations?.[attrId];
                                return value ? `${attrName}: ${value}` : null;
                              })
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}

                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {hasDiscount && (
                            <span className="text-xs text-[var(--textSecondary)] line-through">
                              ${fakeOldPrice?.toFixed(2)}
                            </span>
                          )}
                          <span className="text-sm font-bold text-[var(--text)]">
                            ${finalPrice.toFixed(2)}
                          </span>
                          {hasDiscount && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                              -{discount}%
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                          <div className="flex items-center gap-1 bg-[var(--muted)] rounded-lg p-0.5">
                            <button
                              onClick={() => handleCantidad(itemKey, (p.cantidad || 1) - 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--card)] transition-colors text-[var(--text)] font-bold text-base"
                            >
                              -
                            </button>
                            <span className="w-7 text-center text-sm font-semibold text-[var(--text)]">
                              {p.cantidad || 1}
                            </span>
                            <button
                              onClick={() => handleCantidad(itemKey, (p.cantidad || 1) + 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--card)] transition-colors text-[var(--text)] font-bold text-base"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-xs text-[var(--textSecondary)]">
                            {availableStock} en stock
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end justify-between h-full gap-3 shrink-0">
                        <span className="font-bold text-sm sm:text-base text-[var(--text)]">
                          ${lineTotal.toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeCarrito(itemKey)}
                          className="text-[var(--textSecondary)] hover:text-red-500 transition-colors"
                          title="Eliminar"
                        >
                          <span className="material-icons-round text-xl">delete_outline</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                <a
                  href="/products-by-category"
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--text)] hover:underline mt-1"
                >
                  <span className="material-icons-round text-base">arrow_back</span>
                  Continuar comprando
                </a>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-md p-5 md:sticky md:top-20 space-y-4">
                  <div>
                    <p className="text-base font-bold mb-3 text-[var(--text)]">Resumen del pedido</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm text-[var(--textSecondary)]">
                        <span>
                          Subtotal ({carrito.reduce((n, p) => n + (p.cantidad || 1), 0)} items)
                        </span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-[var(--textSecondary)]">
                        <span>Envío</span>
                        <span className={envioGratis ? "font-semibold text-emerald-600" : ""}>{envioGratis ? "Gratis" : `$${costoEnvio.toFixed(2)}`}</span>
                      </div>

                    </div>
                    <div className="border-t border-[var(--border)] mt-3 pt-3 flex justify-between font-bold text-base">
                      <span className="text-[var(--text)]">Total</span>
                      <span className="text-[var(--text)]">${total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3">
                      <p className="mb-2 text-sm font-bold text-[var(--text)]">¿Dónde quieres recibir tu pedido?</p>
                      <select value={ciudadEntregaId} onChange={(event) => { setCiudadEntregaId(event.target.value); setZonaEntregaId(""); }} className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)]">
                        <option value="">Selecciona una ciudad</option>
                        {ciudadesEntrega.map((city) => <option key={city.id} value={city.id}>{city.nombre}</option>)}
                      </select>
                      <select value={zonaEntregaId} onChange={(event) => setZonaEntregaId(event.target.value)} disabled={!ciudadEntrega} className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50">
                        <option value="">Selecciona una zona</option>
                        {ciudadEntrega?.zonas?.map((zone) => {
                          const precioZona = zone.precio == null ? null : Number(zone.precio);
                          return <option key={zone.id} value={zone.id}>{zone.nombre} · {precioZona == null ? `precio ciudad ($${precioCiudadEntrega.toFixed(2)})` : `$${precioZona.toFixed(2)}`}</option>;
                        })}
                      </select>
                      {ciudadEntrega && (ciudadEntrega.zonas || []).length === 0 && <p className="mt-2 text-xs text-[var(--textSecondary)]">Esta ciudad todavía no tiene zonas configuradas.</p>}
                      {ciudadEntrega && zonaEntrega && <p className="mt-2 text-xs font-semibold text-[var(--textSecondary)]">{envioGratis ? "Tu envío será gratis por alcanzar el mínimo." : `Costo de entrega: $${costoEnvio.toFixed(2)}`}</p>}
                    </div>
                    <button
                      onClick={handleGenerarOrden}
                      disabled={!ciudadEntrega || !zonaEntrega}
                      className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-[var(--primary)] hover:bg-[var(--primaryHover)] text-[var(--primaryForeground)] font-extrabold text-sm rounded-xl transition-colors shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                      title="Enviar pedido por WhatsApp"
                    >
                      <span className="material-icons-round text-base">chat</span>
                      Pedir por WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      {!isLogged && <BottomBarPublic />}
    </>
  );
}