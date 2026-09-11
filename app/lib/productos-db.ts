// Tipos
export interface StockVariant {
  talla?: string;
  color?: string;
  cantidad: number;
  precio?: number;
  permitePersonalizacion?: boolean;
  textoPersonalizacion?: string;
  imagenIndex?: number;
  attributes?: Record<string, string>;
  label?: string;
  variantKey?: string;
}

export interface Producto {
  id: string;
  nombre?: string;
  descripcion?: string;
  precio?: number;
  descuento?: number;
  stock?: number;
  isCamiseta?: boolean;
  hasVariations?: boolean;
  stockVariants?: StockVariant[];
  variationAttributeIds?: string[];
  tallas?: string[];
  colores?: string[];
  categoria?: string;
  subcategoria?: string;
  subsubcategoria?: string;
  marca?: string;
  bodegaId?: string;
  destacado?: boolean;
  createdAt?: number | Date;
  fechaCreacion?: any;
  [key: string]: any;
}

/** Stock total: suma variantes si el producto tiene variaciones */
export function getStockTotal(producto: Producto): number {
  const variants = Array.isArray(producto.stockVariants)
    ? producto.stockVariants
    : [];
  if (producto.hasVariations || variants.length > 0) {
    return variants.reduce(
      (sum, v) => sum + Number(v?.cantidad || 0),
      0
    );
  }
  return Number(producto.stock ?? 0);
}

/** Visible en catálogo público (misma lógica que ProductoCard) */
export function productoTieneStockDisponible(producto: Producto): boolean {
  const variants = Array.isArray(producto.stockVariants)
    ? producto.stockVariants
    : [];
  if (producto.hasVariations || variants.length > 0) {
    return getStockTotal(producto) > 0;
  }
  if (typeof producto.stock !== "number") return true;
  return producto.stock > 0;
}

function filtrarProductosConStock(productos: Producto[], opts: { incluirSinStock?: boolean } = {}) {
  if (opts.incluirSinStock) return productos;
  return productos.filter(productoTieneStockDisponible);
}

// Obtener productos por subcategoría (usando los campos reales de Firestore)
// Si opts.incluirSinStock es true, no filtra por stock (solo para admin/inventario)
export async function obtenerProductosPorSubcategoria(subcategoria, categoria, excludeId = null, opts = {}) {
  // Filtra por subcategoria y categoria
  const q = query(
    collection(db, COLLECTION),
    where("subcategoria", "==", subcategoria),
    where("categoria", "==", categoria)
  );
  const snapshot = await getDocs(q);
  let productos = snapshot.docs.map(doc => {
    const data = doc.data();
    const producto = { id: doc.id, ...data };
    
    // Normalizar createdAt
    if (!producto.createdAt) {
      if (data.fechaCreacion && typeof data.fechaCreacion.toMillis === 'function') {
        producto.createdAt = data.fechaCreacion.toMillis();
      } else if (data.fechaCreacion && typeof data.fechaCreacion === 'number') {
        producto.createdAt = data.fechaCreacion;
      } else {
        producto.createdAt = 0;
      }
    }
    
    return producto;
  });
  
  productos = filtrarProductosConStock(productos, opts);
  if (excludeId) productos = productos.filter(p => p.id !== excludeId);
  return productos;
}

// Obtener productos por subsubcategoría (último nivel, usando los campos reales de Firestore)
export async function obtenerProductosPorSubsubcategoria(subsubcategoria, subcategoria, categoria, excludeId = null, opts = {}) {
  // Filtra por subsubcategoria, subcategoria y categoria
  const q = query(
    collection(db, COLLECTION),
    where("subsubcategoria", "==", subsubcategoria),
    where("subcategoria", "==", subcategoria),
    where("categoria", "==", categoria)
  );
  const snapshot = await getDocs(q);
  let productos = snapshot.docs.map(doc => {
    const data = doc.data();
    const producto = { id: doc.id, ...data };
    
    // Normalizar createdAt
    if (!producto.createdAt) {
      if (data.fechaCreacion && typeof data.fechaCreacion.toMillis === 'function') {
        producto.createdAt = data.fechaCreacion.toMillis();
      } else if (data.fechaCreacion && typeof data.fechaCreacion === 'number') {
        producto.createdAt = data.fechaCreacion;
      } else {
        producto.createdAt = 0;
      }
    }
    
    return producto;
  });
  
  productos = filtrarProductosConStock(productos, opts);
  if (excludeId) productos = productos.filter(p => p.id !== excludeId);
  return productos;
}
import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot
} from "firebase/firestore";

const COLLECTION = "productos";

// Obtener productos por bodega
export async function obtenerProductosPorBodega(bodegaId: string, opts: any = {}) {
  const q = query(
    collection(db, COLLECTION),
    where("bodegaId", "==", bodegaId)
  );
  const snapshot = await getDocs(q);
  let productos = snapshot.docs.map(doc => {
    const data = doc.data();
    const producto = { id: doc.id, ...data };
    
    // Normalizar createdAt
    if (!producto.createdAt) {
      if (data.fechaCreacion && typeof data.fechaCreacion.toMillis === 'function') {
        producto.createdAt = data.fechaCreacion.toMillis();
      } else if (data.fechaCreacion && typeof data.fechaCreacion === 'number') {
        producto.createdAt = data.fechaCreacion;
      } else {
        producto.createdAt = 0;
      }
    }
    
    return producto;
  });
  
  return filtrarProductosConStock(productos, opts);
}

