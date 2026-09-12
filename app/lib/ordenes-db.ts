import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  Timestamp,
  runTransaction,
  increment,
  writeBatch,
} from "firebase/firestore";
import admin from "./firebase-admin";
import { getCatalogPricing } from "./pricing";

const COLLECTION = "ordenes";

// Genera un número secuencial y lo convierte en ID tipo "ord-00001"
async function generarSiguienteOrderId(): Promise<string> {
  const metaRef = doc(db, `${COLLECTION}_meta`, "counter");
  const nextNumber = await runTransaction(db, async (tx) => {
    const snap = await tx.get(metaRef);
    const last = snap.exists() ? (snap.data().lastNumber || 0) : 0;
    const next = last + 1;
    tx.set(metaRef, { lastNumber: next }, { merge: true });
    return next;
  });
  const padded = String(nextNumber).padStart(5, "0");
  return `ord-${padded}`;
}

export async function crearOrden(orden: any) {
  const orderId = await generarSiguienteOrderId();

  const productosOrigen = Array.isArray(orden.productos) ? orden.productos : [];
  const productosProcesados: any[] = [];
  let total = 0;

  // ⚠️ Validar cantidades razonables (anti-ataque masivo)
  const MAX_QUANTITY_PER_ITEM = 10;
  for (const item of productosOrigen) {
    const cantidad = Number(item.cantidad || 1);
    if (cantidad > MAX_QUANTITY_PER_ITEM) {
      throw new Error(`Cantidad máxima permitida por producto: ${MAX_QUANTITY_PER_ITEM}`);
    }
    if (cantidad < 1) {
      throw new Error("Cantidad debe ser al menos 1");
    }
  }

  // 🚀 OPTIMIZACIÓN: Usar bulk read en lugar de getDoc individual
  const productRefs = productosOrigen
    .filter((item: any) => item?.id)
    .map((item: any) => doc(db, "productos", item.id));

  // Obtener todos de una vez (más eficiente con Firestore)
  // Nota: getAll no está disponible en SDK de cliente, usamos Promise.all con getDoc
  const productDocs = await Promise.all(
    productRefs.map((ref) => getDoc(ref).catch(() => null))
  );

  const productDataMap = new Map<string, any>();
  for (let i = 0; i < productDocs.length; i++) {
    const snap = productDocs[i];
    if (snap && snap.exists()) {
      productDataMap.set(snap.id, snap.data());
    }
  }

  for (const item of productosOrigen) {
    if (!item?.id) continue;

    const data = productDataMap.get(item.id);
    if (!data) continue;

    const { basePrice, discount, hasDiscount, finalPrice } = getCatalogPricing(data);
    const cantidad = Number(item.cantidad || 1);
    const unitPrice = finalPrice;
    const lineTotal = unitPrice * cantidad;

    // ⚠️ VALIDACIÓN: Stock disponible (anti-overselling)
    const stock = Number(data.stock || 0);
    if (stock < cantidad) {
      throw new Error(
        `Stock insuficiente para "${data.nombre}". Disponibles: ${stock}, Solicitados: ${cantidad}`
      );
    }

    total += lineTotal;

    // Obtener información de la bodega si existe
    let tiempoEntrega = 72; // default
    if (data.bodegaId) {
      try {
        const bodegaRef = doc(db, "bodegas", data.bodegaId);
        const bodegaSnap = await getDoc(bodegaRef);
        if (bodegaSnap.exists()) {
          tiempoEntrega = bodegaSnap.data().tiempoEntrega || 72;
        }
      } catch (err) {
        console.error("Error obteniendo bodega:", err);
      }
    }

    // 💾 SNAPSHOT de precios: Protección contra disputas y cambios
    productosProcesados.push({
      id: item.id,
      nombre: data.nombre,
      cantidad,
      precioBase: basePrice,
      descuento: hasDiscount ? discount : 0,
      precioUnitario: unitPrice,
      precioFinal: unitPrice,
      subtotal: lineTotal,
      bodegaId: data.bodegaId || "technothings",
      tiempoEntrega, // Tiempo de entrega en horas
      // 🔒 SNAPSHOT de seguridad
      precioSnapshot: {
        base: basePrice,
        descuento: discount,
        final: unitPrice,
        timestamp: Date.now(),
      },
      stockSnapshot: stock,
    });
  }

  const payload = {
    ...orden,
    productos: productosProcesados,
    total,
    orderId,
    estado: orden.estado || "generada",
    metodoPago: orden.metodoPago || "whatsapp",
    createdAt: Timestamp.now(),
    // Información de transferencia (si aplica)
    transferenciaInfo: orden.transferenciaInfo || null,
  };
  const docRef = await addDoc(collection(db, COLLECTION), payload);
  return { ...payload, id: docRef.id };
}

export async function obtenerOrdenesPorUsuario(uid) {
  const q = query(collection(db, COLLECTION), where("userId", "==", uid));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Admin: obtener todas las órdenes
export async function obtenerTodasOrdenes() {
  const snapshot = await getDocs(collection(db, COLLECTION));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function obtenerOrdenPorId(id: string) {
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as any;
}

export async function actualizarOrden(id: string, data: any) {
  await updateDoc(doc(db, COLLECTION, id), data);
}

// Deducir stock cuando se aprueba una orden
export async function deducirStockOrden(orderId: string) {
  try {
    const ordenRef = doc(db, COLLECTION, orderId);
    const ordenSnap = await getDoc(ordenRef);

    if (!ordenSnap.exists()) {
      throw new Error("Orden no encontrada");
    }

    const orden = ordenSnap.data();

    // Iterar sobre los productos y deducir stock
    for (const producto of orden.productos || []) {
      const prodRef = doc(db, "productos", producto.id);
      const prodSnap = await getDoc(prodRef);

      if (prodSnap.exists()) {
        const stockActual = prodSnap.data().stock || 0;
        const nuevoStock = Math.max(0, stockActual - producto.cantidad);
        
        await updateDoc(prodRef, { stock: nuevoStock });
      }
    }
  } catch (err) {
    console.error("Error deduciendo stock:", err);
    throw err;
  }
}

// Devolver stock cuando se rechaza una orden
export async function devolverStockOrden(orderId: string) {
  try {
    const ordenRef = doc(db, COLLECTION, orderId);
    const ordenSnap = await getDoc(ordenRef);

    if (!ordenSnap.exists()) {
      throw new Error("Orden no encontrada");
    }

    const orden = ordenSnap.data();

    // Iterar sobre los productos y devolver stock
    for (const producto of orden.productos || []) {
      const prodRef = doc(db, "productos", producto.id);
      const prodSnap = await getDoc(prodRef);

      if (prodSnap.exists()) {
        const stockActual = prodSnap.data().stock || 0;
        const nuevoStock = stockActual + producto.cantidad;
        
        await updateDoc(prodRef, { stock: nuevoStock });
      }
    }
  } catch (err) {
    console.error("Error devolviendo stock:", err);
    throw err;
  }
}
