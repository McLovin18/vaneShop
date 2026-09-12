export type LandingSectionStyles = {
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  paddingTop?: string;
  paddingBottom?: string;
  textAlign?: "left" | "center" | "right";
  containerWidth?: "full" | "container" | "narrow";
  borderRadius?: string;
};

// Hero especial para Google Maps
export type HeroGoogleReview = {
  title?: string;
  subtitle?: string;
  badge?: string;
  buttonText?: string;
  buttonLink?: string;
  image?: string | null;
  styles?: LandingSectionStyles;
  fieldStyles?: Record<string, LandingFieldStyle>;
  rating?: number; // Calificación general de Google Maps
  ratingCount?: number; // Número de reseñas
  generalMessage?: string; // Mensaje general
};

export type FieldPosition = {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  zIndex?: number;
};

export type LandingFieldStyle = {
  color?: string;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline";
  fontSize?: string;
  backgroundColor?: string;
  borderRadius?: string;
  paddingInline?: string;
  paddingBlock?: string;
};

export type LandingSection = {
  id: string;
  type: string; // p.ej. "hero", "banner", "gallery", etc.
  props: Record<string, any>;
  styles?: LandingSectionStyles;
  fieldStyles?: Record<string, LandingFieldStyle>;
  fieldPositions?: Record<string, { desktop?: FieldPosition; mobile?: FieldPosition }>;
  order: number;
  hidden?: boolean;
};

export type SectionFieldType =
  | "text"
  | "textarea"
  | "image"
  | "color"
  | "select"
  | "number"
  | "boolean";

export type SectionFieldSchema = {
  name: string;
  type: SectionFieldType;
  label: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
  group?: "content" | "styles" | "advanced";
  stylable?: boolean;
};

export type SectionSchema = {
  type: string;
  label: string;
  icon?: string;
  fields: SectionFieldSchema[];
};
