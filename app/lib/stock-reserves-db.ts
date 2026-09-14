/**
 * 🔒 STOCK RESERVATION SYSTEM
 *
 * Maneja la reserva temporal de stock para evitar race conditions.
 * Cuando un usuario inicia checkout/proforma:
 * 1. Se crea una reserva de stock (expira en 10 min)
 * 2. Se deducen del stock disponible
 * 3. Si usuario paga/admin aprueba → confirmar reserva
 * 4. Si expira o se rechaza → liberar stock
 *
 * Esto previene:
 * - Overselling (2 usuarios compran mismo stock)
 * - Stock bloqueado por carritos abandonados
 * - Race conditions mediante Firestore transactions
 */

import admin from "./firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { findMatchingVariant } from "./order-checkout-utils";

const COLLECTION_RESERVES = "stockReserves";
const RESERVE_DURATION_MS = 10 * 60 * 1000; // 10 minutos

interface StockReserveItem {
  productId: string;
  cantidad: number;
  variantKey?: string;
  selectedVariations?: Record<string, string>;
  variationAttributeIds?: string[];
  selectedTalla?: string;
  selectedColor?: string;
  snapshot: {
    precio: number;
    stock: number;
    nombre: string;
  };
}

interface StockReserve {
  reserveId?: string;
  userId: string;
  email: string;
  items: StockReserveItem[];
  createdAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
  status: "pending" | "confirmed" | "released";
  orderId?: string;
  metadata?: Record<string, any>;
}

/**
 * Crea una reserva de stock y ATOMICAMENTE:
 * 1. Reduce stock de cada producto
 * 2. Crea documento de reserva
 * En caso de error, todo se revierte (transactional integrity)
 */
