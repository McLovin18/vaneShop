import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import admin from "../../lib/firebase-admin";
import { getCatalogPricing, getSnapshotPricing } from "../../lib/pricing";
import { findMatchingVariant } from "../../lib/order-checkout-utils";

/**
 * ⚠️ VALIDACIONES DE SEGURIDAD EN ÓRDENES (PROFORMA)
 * 
 * 1. Validar cantidad razonable (anti-ataque)
 * 2. Validar stock disponible
 * 3. Recalcular total desde Firestore
 * 4. Usar getAll en batch (más eficiente)
 */
const MAX_QUANTITY_PER_ITEM = 10;

/**
 * Recalcula y valida el total desde Firestore
 * NUNCA confía en el total enviado por el cliente
 */
async function validarYRecalcularTotal(productos: any[]): Promise<{ 
  total: number; 
  valid: boolean; 
  reason?: string;
  snapshot?: any[];
}> {
  if (!Array.isArray(productos) || productos.length === 0) {
    return { total: 0, valid: false, reason: "No hay productos" };
  }

  const db = admin.firestore();
  let calculatedTotal = 0;
  const snapshot: any[] = [];

  try {
    // Validar cantidades antes de procesar
    for (const item of productos) {
      const cantidad = Number(item.cantidad || 1);
      if (cantidad > MAX_QUANTITY_PER_ITEM) {
        return { 
          total: 0, 
          valid: false, 
          reason: `Cantidad máxima permitida: ${MAX_QUANTITY_PER_ITEM}` 
        };
      }
      if (cantidad < 1) {
        return { total: 0, valid: false, reason: "Cantidad debe ser al menos 1" };
      }
    }

    // 🚀 OPTIMIZACIÓN: Usar getAll en batch
    const productRefs: FirebaseFirestore.DocumentReference[] = [];
    const productIdMap = new Map<string, any>();

    for (const item of productos) {
      if (item?.id && !productIdMap.has(item.id)) {
        productRefs.push(db.collection("productos").doc(item.id));
        productIdMap.set(item.id, item);
      }
    }

    // Obtener todos los productos de una vez
    const productSnaps = await db.getAll(...productRefs);
    const productDataMap = new Map<string, any>();
    
    for (const snap of productSnaps) {
      if (snap.exists) {
        productDataMap.set(snap.id, snap.data());
      }
    }

    // Procesar y validar
    for (const item of productos) {
      if (!item?.id) continue;
      
      const data = productDataMap.get(item.id);
      if (!data) {
        return { total: 0, valid: false, reason: `Producto ${item.id} no existe` };
      }

      const cantidad = Number(item.cantidad || 1);
      const { finalPrice } = getCatalogPricing(data);

      // ⚠️ VALIDACIÓN: Stock disponible (anti-overselling)
      // Verificar stock de variante si el producto tiene variantes y se seleccionó una
      const variantMatch = findMatchingVariant(data, item);
      const availableStock = variantMatch
        ? Number(variantMatch.variant?.cantidad ?? variantMatch.variant?.stock ?? 0)
        : Number(data.stock ?? 0);

      if (availableStock < cantidad) {
        const variantInfo = variantMatch
          ? ` (variante: ${Object.values(variantMatch.variant?.attributes || {}).join(', ') || variantMatch.variant?.talla || variantMatch.variant?.color || 'seleccionada'})`
          : '';
        return {
          total: 0,
          valid: false,
          reason: `Stock insuficiente para "${data.nombre}"${variantInfo}. Disponibles: ${availableStock}, Solicitados: ${cantidad}`
        };
      }

      const lineTotal = finalPrice * cantidad;
      calculatedTotal += lineTotal;

      // 💾 Guardar snapshot de validación
      snapshot.push({
        id: item.id,
        nombre: data.nombre,
        cantidad,
        precioBase: Number(data.precio || 0),
        precioUnitario: finalPrice,
        stock: availableStock,
        timestamp: Date.now(),
      });
    }

    return { total: calculatedTotal, valid: true, snapshot };
  } catch (err: any) {
    console.error("[send-proforma] Error validando total:", err);
    return { total: 0, valid: false, reason: "Error en validación de servidor" };
  }
}

