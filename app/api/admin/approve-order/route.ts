import { NextRequest, NextResponse } from "next/server";
import admin from "../../../lib/firebase-admin";
import { deducirStockOrden } from "../../../lib/ordenes-db";
import { Resend } from "resend";
import { getSnapshotPricing } from "../../../lib/pricing";
import { obtenerAtributos } from "../../../lib/atributos-db";

// Helper function to get variation text for display
async function getVariationText(p: any, atributosMap: Record<string, string>): Promise<string> {
  const parts: string[] = [];
  
  // Mostrar variaciones seleccionadas (formato: ID atributo -> valor)
  if (p.selectedVariations && typeof p.selectedVariations === 'object') {
    Object.entries(p.selectedVariations).forEach(([attrId, value]) => {
      if (value) {
        const attrName = atributosMap[attrId] || attrId;
        parts.push(`${attrName}: ${value}`);
      }
    });
  }
  
  // Mostrar variación personalizada si existe
  if (p.variacionPersonalizada && typeof p.variacionPersonalizada === 'string' && p.variacionPersonalizada.trim()) {
    parts.push(`Variación: ${p.variacionPersonalizada.trim()}`);
  }
  
  // Mostrar valores de personalización si existen
  if (p.personalizacionValues && typeof p.personalizacionValues === 'object') {
    Object.entries(p.personalizacionValues).forEach(([campoId, valor]) => {
      if (valor && typeof valor === 'string' && valor.trim()) {
        const campoName = atributosMap[campoId] || campoId;
        parts.push(`${campoName}: ${valor.trim()}`);
      }
    });
  }
  
  return parts.length > 0 ? `<br><span style="font-size:12px;color:#666;">${parts.join(' | ')}</span>` : '';
}

/**
 * ✅ ENDPOINT: Aprobar orden de transferencia
 * 
 * Cuando el admin aprueba una orden pendiente de aprobación:
 * 1. Deduce el stock de los productos
 * 2. Actualiza estado de la orden a "aprobada"
 * 3. Envía correo de notificación al cliente
 * 4. Envía correo de notificación al dueño
 * 
 * ✅ SECURITY: Protegido con token de administrador
 */

/**
 * Verify admin authentication token
 * @param req - Next.js request
 * @returns true if token is valid, false otherwise
 * 
 * Token debe enviarse en header: x-admin-token: <token>
 * Token esperado está en env var: NEXT_PUBLIC_ADMIN_TOKEN
 */
function verifyAdminToken(req: NextRequest): boolean {
  const tokenFromRequest = req.headers.get("x-admin-token");
  const tokenExpected = process.env.NEXT_PUBLIC_ADMIN_TOKEN;

  if (!tokenExpected) {
    console.error("[SECURITY] NEXT_PUBLIC_ADMIN_TOKEN no configurado en variables de entorno");
    return false;
  }

  if (!tokenFromRequest) {
    console.warn("[SECURITY] /admin/approve-order llamado sin x-admin-token header");
    return false;
  }

  if (tokenFromRequest !== tokenExpected) {
    console.warn(`[SECURITY] /admin/approve-order llamado con token inválido`);
    return false;
  }

  return true;
}

