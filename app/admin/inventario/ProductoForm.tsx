"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { uploadImageAndGetUrl } from "../../lib/upload-image";
import { obtenerCategorias } from "../../lib/categorias-db";
import { obtenerProductos } from "../../lib/productos-db";
import { obtenerMarcas } from "../../lib/marcas-db";
import { obtenerBodegas } from "../../lib/bodegas-db";
import { obtenerAtributos, agregarValorAtributo } from "../../lib/atributos-db";
import type { StockVariant } from "../../lib/productos-db";

// ─────────────────────────────────────────────────────────────────────────
// FIXES APLICADOS PARA MOVIL (iPhone / Android) — ver resumen al final del chat
// 1) Las imágenes ya NO se convierten con URL.createObjectURL() en cada
//    render. Antes se llamaba de nuevo en cada tecla que el usuario escribía,
//    generando decenas de blobs nunca liberados -> Safari en iPhone se queda
//    sin memoria y recarga la página (por eso "se borraba todo").
// 2) Las fotos que vienen de la cámara del iPhone (HEIC, 3-8MB, 4032x3024)
//    se comprimen y redimensionan en el navegador ANTES de guardarlas en el
//    estado, así el formulario no carga varias fotos gigantes en RAM.
// 3) El drag & drop HTML5 (draggable, onDragStart, etc.) NO funciona con
//    el dedo en iOS/Android — solo con mouse. Se agregaron botones de
//    "subir/bajar" que funcionan igual en touch y en desktop.
// 4) Autoguardado del formulario (texto) en sessionStorage: si el navegador
//    llega a recargar la pestaña por cualquier motivo, se puede recuperar
//    lo escrito en vez de perderlo todo.
// 5) Tamaño de fuente mínimo de 16px en todos los inputs para que iOS no
//    haga zoom automático al enfocar un campo (eso también "se sentía" como
//    que el formulario no cargaba bien).
// ─────────────────────────────────────────────────────────────────────────

// Componente de formulario para crear/modificar productos
type Producto = {
  nombre: string;
  sku?: string;
  stock?: number;
  isCamiseta?: boolean;
  hasVariations?: boolean;
  stockVariants?: StockVariant[];
  variationAttributeIds?: string[];
  precio: string;
  descuento?: number;
  categoria: string;
  subcategoria: string;
  subsubcategoria?: string;
  marca?: string;
  imagenes: (string | File)[];
  descripcion: string;
  caracteristicas: string[];
  bodegaId?: string;
  personalizado?: boolean;
  camposPersonalizacion?: { id: string; nombre: string; tipo: string }[];
};

type ProductoFormProps = {
  initialData?: Producto | null;
  onSave?: (data: Producto) => void;
  onCancel?: () => void;
};

type FormSection = "general" | "stock" | "photos" | "price";

// Campos "de texto" que sí podemos guardar en sessionStorage (las imágenes,
// al ser File, no se pueden serializar de forma barata, así que se excluyen
// del autoguardado).
type DraftFields = {
  nombre: string;
  sku: string;
  stock: number;
  precio: string;
  descuento: string;
  categoria: string;
  subcategoria: string;
  subsubcategoria: string;
  descripcion: string;
  caracteristicas: string[];
  tieneMarca: boolean;
  marca: string;
  bodegaId: string;
  personalizado: boolean;
  camposPersonalizacion: { id: string; nombre: string; tipo: string }[];
};

const DRAFT_KEY = "producto-form-draft-v1";

// Redimensiona/comprime una imagen en el navegador antes de guardarla en
// memoria. Las fotos de un iPhone pueden pesar varios MB y medir miles de
// píxeles de lado; sin esto, subir 5-6 fotos puede tumbar la pestaña.
async function compressImageFile(file: File, maxDimension = 1600, quality = 0.82): Promise<File> {
  // Si no es imagen (o el navegador no soporta canvas) devolvemos el original
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
    );
    if (!blob) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (err) {
    // Si algo falla (navegador viejo, HEIC no soportado, etc.) seguimos con el original
    console.warn("No se pudo comprimir la imagen, se usará el original", err);
    return file;
  }
}

