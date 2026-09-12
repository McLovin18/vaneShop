import { NextRequest, NextResponse } from "next/server";
import admin from "../../../lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { Resend } from "resend";
import { getCatalogPricing } from "../../../lib/pricing";

/**
 * 🛒 ENDPOINT: Crear Orden con Stock Deduction
 * 
 * Cuando el cliente genera una orden (proforma):
 * 1. Valida stock disponible
 * 2. Atomicamente deducen stock de cada producto
 * 3. Crea documento de orden en Firestore
 * 4. Envía correo de confirmación con Resend
 * 
 * Si algo falla, NADA se persiste (transactional integrity)
 * 
 * Esto asegura que el cliente que crea la orden tiene PRIORIDAD
 * Al deducir el stock, otros usuarios no pueden comprar ese stock
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
      <h1>🛍️ VaneShop</h1>
      <p>Tu orden ha sido recibida</p>
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
                  return `
                  <tr>
                    <td>
                      <span class="product-name">${p.nombre || "Producto"}</span>
                      ${hasDescuento ? `<br><span class="discount-badge">-${Math.round(descuento)}%</span>` : ""}
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
          <span>${(orden.total || 0).toFixed(2)}$</span>
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
        <p>📅 Próximos pasos</p>
        <p>Visita nuestro local el <strong>${orden.visitaFecha || "N/A"}</strong> a las <strong>${orden.visitaHora || "N/A"}</strong> para retirar tu pedido.</p>
        <p><strong>Presenta:</strong> Este número de orden <strong>${orden.orderId}</strong> o tu documento</p>
      </div>
    </div>

    <div class="footer">
      <p>Este correo fue enviado automáticamente por VanessaShop</p>
      <p class="footer-small">© ${new Date().getFullYear()} VanessaShop. Todos los derechos reservados.</p>
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
      visitDate,
      visitTime,
      clientPhone,
      clientName,
      clientAddress,
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

    // ─────────────────────────────────────────────────────────────────────────
    // TRANSACCIÓN ATÓMICA: Validar stock + Deducir stock + Crear orden
    // ─────────────────────────────────────────────────────────────────────────
    const resultado = await db.runTransaction(async (transaction) => {
      // ✅ PASO 1: TODAS LAS LECTURAS PRIMERO
      // -------------------------------------------
      
      // Lectura 1: Contador de órdenes
      const metaRef = db.collection("ordenes_meta").doc("counter");
      const metaSnap = await transaction.get(metaRef);

      // Lectura 2: Todos los productos
      const productRefs = productos
        .filter((item: any) => item?.id)
        .map((item: any) => db.collection("productos").doc(item.id));

      const productSnaps = await transaction.getAll(...productRefs);

      // ✅ PASO 2: PROCESAR LOS DATOS LEÍDOS (sin acceso a Firestore)
      // -------------------------------------------
      
      // Generar siguiente número de orden
      const last = metaSnap.exists ? (metaSnap.data()?.lastNumber || 0) : 0;
      const next = last + 1;
      const orderId = `ord-${String(next).padStart(5, "0")}`;

      // Validar stock y procesar productos
      const productDataMap = new Map<string, any>();
      const productosValidados: any[] = [];
      let total = 0;

      for (let i = 0; i < productSnaps.length; i++) {
        const snap = productSnaps[i];
        if (!snap.exists) continue;

        const productId = snap.id;
        const data = snap.data() as any;
        if (!data) continue;
        
        const item = productos.find((p: any) => p.id === productId);

        if (!item) continue;

        const cantidad = Number(item.cantidad || 1);
        const stock = Number(data.stock || 0);

        // ✅ VALIDACIÓN: Stock suficiente (dentro de la transacción)
        if (stock < cantidad) {
          throw new Error(
            `Stock insuficiente para "${data.nombre}". Disponibles: ${stock}, Solicitados: ${cantidad}`
          );
        }

        // Calcular precio
        const { basePrice, discount, hasDiscount, finalPrice } = getCatalogPricing(data);
        const lineTotal = finalPrice * cantidad;

        total += lineTotal;

        productDataMap.set(productId, data);
        productosValidados.push({
          id: productId,
          nombre: data.nombre,
          cantidad,
          precioBase: basePrice,
          descuento: hasDiscount ? discount : 0,
          precioUnitario: finalPrice,
          precioFinal: finalPrice,
          subtotal: lineTotal,
          stockSnapshot: stock,
          bodegaId: data.bodegaId || "technothings",
          precioSnapshot: {
            base: basePrice,
            descuento: discount,
            final: finalPrice,
            timestamp: Date.now(),
          },
        });
      }

      // ✅ PASO 3: TODAS LAS ESCRITURAS (después de terminadas todas las lecturas)
      // -------------------------------------------

      // Escritura 1: Actualizar contador
      transaction.set(metaRef, { lastNumber: next }, { merge: true });

      // Escritura 2: Deducir stock de cada producto
      for (const productSnap of productSnaps) {
        if (!productSnap.exists) continue;

        const item = productos.find(
          (p: any) => p.id === productSnap.id
        );
        if (!item) continue;

        const cantidad = Number(item.cantidad || 1);

        // Deducir stock usando increment (atómico)
        transaction.update(productSnap.ref, {
          stock: admin.firestore.FieldValue.increment(-cantidad),
          lastStockUpdateAt: Timestamp.now(),
        });

        // Guardar historial en subcolección para auditoría
        const historyRef = productSnap.ref
          .collection("stock_history")
          .doc(`order_${orderId}_${Date.now()}`);
        transaction.set(historyRef, {
          type: "order_created",
          cantidad: -cantidad,
          orderId,
          timestamp: Timestamp.now(),
          orderType: "proforma",
        });
      }

      // Escritura 3: Crear documento de orden
      const now = Timestamp.now();
      const ordenData = {
        orderId,
        userId: userId || "guest",
        email,
        productos: productosValidados,
        total,
        estado: "generada", // Proforma/Generada
        visitaFecha: visitDate || null,      // ✅ Nombre correcto para admin
        visitaHora: visitTime || null,       // ✅ Nombre correcto para admin
        clientPhone: clientPhone || null,
        userName: clientName || null,        // ✅ Admin espera userName
        clientAddress: clientAddress || null,
        createdAt: now,
        stockReserved: true, // ✅ Stock ha sido deducido
        stockReservedAt: now,
      };

      const ordenRef = db.collection("ordenes").doc();
      transaction.set(ordenRef, ordenData);

      return {
        id: ordenRef.id,
        ...ordenData,
        createdAt: now.toDate(),
        stockReservedAt: now.toDate(),
      };
    });

    console.log(
      `✅ [ORDEN_CREADA] ${resultado.orderId} | ` +
      `Productos: ${resultado.productos.length} | ` +
      `Total: $${resultado.total.toFixed(2)} | ` +
      `Stock: DEDUCIDO`
    );

    // 📧 Enviar email de confirmación con Resend (no-blocking)
    // Si falla el email, la orden ya existe, así que no respondemos con error
    if (resultado.email) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const emailResponse = await resend.emails.send({
          from: "pedidos@vanessashop.com",
          to: resultado.email,
          subject: `Tu pedido ${resultado.orderId} ha sido recibido — VanessaShop`,
          html: buildOrderEmailHTML(resultado),
          replyTo: "soporte@vanessashop.com",
        });

        if (emailResponse.error) {
          console.warn(
            `⚠️ [EMAIL_FALLÓ] ${resultado.orderId}: ${emailResponse.error.message}`
          );
        } else {
          console.log(
            `✅ [EMAIL_ENVIADO] ${resultado.orderId} | ResendId: ${emailResponse.data?.id}`
          );
        }
      } catch (emailError: any) {
        console.warn(
          `⚠️ [EMAIL_EXCEPTION] ${resultado.orderId}: ${emailError.message}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Orden generada exitosamente. Stock reservado. Correo de confirmación enviado.",
      orden: resultado,
    });
  } catch (error: any) {
    console.error("[api/ordenes/crear] ❌ Error:", error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al crear la orden",
      },
      { status: error.message?.includes("Stock insuficiente") ? 409 : 500 }
    );
  }
}
