import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/firebase-admin";

interface ProductosOpts {
  incluirSinStock?: boolean;
}

interface StockVariant {
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

interface Producto {
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

function getStockTotal(producto: Producto): number {
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

function productoTieneStockDisponible(producto: Producto): boolean {
  const variants = Array.isArray(producto.stockVariants)
    ? producto.stockVariants
    : [];
  if (producto.hasVariations || variants.length > 0) {
    return getStockTotal(producto) > 0;
  }
  if (typeof producto.stock !== "number") return true;
  return producto.stock > 0;
}

async function filtrarProductosConStock(productos: Producto[], opts: ProductosOpts = {}) {
  if (opts.incluirSinStock) return productos;
  return productos.filter(productoTieneStockDisponible);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const incluirSinStock = searchParams.get("incluirSinStock") === "true";
  
  try {
    const COLLECTION = "productos";
    const snapshot = await db.collection(COLLECTION).get();
    let productos = snapshot.docs.map(doc => {
      const data = doc.data();
      const producto: Producto = { id: doc.id, ...data };

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

    productos = await filtrarProductosConStock(productos, { incluirSinStock });
    return NextResponse.json(productos);
  } catch (err) {
    console.error("/api/productos GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