// Elimina recursivamente los campos undefined de un objeto
function cleanUndefinedDeep(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefinedDeep);
  } else if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, cleanUndefinedDeep(v)])
    );
  }
  return obj;
}

// Crear producto
import { serverTimestamp } from "firebase/firestore";

export async function crearProducto(producto: Producto): Promise<Producto> {
  const cleanProducto = cleanUndefinedDeep(producto);
  // Agregar campo de fecha de creación (timestamp en ms para ordenamiento)
  const productoConFecha = {
    ...cleanProducto,
    createdAt: Date.now(),
    fechaCreacion: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, COLLECTION), productoConFecha);
  return { ...cleanProducto, id: docRef.id, createdAt: Date.now() };
}

// Obtener todos los productos
// Si opts.incluirSinStock es true, no filtra por stock (solo para admin/inventario)
export async function obtenerProductos(opts = {}) {
  const snapshot = await getDocs(collection(db, COLLECTION));
  let productos = snapshot.docs.map(doc => {
    const data = doc.data();
    const producto = { id: doc.id, ...data };
    
    // Normalizar createdAt: si no existe, intentar usar fechaCreacion o asignar 0
    if (!producto.createdAt) {
      if (data.fechaCreacion && typeof data.fechaCreacion.toMillis === 'function') {
        // Si fechaCreacion es un Timestamp de Firebase, convertir a ms
        producto.createdAt = data.fechaCreacion.toMillis();
      } else if (data.fechaCreacion && typeof data.fechaCreacion === 'number') {
        producto.createdAt = data.fechaCreacion;
      } else {
        // Si no hay fecha, asignar 0 (aparecerá al final)
        producto.createdAt = 0;
      }
    }
    
    return producto;
  });
  
  return filtrarProductosConStock(productos, opts);
}

// Obtener productos por categoría (usando el campo real de Firestore)
// Si opts.incluirSinStock es true, no filtra por stock (solo para admin/inventario)
export async function obtenerProductosPorCategoria(categoria, opts = {}) {
  if (!categoria) return [];

  const categoriaNorm = String(categoria).trim();
  const q = query(
    collection(db, COLLECTION),
    where("categoria", "==", categoriaNorm)
  );
  const snapshot = await getDocs(q);

  let productos = snapshot.docs.map((doc) => {
    const data = doc.data();
    return { id: doc.id, ...data };
  });

  // Si no hay resultados con el ID exacto, buscar en toda la colección
  // (productos legacy pueden tener guardado el nombre en vez del id)
  if (productos.length === 0) {
    const allSnap = await getDocs(collection(db, COLLECTION));
    const needle = categoriaNorm.toLowerCase();
    productos = allSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter(
        (p) =>
          String(p.categoria || "").trim().toLowerCase() === needle
      );
  }

  return filtrarProductosConStock(productos, opts);
}



// Obtener producto por ID
export async function obtenerProductoPorId(id: string): Promise<Producto | null> {
  const docSnap = await getDoc(doc(db, COLLECTION, id));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

// Actualizar producto
export async function actualizarProducto(id: string, data: Partial<Producto>): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), cleanUndefinedDeep(data));
}

// Eliminar producto
export async function eliminarProducto(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

// Obtener productos destacados
export async function obtenerProductosDestacados(opts = {}) {
  const q = query(collection(db, COLLECTION), where("destacado", "==", true));
  const snapshot = await getDocs(q);
  let productos = snapshot.docs.map(doc => {
    const data = doc.data();
    const producto = { id: doc.id, ...data };
    
    // Normalizar createdAt
    if (!producto.createdAt) {
      if (data.fechaCreacion && typeof data.fechaCreacion.toMillis === 'function') {
        producto.createdAt = data.fechaCreacion.toMillis();
      } else if (data.fechaCreacion && typeof data.fechaCreacion === 'number') {
        producto.createdAt = data.fechaCreacion;
      } else {
        producto.createdAt = 0;
      }
    }
    
    return producto;
  });
  
  return filtrarProductosConStock(productos, opts);
}

// Escuchar cambios en tiempo real de productos destacados
export function onProductosDestacadosChange(
  callback: (productos: Producto[]) => void,
  opts = {}
) {
  const q = query(collection(db, COLLECTION), where("destacado", "==", true));
  
  return onSnapshot(q, (snapshot) => {
    let productos = snapshot.docs.map(doc => {
      const data = doc.data();
      const producto = { id: doc.id, ...data };
      
      // Normalizar createdAt
      if (!producto.createdAt) {
        if (data.fechaCreacion && typeof data.fechaCreacion.toMillis === 'function') {
          producto.createdAt = data.fechaCreacion.toMillis();
        } else if (data.fechaCreacion && typeof data.fechaCreacion === 'number') {
          producto.createdAt = data.fechaCreacion;
        } else {
          producto.createdAt = 0;
        }
      }
      
      return producto;
    });
    
    callback(filtrarProductosConStock(productos, opts));
  });
}