export async function POST(req: NextRequest) {
  try {
    // ✅ SECURITY: Verificar autenticación PRIMERO
    if (!verifyAdminToken(req)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          message: "Token de administrador inválido o faltante. Usa header: x-admin-token: <token>",
        },
        { status: 403 }
      );
    }

    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId es requerido" },
        { status: 400 }
      );
    }

    const db = admin.firestore();

    // ─────── ENCONTRAR LA ORDEN ───────
    let orderDoc: any = null;
    let orderRef: FirebaseFirestore.DocumentReference | null = null;

    if (orderId.startsWith("ord-")) {
      // Buscar por orderId
      const query = db
        .collection("ordenes")
        .where("orderId", "==", orderId)
        .limit(1);
      const snaps = await query.get();

      if (!snaps.empty) {
        orderDoc = snaps.docs[0].data();
        orderRef = snaps.docs[0].ref;
      }
    } else {
      // Asumir que es el document ID
      const snap = await db.collection("ordenes").doc(orderId).get();
      if (snap.exists) {
        orderDoc = snap.data();
        orderRef = snap.ref;
      }
    }

    if (!orderDoc || !orderRef) {
      return NextResponse.json(
        { error: `Orden ${orderId} no encontrada` },
        { status: 404 }
      );
    }

    // ✅ SECURITY: Verificar que la orden esté pendiente de aprobación
    if (orderDoc.estado !== "pendiente_aprobacion") {
      return NextResponse.json(
        { 
          error: `❌ NO se puede aprobar. La orden no está pendiente de aprobación. Estado: "${orderDoc.estado}"`,
          reason: "Estado inválido para aprobación"
        },
        { status: 403 }
      );
    }

    // ─────── DEDUCIR STOCK ───────
    await db.runTransaction(async (transaction) => {
      const ordenSnap = await transaction.get(orderRef);
      const orden = ordenSnap.data();

      if (!orden || !orden.productos) return;

      for (const producto of orden.productos) {
        const prodRef = db.collection("productos").doc(producto.id);
        const prodSnap = await transaction.get(prodRef);

        if (prodSnap.exists) {
          const stockActual = prodSnap.data()?.stock || 0;
          const nuevoStock = Math.max(0, stockActual - producto.cantidad);
          transaction.update(prodRef, { stock: nuevoStock });
        }
      }
    });

    // ─────── ACTUALIZAR ESTADO DE LA ORDEN ───────
    await orderRef.update({
      estado: "aprobada",
      aprobadaEn: admin.firestore.Timestamp.now(),
    });

    // ─────── ENVIAR CORREOS DE NOTIFICACIÓN ───────
    // Enviar correo al cliente
    await enviarCorreoAprobacionCliente(orderDoc);
    
    // Enviar correo al dueño
    await enviarCorreoAprobacionDueño(orderDoc);

    // ─────── LOGGING DE AUDITORÍA ───────
    console.log(
      `✅ [ORDEN_APROBADA] ${orderDoc.orderId} | ` +
      `Cliente: ${orderDoc.userEmail || orderDoc.transferenciaInfo?.correo}`
    );

    return NextResponse.json({
      success: true,
      message: `Orden ${orderDoc.orderId} aprobada exitosamente.`,
    });

  } catch (err: any) {
    console.error("[admin/approve-order] ❌ Error:", err);
    return NextResponse.json(
      { error: err.message || "Error al aprobar la orden" },
      { status: 500 }
    );
  }
}

async function enviarCorreoAprobacionCliente(orden: any) {
  try {
    console.log("[APPROVE_ORDER] Iniciando envío de correo al cliente");
    console.log("[APPROVE_ORDER] Orden:", orden.orderId);
    console.log("[APPROVE_ORDER] transferenciaInfo.correo:", orden.transferenciaInfo?.correo);
    console.log("[APPROVE_ORDER] userEmail:", orden.userEmail);

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("[APPROVE_ORDER] RESEND_API_KEY no configurado");
      return;
    }

    const resend = new Resend(resendApiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "pedidos@vanessashop.com";
    const customerEmail = orden.transferenciaInfo?.correo || orden.userEmail;

    console.log("[APPROVE_ORDER] fromEmail:", fromEmail);
    console.log("[APPROVE_ORDER] customerEmail final:", customerEmail);

    if (!customerEmail) {
      console.error("[APPROVE_ORDER] No hay correo del cliente");
      return;
    }

    // Cargar atributos para mostrar nombres en lugar de IDs
    const atributos = await obtenerAtributos();
    const atributosMap: Record<string, string> = {};
    atributos.forEach((attr: any) => {
      atributosMap[attr.id] = attr.nombre;
    });

    console.log("[APPROVE_ORDER] Generando HTML del correo...");
    const emailHTML = await buildAprobacionClienteEmailHTML(orden, atributosMap);

    console.log("[APPROVE_ORDER] Enviando correo a Resend...");
    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: customerEmail,
      subject: `Orden ${orden.orderId} Aprobada - VaneShop`,
      html: emailHTML,
    });

    console.log("[APPROVE_ORDER] Resend response:", JSON.stringify(emailResponse));

    if (emailResponse.error) {
      console.error(`[APPROVE_ORDER] Error enviando correo al cliente: ${emailResponse.error?.message}`);
    } else {
      console.log(`✅ [APPROVE_CLIENTE_EMAIL] Orden ${orden.orderId} enviada a ${customerEmail}`);
    }

  } catch (error) {
    console.error("[APPROVE_ORDER] Error enviando correo al cliente:", error);
    // No fallar el proceso si el correo falla
  }
}

