import { NextRequest, NextResponse } from "next/server";
import admin from "../../../lib/firebase-admin";

/**
 * 🚨 ENDPOINT: Rechazar orden de proforma
 * 
 * Cuando el admin rechaza una orden (proforma o pendiente de pago):
 * 1. Libera la reserva de stock (devuelve a disponible)
 * 2. Actualiza estado de la orden
 * 3. Notifica al cliente (opcional)
 * 
 * También puede usarse para cancelar órdenes pagadas pero no confirmadas
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
    console.warn("[SECURITY] /admin/reject-order llamado sin x-admin-token header");
    return false;
  }

  if (tokenFromRequest !== tokenExpected) {
    console.warn(`[SECURITY] /admin/reject-order llamado con token inválido`);
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

    const { orderId, reserveId, reason } = await req.json();

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

    // ✅ SECURITY: Verificar que el pago no esté ya confirmado
    // Si la orden ya está confirmada (pagada), NO se puede liberar stock
    if (orderDoc.estado === "confirmed" || orderDoc.estado === "completada") {
      return NextResponse.json(
        { 
          error: `❌ NO se puede rechazar. El pago ya fue procesado. Estado: "${orderDoc.estado}"`,
          reason: "Pago confirmado - Contactar al procesador de pagos para reembolso"
        },
        { status: 403 }
      );
    }

    // ─────── LIBERAR STOCK SI FUE RESERVADO EN ORDEN GENERADA ───────
    // Si la orden tiene stockReserved = true, devolver el stock
    let itemsReleased = 0;

    if (orderDoc.stockReserved === true && orderDoc.productos) {
      const result = await db.runTransaction(async (transaction) => {
        let released = 0;

        // Para cada producto en la orden, restaurar stock
        for (const producto of orderDoc.productos) {
          const productRef = db.collection("productos").doc(producto.id);

          // Restaurar stock usando increment (atómico)
          transaction.update(productRef, {
            stock: admin.firestore.FieldValue.increment(producto.cantidad),
            lastStockUpdateAt: admin.firestore.Timestamp.now(),
          });

          // Guardar historial de liberación
          const historyRef = productRef
            .collection("stock_history")
            .doc(`reject_${orderDoc.orderId}_${Date.now()}`);
          transaction.set(historyRef, {
            type: "order_rejected",
            cantidad: producto.cantidad, // Positivo porque se devuelve
            orderId: orderDoc.orderId,
            timestamp: admin.firestore.Timestamp.now(),
            reason: reason || "Rechazada por el administrador",
          });

          released++;
        }

        return released;
      });

      itemsReleased = result;
    }

    // ─────── ACTUALIZAR ESTADO DE LA ORDEN ───────
    await orderRef.update({
      estado: "rechazada",
      estadoRazon: reason || "Rechazada por el administrador",
      rechazadaEn: admin.firestore.Timestamp.now(),
      stockReserved: false, // Ya no está reservado
      stockReservedAt: null,
    });

    // ─────── LOGGING DE AUDITORÍA ───────
    console.log(
      `✅ [ORDEN_RECHAZADA] ${orderDoc.orderId} | ` +
      `Items con stock liberado: ${itemsReleased} | ` +
      `Razón: ${reason || "No especificada"}`
    );

    return NextResponse.json({
      success: true,
      message: `Orden ${orderDoc.orderId} rechazada. ${itemsReleased} productos restaurados al stock.`,
      itemsReleased,
    });

  } catch (err: any) {
    console.error("[admin/reject-order] ❌ Error:", err);
    return NextResponse.json(
      { error: err.message || "Error al rechazar la orden" },
      { status: 500 }
    );
  }
}

/**
 * GET: Ver estado de rechazo de una orden
 */
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId es requerido" },
        { status: 400 }
      );
    }

    const db = admin.firestore();
    
    const query = db
      .collection("ordenes")
      .where("orderId", "==", orderId)
      .limit(1);
    const snaps = await query.get();

    if (snaps.empty) {
      return NextResponse.json(
        { error: `Orden ${orderId} no encontrada` },
        { status: 404 }
      );
    }

    const orderDoc = snaps.docs[0].data();

    return NextResponse.json({
      orderId: orderDoc.orderId,
      estado: orderDoc.estado,
      estadoRazon: orderDoc.estadoRazon,
      rechazadaEn: orderDoc.rechazadaEn,
      stockReservation: orderDoc.stockReservation,
    });

  } catch (err: any) {
    console.error("[admin/reject-order GET] ❌ Error:", err);
    return NextResponse.json(
      { error: err.message || "Error al obtener estado" },
      { status: 500 }
    );
  }
}
