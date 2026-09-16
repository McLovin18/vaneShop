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
} from "../lib/zonas-entrega-db";
import { obtenerCuentasBancariasActivas, obtenerCuentaPorId } from "../lib/cuentas-bancarias";

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
  const { carrito: carritoRaw, removeCarrito, addCarrito, user } = useUser();
  const carrito = carritoRaw as any[];
  const [error, setError] = useState("");
  const { isLogged } = useUser();
  const [atributos, setAtributos] = useState<any[]>([]);
  const [ciudadesEntrega, setCiudadesEntrega] = useState<CiudadEntrega[]>([]);
  const [ciudadEntregaId, setCiudadEntregaId] = useState("");
  const [zonaEntregaId, setZonaEntregaId] = useState("");
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [nombreEnvio, setNombreEnvio] = useState("");
  const [direccionEnvio, setDireccionEnvio] = useState("");
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<any>(null);

  // Modal de transferencia
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transferencia, setTransferencia] = useState({
    nombre: "",
    cedulaRuc: "",
    telefono: "",
    correo: "",
    cuentaBancariaId: "",
    evidencia: null as File | null
  });

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

    // Cargar ciudades de entrega
    obtenerCiudadesEntrega()
      .then((cities) => {
        setCiudadesEntrega(cities);
      })
      .catch(() => setError("No se pudo cargar la configuración de entregas."));

    // Cargar cuentas bancarias activas (no afecta a ciudades si falla)
    obtenerCuentasBancariasActivas()
      .then((cuentas) => {
        setCuentasBancarias(cuentas);
      })
      .catch((error) => {
        console.error("Error cargando cuentas bancarias:", error);
        // No mostrar error ya que las cuentas son opcionales para WhatsApp
      });
  }, []);

  // Cargar cuenta seleccionada cuando cambia el ID
  useEffect(() => {
    if (transferencia.cuentaBancariaId) {
      obtenerCuentaPorId(transferencia.cuentaBancariaId)
        .then((cuenta) => {
          setCuentaSeleccionada(cuenta);
        })
        .catch((error) => {
          console.error("Error cargando cuenta seleccionada:", error);
          setCuentaSeleccionada(null);
        });
    } else {
      setCuentaSeleccionada(null);
    }
  }, [transferencia.cuentaBancariaId]);

  const subtotal = carrito.reduce((sum, p) => {
    const { finalPrice } = calcularPrecioData(p);
    return sum + finalPrice * (p.cantidad || 1);
  }, 0);

  const ciudadEntrega = ciudadesEntrega.find((city) => city.id === ciudadEntregaId);
  const zonaEntrega = ciudadEntrega?.zonas?.find((zone) => zone.id === zonaEntregaId);
  const precioCiudadEntrega = Number(ciudadEntrega?.precio ?? 0);
  const montoMinimoGratisCiudad = Number(ciudadEntrega?.montoMinimoGratis ?? 25);
  const envioGratis = subtotal >= montoMinimoGratisCiudad;
  const cobroFijoZona = zonaEntrega?.cobroFijo !== undefined ? Number(zonaEntrega.cobroFijo) : undefined;
  
  let costoEnvio: number;
  if (envioGratis && cobroFijoZona !== undefined) {
    // Si pasa el mínimo y la zona tiene cobro fijo, se cobra el cobro fijo
    costoEnvio = cobroFijoZona;
  } else if (envioGratis) {
    // Si pasa el mínimo y no hay cobro fijo, envío gratis
    costoEnvio = 0;
  } else {
    // Si no pasa el mínimo, se cobra el precio normal de zona o ciudad
    costoEnvio = Number(zonaEntrega?.precio ?? precioCiudadEntrega);
  }
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
    const footerMsg = "Quiero confirmar disponibilidad y en si hay stock ayudeme con el link de pago. Gracias!";

    const deliveryText = `Ciudad de entrega: ${ciudadEntrega?.nombre}\nZona de entrega: ${zonaEntrega?.nombre}\nDirección: ${direccionEnvio}\nEnvío: ${envioGratis ? "GRATIS" : `$${costoEnvio.toFixed(2)}`}`;
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

    if (!nombreEnvio || nombreEnvio.trim() === "") {
      setError("Por favor ingresa tu nombre para el envío.");
      return;
    }

    if (!direccionEnvio || direccionEnvio.trim() === "") {
      setError("Por favor ingresa tu dirección de entrega.");
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

  const handleTransferirPago = async () => {
    try {
      setError("");
      setIsSubmitting(true);
      
      // Validaciones
      if (!transferencia.nombre || !transferencia.cedulaRuc || !transferencia.telefono || !transferencia.correo || !transferencia.cuentaBancariaId || !transferencia.evidencia) {
        setError("Por favor completa todos los campos");
        setIsSubmitting(false);
        return;
      }

      if (!nombreEnvio || nombreEnvio.trim() === "") {
        setError("Por favor ingresa tu nombre para el envío.");
        setIsSubmitting(false);
        return;
      }

      if (!direccionEnvio || direccionEnvio.trim() === "") {
        setError("Por favor ingresa tu dirección de entrega.");
        setIsSubmitting(false);
        return;
      }

      // Validar email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(transferencia.correo)) {
        setError("Correo electrónico inválido");
        setIsSubmitting(false);
        return;
      }

      // Obtener información de la cuenta bancaria seleccionada
      console.log("🔍 Cuenta bancaria ID:", transferencia.cuentaBancariaId);
      const cuentaInfo = await obtenerCuentaPorId(transferencia.cuentaBancariaId);
      console.log("🔍 Cuenta info obtenida:", cuentaInfo);

      // Preparar datos de la orden
      const ordenData = {
        productos: carrito,
        userId: isLogged ? user?.uid : "guest",
        userEmail: transferencia.correo,
        userName: transferencia.nombre,
        userPhone: transferencia.telefono,
        nombreEnvio: nombreEnvio,
        ciudadEntrega: ciudadEntrega?.nombre,
        zonaEntrega: zonaEntrega?.nombre,
        direccionEnvio: direccionEnvio,
        costoEnvio,
        montoMinimoGratis: montoMinimoGratisCiudad,
        metodoPago: "transferencia",
        transferenciaInfo: {
          cuentaBancariaId: transferencia.cuentaBancariaId,
          cuentaInfo: cuentaInfo,
          nombre: transferencia.nombre,
          cedulaRuc: transferencia.cedulaRuc,
          telefono: transferencia.telefono,
          correo: transferencia.correo,
        }
      };

      // Subir evidencia y crear orden
      const formData = new FormData();
      formData.append('evidencia', transferencia.evidencia);
      formData.append('ordenData', JSON.stringify(ordenData));

      const response = await fetch('/api/ordenes/transferencia', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar la transferencia');
      }

      const result = await response.json();

      // Limpiar carrito y cerrar modal
      carrito.forEach((item) => {
        removeCarrito(resolveCartItemKey(item));
      });
      setShowTransferModal(false);
      setTransferencia({
        nombre: "",
        cedulaRuc: "",
        telefono: "",
        correo: "",
        cuentaBancariaId: "",
        evidencia: null
      });
      setNombreEnvio("");
      setDireccionEnvio("");

      // Enviar al WhatsApp con mensaje de orden enviada
      const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || "593984880468";
      const whatsappMessage = encodeURIComponent(`Hola, acabo de realizar la transacción con la orden #${result.orderId}. Le agradecería que la revisara.`);
      
      // Mostrar mensaje de éxito y redirigir
      setError("");
      alert(`Orden ${result.orderId} creada exitosamente. Te hemos enviado un correo de confirmación. Serás redirigido a WhatsApp.`);
      
      // Redirigir a WhatsApp
      window.location.href = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

    } catch (error: any) {
      setError(error.message || "Error al procesar la transferencia");
    } finally {
      setIsSubmitting(false);
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
                          <div className="flex items-center gap-1 bg-gradient-to-r from-[var(--primary)] to-[var(--primaryHover)] rounded-lg p-0.5 shadow-sm">
                            <button
                              onClick={() => handleCantidad(itemKey, (p.cantidad || 1) - 1)}
                              className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-white/20 transition-colors text-white font-bold text-base"
                              style={{ minHeight: "44px" }}
                            >
                              -
                            </button>
                            <span className="w-9 text-center text-sm font-bold text-white">
                              {p.cantidad || 1}
                            </span>
                            <button
                              onClick={() => handleCantidad(itemKey, (p.cantidad || 1) + 1)}
                              className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-white/20 transition-colors text-white font-bold text-base"
                              style={{ minHeight: "44px" }}
                            >
                              +
                            </button>
                          </div>
                          <span className="text-xs font-medium text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-1 rounded-full">
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
                          style={{ minHeight: "44px", minWidth: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}
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
                        <span className={envioGratis && cobroFijoZona === undefined ? "font-semibold text-emerald-600" : envioGratis && cobroFijoZona !== undefined ? "font-semibold text-amber-600" : ""}>{envioGratis && cobroFijoZona !== undefined ? `$${cobroFijoZona.toFixed(2)} (tarifa especial)` : envioGratis ? "Gratis" : `$${costoEnvio.toFixed(2)}`}</span>
                      </div>

                    </div>
                    <div className="border-t border-[var(--border)] mt-3 pt-3 flex justify-between font-bold text-base">
                      <span className="text-[var(--text)]">Total</span>
                      <span className="text-[var(--text)]">${total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border-2 border-[var(--primary)]/20 bg-gradient-to-br from-[var(--primary)]/5 to-[var(--primaryHover)]/5 p-4 shadow-sm">
                      <p className="mb-3 text-sm font-bold text-[var(--primary)] flex items-center gap-2">
                        <span className="material-icons-round text-lg">person</span>
                        Datos de envío
                      </p>
                      <input
                        type="text"
                        value={nombreEnvio}
                        onChange={(e) => setNombreEnvio(e.target.value)}
                        className="w-full rounded-lg border-2 border-[var(--primary)]/30 bg-white dark:bg-[var(--card)] px-3 py-2.5 text-sm font-medium text-[var(--text)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                        placeholder="Tu nombre para el envío"
                        style={{ minHeight: "44px", fontSize: "16px" }}
                      />
                      <p className="mt-2 text-xs text-[var(--textSecondary)]">Ingresa el nombre de quien recibirá el pedido</p>
                    </div>
                    <div className="rounded-xl border-2 border-[var(--primary)]/20 bg-gradient-to-br from-[var(--primary)]/5 to-[var(--primaryHover)]/5 p-4 shadow-sm">
                      <p className="mb-3 text-sm font-bold text-[var(--primary)] flex items-center gap-2">
                        <span className="material-icons-round text-lg">location_on</span>
                        ¿Dónde quieres recibir tu pedido?
                      </p>
                      
                      {/* Selección de ciudad como botones */}
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-[var(--text)] mb-2">Ciudad</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => { setCiudadEntregaId(""); setZonaEntregaId(""); }}
                            className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${!ciudadEntregaId ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:border-[var(--primary)]/50"}`}
                            style={{ minHeight: "44px", fontSize: "16px" }}
                          >
                            Seleccionar
                          </button>
                          {ciudadesEntrega.map((city) => (
                            <button
                              key={city.id}
                              type="button"
                              onClick={() => { setCiudadEntregaId(city.id); setZonaEntregaId(""); }}
                              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${ciudadEntregaId === city.id ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:border-[var(--primary)]/50"}`}
                              style={{ minHeight: "44px", fontSize: "16px" }}
                            >
                              {city.nombre}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Selección de zona como botones */}
                      {ciudadEntrega && (
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-[var(--text)] mb-2">Zona</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setZonaEntregaId("")}
                              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${!zonaEntregaId ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:border-[var(--primary)]/50"}`}
                              style={{ minHeight: "44px", fontSize: "16px" }}
                            >
                              Seleccionar
                            </button>
                            {ciudadEntrega?.zonas?.map((zone) => (
                              <button
                                key={zone.id}
                                type="button"
                                onClick={() => setZonaEntregaId(zone.id)}
                                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${zonaEntregaId === zone.id ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[var(--card)] text-[var(--text)] hover:border-[var(--primary)]/50"}`}
                                style={{ minHeight: "44px", fontSize: "16px" }}
                              >
                                {zone.nombre}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {ciudadEntrega && (ciudadEntrega.zonas || []).length === 0 && <p className="mt-2 text-xs text-[var(--textSecondary)]">Esta ciudad todavía no tiene zonas configuradas.</p>}
                      {ciudadEntrega && zonaEntrega && <p className="mt-3 text-xs font-semibold text-[var(--primary)] bg-[var(--primary)]/10 px-3 py-2 rounded-lg border border-[var(--primary)]/20">{envioGratis && cobroFijoZona !== undefined ? `Envío con tarifa especial: $${cobroFijoZona.toFixed(2)} (por alcanzar el mínimo)` : envioGratis ? "Tu envío será gratis por alcanzar el mínimo." : `Costo de entrega: $${costoEnvio.toFixed(2)} (Mínimo para envío gratis: $${montoMinimoGratisCiudad.toFixed(2)})`}</p>}
                    </div>
                    <div className="rounded-xl border-2 border-[var(--primary)]/20 bg-gradient-to-br from-[var(--primary)]/5 to-[var(--primaryHover)]/5 p-4 shadow-sm">
                      <p className="mb-3 text-sm font-bold text-[var(--primary)] flex items-center gap-2">
                        <span className="material-icons-round text-lg">location_on</span>
                        Dirección de entrega
                      </p>
                      <input
                        type="text"
                        value={direccionEnvio}
                        onChange={(e) => setDireccionEnvio(e.target.value)}
                        className="w-full rounded-lg border-2 border-[var(--primary)]/30 bg-white dark:bg-[var(--card)] px-3 py-2.5 text-sm font-medium text-[var(--text)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
                        placeholder="Escribe tu dirección específica de entrega"
                        style={{ minHeight: "44px", fontSize: "16px" }}
                      />
                      <p className="mt-2 text-xs text-[var(--textSecondary)]">Ingresa la dirección exacta donde deseas recibir tu pedido</p>
                    </div>
                    <button
                      onClick={handleGenerarOrden}
                      disabled={!ciudadEntrega || !zonaEntrega}
                      className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-[var(--primary)] to-[var(--primaryHover)] hover:from-[var(--primaryHover)] hover:to-[var(--primary)] text-white font-extrabold text-sm rounded-xl transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-md transform hover:scale-[1.02] active:scale-[0.98] touch-action-manipulation"
                      title="Enviar pedido por WhatsApp"
                      style={{ minHeight: "44px", fontSize: "16px" }}
                    >
                      <span className="material-icons-round text-lg">chat</span>
                      Pagar con tarjeta de credito/debito
                      <div className="flex items-center gap-1 ml-1">
                        <svg className="w-6 h-4" viewBox="0 0 48 32" fill="none">
                          <rect width="48" height="32" rx="4" fill="#1A1F71"/>
                          <path d="M19.5 21.5H17L18.5 12H21L19.5 21.5Z" fill="white"/>
                          <path d="M28 12.5C27.5 12.3 26.7 12 25.7 12C23.2 12 21.5 13.2 21.5 15C21.5 16.3 22.7 17 23.7 17.5C24.7 18 25 18.3 25 18.8C25 19.5 24.2 19.8 23.5 19.8C22.5 19.8 21.8 19.6 21 19.2L20.7 19L20.3 21.5C21 21.8 22 22 23.2 22C25.8 22 27.5 20.8 27.5 19C27.5 18 26.8 17.3 25.3 16.5C24.3 16 23.7 15.7 23.7 15.2C23.7 14.8 24.2 14.3 25.3 14.3C26.2 14.3 26.8 14.5 27.3 14.7L27.5 14.8L28 12.5Z" fill="white"/>
                          <path d="M32 12H30C29.5 12 29 12.2 28.8 12.8L25 21.5H27.5L28 20H31L31.3 21.5H33.5L31.5 12H32ZM28.8 18L29.8 15L30.3 18H28.8Z" fill="white"/>
                          <path d="M15 12L12.5 18.5L12.2 17.2C11.7 15.8 10.3 14.2 8.7 13.5L11 21.5H13.5L17.5 12H15Z" fill="white"/>
                          <path d="M10.5 12H6.5L6.5 12.3C9.5 13 11.5 14.8 12.2 17.2L11.5 12.8C11.3 12.2 10.8 12 10.5 12Z" fill="#F9A533"/>
                        </svg>
                        <svg className="w-6 h-4" viewBox="0 0 48 32" fill="none">
                          <rect width="48" height="32" rx="4" fill="#EB001B"/>
                          <rect x="24" width="24" height="32" fill="#F79E1B"/>
                          <path d="M24 6C20.5 6 17.5 8.5 16.5 12C17.5 15.5 20.5 18 24 18C27.5 18 30.5 15.5 31.5 12C30.5 8.5 27.5 6 24 6Z" fill="#FF5F00"/>
                          <path d="M24 8C21.5 8 19.5 9.8 18.8 12C19.5 14.2 21.5 16 24 16C26.5 16 28.5 14.2 29.2 12C28.5 9.8 26.5 8 24 8Z" fill="white"/>
                        </svg>
                      </div>
                    </button>
                    <button
                      onClick={() => setShowTransferModal(true)}
                      disabled={!ciudadEntrega || !zonaEntrega}
                      className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-md transform hover:scale-[1.02] active:scale-[0.98] touch-action-manipulation"
                      title="Pagar por transferencia bancaria"
                      style={{ minHeight: "44px", fontSize: "16px" }}
                    >
                      <span className="material-icons-round text-lg">account_balance</span>
                      Pagar por Transferencia
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      {!isLogged && <BottomBarPublic />}
      
      {/* Modal de Transferencia */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card)] rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--text)]">Pagar por Transferencia</h2>
              <button 
                onClick={() => setShowTransferModal(false)}
                className="text-[var(--textSecondary)] hover:text-[var(--text)]"
              >
                <span className="material-icons-round">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Nombre o razón social</label>
                <input
                  type="text"
                  value={transferencia.nombre}
                  onChange={(e) => setTransferencia({...transferencia, nombre: e.target.value})}
                  className="w-full rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
                  placeholder="Nombre o razón social"
                  style={{ minHeight: "44px", fontSize: "16px" }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Cédula/RUC</label>
                <input
                  type="text"
                  value={transferencia.cedulaRuc}
                  onChange={(e) => setTransferencia({...transferencia, cedulaRuc: e.target.value})}
                  className="w-full rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
                  placeholder="Tu cédula o RUC"
                  style={{ minHeight: "44px", fontSize: "16px" }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={transferencia.telefono}
                  onChange={(e) => setTransferencia({...transferencia, telefono: e.target.value})}
                  className="w-full rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
                  placeholder="0991234567"
                  style={{ minHeight: "44px", fontSize: "16px" }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={transferencia.correo}
                  onChange={(e) => setTransferencia({...transferencia, correo: e.target.value})}
                  className="w-full rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none"
                  placeholder="tu@email.com"
                  style={{ minHeight: "44px", fontSize: "16px" }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Cuenta bancaria</label>
                <select
                  value={transferencia.cuentaBancariaId}
                  onChange={(e) => setTransferencia({...transferencia, cuentaBancariaId: e.target.value})}
                  className="w-full rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none cursor-pointer"
                  style={{ minHeight: "44px", fontSize: "16px", WebkitAppearance: "menulist" }}
                >
                  <option value="">Selecciona una cuenta</option>
                  {cuentasBancarias.map(cuenta => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.banco} - {cuenta.tipo} ({cuenta.numeroCuenta})
                    </option>
                  ))}
                </select>
              </div>
              
              {transferencia.cuentaBancariaId && cuentaSeleccionada && (
                <div className="bg-[var(--primary)]/10 border border-[var(--primary)]/20 rounded-lg p-4">
                  <h3 className="font-bold text-[var(--primary)] mb-2">Información de cuenta</h3>
                  <div className="space-y-1 text-sm text-[var(--text)]">
                    <p><strong>Banco:</strong> {cuentaSeleccionada.banco}</p>
                    <p><strong>Tipo:</strong> {cuentaSeleccionada.tipo}</p>
                    <p><strong>Número:</strong> {cuentaSeleccionada.numeroCuenta}</p>
                    <p><strong>Titular:</strong> {cuentaSeleccionada.titular}</p>
                    <p><strong>Cédula:</strong> {cuentaSeleccionada.cedula}</p>
                    <p><strong>Para transferir a:</strong> {cuentaSeleccionada.nombreParaTransferencia}</p>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1">Evidencia de pago</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setTransferencia({...transferencia, evidencia: e.target.files?.[0] || null})}
                  className="w-full rounded-lg border-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--primary)] focus:outline-none cursor-pointer"
                  style={{ minHeight: "44px", fontSize: "16px" }}
                />
                <p className="text-xs text-[var(--textSecondary)] mt-1">Sube una captura del comprobante de transferencia</p>
              </div>
              
              <button
                onClick={handleTransferirPago}
                disabled={!transferencia.nombre || !transferencia.telefono || !transferencia.correo || !transferencia.cuentaBancariaId || !transferencia.evidencia || isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-action-manipulation"
                style={{ minHeight: "44px", fontSize: "16px" }}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="material-icons-round animate-spin">refresh</span>
                    Procesando...
                  </span>
                ) : (
                  "Enviar Transacción"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}