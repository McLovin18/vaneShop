"use client";

import React, { useEffect, useState, useRef } from "react";
import ProductoCard from "./ProductoCard";

export type RelatedProductsCarouselProps = {
  productos: any[];
  title?: string;
};

export default function RelatedProductsCarousel({
  productos = [],
  title = "Productos relacionados",
}: RelatedProductsCarouselProps) {
  // ── State ──
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [itemsPerView, setItemsPerView] = useState(4);
  const [animDir, setAnimDir] = useState<"left" | "right">("right");
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Limitar a máximo 10 productos
  const productosLimitados = productos.slice(0, 10);

  // ── Responsive items per view ──
  useEffect(() => {
    const updateItemsPerView = () => {
      if (typeof window === "undefined") return;
      const width = window.innerWidth;
      if (width < 640) setItemsPerView(1);
      else if (width < 1024) setItemsPerView(2);
      else setItemsPerView(4);
    };
    updateItemsPerView();
    window.addEventListener("resize", updateItemsPerView);
    return () => window.removeEventListener("resize", updateItemsPerView);
  }, []);

  // ── IntersectionObserver para detectar visibilidad ──
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        setIsVisible(e.isIntersecting);
      },
      { threshold: 0.25 }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [containerRef.current]);

  const effectiveItemsPerView = Math.min(itemsPerView, productosLimitados.length);
  const hasCarousel = productosLimitados.length > effectiveItemsPerView;

  // ── Autoplay ──
  useEffect(() => {
    if (!hasCarousel || isHovered || !isVisible) return;
    const id = setInterval(() => {
      setAnimDir("right");
      setIsAnimating(true);
      setCurrentIndex((prev) => (prev + 1) % productosLimitados.length);
      setTimeout(() => setIsAnimating(false), 300);
    }, 4000);
    return () => clearInterval(id);
  }, [hasCarousel, isHovered, isVisible, productosLimitados.length]);

  if (!productosLimitados.length) return null;

  // ── Productos visibles ──
  const getVisibleProducts = () => {
    const count = hasCarousel ? effectiveItemsPerView : productosLimitados.length;
    const slice: any[] = [];
    for (let i = 0; i < count; i++) {
      const idx = (currentIndex + i) % productosLimitados.length;
      slice.push(productosLimitados[idx]);
    }
    return slice;
  };

  const visibleProducts = getVisibleProducts();
  const isSingleVisible = effectiveItemsPerView === 1;

  // ── Navegación ──
  const handlePrev = () => {
    if (!hasCarousel || isAnimating) return;
    setAnimDir("left");
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev - 1 + productosLimitados.length) % productosLimitados.length);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleNext = () => {
    if (!hasCarousel || isAnimating) return;
    setAnimDir("right");
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev + 1) % productosLimitados.length);
    setTimeout(() => setIsAnimating(false), 300);
  };

  return (
    <div className={hasCarousel ? "w-full" : "w-auto"}>
      <h2 className="text-xl font-bold mb-4 mt-10 text-slate-800 dark:text-white px-3 sm:px-6">
        {title}
      </h2>

      {productosLimitados.length > 0 ? (
        <div
          ref={containerRef}
          className={`relative overflow-hidden ${hasCarousel ? "w-full px-10 sm:px-6 md:px-12" : "w-auto"}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Flecha izquierda */}
          {hasCarousel && (
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Anterior"
              className="absolute left-1 md:left-2 top-[40%] z-20 h-9 w-9 md:h-10 md:w-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-md hover:bg-purple-50 dark:hover:bg-purple-900/40 hover:border-purple-300 hover:scale-105 transition-all"
            >
              <span className="material-icons-round text-[18px] md:text-[20px]">
                chevron_left
              </span>
            </button>
          )}

          {/* Flecha derecha */}
          {hasCarousel && (
            <button
              type="button"
              onClick={handleNext}
              aria-label="Siguiente"
              className="absolute right-1 md:right-2 top-[40%] z-20 h-9 w-9 md:h-10 md:w-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-md hover:bg-purple-50 dark:hover:bg-purple-900/40 hover:border-purple-300 hover:scale-105 transition-all"
            >
              <span className="material-icons-round text-[18px] md:text-[20px]">
                chevron_right
              </span>
            </button>
          )}

          {/* Grid de productos */}
          <div
            className="grid place-items-center justify-center md:justify-start"
            style={{
              gridTemplateColumns: `repeat(${effectiveItemsPerView}, minmax(0, 1fr))`,
              width: "100%",
              maxWidth: "1200px",
              gap: hasCarousel ? "0.5rem" : "0.5rem",
              animation: isAnimating
                ? `slideIn${animDir === "right" ? "Right" : "Left"} 0.28s ease`
                : undefined,
            }}
          >
            {visibleProducts
              .filter((prod: any) => prod && prod.id)
              .map((prod: any, idx: number) => (
              <div
                key={`${prod.id}-${currentIndex}-${idx}`}
                className="transition-all duration-300 flex flex-col items-stretch justify-stretch"
                style={{ 
                  width: "100%",
                  minWidth: 0,
                  maxWidth: effectiveItemsPerView === 1 ? "340px" : "280px"
                }}
              >
                <ProductoCard producto={prod} />
              </div>
            ))}
          </div>

          {/* Dots indicadores */}
          {hasCarousel && productosLimitados.length > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: productosLimitados.length }).map((_, i) => (
                <button
                  key={i}
                  aria-label={`Ir a producto ${i + 1}`}
                  onClick={() => {
                    setAnimDir(i > currentIndex ? "right" : "left");
                    setCurrentIndex(i);
                  }}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === currentIndex ? 24 : 8,
                    height: 8,
                    background:
                      i === currentIndex
                        ? "var(--accent, #7c3aed)"
                        : "var(--border, #e2e8f0)",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-slate-400 dark:text-white/30 text-center py-8 px-3">
          No hay productos relacionados para mostrar.
        </div>
      )}

      {/* Keyframes de animación */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

