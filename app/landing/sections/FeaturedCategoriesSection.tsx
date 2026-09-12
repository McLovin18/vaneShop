"use client";

import React from "react";
import type {
  LandingSectionStyles,
  LandingFieldStyle,
} from "../../lib/landing-types";

export type FeaturedCategoryItem = {
  title?: string;
  image?: string | null;
  link?: string;
};

export type FeaturedCategoriesSectionProps = {
  title?: string;
  items?: FeaturedCategoryItem[];
  styles?: LandingSectionStyles;
  fieldStyles?: Record<string, LandingFieldStyle>;
  device?: "desktop" | "mobile";
};

export default function FeaturedCategoriesSection({
  title,
  items,
  styles,
  fieldStyles,
}: FeaturedCategoriesSectionProps) {
  const bg = styles?.backgroundColor;
  const color = styles?.textColor;
  const paddingTop = styles?.paddingTop || (typeof window !== "undefined" && window.innerWidth < 768 ? "0.5rem" : "2rem");
  const paddingBottom = styles?.paddingBottom || (typeof window !== "undefined" && window.innerWidth < 768 ? "0.5rem" : "2rem");

  const categories = (items || []).filter(
    (c) => c && (c.title || c.image || c.link)
  );

  if (!categories.length && !title) return null;

  return (
    <section
      style={{
        ...(bg ? { backgroundColor: bg } : {}),
        ...(color ? { color } : {}),
        paddingTop,
        paddingBottom,
      }}
      className="px-4 lg:px-6 m-0"
    >
      <div className="max-w-6xl mx-auto text-[var(--text)] relative">
        {title && (
          <h2
            className="section-title py-2 text-center"
            style={fieldStyles?.title || { color: "var(--text)" }}
          >
            {title}
          </h2>
        )}

        <div className="grid grid-cols-2 gap-2 md:gap-4">
          {categories.map((cat, idx) => (
            <a
              key={idx}
              href={cat.link || "#"}
              className="group block w-full border border-[var(--border)] bg-[var(--card)] md:p-1 hover:border-[var(--primary)] hover:bg-[var(--muted)] transition-colors cursor-pointer"
            >
              {cat.image && (
                <div className="w-full h-64 sm:h-[26rem] md:h-[36rem] overflow-hidden bg-[var(--muted)] mb-3">
                  <img
                    src={cat.image}
                    alt={cat.title || "Categoría"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}
              {cat.title && (
                <h3
                  className="section-subtitle text-2xl page-lead text-center md:text-left"
                  style={fieldStyles?.itemTitle || { color: "var(--text, #584738)" }}
                >
                  {cat.title}
                </h3>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}