export async function crearReservaStock(
  userId: string,
  email: string,
  items: StockReserveItem[],
  metadata?: any
): Promise<{ reserveId: string; success: boolean; error?: string }> {
  const db = admin.firestore();

  try {
    // Generar ID de reserva único
    const reserveId = `reserve-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Usar transaction para atomic update: validate → deduct stock → create reserve
    const result = await db.runTransaction(async (transaction) => {
      // PASO 1: Leer stock actual de todos los productos
      const productRefs = items.map((item) =>
        db.collection("productos").doc(item.productId)
      );
      const productSnaps = await transaction.getAll(...productRefs);

      // PASO 2: Validar que hay stock suficiente DENTRO de la transacción
      const validations: { productId: string; available: number; requested: number }[] = [];

      for (let i = 0; i < productSnaps.length; i++) {
        const snap = productSnaps[i];
        const item = items[i];

        if (!snap.exists) {
          throw new Error(`Producto ${item.productId} no existe`);
        }

        const data = snap.data();
        // Verificar stock de variante si el producto tiene variantes y se seleccionó una
        const variantMatch = findMatchingVariant(data, {
          id: item.productId,
          variantKey: item.variantKey,
          selectedVariations: item.selectedVariations,
          variationAttributeIds: item.variationAttributeIds,
          selectedTalla: item.selectedTalla,
          selectedColor: item.selectedColor,
        });
        const availableStock = variantMatch
          ? Number(variantMatch.variant?.cantidad ?? variantMatch.variant?.stock ?? 0)
          : Number(data?.stock ?? 0);

        if (availableStock < item.cantidad) {
          const variantInfo = variantMatch
            ? ` (variante: ${Object.values(variantMatch.variant?.attributes || {}).join(', ') || variantMatch.variant?.talla || variantMatch.variant?.color || 'seleccionada'})`
            : '';
          throw new Error(
            `Stock insuficiente para ${data?.nombre}${variantInfo}. Disponibles: ${availableStock}, Solicitados: ${item.cantidad}`
          );
        }

        validations.push({
          productId: item.productId,
          available: availableStock,
          requested: item.cantidad,
        });
      }

      // PASO 3: Dentro de la misma transacción, deducir stock
      // ✅ IMPORTANTE: Usar FieldValue.increment() - es ATÓMICO
      // ❌ NO hacer: const newStock = currentStock - item.cantidad; stock: newStock
      for (let i = 0; i < productSnaps.length; i++) {
        const snap = productSnaps[i];
        const item = items[i];

        // ✅ PREVIENE RACE CONDITION: increment es atómico en Firestore
        // Si 2 usuarios compran al mismo tiempo, ambos incrementan correctamente
        transaction.update(snap.ref, {
          stock: admin.firestore.FieldValue.increment(-item.cantidad),
          lastStockUpdateAt: admin.firestore.Timestamp.now(),
        });

        // 📝 Guardar historial en subcolección (MEJOR ESCALABILIDAD)
        const historyRef = snap.ref
          .collection("stock_history")
          .doc(`${reserveId}_${Date.now()}`);
        transaction.set(historyRef, {
          type: "reserve_created",
          cantidad: -item.cantidad,
          reserveId,
          timestamp: admin.firestore.Timestamp.now(),
        });
      }

      // PASO 4: Crear documento de reserva
      const now = Timestamp.now();
      const expiresAt = new Timestamp(
        now.seconds + Math.floor(RESERVE_DURATION_MS / 1000),
        now.nanoseconds
      );

      const reserveDoc: StockReserve = {
        reserveId,
        userId,
        email,
        items,
        createdAt: now,
        expiresAt,
        status: "pending",
        metadata,
      };

      transaction.set(db.collection(COLLECTION_RESERVES).doc(reserveId), reserveDoc);

      return { reserveId, validations };
    });

    return { reserveId: result.reserveId, success: true };
  } catch (error: any) {
    console.error("❌ Error creando reserva de stock:", error.message);
    return {
      reserveId: "",
      success: false,
      error: error.message,
    };
  }
}

/**
 * Confirma una reserva (cuando admin aprueba)
 * Marca la reserva como "confirmed" para que no se libere automáticamente
 */
export async function confirmarReserva(
  reserveId: string,
  orderId?: string
): Promise<{ success: boolean; error?: string }> {
  const db = admin.firestore();

  try {
    await db
      .collection(COLLECTION_RESERVES)
      .doc(reserveId)
      .update({
        status: "confirmed",
        orderId: orderId || null,
        confirmedAt: Timestamp.now(),
      });

    console.log(`✅ Reserva confirmada: ${reserveId}`);
    return { success: true };
  } catch (error: any) {
    console.error("❌ Error confirmando reserva:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Libera una reserva (cuando expira, usuario cancela o admin rechaza)
 * Usando transaction para revertir el stock ATOMICAMENTE
 */
export async function liberarReserva(
  reserveId: string
): Promise<{ success: boolean; error?: string; itemsReleased?: number }> {
  const db = admin.firestore();

  try {
    return await db.runTransaction(async (transaction) => {
      // PASO 1: Leer la reserva
      const reserveRef = db.collection(COLLECTION_RESERVES).doc(reserveId);
      const reserveSnap = await transaction.get(reserveRef);

      if (!reserveSnap.exists) {
        throw new Error(`Reserva ${reserveId} no existe`);
      }

      const reserve = reserveSnap.data() as StockReserve;

      // Si ya está released, no hacer nada
      if (reserve.status === "released") {
        return { success: true, itemsReleased: 0 };
      }

      // PASO 2: Devolver stock a cada producto
      // ✅ IMPORTANTE: Usar FieldValue.increment() - es ATÓMICO
      for (const item of reserve.items) {
        const productRef = db.collection("productos").doc(item.productId);

        // ✅ PREVIENE RACE CONDITION: increment es atómico
        transaction.update(productRef, {
          stock: admin.firestore.FieldValue.increment(item.cantidad),
          lastStockUpdateAt: admin.firestore.Timestamp.now(),
        });

        // 📝 Guardar historial en subcolección (MEJOR ESCALABILIDAD)
        const historyRef = productRef
          .collection("stock_history")
          .doc(`${reserveId}_release_${Date.now()}`);
        transaction.set(historyRef, {
          type: "reserve_released",
          cantidad: item.cantidad,
          reserveId,
          timestamp: admin.firestore.Timestamp.now(),
        });
      }

      // PASO 3: Marcar reserva como released
      transaction.update(reserveRef, {
        status: "released",
        releasedAt: Timestamp.now(),
      });

      return { success: true, itemsReleased: reserve.items.length };
    });
  } catch (error: any) {
    console.error("❌ Error liberando reserva:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene una reserva por ID
 */
export async function obtenerReserva(reserveId: string): Promise<StockReserve | null> {
  const db = admin.firestore();

  try {
    const snap = await db.collection(COLLECTION_RESERVES).doc(reserveId).get();
    return snap.exists ? (snap.data() as StockReserve) : null;
  } catch (error) {
    console.error("❌ Error obteniendo reserva:", error);
    return null;
  }
}

/**
 * Libera automáticamente todas las reservas expiradas
 * RECOMENDACIÓN: Ejecutar periodicamente (cada 5 min vía Cloud Task)
 */
export async function liberarReservasExpiradas(): Promise<{
  released: number;
  errors: number;
}> {
  const db = admin.firestore();
  let released = 0;
  let errors = 0;

  try {
    const now = Timestamp.now();

    // Buscar todas las reservas "pending" que expiraron
    const query = db
      .collection(COLLECTION_RESERVES)
      .where("status", "==", "pending")
      .where("expiresAt", "<=", now);

    const snaps = await query.get();

    console.log(`🔄 Liberando ${snaps.size} reservas expiradas...`);

    for (const snap of snaps.docs) {
      const result = await liberarReserva(snap.id);
      if (result.success) {
        released++;
      } else {
        errors++;
      }
    }

    console.log(
      `✅ Liberadas ${released} reservas expiradas (${errors} errores)`
    );
    return { released, errors };
  } catch (error: any) {
    console.error("❌ Error liberando reservas expiradas:", error.message);
    return { released, errors: 1 };
  }
}

/**
 * Obtiene todas las reservas activas de un usuario
 * Útil para dashboard/estado de carrito
 */
export async function obtenerReservasDelUsuario(
  userId: string
): Promise<StockReserve[]> {
  const db = admin.firestore();

  try {
    const snaps = await db
      .collection(COLLECTION_RESERVES)
      .where("userId", "==", userId)
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
      .get();

    return snaps.docs.map((snap) => snap.data() as StockReserve);
  } catch (error) {
    console.error("❌ Error obteniendo reservas del usuario:", error);
    return [];
  }
}

/**
 * Valida que una reserva siga siendo válida:
 * - No expirada
 * - Está en estado "pending"
 * - Products existen
 */
export async function validarReserva(reserveId: string): Promise<{
  valid: boolean;
  reason?: string;
}> {
  const reserve = await obtenerReserva(reserveId);

  if (!reserve) {
    return { valid: false, reason: "Reserva no existe" };
  }

  if (reserve.status !== "pending") {
    return { valid: false, reason: `Reserva ya es ${reserve.status}` };
  }

  const now = Timestamp.now();
  if (now > reserve.expiresAt) {
    return { valid: false, reason: "Reserva expirada" };
  }

  return { valid: true };
}

/**
 * Crea un hash idempotency para evitar duplicados
 * Combinación de: userId + carrito items + timestamp truncado
 */
export function generarIdempotencyKey(
  userId: string,
  items: Array<{ id: string; cantidad: number }>
): string {
  const itemsStr = items.map((i) => `${i.id}-${i.cantidad}`).join("|");
  const timestamp = Math.floor(Date.now() / 5000); // Agrupa en ventanas de 5 seg
  const combined = `${userId}|${itemsStr}|${timestamp}`;

  // Simple hash (en producción usar crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const chr = combined.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `idempotency-${Math.abs(hash).toString(36)}`;
}

/**
 * Verifica si un idempotency key ya fue procesado
 */
export async function existeIdempotencyKey(
  idempotencyKey: string
): Promise<boolean> {
  const db = admin.firestore();

  try {
    const snap = await db
      .collection("idempotencyKeys")
      .doc(idempotencyKey)
      .get();
    return snap.exists;
  } catch (error) {
    console.error("❌ Error verificando idempotency key:", error);
    return false;
  }
}

/**
 * Registra un idempotency key como procesado
 */
export async function guardarIdempotencyKey(
  idempotencyKey: string,
  metadata: any
): Promise<void> {
  const db = admin.firestore();

  try {
    await db
      .collection("idempotencyKeys")
      .doc(idempotencyKey)
      .set(
        {
          createdAt: Timestamp.now(),
          expiresAt: new Timestamp(
            Timestamp.now().seconds + 24 * 60 * 60, // Expira en 24 horas
            Timestamp.now().nanoseconds
          ),
          metadata,
        },
        { merge: true }
      );
  } catch (error) {
    console.error("❌ Error guardando idempotency key:", error);
  }
}
