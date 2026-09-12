/**
 * 🔑 IDEMPOTENCY PARA PROFORMA
 * 
 * Resuelve edge case:
 * - Usuario clickea "Generar orden" 2 veces rápidamente
 * - Sin idempotency: 2 reservas + 2 emails
 * - Con idempotency: Solo 1 orden, req duplicado devuelve ID de la primera
 * 
 * SIN esto: Email spam, stock reservado 2x
 * CON esto: Sistema idempotent como pasarelas de pago
 */

import admin from "./firebase-admin";
import crypto from "crypto";

interface IdempotencyRecord {
  key: string;
  userId: string;
  email: string;
  request: {
    productIds: string[];
    quantities: number[];
    total: number;
    timestamp: number;
  };
  response: {
    reserveId: string;
    orderId: string;
    success: boolean;
    timestamp: number;
  };
  expiresAt: Date;
}

const IDEMPOTENCY_KEY_TTL_HOURS = 24; // Guardar records por 24 horas

/**
 * ✅ Generar idempotency key del request
 * Este hash es idéntico para el mismo carrito del mismo usuario
 */
export function generateIdempotencyKey(
  userId: string,
  email: string,
  productos: any[]
): string {
  // Normalizar productos para hash consistente
  const normalized = productos
    .map((p: any) => `${p.id}:${p.cantidad}`)
    .sort()
    .join("|");

  const hash = crypto
    .createHash("sha256")
    .update(`${userId}:${email}:${normalized}:proforma`)
    .digest("hex");

  return `proforma_${hash}`;
}

/**
 * ✅ Guardar record de idempotency
 */
export async function saveIdempotencyRecord(
  key: string,
  userId: string,
  email: string,
  productos: any[],
  response: { reserveId: string; orderId: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = admin.firestore();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_KEY_TTL_HOURS);

    const record: IdempotencyRecord = {
      key,
      userId,
      email,
      request: {
        productIds: productos.map((p: any) => p.id),
        quantities: productos.map((p: any) => p.cantidad),
        total: productos.reduce(
          (sum: number, p: any) => sum + (Number(p.precio) || 0) * (Number(p.cantidad) || 1),
          0
        ),
        timestamp: Date.now(),
      },
      response: {
        reserveId: response.reserveId,
        orderId: response.orderId,
        success: true,
        timestamp: Date.now(),
      },
      expiresAt,
    };

    await db.collection("idempotency_records").doc(key).set(record);

    return { success: true };
  } catch (err: any) {
    console.error("[idempotency-db] Error saving record:", err);
    return { success: false, error: err.message };
  }
}

/**
 * ✅ Buscar existente idempotency record
 * Si existe, devolver respuesta anterior sin procesar de nuevo
 */
export async function getIdempotencyRecord(
  key: string
): Promise<IdempotencyRecord | null> {
  try {
    const db = admin.firestore();
    const doc = await db.collection("idempotency_records").doc(key).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as IdempotencyRecord;

    // Verificar que no está expirado
    if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
      return null;
    }
    return data;
  } catch (err: any) {
    console.error("[idempotency-db] Error fetching record:", err);
    return null;
  }
}

/**
 * ✅ Validar que la solicitud es válida (no es un ataque de replay con datos diferentes)
 */
export async function validateIdempotencyKey(
  key: string,
  userId: string,
  email: string,
  productos: any[]
): Promise<{
  valid: boolean;
  isDuplicate: boolean;
  record?: IdempotencyRecord;
  error?: string;
}> {
  try {
    const record = await getIdempotencyRecord(key);

    if (!record) {
      // Key no existe = primer request
      return { valid: true, isDuplicate: false };
    }

    // Key existe, verificar que los parámetros sean iguales (anti-replay attack)
    const expectedProductIds = productos.map((p: any) => p.id).sort();
    const recordProductIds = record.request.productIds.sort();

    if (JSON.stringify(expectedProductIds) !== JSON.stringify(recordProductIds)) {
      return {
        valid: false,
        isDuplicate: false,
        error: "Idempotency key mismatch: Different products in request",
      };
    }

    // ✅ Es un duplicate válido
    return { valid: true, isDuplicate: true, record };
  } catch (err: any) {
    console.error("[idempotency-db] Error validating key:", err);
    return { valid: false, isDuplicate: false, error: err.message };
  }
}

/**
 * ✅ Limpiar records expirados (ejecutar desde cron/scheduler)
 */
export async function cleanupExpiredIdempotencyRecords(): Promise<{
  deleted: number;
  error?: string;
}> {
  try {
    const db = admin.firestore();
    const now = new Date();

    const snapshot = await db
      .collection("idempotency_records")
      .where("expiresAt", "<=", now)
      .limit(500)
      .get();

    if (snapshot.empty) {
      return { deleted: 0 };
    }

    const batch = db.batch();
    let count = 0;

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });

    await batch.commit();

    return { deleted: count };
  } catch (err: any) {
    console.error("[idempotency-db] Error cleaning up records:", err);
    return { deleted: 0, error: err.message };
  }
}

/**
 * ✅ Stats para monitoreo
 */
export async function getIdempotencyStats(): Promise<{
  totalRecords: number;
  expiredRecords: number;
  recentDuplicates: number; // Detectadas en última hora
}> {
  try {
    const db = admin.firestore();

    // Total records
    const totalSnap = await db.collection("idempotency_records").count().get();

    // Expired records
    const now = new Date();
    const expiredSnap = await db
      .collection("idempotency_records")
      .where("expiresAt", "<=", now)
      .count()
      .get();

    // Recent duplicates (creados en última hora)
    const oneHourAgo = new Date(now.getTime() - 60 * 60000);
    const recentSnap = await db
      .collection("idempotency_records")
      .where("request.timestamp", ">=", oneHourAgo.getTime())
      .count()
      .get();

    return {
      totalRecords: totalSnap.data().count || 0,
      expiredRecords: expiredSnap.data().count || 0,
      recentDuplicates: recentSnap.data().count || 0,
    };
  } catch (err: any) {
    console.error("[idempotency-db] Error getting stats:", err);
    return { totalRecords: 0, expiredRecords: 0, recentDuplicates: 0 };
  }
}
