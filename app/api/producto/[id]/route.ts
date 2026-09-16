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

// Función para sanitizar datos de producto y evitar errores de serialización
function sanitizeProducto(data: any): Producto {
  const producto: Producto = { id: data.id };
  
  // Copiar campos básicos de forma segura
  const safeFields = ['nombre', 'descripcion', 'precio', 'descuento', 'stock', 
                     'isCamiseta', 'hasVariations', 'categoria', 'subcategoria', 
                     'subsubcategoria', 'marca', 'bodegaId', 'destacado', 'imagenes', 'imagen',
                     'tallas', 'colores', 'variationAttributeIds'];
  
  for (const field of safeFields) {
    if (data[field] !== undefined) {
      producto[field] = data[field];
    }
  }
  
  // Sanitizar stockVariants
  if (Array.isArray(data.stockVariants)) {
    producto.stockVariants = data.stockVariants.map((variant: any) => {
      const safeVariant: StockVariant = { cantidad: variant.cantidad || 0 };
      if (variant.talla) safeVariant.talla = variant.talla;
      if (variant.color) safeVariant.color = variant.color;
      if (variant.precio) safeVariant.precio = variant.precio;
      if (variant.permitePersonalizacion !== undefined) safeVariant.permitePersonalizacion = variant.permitePersonalizacion;
      if (variant.textoPersonalizacion) safeVariant.textoPersonalizacion = variant.textoPersonalizacion;
      if (typeof variant.imagenIndex === 'number') safeVariant.imagenIndex = variant.imagenIndex;
      if (variant.attributes) safeVariant.attributes = variant.attributes;
      if (variant.label) safeVariant.label = variant.label;
      if (variant.variantKey) safeVariant.variantKey = variant.variantKey;
      return safeVariant;
    });
  }
  
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
  
  // Copiar cualquier otro campo de forma segura (evitando objetos circulares)
  for (const key in data) {
    if (!safeFields.includes(key) && key !== 'stockVariants' && key !== 'createdAt' && key !== 'fechaCreacion') {
      const value = data[key];
      // Solo copiar valores primitivos o arrays simples
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
        producto[key] = value;
      } else if (Array.isArray(value) && value.every((item: any) => typeof item === 'string' || typeof item === 'number')) {
        producto[key] = value;
      }
    }
  }
  
  return producto;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("/api/producto/[id] Starting request");
    const { id } = await params;
    console.log("/api/producto/[id] fetching id:", id);
    
    if (!id) {
      console.error("/api/producto/[id] id is undefined");
      return NextResponse.json({ error: "ID no proporcionado" }, { status: 400 });
    }
    
    console.log("/api/producto/[id] Attempting to fetch from Firestore");
    const doc = await db.collection("productos").doc(id).get();
    console.log("/api/producto/[id] doc exists:", doc.exists);
    
    if (!doc.exists) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const data = doc.data();
    if (!data) {
      console.error("/api/producto/[id] data is undefined");
      return NextResponse.json({ error: "Producto sin datos" }, { status: 500 });
    }
    
    // Usar sanitización para manejar datos problemáticos
    const producto = sanitizeProducto({ id: doc.id, ...data });

    console.log("/api/producto/[id] returning product:", producto.id);
    return NextResponse.json(producto);
  } catch (err) {
    console.error("/api/producto/[id] GET error:", err);
    console.error("/api/producto/[id] error name:", err instanceof Error ? err.name : 'Unknown');
    console.error("/api/producto/[id] error message:", err instanceof Error ? err.message : String(err));
    console.error("/api/producto/[id] error stack:", err instanceof Error ? err.stack : 'No stack');
    return NextResponse.json({ error: "Internal server error", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
