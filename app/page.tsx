"use client";

import { useEffect, useMemo, useState, Suspense } from "react";

import BottomBarPublic from "./components/BottomBarPublic";
import WhatsAppFloatingButton from "./components/WhatsAppFloatingButton";
import { SectionRenderer } from "./landing/sectionRegistry";
import { getLandingPage } from "./lib/landing-db";
import { obtenerProductos } from "./lib/productos-db";
import type { LandingSection } from "./lib/landing-types";
import { useUser } from "./context/UserContext";
import ContactSection from "./landing/sections/ContactSection";

// Componente para cargar productos de forma diferida
function LazyProducts({ onProductsLoaded }: { onProductsLoaded: (products: any[]) => void }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch('/api/productos');
        if (!response.ok) throw new Error('Error fetching productos');
        const products = await response.json();
        const recentProducts = (products || [])
          .filter((p: any) => p?.id)
          .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 10);
        onProductsLoaded(recentProducts);
      } catch (error) {
        console.error("Error cargando productos:", error);
        onProductsLoaded([]);
      } finally {
        setLoaded(true);
      }
    };

    // Usar requestIdleCallback para cargar productos cuando el navegador esté inactivo
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => loadProducts());
    } else {
      // Fallback para navegadores que no soportan requestIdleCallback
      setTimeout(() => loadProducts(), 100);
    }
  }, [onProductsLoaded]);

  return null;
}

export default function Home() {
  const { isLogged } = useUser();
  const [landing, setLanding] = useState<{
    hero?: Record<string, any> | null;
    sections?: LandingSection[];
    featuredProducts?: string[];
  } | null>(null);
  const [featuredProductsResolved, setFeaturedProductsResolved] = useState<any[]>([]);
  const [landingLoading, setLandingLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadLanding = async () => {
      try {
        const data = await getLandingPage();

        if (mounted) {
          setLanding(data);
          setLandingLoading(false);
        }
      } catch (error) {
        console.error("Error cargando landing publicada:", error);
        if (mounted) {
          setLanding(null);
          setLandingLoading(false);
        }
      }
    };

    loadLanding();

    return () => {
      mounted = false;
    };
  }, []);





  const landingSections = useMemo(() => {
    const sections = landing?.sections ?? [];
    const heroSection = landing?.hero
      ? [
          {
            id: "landing-hero",
            type: "hero",
            props: landing.hero,
            order: -1,
            hidden: false,
          } as LandingSection,
        ]
      : [];

    return [...heroSection, ...sections]
      .filter((section) => !section.hidden)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [landing]);

  const renderedSections = useMemo(() => {
    // Primero renderizar secciones que no dependen de productos
    const sectionsWithoutProducts = landingSections.filter(section => 
      section.type !== "featuredProducts" && section.type !== "featuredCategories"
    );

    // Secciones con productos se renderizan solo cuando los productos están cargados
    const sectionsWithProducts = landingSections.filter(section => 
      section.type === "featuredProducts" || section.type === "featuredCategories"
    );

    const featuredCategoryItemsFromProducts = featuredProductsResolved
      .map((product: any) => {
        const catId = String(product?.categoria || "").trim();
        if (!catId) return null;

        return {
          id: catId,
          title: catId,
          image: product?.imagenes?.[0] || product?.imagen || null,
          link: `/products-by-category?cat=${encodeURIComponent(catId)}`,
        };
      })
      .filter(Boolean)
      .filter(
        (item: any, index: number, arr: any[]) =>
          arr.findIndex((x: any) => x.id === item.id) === index
      );

    const processedProductSections = sectionsWithProducts.map((section) => {
      if (section.type === "featuredProducts") {
        return {
          ...section,
          props: {
            ...(section.props || {}),
            products: featuredProductsResolved,
          },
        } as LandingSection;
      }

      if (section.type === "featuredCategories") {
        const existingItems = Array.isArray((section.props as any)?.items)
          ? (section.props as any).items
          : [];

        const finalItems =
          existingItems.length > 0
            ? existingItems
            : featuredCategoryItemsFromProducts;

        return {
          ...section,
          props: {
            ...(section.props || {}),
            items: finalItems,
          },
        } as LandingSection;
      }

      return section;
    });

    // Combinar: primero secciones sin productos, luego secciones con productos
    return [...sectionsWithoutProducts, ...processedProductSections];
  }, [landingSections, featuredProductsResolved]);


    // Detecta el índice del último hero
const lastHeroIndex = useMemo(() => {
  let last = -1;
  landingSections.forEach((s, i) => {
    if (s.type === "hero") last = i;
  });
  return last;
}, [landingSections]);

  return (
    <>
      <WhatsAppFloatingButton />
      <Suspense fallback={null}>
        <LazyProducts onProductsLoaded={setFeaturedProductsResolved} />
      </Suspense>
      <main className="min-h-screen w-full" style={{ background: "var(--bg)", color: "var(--text)" }}>
        {landingLoading ? (
        <div
            className="w-full relative overflow-hidden"
            style={{ aspectRatio: "2400 / 1000", minHeight: "300px", background: "var(--bgSecondary)" }}
        >
            <div className="absolute inset-0" style={{ background: "var(--bg)" }} />
            {/* Animación simplificada para iOS Safari - usando opacity en lugar de position */}
            <div
            className="absolute inset-0"
            style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(252, 211, 77, 0.1) 50%, transparent 100%)",
                animation: "shimmer 2.5s infinite",
                backgroundSize: "200% 100%",
                willChange: "opacity",
            }}
            />
            <style>{`
            @keyframes shimmer {
                0% { opacity: 0.3; background-position: -200% 0; }
                50% { opacity: 0.6; }
                100% { opacity: 0.3; background-position: 200% 0; }
            }
            `}</style>
        </div>
        ) : (
          <div className="flex flex-col">
            {/* Renderizar secciones sin productos inmediatamente */}
            {renderedSections
              .filter(section => section.type !== "featuredProducts" && section.type !== "featuredCategories")
              .map((section, index) => (
                <SectionRenderer
                  key={section.id}
                  section={section}
                  isLastHero={section.type === "hero" && index === lastHeroIndex}
                />
              ))}
            {/* Renderizar secciones con productos después de que carguen */}
            {renderedSections
              .filter(section => section.type === "featuredProducts" || section.type === "featuredCategories")
              .map((section, index) => (
                <SectionRenderer
                  key={section.id}
                  section={section}
                  isLastHero={false}
                />
              ))}
            <ContactSection />
          </div>
        )}
      </main>
      {!isLogged && <BottomBarPublic />}
    </>
  );
}
