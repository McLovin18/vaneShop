"use client";

import React from "react";
import type {
  LandingSectionStyles,
  LandingFieldStyle,
  FieldPosition,
} from "../../lib/landing-types";

export type TitleSubtitleSectionProps = {
  title?: string;       // ej. "Vanessa Salazar"
  subtitle?: string;    // ej. su historia / filosofía como artista
  image?: string;       // foto de la artista
  imageAlt?: string;
  buttonText?: string;  // ej. "Conoce mi proceso"
  buttonLink?: string;
  titleMobileFontSize?: string | number;
  subtitleMobileFontSize?: string | number;
  styles?: LandingSectionStyles;
  fieldStyles?: Record<string, LandingFieldStyle>;
  fieldPositions?: Record<string, { desktop?: FieldPosition; mobile?: FieldPosition }>;
};

export default function TitleSubtitleSection({
  title,
  subtitle,
  image,
  imageAlt = "",
  buttonText,
  buttonLink,
  titleMobileFontSize,
  subtitleMobileFontSize,
  styles,
  fieldStyles,
  fieldPositions,
}: TitleSubtitleSectionProps) {
  const bg = styles?.backgroundColor;
  const color = styles?.textColor;
  const paddingTop = styles?.paddingTop || "5rem";
  const paddingBottom = styles?.paddingBottom || "5rem";
  const borderRadius = styles?.borderRadius || "0";
  const accentColor = styles?.accentColor || color || "#111111";

  const [isDesktop, setIsDesktop] = React.useState(true);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkSize = () => {
      setIsDesktop(window.innerWidth >= 768);
      setIsMobile(window.innerWidth < 640);
    };
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  const getPositioningStyle = (fieldName: string): React.CSSProperties => {
    if (!fieldPositions?.[fieldName]) return {};
    const position = isDesktop
      ? fieldPositions[fieldName].desktop
      : fieldPositions[fieldName].mobile;
    if (!position) return {};
    return {
      position: "absolute",
      ...(position.left !== undefined && { left: `${position.left}px` }),
      ...(position.top !== undefined && { top: `${position.top}px` }),
      ...(position.width !== undefined && { width: `${position.width}px` }),
      ...(position.height !== undefined && { height: `${position.height}px` }),
      ...(position.zIndex !== undefined && { zIndex: position.zIndex }),
    };
  };

  const getFieldStyle = (fieldName: string, mobileVariant?: string): React.CSSProperties => {
    const baseStyle = fieldStyles?.[fieldName] || {};
    const mobileStyle = isMobile && mobileVariant ? fieldStyles?.[mobileVariant] || {} : {};
    const positioningStyle = getPositioningStyle(fieldName);

    // Aplicar tamaños de fuente móvil si están definidos
    if (isMobile) {
      if (fieldName === "title" && titleMobileFontSize) {
        baseStyle.fontSize = typeof titleMobileFontSize === "number" ? `${titleMobileFontSize}px` : titleMobileFontSize;
      }
      if (fieldName === "subtitle" && subtitleMobileFontSize) {
        baseStyle.fontSize = typeof subtitleMobileFontSize === "number" ? `${subtitleMobileFontSize}px` : subtitleMobileFontSize;
      }
    }

    return {
      ...baseStyle,
      ...mobileStyle,
      ...positioningStyle,
    };
  };

  return (
    <section
      style={{
        ...(bg ? { backgroundColor: bg } : {}),
        ...(color ? { color } : {}),
        paddingTop,
        paddingBottom,
      }}
      className="relative overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-4 md:px-8" style={{ borderRadius }}>
        <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1fr] gap-10 lg:gap-20 items-center">
          {/* Foto de la artista: 2do en mobile/md, 1ro en desktop */}
          {image && (
            <div className="order-2 lg:order-1 relative" style={getFieldStyle("image")}>
              {/* Trazo tipo pincelada, en vez de un marco geométrico genérico */}
              <svg
                viewBox="0 0 320 340"
                className="absolute -top-5 -left-5 w-[92%] h-[92%] -z-10"
                aria-hidden="true"
              >
                <path
                  d="M18 24 C 4 90, 4 250, 22 312 C 90 332, 240 332, 300 310 C 320 240, 318 90, 296 26 C 220 6, 90 6, 18 24 Z"
                  fill="none"
                  stroke={accentColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              <img
                src={image}
                alt={imageAlt}
                className="relative w-full aspect-[4/5] object-cover rounded-[2rem]"
              />
            </div>
          )}

          {/* Contenido: 1ro en mobile/md, 2do en desktop */}
          <div
            className="order-1 lg:order-2 flex flex-col gap-5 items-start text-left relative"
          >
            <span className="text-sm uppercase tracking-wide opacity-60">
              La artista detrás de cada pieza
            </span>

            {title && (
              <h2
                className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight"
                style={getFieldStyle("title", "titleMobile")}
              >
                {title}
              </h2>
            )}

            {subtitle && (
              <p
                className="text-base md:text-lg opacity-80 leading-relaxed max-w-lg"
                style={getFieldStyle("subtitle", "subtitleMobile")}
              >
                {subtitle}
              </p>
            )}

            {buttonText && (
              <a
                href={buttonLink || "#"}
                className="mt-2 inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-transform hover:scale-[1.03]"
                style={{
                  backgroundColor: accentColor,
                  color: styles?.backgroundColor || "#ffffff",
                  ...getFieldStyle("button"),
                }}
              >
                {buttonText}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}