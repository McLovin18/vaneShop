"use client";

import { obtenerProductoPorId, obtenerProductosPorCategoria, obtenerProductosPorSubcategoria, obtenerProductosPorSubsubcategoria } from "../lib/productos-db";
import { obtenerAtributos } from "../lib/atributos-db";
import { Loading3DIcon } from "../components/Loading3DIcon";
import ProductoCard from "../components/ProductoCard";
import RelatedProductsCarousel from "../components/RelatedProductsCarousel";
import VariationsManager from "../components/VariationsManager";
import React, { useState, useEffect } from "react";
import { ProductReview } from "../lib/reviews-types";
import { useUser } from "../context/UserContext";
import { useToast } from "../context/ToastContext";
import { useSearchParams } from "next/navigation";
import BottomBarPublic from "../components/BottomBarPublic";
import dynamic from "next/dynamic";
import { getCartItemKey } from "../context/userLocalStorage";
import { getCatalogPricing } from "../lib/pricing";

const Markdown = dynamic(() => import("../components/Markdown"), { ssr: false });

export default function ProductDetailPage({ params }) {
  const [relacionados, setRelacionados] = useState([]);
  const [producto, setProducto] = useState(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewName, setReviewName] = useState("");
  const [reviewEmail, setReviewEmail] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"caracteristicas" | "resenas" | null>("caracteristicas");
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const variationStorageKey = `product_variations_${producto?.id}`;
  const [currentStock, setCurrentStock] = useState(0);
  const [atributos, setAtributos] = useState<Record<string, string>>({}); // Mapeo de ID -> nombre
  const [personalizacionValues, setPersonalizacionValues] = useState<Record<string, string>>({});
  const [variacionPersonalizada, setVariacionPersonalizada] = useState("");
  const [shouldScrollToImage, setShouldScrollToImage] = useState(false);
  const imageRef = React.useRef<HTMLDivElement>(null);

  const {
    isLogged, user, isAdmin,
    favoritos, addFavorito, removeFavorito,
    carrito, addCarrito, removeCarrito,
  } = useUser();

  const { showToast } = useToast();

  const searchParams = useSearchParams();

  // Cargar atributos disponibles
  useEffect(() => {
    obtenerAtributos()
      .then((attrs) => {
        const mapping: Record<string, string> = {};
        attrs.forEach((attr: any) => {
          mapping[attr.id] = attr.nombre;
        });
        setAtributos(mapping);
      })
      .catch((err) => console.error("Error cargando atributos:", err));
  }, []);



  useEffect(() => {
    if (!producto?.id) return;

    try {
      const saved = localStorage.getItem(variationStorageKey);

      if (saved) {
        const parsed = JSON.parse(saved);

        setSelectedVariations(parsed);
      }
    } catch (err) {
      console.error("Error cargando variaciones guardadas:", err);
    }
  }, [producto?.id]);



  useEffect(() => {
  if (!producto?.id) return;

  try {
    localStorage.setItem(
      variationStorageKey,
      JSON.stringify(selectedVariations)
    );
  } catch (err) {
    console.error("Error guardando variaciones:", err);
  }
}, [selectedVariations, producto?.id]);

  useEffect(() => {
    if (!producto?.imagenes?.length || !Array.isArray(producto?.stockVariants)) return;
    const variationAttributeIds = producto.variationAttributeIds || [];
    const selectedVariant = producto.stockVariants.find((variant: any) => {
      const attrs = variant.attributes || {};
      return variationAttributeIds.every((attrId: string) => attrs[attrId] === selectedVariations[attrId]);
    });
    
    // Verificar si todas las variaciones están seleccionadas
    const allSelected = variationAttributeIds.every((attrId: string) => selectedVariations[attrId]);
    
    if (typeof selectedVariant?.imagenIndex === "number" && producto.imagenes[selectedVariant.imagenIndex]) {
      const oldImgIdx = imgIdx;
      setImgIdx(selectedVariant.imagenIndex);
      
      // Si se completó la selección y la imagen cambió, hacer scroll hacia la imagen
      if (allSelected && oldImgIdx !== selectedVariant.imagenIndex) {
        setShouldScrollToImage(true);
      }
    }
  }, [producto, selectedVariations, imgIdx]);

  // Scroll suave hacia la imagen cuando se completa la selección
  useEffect(() => {
    if (shouldScrollToImage && imageRef.current) {
      // Detectar si es móvil para hacer scroll
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        const offset = -80; // Offset negativo para ir más arriba
        const elementPosition = imageRef.current.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset + offset;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
      setShouldScrollToImage(false);
    }
  }, [shouldScrollToImage]);



  useEffect(() => {
    async function fetchProducto() {
      setLoading(true);
      const id = params?.id || searchParams.get("id");
      if (!id) { setProducto(null); setRelacionados([]); setLoading(false); return; }
      
      // Cargar producto principal
      const prod = await obtenerProductoPorId(id);
      setProducto(prod);
      
      // Cargar reviews y relacionados en paralelo después de tener el producto
      if (prod) {
        // Ejecutar reviews y relacionados en paralelo
        Promise.all([
          fetchReviews(id),
          (async () => {
            let rel = [];
            console.log("[RELACIONADOS] subsubcategoria:", prod.subsubcategoria, "subcategoria:", prod.subcategoria, "categoria:", prod.categoria);
            
            // Intentar subsubcategoria primero
            if (prod.subsubcategoria) {
              rel = await obtenerProductosPorSubsubcategoria(prod.subsubcategoria, prod.id, 10);
              console.log("[RELACIONADOS] encontrados por subsubcategoria:", rel);
            }
            
            // Fallback a subcategoria si no hay resultados
            if ((!rel || rel.length === 0) && prod.subcategoria) {
              rel = await obtenerProductosPorSubcategoria(prod.subcategoria, prod.id, 10);
              console.log("[RELACIONADOS] encontrados por subcategoria:", rel);
            }
            
            // Fallback a categoria si aún no hay resultados
            if ((!rel || rel.length === 0) && prod.categoria) {
              rel = await obtenerProductosPorCategoria(prod.categoria, prod.id, 10);
              console.log("[RELACIONADOS] encontrados por categoria:", rel);
            }
            
            setRelacionados(rel);
          })()
        ]).catch(err => {
          console.error("Error cargando datos adicionales:", err);
          setRelacionados([]);
        });
      } else {
        setRelacionados([]);
      }
      
      setLoading(false);
    }
    fetchProducto();
    // eslint-disable-next-line
  }, [params?.id, searchParams]);

  useEffect(() => {
    if (isLogged && user) {
      setReviewName(user.displayName || "");
      setReviewEmail(user.email || "");
    }
  }, [isLogged, user]);

  async function fetchReviews(productId: string) {
    try {
      const res = await fetch(`/api/reviews?productId=${productId}`, { cache: 'no-store' });
      if (res.ok) setReviews(await res.json());
    } catch {}
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewLoading(true);
    setReviewError("");
    if (!reviewRating || !reviewText) {
      setReviewError("Completa la calificación y el comentario");
      setReviewLoading(false);
      return;
    }
    if (!isLogged && (!reviewName || !reviewEmail)) {
      setReviewError("Completa nombre y correo para publicar la reseña");
      setReviewLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: producto.id,
          userId: user?.uid || "",
          userName: reviewName || user?.displayName || "Usuario",
          userEmail: reviewEmail,
          rating: reviewRating,
          comment: reviewText,
        }),
      });
      if (res.ok) {
        setReviewText("");
        setReviewRating(0);
        if (!isLogged) { setReviewName(""); setReviewEmail(""); }
        fetchReviews(producto.id);
      } else {
        setReviewError("Error al enviar reseña");
      }
    } catch {
      setReviewError("Error de red");
    }
    setReviewLoading(false);
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center mt-2">
        <Loading3DIcon />
        <span className="mt-4 text-slate-400 dark:text-white/30 text-sm">Cargando producto...</span>
      </div>
    );
  }

  if (!producto) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center mt-2 gap-3">
        <span className="material-icons-round text-5xl text-slate-200 dark:text-white/10">inventory_2</span>
        <p className="text-slate-400 dark:text-white/30 font-medium">Producto no encontrado</p>
      </div>
    );
  }

  // ── Derivados ────────────────────────────────────────────────────────────
  const hasVariations = producto?.hasVariations || producto?.isCamiseta || false;
  const variationAttributeIds = producto?.variationAttributeIds || [];
  const stockVariants = producto?.stockVariants || [];
  const selectedStockVariant = stockVariants.find((variant) => {
    const attrs = variant.attributes || {};
    return variationAttributeIds.every((attrId) => attrs[attrId] === selectedVariations[attrId]);
  });
  const permitePersonalizacionDeVariacion = Boolean(selectedStockVariant?.permitePersonalizacion);
  const textoPersonalizacionDeVariacion = selectedStockVariant?.textoPersonalizacion?.trim() || "Escribe el valor:";
  
  // Calcular maxCantidad basado en currentStock (que es actualizado por VariationsManager)
  const maxCantidad = hasVariations ? currentStock : (producto?.stock || 0);
  
  const isFav = favoritos?.some((p) => p.id === producto?.id);
  
  // Generar cartKey basado en variaciones seleccionadas
  const generateCartKey = () => {
    if (!hasVariations) return producto.id;
    if (variationAttributeIds.length === 0) return producto.id;
    
    // Verificar que todas las variaciones estén seleccionadas
    const allSelected = variationAttributeIds.every(attrId => selectedVariations[attrId]);
    if (!allSelected) return null;
    
    // Generar key con valores de variaciones
    const values = variationAttributeIds.map(attrId => selectedVariations[attrId]).join(":");
    const customValue = permitePersonalizacionDeVariacion ? variacionPersonalizada.trim() : "";
    return `${producto.id}:${values}${customValue ? `:personalizado:${customValue}` : ""}`;
  };
  
  const currentCartKey = generateCartKey();
  const inCart = currentCartKey ? carrito?.some((p) => getCartItemKey(p) === currentCartKey) : false;
  
  // Detectar si es un producto de ensambles (subcategoría 1775935523162)
  const isEnsamblesProduct = producto.subcategoria === "1775935523162";
  const imageContainerWidthClass = isEnsamblesProduct ? "md:w-[60%]" : "md:w-[44%]";

  // Obtener precio base - soportar variaciones dinámicas
  const basePrice = (() => {
    if (!hasVariations) return Number(producto.precio || 0);
    
    if (variationAttributeIds.length === 0) return Number(producto.precio || 0);
    
    // Verificar que todas las variaciones estén seleccionadas
    const allSelected = variationAttributeIds.every(attrId => selectedVariations[attrId]);
    if (!allSelected) return Number(producto.precio || 0);
    
    // Encontrar variante que coincida
    const matchingVariant = stockVariants.find((variant) => {
      const attrs = variant.attributes || {};
      return variationAttributeIds.every(
        (attrId) => attrs[attrId] === selectedVariations[attrId]
      );
    });
    
    return matchingVariant?.precio ?? Number(producto.precio || 0);
  })();
  
  const { discount, hasDiscount, fakeOldPrice, finalPrice } = getCatalogPricing({
    ...producto,
    precio: basePrice,
  });

  const avgRating = reviews.length > 0
    ? reviews.reduce((a, b) => a + b.rating, 0) / reviews.length
    : 0;

  const handleAddCart = () => {
    // Validar variaciones si el producto las tiene
    if (hasVariations && variationAttributeIds.length > 0) {
      const allSelected = variationAttributeIds.every(attrId => selectedVariations[attrId]);
      if (!allSelected) {
        showToast("Por favor selecciona todas las opciones", "error");
        return;
      }
    }

    if (permitePersonalizacionDeVariacion && !variacionPersonalizada.trim()) {
      showToast("Escribe el nombre para el grabado", "error");
      return;
    }

    // Validar campos de personalización si el producto es personalizado
    if ((producto as any)?.personalizado && (producto as any)?.camposPersonalizacion) {
      const camposRequeridos = (producto as any).camposPersonalizacion;
      const camposFaltantes = camposRequeridos.filter((campo: any) => !personalizacionValues[campo.id] || personalizacionValues[campo.id].trim() === "");
      
      if (camposFaltantes.length > 0) {
        showToast("Por favor completa todos los campos de personalización", "error");
        return;
      }
    }

    if (inCart && currentCartKey) {
      removeCarrito(currentCartKey);
      showToast("Eliminado del carrito", "info");
    } else if (currentCartKey) {
      const cartItem = {
        ...producto,
        cantidad,
        precioBase: basePrice,
        precioUnitario: finalPrice,
        stock: maxCantidad,
        ...(hasVariations && { selectedVariations, variationAttributeIds }),
        ...(permitePersonalizacionDeVariacion && { variacionPersonalizada: variacionPersonalizada.trim() }),
        ...(producto as any)?.personalizado && { personalizacionValues },
        cartKey: currentCartKey,
      };
      addCarrito(cartItem);
      showToast(`${producto.nombre} añadido al carrito`, "success");
    }
  };
  const handleFav = () => {
    isFav ? removeFavorito(producto.id) : addFavorito(producto);
  };

  const parseDesc = (text: string) => {
    if (!text) return [];
    const lines = text.split(/\r?\n/);
    const items: { text: string; sub: string[] }[] = [];
    let current: string | null = null;
    let sub: string[] = [];
    lines.forEach((line) => {
      const l = line.trim();
      if (!l) return;
      if (l.startsWith("»")) {
        if (current !== null) { items.push({ text: current, sub }); sub = []; }
        current = l.replace(/^»+/, "").trim();
      } else if (l.startsWith("–")) {
        sub.push(l.replace(/^–+/, "").trim());
      } else {
        if (sub.length > 0) sub[sub.length - 1] += " " + l;
        else if (current !== null) current += " " + l;
      }
    });
    if (current !== null) items.push({ text: current, sub });
    return items;
  };

  const descItems = parseDesc((producto as any).descripcion || "");
  const rawDescripcion = (producto as any).descripcion || "";

  const inputCls =
    "w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/25 focus:outline-none focus:border-slate-400 dark:focus:border-white/30 transition-colors";

  const reviewsProps = {
    reviews, avgRating, reviewRating, setReviewRating,
    reviewName, setReviewName, reviewEmail, setReviewEmail,
    reviewText, setReviewText, reviewError, reviewLoading,
    handleSubmitReview, isLogged, inputCls,
  };

  const hasCaracteristicas = producto.caracteristicas?.length > 0;

  const handleTabToggle = (tab: "caracteristicas" | "resenas") => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  };

  return (
    <div className="public-product-page min-h-screen flex flex-col mt-2 bg-[var(--bg)] text-[var(--text)] transition-colors">
      <BottomBarPublic/>

      <div className="max-w-5xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-col md:flex-row gap-8 lg:gap-14">

          {/* ══ GALERÍA + TABS ══════════════════════════════════════ */}
          <div className={`w-full ${imageContainerWidthClass} flex flex-col gap-3`}>

            {/* Imagen principal */}
            <div ref={imageRef} className="relative aspect-square rounded-2xl overflow-hidden bg-[var(--card)] border border-[var(--border)]">
              {hasDiscount && (
                <span className="absolute top-3 left-3 z-10 bg-[var(--secondary)] text-[var(--secondaryForeground)] text-xs font-bold px-2 py-0.5 rounded-full">
                  -{discount}%
                </span>
              )}
              <img
                src={producto.imagenes[imgIdx]}
                alt={producto.nombre}
                className="w-full h-full object-contain p-5"
              />
              {producto.imagenes.length > 1 && imgIdx > 0 && (
                <button
                  onClick={() => setImgIdx(imgIdx - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[var(--card)] border border-[var(--border)] shadow flex items-center justify-center hover:scale-105 transition-transform"
                >
                  <span className="material-icons-round text-slate-600 dark:text-white/70 text-lg">chevron_left</span>
                </button>
              )}
              {producto.imagenes.length > 1 && imgIdx < producto.imagenes.length - 1 && (
                <button
                  onClick={() => setImgIdx(imgIdx + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[var(--card)] border border-[var(--border)] shadow flex items-center justify-center hover:scale-105 transition-transform"
                >
                  <span className="material-icons-round text-slate-600 dark:text-white/70 text-lg">chevron_right</span>
                </button>
              )}
            </div>

            {/* Miniaturas */}
            {producto.imagenes.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {producto.imagenes.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setImgIdx(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all bg-[var(--bgSecondary)] ${
                      imgIdx === idx
                        ? "border-slate-400 dark:border-white/30 scale-105"
                        : "border-transparent opacity-50 hover:opacity-80"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-contain p-1.5" />
                  </button>
                ))}
              </div>
            )}

            {/* ── TABS: Características / Reseñas — solo desktop ───── */}
            <div className="hidden md:flex mt-1 flex-col gap-0 py-18">
              {/* Botones tab */}
              <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.08]">
                {hasCaracteristicas && (
                  <button
                    onClick={() => handleTabToggle("caracteristicas")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all ${
                      activeTab === "caracteristicas"
                            ? "bg-[var(--primary)] text-[var(--primaryForeground)]"
                            : "bg-[var(--card)] text-[var(--text)] hover:bg-[var(--bgSecondary)]"
                    }`}
                  >
                    <span className="material-icons-round text-[16px]">list_alt</span>
                    Características
                  </button>
                )}
                <button
                  onClick={() => handleTabToggle("resenas")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all ${
                    hasCaracteristicas ? "border-l border-slate-200 dark:border-white/[0.08]" : ""
                  } ${
                    activeTab === "resenas"
                            ? "bg-[var(--primary)] text-[var(--primaryForeground)]"
                            : "bg-[var(--card)] text-[var(--text)] hover:bg-[var(--bgSecondary)]"
                  }`}
                >
                  <span className="material-icons-round text-[16px]">star_outline</span>
                  Reseñas
                  {reviews.length > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      activeTab === "resenas"
                        ? "bg-white text-black"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {reviews.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Panel de contenido del tab activo */}
              {activeTab && (
                <div className="border border-t-0 border-[var(--border)] rounded-b-xl px-4 py-4 bg-[var(--bgSecondary)]">

                  {/* Panel: Características */}
                  {activeTab === "caracteristicas" && hasCaracteristicas && (
                    <ul className="space-y-2">
                      {producto.caracteristicas.map((c, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-sm text-black/80 dark:text-white/80">
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20 mt-2 flex-shrink-0" />
                          <Markdown>{c}</Markdown>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Panel: Reseñas */}
                  {activeTab === "resenas" && (
                    <ReviewsSection {...reviewsProps} />
                  )}

                </div>
              )}
            </div>
            {/* ── FIN TABS ─────────────────────────────────────────── */}

          </div>

          {/* ══ INFO ════════════════════════════════════════════════ */}
          <div className="flex-1 flex flex-col gap-5 min-w-0">

            {/* Nombre + SKU */}
            <div>
              <h1
                className="text-2xl sm:text-3xl font-bold leading-tight text-slate-800 dark:text-white break-words max-w-full whitespace-pre-line"
                style={{ wordBreak: "break-word", maxWidth: "100%" }}
                title={producto.nombre}
              >
                {producto.nombre}
              </h1>
              <p className="text-xs text-slate-400 dark:text-white/20 mt-1.5">
                SKU: {producto.sku || producto.id}
              </p>
            </div>

            {/* Rating inline */}
            {reviews.length > 0 && (
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={`text-base ${i < Math.round(avgRating) ? "text-yellow-400" : "text-slate-200 dark:text-white/10"}`}>★</span>
                ))}
                <span className="text-xs text-slate-400 dark:text-white/25 ml-1">
                  {avgRating.toFixed(1)} ({reviews.length})
                </span>
              </div>
            )}

            <div className="flex items-baseline gap-3 flex-wrap">
              {hasDiscount && (
                <span className="text-sm text-slate-400 dark:text-white/20 line-through">
                  ${fakeOldPrice?.toFixed(2)}
                </span>
              )}
              <span className="text-3xl font-extrabold text-slate-800 dark:text-white">
                ${finalPrice.toFixed(2)}
              </span>
              {hasDiscount && (
                <span className="text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-400/10 px-2 py-0.5 rounded-full">
                  {discount}% OFF
                </span>
              )}
            </div>

            <div className="h-px bg-slate-100 dark:bg-white/[0.06]" />

            {/* Stock */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 dark:text-white/30 font-medium">Disponibilidad:</span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                hasVariations && variationAttributeIds.length > 0 && !variationAttributeIds.every(attrId => selectedVariations[attrId])
                  ? "bg-blue-50 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400"
                  : maxCantidad > 0
                  ? "bg-green-50 dark:bg-green-400/10 text-green-700 dark:text-green-400"
                  : "bg-red-50 dark:bg-red-400/10 text-red-600 dark:text-red-400"
              }`}>
                {hasVariations && variationAttributeIds.length > 0 && !variationAttributeIds.every(attrId => selectedVariations[attrId])
                  ? "Selecciona opciones para ver stock"
                  : maxCantidad > 0
                  ? `${maxCantidad} en stock`
                  : "Sin stock"}
              </span>
            </div>

            {/* Selectors de variaciones */}
            {hasVariations && variationAttributeIds.length > 0 && (
              <VariationsManager
                stockVariants={stockVariants}
                variationAttributeIds={variationAttributeIds}
                attributeNames={atributos}
                selectedVariations={selectedVariations}
                onVariationChange={(attrId, value) => {
                  setSelectedVariations(prev => {
                    const updated = {
                      ...prev,
                      [attrId]: value
                    };

                    return updated;
                  });

                  setCantidad(1);
                  setVariacionPersonalizada("");
                }}
                onStockChange={setCurrentStock}
              />
            )}

            {permitePersonalizacionDeVariacion && (
              <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bgSecondary)" }}>
                <label className="block text-sm font-semibold" style={{ color: "var(--text)" }}>
                  {textoPersonalizacionDeVariacion}
                </label>
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                  Completa este campo para esta variante.
                </p>
                <input
                  type="text"
                  value={variacionPersonalizada}
                  onChange={(e) => setVariacionPersonalizada(e.target.value)}
                  placeholder={textoPersonalizacionDeVariacion}
                  maxLength={80}
                  className="mt-3 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                  style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--text)" }}
                />
              </div>
            )}

            {/* Campos de personalización */}
            {(producto as any)?.personalizado && (producto as any)?.camposPersonalizacion && (producto as any).camposPersonalizacion.length > 0 && (
              <div className="mt-6 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bgSecondary)" }}>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "#92400e" }}>
                  <span className="material-icons-round text-base">auto_awesome</span>
                  Personalización
                </h3>
                <div className="space-y-3">
                  {(producto as any).camposPersonalizacion.map((campo: any) => (
                    <div key={campo.id}>
                      <label className="block text-xs font-medium mb-1" style={{ color: "var(--text)" }}>
                        {campo.nombre}
                      </label>
                      {campo.tipo === "texto" ? (
                        <input
                          type="text"
                          value={personalizacionValues[campo.id] || ""}
                          onChange={(e) => setPersonalizacionValues(prev => ({ ...prev, [campo.id]: e.target.value }))}
                          placeholder={`Ingresa ${campo.nombre.toLowerCase()}`}
                          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                          style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--text)" }}
                        />
                      ) : campo.tipo === "numero" ? (
                        <input
                          type="number"
                          value={personalizacionValues[campo.id] || ""}
                          onChange={(e) => setPersonalizacionValues(prev => ({ ...prev, [campo.id]: e.target.value }))}
                          placeholder={`Ingresa ${campo.nombre.toLowerCase()}`}
                          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                          style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--text)" }}
                        />
                      ) : campo.tipo === "fecha" ? (
                        <input
                          type="date"
                          value={personalizacionValues[campo.id] || ""}
                          onChange={(e) => setPersonalizacionValues(prev => ({ ...prev, [campo.id]: e.target.value }))}
                          className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
                          style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--text)" }}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cantidad */}
            {maxCantidad > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 dark:text-white/30 font-medium">Cantidad:</span>
                <div className="flex items-center bg-[var(--bgSecondary)] rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setCantidad((v) => Math.max(1, v - 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-white/60 hover:bg-white dark:hover:bg-white/10 font-bold text-lg transition-colors"
                  >−</button>
                  <span className="w-9 text-center text-sm font-semibold text-slate-800 dark:text-white">
                    {cantidad}
                  </span>
                  <button
                    onClick={() => setCantidad((v) => Math.min(maxCantidad, v + 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-white/60 hover:bg-white dark:hover:bg-white/10 font-bold text-lg transition-colors"
                  >+</button>
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-2">
              <button
                onClick={handleAddCart}
                disabled={maxCantidad === 0 || (hasVariations && variationAttributeIds.length > 0 && !variationAttributeIds.every(attrId => selectedVariations[attrId]))}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border transition-all ${
                  maxCantidad === 0 || (hasVariations && variationAttributeIds.length > 0 && !variationAttributeIds.every(attrId => selectedVariations[attrId]))
                    ? "bg-white text-slate-300 border-slate-200 cursor-not-allowed opacity-50 shadow-none"
                    : inCart
                      ? "bg-[var(--card)] text-[var(--text)] border-[var(--primary)] hover:border-[var(--primaryHover)] hover:shadow-md"
                      : "bg-[var(--card)] text-[var(--text)] border-[var(--border)] hover:border-[var(--primary)] hover:shadow-md"
                }`}
              >
                <span className="material-icons-round text-[18px]">
                  {inCart ? "remove_shopping_cart" : "add_shopping_cart"}
                </span>
                {inCart ? "Quitar del carrito" : "Añadir al carrito"}
              </button>

              {isLogged && (
                <button
                  onClick={handleFav}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                    isFav
                      ? "bg-red-500 text-white shadow"
                      : "bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary)] hover:shadow-sm"
                  }`}
                  title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
                >
                  <span className="material-icons-round text-xl">
                    {isFav ? "favorite" : "favorite_border"}
                  </span>
                </button>
              )}
            </div>

            {/* Descripción debajo de Añadir al carrito */}
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-2 text-black dark:text-white">Descripción del producto</h2>
              {rawDescripcion.trim() ? (
                descItems.length > 0 && (descItems.length > 1 || descItems[0].sub.length > 0 || descItems[0].text !== rawDescripcion.trim()) ? (
                  <ul className="space-y-2">
                    {descItems.map((item, idx) => (
                      <li key={idx} className="flex gap-2 text-sm text-black/80 dark:text-white/80 leading-relaxed">
                        <span className="text-slate-300 dark:text-white/20 flex-shrink-0 mt-0.5">›</span>
                        <span>
                          {item.text}
                          {item.sub.length > 0 && (
                            <ul className="mt-1 space-y-0.5 ml-3">
                              {item.sub.map((s, j) => (
                                <li key={j} className="flex gap-1.5 text-slate-400 dark:text-white/35">
                                  <span className="flex-shrink-0">–</span>{s}
                                </li>
                              ))}
                            </ul>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-black/80 dark:text-white/80 leading-relaxed whitespace-pre-line">{rawDescripcion}</p>
                )
              ) : (
                <p className="text-sm text-slate-400 dark:text-white/40">Sin descripción</p>
              )}
            </div>

            {/* Descripción */}
            {descItems.length > 0 && (
              <ul className="space-y-2">
                <h1 className="text-black bg-text-white">Descripción:</h1>
                {descItems.map((item, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-black/80 dark:text-white/80 leading-relaxed">
                    <span className="text-slate-300 dark:text-white/20 flex-shrink-0 mt-0.5">›</span>
                    <span>
                      {item.text}
                      {item.sub.length > 0 && (
                        <ul className="mt-1 space-y-0.5 ml-3">
                          {item.sub.map((s, j) => (
                            <li key={j} className="flex gap-1.5 text-slate-400 dark:text-white/35">
                              <span className="flex-shrink-0">–</span>{s}
                            </li>
                          ))}
                        </ul>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>

        {/* ── TABS móvil: debajo de info, encima de relacionados ── */}
        <div className="md:hidden mt-4 flex flex-col gap-0">
          <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-white/[0.08]">
            {hasCaracteristicas && (
              <button
                onClick={() => handleTabToggle("caracteristicas")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all ${
                  activeTab === "caracteristicas"
                    ? "bg-black text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="material-icons-round text-[16px]">list_alt</span>
                Características
              </button>
            )}
            <button
              onClick={() => handleTabToggle("resenas")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all ${
                hasCaracteristicas ? "border-l border-slate-200 dark:border-white/[0.08]" : ""
              } ${
                activeTab === "resenas"
                  ? "bg-black text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="material-icons-round text-[16px]">star_outline</span>
              Reseñas
              {reviews.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === "resenas"
                    ? "bg-white text-black"
                    : "bg-slate-100 text-slate-600"
                }`}>
                  {reviews.length}
                </span>
              )}
            </button>
          </div>

          {activeTab && (
            <div className="border border-t-0 border-slate-200 dark:border-white/[0.08] rounded-b-xl px-4 py-4 bg-slate-50 dark:bg-white/[0.02]">
              {activeTab === "caracteristicas" && hasCaracteristicas && (
                <ul className="space-y-2">
                  {producto.caracteristicas.map((c, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-black/80 dark:text-white/80">
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20 mt-2 flex-shrink-0" />
                      <Markdown>{c}</Markdown>
                    </li>
                  ))}
                </ul>
              )}
              {activeTab === "resenas" && (
                <ReviewsSection {...reviewsProps} />
              )}
            </div>
          )}
        </div>
        {/* ── FIN TABS móvil ───────────────────────────────────── */}

      {/* Productos relacionados */}
      <div className="max-w-7xl mx-auto w-full px-1 sm:px-3 pb-10">
        <RelatedProductsCarousel productos={relacionados} title="Productos relacionados" />
      </div>
    </div>
  );
}

// ── Componente de reseñas ─────────────────────────────────────────────────────
function ReviewsSection({
  reviews, avgRating,
  reviewRating, setReviewRating,
  reviewName, setReviewName,
  reviewEmail, setReviewEmail,
  reviewText, setReviewText,
  reviewError, reviewLoading,
  handleSubmitReview, isLogged, inputCls,
}: any) {
  return (
    <div className="space-y-6">
      {/* Resumen */}
      {reviews.length > 0 ? (
        <div className="flex items-center gap-3">
          <span className="text-4xl font-extrabold text-slate-800 dark:text-white leading-none">
            {avgRating.toFixed(1)}
          </span>
          <div>
            <div className="flex gap-0.5 mb-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={`text-lg ${i < Math.round(avgRating) ? "text-yellow-400" : "text-slate-200 dark:text-white/10"}`}>★</span>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-white/25">
              {reviews.length} reseña{reviews.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-black/80 dark:text-white/80">Sé el primero en dejar una reseña.</p>
      )}

      {/* Lista de reseñas */}
      {reviews.length > 0 && (
        <ul className="space-y-4">
          {reviews.map((r: any) => (
            <li key={r.id} className="pb-4 border-b border-slate-100 dark:border-white/[0.05]">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-sm font-semibold text-slate-700 dark:text-white/75">{r.userName}</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`text-sm ${i < r.rating ? "text-yellow-400" : "text-slate-200 dark:text-white/10"}`}>★</span>
                  ))}
                </div>
                <span className="text-xs text-slate-300 dark:text-white/20 ml-auto">
                  {new Date(r.createdAt).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-white/45 leading-relaxed">{r.comment}</p>
            </li>
          ))}
        </ul>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmitReview} className="pt-2 space-y-4">
        <p className="text-sm font-medium text-black/80 dark:text-white/80">Escribe una reseña</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-black/75 dark:text-white/80">Nombre</label>
            <input className={inputCls} placeholder="Tu nombre" value={reviewName}
              onChange={(e) => setReviewName(e.target.value)} required={!isLogged} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-black/75 dark:text-white/80">Correo</label>
            <input className={inputCls} placeholder="tu@correo.com" type="email" value={reviewEmail}
              onChange={(e) => setReviewEmail(e.target.value)} required={!isLogged} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-black/80 dark:text-white/80">Calificación</label>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} onClick={() => setReviewRating(i + 1)} role="button"
                aria-label={`Calificación ${i + 1}`}
                className={`text-2xl cursor-pointer transition-transform hover:scale-110 select-none ${
                  i < reviewRating ? "text-yellow-400" : "text-slate-200 dark:text-white/10"
                }`}>★</span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-black/80 dark:text-white/80">Comentario</label>
          <textarea className={`${inputCls} resize-none`} rows={3}
            placeholder="Cuéntanos tu experiencia..." value={reviewText}
            onChange={(e) => setReviewText(e.target.value)} required />
        </div>

        {reviewError && (
          <p className="text-xs text-red-500 dark:text-red-400">{reviewError}</p>
        )}

        <div className="flex items-center justify-between gap-4">
          <button type="submit" disabled={reviewLoading}
            className="px-6 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-bold hover:border-black/60 hover:text-black hover:shadow-sm disabled:opacity-40 transition-all">
            {reviewLoading ? "Enviando..." : "Publicar reseña"}
          </button>
        </div>
      </form>
    </div>
  );
}

