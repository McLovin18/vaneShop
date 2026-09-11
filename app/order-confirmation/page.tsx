"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import BottomBarPublic from "../components/BottomBarPublic";
import { getCartItemKey } from "../context/userLocalStorage";
import { getSnapshotPricing } from "../lib/pricing";

export default function OrderConfirmationPage() {
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams ?? new URLSearchParams();
  const orderId = safeSearchParams.get("orderId");
  const [copied, setCopied] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { carrito, removeCarrito, isLogged } = useUser();

  // Limpiar carrito cuando la orden se genera
  useEffect(() => {
    if (orderId && carrito.length > 0) {
      carrito.forEach((p) => removeCarrito(getCartItemKey(p)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Cargar datos de la orden
  useEffect(() => {
    if (!orderId) return;
    
    setLoading(true);
    fetch(`/api/ordenes/get-orden?orderId=${orderId}`)
      .then((res) => res.json())
      .then((data) => {
        setOrder(data);
      })
      .catch((err) => {
        console.error("Error cargando orden:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orderId]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const orderLink = orderId ? `${origin}/order-confirmation?orderId=${orderId}` : null;

  const handleCopy = () => {
    if (!orderLink) return;
    navigator.clipboard.writeText(orderLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Simulate order data for demo (replace with real order fetch if needed)
  // Example: const [order, setOrder] = useState(null); useEffect(() => { fetchOrder(orderId).then(setOrder); }, [orderId]);
  // For now, just show the UI for the orderId, and if you want to show products, add a section below:

  return (
    <div
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
      className="min-h-screen flex flex-col mt-2"
    >
      <main className="max-w-2xl mx-auto px-4 py-16 flex-1 flex flex-col items-center text-center">
        <BottomBarPublic/>
        {/* Icono de éxito */}
        <div className="w-20 h-20 rounded-full bg-linear-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center shadow-xl shadow-[color:var(--primary)]/20 mb-4">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold mb-2 text-[var(--primary)]">
          ¡Orden registrada con éxito!
        </h1>

        <div className="flex items-center gap-2 mb-4">
          <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-sm font-bold border border-green-200 dark:border-green-700">
            ✓ Confirmada
          </span>
        </div>

        {orderId && (
          <div className="w-full mb-5 p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/10 rounded-xl">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Número de orden</p>
            <p className="text-2xl font-extrabold text-[var(--primary)] mb-3">{orderId}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Link único de tu orden (guárdalo para consultarla luego)</p>
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 overflow-x-auto">
              <span className="flex-1 text-xs text-slate-700 dark:text-slate-300 break-all text-left">{orderLink}</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[var(--secondary)] hover:bg-[var(--secondaryHover)] text-[var(--secondaryForeground)] text-xs font-bold transition shrink-0"
              >
                <span className="material-icons-round text-sm">{copied ? "check" : "content_copy"}</span>
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>
        )}

        {/* --- Resumen de productos --- */}
        {order && order.productos && order.productos.length > 0 && (
          <div className="w-full mt-8 mb-8">
            <h2 className="text-xl font-bold mb-4 text-left text-[var(--primary)]">
              Productos en tu orden
            </h2>
            <div className="space-y-4">
              {order.productos.map((p: any, i: number) => {
                const precioUnit = Number(p.precioUnitario || p.precioBase || p.precio || 0);
                const cantidad = Number(p.cantidad || 1);
                const subtotal = precioUnit * cantidad;
                const hasDiscount = Number(p.descuento || 0) > 0;
                const discountAmount = hasDiscount ? (precioUnit * (Number(p.descuento) / 100)) : 0;
                const finalPrice = precioUnit - discountAmount;

                return (
                  <div
                    key={i}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800/50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold text-[var(--primary)]">
                          {p.nombre}
                        </h3>
                        {p.sku && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            SKU: {p.sku}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[var(--primary)]">
                          ${finalPrice.toFixed(2)}
                        </p>
                        {hasDiscount && (
                          <p className="text-xs line-through text-slate-400">
                            ${precioUnit.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-300 mb-3">
                      <span>Cantidad: {cantidad}</span>
                      <span className="font-bold">Subtotal: ${subtotal.toFixed(2)}</span>
                    </div>

                    {/* Variantes si existen */}
                    {(p.selectedVariations || p.selectedTalla || p.selectedColor) && (
                      <div className="bg-slate-100 dark:bg-slate-700/50 rounded p-2 mb-3 text-sm">
                        <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Variantes:
                        </p>
                        {/* Si tenemos los nombres, mostrarlos */}
                        {p.selectedVariationsConNombres && Object.entries(p.selectedVariationsConNombres).map(([attrId, attrData]) => (
                          <p key={attrId} className="text-slate-600 dark:text-slate-400">
                            • {attrData.nombre}: <span className="font-semibold">{attrData.valor}</span>
                          </p>
                        ))}
                        {/* Fallback si no tenemos los nombres */}
                        {!p.selectedVariationsConNombres && p.selectedVariations && Object.entries(p.selectedVariations).map(([key, value]) => (
                          <p key={key} className="text-slate-600 dark:text-slate-400">
                            • {key}: <span className="font-semibold">{String(value)}</span>
                          </p>
                        ))}
                        {p.selectedTalla && (
                          <p className="text-slate-600 dark:text-slate-400">
                            • Talla: <span className="font-semibold">{p.selectedTalla}</span>
                          </p>
                        )}
                        {p.selectedColor && (
                          <p className="text-slate-600 dark:text-slate-400">
                            • Color: <span className="font-semibold">{p.selectedColor}</span>
                          </p>
                        )}
                        {p.variacionPersonalizada && (
                          <p className="text-slate-600 dark:text-slate-400">
                            • Nombre para grabado: <span className="font-semibold">{p.variacionPersonalizada}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Personalizaciones si existen */}
                    {p.personalizacionValues && Object.keys(p.personalizacionValues).length > 0 && (
                      <div className="bg-[color:var(--secondary)]/10 border border-[var(--border)] rounded p-3">
                        <p className="font-semibold text-[var(--primary)] mb-2">
                          📝 Personalización:
                        </p>
                        {/* Si tenemos los nombres de los campos, mostrarlos */}
                        {p.personalizacionValuesConNombres && Object.entries(p.personalizacionValuesConNombres).map(([fieldId, fieldData]: [string, any]) => (
                          <p
                            key={fieldId}
                            className="text-sm text-purple-800 dark:text-purple-200 mb-1"
                          >
                            <span className="font-semibold">{fieldData.nombre}:</span> {String(fieldData.valor)}
                          </p>
                        ))}
                        {/* Fallback si no tenemos los nombres */}
                        {!p.personalizacionValuesConNombres && Object.entries(p.personalizacionValues).map(([fieldId, value]) => (
                          <p
                            key={fieldId}
                            className="text-sm text-purple-800 dark:text-purple-200 mb-1"
                          >
                            <span className="font-semibold">{fieldId}:</span> {String(value)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Resumen totales */}
            {(order.subtotal !== undefined || order.descuentoTotal !== undefined || order.total !== undefined) && (
              <div className="mt-6 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                {order.subtotal !== undefined && (
                  <div className="flex justify-between text-sm mb-2">
                    <span>Subtotal:</span>
                    <span>${Number(order.subtotal || 0).toFixed(2)}</span>
                  </div>
                )}
                {order.descuentoTotal !== undefined && Number(order.descuentoTotal) > 0 && (
                  <div className="flex justify-between text-sm mb-2 text-red-600 dark:text-red-400">
                    <span>Descuento:</span>
                    <span>-${Number(order.descuentoTotal).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-[var(--primary)] pt-2 border-t border-[var(--border)]">
                  <span>Total:</span>
                  <span>${Number(order.total || 0).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="w-full mb-8 p-4 text-center">
            <p className="text-slate-600 dark:text-slate-300">Cargando detalles de la orden...</p>
          </div>
        )}

        <p className="text-slate-600 dark:text-slate-300 mb-6">
          Visita el local en la fecha y hora indicadas para retirar tus productos. Presenta el número de orden al llegar.
        </p>

        {!isLogged && (
          <div className="text-slate-600 dark:text-slate-300 mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="mb-2">
              Tu orden ha sido registrada en el sistema. El equipo de administración la revisará y se pondrá en contacto contigo para confirmar los detalles y coordinar la entrega.
            </p>
            <p>
              <Link href="/login" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                Regístrate e inicia sesión
              </Link>{" "}
              para una mejor experiencia de compra.
            </p>
          </div>
        )}

        <Link href="/" className="inline-block px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primaryHover)] text-[var(--primaryForeground)] font-bold rounded-xl shadow-lg">
          Volver al inicio
        </Link>
      </main>
    </div>
  );
}

