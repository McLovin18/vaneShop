"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useUser } from "../context/UserContext";
import { useRouter } from "next/navigation";
import { useTracking } from "../lib/useAnalytics";
import { useToast } from "../context/ToastContext";
import { getCatalogPricing } from "../lib/pricing";

const cardStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Barlow:wght@400;500;600;700&display=swap');

  @keyframes pc-fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── wrapper ── */
  .pc-link {
    display: block;
    width: 100%;
    height: 100%;
    text-decoration: none;
  }

  /* ── card ── */
  .pc-card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--card);
    overflow: hidden;
    cursor: pointer;
    border: 1px solid var(--border);
    transition: border-color 0.25s, box-shadow 0.25s;
    /* Optimización para iOS Safari */
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
  }

  .pc-card:hover {
    border-color: var(--secondary);
    box-shadow: 0 8px 40px color-mix(in srgb, var(--primary) 14%, transparent);
  }

  /* Desactivar hover en dispositivos táctiles para mejorar rendimiento */
  @media (hover: none) {
    .pc-card:hover {
      border-color: var(--border);
      box-shadow: none;
    }
  }

  /* ── imagen ── */
  .pc-img-wrap {
    position: relative;
    width: 100%;
    /* aspect-ratio cuadrado en mobile, más alto en desktop */
    aspect-ratio: 1 / 1;
    background: var(--galleryImgBg);
    overflow: hidden;
    flex-shrink: 0;
  }

  @media (min-width: 640px) {
    .pc-img-wrap {
      aspect-ratio: 4 / 4;
    }
  }

  .pc-img-wrap img {
    object-fit: contain !important;
    padding: 0% !important;
    transition: transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94) !important;
  }

  .pc-card:hover .pc-img-wrap img {
    transform: scale(1.06) !important;
  }

  /* ── badge descuento ── */
  .pc-badge-discount {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 10;
    background: var(--secondary);
    color: var(--secondaryForeground);
    font-family: 'Barlow', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 3px 8px;
    border-radius: 2px;
  }

  /* ── sin stock overlay ── */
  .pc-no-stock {
    position: absolute;
    inset: 0;
    z-index: 10;
    background: rgba(245,245,243,0.72);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pc-no-stock span {
    font-family: 'Barlow', sans-serif;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--mutedForeground);
    background: var(--card);
    border: 1px solid var(--border);
    padding: 5px 12px;
    border-radius: 2px;
  }

  /* ── fav btn ── */
  .pc-fav {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 20;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: none;
    background: rgba(255,255,255,0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transform: scale(0.85);
    transition: opacity 0.2s, transform 0.2s, background 0.2s;
    backdrop-filter: blur(4px);
  }

  .pc-fav.is-fav {
    opacity: 1;
    transform: scale(1);
    background: var(--secondary);
    color: var(--secondaryForeground);
  }

  .pc-card:hover .pc-fav {
    opacity: 1;
    transform: scale(1);
  }

  /* ── información del producto ── */
  .pc-info {
    background: var(--card);
    color: var(--cardForeground);
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
  }

  @media (min-width: 640px) {
    .pc-info {
      padding: 14px 16px 16px;
    }
  }

  /* nombre — cursiva serif como en la imagen */
  .pc-name {
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    font-weight: 600;
    font-size: 13px;
    line-height: 1.3;
    color: var(--cardForeground);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-decoration: underline;
    text-underline-offset: 2px;
    text-decoration-thickness: 1px;
    text-decoration-color: color-mix(in srgb, var(--cardForeground) 35%, transparent);
    min-height: 2.6em;
    max-height: 2.6em;
    align-items: flex-start;
  }

  @media (min-width: 640px) {
    .pc-name {
      font-size: 15px;
      min-height: 2.6em;
      max-height: 2.6em;
    }
  }

  /* precio */
  .pc-prices {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-top: 2px;
    flex-wrap: wrap;
  }

  .pc-price-final {
    font-family: 'Barlow', sans-serif;
    font-weight: 700;
    font-size: 13px;
    color: var(--cardForeground);
    letter-spacing: 0.02em;
  }

  @media (min-width: 640px) {
    .pc-price-final {
      font-size: 15px;
    }
  }

  .pc-price-old {
    font-family: 'Barlow', sans-serif;
    font-weight: 400;
    font-size: 11px;
    color: color-mix(in srgb, var(--cardForeground) 55%, transparent);
    text-decoration: line-through;
  }

  .pc-price-currency {
    font-size: 0.8em;
    font-weight: 400;
    opacity: 0.6;
  }

  /* ── botones acción — mini row en fondo negro ── */
  .pc-actions {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }

  .pc-btn-cart {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    height: 30px;
    border: 1px solid color-mix(in srgb, var(--cardForeground) 25%, transparent);
    background: transparent;
    color: var(--cardForeground);
    font-family: 'Barlow', sans-serif;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-radius: 2px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  .pc-btn-cart:hover:not(:disabled) {
    background: color-mix(in srgb, var(--cardForeground) 8%, transparent);
    border-color: color-mix(in srgb, var(--cardForeground) 50%, transparent);
  }

  .pc-btn-cart:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .pc-btn-cart.in-cart {
    border-color: var(--secondary);
    color: var(--secondary);
  }

  .pc-btn-eye {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in srgb, var(--cardForeground) 25%, transparent);
    background: transparent;
    color: var(--cardForeground);
    border-radius: 2px;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  .pc-btn-eye:hover {
    background: color-mix(in srgb, var(--cardForeground) 8%, transparent);
    border-color: color-mix(in srgb, var(--cardForeground) 50%, transparent);
  }
`;

function ProductoCard({
  producto,
  onClick,
  showCart = false,
  showEye = true,
  onAddCart,
  onEye,
  showFav = false,
  isCompact = true,
  index = 0,
}: {
  producto?: any;
  onClick?: any;
  showCart?: boolean;
  showEye?: boolean;
  onAddCart?: any;
  onEye?: any;
  showFav?: boolean;
  index?: number;
  isCompact?: boolean;
} = {}): JSX.Element | null {
  if (!producto || !producto.id) return null;

  const {
    isLogged,
    isAdmin,
    favoritos,
    addFavorito,
    removeFavorito,
    carrito,
    addCarrito,
    removeCarrito,
  } = useUser();
  const router = useRouter();
  const { trackProductClick } = useTracking();
  const { showToast } = useToast();

  const isFav = favoritos?.some((p) => p.id === producto.id);
  const inCart = carrito?.some((p) => p.id === producto.id);

  const hasVariations =
    producto?.hasVariations || producto?.isCamiseta || false;
  const variationAttributeIds = producto?.variationAttributeIds || [];
  const stockVariants = producto?.stockVariants || [];

  const totalStock = hasVariations
    ? stockVariants.reduce((sum: number, v: any) => sum + (v?.cantidad || 0), 0) || 0
    : producto?.stock || 0;
  const sinStock = totalStock === 0;

  const { basePrice, discount, hasDiscount, fakeOldPrice, finalPrice } =
    getCatalogPricing(producto);

  const getDetailUrl = () => {
    let detailUrl = `/product-detail?id=${producto.id}`;
    try {
      if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
        detailUrl = `/admin/product-detail?id=${producto.id}`;
      } else {
        if (isAdmin) detailUrl = `/admin/product-detail?id=${producto.id}`;
      }
    } catch {
      if (isAdmin) detailUrl = `/admin/product-detail?id=${producto.id}`;
    }
    return detailUrl;
  };

  const detailUrl = getDetailUrl();

  const goToDetail = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    trackProductClick().catch(console.error);
    router.push(detailUrl);
  };

  const handleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isFav ? removeFavorito(producto.id) : addFavorito(producto);
  };

  const handleCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (sinStock) return;

    if (hasVariations && variationAttributeIds.length > 0) {
      showToast("Selecciona las opciones en el detalle del producto", "info");
      router.push(detailUrl);
      return;
    }

    if (onAddCart) {
      onAddCart({
        ...producto,
        precioBase: basePrice,
        precioUnitario: finalPrice,
        descuento: hasDiscount ? discount : 0,
      });
      showToast("Añadido al carrito", "success");
      return;
    }

    if (inCart) {
      removeCarrito(producto.id);
      showToast("Eliminado del carrito", "info");
    } else {
      addCarrito({
        ...producto,
        cantidad: 1,
        precioBase: basePrice,
        precioUnitario: finalPrice,
        descuento: hasDiscount ? discount : 0,
      });
      showToast(`${producto.nombre} añadido al carrito`, "success");
    }
  };

  return (
    <>
      <style>{cardStyles}</style>
      <Link
        href={detailUrl}
        className="pc-link"
        style={{
          opacity: 0,
          animation: "pc-fadeIn 0.4s ease forwards",
          animationDelay: `${index * 80}ms`,
        }}
      >
        <div className="pc-card" onClick={onClick || goToDetail}>
          {/* ── IMAGEN ── */}
          <div className="pc-img-wrap">
            <Image
              src={producto.imagenes?.[0] || "/no-image.png"}
              alt={producto.nombre}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain"
              style={{
                opacity: 0,
                transition: "opacity 0.4s ease",
              }}
              onLoad={(e) => {
                (e.currentTarget as HTMLImageElement).style.opacity = "1";
              }}
              priority={index < 4}
              loading={index < 4 ? "eager" : "lazy"}
            />

            {/* Badge descuento */}
            {hasDiscount && (
              <div className="pc-badge-discount">-{discount}%</div>
            )}

            {/* Sin stock */}
            {sinStock && (
              <div className="pc-no-stock">
                <span>Sin stock</span>
              </div>
            )}

            {/* Favorito */}
            {isLogged && (
              <button
                onClick={handleFav}
                className={`pc-fav${isFav ? " is-fav" : ""}`}
                title={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
              >
                <span className="material-icons-round" style={{ fontSize: 15 }}>
                  {isFav ? "favorite" : "favorite_border"}
                </span>
              </button>
            )}
          </div>

          {/* ── INFO BARRA NEGRA ── */}
          <div className="pc-info">
            <p className="pc-name">{producto.nombre}</p>

            <div className="pc-prices">
              {hasDiscount && (
                <span className="pc-price-old">
                  ${fakeOldPrice.toFixed(2)}
                </span>
              )}
              <span className="pc-price-final">
                ${finalPrice.toFixed(2)}{" "}
                <span className="pc-price-currency">USD</span>
              </span>
            </div>

            {(showCart || showEye) && (
              <div className="pc-actions">
                {showCart && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!sinStock) handleCart(e);
                    }}
                    disabled={sinStock}
                    className={`pc-btn-cart${inCart ? " in-cart" : ""}`}
                  >
                    <span className="material-icons-round" style={{ fontSize: 13 }}>
                      {inCart ? "remove_shopping_cart" : "add_shopping_cart"}
                    </span>
                    {inCart ? "Quitar" : "Añadir"}
                  </button>
                )}
                {showEye && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onEye ? onEye(producto) : goToDetail(e);
                    }}
                    className="pc-btn-eye"
                    title="Ver detalle"
                  >
                    <span className="material-icons-round" style={{ fontSize: 15 }}>
                      visibility
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    </>
  );
}

export default React.memo(ProductoCard);