function buildProformaHTML(orden: any): string {
  const rows = orden.productos
    .map((p: any) => {
      const { basePrice, discount, hasDiscount, fakeOldPrice, finalPrice } = getSnapshotPricing(p);
      const subtotal = finalPrice * (p.cantidad || 1);
      return `
        <tr>
          <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb;">${p.nombre}</td>
          <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; text-align:center;">${p.cantidad}</td>
          <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; text-align:right;">
            ${hasDiscount ? `<span style="text-decoration:line-through;color:#9ca3af;font-size:12px;">$${fakeOldPrice?.toFixed(2)}</span><br/>` : ""}
            $${finalPrice.toFixed(2)}
            ${hasDiscount ? `<span style="background:#fee2e2;color:#dc2626;border-radius:4px;padding:1px 5px;font-size:11px;margin-left:4px;">-${discount}%</span>` : ""}
          </td>
          <td style="padding:10px 8px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:bold;">$${subtotal.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);max-width:98vw;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#3a1859,#6d28d9);padding:32px 36px;">
            <h1 style="margin:0;color:#fff;font-size:28px;letter-spacing:1px;">TecnoThings</h1>
            <p style="margin:6px 0 0;color:#e9d5ff;font-size:14px;">Proforma de Orden</p>
          </td>
        </tr>
        <!-- Order ID -->
        <tr>
          <td style="padding:24px 36px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:13px;color:#6b7280;">Número de orden</p>
                  <p style="margin:4px 0 0;font-size:22px;font-weight:bold;color:#3a1859;">${orden.orderId}</p>
                </td>
                <td align="right">
                  <p style="margin:0;font-size:13px;color:#6b7280;">Fecha de visita</p>
                  <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#374151;">${orden.visitaFecha} — ${orden.visitaHora}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Divider -->
        <tr><td style="padding:20px 36px 0;"><hr style="border:none;border-top:1px solid #e5e7eb;"/></td></tr>
        <!-- Products table -->
        <tr>
          <td style="padding:16px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:10px 8px;text-align:left;font-size:13px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Producto</th>
                  <th style="padding:10px 8px;text-align:center;font-size:13px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Cant.</th>
                  <th style="padding:10px 8px;text-align:right;font-size:13px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Precio unit.</th>
                  <th style="padding:10px 8px;text-align:right;font-size:13px;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Subtotal</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </td>
        </tr>
        <!-- Total -->
        <tr>
          <td style="padding:0 36px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 8px;text-align:right;font-size:13px;color:#6b7280;">Envío</td>
                <td style="padding:8px 8px;text-align:right;font-size:13px;color:#16a34a;font-weight:600;width:110px;">Gratis</td>
              </tr>
              <tr style="background:#f5f3ff;border-radius:8px;">
                <td style="padding:12px 8px;text-align:right;font-size:17px;font-weight:bold;color:#3a1859;">Total</td>
                <td style="padding:12px 8px;text-align:right;font-size:20px;font-weight:bold;color:#6d28d9;width:110px;">$${Number(orden.total).toFixed(2)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Info box -->
        <tr>
          <td style="padding:0 36px 32px;">
            <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;">
              <p style="margin:0;font-size:14px;color:#92400e;">
                <strong>¿Qué sigue?</strong> Visita nuestro local el <strong>${orden.visitaFecha}</strong> a las <strong>${orden.visitaHora}</strong> para retirar tus productos. Presenta este número de orden: <strong>${orden.orderId}</strong>
              </p>
              <p style="margin:10px 0 0;font-size:13px;color:#92400e;">
                Para más opciones y seguimiento de pedidos, <a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/login" style="color:#6d28d9;font-weight:bold;">regístrate en TecnoThings</a>.
              </p>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 36px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Este correo fue enviado automáticamente por TecnoThings. No respondas a este mensaje.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

export async function POST(req: NextRequest) {
  try {
    const { orden, email, userId } = await req.json();

    if (!orden || !email || typeof email !== "string" || email.trim() === "" || 
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Email inválido o datos incompletos" }, { status: 400 });
    }

    // ─────── IMPORTAR FUNCIONES ───────
    const { crearReservaStock, liberarReserva } = await import("../../lib/stock-reserves-db");
    const { generateIdempotencyKey, validateIdempotencyKey, saveIdempotencyRecord, getIdempotencyRecord } = await import("../../lib/idempotency-db");
    const { canResendProformaEmail, recordEmailResend } = await import("../../lib/email-rate-limit-db");
    const { cleanupExpiredReserves } = await import("../../lib/stock-cleanup-db");

    // 🔑 IDEMPOTENCY: Generar key para detectar duplicados
    const idempotencyKey = generateIdempotencyKey(userId || email, email.trim(), orden.productos);

    // ✅ Validar idempotency (detectar/bloquear duplicados)
    const idempotencyValidation = await validateIdempotencyKey(
      idempotencyKey,
      userId || email,
      email.trim(),
      orden.productos
    );

    if (!idempotencyValidation.valid) {
      console.warn(`[send-proforma] ⚠️ Idempotency validation failed: ${idempotencyValidation.error}`);
      return NextResponse.json({ error: idempotencyValidation.error }, { status: 400 });
    }

    // ♻️ SI ES DUPLICADO: Devolver respuesta cacheada sin procesar
    if (idempotencyValidation.isDuplicate && idempotencyValidation.record) {
      console.log(`[send-proforma] ♻️ Duplicate request detected, returning cached response`);
      return NextResponse.json({
        success: true,
        cached: true,
        reserveId: idempotencyValidation.record.response.reserveId,
        message: `Esta orden ya fue generada. Se reenviará el correo a ${email.trim()}.`,
      });
    }

    // 📧 RATE LIMIT: Verificar si puede reenviar email
    const rateLimitCheck = await canResendProformaEmail(email.trim(), orden.orderId || "temp");

    if (!rateLimitCheck.canResend) {
      console.warn(`[send-proforma] ⚠️ Rate limit exceeded for ${email}: ${rateLimitCheck.error}`);
      return NextResponse.json(
        {
          error: rateLimitCheck.error || "Demasiados reenvíos. Intenta más tarde.",
          remainingResends: rateLimitCheck.remainingResends,
          nextAvailableAt: rateLimitCheck.nextAvailableAt,
        },
        { status: 429 } // Too Many Requests
      );
    }

    // 🧹 CLEANUP: Ejecutar limpieza de reservas expiradas antes de crear nuevas
    await cleanupExpiredReserves().catch(console.error);

    // ⚠️ VALIDACIÓN CRÍTICA: Recalcular total desde Firestore + stock + cantidad
    const { total: calculatedTotal, valid, reason, snapshot } = await validarYRecalcularTotal(orden.productos);
    
    if (!valid) {
      console.warn(`[send-proforma] ⚠️ Validación fallida: ${reason}`);
      return NextResponse.json({ error: reason || "Error al validar la orden" }, { status: 400 });
    }

    // ⚠️ SEGURIDAD: Validar que el total coincida (tolerancia: 1 centavo por redondeos)
    const tolerance = 0.01;
    const clientTotal = Number(orden.total || 0);
    const difference = Math.abs(calculatedTotal - clientTotal);

    if (difference > tolerance) {
      console.warn(
        `[send-proforma] 🚨 INTENTO DE MANIPULACIÓN DETECTADO:`,
        `Cliente envió: $${clientTotal}, Calculado desde Firestore: $${calculatedTotal}, Diferencia: $${difference}`
      );
      return NextResponse.json(
        { error: "Error al validar el total. Intenta de nuevo." },
        { status: 400 }
      );
    }

    // ─────── CREAR RESERVA DE STOCK PARA PROFORMA ───────
    // Esto bloquea el stock mientras el admin revisa/aprueba
    const stockReserveItems = snapshot!.map((item: any) => ({
      productId: item.id,
      cantidad: item.cantidad,
      snapshot: {
        precio: item.precio,
        stock: item.stock,
        nombre: item.nombre,
      },
    }));

    const reservaResult = await crearReservaStock(
      userId || `guest-proforma-${email}`,
      email.trim(),
      stockReserveItems,
      { type: "proforma", orderId: orden.orderId, total: calculatedTotal }
    );

    if (!reservaResult.success) {
      console.error(`❌ [send-proforma] Error creando reserva: ${reservaResult.error}`);
      return NextResponse.json(
        { error: `No fue posible reservar el stock: ${reservaResult.error}` },
        { status: 400 }
      );
    }

    const reserveId = reservaResult.reserveId;

    // Usar el total recalculado desde Firestore (más seguro)
    const ordenConTotalValido = {
      ...orden,
      total: calculatedTotal,
      validationSnapshot: snapshot,  // 📋 Guard para auditoría
      stockReservation: {
        reserveId,
        status: "pending", // Esperando aprobación del admin
        createdAt: new Date().toISOString(),
      },
    };

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: `Tu proforma de orden ${orden.orderId} — TecnoThings`,
      html: buildProformaHTML(ordenConTotalValido),
    });

    // ─────── GUARDAR EN FIRESTORE CON RESERVA ───────
    const db = admin.firestore();
    const orderId = orden.orderId || `temp-${Date.now()}`;
    
    // Guardar la orden con referencia a la reserva
    await db.collection("ordenes").add({
      ...ordenConTotalValido,
      estado: "proforma_enviada", // Esperando aprobación
      metodoPago: "proforma",
      createdAt: admin.firestore.Timestamp.now(),
    });

    console.log(
      `✅ [PROFORMA_ENVIADA] ${orderId} | Email: ${email} | Total: $${calculatedTotal.toFixed(2)} | ` +
      `Items: ${snapshot?.length || 0} | ReserveID: ${reserveId} | IdempotencyKey: ${idempotencyKey}`
    );

    // ─────── GUARDAR IDEMPOTENCY RECORD ───────
    // Para detectar futuros duplicados y devolver respuesta cacheada
    const idempotencySaveResult = await saveIdempotencyRecord(
      idempotencyKey,
      userId || email,
      email.trim(),
      orden.productos,
      {
        reserveId,
        orderId,
      }
    ).catch((err: any) => {
      console.warn("[send-proforma] Warning saving idempotency record:", err);
    });

    // 📧 REGISTRAR RESEND (para rate limiting)
    const emailRecordResult = await recordEmailResend(
      email.trim(),
      orden.orderId || "temp"
    ).catch((err: any) => {
      console.warn("[send-proforma] Warning recording email resend:", err);
    });

    return NextResponse.json({ 
      success: true,
      cached: false,
      reserveId,
      idempotencyKey,
      remainingResends: rateLimitCheck.remainingResends,
      message: `Proforma enviada a ${email.trim()}. El stock está reservado por 10 minutos.`
    });
  } catch (err: any) {
    console.error("[send-proforma] ❌ Error:", err);
    return NextResponse.json({ error: err.message || "Error al enviar correo" }, { status: 500 });
  }
}