async function enviarCorreoAprobacionDueño(orden: any) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("[APPROVE_ORDER] RESEND_API_KEY no configurado");
      return;
    }

    const resend = new Resend(resendApiKey);
    const ownerEmail = process.env.OWNER_EMAIL || "soporte@vanessashop.com";
    const fromEmail = process.env.RESEND_FROM_EMAIL || "pedidos@vanessashop.com";

    // Cargar atributos para mostrar nombres en lugar de IDs
    const atributos = await obtenerAtributos();
    const atributosMap: Record<string, string> = {};
    atributos.forEach((attr: any) => {
      atributosMap[attr.id] = attr.nombre;
    });

    const emailHTML = await buildAprobacionDueñoEmailHTML(orden, atributosMap);

    await resend.emails.send({
      from: fromEmail,
      to: ownerEmail,
      subject: `✅ Orden ${orden.orderId} aprobada - Confirmación`,
      html: emailHTML,
      replyTo: orden.transferenciaInfo?.correo || orden.userEmail,
    });

    console.log(`✅ [APPROVE_DUEÑO_EMAIL] Orden ${orden.orderId} enviada a ${ownerEmail}`);

  } catch (error) {
    console.error("[APPROVE_ORDER] Error enviando correo al dueño:", error);
    // No fallar el proceso si el correo falla
  }
}

