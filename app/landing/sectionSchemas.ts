
export const sectionSchemas: { [key: string]: { type: string; label: string; icon: string; fields: any[] } } = {
  hero: {
    type: "hero",
    label: "Hero",
    icon: "image",
    fields: [
      { name: "googleMaps", type: "boolean", label: "¿Hero de Google Maps?", group: "content" },
      { name: "title", type: "text", label: "Título", group: "content", stylable: true },
      { name: "titleMobileFontSize", type: "text", label: "Tamaño móvil (px) para Título", group: "styles", stylable: true },
      { name: "subtitle", type: "text", label: "Subtítulo", group: "content", stylable: true },
      { name: "subtitleMobileFontSize", type: "text", label: "Tamaño móvil (px) para Subtítulo", group: "styles", stylable: true },
      { name: "badge", type: "text", label: "Badge", group: "content", stylable: true },
      { name: "badgeMobileFontSize", type: "text", label: "Tamaño móvil (px) para Badge", group: "styles", stylable: true },
      { name: "buttonText", type: "text", label: "Texto del botón", group: "content", stylable: true },
      { name: "buttonTextMobileFontSize", type: "text", label: "Tamaño móvil (px) para Botón", group: "styles", stylable: true },
      { name: "buttonLink", type: "text", label: "Enlace del botón", group: "content" },

      // ── Imágenes ─────────────────────────────────────────────────────
      { name: "image", type: "image", label: "Imagen principal (1 imagen)", group: "content" },
      { name: "images", type: "images", label: "Galería de imágenes (2–4 fotos)", group: "content" }, // ✅ NUEVO

      { name: "videoUrl", type: "text", label: "Video principal (URL)", group: "content" },

      // ── Google Maps ───────────────────────────────────────────────────
      { name: "generalMessage", type: "textarea", label: "Mensaje general", group: "content", showIf: { googleMaps: true } },

      // ── Estilos generales ─────────────────────────────────────────────
      { name: "backgroundColor", type: "color", label: "Color de fondo", group: "styles" },
      { name: "textColor", type: "color", label: "Color de texto", group: "styles" },
      { name: "paddingTop", type: "text", label: "Padding superior", group: "styles" },
      { name: "paddingBottom", type: "text", label: "Padding inferior", group: "styles" },
      { name: "textAlign", type: "text", label: "Alineación texto (left/center/right)", group: "styles" },
      { name: "borderRadius", type: "text", label: "Border radius contenedor", group: "styles" },

      // ── Estilos del botón ─────────────────────────────────────────────
      { name: "buttonBackgroundColor", type: "color", label: "Color de fondo del botón", group: "styles" },       // ✅ NUEVO
      { name: "buttonTextColor", type: "color", label: "Color de texto del botón", group: "styles" },             // ✅ NUEVO
      { name: "buttonBorderColor", type: "color", label: "Color de borde del botón", group: "styles" },           // ✅ NUEVO
      { name: "buttonBorderWidth", type: "text", label: "Grosor de borde del botón (ej: 2px)", group: "styles" }, // ✅ NUEVO
      { name: "buttonBorderRadius", type: "text", label: "Border radius del botón (ej: 1rem)", group: "styles" }, // ✅ NUEVO
    ],
  },
  googleComments: {
    type: "googleComments",
    label: "Comentarios Google Maps",
    icon: "comment",
    fields: [
      { name: "title", type: "text", label: "Título de sección", group: "content", stylable: true },
      { name: "comments", type: "textarea", label: "Comentarios seleccionados (JSON)", group: "content" },
      { name: "backgroundColor", type: "color", label: "Color de fondo", group: "styles" },
      { name: "textColor", type: "color", label: "Color de texto", group: "styles" },
      { name: "paddingTop", type: "text", label: "Padding superior", group: "styles" },
      { name: "paddingBottom", type: "text", label: "Padding inferior", group: "styles" },
      { name: "borderRadius", type: "text", label: "Border radius contenedor", group: "styles" },
    ],
  },
  heroGoogleReview: {
    type: "heroGoogleReview",
    label: "Hero Google Review",
    icon: "star",
    fields: [
      { name: "title", type: "text", label: "Título", group: "content", stylable: true },
      { name: "titleMobileFontSize", type: "text", label: "Tamaño móvil (px) para Título", group: "styles", stylable: true },
      { name: "subtitle", type: "text", label: "Subtítulo", group: "content", stylable: true },
      { name: "badge", type: "text", label: "Badge", group: "content", stylable: true },
      { name: "buttonText", type: "text", label: "Texto del botón", group: "content", stylable: true },
      { name: "buttonLink", type: "text", label: "Enlace del botón", group: "content" },
      { name: "image", type: "image", label: "Imagen principal", group: "content" },
      { name: "rating", type: "number", label: "Calificación general (Google Maps)", group: "content" },
      { name: "ratingCount", type: "number", label: "Cantidad de reseñas", group: "content" },
      { name: "generalMessage", type: "textarea", label: "Mensaje general", group: "content" },
      { name: "backgroundColor", type: "color", label: "Color de fondo", group: "styles" },
      { name: "textColor", type: "color", label: "Color de texto", group: "styles" },
      { name: "paddingTop", type: "text", label: "Padding superior", group: "styles" },
      { name: "paddingBottom", type: "text", label: "Padding inferior", group: "styles" },
      { name: "textAlign", type: "text", label: "Alineación texto (left/center/right)", group: "styles" },
      { name: "borderRadius", type: "text", label: "Border radius contenedor", group: "styles" },
    ],
  },
  banner: {
    type: "banner",
    label: "Banner",
    icon: "format_color_fill",
    fields: [
      { name: "title", type: "text", label: "Título", group: "content", stylable: true },
      { name: "subtitle", type: "text", label: "Subtítulo 1", group: "content", stylable: true },
      { name: "subtitleMobileFontSize", type: "text", label: "Tamaño móvil (px) para Subtítulo 1", group: "styles", stylable: true },
      { name: "subtitle2", type: "text", label: "Subtítulo 2 (opcional)", group: "content", stylable: true },
      { name: "subtitle2MobileFontSize", type: "text", label: "Tamaño móvil (px) para Subtítulo 2", group: "styles", stylable: true },
      { name: "subtitle3", type: "text", label: "Subtítulo 3 (opcional)", group: "content", stylable: true },
      { name: "subtitle3MobileFontSize", type: "text", label: "Tamaño móvil (px) para Subtítulo 3", group: "styles", stylable: true },
      { name: "backgroundImage", type: "image", label: "Imagen de fondo", group: "content" },
      { name: "backgroundColor", type: "color", label: "Color de fondo", group: "styles" },
      { name: "textColor", type: "color", label: "Color de texto", group: "styles" },
      { name: "paddingTop", type: "text", label: "Padding superior", group: "styles" },
      { name: "paddingBottom", type: "text", label: "Padding inferior", group: "styles" },
      { name: "borderRadius", type: "text", label: "Border radius contenedor", group: "styles" },
    ],
  },
  gallery: {
    type: "gallery",
    label: "Galería",
    icon: "collections",
    fields: [
      { name: "title", type: "text", label: "Título", group: "content" },
      { name: "paddingTop", type: "text", label: "Padding superior", group: "styles" },
      { name: "paddingBottom", type: "text", label: "Padding inferior", group: "styles" },
    ],
  },
  featuredProducts: {
    type: "featuredProducts",
    label: "Productos recientes",
    icon: "shopping_bag",
    fields: [
      { name: "title", type: "text", label: "Título", group: "content", stylable: true },
    ],
  },
  featuredCategories: {
    type: "featuredCategories",
    label: "Categorías destacadas",
    icon: "category",
    fields: [
      { name: "title", type: "text", label: "Título", group: "content", stylable: true },
      // Las categorías individuales se gestionan desde el editor específico de la sección
    ],
  },
  titleSubtitle: {
    type: "titleSubtitle",
    label: "Sobre la artista",
    icon: "person",
    fields: [
      { name: "title", type: "text", label: "Nombre de la artista", group: "content", stylable: true },
      { name: "titleMobileFontSize", type: "text", label: "Tamaño móvil (px) para Título", group: "styles", stylable: true },
      { name: "subtitle", type: "textarea", label: "Historia / Biografía", group: "content", stylable: true },
      { name: "subtitleMobileFontSize", type: "text", label: "Tamaño móvil (px) para Subtítulo", group: "styles", stylable: true },
      { name: "image", type: "image", label: "Foto de la artista", group: "content" },
      { name: "imageAlt", type: "text", label: "Texto alternativo de la imagen", group: "content" },
      { name: "buttonText", type: "text", label: "Texto del botón", group: "content", stylable: true },
      { name: "buttonLink", type: "text", label: "Enlace del botón", group: "content" },
      { name: "backgroundColor", type: "color", label: "Color de fondo", group: "styles" },
      { name: "textColor", type: "color", label: "Color de texto", group: "styles" },
      { name: "accentColor", type: "color", label: "Color de acento (trazo de imagen)", group: "styles" },
      { name: "paddingTop", type: "text", label: "Padding superior", group: "styles" },
      { name: "paddingBottom", type: "text", label: "Padding inferior", group: "styles" },
      { name: "borderRadius", type: "text", label: "Border radius contenedor", group: "styles" },
    ],
  },
  hero360: {
    type: "hero360",
    label: "Hero 360 (PC Builder)",
    icon: "360",
    fields: [
      { name: "heading", type: "text", label: "Título principal", group: "content", stylable: true },
      { name: "subheading", type: "text", label: "Subtítulo (resaltado)", group: "content", stylable: true },
      { name: "description", type: "textarea", label: "Descripción", group: "content" },
      { name: "primaryButtonText", type: "text", label: "Texto botón primario", group: "content" },
      { name: "primaryButtonLink", type: "text", label: "Enlace botón primario", group: "content" },
      { name: "secondaryButtonText", type: "text", label: "Texto botón secundario", group: "content" },
      { name: "secondaryButtonLink", type: "text", label: "Enlace botón secundario", group: "content" },
      { name: "images", type: "textarea", label: "URLs de imágenes (una por línea)", group: "content" },
      { name: "autoPlay", type: "boolean", label: "Auto-play activado", group: "content" },
      { name: "interval", type: "number", label: "Intervalo auto-play (ms)", group: "content" },
    ],
  },
};
