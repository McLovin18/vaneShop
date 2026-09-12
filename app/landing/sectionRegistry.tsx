"use client";

import type { ComponentType } from "react";
import type {
  LandingSection,
  LandingSectionStyles,
  LandingFieldStyle,
} from "../lib/landing-types";

import HeroSection, { HeroSectionProps } from "./sections/HeroSection";
import BannerSection, { BannerSectionProps } from "./sections/BannerSection";
import GallerySection, { GallerySectionProps } from "./sections/GallerySection";
import FeaturedProductsSection, { FeaturedProductsSectionProps } from "./sections/FeaturedProductsSection";
import FeaturedCategoriesSection, { FeaturedCategoriesSectionProps } from "./sections/FeaturedCategoriesSection";
import Hero360Section, { Hero360SectionProps } from "./sections/Hero360Section";
import GoogleCommentsSection, { GoogleCommentsSectionProps } from "./sections/GoogleCommentsSection";
import VideoSection, { VideoSectionProps } from "./sections/VideoSection";
import QuickProductsSection, { QuickProductsSectionProps } from "./sections/QuickProductsSection";
import TitleSubtitleSection, { TitleSubtitleSectionProps } from "./sections/TitleSubtitleSection";
import ContactSection from "./sections/ContactSection";

// Definición de props para cada sección
export type SectionComponentProps = {
  props?: any;
  styles?: LandingSectionStyles;
  fieldStyles?: Record<string, LandingFieldStyle>;
};




// import HeroGoogleReviewSection, { HeroGoogleReviewSectionProps } from "./sections/HeroGoogleReviewSection";

export const sectionRegistry: Record<string, ComponentType<any>> = {
  hero: HeroSection,
  hero360: Hero360Section,
  video: VideoSection,
  quickProducts: QuickProductsSection,
  // heroGoogleReview: HeroGoogleReviewSection, // Eliminado de la landing
  googleComments: GoogleCommentsSection,
  banner: BannerSection,
  gallery: GallerySection,
  featuredProducts: FeaturedProductsSection,
  featuredCategories: FeaturedCategoriesSection,
  titleSubtitle: TitleSubtitleSection,
  contact: ContactSection,
};

// Eliminado fragmento duplicado

export function SectionRenderer({ 
  section,
  isLastHero = false,
}: { 
  section: LandingSection;
  isLastHero?: boolean;
}) {
  if (section.hidden) return null;

  const Component = sectionRegistry[section.type];
  if (!Component) {
    return (
      <section className="px-4 py-6 lg:px-6 m-0">
        <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-4 rounded-xl overflow-auto">
          Sección desconocida: {section.type}
        </pre>
      </section>
    );
  }

  const { props = {}, styles, fieldStyles, fieldPositions } = section;
  let parsedProps = { ...props };
  const deviceForStyles = (parsedProps as any)?.device === "mobile" ? "mobile" : "desktop";

  const resolvedFieldStyles = Object.fromEntries(
    Object.entries(fieldStyles || {}).map(([fieldName, styleValue]) => {
      const responsiveStyle = styleValue as any;
      const hasResponsiveShape =
        responsiveStyle &&
        (responsiveStyle.desktop !== undefined || responsiveStyle.mobile !== undefined);

      if (!hasResponsiveShape) {
        return [fieldName, styleValue || {}];
      }

      return [
        fieldName,
        responsiveStyle[deviceForStyles] || responsiveStyle.desktop || responsiveStyle.mobile || {},
      ];
    })
  );
  
  if (section.type === "googleComments" && typeof props.comments === "string") {
    try {
      parsedProps.comments = JSON.parse(props.comments);
    } catch {
      parsedProps.comments = [];
    }
  }

  return (
    <Component 
      {...parsedProps} 
      styles={styles} 
      fieldStyles={resolvedFieldStyles} 
      fieldPositions={fieldPositions}
      isLast={isLastHero} // ✅
    />
  );
}