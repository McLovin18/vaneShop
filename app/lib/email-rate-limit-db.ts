/**
 * 📧 RATE LIMITING PARA EMAIL RESENDS
 * 
 * Resuelve:
 * - Usuario puede reenviar proforma múltiples veces
 * - Sin rate limit: Email spam + costos innecesarios
 * - Con rate limit: Max 3 reenvíos en 1 hora
 */

import admin from "./firebase-admin";

interface EmailRateLimit {
  email: string;
  orderId: string;
  resendCount: number;
  lastResendAt: Date;
  expiresAt: Date;
}

const MAX_RESENDS_PER_HOUR = 3;
const RATE_LIMIT_WINDOW_MINUTES = 60;

/**
 * ✅ Verificar si se puede reenviar email
 */
export async function canResendProformaEmail(
  email: string,
  orderId: string
): Promise<{
  canResend: boolean;
  resendCount: number;
  remainingResends: number;
  nextAvailableAt?: Date;
  error?: string;
}> {
  try {
    const db = admin.firestore();
    const key = `${orderId}:${email.toLowerCase()}`;

    const doc = await db.collection("email_rate_limits").doc(key).get();

    if (!doc.exists) {
      // Primer resend, Always permitido
      return {
        canResend: true,
        resendCount: 0,
        remainingResends: MAX_RESENDS_PER_HOUR,
      };
    }

    const data = doc.data() as EmailRateLimit;
    const now = new Date();

    // Verificar si la ventana de rate limit expiró
    if (data.expiresAt && new Date(data.expiresAt) < now) {
      // Ventana expiró, reset
      return {
        canResend: true,
        resendCount: 0,
        remainingResends: MAX_RESENDS_PER_HOUR,
      };
    }

    // Dentro de la ventana, verificar límite
    if (data.resendCount >= MAX_RESENDS_PER_HOUR) {
      const nextAvailable = new Date(data.expiresAt);
      return {
        canResend: false,
        resendCount: data.resendCount,
        remainingResends: 0,
        nextAvailableAt: nextAvailable,
        error: `Límite de reenvíos alcanzado. Intenta después de ${nextAvailable.toLocaleTimeString()}`,
      };
    }

    // Permitido, pero registrar que se va a usar uno
    return {
      canResend: true,
      resendCount: data.resendCount,
      remainingResends: MAX_RESENDS_PER_HOUR - data.resendCount,
    };
  } catch (err: any) {
    console.error("[email-rate-limit] Error checking limit:", err);
    // Si hay error, permitir (mejor UX que bloquear)
    return {
      canResend: true,
      resendCount: 0,
      remainingResends: MAX_RESENDS_PER_HOUR,
      error: "Error checking rate limit",
    };
  }
}

/**
 * ✅ Registrar un resend (incrementar contador)
 */
export async function recordEmailResend(
  email: string,
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = admin.firestore();
    const key = `${orderId}:${email.toLowerCase()}`;

    await db.runTransaction(async (transaction) => {
      const ref = db.collection("email_rate_limits").doc(key);
      const doc = await transaction.get(ref);

      let resendCount = 1;
      let expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + RATE_LIMIT_WINDOW_MINUTES);

      if (doc.exists) {
        const data = doc.data() as EmailRateLimit;
        const now = new Date();

        // Si la ventana no expiró, incrementar
        if (data.expiresAt && new Date(data.expiresAt) > now) {
          resendCount = (data.resendCount || 0) + 1;
          expiresAt = new Date(data.expiresAt); // Mantener la ventana original
        }
        // Si expiró, resetear contador
      }

      transaction.set(
        ref,
        {
          email: email.toLowerCase(),
          orderId,
          resendCount,
          lastResendAt: admin.firestore.Timestamp.now(),
          expiresAt,
        },
        { merge: true }
      );
    });


    return { success: true };
  } catch (err: any) {
    console.error("[email-rate-limit] Error recording resend:", err);
    return { success: false, error: err.message };
  }
}

/**
 * ✅ Limpiar records expirados
 */
export async function cleanupExpiredEmailRateLimits(): Promise<{
  deleted: number;
  error?: string;
}> {
  try {
    const db = admin.firestore();
    const now = new Date();

    const snapshot = await db
      .collection("email_rate_limits")
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
    console.error("[email-rate-limit] Error cleaning up:", err);
    return { deleted: 0, error: err.message };
  }
}

/**
 * ✅ Stats para monitoreo
 */
export async function getEmailRateLimitStats(): Promise<{
  totalLimits: number;
  expiredLimits: number;
  activeThrottledEmails: number; // Emails en periodo de throttle
}> {
  try {
    const db = admin.firestore();

    // Total records
    const totalSnap = await db.collection("email_rate_limits").count().get();

    // Expired
    const now = new Date();
    const expiredSnap = await db
      .collection("email_rate_limits")
      .where("expiresAt", "<=", now)
      .count()
      .get();

    // Active throttled (dentro de ventana)
    const activeSnap = await db
      .collection("email_rate_limits")
      .where("expiresAt", ">", now)
      .count()
      .get();

    return {
      totalLimits: totalSnap.data().count || 0,
      expiredLimits: expiredSnap.data().count || 0,
      activeThrottledEmails: activeSnap.data().count || 0,
    };
  } catch (err: any) {
    console.error("[email-rate-limit] Error getting stats:", err);
    return { totalLimits: 0, expiredLimits: 0, activeThrottledEmails: 0 };
  }
}
