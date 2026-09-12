"use client";

import { useEffect, useMemo, useState } from "react";

import BottomBarPublic from "./components/BottomBarPublic";
import WhatsAppFloatingButton from "./components/WhatsAppFloatingButton";
import { SectionRenderer } from "./landing/sectionRegistry";
import { getLandingPage } from "./lib/landing-db";
import { obtenerProductos } from "./lib/productos-db";
import type { LandingSection } from "./lib/landing-types";
import { useUser } from "./context/UserContext";
import ContactSection from "./landing/sections/ContactSection";

export default function Home() {
  const { isLogged } = useUser();
  const [landing, setLanding] = useState<{
    hero?: Record<string, any> | null;
    sections?: LandingSection[];
    featuredProducts?: string[];
  } | null>(null);
  const [featuredProductsResolved, setFeaturedProductsResolved] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadLanding = async () => {
      try {
        const [data, products] = await Promise.all([
          getLandingPage(),
          obtenerProductos(),
        ]);

        // Get all products, sort by newest first, take top 8
        const recentProducts = (products || [])
          .filter((p: any) => p?.id)
          .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 10);

        if (mounted) {
          setLanding(data);
          setFeaturedProductsResolved(recentProducts);
        }
      } catch (error) {
        console.error("Error cargando landing publicada:", error);
        if (mounted) {
          setLanding(null);
          setFeaturedProductsResolved([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
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

    return landingSections.map((section) => {
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
      <main className="min-h-screen w-full" style={{ background: "var(--bg)", color: "var(--text)" }}>
        {loading ? (
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
        ) : renderedSections.length > 0 ? (
          <div className="flex flex-col">
            {renderedSections.map((section, index) => (
            <SectionRenderer
                key={section.id}
                section={section}
                isLastHero={section.type === "hero" && index === lastHeroIndex}
            />
            ))}
            <ContactSection />
          </div>
        ) : (
          <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-slate-500">
            No hay secciones publicadas para mostrar.
          </div>
        )}
      </main>
      {!isLogged && <BottomBarPublic />}
    </>
  );
}