async function buildAprobacionClienteEmailHTML(orden: any, atributosMap: Record<string, string>): Promise<string> {
  // Procesar productos de forma asíncrona antes de generar HTML
  let productosHTML = "";
  if (orden.productos && Array.isArray(orden.productos)) {
    const productosRows = await Promise.all(orden.productos.map(async (p: any) => {
      const { finalPrice } = getSnapshotPricing(p);
      const variationText = await getVariationText(p, atributosMap);
      return `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:12px 8px;font-size:13px;color:#374151;">
            <strong>${p.nombre || "Producto"}</strong>${variationText}
          </td>
          <td style="padding:12px 8px;text-align:center;font-size:13px;color:#374151;">${p.cantidad}</td>
          <td style="padding:12px 8px;text-align:right;font-size:13px;font-weight:bold;color:#10b981;">$${(finalPrice * (p.cantidad || 1)).toFixed(2)}</td>
        </tr>
      `;
    }));
    productosHTML = productosRows.join('');
  } else {
    productosHTML = "<tr><td colspan=3 style='padding:12px;text-align:center;color:#999;'>No hay productos</td></tr>";
  }

  // Calcular subtotal y total
  const subtotal = orden.productos && Array.isArray(orden.productos) 
    ? orden.productos.reduce((sum: number, p: any) => {
        const { finalPrice } = getSnapshotPricing(p);
        return sum + finalPrice * (p.cantidad || 1);
      }, 0) 
    : 0;
  const total = subtotal + (orden.costoEnvio || 0);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
</head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:white;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr>
      <td>
        <!-- Header con gradiente verde -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);border-radius:12px 12px 0 0;">
          <tr>
            <td style="padding:32px;text-align:center;color:white;">
              <h1 style="margin:0 0 8px;font-size:28px;font-weight:bold;">Orden Aprobada</h1>
              <p style="margin:0;font-size:14px;opacity:0.9;">Confirmación de aprobación</p>
            </td>
          </tr>
        </table>

        <!-- Número de orden -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:24px 36px;">
              <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:16px;border-radius:4px;">
                <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:bold;">Número de orden</p>
                <p style="margin:0;font-size:24px;font-weight:bold;color:#10b981;">${orden.orderId || "N/A"}</p>
                <p style="margin:8px 0 0;font-size:13px;color:#666;">Fecha de aprobación: ${new Date().toLocaleDateString("es-ES")}</p>
                <p style="margin:8px 0 0;font-size:13px;color:#666;">Estado: <strong>Aprobada</strong></p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Información de envío -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1f2937;">Información de envío</h2>
              <div style="background:#f9fafb;border-radius:8px;padding:16px;">
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Ciudad:</strong> ${orden.ciudadEntrega || "N/A"}</p>
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Zona:</strong> ${orden.zonaEntrega || "N/A"}</p>
                <p style="margin:0;font-size:14px;color:#374151;"><strong>Dirección:</strong> ${orden.direccionEnvio || "N/A"}</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Resumen de productos -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1f2937;">Resumen del pedido</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <thead>
                  <tr style="background:#f3f4f6;border-bottom:2px solid #e5e7eb;">
                    <th style="padding:12px 8px;text-align:left;font-size:13px;font-weight:bold;color:#374151;">Producto</th>
                    <th style="padding:12px 8px;text-align:center;font-size:13px;font-weight:bold;color:#374151;width:60px;">Cant.</th>
                    <th style="padding:12px 8px;text-align:right;font-size:13px;font-weight:bold;color:#374151;width:100px;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${productosHTML}
                </tbody>
              </table>
            </td>
          </tr>
        </table>

        <!-- Totales -->
        <tr>
          <td style="padding:0 36px 24px;">
            <div style="background:#f9fafb;border-radius:8px;padding:16px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
                <span style="color:#666;">Subtotal:</span>
                <span style="color:#1f2937;font-weight:bold;">$${subtotal.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
                <span style="color:#666;">Envío:</span>
                <span style="color:#1f2937;font-weight:bold;">$${(orden.costoEnvio || 0).toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:2px solid #e5e7eb;font-size:16px;font-weight:bold;">
                <span style="color:#1f2937;">Total:</span>
                <span style="color:#10b981;">$${total.toFixed(2)}</span>
              </div>
            </div>
          </td>
        </tr>

        <!-- Información importante -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <div style="background:#dbeafe;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;">
                <p style="margin:0 0 12px;font-size:14px;color:#1e40af;font-weight:bold;">Información de envío</p>
                <p style="margin:0 0 8px;font-size:14px;color:#1e40af;">
                  Ciudad: ${orden.ciudadEntrega || "N/A"}
                </p>
                <p style="margin:0 0 8px;font-size:14px;color:#1e40af;">
                  Zona: ${orden.zonaEntrega || "N/A"}
                </p>
                <p style="margin:0;font-size:14px;color:#1e40af;">
                  Dirección: ${orden.direccionEnvio || "N/A"}
                </p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 36px;text-align:center;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">Este correo fue enviado automáticamente por VanessaShop</p>
            <p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} VanessaShop. Todos los derechos reservados.</p>
          </td>
        </tr>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

async function buildAprobacionDueñoEmailHTML(orden: any, atributosMap: Record<string, string>): Promise<string> {
  const userInfo = orden.transferenciaInfo || {};

  // Procesar productos de forma asíncrona antes de generar HTML
  let productosHTML = "";
  if (orden.productos && Array.isArray(orden.productos)) {
    const productosRows = await Promise.all(orden.productos.map(async (p: any) => {
      const { finalPrice } = getSnapshotPricing(p);
      const variationText = await getVariationText(p, atributosMap);
      return `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:12px 8px;font-size:13px;color:#374151;">
            <strong>${p.nombre || "Producto"}</strong>${variationText}
          </td>
          <td style="padding:12px 8px;text-align:center;font-size:13px;color:#374151;">${p.cantidad}</td>
          <td style="padding:12px 8px;text-align:right;font-size:13px;font-weight:bold;color:#10b981;">$${(finalPrice * (p.cantidad || 1)).toFixed(2)}</td>
        </tr>
      `;
    }));
    productosHTML = productosRows.join('');
  } else {
    productosHTML = "<tr><td colspan=3 style='padding:12px;text-align:center;color:#999;'>No hay productos</td></tr>";
  }

  // Calcular subtotal y total
  const subtotal = orden.productos && Array.isArray(orden.productos) 
    ? orden.productos.reduce((sum: number, p: any) => {
        const { finalPrice } = getSnapshotPricing(p);
        return sum + finalPrice * (p.cantidad || 1);
      }, 0) 
    : 0;
  const total = subtotal + (orden.costoEnvio || 0);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
</head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:white;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr>
      <td>
        <!-- Header con gradiente verde -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);border-radius:12px 12px 0 0;">
          <tr>
            <td style="padding:32px;text-align:center;color:white;">
              <h1 style="margin:0 0 8px;font-size:28px;font-weight:bold;">✅ Orden Aprobada</h1>
              <p style="margin:0;font-size:14px;opacity:0.9;">Confirmación de aprobación</p>
            </td>
          </tr>
        </table>

        <!-- Número de orden -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:24px 36px;">
              <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:16px;border-radius:4px;">
                <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:bold;">Número de orden</p>
                <p style="margin:0;font-size:24px;font-weight:bold;color:#10b981;">${orden.orderId || "N/A"}</p>
                <p style="margin:8px 0 0;font-size:13px;color:#666;">Fecha de aprobación: ${new Date().toLocaleDateString("es-ES")}</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Información del cliente -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1f2937;">Información del cliente</h2>
              <div style="background:#f9fafb;border-radius:8px;padding:16px;">
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Nombre:</strong> ${userInfo.nombre || orden.userName || "N/A"}</p>
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Teléfono:</strong> ${userInfo.telefono || orden.userPhone || "N/A"}</p>
                <p style="margin:0;font-size:14px;color:#374151;"><strong>Correo:</strong> ${userInfo.correo || orden.userEmail || "N/A"}</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Información de envío -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1f2937;">Información de envío</h2>
              <div style="background:#f9fafb;border-radius:8px;padding:16px;">
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Ciudad:</strong> ${orden.ciudadEntrega || "N/A"}</p>
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Zona:</strong> ${orden.zonaEntrega || "N/A"}</p>
                <p style="margin:0;font-size:14px;color:#374151;"><strong>Dirección:</strong> ${orden.direccionEnvio || "N/A"}</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Resumen de productos -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1f2937;">Resumen del pedido</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <thead>
                  <tr style="background:#f3f4f6;border-bottom:2px solid #e5e7eb;">
                    <th style="padding:12px 8px;text-align:left;font-size:13px;font-weight:bold;color:#374151;">Producto</th>
                    <th style="padding:12px 8px;text-align:center;font-size:13px;font-weight:bold;color:#374151;width:60px;">Cant.</th>
                    <th style="padding:12px 8px;text-align:right;font-size:13px;font-weight:bold;color:#374151;width:100px;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${productosHTML}
                </tbody>
              </table>
            </td>
          </tr>
        </table>

        <!-- Totales -->
        <tr>
          <td style="padding:0 36px 24px;">
            <div style="background:#f9fafb;border-radius:8px;padding:16px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
                <span style="color:#666;">Subtotal:</span>
                <span style="color:#1f2937;font-weight:bold;">$${subtotal.toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
                <span style="color:#666;">Envío:</span>
                <span style="color:#1f2937;font-weight:bold;">$${(orden.costoEnvio || 0).toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:2px solid #e5e7eb;font-size:16px;font-weight:bold;">
                <span style="color:#1f2937;">Total:</span>
                <span style="color:#10b981;">$${total.toFixed(2)}</span>
              </div>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 36px;text-align:center;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">Este correo fue enviado automáticamente por VanessaShop</p>
            <p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} VanessaShop. Todos los derechos reservados.</p>
          </td>
        </tr>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
