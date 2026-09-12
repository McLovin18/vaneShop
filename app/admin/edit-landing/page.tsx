"use client";
import { Loading3DIcon } from "@/app/components/Loading3DIcon";
import { useEffect, useState, ChangeEvent, useRef, useCallback, useMemo } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";

import {
  getLandingDraft,
  updateHero,
  updateSection,
  deleteSection,
  saveLandingSections,
  uploadLandingImage,
  uploadLandingVideo,
  publishLanding,
} from "../../lib/landing-db";
import { LandingSection } from "../../lib/landing-types";
import { sectionSchemas } from "../../landing/sectionSchemas";
import { SectionRenderer } from "../../landing/sectionRegistry";

import { obtenerProductos } from "../../lib/productos-db";
import ProductoCard from "../../components/ProductoCard";
import DraggablePreviewEditor from "../components/DraggablePreviewEditor";

/* ============================
   TIPOS
============================ */

// Usamos el nuevo modelo JSON-driven para las secciones
type SectionType = string;
type Section = LandingSection;

/* ============================
   CONSTANTES
============================ */

const AVAILABLE_SECTION_TYPES = [
  "hero",
  "featuredCategories",
  "featuredProducts",
  "gallery",
  "titleSubtitle",
] as const;


function getDefaultSection(type: SectionType): Section {

  
    // De momento derivamos las opciones del schema registry

  const SECTION_TYPES = Object.values(sectionSchemas).map((schema: any) => ({
    type: schema.type as SectionType,
    icon: schema.icon || "view_compact",
    label: schema.label,
  }));
  const id = `section-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const schema = (sectionSchemas as any)[type] ?? (sectionSchemas as any).hero;

  const defaultProps: Record<string, any> = {};
  schema.fields.forEach((field: any) => {
    if (field.type === "text" || field.type === "textarea") {
      defaultProps[field.name] = "";
    }
    if (field.type === "boolean") {
      defaultProps[field.name] = false;
    }
  });

  return {
    id,
    type,
    props: defaultProps,
    styles: {},
    order: 0,
  };
}

/* ============================
   COMPONENTE PRINCIPAL
============================ */

export default function LandingEditor() {
    // Estado para error de comentarios de Google Maps
    const [googleCommentsError, setGoogleCommentsError] = useState("");
    // Estado para detectar cambios pendientes (activar bot+�n guardar)
    const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [productos, setProductos] = useState<any[]>([]);
  const [hero, setHero] = useState<any>(null);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addAfterIndex, setAddAfterIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [allProductos, setAllProductos] = useState<any[]>([]);
  const [activeTabs, setActiveTabs] = useState<
    Record<string, "content" | "styles" | "advanced" | "positioning">
  >({});
  const [activeFieldStyles, setActiveFieldStyles] = useState<
    Record<string, string | null>
  >({});
  const [activeHeroItemFieldStyles, setActiveHeroItemFieldStyles] = useState<
    Record<string, { index: number; fieldName: string } | null>
  >({});
  
  // Para drag & drop de items dentro de secciones
  const [draggedItemState, setDraggedItemState] = useState<{
    sectionId: string;
    itemType: "gallery" | "featured-category" | "hero";
    fromIndex: number;
  } | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop"
  );
  const [activeHeroIndex, setActiveHeroIndex] = useState<Record<string, number>>({});
  const [editingPositionsSection, setEditingPositionsSection] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState<boolean>(false);

  // ============================
  // GOOGLE MAPS REVIEWS (Hero y comentarios seleccionados)
  // ============================
  const [googleReviewSummary, setGoogleReviewSummary] = useState<any>(null);
  const [googleComments, setGoogleComments] = useState<any[]>([]);
  const [selectedGoogleComments, setSelectedGoogleComments] = useState<any[]>([]);
  const [showGoogleCommentsModal, setShowGoogleCommentsModal] = useState(false);
  const [googleCommentsLoading, setGoogleCommentsLoading] = useState(false);

  // Cargar resumen y comentarios de Google Maps
  useEffect(() => {
    async function fetchGoogleReviews() {
      try {
        const placeId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_PLACE_ID || "";
        const res = await fetch(`/api/google-maps?place_id=${placeId}`);
        const data = await res.json();
        setGoogleReviewSummary(data);
      } catch (err) {
        setGoogleReviewSummary(null);
      }
    }
    fetchGoogleReviews();
    // Fetch Google Maps comments for modal
    async function fetchGoogleComments() {
      setGoogleCommentsLoading(true);
      try {
        const placeId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_PLACE_ID || "";
        const res = await fetch(`/api/google-scrape-reviews?place_id=${placeId}`);
        const data = await res.json();
        console.log("[Admin] fetchGoogleComments data:", data);
        setGoogleComments(data.reviews || []);
        if (data.error) {
          setGoogleCommentsError(data.error);
        } else {
          setGoogleCommentsError("");
        }
      } catch (err) {
        setGoogleComments([]);
        setGoogleCommentsError("No se pudieron cargar los comentarios de Google Maps.");
      }
      setGoogleCommentsLoading(false);
    }
    fetchGoogleComments();
  }, []);

  // Guardar comentarios seleccionados
  const saveSelectedGoogleComments = async () => {
    setSaving(true);
    // Log selecci+�n antes de guardar
    console.log("[Admin] selectedGoogleComments:", selectedGoogleComments);
    // Mapear los comentarios al formato esperado por GoogleCommentsSection
    const mappedComments = selectedGoogleComments.map((c: any) => ({
      author_name: c.author || c.author_name || "",
      rating: typeof c.rating === "string" ? parseFloat(c.rating) : c.rating || 0,
      text: c.text || "",
      time: c.date || c.time || "",
      profile_photo_url: c.photo || c.profile_photo_url || "",
    }));
    // Save as JSON string in googleComments section
    const section = sections.find(s => s.type === "googleComments");
    if (section) {
      const updatedSections = sections.map(s =>
        s.id === section.id
          ? {
              ...s,
              props: {
                ...s.props,
                comments: JSON.stringify(mappedComments),
              },
            }
          : s
      );
      await saveLandingSections(updatedSections);
      setSections(updatedSections);
      // Also update selectedGoogleComments from saved section
      try {
        const parsed = JSON.parse(updatedSections.find(s => s.type === "googleComments")?.props?.comments || "[]");
        setSelectedGoogleComments(parsed);
      } catch {
        setSelectedGoogleComments([]);
      }
      console.log("[Admin] updatedSections googleComments:", updatedSections.find(s => s.type === "googleComments"));
    }
    setSaving(false);
    setShowGoogleCommentsModal(false);
    alert("Comentarios de Google guardados");
    console.log("[Admin] mappedComments:", mappedComments);
    // ...existing code...
    setSaving(false);
    setShowGoogleCommentsModal(false);
    alert("Comentarios de Google guardados");
  };

  // Abrir/cerrar modal de selecci+�n
  const openGoogleCommentsModal = () => setShowGoogleCommentsModal(true);
  const closeGoogleCommentsModal = () => setShowGoogleCommentsModal(false);

  // Seleccionar/deseleccionar comentarios
  const toggleGoogleComment = (comment: any) => {
    // Log antes y despu+�s de seleccionar/deseleccionar
    console.log("[Admin] toggleGoogleComment BEFORE:", selectedGoogleComments);
    // Usar el texto como clave +�nica
    if (selectedGoogleComments.some((c) => c.text === comment.text)) {
      setSelectedGoogleComments(selectedGoogleComments.filter((c) => c.text !== comment.text));
      console.log("[Admin] toggleGoogleComment REMOVED:", comment);
    } else {
      if (selectedGoogleComments.length < 8) {
        setSelectedGoogleComments([...selectedGoogleComments, comment]);
        console.log("[Admin] toggleGoogleComment ADDED:", comment);
      } else {
        alert("Solo puedes seleccionar hasta 8 comentarios.");
      }
    }
    setTimeout(() => {
      console.log("[Admin] toggleGoogleComment AFTER:", selectedGoogleComments);
    }, 100);
  };
  // Abrir modal y cargar comentarios
  // (removed duplicate definition)
  // Cargar comentarios seleccionados desde secci+�n al abrir modal
  useEffect(() => {
    if (showGoogleCommentsModal) {
      const section = sections.find(s => s.type === "googleComments");
      if (section && section.props && section.props.comments) {
        try {
          const parsed = JSON.parse(section.props.comments);
          // Unify photo property for modal display
          setSelectedGoogleComments(parsed.map((c: any) => ({
            ...c,
            photo: c.profile_photo_url || c.photo || "",
          })));
        } catch {
          setSelectedGoogleComments([]);
        }
      }
      // Log los comentarios cargados para seleccionar
      console.log("[Admin] googleComments for modal:", googleComments);
    }
  }, [showGoogleCommentsModal, sections]);

  /* ============================
     CARGA INICIAL
  ============================ */

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [landingData, prods] = await Promise.all([
          getLandingDraft(),
          obtenerProductos(),
        ]);

        setHero(landingData?.hero ?? null);

        // Guardamos todos los productos disponibles (inventario)
        setProductos(prods ?? []);
        setAllProductos(prods ?? []);

        // Obtener productos recientes: todos los productos, ordenados por createdAt (más nuevo primero), top 8
        const allProds = prods ?? [];
        const recentProducts = allProds
          .filter((p: any) => p?.id)
          .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
          .slice(0, 10);

        setFeaturedProducts(recentProducts);

        // Migramos secciones antiguas (no JSON) al nuevo formato en memoria
        const rawSections: any[] = landingData?.sections ?? [];
        const migrated: Section[] = rawSections.map((s: any, index: number) => {
          if (s && s.props) return s as Section;

          const inferredType: SectionType = (s && s.type) || "banner";
          return {
            id: s.id || `section-${index}`,
            type: inferredType,
            props: {
              title: s.title,
              subtitle: s.subtitle,
              content: s.content,
              image: s.image || s.imageUrl || null,
            },
            styles: {},
            order: s.order ?? index + 1,
          };
        });

        const normalizedSections: Section[] = migrated.map((section) => {
          if (section.type !== "hero") return section;

          const rawItems = Array.isArray(section.props?.items) ? section.props.items : [];
          const firstItem = rawItems[0] || {};
          const collectedImages = Array.from(
            new Set(
              rawItems
                .flatMap((item: any) => Array.isArray(item?.images) ? item.images : [])
                .concat(rawItems.map((item: any) => item?.image || null))
                .filter(Boolean)
            )
          );

          return {
            ...section,
            props: {
              ...(section.props || {}),
              items: [
                {
                  ...firstItem,
                  images: firstItem.images?.length ? firstItem.images : collectedImages,
                },
              ],
            },
          };
        });
        setSections(normalizedSections);
      } catch (error) {
        console.error("Error cargando landing del editor:", error);
        setHero(null);
        setProductos([]);
        setAllProductos([]);
        setFeaturedProducts([]);
        setSections([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  /* ============================
     HERO
  ============================ */

  const handleHeroChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (!hero) return;
    setHero({ ...hero, [e.target.name]: e.target.value });
  };

  const handleHeroImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadLandingImage(file, "hero");
    setHero({ ...hero, image: url });
  };

  const saveHero = async () => {
    if (!hero) return;
    setSaving(true);
    await updateHero(hero);
    setSaving(false);
    alert("Hero actualizado");
  };




  const handleSectionPropChange = async (
    idx: number,
    field: string,
    value: any
  ) => {
    const updated = [...sections];
    const current = updated[idx];
    const baseProps = {
      ...(current.props || {}),
      [field]: value,
    };
    // If this is a hero section with items, update the active hero item instead
    if (current.type === "hero" && Array.isArray(current.props?.items)) {
      const items = ((current.props?.items as any[]) || []) as any[];
      const sectionId = current.id;
      const activeIdx = (activeHeroIndex[sectionId] ?? 0) as number;
      const newItems = [...items];
      const target = { ...(newItems[activeIdx] || {}) };
      target[field] = value;
      newItems[activeIdx] = target;
      baseProps.items = newItems;
    }

    updated[idx] = {
      ...current,
      props: baseProps,
    };
    setSections(updated);
    setSaving(true);
    await saveLandingSections(updated);
    setSaving(false);
  };

  const toggleSectionHidden = async (id: string) => {
    const updated = sections.map((s) =>
      s.id === id ? { ...s, hidden: !s.hidden } : s
    );
    setSections(updated);
    setSaving(true);
    await saveLandingSections(updated);
    setSaving(false);
  };

  const duplicateSection = async (idx: number) => {
    const original = sections[idx];
    if (!original) return;
    const clone: Section = {
      ...original,
      id: `section-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    const updated = [...sections];
    updated.splice(idx + 1, 0, clone);
    updated.forEach((s, i) => (s.order = i + 1));
    setSections(updated);
    setSaving(true);
    await saveLandingSections(updated);
    setSaving(false);
  };

  const handleSectionStyleChange = async (
    idx: number,
    field: string,
    value: any
  ) => {
    const updated = [...sections];
    const current = updated[idx];
    updated[idx] = {
      ...current,
      styles: {
        ...(current.styles || {}),
        [field]: value,
      },
    };
    setSections(updated);
    setSaving(true);
    await saveLandingSections(updated);
    setSaving(false);
  };
  const handleFieldStyleChange = async (
    idx: number,
    fieldName: string,
    styleKey: keyof import("../../lib/landing-types").LandingFieldStyle,
    value: any
  ) => {
    // If this section is a hero with items and there's an active item,
    // delegate to the hero-item specific handler so styles are saved per-variant.
    const sec = sections[idx];
    const items = (sec?.props?.items as any[]) || [];
    const activeIdx = sec ? (activeHeroIndex[sec.id] as number | undefined) : undefined;
    if (sec && sec.type === "hero" && items.length > 0 && typeof activeIdx === "number") {
      await handleHeroItemFieldStyleChange(idx, activeIdx, fieldName, styleKey, value as any);
      return;
    }

    const updated = [...sections];
    const current = updated[idx];
    const currentFieldStyles = current.fieldStyles || {};
    let currentStyle = currentFieldStyles[fieldName] || {};

    // Normalize legacy shape -> { desktop: legacy }
    if (currentStyle && ((currentStyle as any).desktop === undefined && (currentStyle as any).mobile === undefined)) {
      currentStyle = { desktop: { ...(currentStyle as any) } } as any;
    }

    const deviceKey = previewDevice || "desktop";

    const newFieldStyleForDevice = {
      ...((currentStyle as any)?.[deviceKey] || {}),
      [styleKey]: value,
    };

    updated[idx] = {
      ...current,
      fieldStyles: {
        ...currentFieldStyles,
        [fieldName]: {
          ...((currentStyle as any) || {}),
          [deviceKey]: newFieldStyleForDevice,
        },
      },
    };
    setSections(updated);
    setSaving(true);
    await saveLandingSections(updated);
    setSaving(false);
  };

  const updateHeroItems = async (
    sectionIndex: number,
    updater: (
      items: {
        title?: string;
        subtitle?: string;
        badge?: string;
        buttonText?: string;
        buttonLink?: string;
        image?: string | null;
        images?: string[];
        videoUrl?: string | null;
        fieldStyles?: Record<
          string,
          import("../../lib/landing-types").LandingFieldStyle
        >;
      }[]
    ) => {
      title?: string;
      subtitle?: string;
      badge?: string;
      buttonText?: string;
      buttonLink?: string;
      image?: string | null;
      images?: string[];
      videoUrl?: string | null;
      fieldStyles?: Record<
        string,
        import("../../lib/landing-types").LandingFieldStyle
      >;
    }[]
  ) => {
    const updated = [...sections];
    const current = updated[sectionIndex];
    if (!current) return;

    const currentItems = ((current.props?.items as any[]) || []) as {
      title?: string;
      subtitle?: string;
      badge?: string;
      buttonText?: string;
      buttonLink?: string;
      image?: string | null;
      images?: string[];
      videoUrl?: string | null;
      fieldStyles?: Record<
        string,
        import("../../lib/landing-types").LandingFieldStyle
      >;
    }[];

    const newItems = updater(currentItems);

    updated[sectionIndex] = {
      ...current,
      props: {
        ...(current.props || {}),
        items: newItems,
      },
    };

    setSections(updated);
    setSaving(true);
    await saveLandingSections(updated);
    setSaving(false);
    return newItems;
  };

  const handleAddHeroItem = async (sectionIndex: number) => {
    const sec = sections[sectionIndex];
    const baseProps = sec?.props || {};
    const newItemTemplate = {
      title: baseProps.title || "",
      subtitle: baseProps.subtitle || "",
      badge: baseProps.badge || "",
      buttonText: baseProps.buttonText || "",
      buttonLink: baseProps.buttonLink || "",
      image: baseProps.image || null,
      fieldStyles: {},
      fieldPositions: {},
    };

    const newItems = await updateHeroItems(sectionIndex, (items) => [
      ...items,
      newItemTemplate,
    ]);
    // Select the newly created hero as active (last index)
    if (sec) {
      const id = sec.id;
      const newLen = (newItems || []).length || 0;
      setActiveHeroIndex((prev) => ({ ...prev, [id]: Math.max(0, newLen - 1) }));
    }
  };

  const handleHeroItemFieldChange = async (
    sectionIndex: number,
    itemIndex: number,
    field: "title" | "subtitle" | "badge" | "buttonText" | "buttonLink",
    value: string
  ) => {
    await updateHeroItems(sectionIndex, (items) => {
      const copy = [...items];
      const current = copy[itemIndex] || {};
      copy[itemIndex] = { ...current, [field]: value };
      return copy;
    });
  };

  const handleHeroItemFieldStyleChange = async (
    sectionIndex: number,
    itemIndex: number,
    fieldName: string,
    styleKey: keyof import("../../lib/landing-types").LandingFieldStyle,
    value: any
  ) => {
    await updateHeroItems(sectionIndex, (items) => {
      const copy = [...items];
      const current = copy[itemIndex] || {};
      const currentFieldStyles = (current as any).fieldStyles || {};
      let currentStyle = currentFieldStyles[fieldName] || {};
      if (currentStyle && (((currentStyle as any).desktop === undefined) && ((currentStyle as any).mobile === undefined))) {
        currentStyle = { desktop: { ...(currentStyle as any) } } as any;
      }
      const deviceKey = previewDevice || "desktop";
      const newFieldStyleForDevice = {
        ...(((currentStyle as any)?.[deviceKey]) || {}),
        [styleKey]: value,
      };

      copy[itemIndex] = {
        ...current,
        fieldStyles: {
          ...currentFieldStyles,
          [fieldName]: {
            ...((currentStyle as any) || {}),
            [deviceKey]: newFieldStyleForDevice,
          },
        },
      } as any;

      return copy;
    });
  };

  const handleHeroItemImage = async (
    e: ChangeEvent<HTMLInputElement>,
    sectionIndex: number,
    itemIndex: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const url = isVideo
      ? await uploadLandingVideo(file, `hero-${sectionIndex}-${itemIndex}`)
      : await uploadLandingImage(file, `hero-${sectionIndex}-${itemIndex}`);

    await updateHeroItems(sectionIndex, (items) => {
      const copy = [...items];
      const current = copy[itemIndex] || {};
      const currentImages = Array.isArray((current as any).images)
        ? (current as any).images.filter(Boolean)
        : current.image
          ? [current.image]
          : [];

      if (isVideo) {
        if (currentImages.length > 0) {
          alert("Si hay más de un recurso, solo se admiten imágenes.");
          return items;
        }

        copy[itemIndex] = {
          ...current,
          image: null,
          images: [],
          videoUrl: url,
        };
        return copy;
      }

      const nextImages = Array.from(new Set([...currentImages, url].filter(Boolean)));
      copy[itemIndex] = {
        ...current,
        image: nextImages[0] || null,
        images: nextImages,
        videoUrl: null,
      };
      return copy;
    });
  };

  const handleHeroItemRemoveImage = async (
    sectionIndex: number,
    itemIndex: number,
    imageUrl: string
  ) => {
    await updateHeroItems(sectionIndex, (items) => {
      const copy = [...items];
      const current = copy[itemIndex] || {};
      const currentImages = Array.isArray((current as any).images)
        ? (current as any).images.filter(Boolean)
        : current.image
          ? [current.image]
          : [];
      const nextImages = currentImages.filter((existingUrl: string) => existingUrl !== imageUrl);
      copy[itemIndex] = {
        ...current,
        image: nextImages[0] || null,
        images: nextImages,
      };
      return copy;
    });
  };

  const handleHeroItemClearMedia = async (sectionIndex: number, itemIndex: number) => {
    await updateHeroItems(sectionIndex, (items) => {
      const copy = [...items];
      const current = copy[itemIndex] || {};
      copy[itemIndex] = {
        ...current,
        image: null,
        images: [],
        videoUrl: null,
      };
      return copy;
    });
  };

  const handleRemoveHeroItem = async (
    sectionIndex: number,
    itemIndex: number
  ) => {
    const oldLen = ((sections[sectionIndex]?.props?.items as any[]) || []).length || 0;
    await updateHeroItems(sectionIndex, (items) =>
      items.filter((_, idx) => idx !== itemIndex)
    );
    // Adjust active selection for this section
    const sec = sections[sectionIndex];
    if (sec) {
      const id = sec.id;
      const prevIdx = activeHeroIndex[id] ?? 0;
      const newLen = Math.max(0, oldLen - 1);
      const newIdx = Math.max(0, Math.min(prevIdx, newLen - 1 >= 0 ? newLen - 1 : 0));
      setActiveHeroIndex((p) => ({ ...p, [id]: newIdx }));
    }
  };

  // ������������������������ Manejador para actualizar fieldPositions ������������������������������������������������������������������������������
  const handleFieldPositionChange = async (
    sectionIndex: number,
    fieldPositions: Record<string, { desktop?: any; mobile?: any }>
  ) => {
    const updated = [...sections];
    const current = updated[sectionIndex];
    if (!current) return;

    updated[sectionIndex] = {
      ...current,
      fieldPositions,
    };

    setSections(updated);
    setSaving(true);
    await saveLandingSections(updated);
    setSaving(false);
  };

  // ������������������������ Crear callback memoizado para onPositionChange del editor ���������������������������
  const [autosaveTimer, setAutosaveTimer] = useState<NodeJS.Timeout | null>(null);

  const createPositionChangeHandler = useCallback(
    (sectionIndex: number, itemIndex?: number) => (field: string, position: any) => {
      const updated = [...sections];
      const current = updated[sectionIndex];
      if (!current) return;

      // If this is a hero item position (itemIndex provided), store under props.items[itemIndex].fieldPositions
      if (current.type === "hero" && typeof itemIndex === "number") {
        const items = ((current.props?.items as any[]) || []) as any[];
        const newItems = [...items];
        const targetItem = { ...(newItems[itemIndex] || {}) };
        const currentFieldPositions = (targetItem.fieldPositions || {}) as Record<string, any>;
        const newFieldPositionsForItem = {
          ...currentFieldPositions,
          [field]: {
            ...((currentFieldPositions[field] as any) || {}),
            [previewDevice]: position,
          },
        };
        targetItem.fieldPositions = newFieldPositionsForItem;
        newItems[itemIndex] = targetItem;

        updated[sectionIndex] = {
          ...current,
          props: {
            ...(current.props || {}),
            items: newItems,
          },
        };
      } else {
        const newFieldPositions = { ...(current.fieldPositions || {}) };
        newFieldPositions[field] = {
          ...newFieldPositions[field],
          [previewDevice]: position,
        };
        updated[sectionIndex] = {
          ...current,
          fieldPositions: newFieldPositions,
        };
      }

      setSections(updated);

      // Autosave con debounce de 1s
      if (autosaveTimer) clearTimeout(autosaveTimer);
      const newTimer = setTimeout(async () => {
        setSaving(true);
        await saveLandingSections(updated);
        setSaving(false);
      }, 1000);
      setAutosaveTimer(newTimer);
    },
    [sections, previewDevice, autosaveTimer]
  );

  // Cleanup del timer al desmontar
  useEffect(() => {
    return () => {
      if (autosaveTimer) clearTimeout(autosaveTimer);
    };
  }, [autosaveTimer]);

  const updateGalleryItems = async (
    sectionIndex: number,
    updater: (items: { title?: string; image?: string }[]) => {
      title?: string;
      image?: string;
    }[]
  ) => {
    const updated = [...sections];
    const current = updated[sectionIndex];
    if (!current) return;

    const currentItems = ((current.props?.items as any[]) || []) as {
      title?: string;
      image?: string;
    }[];

    const newItems = updater(currentItems);

    updated[sectionIndex] = {
      ...current,
      props: {
        ...(current.props || {}),
        items: newItems,
      },
    };

    setSections(updated);
    setSaving(true);
    await saveLandingSections(updated);
    setSaving(false);
  };

  const handleAddGalleryItem = async (sectionIndex: number) => {
    await updateGalleryItems(sectionIndex, (items) => [
      ...items,
      { title: "", image: "" },
    ]);
  };

  const handleGalleryItemTitleChange = async (
    sectionIndex: number,
    itemIndex: number,
    title: string
  ) => {
    await updateGalleryItems(sectionIndex, (items) => {
      const copy = [...items];
      const current = copy[itemIndex] || {};
      copy[itemIndex] = { ...current, title };
      return copy;
    });
  };

  const handleGalleryItemImage = async (
    e: ChangeEvent<HTMLInputElement>,
    sectionIndex: number,
    itemIndex: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadLandingImage(file, `gallery-${sectionIndex}-${itemIndex}`);

    await updateGalleryItems(sectionIndex, (items) => {
      const copy = [...items];
      const current = copy[itemIndex] || {};
      copy[itemIndex] = { ...current, image: url };
      return copy;
    });
  };

  const handleRemoveGalleryItem = async (
    sectionIndex: number,
    itemIndex: number
  ) => {
    await updateGalleryItems(sectionIndex, (items) =>
      items.filter((_, idx) => idx !== itemIndex)
    );
  };

  // ������������������������ Reordenar items dentro de galer+�a ������������������������������������������������������������������������������������������������
  const reorderGalleryItems = async (
    sectionIndex: number,
    fromIndex: number,
    toIndex: number
  ) => {
    if (fromIndex === toIndex) return;

    await updateGalleryItems(sectionIndex, (items) => {
      const copy = [...items];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      return copy;
    });
  };

  // ������������������������ Reordenar items dentro de featured categories ������������������������������������������������������������
  const reorderFeaturedCategoryItems = async (
    sectionIndex: number,
    fromIndex: number,
    toIndex: number
  ) => {
    if (fromIndex === toIndex) return;

    await updateFeaturedCategoryItems(sectionIndex, (items) => {
      const copy = [...items];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      return copy;
    });
  };



  const getResolvedHeroIndex = (sectionId: string, itemCount: number) => {
    if (!itemCount) return undefined;
    const storedIndex = activeHeroIndex[sectionId];
    if (typeof storedIndex !== "number" || Number.isNaN(storedIndex)) {
      return 0;
    }
    return Math.max(0, Math.min(storedIndex, itemCount - 1));
  };

  const buildHeroPreviewProps = (section: any, previewDeviceValue: "desktop" | "mobile") => {
    const sectionProps = section.props || {};
    const { items: _ignoredItems, ...baseProps } = sectionProps;
    const heroItems = Array.isArray(sectionProps.items) ? sectionProps.items : [];
    const activeIdx = getResolvedHeroIndex(section.id, heroItems.length);

    if (typeof activeIdx === "number" && heroItems[activeIdx]) {
      const activeItem = heroItems[activeIdx] || {};
      const { fieldPositions, fieldStyles, ...safeItem } = activeItem;

      return {
        props: {
          ...baseProps,
          items: [{ ...safeItem }],
          device: previewDeviceValue,
        },
        fieldPositions: fieldPositions || {},
        fieldStyles: fieldStyles || {},
      };
    }

    return {
      props: {
        ...baseProps,
        device: previewDeviceValue,
      },
      fieldPositions: section.fieldPositions || {},
      fieldStyles: section.fieldStyles || {},
    };
  };

  const buildHeroPositioningValues = (section: any, activeIdx?: number) => {
    const sectionProps = section.props || {};
    const heroItems = Array.isArray(sectionProps.items) ? sectionProps.items : [];
    const activeItem = typeof activeIdx === "number" ? heroItems[activeIdx] || {} : {};

    return {
      title: activeItem.title ?? sectionProps.title ?? "",
      buttonText: activeItem.buttonText ?? sectionProps.buttonText ?? "",
    };
  };



  const handleSectionImage = async (
    e: ChangeEvent<HTMLInputElement>,
    idx: number,
    fieldName: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadLandingImage(file, `section-${idx}`);

    const updated = [...sections];
    const current = updated[idx];
    updated[idx] = {
      ...current,
      props: {
        ...(current.props || {}),
        [fieldName]: url,
      },
    };

    setSections(updated);
    setSaving(true);
    await saveLandingSections(updated);
    setSaving(false);
  };

  const updateFeaturedCategoryItems = async (
    sectionIndex: number,
    updater: (
      items: {
        title?: string;
        image?: string | null;
        link?: string;
      }[]
    ) => {
      title?: string;
      image?: string | null;
      link?: string;
    }[]
  ) => {
    const updated = [...sections];
    const current = updated[sectionIndex];
    if (!current) return;

    const currentItems = ((current.props?.items as any[]) || []) as {
      title?: string;
      image?: string | null;
      link?: string;
    }[];

    const newItems = updater(currentItems);

    updated[sectionIndex] = {
      ...current,
      props: {
        ...(current.props || {}),
        items: newItems,
      },
    };

    setSections(updated);
    setSaving(true);
    await saveLandingSections(updated);
    setSaving(false);
  };

  const handleAddFeaturedCategoryItem = async (sectionIndex: number) => {
    await updateFeaturedCategoryItems(sectionIndex, (items) => [
      ...items,
      {
        title: "",
        image: null,
        link: "",
      },
    ]);
  };

  const handleFeaturedCategoryFieldChange = async (
    sectionIndex: number,
    itemIndex: number,
    field: "title" | "link",
    value: string
  ) => {
    await updateFeaturedCategoryItems(sectionIndex, (items) => {
      const copy = [...items];
      const current = copy[itemIndex] || {};
      copy[itemIndex] = { ...current, [field]: value };
      return copy;
    });
  };

  const handleFeaturedCategoryImage = async (
    e: ChangeEvent<HTMLInputElement>,
    sectionIndex: number,
    itemIndex: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadLandingImage(file, `featured-category-${sectionIndex}-${itemIndex}`);

    await updateFeaturedCategoryItems(sectionIndex, (items) => {
      const copy = [...items];
      const current = copy[itemIndex] || {};
      copy[itemIndex] = { ...current, image: url };
      return copy;
    });
  };

  const handleRemoveFeaturedCategoryItem = async (
    sectionIndex: number,
    itemIndex: number
  ) => {
    await updateFeaturedCategoryItems(sectionIndex, (items) =>
      items.filter((_, idx) => idx !== itemIndex)
    );
  };

  const removeSection = async (id: string) => {
    setSaving(true);
    await deleteSection(id);
    setSections((prev) => prev.filter((s) => s.id !== id));
    setSaving(false);
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const updated = Array.from(sections);
    const [removed] = updated.splice(result.source.index, 1);
    updated.splice(result.destination.index, 0, removed);

    updated.forEach((s, i) => (s.order = i + 1));

    setSections(updated);
    setSaving(true);
    await saveLandingSections(updated);
    setSaving(false);
  };

  const moveSection = async (idx: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? idx - 1 : idx + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const updated = [...sections];
    const [moved] = updated.splice(idx, 1);
    updated.splice(targetIndex, 0, moved);
    updated.forEach((s, i) => (s.order = i + 1));

    setSections(updated);
    setSaving(true);
    await saveLandingSections(updated);
    setSaving(false);
  };

  const openAddModal = (afterIdx: number | null = null) => {
    setAddAfterIndex(afterIdx);
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddAfterIndex(null);
  };

  const handleAddSectionType = (type: SectionType) => {
    const newSection = getDefaultSection(type);
    const updated = [...sections];

    if (addAfterIndex === null) {
      updated.push(newSection);
    } else {
      updated.splice(addAfterIndex + 1, 0, newSection);
    }

    updated.forEach((s, i) => (s.order = i + 1));
    setSections(updated);

    closeAddModal();
  };

  /* ============================
     RENDER
  ============================ */

  if (loading)
    return <div className="p-8 text-center flex flex-col items-center justify-center"><Loading3DIcon /><span className="mt-4 text-slate-400 dark:text-white/30 text-sm">Cargando landing...</span></div>;

  return (
    <div className="min-h-screen py-6 sm:py-12 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-6">
      <h1 className="text-2xl font-bold mb-6">Editor de Landing</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Columna izquierda: editor */}
        <div>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable
              droppableId="sections"
              isDropDisabled={false}
              isCombineEnabled={false}
              ignoreContainerClipping={false}
            >
              {(provided: import("react-beautiful-dnd").DroppableProvided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {sections.map((section, idx) => {
                    const currentTab =
                      activeTabs[section.id] || ("content" as const);
                    return (
                    <Draggable key={section.id} draggableId={section.id} index={idx}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 mb-4 rounded shadow border border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex items-start justify-between mb-3 gap-3">
                            <div className="flex items-center gap-2">
                              {/* Drag handle icon for section reordering */}
                              <span
                                {...provided.dragHandleProps}
                                className="material-icons-round cursor-move select-none text-slate-400 text-lg mr-2"
                                title="Arrastrar para reordenar secci+�n"
                              >
                                drag_indicator
                              </span>
                              <div>
                                <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
                                  {section.type
                                    ? String(section.type).toUpperCase()
                                    : "(Sin tipo)"}
                                  {/* Eliminado texto de medida recomendada arriba */}
                                </h3>
                                {section.hidden && (
                                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                    <span className="material-icons-round text-[14px]">
                                      visibility_off
                                    </span>
                                    Oculta en landing
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                              <button
                                type="button"
                                className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 flex items-center gap-1"
                                onClick={() => toggleSectionHidden(section.id)}
                              >
                                <span className="material-icons-round text-[14px]">
                                  {section.hidden ? "visibility" : "visibility_off"}
                                </span>
                                {section.hidden ? "Mostrar" : "Ocultar"}
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 flex items-center gap-1"
                                onClick={() => duplicateSection(idx)}
                              >
                                <span className="material-icons-round text-[14px]">
                                  content_copy
                                </span>
                                Duplicar
                              </button>
                              <button
                                type="button"
                                className="px-1.5 py-1 rounded border border-slate-200 hover:bg-slate-50 flex items-center gap-1 disabled:opacity-40"
                                onClick={() => moveSection(idx, "up")}
                                disabled={idx === 0}
                                title="Mover secci+�n hacia arriba"
                              >
                                <span className="material-icons-round text-[16px]">
                                  arrow_upward
                                </span>
                              </button>
                              <button
                                type="button"
                                className="px-1.5 py-1 rounded border border-slate-200 hover:bg-slate-50 flex items-center gap-1 disabled:opacity-40"
                                onClick={() => moveSection(idx, "down")}
                                disabled={idx === sections.length - 1}
                                title="Mover secci+�n hacia abajo"
                              >
                                <span className="material-icons-round text-[16px]">
                                  arrow_downward
                                </span>
                              </button>
                            </div>
                          </div>

                          {/* Tabs Contenido / Estilos / Avanzado / Posiciones (si hero o banner) */}
                          <div className="flex gap-2 mb-3 text-[11px] flex-wrap">
                            {[
                              { id: "content", label: "Contenido" },
                              { id: "styles", label: "Estilos" },
                              { id: "advanced", label: "Avanzado" },
                              ...(section.type === "hero" || section.type === "banner"
                                ? [{ id: "positioning", label: "Posiciones" }]
                                : []),
                            ].map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() =>
                                  setActiveTabs((prev) => ({
                                    ...prev,
                                    [section.id]:
                                      tab.id as
                                        | "content"
                                        | "styles"
                                        | "advanced"
                                        | "positioning",
                                  }))
                                }
                                className={`px-2 py-1 rounded-full border text-xs ${
                                  currentTab === tab.id
                                    ? "bg-purple-600 text-white border-purple-600"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                }`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>

                          {/* Form builder din+�mico basado en sectionSchemas */}
                          {(() => {
                            const schema = sectionSchemas[section.type];
                            if (!schema) return null;
                            const props = section.props || {};
                            const heroItems = (props?.items as any[]) || [];
                            const activeHeroIdx = getResolvedHeroIndex(section.id, heroItems.length) ?? 0;
                            const styles = section.styles || {};
                            // If editing a hero item, prefer the item's fieldStyles so the editor
                            // reflects and edits the active variant. Otherwise fall back to section styles.
                            const fieldStyles =
                              section.type === "hero" && heroItems.length > 0
                                ? (heroItems[activeHeroIdx]?.fieldStyles || {})
                                : (section.fieldStyles || {});

                            const contentFields = schema.fields.filter(
                              (f: any) => (!f.group || f.group === "content") && !(section.type === "hero" && f.name === "image")
                            );
                            const styleFields = schema.fields.filter(
                              (f: any) => f.group === "styles"
                            );

                            return (
                              <div className="space-y-4">
                                {/* Contenido */}
                                {contentFields.length > 0 &&
                                  currentTab === "content" && (
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-semibold uppercase text-slate-500">
                                      Contenido
                                    </h4>
                                    {contentFields.map((field: any) => {
                                      let value = props[field.name] ?? "";
                                      if (section.type === "hero" && Array.isArray(heroItems) && heroItems.length > 0 && typeof activeHeroIdx === "number") {
                                        value = (heroItems[activeHeroIdx] && (heroItems[activeHeroIdx][field.name] ?? "")) || "";
                                      }
                                      const isStylable = field.stylable;
                                      const isActiveField = activeFieldStyles[section.id] === field.name;
                                      const rawFieldStyle = fieldStyles[field.name] || {};
                                      let currentFieldStyle: any = {};
                                      // Normalize device-scoped styles: prefer current previewDevice, fallback to desktop, then legacy flat shape
                                      if (rawFieldStyle) {
                                        if ((rawFieldStyle as any).desktop === undefined && (rawFieldStyle as any).mobile === undefined) {
                                          // legacy flat shape
                                          currentFieldStyle = rawFieldStyle;
                                        } else {
                                          currentFieldStyle = (rawFieldStyle as any)[previewDevice] || (rawFieldStyle as any).desktop || {};
                                        }
                                      }

                                      // Checkbox Google Maps
                                      if (field.type === "boolean" && field.name === "googleMaps") {
                                        return (
                                          <div key={field.name} className="flex items-center gap-2 mb-2">
                                            <input
                                              type="checkbox"
                                              checked={!!props[field.name]}
                                              onChange={(e) =>
                                                handleSectionPropChange(
                                                  idx,
                                                  field.name,
                                                  e.target.checked
                                                )
                                              }
                                            />
                                            <label className="text-sm font-medium">{field.label}</label>
                                          </div>
                                        );
                                      }

                                      // Campos especiales Google Maps solo si el checkbox est+� activo
                                      if (field.showIf && field.showIf.googleMaps && !props.googleMaps) {
                                        return null;
                                      }

                                      if (field.type === "text" || field.type === "number") {
                                        return (
                                          <div key={field.name} className="space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                              <input
                                                className="flex-1 border p-2 text-sm rounded"
                                                placeholder={field.label}
                                                value={value}
                                                onChange={(e) =>
                                                  section.type === "hero" && Array.isArray(heroItems) && heroItems.length > 0
                                                    ? handleHeroItemFieldChange(idx, activeHeroIdx, field.name, e.target.value)
                                                    : handleSectionPropChange(idx, field.name, e.target.value)
                                                }
                                              />
                                              {isStylable && (
                                                <button
                                                  type="button"
                                                  className={`ml-2 px-2 py-1 rounded border text-[11px] flex items-center gap-1 ${
                                                    isActiveField
                                                      ? "bg-purple-600 text-white border-purple-600"
                                                      : "bg-slate-50 text-slate-600 border-slate-200"
                                                  }`}
                                                  onClick={() =>
                                                    setActiveFieldStyles(
                                                      (prev) => ({
                                                        ...prev,
                                                        [section.id]: prev[section.id] ===
                                                          field.name
                                                            ? null
                                                            : field.name,
                                                      })
                                                    )
                                                  }
                                                >
                                                  <span className="material-icons-round text-[14px]">format_paint</span>
                                                  Estilos
                                                </button>
                                              )}
                                            </div>
                                            {isStylable && isActiveField && (
                                              <div className="mt-2 p-2 rounded border border-slate-200 bg-slate-50 flex flex-wrap items-center gap-2 text-[11px]">
                                                <div className="flex items-center gap-1">
                                                  <span className="text-slate-600">Color</span>
                                                  <input
                                                    type="color"
                                                    className="h-6 w-8 border rounded"
                                                    value={currentFieldStyle.color || "#000000"}
                                                    onChange={(e) =>
                                                      section.type === "hero" && heroItems.length > 0
                                                        ? handleHeroItemFieldStyleChange(
                                                            idx,
                                                            activeHeroIdx,
                                                            field.name,
                                                            "color",
                                                            e.target.value
                                                          )
                                                        : handleFieldStyleChange(
                                                            idx,
                                                            field.name,
                                                            "color",
                                                            e.target.value
                                                          )
                                                    }
                                                  />
                                                </div>
                                                <button
                                                  type="button"
                                                  className={`px-2 py-1 rounded border flex items-center gap-1 ${
                                                    currentFieldStyle.fontWeight ===
                                                    "bold"
                                                      ? "bg-slate-800 text-white border-slate-800"
                                                      : "bg-white text-slate-700 border-slate-300"
                                                  }`}
                                                  onClick={() =>
                                                    section.type === "hero" && heroItems.length > 0
                                                      ? handleHeroItemFieldStyleChange(
                                                          idx,
                                                          activeHeroIdx,
                                                          field.name,
                                                          "fontWeight",
                                                          currentFieldStyle.fontWeight === "bold" ? "normal" : "bold"
                                                        )
                                                      : handleFieldStyleChange(
                                                          idx,
                                                          field.name,
                                                          "fontWeight",
                                                          currentFieldStyle.fontWeight === "bold" ? "normal" : "bold"
                                                        )
                                                  }
                                                >
                                                  <span className="material-icons-round text-[14px]">format_bold</span>
                                                </button>
                                                <button
                                                  type="button"
                                                  className={`px-2 py-1 rounded border flex items-center gap-1 ${
                                                    currentFieldStyle.fontStyle ===
                                                    "italic"
                                                      ? "bg-slate-800 text-white border-slate-800"
                                                      : "bg-white text-slate-700 border-slate-300"
                                                  }`}
                                                  onClick={() =>
                                                    section.type === "hero" && heroItems.length > 0
                                                      ? handleHeroItemFieldStyleChange(
                                                          idx,
                                                          activeHeroIdx,
                                                          field.name,
                                                          "fontStyle",
                                                          currentFieldStyle.fontStyle === "italic" ? "normal" : "italic"
                                                        )
                                                      : handleFieldStyleChange(
                                                          idx,
                                                          field.name,
                                                          "fontStyle",
                                                          currentFieldStyle.fontStyle === "italic" ? "normal" : "italic"
                                                        )
                                                  }
                                                >
                                                  <span className="material-icons-round text-[14px]">format_italic</span>
                                                </button>
                                                <button
                                                  type="button"
                                                  className={`px-2 py-1 rounded border flex items-center gap-1 ${
                                                    currentFieldStyle.textDecoration ===
                                                    "underline"
                                                      ? "bg-slate-800 text-white border-slate-800"
                                                      : "bg-white text-slate-700 border-slate-300"
                                                  }`}
                                                  onClick={() =>
                                                    section.type === "hero" && heroItems.length > 0
                                                      ? handleHeroItemFieldStyleChange(
                                                          idx,
                                                          activeHeroIdx,
                                                          field.name,
                                                          "textDecoration",
                                                          currentFieldStyle.textDecoration === "underline" ? "none" : "underline"
                                                        )
                                                      : handleFieldStyleChange(
                                                          idx,
                                                          field.name,
                                                          "textDecoration",
                                                          currentFieldStyle.textDecoration === "underline" ? "none" : "underline"
                                                        )
                                                  }
                                                >
                                                  <span className="material-icons-round text-[14px]">format_underlined</span>
                                                </button>
                                                <div className="flex items-center gap-1">
                                                  <span className="text-slate-600">Tama+�o</span>
                                                  <input
                                                    type="text"
                                                    className="w-16 border rounded px-1 py-0.5 text-[11px]"
                                                    placeholder="16px"
                                                    value={currentFieldStyle.fontSize || ""}
                                                    onChange={(e) =>
                                                      section.type === "hero" && heroItems.length > 0
                                                        ? handleHeroItemFieldStyleChange(
                                                            idx,
                                                            activeHeroIdx,
                                                            field.name,
                                                            "fontSize",
                                                            e.target.value
                                                          )
                                                        : handleFieldStyleChange(
                                                            idx,
                                                            field.name,
                                                            "fontSize",
                                                            e.target.value
                                                          )
                                                    }
                                                  />
                                                </div>
                                                {(field.name === "badge" ||
                                                  field.name ===
                                                    "buttonText") && (
                                                  <>
                                                    <div className="flex items-center gap-1">
                                                      <span className="text-slate-600">Fondo contenedor</span>
                                                      <input
                                                        type="color"
                                                        className="h-6 w-8 border rounded"
                                                        value={currentFieldStyle.backgroundColor || "#000000"}
                                                          onChange={(e) =>
                                                          section.type === "hero" && heroItems.length > 0
                                                            ? handleHeroItemFieldStyleChange(
                                                                idx,
                                                                activeHeroIdx,
                                                                field.name,
                                                                "backgroundColor",
                                                                e.target.value
                                                              )
                                                            : handleFieldStyleChange(
                                                                idx,
                                                                field.name,
                                                                "backgroundColor",
                                                                e.target.value
                                                              )
                                                        }
                                                      />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                      <span className="text-slate-600">Border radius</span>
                                                      <input
                                                        type="text"
                                                        className="w-20 border rounded px-1 py-0.5 text-[11px]"
                                                        placeholder="9999px"
                                                        value={currentFieldStyle.borderRadius || ""}
                                                          onChange={(e) =>
                                                          section.type === "hero" && heroItems.length > 0
                                                            ? handleHeroItemFieldStyleChange(
                                                                idx,
                                                                activeHeroIdx,
                                                                field.name,
                                                                "borderRadius",
                                                                e.target.value
                                                              )
                                                            : handleFieldStyleChange(
                                                                idx,
                                                                field.name,
                                                                "borderRadius",
                                                                e.target.value
                                                              )
                                                        }
                                                      />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                      <span className="text-slate-600">Padding X</span>
                                                      <input
                                                        type="text"
                                                        className="w-16 border rounded px-1 py-0.5 text-[11px]"
                                                        placeholder="12px"
                                                        value={currentFieldStyle.paddingInline || ""}
                                                          onChange={(e) =>
                                                          section.type === "hero" && heroItems.length > 0
                                                            ? handleHeroItemFieldStyleChange(
                                                                idx,
                                                                activeHeroIdx,
                                                                field.name,
                                                                "paddingInline",
                                                                e.target.value
                                                              )
                                                            : handleFieldStyleChange(
                                                                idx,
                                                                field.name,
                                                                "paddingInline",
                                                                e.target.value
                                                              )
                                                        }
                                                      />
                                                      <span className="text-slate-600">Y</span>
                                                      <input
                                                        type="text"
                                                        className="w-16 border rounded px-1 py-0.5 text-[11px]"
                                                        placeholder="6px"
                                                        value={currentFieldStyle.paddingBlock || ""}
                                                          onChange={(e) =>
                                                          section.type === "hero" && heroItems.length > 0
                                                            ? handleHeroItemFieldStyleChange(
                                                                idx,
                                                                activeHeroIdx,
                                                                field.name,
                                                                "paddingBlock",
                                                                e.target.value
                                                              )
                                                            : handleFieldStyleChange(
                                                                idx,
                                                                field.name,
                                                                "paddingBlock",
                                                                e.target.value
                                                              )
                                                        }
                                                      />
                                                    </div>
                                                  </>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }

                                      if (field.type === "textarea") {
                                        return (
                                          <div key={field.name} className="space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                              <textarea
                                                className="flex-1 border p-2 text-sm rounded"
                                                placeholder={field.label}
                                                value={value}
                                                onChange={(e) =>
                                                  handleSectionPropChange(
                                                    idx,
                                                    field.name,
                                                    e.target.value
                                                  )
                                                }
                                              />
                                              {isStylable && (
                                                <button
                                                  type="button"
                                                  className={`ml-2 px-2 py-1 rounded border text-[11px] flex items-center gap-1 ${
                                                    isActiveField
                                                      ? "bg-purple-600 text-white border-purple-600"
                                                      : "bg-slate-50 text-slate-600 border-slate-200"
                                                  }`}
                                                  onClick={() =>
                                                    setActiveFieldStyles(
                                                      (prev) => ({
                                                        ...prev,
                                                        [section.id]: prev[section.id] ===
                                                          field.name
                                                            ? null
                                                            : field.name,
                                                      })
                                                    )
                                                  }
                                                >
                                                  <span className="material-icons-round text-[14px]">format_paint</span>
                                                  Estilos
                                                </button>
                                              )}
                                            </div>
                                            {/* Bot+�n para abrir modal de selecci+�n de comentarios Google Maps */}
                                            <div className="mt-2">
                                              <button
                                                className="bg-blue-600 text-white px-4 py-2 rounded"
                                                type="button"
                                                onClick={openGoogleCommentsModal}
                                              >
                                                Seleccionar comentarios de Google Maps
                                              </button>
                                            </div>
                                            {/* Google Comments Modal Fragment */}
                                            {showGoogleCommentsModal && (
                                              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                                                <div className="bg-white dark:bg-slate-900 p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                                                  <div className="flex justify-between items-center mb-4">
                                                    <h2 className="font-bold text-lg">Selecciona hasta 6 comentarios de Google Maps</h2>
                                                    <button className="text-slate-500 hover:text-slate-800" onClick={closeGoogleCommentsModal}>
                                                      <span className="material-icons-round">close</span>
                                                    </button>
                                                  </div>
                                                  {googleCommentsLoading ? (
                                                    <div className="flex flex-col items-center justify-center py-8">
                                                      <Loading3DIcon />
                                                      <span className="mt-4 text-slate-400 dark:text-white/30 text-sm">Cargando comentarios...</span>
                                                    </div>
                                                  ) : (
                                                    <div className="grid gap-4 md:grid-cols-2">
                                                      {googleComments.slice(0, 5).map((c, idx) => {
                                                        const selected = selectedGoogleComments.some((sc) => sc.text === c.text);
                                                        const canSelect = selectedGoogleComments.length < 6 || selected;
                                                        return (
                                                          <div
                                                            key={c.text || idx}
                                                            className={`bg-white dark:bg-slate-900 rounded-xl p-4 shadow border border-slate-200 dark:border-slate-700 flex flex-col relative ${selected ? 'ring-2 ring-purple-500' : ''} ${!canSelect ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            onClick={() => canSelect && toggleGoogleComment(c)}
                                                            style={{ cursor: canSelect ? 'pointer' : 'not-allowed' }}
                                                          >
                                                            <div className="flex items-center mb-2">
                                                              {c.photo ? (
                                                                <img src={c.photo} alt={c.author} className="w-10 h-10 rounded-full mr-3 border border-slate-300" />
                                                              ) : (
                                                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 border border-slate-300">
                                                                  <span className="material-icons-round">person</span>
                                                                </div>
                                                              )}
                                                              <div className="flex flex-col">
                                                                <span className="font-semibold text-base">{c.author}</span>
                                                                <span className="text-xs text-slate-500">{c.date || ''}</span>
                                                              </div>
                                                              <div className="ml-auto flex items-center gap-1">
                                                                {[1,2,3,4,5].map(i => (
                                                                  <span key={i} className={i <= parseInt(c.rating) ? "text-yellow-400" : "text-slate-300"}>
                                                                    <span className="material-icons-round">star</span>
                                                                  </span>
                                                                ))}
                                                              </div>
                                                            </div>
                                                            <div className="text-sm text-slate-700 dark:text-slate-200 mb-2 mt-2">
                                                              {c.text}
                                                            </div>
                                                            <input
                                                              type="checkbox"
                                                              checked={selected}
                                                              readOnly
                                                              className="absolute top-2 right-2"
                                                              style={{ pointerEvents: 'none' }}
                                                            />
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                  <div className="mt-4 flex justify-end gap-2">
                                                    <button className="bg-slate-200 px-4 py-2 rounded" onClick={closeGoogleCommentsModal}>Cancelar</button>
                                                    <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={saveSelectedGoogleComments}>Guardar selecci+�n</button>
                                                  </div>
                                                  <div className="mt-2 text-xs text-slate-500">Puedes seleccionar hasta 6 comentarios para mostrar en la landing page.</div>
                                                </div>
                                              </div>
                                            )}
                                            {isStylable && isActiveField && (
                                              <div className="mt-2 p-2 rounded border border-slate-200 bg-slate-50 flex flex-wrap items-center gap-2 text-[11px]">
                                                <div className="flex items-center gap-1">
                                                  <span className="text-slate-600">Color</span>
                                                  <input
                                                    type="color"
                                                    className="h-6 w-8 border rounded"
                                                    value={currentFieldStyle.color || "#000000"}
                                                    onChange={(e) =>
                                                      handleFieldStyleChange(
                                                        idx,
                                                        field.name,
                                                        "color",
                                                        e.target.value
                                                      )
                                                    }
                                                  />
                                                </div>
                                                <button
                                                  type="button"
                                                  className={`px-2 py-1 rounded border flex items-center gap-1 ${
                                                    currentFieldStyle.fontWeight ===
                                                    "bold"
                                                      ? "bg-slate-800 text-white border-slate-800"
                                                      : "bg-white text-slate-700 border-slate-300"
                                                  }`}
                                                  onClick={() =>
                                                    handleFieldStyleChange(
                                                      idx,
                                                      field.name,
                                                      "fontWeight",
                                                      currentFieldStyle.fontWeight ===
                                                        "bold"
                                                        ? "normal"
                                                        : "bold"
                                                    )
                                                  }
                                                >
                                                  <span className="material-icons-round text-[14px]">format_bold</span>
                                                </button>
                                                <button
                                                  type="button"
                                                  className={`px-2 py-1 rounded border flex items-center gap-1 ${
                                                    currentFieldStyle.fontStyle ===
                                                    "italic"
                                                      ? "bg-slate-800 text-white border-slate-800"
                                                      : "bg-white text-slate-700 border-slate-300"
                                                  }`}
                                                  onClick={() =>
                                                    handleFieldStyleChange(
                                                      idx,
                                                      field.name,
                                                      "fontStyle",
                                                      currentFieldStyle.fontStyle ===
                                                        "italic"
                                                        ? "normal"
                                                        : "italic"
                                                    )
                                                  }
                                                >
                                                  <span className="material-icons-round text-[14px]">format_italic</span>
                                                </button>
                                                <button
                                                  type="button"
                                                  className={`px-2 py-1 rounded border flex items-center gap-1 ${
                                                    currentFieldStyle.textDecoration ===
                                                    "underline"
                                                      ? "bg-slate-800 text-white border-slate-800"
                                                      : "bg-white text-slate-700 border-slate-300"
                                                  }`}
                                                  onClick={() =>
                                                    handleFieldStyleChange(
                                                      idx,
                                                      field.name,
                                                      "textDecoration",
                                                      currentFieldStyle.textDecoration ===
                                                        "underline"
                                                        ? "none"
                                                        : "underline"
                                                    )
                                                  }
                                                >
                                                  <span className="material-icons-round text-[14px]">format_underlined</span>
                                                </button>
                                                <div className="flex items-center gap-1">
                                                  <span className="text-slate-600">Tama+�o</span>
                                                  <input
                                                    type="text"
                                                    className="w-16 border rounded px-1 py-0.5 text-[11px]"
                                                    placeholder="16px"
                                                    value={currentFieldStyle.fontSize || ""}
                                                    onChange={(e) =>
                                                      handleFieldStyleChange(
                                                        idx,
                                                        field.name,
                                                        "fontSize",
                                                        e.target.value
                                                      )
                                                    }
                                                  />
                                                  
                                                </div>
                                                {(field.name === "badge" ||
                                                  field.name ===
                                                    "buttonText") && (
                                                  <>
                                                    <div className="flex items-center gap-1">
                                                      <span className="text-slate-600">Fondo contenedor</span>
                                                      <input
                                                        type="color"
                                                        className="h-6 w-8 border rounded"
                                                        value={currentFieldStyle.backgroundColor || "#000000"}
                                                        onChange={(e) =>
                                                          handleFieldStyleChange(
                                                            idx,
                                                            field.name,
                                                            "backgroundColor",
                                                            e.target.value
                                                          )
                                                        }
                                                      />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                      <span className="text-slate-600">Border radius</span>
                                                      <input
                                                        type="text"
                                                        className="w-20 border rounded px-1 py-0.5 text-[11px]"
                                                        placeholder="9999px"
                                                        value={currentFieldStyle.borderRadius || ""}
                                                        onChange={(e) =>
                                                          handleFieldStyleChange(
                                                            idx,
                                                            field.name,
                                                            "borderRadius",
                                                            e.target.value
                                                          )
                                                        }
                                                      />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                      <span className="text-slate-600">Padding X</span>
                                                      <input
                                                        type="text"
                                                        className="w-16 border rounded px-1 py-0.5 text-[11px]"
                                                        placeholder="12px"
                                                        value={currentFieldStyle.paddingInline || ""}
                                                        onChange={(e) =>
                                                          handleFieldStyleChange(
                                                            idx,
                                                            field.name,
                                                            "paddingInline",
                                                            e.target.value
                                                          )
                                                        }
                                                      />
                                                      <span className="text-slate-600">Y</span>
                                                      <input
                                                        type="text"
                                                        className="w-16 border rounded px-1 py-0.5 text-[11px]"
                                                        placeholder="6px"
                                                        value={currentFieldStyle.paddingBlock || ""}
                                                        onChange={(e) =>
                                                          handleFieldStyleChange(
                                                            idx,
                                                            field.name,
                                                            "paddingBlock",
                                                            e.target.value
                                                          )
                                                        }
                                                      />
                                                    </div>
                                                  </>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }

                                      if (field.type === "image") {
                                        // Ayuda contextual para dimensiones recomendadas
                                        let dimensionHelp = null;
                                        if (section.type === "hero") {
                                          dimensionHelp = (
                                            <div className="text-[11px] text-purple-700 bg-purple-50 rounded px-2 py-1 mt-1 border border-purple-100">
                                              M+�nimo: <b>1200x500px</b>
                                            </div>
                                          );
                                        } else if (section.type === "banner") {
                                          dimensionHelp = (
                                            <div className="text-[11px] text-blue-700 bg-blue-50 rounded px-2 py-1 mt-1 border border-blue-100">
                                              M+�nimo: <b>1200x500px</b>
                                            </div>
                                          );
                                        }
                                        return (
                                          <div key={field.name} className="space-y-1">
                                            <label className="block text-xs text-slate-500">
                                              {field.label}
                                            </label>
                                            <input
                                              type="file"
                                              onChange={(e) =>
                                                handleSectionImage(
                                                  e,
                                                  idx,
                                                  field.name
                                                )
                                              }
                                            />
                                            {dimensionHelp}
                                          </div>
                                        );
                                      }
                                      return null;
                                    })}
                                  </div>
                                )}

                                {/* Vista r+�pida de productos destacados para esta secci+�n */}
                                {section.type === "featuredProducts" &&
                                  currentTab === "content" && (
                                    <div className="mt-3 border border-dashed border-slate-200 rounded-md p-3 bg-slate-50 dark:bg-slate-900">
                                      <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2 flex items-center gap-1">
                                        <span className="material-icons-round text-[14px] text-purple-500">
                                          new_releases
                                        </span>
                                        Productos recientes
                                      </h4>
                                      {featuredProducts.length === 0 ? (
                                        <p className="text-[11px] text-slate-500">
                                          No hay productos recientes disponibles.
                                        </p>
                                      ) : (
                                        <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
                                          {featuredProducts.map((prod: any) => (
                                            <div
                                              key={prod.id || String(prod)}
                                              className="relative group shrink-0 w-40"
                                            >
                                              <div className="transform scale-90 origin-top">
                                                <ProductoCard
                                                  producto={prod}
                                                  showCart={false}
                                                  showEye={false}
                                                  onClick={() => {}}
                                                  onAddCart={() => {}}
                                                  onEye={() => {}}
                                                />
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                {/* Editor de items para secciones de galer+�a */}
                                {section.type === "gallery" &&
                                  currentTab === "content" && (
                                    <div className="mt-3 border border-dashed border-slate-200 rounded-md p-3 bg-slate-50 dark:bg-slate-900">
                                      <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2 flex items-center gap-1">
                                        <span className="material-icons-round text-[14px] text-purple-500">
                                          collections
                                        </span>
                                        Items de galer+�a (t+�tulo + logo)
                                      </h4>
                                      {(() => {
                                        const galleryItems = ((section.props?.items as any[]) || []) as {
                                          title?: string;
                                          image?: string;
                                        }[];

                                        if (!galleryItems.length) {
                                          return (
                                            <div className="space-y-2">
                                              <p className="text-[11px] text-slate-500">
                                                No hay items a+�n. Agrega logos de distribuidores u otras im+�genes
                                                usando el bot+�n de abajo.
                                              </p>
                                              <button
                                                type="button"
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-purple-600 text-white text-xs hover:bg-purple-700"
                                                onClick={() => handleAddGalleryItem(idx)}
                                              >
                                                <span className="material-icons-round text-[14px]">
                                                  add
                                                </span>
                                                Agregar item
                                              </button>
                                            </div>
                                          );
                                        }

                                        return (
                                          <>
                                            <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
                                              {galleryItems.map((item, itemIndex) => {
                                                const isDragging = draggedItemState?.sectionId === section.id && draggedItemState?.itemType === "gallery" && draggedItemState?.fromIndex === itemIndex;
                                                return (
                                                  <div
                                                    key={itemIndex}
                                                    draggable
                                                    onDragStart={() => setDraggedItemState({ sectionId: section.id, itemType: "gallery", fromIndex: itemIndex })}
                                                    onDragEnd={() => setDraggedItemState(null)}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={async (e) => {
                                                      e.preventDefault();
                                                      if (draggedItemState?.sectionId === section.id && draggedItemState?.itemType === "gallery") {
                                                        await reorderGalleryItems(idx, draggedItemState.fromIndex, itemIndex);
                                                        setDraggedItemState(null);
                                                      }
                                                    }}
                                                    className={`shrink-0 w-56 rounded-lg border p-2 flex flex-col gap-2 transition-all cursor-grab active:cursor-grabbing ${
                                                      isDragging
                                                        ? "opacity-50 scale-95 border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:shadow-md"
                                                    }`}
                                                  >
                                                  <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[11px] font-semibold text-slate-500">
                                                      Item {itemIndex + 1}
                                                    </span>
                                                    <button
                                                      type="button"
                                                      className="text-[10px] px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700"
                                                      onClick={() => handleRemoveGalleryItem(idx, itemIndex)}
                                                    >
                                                      Quitar
                                                    </button>
                                                  </div>
                                                  <input
                                                    type="text"
                                                    className="border rounded px-2 py-1 text-xs"
                                                    placeholder="T+�tulo (opcional)"
                                                    value={item.title || ""}
                                                    onChange={(e) =>
                                                      handleGalleryItemTitleChange(
                                                        idx,
                                                        itemIndex,
                                                        e.target.value
                                                      )
                                                    }
                                                  />
                                                  <div className="space-y-1">
                                                    {item.image && (
                                                      <div className="aspect-video rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800">
                                                        <img
                                                          src={item.image}
                                                          alt={item.title || "Logo"}
                                                          className="w-full h-full object-contain p-2"
                                                        />
                                                      </div>
                                                    )}
                                                    <input
                                                      type="file"
                                                      accept="image/*"
                                                      className="text-[11px]"
                                                      onChange={(e) =>
                                                        handleGalleryItemImage(
                                                          e,
                                                          idx,
                                                          itemIndex
                                                        )
                                                      }
                                                    />
                                                  </div>
                                                </div>
                                                );
                                              })}
                                            </div>
                                            <button
                                              type="button"
                                              className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded bg-purple-600 text-white text-xs hover:bg-purple-700"
                                              onClick={() => handleAddGalleryItem(idx)}
                                            >
                                              <span className="material-icons-round text-[14px]">
                                                add
                                              </span>
                                              Agregar otro item
                                            </button>
                                            <div className="mt-3 p-2 rounded border border-slate-200 bg-slate-50 text-[11px] space-y-2">
                                              <div className="flex items-center gap-1">
                                                <span className="material-icons-round text-[14px] text-purple-500">
                                                  format_paint
                                                </span>
                                                <span className="font-semibold text-slate-600">
                                                  Estilos de t+�tulos de items
                                                </span>
                                              </div>
                                              {(() => {
                                                // Asegura que currentFieldStyle sea plano (no responsive)
                                                let currentFieldStyle = (section.fieldStyles && (section.fieldStyles as any).itemTitle) || {};
                                                if (currentFieldStyle && (currentFieldStyle.desktop !== undefined)) {
                                                  currentFieldStyle = currentFieldStyle[previewDevice] || currentFieldStyle.desktop || {};
                                                }
                                                // Normaliza valores
                                                const fontWeightActive = currentFieldStyle.fontWeight === "bold";
                                                const fontStyleActive = currentFieldStyle.fontStyle === "italic";
                                                const textDecorationActive = currentFieldStyle.textDecoration === "underline";
                                                const colorValue = currentFieldStyle.color || "#000000";
                                                const fontSizeValue = typeof currentFieldStyle.fontSize === "string" ? currentFieldStyle.fontSize : "";
                                                return (
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    <div className="flex items-center gap-1">
                                                      <span className="text-slate-600">Color</span>
                                                      <input
                                                        type="color"
                                                        className="h-6 w-8 border rounded"
                                                        value={colorValue}
                                                        onChange={e =>
                                                          handleFieldStyleChange(
                                                            idx,
                                                            "itemTitle",
                                                            "color",
                                                            e.target.value
                                                          )
                                                        }
                                                        style={{ background: colorValue }}
                                                      />
                                                    </div>
                                                    <button
                                                      type="button"
                                                      className={`px-2 py-1 rounded border flex items-center gap-1 ${fontWeightActive ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-700 border-slate-300"}`}
                                                      onClick={() =>
                                                        handleFieldStyleChange(
                                                          idx,
                                                          "itemTitle",
                                                          "fontWeight",
                                                          fontWeightActive ? "normal" : "bold"
                                                        )
                                                      }
                                                      aria-pressed={fontWeightActive}
                                                    >
                                                      <span className="material-icons-round text-[14px]">format_bold</span>
                                                    </button>
                                                    <button
                                                      type="button"
                                                      className={`px-2 py-1 rounded border flex items-center gap-1 ${fontStyleActive ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-700 border-slate-300"}`}
                                                      onClick={() =>
                                                        handleFieldStyleChange(
                                                          idx,
                                                          "itemTitle",
                                                          "fontStyle",
                                                          fontStyleActive ? "normal" : "italic"
                                                        )
                                                      }
                                                      aria-pressed={fontStyleActive}
                                                    >
                                                      <span className="material-icons-round text-[14px]">format_italic</span>
                                                    </button>
                                                    <button
                                                      type="button"
                                                      className={`px-2 py-1 rounded border flex items-center gap-1 ${textDecorationActive ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-700 border-slate-300"}`}
                                                      onClick={() =>
                                                        handleFieldStyleChange(
                                                          idx,
                                                          "itemTitle",
                                                          "textDecoration",
                                                          textDecorationActive ? "none" : "underline"
                                                        )
                                                      }
                                                      aria-pressed={textDecorationActive}
                                                    >
                                                      <span className="material-icons-round text-[14px]">format_underlined</span>
                                                    </button>
                                                    <div className="flex items-center gap-1">
                                                      <span className="text-slate-600">Tama+�o</span>
                                                      <input
                                                        type="text"
                                                        className="w-16 border rounded px-1 py-0.5 text-[11px]"
                                                        placeholder="16px"
                                                        value={fontSizeValue}
                                                        onChange={e => {
                                                          // Permitir edici+�n libre
                                                          handleFieldStyleChange(
                                                            idx,
                                                            "itemTitle",
                                                            "fontSize",
                                                            e.target.value
                                                          );
                                                        }}
                                                        onBlur={e => {
                                                          let value = e.target.value;
                                                          // Si es un n+�mero, agrega px al salir del input
                                                          if (/^\d+$/.test(value)) {
                                                            value = value + "px";
                                                          }
                                                          handleFieldStyleChange(
                                                            idx,
                                                            "itemTitle",
                                                            "fontSize",
                                                            value
                                                          );
                                                        }}
                                                      />
                                                    </div>
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  )}

                                {/* Editor de categor+�as destacadas */}
                                {section.type === "featuredCategories" &&
                                  currentTab === "content" && (
                                    <div className="mt-3 border border-dashed border-slate-200 rounded-md p-3 bg-slate-50 dark:bg-slate-900">
                                      <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2 flex items-center gap-1">
                                        <span className="material-icons-round text-[14px] text-purple-500">
                                          category
                                        </span>
                                        Categor+�as destacadas
                                      </h4>
                                      {(() => {
                                        const items = ((section.props?.items as any[]) || []) as {
                                          title?: string;
                                          image?: string | null;
                                          link?: string;
                                        }[];

                                        if (!items.length) {
                                          return (
                                            <div className="space-y-2">
                                              <p className="text-[11px] text-slate-500">
                                                No hay categor+�as a+�n. Crea la primera categor+�a destacada con t+�tulo, imagen y enlace.
                                              </p>
                                              <button
                                                type="button"
                                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-purple-600 text-white text-xs hover:bg-purple-700"
                                                onClick={() => handleAddFeaturedCategoryItem(idx)}
                                              >
                                                <span className="material-icons-round text-[14px]">
                                                  add
                                                </span>
                                                Agregar categor+�a
                                              </button>
                                            </div>
                                          );
                                        }

                                        return (
                                          <>
                                            <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
                                              {items.map((item, itemIndex) => {
                                                const isDragging = draggedItemState?.sectionId === section.id && draggedItemState?.itemType === "featured-category" && draggedItemState?.fromIndex === itemIndex;
                                                return (
                                                  <div
                                                    key={itemIndex}
                                                    draggable
                                                    onDragStart={() => setDraggedItemState({ sectionId: section.id, itemType: "featured-category", fromIndex: itemIndex })}
                                                    onDragEnd={() => setDraggedItemState(null)}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={async (e) => {
                                                      e.preventDefault();
                                                      if (draggedItemState?.sectionId === section.id && draggedItemState?.itemType === "featured-category") {
                                                        await reorderFeaturedCategoryItems(idx, draggedItemState.fromIndex, itemIndex);
                                                        setDraggedItemState(null);
                                                      }
                                                    }}
                                                    className={`shrink-0 w-64 rounded-lg border p-3 flex flex-col gap-2 transition-all cursor-grab active:cursor-grabbing ${
                                                      isDragging
                                                        ? "opacity-50 scale-95 border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:shadow-md"
                                                    }`}
                                                  >
                                                  <div className="flex items-center justify-between gap-2 mb-1">
                                                    <span className="text-[11px] font-semibold text-slate-500">
                                                      Categoría {itemIndex + 1}
                                                    </span>
                                                    <button
                                                      type="button"
                                                      className="text-[10px] px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700"
                                                      onClick={() =>
                                                        handleRemoveFeaturedCategoryItem(
                                                          idx,
                                                          itemIndex
                                                        )
                                                      }
                                                    >
                                                      Quitar
                                                    </button>
                                                  </div>
                                                  <input
                                                    type="text"
                                                    className="border rounded px-2 py-1 text-xs"
                                                    placeholder="T+�tulo de la categor+�a"
                                                    value={item.title || ""}
                                                    onChange={(e) =>
                                                      handleFeaturedCategoryFieldChange(
                                                        idx,
                                                        itemIndex,
                                                        "title",
                                                        e.target.value
                                                      )
                                                    }
                                                  />
                                                  <input
                                                    type="text"
                                                    className="border rounded px-2 py-1 text-xs"
                                                    placeholder="Enlace (ruta interna, ej: /products-by-category)"
                                                    value={item.link || ""}
                                                    onChange={(e) =>
                                                      handleFeaturedCategoryFieldChange(
                                                        idx,
                                                        itemIndex,
                                                        "link",
                                                        e.target.value
                                                      )
                                                    }
                                                  />
                                                  <div className="space-y-1 mt-1">
                                                    {item.image && (
                                                      <div className="aspect-square rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800">
                                                        <img
                                                          src={item.image}
                                                          alt={item.title || "Categor+�a"}
                                                          className="w-full h-full object-cover"
                                                        />
                                                      </div>
                                                    )}
                                                    <input
                                                      type="file"
                                                      accept="image/*"
                                                      className="text-[11px]"
                                                      onChange={(e) =>
                                                        handleFeaturedCategoryImage(
                                                          e,
                                                          idx,
                                                          itemIndex
                                                        )
                                                      }
                                                    />
                                                  </div>
                                                </div>
                                                );
                                              })}
                                            </div>
                                            <button
                                              type="button"
                                              className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded bg-purple-600 text-white text-xs hover:bg-purple-700"
                                              onClick={() => handleAddFeaturedCategoryItem(idx)}
                                            >
                                              <span className="material-icons-round text-[14px]">
                                                add
                                              </span>
                                              Agregar otra categor+�a
                                            </button>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  )}

                                {/* Editor de galería para la sección Hero */}
                                {section.type === "hero" &&
                                  currentTab === "content" && (
                                    <div className="mt-3 border border-dashed border-slate-200 rounded-md p-3 bg-slate-50 dark:bg-slate-900">
                                      <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2 flex items-center gap-1">
                                        <span className="material-icons-round text-[14px] text-purple-500">
                                          collections
                                        </span>
                                        Galería del hero
                                      </h4>
                                      {(() => {
                                        const heroItems = ((section.props?.items as any[]) || []) as {
                                          title?: string;
                                          subtitle?: string;
                                          badge?: string;
                                          buttonText?: string;
                                          buttonLink?: string;
                                          images?: string[];
                                          image?: string | null;
                                          videoUrl?: string | null;
                                          fieldStyles?: Record<
                                            string,
                                            import("../../lib/landing-types").LandingFieldStyle
                                          >;
                                        }[];

                                        if (!heroItems.length) {
                                          return (
                                            <div className="space-y-2">
                                                <p className="text-[11px] text-slate-500">
                                                El hero ya no usa variantes. Aquí administras una sola tarjeta con varias imágenes.
                                              </p>
                                            </div>
                                          );
                                        }

                                        return (
                                          <>
                                            <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
                                              {heroItems.map((item, itemIndex) => (
                                                <div
                                                  key={itemIndex}
                                                  className={`shrink-0 w-72 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-2 ${
                                                    (activeHeroIndex[section.id] ?? 0) === itemIndex
                                                      ? "ring-2 ring-purple-500"
                                                      : ""
                                                  }`}
                                                >
                                                  {(() => {
                                                    const active =
                                                      activeHeroItemFieldStyles[section.id];
                                                    const isActive =
                                                      !!active &&
                                                      active.index === itemIndex;
                                                    const itemFieldStyles =
                                                      (item.fieldStyles || {}) as Record<
                                                        string,
                                                        import("../../lib/landing-types").LandingFieldStyle
                                                      >;

                                                    const renderFieldWithStyles = (
                                                      fieldLabel: string,
                                                      fieldName: string,
                                                      control: React.ReactNode
                                                    ) => {
                                                      const isThisFieldActive =
                                                        isActive &&
                                                        active?.fieldName === fieldName;
                                                      const rawFieldStyle = itemFieldStyles[fieldName] || {};
                                                      let currentFieldStyle: any = {};
                                                      if (rawFieldStyle) {
                                                        if ((rawFieldStyle as any).desktop === undefined && (rawFieldStyle as any).mobile === undefined) {
                                                          currentFieldStyle = rawFieldStyle;
                                                        } else {
                                                          currentFieldStyle = (rawFieldStyle as any)[previewDevice] || (rawFieldStyle as any).desktop || {};
                                                        }
                                                      }

                                                      return (
                                                        <div className="space-y-1">
                                                          <div className="flex items-center justify-between gap-2">
                                                            <div className="flex-1 flex flex-col gap-1">
                                                              {control}
                                                            </div>
                                                            <button
                                                              type="button"
                                                              className={`ml-2 px-2 py-1 rounded border text-[11px] flex items-center gap-1 ${
                                                                isThisFieldActive
                                                                  ? "bg-purple-600 text-white border-purple-600"
                                                                  : "bg-slate-50 text-slate-600 border-slate-200"
                                                              }`}
                                                              onClick={() =>
                                                                setActiveHeroItemFieldStyles(
                                                                  (prev) => ({
                                                                    ...prev,
                                                                    [section.id]:
                                                                      prev[section.id] &&
                                                                      prev[section.id]?.index ===
                                                                        itemIndex &&
                                                                      prev[section.id]?.fieldName ===
                                                                        fieldName
                                                                        ? null
                                                                        : {
                                                                            index: itemIndex,
                                                                            fieldName,
                                                                          },
                                                                  })
                                                                )
                                                              }
                                                            >
                                                              <span className="material-icons-round text-[14px]">
                                                                format_paint
                                                              </span>
                                                              Estilos
                                                            </button>
                                                          </div>
                                                          {isThisFieldActive && (
                                                            <div className="mt-1 p-2 rounded border border-slate-200 bg-slate-50 flex flex-wrap items-center gap-2 text-[11px]">
                                                              <div className="flex items-center gap-1">
                                                                <span className="text-slate-600">
                                                                  Color
                                                                </span>
                                                                <input
                                                                  type="color"
                                                                  className="h-6 w-8 border rounded"
                                                                  value={
                                                                    currentFieldStyle.color ||
                                                                    "#000000"
                                                                  }
                                                                  onChange={(e) =>
                                                                    handleHeroItemFieldStyleChange(
                                                                      idx,
                                                                      itemIndex,
                                                                      fieldName,
                                                                      "color",
                                                                      e.target.value
                                                                    )
                                                                  }
                                                                />
                                                              </div>
                                                              <button
                                                                type="button"
                                                                className={`px-2 py-1 rounded border flex items-center gap-1 ${
                                                                  currentFieldStyle.fontWeight ===
                                                                  "bold"
                                                                    ? "bg-slate-800 text-white border-slate-800"
                                                                    : "bg-white text-slate-700 border-slate-300"
                                                                }`}
                                                                onClick={() =>
                                                                  handleHeroItemFieldStyleChange(
                                                                    idx,
                                                                    itemIndex,
                                                                    fieldName,
                                                                    "fontWeight",
                                                                    currentFieldStyle.fontWeight ===
                                                                      "bold"
                                                                      ? "normal"
                                                                      : "bold"
                                                                  )
                                                                }
                                                              >
                                                                <span className="material-icons-round text-[14px]">
                                                                  format_bold
                                                                </span>
                                                              </button>
                                                              <button
                                                                type="button"
                                                                className={`px-2 py-1 rounded border flex items-center gap-1 ${
                                                                  currentFieldStyle.fontStyle ===
                                                                  "italic"
                                                                    ? "bg-slate-800 text-white border-slate-800"
                                                                    : "bg-white text-slate-700 border-slate-300"
                                                                }`}
                                                                onClick={() =>
                                                                  handleHeroItemFieldStyleChange(
                                                                    idx,
                                                                    itemIndex,
                                                                    fieldName,
                                                                    "fontStyle",
                                                                    currentFieldStyle.fontStyle ===
                                                                      "italic"
                                                                      ? "normal"
                                                                      : "italic"
                                                                  )
                                                                }
                                                              >
                                                                <span className="material-icons-round text-[14px]">
                                                                  format_italic
                                                                </span>
                                                              </button>
                                                              <button
                                                                type="button"
                                                                className={`px-2 py-1 rounded border flex items-center gap-1 ${
                                                                  currentFieldStyle.textDecoration ===
                                                                  "underline"
                                                                    ? "bg-slate-800 text-white border-slate-800"
                                                                    : "bg-white text-slate-700 border-slate-300"
                                                                }`}
                                                                onClick={() =>
                                                                  handleHeroItemFieldStyleChange(
                                                                    idx,
                                                                    itemIndex,
                                                                    fieldName,
                                                                    "textDecoration",
                                                                    currentFieldStyle.textDecoration ===
                                                                      "underline"
                                                                      ? "none"
                                                                      : "underline"
                                                                  )
                                                                }
                                                              >
                                                                <span className="material-icons-round text-[14px]">
                                                                  format_underlined
                                                                </span>
                                                              </button>
                                                              <div className="flex items-center gap-1">
                                                                <span className="text-slate-600">
                                                                  Tama+�o
                                                                </span>
                                                                <input
                                                                  type="text"
                                                                  className="w-16 border rounded px-1 py-0.5 text-[11px]"
                                                                  placeholder="16px"
                                                                  value={
                                                                    currentFieldStyle.fontSize ||
                                                                    ""
                                                                  }
                                                                  onChange={(e) =>
                                                                    handleHeroItemFieldStyleChange(
                                                                      idx,
                                                                      itemIndex,
                                                                      fieldName,
                                                                      "fontSize",
                                                                      e.target.value
                                                                    )
                                                                  }
                                                                />
                                                              </div>
                                                              {(fieldName === "badge" ||
                                                                fieldName ===
                                                                  "buttonText") && (
                                                                <>
                                                                  <div className="flex items-center gap-1">
                                                                    <span className="text-slate-600">Fondo contenedor</span>
                                                                    <input
                                                                      type="color"
                                                                      className="h-6 w-8 border rounded"
                                                                      value={
                                                                        currentFieldStyle.backgroundColor ||
                                                                        "#000000"
                                                                      }
                                                                      onChange={(e) =>
                                                                        handleHeroItemFieldStyleChange(
                                                                          idx,
                                                                          itemIndex,
                                                                          fieldName,
                                                                          "backgroundColor",
                                                                          e.target.value
                                                                        )
                                                                      }
                                                                    />
                                                                  </div>
                                                                  <div className="flex items-center gap-1">
                                                                    <span className="text-slate-600">Border radius</span>
                                                                    <input
                                                                      type="text"
                                                                      className="w-20 border rounded px-1 py-0.5 text-[11px]"
                                                                      placeholder="9999px"
                                                                      value={
                                                                        currentFieldStyle.borderRadius ||
                                                                        ""
                                                                      }
                                                                      onChange={(e) =>
                                                                        handleHeroItemFieldStyleChange(
                                                                          idx,
                                                                          itemIndex,
                                                                          fieldName,
                                                                          "borderRadius",
                                                                          e.target.value
                                                                        )
                                                                      }
                                                                    />
                                                                  </div>
                                                                  <div className="flex items-center gap-1">
                                                                    <span className="text-slate-600">Padding X</span>
                                                                    <input
                                                                      type="text"
                                                                      className="w-16 border rounded px-1 py-0.5 text-[11px]"
                                                                      placeholder="12px"
                                                                      value={
                                                                        currentFieldStyle.paddingInline ||
                                                                        ""
                                                                      }
                                                                      onChange={(e) =>
                                                                        handleHeroItemFieldStyleChange(
                                                                          idx,
                                                                          itemIndex,
                                                                          fieldName,
                                                                          "paddingInline",
                                                                          e.target.value
                                                                        )
                                                                      }
                                                                    />
                                                                    <span className="text-slate-600">Y</span>
                                                                    <input
                                                                      type="text"
                                                                      className="w-16 border rounded px-1 py-0.5 text-[11px]"
                                                                      placeholder="6px"
                                                                      value={
                                                                        currentFieldStyle.paddingBlock ||
                                                                        ""
                                                                      }
                                                                      onChange={(e) =>
                                                                        handleHeroItemFieldStyleChange(
                                                                          idx,
                                                                          itemIndex,
                                                                          fieldName,
                                                                          "paddingBlock",
                                                                          e.target.value
                                                                        )
                                                                      }
                                                                    />
                                                                  </div>
                                                                </>
                                                              )}
                                                            </div>
                                                          )}
                                                        </div>
                                                      );
                                                    };

                                                    return (
                                                      <>
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                          <button
                                                            type="button"
                                                            className="text-[11px] font-semibold text-slate-500 text-left"
                                                            onClick={() =>
                                                              setActiveHeroIndex((prev) => {
                                                                const cur = prev[section.id];
                                                                const copy = { ...prev };
                                                                if (cur === itemIndex) {
                                                                  // deselect
                                                                  delete copy[section.id];
                                                                  return copy;
                                                                }
                                                                return { ...prev, [section.id]: itemIndex };
                                                              })
                                                            }
                                                          >
                                                            Hero único
                                                          </button>
                                                          {heroItems.length > 1 && (
                                                            <button
                                                              type="button"
                                                              className="text-[10px] px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700"
                                                              onClick={() =>
                                                                handleRemoveHeroItem(
                                                                  idx,
                                                                  itemIndex
                                                                )
                                                              }
                                                            >
                                                              Quitar
                                                            </button>
                                                          )}
                                                        </div>
                                                        {renderFieldWithStyles(
                                                          "T+�tulo",
                                                          "title",
                                                          <input
                                                            type="text"
                                                            className="border rounded px-2 py-1 text-xs"
                                                            placeholder="T+�tulo"
                                                            value={item.title || ""}
                                                            onChange={(e) =>
                                                              handleHeroItemFieldChange(
                                                                idx,
                                                                itemIndex,
                                                                "title",
                                                                e.target.value
                                                              )
                                                            }
                                                          />
                                                        )}
                                                        {renderFieldWithStyles(
                                                          "Subt+�tulo",
                                                          "subtitle",
                                                          <textarea
                                                            className="border rounded px-2 py-1 text-xs resize-none h-16"
                                                            placeholder="Subt+�tulo"
                                                            value={item.subtitle || ""}
                                                            onChange={(e) =>
                                                              handleHeroItemFieldChange(
                                                                idx,
                                                                itemIndex,
                                                                "subtitle",
                                                                e.target.value
                                                              )
                                                            }
                                                          />
                                                        )}
                                                        {renderFieldWithStyles(
                                                          "Badge",
                                                          "badge",
                                                          <input
                                                            type="text"
                                                            className="border rounded px-2 py-1 text-xs"
                                                            placeholder="Badge (opcional)"
                                                            value={item.badge || ""}
                                                            onChange={(e) =>
                                                              handleHeroItemFieldChange(
                                                                idx,
                                                                itemIndex,
                                                                "badge",
                                                                e.target.value
                                                              )
                                                            }
                                                          />
                                                        )}
                                                        {renderFieldWithStyles(
                                                          "Texto del bot+�n",
                                                          "buttonText",
                                                          <div className="flex gap-2">
                                                            <input
                                                              type="text"
                                                              className="flex-1 border rounded px-2 py-1 text-xs"
                                                              placeholder="Texto del bot+�n"
                                                              value={item.buttonText || ""}
                                                              onChange={(e) =>
                                                                handleHeroItemFieldChange(
                                                                  idx,
                                                                  itemIndex,
                                                                  "buttonText",
                                                                  e.target.value
                                                                )
                                                              }
                                                            />
                                                            <input
                                                              type="text"
                                                              className="flex-1 border rounded px-2 py-1 text-xs"
                                                              placeholder="Enlace del bot+�n"
                                                              value={item.buttonLink || ""}
                                                              onChange={(e) =>
                                                                handleHeroItemFieldChange(
                                                                  idx,
                                                                  itemIndex,
                                                                  "buttonLink",
                                                                  e.target.value
                                                                )
                                                              }
                                                            />
                                                          </div>
                                                        )}
                                                      </>
                                                    );
                                                  })()}
                                                  <div className="space-y-2 mt-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                      <p className="text-[11px] text-slate-500">
                                                        {(() => {
                                                          const currentGallery = Array.isArray(item.images) && item.images.length
                                                            ? item.images.filter(Boolean)
                                                            : item.image
                                                              ? [item.image]
                                                              : [];
                                                          return currentGallery.length > 0
                                                            ? "Si agregas más de un recurso, solo se admitirán imágenes."
                                                            : "Sube una foto o un video para esta sección.";
                                                        })()}
                                                      </p>
                                                      <input
                                                        type="file"
                                                        accept={(() => {
                                                          const currentGallery = Array.isArray(item.images) && item.images.length
                                                            ? item.images.filter(Boolean)
                                                            : item.image
                                                              ? [item.image]
                                                              : [];
                                                          return currentGallery.length > 0 ? "image/*" : "image/*,video/*";
                                                        })()}
                                                        className="text-[11px]"
                                                        onChange={(e) =>
                                                          handleHeroItemImage(
                                                            e,
                                                            idx,
                                                            itemIndex
                                                          )
                                                        }
                                                      />
                                                    </div>

                                                    {(() => {
                                                      const gallery = Array.isArray(item.images) && item.images.length
                                                        ? item.images.filter(Boolean)
                                                        : item.image
                                                          ? [item.image]
                                                          : [];

                                                      if (!gallery.length && !item.videoUrl) {
                                                        return (
                                                          <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center text-[11px] text-slate-500">
                                                            Aún no hay imágenes.
                                                          </div>
                                                        );
                                                      }

                                                      if (item.videoUrl && !gallery.length) {
                                                        return (
                                                          <div className="space-y-2">
                                                            <div className="aspect-video rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                              <video
                                                                className="w-full h-full object-cover"
                                                                autoPlay
                                                                muted
                                                                loop
                                                                playsInline
                                                              >
                                                                <source src={item.videoUrl} type="video/mp4" />
                                                              </video>
                                                            </div>
                                                            <button
                                                              type="button"
                                                              className="text-[10px] px-2 py-0.5 rounded bg-red-600 text-white hover:bg-red-700"
                                                              onClick={() =>
                                                                handleHeroItemClearMedia(
                                                                  idx,
                                                                  itemIndex
                                                                )
                                                              }
                                                            >
                                                              Quitar video
                                                            </button>
                                                          </div>
                                                        );
                                                      }

                                                      return (
                                                        <div className="grid grid-cols-2 gap-2">
                                                          {gallery.map((src, imageIndex) => (
                                                            <div key={`${src}-${imageIndex}`} className="relative aspect-video rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                              <img
                                                                src={src}
                                                                alt={`${item.title || "Hero"} ${imageIndex + 1}`}
                                                                className="w-full h-full object-cover"
                                                              />
                                                              <button
                                                                type="button"
                                                                className="absolute top-2 right-2 rounded-full bg-black/70 text-white px-2 py-1 text-[10px]"
                                                                onClick={() =>
                                                                  handleHeroItemRemoveImage(
                                                                    idx,
                                                                    itemIndex,
                                                                    src
                                                                  )
                                                                }
                                                              >
                                                                Quitar
                                                              </button>
                                                            </div>
                                                          ))}
                                                        </div>
                                                      );
                                                    })()}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                            <div className="mt-2 text-[11px] text-slate-500">
                                              El hero ya no crea variantes nuevas.
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  )}

                                {/* Estilos */}
                                {styleFields.length > 0 &&
                                  currentTab === "styles" && (
                                  <div className="space-y-2 border-t border-slate-200 pt-3 mt-2">
                                    <h4 className="text-xs font-semibold uppercase text-slate-500 flex items-center gap-1">
                                      <span className="material-icons-round text-[14px] text-purple-500">
                                        tune
                                      </span>
                                      Estilos
                                    </h4>
                                    {styleFields.map((field: any) => {
                                      const value = (styles as any)[field.name] ?? "";
                                      if (field.type === "color") {
                                        return (
                                          <div
                                            key={field.name}
                                            className="flex items-center gap-2"
                                          >
                                            <label className="text-xs text-slate-600 w-32">
                                              {field.label}
                                            </label>
                                            <input
                                              type="color"
                                              className="h-8 w-10 border rounded"
                                              value={value || "#000000"}
                                              onChange={(e) =>
                                                handleSectionStyleChange(
                                                  idx,
                                                  field.name,
                                                  e.target.value
                                                )
                                              }
                                            />
                                          </div>
                                        );
                                      }
                                      if (
                                        field.type === "text" ||
                                        field.type === "number"
                                      ) {
                                        return (
                                          <div
                                            key={field.name}
                                            className="flex items-center gap-2"
                                          >
                                            <label className="text-xs text-slate-600 w-32">
                                              {field.label}
                                            </label>
                                            <input
                                              className="flex-1 border p-2 text-sm rounded"
                                              placeholder={field.label}
                                              value={value}
                                              onChange={(e) =>
                                                handleSectionStyleChange(
                                                  idx,
                                                  field.name,
                                                  e.target.value
                                                )
                                              }
                                            />
                                          </div>
                                        );
                                      }
                                      return null;
                                    })}
                                  </div>
                                )}

                                {/* Avanzado (placeholder por ahora) */}
                                {currentTab === "advanced" && (
                                  <div className="pt-2 border-t border-dashed border-slate-200 text-[11px] text-slate-500">
                                    Pr+�ximamente: reglas de visibilidad por
                                    dispositivo, animaciones, etc.
                                  </div>
                                )}

                                {/* Posiciones (para hero y banner) */}
                                {currentTab === "positioning" && (section.type === "hero" || section.type === "banner") && (
                                  <div className="space-y-3 -mx-4 -my-2">
                                    <div className="text-xs text-slate-600 dark:text-slate-300 mb-2 px-4 pt-3">
                                      Arrastra y redimensiona los elementos para posicionarlos. Las posiciones se aplican de forma independiente en desktop y mobile.
                                    </div>

                                    {/* Selector de device */}
                                    <div className="flex gap-2 px-4">
                                      <button
                                        type="button"
                                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                                          previewDevice === "desktop"
                                            ? "bg-purple-100 text-purple-700 border-purple-300 shadow-sm"
                                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                        }`}
                                        onClick={() => setPreviewDevice("desktop")}
                                      >
                                        <span className="material-icons-round inline text-[14px] mr-1">laptop_windows</span>
                                        Desktop
                                      </button>
                                      <button
                                        type="button"
                                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                                          previewDevice === "mobile"
                                            ? "bg-purple-100 text-purple-700 border-purple-300 shadow-sm"
                                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                                        }`}
                                        onClick={() => setPreviewDevice("mobile")}
                                      >
                                        <span className="material-icons-round inline text-[14px] mr-1">smartphone</span>
                                        Mobile
                                      </button>
                                    </div>

                                    {/* DraggablePreviewEditor - con padding para scrollear si es muy grande */}
                                    <div className="bg-linear-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-6 px-4 overflow-x-auto min-h-fit">
                                      {(() => {
                                        const heroItems = (section.props?.items as any[]) || [];
                                        const activeIdx = getResolvedHeroIndex(section.id, heroItems.length);
                                        const positionsToPass =
                                          section.type === "hero"
                                            ? typeof activeIdx === "number"
                                              ? heroItems[activeIdx]?.fieldPositions || {}
                                              : (section.fieldPositions || {})
                                            : (section.fieldPositions || {});

                                        return (
                                          <DraggablePreviewEditor
                                            key={`${section.id}-${String(activeIdx)}-${previewDevice}`}
                                            sectionType={section.type as "hero" | "banner"}
                                            device={previewDevice}
                                            positions={positionsToPass}
                                            values={
                                              section.type === "hero"
                                                ? buildHeroPositioningValues(section, activeIdx)
                                                : ((section.props as any) || {})
                                            }
                                            onPositionChange={createPositionChangeHandler(
                                              idx,
                                              section.type === "hero" && typeof activeIdx === "number" ? activeIdx : undefined
                                            )}
                                            image={(section.props as any)?.image || (section.props as any)?.backgroundImage}
                                          />
                                        );
                                      })()}
                                    </div>

                                    {/* Bot+�n guardar posiciones */}
                                    <button
                                      type="button"
                                      className="w-full mx-4 px-3 py-2 rounded bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors"
                                      onClick={async () => {
                                        setSaving(true);
                                        await saveLandingSections(sections);
                                        setSaving(false);
                                      }}
                                      disabled={saving}
                                    >
                                      {saving ? "Guardando..." : "Guardar posiciones"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {/* Remove button always shown */}
                          <button
                            onClick={() => removeSection(section.id)}
                            className="mt-2 text-red-600"
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </Draggable>
                  );
                  })}

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <div className="flex gap-4 mt-6">
            <button
              onClick={() => openAddModal(null)}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Agregar secci+�n
            </button>
            <button
              onClick={async () => {
                setSaving(true);
                // Guardar secciones (borrador)
                await saveLandingSections(sections);
                setSaving(false);
                alert("Secciones guardadas como borrador");
              }}
              className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-60"
              disabled={saving}
            >
              {saving ? (
                <span className="animate-spin material-icons-round">
                  autorenew
                </span>
              ) : (
                <span className="material-icons-round">save</span>
              )}
              Guardar
            </button>
            <button
              onClick={async () => {
                setSaving(true);
                await publishLanding();
                setSaving(false);
                alert("Landing publicada (hero y secciones)");
              }}
              className="bg-purple-700 text-white px-4 py-2 rounded flex items-center gap-2 disabled:opacity-60"
              disabled={saving}
            >
              <span className="material-icons-round">rocket_launch</span>
              Publicar landing
            </button>
          </div>
        </div>

        {/* Columna derecha: vista previa en vivo */}
        <div className="bg-white dark:bg-slate-950 rounded-lg shadow p-4 border border-slate-200 dark:border-slate-800 overflow-auto max-h-[calc(100vh-8rem)]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <button
                type="button"
                className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200 transition"
                onClick={() => setShowPreviewModal(true)}
                title="Abrir vista previa en ventana grande"
              >
                <span className="material-icons-round text-[18px]">
                  visibility
                </span>
              </button>
              Vista previa en vivo
            </h2>
            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1 py-0.5 text-xs">
              <button
                type="button"
                className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                  previewDevice === "desktop"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500"
                }`}
                onClick={() => setPreviewDevice("desktop")}
              >
                <span className="material-icons-round text-[16px]">
                  laptop_windows
                </span>
                Laptop
              </button>
              <button
                type="button"
                className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                  previewDevice === "mobile"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500"
                }`}
                onClick={() => setPreviewDevice("mobile")}
              >
                <span className="material-icons-round text-[16px]">
                  smartphone
                </span>
                M+�vil
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-500 mb-3">
            Para ver exactamente lo que se vera en la pagina principal, da click en el icono del ojo
          </p>
          <div className="flex justify-center">
            <div
              key={previewDevice}
              className={
                previewDevice === "mobile"
                  ? "w-97.5 max-w-full border border-slate-300 dark:border-slate-700 rounded-[2.5rem] p-4 bg-slate-100 dark:bg-slate-900 shadow-inner"
                  : "w-full max-w-5xl border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-100 dark:bg-slate-900 shadow-inner"
              }
            >
              <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white min-h-full flex flex-col mt-2">
                <main className="flex-1 pb-24 lg:pb-0">
                  {hero && (
                    <SectionRenderer
                      section={{
                        id: "hero-preview",
                        type: "hero",
                        ...buildHeroPreviewProps({ id: "hero-preview", props: hero, fieldPositions: (hero as any).fieldPositions || {}, fieldStyles: (hero as any).fieldStyles || {} }, previewDevice),
                        styles: {},
                        order: 0,
                        hidden: false,
                      }}
                    />
                  )}

                  {sections
                    .slice()
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((section) => {
                      // Build preview section; aplanar fieldStyles responsive
                      let previewSection = { ...section } as any;
                      const featuredCategoryItemsFromProducts = featuredProducts
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

                      if (section.type === "featuredProducts") {
                        previewSection.props = { ...(section.props || {}), products: featuredProducts, device: previewDevice };
                      } else if (section.type === "featuredCategories") {
                        const currentItems = Array.isArray((section.props as any)?.items)
                          ? (section.props as any).items
                          : [];
                        previewSection.props = {
                          ...(section.props || {}),
                          items: currentItems.length > 0 ? currentItems : featuredCategoryItemsFromProducts,
                          device: previewDevice,
                        };
                      } else if (section.type === "hero") {
                        const normalized = buildHeroPreviewProps(section, previewDevice);
                        previewSection.props = normalized.props;
                        previewSection.fieldPositions = normalized.fieldPositions;
                        previewSection.fieldStyles = normalized.fieldStyles;
                      } else {
                        previewSection.props = { ...(section.props || {}), device: previewDevice };
                      }
                      // Aplanar fieldStyles responsive para la preview
                      if (previewSection.fieldStyles) {
                        previewSection.fieldStyles = Object.fromEntries(
                          Object.entries(previewSection.fieldStyles).map(([k, v]) => {
                            // Detectar si hay estructura responsive (desktop o mobile definidos)
                            const hasResponsiveStructure = v && ((v as any).desktop !== undefined || (v as any).mobile !== undefined);
                            if (hasResponsiveStructure) {
                              return [k, (v as any)[previewDevice] || (v as any).desktop || {}];
                            }
                            
                            return [k, v || {}];
                          })
                        );
                      }
                      return <SectionRenderer key={section.id} section={previewSection} />;
                    })}
                      {/* Bot+�n para abrir modal de selecci+�n de comentarios Google Maps */}
                      <div className="my-6">
                        <button
                          className="bg-blue-600 text-white px-4 py-2 rounded"
                          onClick={openGoogleCommentsModal}
                        >
                          Seleccionar comentarios de Google Maps
                        </button>
                      </div>
                </main>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 dark:text-white p-6 rounded w-96">
            <h2 className="font-bold mb-4">Selecciona tipo de secci+�n</h2>
            {AVAILABLE_SECTION_TYPES.map((type) => {
              const schema = sectionSchemas[type];

              return (
              <button
                key={schema.type}
                onClick={() => handleAddSectionType(schema.type)}
                className="block w-full text-left p-2 border mb-2"
              >
                {schema.label}
              </button>
              );
            })}
            <button
              onClick={closeAddModal}
              className="mt-4 w-full border p-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-2">
          <div className="relative max-h-[95vh] w-full flex items-center justify-center">
            <button
              type="button"
              className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-white/90 text-slate-800 shadow hover:bg-white"
              onClick={() => setShowPreviewModal(false)}
              aria-label="Cerrar vista previa"
            >
              <span className="material-icons-round">close</span>
            </button>

            <div
              key={previewDevice + "-modal"}
              className={
                previewDevice === "mobile"
                  ? "w-103.5 max-w-full max-h-[85vh] overflow-y-auto rounded-4xl border border-slate-300 bg-slate-100 dark:bg-slate-900 shadow-xl"
                  : "w-full max-w-6xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-300 bg-slate-50 dark:bg-slate-900 shadow-xl"
              }
            >
              <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white min-h-full">
                  <main className="flex-1 pb-24 lg:pb-0 mt-2">
                    {hero && (
                      <SectionRenderer
                        section={{
                          id: "hero-preview-modal",
                          type: "hero",
                          props: {
                            title: hero.title,
                            subtitle: hero.subtitle,
                            badge: (hero as any).badge,
                            buttonText: hero.buttonText,
                            buttonLink: hero.buttonLink,
                              image: hero.image,
                              images: (hero as any).images,
                              device: previewDevice,
                          },
                            fieldPositions: (hero as any).fieldPositions || {},
                            styles: {},
                          order: 0,
                          hidden: false,
                        }}
                      />
                    )}

                    {sections
                      .slice()
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                      .map((section) => {
                        let previewSection = { ...section } as any;
                        if (section.type === "featuredProducts") {
                          previewSection.props = { ...(section.props || {}), products: featuredProducts, device: previewDevice };
                        } else if (section.type === "featuredCategories") {
                          previewSection.props = { ...(section.props || {}), device: previewDevice };
                        } else if (section.type === "hero") {
                            const normalized = buildHeroPreviewProps(section, previewDevice);
                            previewSection.props = normalized.props;
                            previewSection.fieldPositions = normalized.fieldPositions;
                            previewSection.fieldStyles = normalized.fieldStyles;
                        } else {
                          previewSection.props = { ...(section.props || {}), device: previewDevice };
                        }

                        // debug logs removed

                        return <SectionRenderer key={section.id} section={previewSection} />;
                      })}
                  </main>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
