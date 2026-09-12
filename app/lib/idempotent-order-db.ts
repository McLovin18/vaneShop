/**
 * 🔐 IDEMPOTENT ORDER CREATION
 * 
 * Problema: Race condition en idempotency key
 * - Request A llega
 * - Request B llega (milisegundos después, misma key)
 * - Ambos pasan validación antes de que A guarde el record
 * - Resultado: 2 órdenes creadas ❌
 * 
 * Solución: Crear documento PRE-EMPTIVELY
 * - Usar idempotencyKey como document ID
 * - Esto crea atomically: reserva el ID
 * - Request B intentará crear mismo ID → Error → Devuelve orden existente
 */

import admin from "./firebase-admin";

interface IdempotentOrderRequest {
  idempotencyKey: string;
  userId: string;
  email: string;
  totalAmount: number;
  itemCount: number;
  source: "online" | "proforma";
  metadata?: Record<string, any>;
}

interface IdempotentOrderRecord {
  status: "processing" | "completed" | "failed";
  orderId?: string;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * ✅ Pre-check: Registrar idempotency key ANTES de procesar
 * Si ya existe, devolver la orden existente
 * Si no existe, reservar la ranura (lock)
 * 
 * ⚠️ IMPORTANTE: Usar create() NO set() para atomicidad real
 * create() falla si el doc existe → previene race condition
 */
export async function preCheckIdempotentOrder(
  request: IdempotentOrderRequest
): Promise<{
  canProceed: boolean;
  existingOrderId?: string;
  lockId: string;
  error?: string;
}> {
  const db = admin.firestore();
  const lockId = `order_lock_${request.idempotencyKey}`;

  try {
    const lockRef = db.collection("order_creation_locks").doc(lockId);
    
    // 🔒 ATOMIC: Intentar CREAR lock
    // Si ya existe, falla → catch → devolvemos existing
    try {
      await lockRef.create({
        idempotencyKey: request.idempotencyKey,
        userId: request.userId,
        email: request.email,
        status: "processing",
        createdAt: admin.firestore.Timestamp.now(),
        expiresAt: new Date(Date.now() + 5 * 60000), // Expira en 5 min
      } as IdempotentOrderRecord);
      
      // ✅ Lock creado exitosamente, podemos proceder
      return {
        canProceed: true,
        lockId,
      };
    } catch (createErr: any) {
      // ❌ create() falló porque el documento ya existe
      if (createErr.code === "already-exists" || createErr.code === 6) {
        // El documento ya existe → obtener el lock existente
        const existingLock = await lockRef.get();
        
        if (existingLock.exists) {
          const existingData = existingLock.data() as IdempotentOrderRecord;
          
          // Si está completada, devolver orden existente
          if (existingData.status === "completed" && existingData.orderId) {
            return {
              canProceed: false,
              existingOrderId: existingData.orderId,
              lockId,
              error: "Order already exists",
            };
          }
          
          // Si falló, dejar que reintente (borrar lock viejo es job del cleanup)
          if (existingData.status === "failed") {
            return {
              canProceed: false,
              lockId,
              error: "Previous attempt failed, please retry",
            };
          }
          
          // Si está procesando, conflicto
          return {
            canProceed: false,
            lockId,
            error: "Request is already being processed",
          };
        }
      }
      
      // Otro tipo de error
      throw createErr;
    }
  } catch (err: any) {
    console.error("[idempotent-order] Error in preCheckIdempotentOrder:", err);
    return {
      canProceed: false,
      lockId,
      error: `Idempotency check failed: ${err.message}`,
    };
  }
    }

    // Otro error
    console.error("[idempotent-order] Unexpected error:", err);
    return {
      canProceed: false,
      lockId,
      error: err.message,
    };
  }
}

/**
 * ✅ Completar la creación (después de guardar orden)
 */
export async function completeIdempotentOrder(
  lockId: string,
  orderId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const db = admin.firestore();

  try {
    await db.collection("order_creation_locks").doc(lockId).update({
      status: "completed",
      orderId,
      completedAt: admin.firestore.Timestamp.now(),
    });

    return { success: true };
  } catch (err: any) {
    console.error("[idempotent-order] Error completing order:", err);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * ✅ Marcar como fallida (si algo salió mal)
 */
export async function failIdempotentOrder(
  lockId: string,
  error: string
): Promise<{
  success: boolean;
}> {
  const db = admin.firestore();

  try {
    await db.collection("order_creation_locks").doc(lockId).update({
      status: "failed",
      error,
      failedAt: admin.firestore.Timestamp.now(),
    });

    return { success: true };
  } catch (err: any) {
    console.error("[idempotent-order] Error failing order:", err);
    return { success: false };
  }
}

/**
 * ✅ Limpiar locks expirados
 */
export async function cleanupExpiredLocks(): Promise<{
  deleted: number;
  error?: string;
}> {
  const db = admin.firestore();

  try {
    const now = new Date();
    const snap = await db
      .collection("order_creation_locks")
      .where("expiresAt", "<=", now)
      .limit(500)
      .get();

    if (snap.empty) {
      return { deleted: 0 };
    }

    const batch = db.batch();
    let count = 0;

    snap.forEach((doc) => {
      batch.delete(doc.ref);
      count++;
    });

    await batch.commit();

    return { deleted: count };
  } catch (err: any) {
    console.error("[idempotent-order] Error cleaning up:", err);
    return { deleted: 0, error: err.message };
  }
}

/**
 * ✅ Recuperar lock info (para debugging)
 */
export async function getLockInfo(
  lockId: string
): Promise<IdempotentOrderRecord | null> {
  const db = admin.firestore();

  try {
    const doc = await db.collection("order_creation_locks").doc(lockId).get();
    return doc.exists ? (doc.data() as IdempotentOrderRecord) : null;
  } catch (err: any) {
    console.error("[idempotent-order] Error getting lock info:", err);
    return null;
  }
}
