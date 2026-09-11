import { NextRequest, NextResponse } from "next/server";
import admin from "../../../lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { Resend } from "resend";
import { getCatalogPricing } from "../../../lib/pricing";

/**
 * 🛒 ENDPOINT: Simular Compra (Crear Orden sin Pago)
 * 
 * Esta es una simulación de compra:
 * 1. Recibe los productos del carrito
 * 2. Crea la orden directamente
 * 3. Deduce el stock de forma atómica
 * 4. Envía correo de confirmación
 * 5. Incluye campos de personalización si existen
 */

function buildOrderEmailHTML(orden: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%); color: white; padding: 32px; text-align: center; }
    .header h1 { margin: 0 0 8px; font-size: 28px; }
    .header p { margin: 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 32px; }
    .order-box { background: #f0f9ff; border-left: 4px solid #6d28d9; padding: 16px; border-radius: 4px; margin-bottom: 24px; }
    .order-box .label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; margin: 0; }
    .order-box .number { font-size: 24px; font-weight: bold; color: #6d28d9; margin: 4px 0 8px; }
    .products-title { font-size: 16px; font-weight: bold; color: #1f2937; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    thead tr { background: #f3f4f6; border-bottom: 2px solid #e5e7eb; }
    th { padding: 12px 8px; text-align: left; font-size: 13px; font-weight: bold; color: #374151; }
    td { padding: 12px 8px; font-size: 13px; color: #374151; border-bottom: 1px solid #e5e7eb; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .product-name { font-weight: bold; }
    .customization { font-size: 11px; color: #666; margin-top: 4px; }
    .discount-badge { font-size: 11px; color: #dc2626; font-weight: bold; }
    .purple-text { color: #6d28d9; font-weight: bold; }
    .totals-box { background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .total-row.bold { font-size: 16px; font-weight: bold; padding-top: 8px; border-top: 2px solid #e5e7eb; }
    .info-box { background: #fef9c3; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
    .info-box p { margin: 8px 0; font-size: 14px; color: #92400e; }
    .info-box p:first-child { margin-top: 0; font-weight: bold; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
    .footer-small { font-size: 11px; color: #d1d5db; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛍️ Marca Estilo</h1>
      <p>Tu orden ha sido recibida - Simulación</p>
    </div>
    
    <div class="content">
      <div class="order-box">
        <p class="label">Número de orden</p>
        <p class="number">${orden.orderId || "N/A"}</p>
        <p style="margin: 8px 0 0; font-size: 13px; color: #666;">
          Fecha: ${orden.createdAt ? new Date(orden.createdAt).toLocaleDateString("es-ES") : "N/A"}
        </p>
      </div>

      <h3 class="products-title">Tus productos</h3>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th class="text-center" style="width: 60px;">Cant.</th>
            <th class="text-right" style="width: 100px;">Precio</th>
            <th class="text-right" style="width: 100px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${
            orden.productos && Array.isArray(orden.productos)
              ? orden.productos.map((p: any) => {
                  const precioUnit = Number(p.precioUnitario || p.precioBase || p.precio || 0);
                  const cantidad = Number(p.cantidad || 1);
                  const subtotal = precioUnit * cantidad;
                  const descuento = Number(p.descuento || 0);
                  const hasDescuento = descuento > 0 && descuento < 100;
                  
                  let customizationHtml = "";
                  if (p.personalizacionValues && Object.keys(p.personalizacionValues).length > 0) {
                    customizationHtml = `<div class="customization"><strong>Personalización:</strong><br/>`;
                    // Si tenemos los nombres, usarlos
                    if (p.personalizacionValuesConNombres && Object.keys(p.personalizacionValuesConNombres).length > 0) {
                      for (const [fieldId, fieldData] of Object.entries(p.personalizacionValuesConNombres)) {
                        customizationHtml += `<strong>${fieldData.nombre}:</strong> ${fieldData.valor}<br/>`;
                      }
                    } else {
                      // Fallback a los valores sin nombres
                      for (const [fieldId, value] of Object.entries(p.personalizacionValues)) {
                        customizationHtml += `${value}<br/>`;
                      }
                    }
                    customizationHtml += `</div>`;
                  }

                  let variationsHtml = "";
                  if (p.selectedVariationsConNombres && Object.keys(p.selectedVariationsConNombres).length > 0) {
                    variationsHtml = `<div class="customization"><strong>Variantes:</strong><br/>`;
                    for (const [attrId, attrData] of Object.entries(p.selectedVariationsConNombres)) {
                      variationsHtml += `<strong>${attrData.nombre}:</strong> ${attrData.valor}<br/>`;
                    }
                    variationsHtml += `</div>`;
                  } else if (p.selectedVariations && Object.keys(p.selectedVariations).length > 0) {
                    variationsHtml = `<div class="customization"><strong>Variantes:</strong><br/>`;
                    for (const [attrId, value] of Object.entries(p.selectedVariations)) {
                      variationsHtml += `${value}<br/>`;
                    }
                    variationsHtml += `</div>`;
                  }
                  const customVariationHtml = p.variacionPersonalizada
                    ? `<div class="customization"><strong>Nombre para grabado:</strong> ${p.variacionPersonalizada}</div>`
                    : "";
                  
                  return `
                  <tr>
                    <td>
                      <span class="product-name">${p.nombre || "Producto"}</span>
                      ${hasDescuento ? `<br><span class="discount-badge">-${Math.round(descuento)}%</span>` : ""}
                      ${variationsHtml}
                      ${customVariationHtml}
                      ${customizationHtml}
                    </td>
                    <td class="text-center">${cantidad}</td>
                    <td class="text-right">$${precioUnit.toFixed(2)}</td>
                    <td class="text-right purple-text">$${subtotal.toFixed(2)}</td>
                  </tr>
                `;
                })
              : "<tr><td colspan='4' style='text-align: center; color: #999;'>No hay productos</td></tr>"
          }
        </tbody>
      </table>

      <div class="totals-box">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>${(orden.total || 0).toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Envío:</span>
          <span style="color: #16a34a; font-weight: bold;">Gratis</span>
        </div>
        <div class="total-row bold">
          <span>Total:</span>
          <span class="purple-text">$${(orden.total || 0).toFixed(2)}</span>
        </div>
      </div>

      <div class="info-box">
        <p>📋 Información</p>
        <p>Esta es una simulación de compra. Tu orden ha sido creada en el sistema y está disponible para revisión del administrador.</p>
      </div>
    </div>

    <div class="footer">
      <p>Este correo fue enviado automáticamente por Marca Estilo</p>
      <p class="footer-small">© ${new Date().getFullYear()} Marca Estilo. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      email,
      productos,
    } = body;

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return NextResponse.json(
        { error: "Productos es requerido y debe ser un array no vacío" },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Email es requerido" },
        { status: 400 }
      );
    }

    const db = admin.firestore();

    // Cargar mapeo de atributos (ID -> nombre)
    let atributosMapping: Record<string, string> = {};
    try {
      const atributosSnap = await db.collection("atributos").get();
      atributosSnap.forEach((doc) => {
        const data = doc.data();
        atributosMapping[doc.id] = data.nombre || doc.id;
      });
    } catch (err) {
      console.warn("Error cargando atributos:", err);
      // Continuar sin nombres si falla
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TRANSACCIÓN ATÓMICA: Validar stock + Deducir stock + Crear orden
    // ─────────────────────────────────────────────────────────────────────────
    const resultado = await db.runTransaction(async (transaction) => {
      // ✅ PASO 1: TODAS LAS LECTURAS PRIMERO
      
      // Lectura 1: Contador de órdenes
      const metaRef = db.collection("ordenes_meta").doc("counter");
      const metaSnap = await transaction.get(metaRef);

      // Lectura 2: Todos los productos
      const productRefs = productos
        .filter((item: any) => item?.id)
        .map((item: any) => db.collection("productos").doc(item.id));

      const productSnaps = await transaction.getAll(...productRefs);

      // ✅ PASO 2: PROCESAR LOS DATOS LEÍDOS (sin acceso a Firestore)
      
      // Generar siguiente número de orden
      const last = metaSnap.exists ? (metaSnap.data()?.lastNumber || 0) : 0;
      const next = last + 1;
      const orderId = `ord-${String(next).padStart(5, "0")}`;

      // Validar stock y procesar productos
      const productDataMap = new Map<string, any>();
      const productosConPrecio: any[] = [];

      for (let i = 0; i < productos.length; i++) {
        const item = productos[i];
        const dbProduct = productSnaps[i];

        if (!dbProduct.exists) {
          throw new Error(`Producto ${item.id} no existe`);
        }

        const dbData = dbProduct.data();
        
        // Validar stock considerando variantes
        let availableStock = 0;
        
        // Si el producto tiene variantes seleccionadas, buscar en stockVariants
        if (item.selectedVariations && item.variationAttributeIds && Array.isArray(dbData?.stockVariants)) {
          const allSelected = item.variationAttributeIds.every((attrId: string) => item.selectedVariations[attrId]);
          if (allSelected) {
            const variant = dbData.stockVariants.find((v: any) => {
              return item.variationAttributeIds.every(
                (attrId: string) => v.attributes?.[attrId] === item.selectedVariations[attrId]
              );
            });
            if (variant) {
              availableStock = Number(variant.cantidad ?? 0);
            }
          }
        }
        // Si el producto tiene talla/color legacy, buscar en stockVariants
        else if (item.selectedTalla && item.selectedColor && Array.isArray(dbData?.stockVariants)) {
          const variant = dbData.stockVariants.find(
            (v: any) => v.talla === item.selectedTalla && v.color === item.selectedColor
          );
          if (variant) {
            availableStock = Number(variant.cantidad ?? variant.stock ?? 0);
          }
        }
        // Si no hay variantes, usar stock general
        else {
          availableStock = Number(dbData?.stock || 0);
        }

        if ((item.cantidad || 1) > availableStock) {
          throw new Error(
            `Stock insuficiente para "${item.nombre}". Disponible: ${availableStock}, Solicitado: ${item.cantidad}`
          );
        }

        productDataMap.set(item.id, dbData);

        // Procesar información del producto
        const precioUnit = item.precioUnitario || item.precioBase || item.precio || dbData?.precio || 0;
        const cantidad = item.cantidad || 1;

        // Mapear personalizacionValues con nombres de campos
        let personalizacionValuesConNombres: Record<string, any> = {};
        if (item.personalizacionValues && dbData?.camposPersonalizacion && Array.isArray(dbData.camposPersonalizacion)) {
          personalizacionValuesConNombres = Object.entries(item.personalizacionValues).reduce((acc, [fieldId, value]) => {
            const campo = (dbData.camposPersonalizacion as any[]).find((c: any) => c.id === fieldId);
            acc[fieldId] = {
              nombre: campo?.nombre || fieldId,
              valor: value,
            };
            return acc;
          }, {} as Record<string, any>);
        } else {
          // Si no hay información de campos, usar los IDs como están
          personalizacionValuesConNombres = Object.entries(item.personalizacionValues || {}).reduce((acc, [fieldId, value]) => {
            acc[fieldId] = {
              nombre: fieldId,
              valor: value,
            };
            return acc;
          }, {} as Record<string, any>);
        }

        // Mapear selectedVariations con nombres de atributos
        let selectedVariationsConNombres: Record<string, any> = {};
        if (item.selectedVariations && item.variationAttributeIds) {
          selectedVariationsConNombres = Object.entries(item.selectedVariations).reduce((acc, [attrId, value]) => {
            acc[attrId] = {
              nombre: atributosMapping[attrId] || attrId,
              valor: value,
            };
            return acc;
          }, {} as Record<string, any>);
        }

        productosConPrecio.push({
          id: item.id,
          nombre: item.nombre || dbData?.nombre || "Producto",
          cantidad,
          precio: precioUnit,
          precioBase: item.precioBase || dbData?.precio,
          precioUnitario: precioUnit,
          descuento: item.descuento || dbData?.descuento || 0,
          imagen: item.imagen || dbData?.imagen,
          bodegaId: item.bodegaId,
          tiempoEntrega: item.tiempoEntrega || dbData?.tiempoEntrega || 72,
          selectedTalla: item.selectedTalla,
          selectedColor: item.selectedColor,
          selectedVariations: item.selectedVariations,
          selectedVariationsConNombres: selectedVariationsConNombres,
          variacionPersonalizada: item.variacionPersonalizada || undefined,
          personalizacionValues: item.personalizacionValues || {},
          personalizacionValuesConNombres: personalizacionValuesConNombres,
        });
      }

      // Calcular total
      const total = productosConPrecio.reduce((sum, p) => {
        const basePrice = p.precioUnitario || p.precioBase || 0;
        const discount = Number(p.descuento || 0);
        const discountedPrice = discount > 0 && discount < 100 ? basePrice * (1 - discount / 100) : basePrice;
        return sum + discountedPrice * p.cantidad;
      }, 0);

      // Crear documento de orden
      const ahora = Timestamp.now();
      const ordenData = {
        orderId,
        userId: userId || null,
        email,
        productos: productosConPrecio,
        total,
        estado: "generada",
        metodo_pago: "simulacion",
        createdAt: ahora,
        updatedAt: ahora,
      };

      // ✅ PASO 3: TODAS LAS ESCRITURAS
      
      // Escribir 1: Actualizar contador (o crear si no existe)
      transaction.set(metaRef, { lastNumber: next }, { merge: true });

      // Escribir 2: Crear orden
      const ordenRef = db.collection("ordenes").doc(orderId);
      transaction.set(ordenRef, ordenData);

      // Escribir 3: Deducir stock (considerando variantes)
      for (let i = 0; i < productos.length; i++) {
        const item = productos[i];
        const dbData = productDataMap.get(item.id);
        const productRef = db.collection("productos").doc(item.id);
        
        // Si tiene variantes seleccionadas, actualizar stockVariants
        if (item.selectedVariations && item.variationAttributeIds && Array.isArray(dbData?.stockVariants)) {
          const newStockVariants = (dbData.stockVariants || []).map((v: any) => {
            const isMatch = item.variationAttributeIds.every(
              (attrId: string) => v.attributes?.[attrId] === item.selectedVariations[attrId]
            );
            if (isMatch) {
              return {
                ...v,
                cantidad: Math.max(0, (v.cantidad || 0) - (item.cantidad || 1)),
              };
            }
            return v;
          });
          transaction.update(productRef, { stockVariants: newStockVariants });
        }
        // Si tiene talla/color legacy, actualizar stockVariants
        else if (item.selectedTalla && item.selectedColor && Array.isArray(dbData?.stockVariants)) {
          const newStockVariants = (dbData.stockVariants || []).map((v: any) => {
            if (v.talla === item.selectedTalla && v.color === item.selectedColor) {
              return {
                ...v,
                cantidad: Math.max(0, (v.cantidad || 0) - (item.cantidad || 1)),
              };
            }
            return v;
          });
          transaction.update(productRef, { stockVariants: newStockVariants });
        }
        // Si no hay variantes, actualizar stock general
        else {
          const currentStock = Number(dbData?.stock || 0);
          const newStock = currentStock - (item.cantidad || 1);
          transaction.update(productRef, { stock: Math.max(0, newStock) });
        }
      }

      return { orderId, ...ordenData };
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Enviar email
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const emailHtml = buildOrderEmailHTML(resultado);
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: "Marca Estilo <noreply@marcaestilo.com>",
        to: email,
        subject: `Tu orden #${resultado.orderId} ha sido recibida`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error("Error enviando email:", emailError);
      // No bloquear si falla el email
    }

    return NextResponse.json({
      success: true,
      orderId: resultado.orderId,
    });
  } catch (error: any) {
    console.error("❌ Error en simular-compra:", error);
    return NextResponse.json(
      { error: error.message || "Error al simular la compra" },
      { status: 500 }
    );
  }
}
