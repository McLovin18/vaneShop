import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/firebase-admin";

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
  imagenes?: string[];
  imagen?: string;
  [key: string]: any;
}

async function filtrarProductosConStock(productos: Producto[], opts?: { incluirSinStock?: boolean }) {
  const incluirSinStock = opts?.incluirSinStock ?? false;
  
  return productos.filter((p) => {
    if (!p) return false;
    
    // Si tiene variaciones, verificar si alguna tiene stock
    if (p.hasVariations && Array.isArray(p.stockVariants)) {
      const hasStock = p.stockVariants.some((v: StockVariant) => v.cantidad > 0);
      return incluirSinStock || hasStock;
    }
    
    // Si no tiene variaciones, verificar stock general
    return incluirSinStock || (p.stock ?? 0) > 0;
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoria = searchParams.get("categoria");
  const subcategoria = searchParams.get("subcategoria");
  const subsubcategoria = searchParams.get("subsubcategoria");
  const excludeId = searchParams.get("excludeId");
  const limit = parseInt(searchParams.get("limit") || "10");
  const incluirSinStock = searchParams.get("incluirSinStock") === "true";

  try {
    let query = db.collection("productos");
    
    if (subsubcategoria) {
      query = query.where("subsubcategoria", "==", subsubcategoria);
    } else if (subcategoria) {
      query = query.where("subcategoria", "==", subcategoria);
    } else if (categoria) {
      query = query.where("categoria", "==", categoria);
    }
    
    const snapshot = await query.limit(limit * 2).get(); // Obtener más para filtrar
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

    // Excluir el producto actual
    if (excludeId) {
      productos = productos.filter(p => p.id !== excludeId);
    }

    // Filtrar por stock
    productos = await filtrarProductosConStock(productos, { incluirSinStock });

    // Limitar resultados
    productos = productos.slice(0, limit);

    return NextResponse.json(productos);
  } catch (err) {
    console.error("/api/productos/relacionados GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