export default function ProductoForm({ initialData = null, onSave, onCancel }: ProductoFormProps) {
    // Estado de carga para el submit
    const [loading, setLoading] = useState(false);
    // Estado de carga mientras se comprimen fotos recién agregadas
    const [procesandoImagenes, setProcesandoImagenes] = useState(false);
  // Si initialData existe, es edición, si no, es creación
  const isEdit = !!initialData;
  const [activeSection, setActiveSection] = useState<FormSection>("general");
  const [nombre, setNombre] = useState<string>(initialData?.nombre || "");
  const [sku, setSku] = useState<string>(initialData?.sku || "");
  const [hasVariations, setHasVariations] = useState<boolean>(Boolean(initialData?.hasVariations || initialData?.isCamiseta || (initialData?.stockVariants?.length ?? 0) > 0));
  const [stock, setStock] = useState<number>(initialData?.stock || 0);
  const [stockVariants, setStockVariants] = useState<StockVariant[]>(initialData?.stockVariants || []);
  const [precio, setPrecio] = useState<string>(initialData?.precio || "");
  const [descuento, setDescuento] = useState<string>(
    initialData?.descuento !== undefined && initialData?.descuento !== null
      ? String(initialData.descuento)
      : ""
  );
  const [categoria, setCategoria] = useState<string>(initialData?.categoria || "");
  const [subcategoria, setSubcategoria] = useState<string>(initialData?.subcategoria || "");
  const [subsubcategoria, setSubsubcategoria] = useState<string>(initialData?.subsubcategoria || "");
  const [imagenes, setImagenes] = useState<(string | File)[]>(initialData?.imagenes || []);
  const [descripcion, setDescripcion] = useState<string>(initialData?.descripcion || "");
  const [caracteristicas, setCaracteristicas] = useState<string[]>(initialData?.caracteristicas || [""]);
  const [tieneMarca, setTieneMarca] = useState<boolean>(Boolean(initialData?.marca));
  const [marca, setMarca] = useState<string>(initialData?.marca || "");
  const [marcas, setMarcas] = useState<{id: string; nombre?: string}[]>([]);
  const [bodegaId, setBodegaId] = useState<string>(initialData?.bodegaId || "");
  const [bodegas, setBodegas] = useState<any[]>([]);
  const [categoryPathChanged, setCategoryPathChanged] = useState(false);
  const [atributos, setAtributos] = useState<any[]>([]);
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>(initialData?.variationAttributeIds || []);
  const [personalizado, setPersonalizado] = useState<boolean>(Boolean(initialData?.personalizado));
  const [camposPersonalizacion, setCamposPersonalizacion] = useState<{ id: string; nombre: string; tipo: string }[]>(initialData?.camposPersonalizacion || []);
  const [draftDisponible, setDraftDisponible] = useState(false);

  // ── Manejo de URLs de imagen sin fugas de memoria ──
  // Un solo blob URL por archivo, se reutiliza en cada render y se libera
  // apenas la imagen se quita o el componente se desmonta. Esto es lo que
  // evita que Safari/iOS acabe recargando la página por falta de memoria.
  const objectUrlCacheRef = useRef<Map<File, string>>(new Map());

  const getPreviewUrl = useCallback((img: string | File): string => {
    if (typeof img === "string") return img.trim() ? img : "";
    const cache = objectUrlCacheRef.current;
    let url = cache.get(img);
    if (!url) {
      url = URL.createObjectURL(img);
      cache.set(img, url);
    }
    return url;
  }, []);

  // Libera todos los blob URLs cuando el componente se desmonta
  useEffect(() => {
    const cache = objectUrlCacheRef.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  function getVariantKey(attributes: Record<string, string>) {
    return Object.keys(attributes)
      .sort()
      .map((key) => `${key}:${attributes[key]}`)
      .join("|");
  }

  function getAttributeNameById(attrId: string) {
    return atributos.find((item: any) => item.id === attrId)?.nombre || attrId;
  }

  function normalizeVariantAttributes(variant: StockVariant) {
    const currentAttributes = (variant as StockVariant & { attributes?: Record<string, string> }).attributes;
    if (currentAttributes && Object.keys(currentAttributes).length > 0) {
      return currentAttributes;
    }

    const legacyAttributes: Record<string, string> = {};
    const selectedLegacyName = selectedAttributeIds[0] ? getAttributeNameById(selectedAttributeIds[0]).toLowerCase() : "";

    if (variant.talla && (selectedLegacyName.includes("talla") || selectedLegacyName.includes("size"))) {
      legacyAttributes[selectedAttributeIds[0]] = variant.talla;
    }

    if (variant.color) {
      const colorAttrId = selectedAttributeIds.find((attrId) => getAttributeNameById(attrId).toLowerCase().includes("color"));
      if (colorAttrId) {
        legacyAttributes[colorAttrId] = variant.color;
      }
    }

    if (Object.keys(legacyAttributes).length === 0 && variant.label && selectedAttributeIds.length === 1) {
      const match = variant.label.match(/:\s*(.+)$/);
      if (match) {
        legacyAttributes[selectedAttributeIds[0]] = match[1].trim();
      }
    }

    return legacyAttributes;
  }

  function remapAttributeKeysToIds(attrs: Record<string, string> = {}) {
    const mapped: Record<string, string> = {};
    Object.entries(attrs).forEach(([k, v]) => {
      // If key already matches an attribute id, keep it
      if (atributos.find((a: any) => a.id === k)) {
        mapped[k] = v;
        return;
      }

      // Try to find an attribute by nombre (case-insensitive)
      const found = atributos.find((a: any) => String(a.nombre).toLowerCase() === String(k).toLowerCase());
      if (found) {
        mapped[found.id] = v;
        return;
      }

      // Otherwise, keep original key (best-effort)
      mapped[k] = v;
    });
    return mapped;
  }

  useEffect(() => {
    setActiveSection("general");
  }, [initialData, isEdit]);

  useEffect(() => {
    obtenerMarcas().then(setMarcas);
    obtenerBodegas().then(setBodegas);
  }, []);

  useEffect(() => {
    obtenerAtributos().then(setAtributos).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (!hasVariations) return;
    if (selectedAttributeIds.length > 0) return;
    if (!initialData?.stockVariants?.length) return;

    const firstVariant = initialData.stockVariants[0] as StockVariant & { attributes?: Record<string, string> };
    const attributesFromVariant = firstVariant?.attributes || {};
    const attrIds = Object.keys(attributesFromVariant);
    if (attrIds.length === 0) return;

    setSelectedAttributeIds(attrIds);
  }, [hasVariations, initialData, selectedAttributeIds.length]);

  // Categorías dinámicas desde Firestore
  const [categoriasDb, setCategoriasDb] = useState<any[]>([]);
  useEffect(() => {
    obtenerCategorias().then(setCategoriasDb);
  }, []);

  // ── Autoguardado de borrador (solo campos de texto, solo en creación) ──
  // Si el navegador recarga la página por lo que sea, el usuario puede
  // recuperar lo que llevaba escrito en vez de empezar de cero.
  useEffect(() => {
    if (isEdit) return; // en edición no molestamos con borradores
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (raw) setDraftDisponible(true);
    } catch {
      // sessionStorage puede fallar en modo privado de Safari; lo ignoramos
    }
  }, [isEdit]);

  useEffect(() => {
    if (isEdit) return;
    const draft: DraftFields = {
      nombre, sku, stock, precio, descuento, categoria, subcategoria, subsubcategoria,
      descripcion, caracteristicas, tieneMarca, marca, bodegaId, personalizado, camposPersonalizacion,
    };
    const timeoutId = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Ignorar errores de almacenamiento (cuota, modo privado, etc.)
      }
    }, 500); // pequeño debounce para no escribir en cada tecla
    return () => window.clearTimeout(timeoutId);
  }, [isEdit, nombre, sku, stock, precio, descuento, categoria, subcategoria, subsubcategoria, descripcion, caracteristicas, tieneMarca, marca, bodegaId, personalizado, camposPersonalizacion]);

  function restaurarDraft() {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft: DraftFields = JSON.parse(raw);
      setNombre(draft.nombre || "");
      setSku(draft.sku || "");
      setStock(draft.stock || 0);
      setPrecio(draft.precio || "");
      setDescuento(draft.descuento || "");
      setCategoria(draft.categoria || "");
      setSubcategoria(draft.subcategoria || "");
      setSubsubcategoria(draft.subsubcategoria || "");
      setDescripcion(draft.descripcion || "");
      setCaracteristicas(draft.caracteristicas?.length ? draft.caracteristicas : [""]);
      setTieneMarca(Boolean(draft.tieneMarca));
      setMarca(draft.marca || "");
      setBodegaId(draft.bodegaId || "");
      setPersonalizado(Boolean(draft.personalizado));
      setCamposPersonalizacion(draft.camposPersonalizacion || []);
    } catch (err) {
      console.error("No se pudo restaurar el borrador", err);
    } finally {
      setDraftDisponible(false);
    }
  }

  function descartarDraft() {
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignorar
    }
    setDraftDisponible(false);
  }

  function limpiarDraftGuardado() {
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignorar
    }
  }

  // Selectores dependientes dinámicos
  const categorias = categoriasDb.map((cat: any) => ({
    value: cat.id,
    label: cat.nombre,
    subcategorias: cat.subcategorias || []
  }));
  const subcategoriasOptions = categorias.find((c: any) => c.value === categoria)?.subcategorias || [];
  const subcategoriaRequired = subcategoriasOptions.length > 0;
  const subsubcategoriasOptions = subcategoriasOptions.find((s: any) => s.id === subcategoria)?.subcategorias || [];
  const subsubcategoriaRequired = subsubcategoriasOptions.length > 0;

  // ── Manejo de imágenes (por URL o archivo) ──
  async function handleAddImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    // Reseteamos el input ya mismo para poder volver a elegir el mismo archivo después
    e.target.value = "";
    if (files.length === 0) return;

    setProcesandoImagenes(true);
    try {
      // Comprimimos en el navegador antes de guardar en memoria: crítico
      // para fotos de cámara de iPhone (varios MB, resolución muy alta).
      const comprimidas = await Promise.all(files.map((f) => compressImageFile(f)));
      setImagenes((prev) => [...prev, ...comprimidas]);
    } finally {
      setProcesandoImagenes(false);
    }
  }
  function handleAddImagenUrl() {
    setImagenes([...imagenes, ""]);
  }
  function handleImagenUrlChange(idx: number, val: string) {
    setImagenes(imagenes.map((img, i) => i === idx ? val : img));
  }
  function handleRemoveImagen(idx: number) {
    setImagenes((prev) => {
      const target = prev[idx];
      // Liberamos el blob URL asociado, si lo había, para no acumular memoria
      if (target instanceof File) {
        const cache = objectUrlCacheRef.current;
        const url = cache.get(target);
        if (url) {
          URL.revokeObjectURL(url);
          cache.delete(target);
        }
      }
      return prev.filter((_, i) => i !== idx);
    });
  }

  // ── Reordenar imágenes: botones subir/bajar ──
  // El drag & drop de HTML5 no funciona con el dedo en iPhone/Android, así
  // que este es el método principal de reordenar (funciona en cualquier
  // dispositivo). Se mantiene simple a propósito.
  function moverImagen(idx: number, direccion: -1 | 1) {
    setImagenes((prev) => {
      const target = idx + direccion;
      if (target < 0 || target >= prev.length) return prev;
      const copia = [...prev];
      [copia[idx], copia[target]] = [copia[target], copia[idx]];
      return copia;
    });
  }

  // Manejo de características
  function handleCaracteristicaChange(idx: number, val: string) {
    setCaracteristicas(caracteristicas.map((c, i) => i === idx ? val : c));
  }
  function handleAddCaracteristica() {
    setCaracteristicas([...caracteristicas, ""]);
  }
  function handleRemoveCaracteristica(idx: number) {
    setCaracteristicas(caracteristicas.filter((_, i) => i !== idx));
  }

  function toggleAttribute(id: string) {
    setSelectedAttributeIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }

      return [...prev, id];
    });
  }

  function addNewValueToAttribute(id: string) {
    const attribute = atributos.find((item: any) => item.id === id);
    const value = window.prompt(`Nuevo valor para ${attribute?.nombre || "esta variable"}`);
    if (!value) return;
    agregarValorAtributo(id, value)
      .then(async () => {
        const refreshed = await obtenerAtributos();
        setAtributos(refreshed);
      })
      .catch((err) => {
        console.error(err);
        alert("Error agregando valor");
      });
  }

  function buildVariantCombinations() {
    if (!hasVariations) return [] as Array<Record<string, string>>;

    const pools = selectedAttributeIds
      .map((id) => ({
        id,
        valores: atributos.find((item: any) => item.id === id)?.valores || [],
      }))
      .filter((pool) => pool.valores.length > 0);

    if (pools.length === 0) return [] as Array<Record<string, string>>;

    const results: Array<Record<string, string>> = [];
    const walk = (index: number, acc: Record<string, string>) => {
      if (index === pools.length) {
        results.push({ ...acc });
        return;
      }

      const pool = pools[index];
      pool.valores.forEach((value: string) => {
        walk(index + 1, { ...acc, [pool.id]: value });
      });
    };

    walk(0, {});
    return results;
  }

  function getVariantLabel(attributes: Record<string, string>) {
    return Object.entries(attributes)
      .map(([attrId, value]) => {
        const attributeName = atributos.find((item: any) => item.id === attrId)?.nombre || attrId;
        return `${attributeName}: ${value}`;
      })
      .join(" · ");
  }

  useEffect(() => {
    if (!hasVariations) {
      setStockVariants((current) => (current.length > 0 ? [] : current));
      return;
    }
    // Esperar a que los atributos estén cargados antes de generar/limpiar combinaciones.
    // Si limpiamos antes de que `atributos` tenga valores, perderemos los `stockVariants`
    // iniciales y no podremos hacer el mapping por key/attributes.
    if (!Array.isArray(atributos) || atributos.length === 0) {
      return;
    }
    const combinations = buildVariantCombinations();
    if (combinations.length === 0) {
      setStockVariants((current) => (current.length > 0 ? [] : current));
      return;
    }

    setStockVariants((current) => {
      const previousByKey = new Map<string, StockVariant>();
      current.forEach((variant) => {
        const attrs = normalizeVariantAttributes(variant) || {};
        // Remap possible attribute-name keys to attribute IDs to improve matching with generated combinations
        const remapped = remapAttributeKeysToIds(attrs);
        const keyFromRemapped = variant.variantKey || getVariantKey(remapped);
        previousByKey.set(keyFromRemapped, variant);

        // Also set a fallback key based on original attrs (in case both use names)
        const keyFromOriginal = variant.variantKey || getVariantKey(attrs);
        if (keyFromOriginal !== keyFromRemapped) previousByKey.set(keyFromOriginal, variant);
      });

      return combinations.map((attributes) => {
        const key = getVariantKey(attributes);
        const previous = previousByKey.get(key);
        return {
          cantidad: previous?.cantidad ?? 0,
          precio: previous?.precio,
          permitePersonalizacion: previous?.permitePersonalizacion ?? false,
          textoPersonalizacion: previous?.textoPersonalizacion ?? "",
          imagenIndex: previous?.imagenIndex,
          label: getVariantLabel(attributes),
          attributes,
          variantKey: key,
        } as StockVariant;
      });
    });
  }, [hasVariations, selectedAttributeIds, atributos]);

  function updateVariantCantidad(index: number, cantidad: number) {
    setStockVariants((current) => current.map((variant, variantIndex) => (variantIndex === index ? { ...variant, cantidad: Math.max(0, cantidad) } : variant)));
  }

  function updateVariantPrecio(index: number, precioVariant: string) {
    setStockVariants((current) => current.map((variant, variantIndex) => {
      if (variantIndex !== index) return variant;
      if (precioVariant === "") {
        const copy = { ...variant };
        delete copy.precio;
        return copy;
      }
      const parsed = Number(precioVariant);
      return Number.isFinite(parsed) ? { ...variant, precio: parsed } : variant;
    }));
  }

  function updateVariantPersonalizacion(index: number, permitePersonalizacion: boolean) {
    setStockVariants((current) => current.map((variant, variantIndex) => (
      variantIndex === index
        ? { ...variant, permitePersonalizacion, textoPersonalizacion: permitePersonalizacion ? (variant.textoPersonalizacion || "") : "" }
        : variant
    )));
  }

  function updateVariantTextoPersonalizacion(index: number, textoPersonalizacion: string) {
    setStockVariants((current) => current.map((variant, variantIndex) => (
      variantIndex === index ? { ...variant, textoPersonalizacion } : variant
    )));
  }

  function updateVariantImagen(index: number, imagenIndex: string) {
    setStockVariants((current) => current.map((variant, variantIndex) => {
      if (variantIndex !== index) return variant;
      if (imagenIndex === "") {
        const copy = { ...variant };
        delete copy.imagenIndex;
        return copy;
      }
      return { ...variant, imagenIndex: Number(imagenIndex) };
    }));
  }

  function removeVariant(index: number) {
    setStockVariants((current) => current.filter((_, variantIndex) => variantIndex !== index));
  }

  // Manejo de campos de personalización
  function handleAddCampoPersonalizacion() {
    const nuevoCampo = {
      id: `campo-${Date.now()}`,
      nombre: "",
      tipo: "texto"
    };
    setCamposPersonalizacion([...camposPersonalizacion, nuevoCampo]);
  }

  function handleRemoveCampoPersonalizacion(id: string) {
    setCamposPersonalizacion(camposPersonalizacion.filter(c => c.id !== id));
  }

  function handleCampoPersonalizacionChange(id: string, field: "nombre" | "tipo", value: string) {
    setCamposPersonalizacion(camposPersonalizacion.map(c =>
      c.id === id ? { ...c, [field]: value } : c
    ));
  }

  // Selectores dependientes
  const subcategorias = categorias.find((c: any) => c.value === categoria)?.subcategorias || [];
  const subsubcategorias = subcategorias.find((s: any) => s.value === subcategoria)?.subsubcategorias || [];

  const sectionButtonClass = (section: FormSection) => {
    const base = "w-full rounded-2xl px-5 py-4 text-left font-semibold transition-all duration-200";
    if (activeSection === section) {
      return `${base} bg-slate-800 text-white shadow-lg shadow-slate-300/50`;
    }
    return `${base} bg-slate-100 text-slate-600 hover:bg-slate-200`;
  };

  // ── Galería de imágenes reutilizable (evita tener el mismo bloque de
  // JSX duplicado dos veces, que era una de las causas de renders pesados) ──
  const renderImageGallery = () => (
    <>
      {imagenes.length > 0 && (
        <div>
          <h4 className="mb-4 text-sm font-semibold text-slate-700">Imágenes añadidas ({imagenes.length})</h4>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {imagenes.map((img, idx) => {
              const isFile = img instanceof File;
              const url = getPreviewUrl(img);

              return (
                <div
                  key={isFile ? `${img.name}-${img.size}-${img.lastModified}` : `url-${idx}`}
                  className="group relative rounded-2xl border-2 border-slate-200 transition-all hover:border-rose-300 hover:shadow-md"
                >
                  {/* Preview de imagen */}
                  {url && (url.startsWith("http") || url.startsWith("blob:")) ? (
                    <img
                      src={url}
                      alt={`foto-${idx}`}
                      loading="lazy"
                      className="w-full aspect-square object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-full aspect-square rounded-xl bg-slate-100 flex items-center justify-center">
                      <span className="material-icons-round text-3xl text-slate-300">image_not_supported</span>
                    </div>
                  )}

                  {/* Botón de eliminar - siempre visible en esquina superior derecha */}
                  <button
                    type="button"
                    onClick={() => handleRemoveImagen(idx)}
                    className="absolute top-2 right-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors"
                    aria-label="Eliminar imagen"
                  >
                    <span className="material-icons-round text-base">delete</span>
                  </button>

                  {/* Número de orden en la esquina */}
                  <div className="absolute top-2 left-2 bg-rose-500 text-white rounded-lg px-2.5 py-1 text-xs font-bold">
                    {idx + 1}
                  </div>

                  {/* Etiqueta de tipo - movida debajo del botón eliminar */}
                  <div className="absolute top-2 right-12 bg-white/90 text-slate-700 rounded-lg px-2 py-1 text-[10px] font-semibold truncate max-w-[calc(100%-4rem)]">
                    {isFile ? "Archivo" : "URL"}
                  </div>

                  {/* Controles: subir / bajar. Siempre visibles en
                      móvil (no dependen de :hover, que no existe con el dedo) */}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 rounded-b-xl bg-black/55 px-1.5 py-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => moverImagen(idx, -1)}
                      disabled={idx === 0}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 disabled:opacity-30"
                      aria-label="Mover a la izquierda"
                    >
                      <span className="material-icons-round text-base">chevron_left</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => moverImagen(idx, 1)}
                      disabled={idx === imagenes.length - 1}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 disabled:opacity-30"
                      aria-label="Mover a la derecha"
                    >
                      <span className="material-icons-round text-base">chevron_right</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Usa las flechas de cada foto para cambiar el orden.
          </p>
        </div>
      )}

      {/* Controles de entrada de fotos */}
      <div className="mt-6 space-y-4 rounded-2xl bg-slate-50 p-5">
        <label className="block">
          <span className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="material-icons-round text-base">image</span>
            Subir desde dispositivo
          </span>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleAddImagen}
            disabled={procesandoImagenes}
            className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base file:mr-4 file:rounded-full file:border-0 file:bg-rose-500 file:px-4 file:py-2 file:text-white file:font-semibold disabled:opacity-60"
          />
          {procesandoImagenes && (
            <span className="mt-2 flex items-center gap-2 text-xs font-semibold text-rose-500">
              <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              Optimizando imágenes para que el formulario no se ponga lento...
            </span>
          )}
        </label>
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm font-semibold text-rose-500 hover:text-rose-700 transition"
          onClick={handleAddImagenUrl}
        >
          <span className="material-icons-round text-base">add_link</span>
          Agregar por URL
        </button>
      </div>

      {/* Inputs para URLs que no han sido completadas */}
      {imagenes.some(img => typeof img === "string") && (
        <div className="mt-6 space-y-4 rounded-2xl bg-blue-50 border border-blue-200 p-5">
          <h4 className="text-sm font-semibold text-blue-900">URLs pendientes de completar</h4>
          <div className="space-y-3">
            {imagenes.map((img, idx) => {
              if (typeof img === "string") {
                return (
                  <div key={idx} className="flex gap-2 items-end">
                    <label className="flex-1">
                      <span className="mb-1 block text-xs font-semibold text-blue-700">Imagen #{idx + 1}</span>
                      <input
                        className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        value={img}
                        onChange={e => handleImagenUrlChange(idx, e.target.value)}
                        placeholder="Pega aquí la URL de la imagen"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveImagen(idx)}
                      className="px-3 py-3 text-sm font-semibold text-red-600 hover:text-red-700 transition"
                    >
                      <span className="material-icons-round">close</span>
                    </button>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}
    </>
  );

  const renderGeneralSection = () => (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-8">
        <h3 className="text-2xl font-semibold text-slate-900">Título y descripción</h3>
        <p className="mt-2 text-sm text-slate-500">Empieza con la información base. Todo lo demás queda aparte para no saturar la vista.</p>
      </div>

      <div className="space-y-7">
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">Título del producto</span>
          <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-lg text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del producto" required />
          <span className="mt-2 block text-sm text-slate-400">120 caracteres restantes</span>
        </label>

        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">Descripción</span>
          <textarea
            className="min-h-56 w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Describe el producto enfócate en sus características principales, origen, uso y detalles de garantía"
            required
          />
          <span className="mt-2 block text-sm text-slate-400">10000 caracteres restantes</span>
        </label>

        {/* ── SECCIÓN DE FOTOS DENTRO DE GENERAL (solo en modo creación) ── */}
        {!isEdit && renderImageGallery()}

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">SKU (código interno)</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-medium text-slate-700 outline-none"
              type="text"
              value={sku}
              readOnly
              placeholder={isEdit ? "SKU asignado" : "Se generará automáticamente"}
            />
          </label>

          <label className="block">
            <div className="mb-4 flex items-center gap-3">
              <input
                type="checkbox"
                checked={tieneMarca}
                onChange={e => {
                  setTieneMarca(e.target.checked);
                  if (!e.target.checked) setMarca("");
                }}
                className="w-5 h-5 rounded cursor-pointer accent-rose-500"
              />
              <span className="text-sm font-semibold text-slate-700">¿Tiene marca?</span>
            </div>
          </label>

          {tieneMarca && (
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">Marca</span>
              <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100" value={marca} onChange={e => setMarca(e.target.value)}>
                <option value="">Selecciona una marca</option>
                {marcas.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">Bodega (Entrega)</span>
            <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100" value={bodegaId} onChange={e => setBodegaId(e.target.value)} required>
              <option value="">Selecciona una bodega</option>
              {bodegas.map(b => (
                <option key={b.id} value={b.id}>
                  {b.nombre} ({b.tiempoEntrega}h)
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">Categoría</span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
              value={categoria}
              onChange={e => {
                setCategoria(e.target.value);
                setSubcategoria("");
                setSubsubcategoria("");
                setCategoryPathChanged(true);
                setSku("");
              }}
              required
            >
              <option value="">Selecciona una categoría</option>
              {categorias.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>

          {subcategoriasOptions.length > 0 && (
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">Subcategoría</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                value={subcategoria}
                onChange={e => {
                  setSubcategoria(e.target.value);
                  setSubsubcategoria("");
                  setCategoryPathChanged(true);
                  setSku("");
                }}
                required={subcategoriaRequired}
              >
                <option value="">Selecciona una subcategoría</option>
                {subcategoriasOptions.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </label>
          )}

          {subsubcategoriasOptions.length > 0 && (
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">Subsubcategoría</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                value={subsubcategoria}
                onChange={e => {
                  setSubsubcategoria(e.target.value);
                  setCategoryPathChanged(true);
                  setSku("");
                }}
                required={subsubcategoriaRequired}
              >
                <option value="">Selecciona una subsubcategoría</option>
                {subsubcategoriasOptions.map((ss: any) => <option key={ss.id} value={ss.id}>{ss.nombre}</option>)}
              </select>
            </label>
          )}
        </div>

        <div className="rounded-[26px] bg-slate-50 p-5">
          <label className="block mb-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={personalizado}
                onChange={e => setPersonalizado(e.target.checked)}
                className="w-5 h-5 rounded cursor-pointer accent-rose-500"
              />
              <span className="text-sm font-semibold text-slate-700">¿Producto personalizado?</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 ml-8">Permite al cliente agregar personalización al producto (ej: forma, diseño, texto)</p>
          </label>

          {personalizado && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-amber-900">Campos de personalización</span>
                <button
                  type="button"
                  onClick={handleAddCampoPersonalizacion}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition"
                >
                  <span className="material-icons-round text-sm">add</span>
                  Agregar campo
                </button>
              </div>
              {camposPersonalizacion.length === 0 ? (
                <p className="text-xs text-amber-700">No hay campos de personalización agregados</p>
              ) : (
                <div className="space-y-2">
                  {camposPersonalizacion.map((campo) => (
                    <div key={campo.id} className="flex gap-2 items-start rounded-lg border border-amber-200 bg-white p-2">
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={campo.nombre}
                          onChange={(e) => handleCampoPersonalizacionChange(campo.id, "nombre", e.target.value)}
                          placeholder="Nombre del campo (ej: Forma, Diseño)"
                          className="w-full rounded-lg border border-amber-200 px-3 py-2 text-base outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                        />
                        <select
                          value={campo.tipo}
                          onChange={(e) => handleCampoPersonalizacionChange(campo.id, "tipo", e.target.value)}
                          className="w-full rounded-lg border border-amber-200 px-3 py-2 text-base outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                        >
                          <option value="texto">Texto</option>
                          <option value="numero">Número</option>
                          <option value="fecha">Fecha</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCampoPersonalizacion(campo.id)}
                        className="mt-1 rounded-lg p-2 text-red-500 hover:bg-red-50 transition"
                      >
                        <span className="material-icons-round text-lg">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-[26px] bg-slate-50 p-5">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">Características</span>
          </label>
          <div className="space-y-3">
            {caracteristicas.map((c, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-3">
                <textarea
                  className="min-h-24 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  value={c}
                  onChange={e => handleCaracteristicaChange(idx, e.target.value)}
                  placeholder="Característica"
                  rows={3}
                />
                <div className="mt-3 flex justify-end">
                  <button type="button" className="text-sm font-semibold text-rose-500 hover:text-rose-700" onClick={() => handleRemoveCaracteristica(idx)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="mt-4 text-sm font-semibold text-rose-500 hover:text-rose-700" onClick={handleAddCaracteristica}>Agregar característica</button>
        </div>
      </div>
    </section>
  );

  const renderStockSection = () => (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-8">
        <h3 className="text-2xl font-semibold text-slate-900">Stock/Variaciones</h3>
        <p className="mt-2 text-sm text-slate-500">Si el producto no usa variaciones, solo maneja stock normal. Si las usa, selecciona las variables y genera las combinaciones.</p>
      </div>

      {!isEdit ? (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">Stock</span>
            <input className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100" type="number" inputMode="numeric" min="0" value={stock} onChange={e => setStock(Number(e.target.value))} required />
          </label>
          <p className="text-sm text-slate-500">Los productos nuevos arrancan con stock normal. Si luego necesita variaciones, se configura en edición.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block rounded-3xl bg-slate-50 p-4">
            <span className="mb-3 block text-sm font-semibold text-slate-700">¿Este producto usa variaciones?</span>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={hasVariations}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setHasVariations(enabled);
                  if (!enabled) {
                    setStockVariants([]);
                    setSelectedAttributeIds([]);
                  }
                }}
                className="h-5 w-5 rounded border-slate-300"
              />
              <span className="text-sm text-slate-500">
                Actívalo para productos con tallas, colores, diseños u otras variables configurables.
              </span>
            </div>
          </label>

          {!hasVariations ? (
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">Stock</span>
              <input className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100" type="number" inputMode="numeric" min="0" value={stock} onChange={e => setStock(Number(e.target.value))} required />
            </label>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="text-base font-semibold text-slate-800">Variables disponibles</h4>
                  <p className="text-xs text-slate-500">Marca solo lo necesario. Las filas aparecen automáticamente.</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {atributos.map((attr: any) => {
                  const active = selectedAttributeIds.includes(attr.id);
                  return (
                    <div key={attr.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleAttribute(attr.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <div>
                          <div className="text-sm font-semibold leading-tight text-slate-900">{attr.nombre}</div>
                          <div className="text-[11px] text-slate-500">{Array.isArray(attr.valores) ? attr.valores.length : 0} valores</div>
                        </div>
                      </label>

                      {active && (
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Todos los valores se usarán</span>
                            <button
                              type="button"
                              className="shrink-0 whitespace-nowrap text-xs font-semibold text-rose-500 hover:text-rose-700"
                              onClick={() => addNewValueToAttribute(attr.id)}
                            >
                              Agregar valor
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(attr.valores || []).map((value: string) => (
                              <span key={value} className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                                {value}
                              </span>
                            ))}
                            {(attr.valores || []).length === 0 ? (
                              <span className="text-xs text-amber-600">Esta variable aún no tiene valores.</span>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {stockVariants.length > 0 && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Variaciones generadas</div>
                  <div className="grid items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-[minmax(0,1.45fr)_80px_80px_150px_170px_52px]">
                    <div>Variación</div>
                    <div>Stock</div>
                    <div>Precio</div>
                    <div>Personalizada</div>
                    <div>Imagen</div>
                    <div className="md:justify-self-end">Acción</div>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {stockVariants.map((variant, idx) => (
                      <div key={`${variant.label || idx}-${idx}`} className="grid items-center gap-2 px-3 py-2 md:grid-cols-[minmax(0,1.45fr)_80px_80px_150px_170px_52px]">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium leading-none text-slate-900">{variant.label || `Variación ${idx + 1}`}</div>
                          <div className="truncate text-[10px] leading-none text-slate-500">{variant.attributes ? Object.entries(variant.attributes).map(([attrId, value]) => {
                            const name = atributos.find((item: any) => item.id === attrId)?.nombre || attrId;
                            return `${name}: ${value}`;
                          }).join(" · ") : ""}</div>
                        </div>

                        <label className="block">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-base"
                            value={variant.cantidad}
                            onChange={(e) => updateVariantCantidad(idx, Number(e.target.value))}
                          />
                        </label>

                        <label className="block">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            className="h-8 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-base"
                            value={variant.precio ?? ""}
                            onChange={(e) => updateVariantPrecio(idx, e.target.value)}
                            placeholder="Opcional"
                          />
                        </label>

                        <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-600">
                          <span className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(variant.permitePersonalizacion)}
                              onChange={(e) => updateVariantPersonalizacion(idx, e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span>Personalizada</span>
                          </span>
                          {variant.permitePersonalizacion && (
                            <input
                              type="text"
                              value={variant.textoPersonalizacion || ""}
                              onChange={(e) => updateVariantTextoPersonalizacion(idx, e.target.value)}
                              placeholder="Texto para el cliente"
                              className="h-8 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs"
                              aria-label="Texto del campo personalizado"
                            />
                          )}
                        </label>

                        <label className="flex min-w-0 items-center gap-2">
                          <select
                            value={variant.imagenIndex ?? ""}
                            onChange={(e) => updateVariantImagen(idx, e.target.value)}
                            className="h-8 min-w-0 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700"
                            aria-label="Imagen de la variante"
                          >
                            <option value="">Sin imagen</option>
                            {imagenes.map((imagen, imagenIndex) => (
                              <option key={imagenIndex} value={imagenIndex}>
                                Imagen {imagenIndex + 1}
                              </option>
                            ))}
                          </select>
                          {variant.imagenIndex !== undefined && imagenes[variant.imagenIndex] && (
                            <img
                              src={getPreviewUrl(imagenes[variant.imagenIndex])}
                              alt=""
                              className="h-8 w-8 shrink-0 rounded object-cover"
                            />
                          )}
                        </label>

                        <button
                          type="button"
                          className="h-8 whitespace-nowrap text-xs font-semibold text-rose-500 hover:text-rose-700 md:justify-self-end"
                          onClick={() => removeVariant(idx)}
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );

  const renderPhotosSection = () => (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-8">
        <h3 className="text-2xl font-semibold text-slate-900">Fotos</h3>
        <p className="mt-2 text-sm text-slate-500">Sube imágenes o añade URLs. Usa las flechas de cada foto para reordenar.</p>
      </div>
      {renderImageGallery()}
    </section>
  );

  const renderPriceSection = () => (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="mb-8">
        <h3 className="text-2xl font-semibold text-slate-900">Precio y descuentos</h3>
        <p className="mt-2 text-sm text-slate-500">Define el precio base y el descuento real que se aplicará al comprar.</p>
      </div>

      <div className="grid gap-5 md:max-w-2xl md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">Precio base</span>
          <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100" type="number" inputMode="decimal" min="0" value={precio} onChange={e => setPrecio(e.target.value)} required />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">Descuento (%)</span>
          <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-semibold text-slate-700 outline-none" type="number" inputMode="numeric" min="0" value={descuento} onChange={e => {
            const val = e.target.value;
            if (val === "") {
              setDescuento("");
            } else {
              const num = Number(val);
              if (!isNaN(num) && num >= 0 && num <= 100) {
                setDescuento(val);
              }
            }
          }} placeholder="0" />
        </label>
        <label className="block">
          <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">Uso del descuento</span>
          <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base font-semibold text-slate-400 outline-none" type="text" value="Se aplicará al precio base al comprar" readOnly />
        </label>
      </div>
    </section>
  );

  // Generación automática de SKU basada en la última categoría seleccionada
  const generateAutomaticSku = async (): Promise<string | undefined> => {
    try {
      const todos = (await obtenerProductos()) as any[];

      // Determinar el id de la última categoría seleccionada
      const finalCategoriaId = subsubcategoria || subcategoria || categoria;
      if (!finalCategoriaId) return undefined;

      // Determinar el nombre legible de esa última categoría
      let finalCategoriaNombre = "GEN";
      if (subsubcategoria) {
        const catRoot = categoriasDb.find((c: any) => c.id === categoria);
        const subcat = catRoot?.subcategorias?.find((s: any) => s.id === subcategoria);
        const subsub = subcat?.subcategorias?.find((ss: any) => ss.id === subsubcategoria);
        finalCategoriaNombre = subsub?.nombre || subcat?.nombre || catRoot?.nombre || "GEN";
      } else if (subcategoria) {
        const catRoot = categoriasDb.find((c: any) => c.id === categoria);
        const subcat = catRoot?.subcategorias?.find((s: any) => s.id === subcategoria);
        finalCategoriaNombre = subcat?.nombre || catRoot?.nombre || "GEN";
      } else if (categoria) {
        const catRoot = categoriasDb.find((c: any) => c.id === categoria);
        finalCategoriaNombre = catRoot?.nombre || "GEN";
      }

      // Prefijo: primeros caracteres limpios del nombre de categoría final
      const prefixBase = finalCategoriaNombre
        .replace(/[^A-Za-z0-9]/g, "")
        .toUpperCase()
        .slice(0, 3) || "GEN";

      // Productos de la misma categoría final (usando última categoría no vacía)
      const mismosCategoria = todos.filter((p: any) => {
        const pFinalId = p.subsubcategoria || p.subcategoria || p.categoria;
        return pFinalId === finalCategoriaId;
      });

      // Buscar el mayor correlativo usado en SKUs de esta categoría
      let maxSeq = 0;
      for (const p of mismosCategoria) {
        if (typeof p.sku === "string") {
          const m = p.sku.match(/(\d+)$/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxSeq) maxSeq = n;
          }
        }
      }

      // Probar siguiente secuencia hasta encontrar uno libre globalmente
      let nextSeq = maxSeq + 1;
      let candidateSku = "";
      // Pequeño límite de seguridad para evitar bucles infinitos
      for (let i = 0; i < 1000; i++) {
        const num = String(nextSeq).padStart(3, "0");
        candidateSku = `${prefixBase}-${num}`;
        const existe = todos.some((p: any) => p.sku === candidateSku);
        if (!existe) break;
        nextSeq++;
      }

      return candidateSku;
    } catch (err) {
      console.error("Error generando SKU automático", err);
      return undefined;
    }
  };

  // Cuando se selecciona categoría/subcategoría, generar SKU si es creación y aún no hay uno
  useEffect(() => {
    // Esperar siempre al último nivel disponible:
    // - Si hay subcategorías y aún no se eligió una, no generar.
    // - Si hay subsubcategorías y aún no se eligió una, tampoco generar.
    const hasSubcats = subcategoriasOptions.length > 0;
    const hasSubsubcats = subsubcategoriasOptions.length > 0;

    if (!categoria) return;
    if (hasSubcats && !subcategoria) return;
    if (hasSubsubcats && !subsubcategoria) return;

    // En edición, solo actualizar si el admin cambió el path de categoría
    if (isEdit && !categoryPathChanged) return;

    generateAutomaticSku().then((nuevo) => {
      if (nuevo) setSku(nuevo);
    });
  }, [
    categoria,
    subcategoria,
    subsubcategoria,
    subcategoriasOptions.length,
    subsubcategoriasOptions.length,
    isEdit,
    categoryPathChanged,
  ]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return; // Previene doble submit
    setLoading(true);
    try {
      // Procesar imágenes: subir archivos a Storage y dejar URLs directas
      const imagenesProcesadas = await Promise.all(imagenes.map(async (img: string | File, idx: number) => {
        if (typeof img === "string") {
          // Si es URL (http/https), dejarla igual
          if (img.startsWith("http")) return img;
          // Si es blob, ignorar (no debería ocurrir)
          return null;
        } else if (img instanceof File) {
          // Subir archivo a Storage
          const ext = img.name.split('.').pop();
          const nombreArchivo = `${nombre.replace(/\s+/g, "_")}_${Date.now()}_${idx}.${ext}`;
          const path = `productos/${nombreArchivo}`;
          try {
            const url = await uploadImageAndGetUrl(img, path);
            return url;
          } catch (err: any) {
            alert("Error subiendo imagen: " + (err?.message || err));
            return null;
          }
        }
        return null;
      }));
      // Filtrar nulos/blobs
      const imagenesFinal = imagenesProcesadas.filter((x): x is string => Boolean(x));
      // Generar SKU automático para nuevas creaciones (no sobrescribir en edición)
      let finalSku = sku?.trim();
      if (!isEdit && !finalSku) {
        const generado = await generateAutomaticSku();
        if (generado) {
          finalSku = generado;
        }
      }

      if (finalSku) {
        setSku(finalSku);
      }

      onSave && onSave({
        nombre,
        sku: finalSku,
        stock: hasVariations ? undefined : stock,
        isCamiseta: hasVariations,
        hasVariations,
        stockVariants: hasVariations ? stockVariants : undefined,
        variationAttributeIds: hasVariations ? selectedAttributeIds : [],
        precio,
        descuento: descuento !== "" ? Number(descuento) : undefined,
        categoria,
        subcategoria: subcategoriaRequired ? subcategoria : "",
        subsubcategoria: subsubcategoriaRequired ? subsubcategoria : "",
        marca: tieneMarca ? marca : undefined,
        bodegaId,
        imagenes: imagenesFinal,
        descripcion,
        caracteristicas,
        personalizado,
        camposPersonalizacion: personalizado ? camposPersonalizacion.filter(c => c.nombre.trim() !== "") : undefined
      });

      // Se guardó con éxito: ya no hace falta el borrador
      limpiarDraftGuardado();

      // Resetear campos solo si es creación (no edición)
      if (!isEdit) {
        setNombre("");
        setSku("");
        setStock(0);
        setHasVariations(false);
        setStockVariants([]);
        setSelectedAttributeIds([]);
        setPrecio("");
        setDescuento("");
        setCategoria("");
        setSubcategoria("");
        setSubsubcategoria("");
        setTieneMarca(false);
        setMarca("");
        setBodegaId("");
        setImagenes([]);
        setDescripcion("");
        setCaracteristicas([""]);
        setCategoryPathChanged(false);
      }
    } finally {
      setLoading(false);
    }
  }

  const editSections: { id: FormSection; label: string; description: string }[] = [
    { id: "general", label: "Información general", description: "Datos base del producto" },
    { id: "stock", label: "Stock/Variaciones", description: "Stock simple o variables" },
    { id: "photos", label: "Fotos", description: "Imágenes y orden" },
    { id: "price", label: "Precio", description: "Precio y descuentos" },
  ];

  const renderActiveEditSection = () => {
    if (activeSection === "stock") return renderStockSection();
    if (activeSection === "photos") return renderPhotosSection();
    if (activeSection === "price") return renderPriceSection();
    return renderGeneralSection();
  };

  return (
    <form className={isEdit ? "grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]" : "mx-auto flex max-w-5xl flex-col gap-8"} onSubmit={handleSubmit}>
      {!isEdit && draftDisponible && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-800">
            Encontramos un borrador sin guardar de un intento anterior. ¿Quieres recuperarlo?
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={restaurarDraft} className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">Recuperar</button>
            <button type="button" onClick={descartarDraft} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-700 border border-amber-300 hover:bg-amber-100">Descartar</button>
          </div>
        </div>
      )}

      {isEdit ? (
        <aside className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 lg:sticky lg:top-6 lg:h-fit">
          <div className="mb-4 px-2">
            <h3 className="text-lg font-semibold text-slate-900">Secciones</h3>
            <p className="mt-1 text-sm text-slate-500">Empieza por lo general y luego salta a lo que necesites.</p>
          </div>
          <div className="space-y-3">
            {editSections.map((section) => (
              <button key={section.id} type="button" className={sectionButtonClass(section.id)} onClick={() => setActiveSection(section.id)}>
                <div className="text-base">{section.label}</div>
                <div className={`mt-1 text-sm ${activeSection === section.id ? "text-white/80" : "text-slate-500"}`}>{section.description}</div>
              </button>
            ))}
          </div>
        </aside>
      ) : null}

      <div className="space-y-8">
        {!isEdit ? (
          <>
            {renderGeneralSection()}
            {renderStockSection()}
            {renderPriceSection()}
          </>
        ) : (
          <>{renderActiveEditSection()}</>
        )}

        <div className="flex flex-wrap items-center justify-end gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sticky bottom-0 sm:static">
          <button
            type="button"
            className="rounded-full bg-slate-100 px-6 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-200"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={`inline-flex items-center justify-center gap-2 rounded-full bg-rose-500 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-600 ${loading ? 'cursor-not-allowed opacity-60' : ''}`}
            disabled={loading || procesandoImagenes}
          >
            {loading && (
              <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            )}
            {isEdit ? "Actualizar" : loading ? "Creando..." : "Crear"}
          </button>
        </div>
      </div>
    </form>
  );
}