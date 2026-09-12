import { db, storage } from "./firebase";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
  collection,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

// Estructura por defecto de la landing page
export const DEFAULT_LANDING = {
  hero: {
    title: "Bienvenido a Marca Estilo",
    subtitle: "Camisetas exclusivas para marcar tu estilo",
    image: null,
    buttonText: "Explorar productos",
    buttonLink: "/tienda"
  },
  featuredProducts: [],
  categories: [], // NUEVO: categorías principales
  benefits: [
    {
      icon: "local_shipping",
      title: "Envíos rápidos",
      description: "Recibe tus productos en tiempo récord."
    },
    {
      icon: "verified",
      title: "Garantía de calidad",
      description: "Solo productos originales y garantizados."
    },
    {
      icon: "support_agent",
      title: "Soporte experto",
      description: "Atención personalizada para tu negocio."
    }
  ],
  testimonials: [], // NUEVO: testimonios de clientes
  brands: [], // NUEVO: marcas asociadas
  sections: [],
  updatedAt: Timestamp.now()
};
/**
 * Obtiene la landing en modo "draft" o "published".
 * 
 * - Hero y featuredProducts se resuelven desde heroDraft/heroPublished o los
 *   campos legacy hero/featuredProducts.
 * - Las secciones se leen desde las subcolecciones sectionsDraft/sectionsPublished
 *   y, si no hay datos, se hace fallback al array legacy sections.
 */
const getLandingByVersion = async (version: "draft" | "published") => {
  try {
    const landingRef = doc(db, "landingPage", "main");
    const landingSnap = await getDoc(landingRef);

    let base: any | null = null;
    if (landingSnap.exists()) {
      base = landingSnap.data();
    } else {
      await initializeLandingPage();
      base = DEFAULT_LANDING;
    }

    // Hero draft/published con fallback al legacy hero
    const heroKey = version === "draft" ? "heroDraft" : "heroPublished";
    let hero: any = base[heroKey] || base.hero || null;

    // En el editor (draft) no queremos que aparezca el hero
    // por defecto "Bienvenido a Marca Estilo" como si fuera
    // una sección creada por el usuario. Si no hay heroDraft
    // y el hero almacenado coincide con el DEFAULT_LANDING.hero,
    // devolvemos null para que el preview no lo pinte.
    if (version === "draft" && !base[heroKey] && base.hero) {
      const isDefaultHero =
        base.hero.title === DEFAULT_LANDING.hero.title &&
        base.hero.subtitle === DEFAULT_LANDING.hero.subtitle &&
        base.hero.buttonText === DEFAULT_LANDING.hero.buttonText &&
        base.hero.buttonLink === DEFAULT_LANDING.hero.buttonLink;
      if (isDefaultHero) {
        hero = null;
      }
    }

    if (
      version === "published" &&
      hero &&
      hero.title === DEFAULT_LANDING.hero.title &&
      hero.subtitle === DEFAULT_LANDING.hero.subtitle &&
      hero.buttonText === DEFAULT_LANDING.hero.buttonText &&
      hero.buttonLink === DEFAULT_LANDING.hero.buttonLink &&
      !base.heroPublished
    ) {
      hero = null;
    }

    // Productos destacados draft/published con fallback
    const featuredKey =
      version === "draft"
        ? "featuredProductsDraft"
        : "featuredProductsPublished";
    const featuredProducts =
      base[featuredKey] ||
      base.featuredProducts ||
      [];

    // Secciones desde subcolección + fallback al array legacy
    let sections: any[] = [];
    try {
      const colName =
        version === "draft" ? "sectionsDraft" : "sectionsPublished";
      const sectionsCol = collection(landingRef, colName);
      const snap = await getDocs(sectionsCol);
      if (!snap.empty) {
        sections = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      console.error("Error leyendo secciones de landing:", err);
    }

    if (!sections.length) {
      sections = base.sections || DEFAULT_LANDING.sections || [];
    }

    return {
      id: "main",
      hero,
      featuredProducts,
      categories: base.categories ?? DEFAULT_LANDING.categories,
      benefits: base.benefits ?? DEFAULT_LANDING.benefits,
      testimonials: base.testimonials ?? DEFAULT_LANDING.testimonials,
      brands: base.brands ?? DEFAULT_LANDING.brands,
      sections,
    };
  } catch (error) {
    console.error("Error obteniendo landing page:", error);
    return {
      id: "main",
      ...DEFAULT_LANDING,
    };
  }
};

// Landing publicada (uso público)
export const getLandingPage = async () => getLandingByVersion("published");

// Landing en borrador (uso editor admin)
export const getLandingDraft = async () => getLandingByVersion("draft");

export const initializeLandingPage = async () => {
  try {
    const landingRef = doc(db, "landingPage", "main");
    await setDoc(landingRef, DEFAULT_LANDING);
  } catch (error) {
  }
};
/**
 * Actualiza el HERO en draft (por defecto) o en published.
 */
export const updateHero = async (
  heroData: any,
  version: "draft" | "published" = "draft"
) => {
  try {
    const landingRef = doc(db, "landingPage", "main");
    const key = version === "draft" ? "heroDraft" : "heroPublished";
    await updateDoc(landingRef, {
      [key]: {
        title: heroData.title || "",
        subtitle: heroData.subtitle || "",
        buttonText: heroData.buttonText || "Explorar",
        buttonLink: heroData.buttonLink || "/",
        image: heroData.image || null,
        videoUrl: heroData.videoUrl || null,
        badge: heroData.badge || "",
      },
      updatedAt: Timestamp.now(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error actualizando hero:", error);
    throw error;
  }
};

export const uploadLandingImage = async (imageFile, type = "hero") => {
  try {
    const fileRef = ref(storage, `landing_page/${type}/${imageFile.name}`);
    await uploadBytes(fileRef, imageFile);
    const downloadURL = await getDownloadURL(fileRef);
    return downloadURL;
  } catch (error) {
    console.error("Error subiendo imagen de landing:", error);
    throw error;
  }
};

export const uploadLandingVideo = async (videoFile, type = "hero") => {
  try {
    const fileRef = ref(storage, `landing_page/${type}/${videoFile.name}`);
    await uploadBytes(fileRef, videoFile);
    const downloadURL = await getDownloadURL(fileRef);
    return downloadURL;
  } catch (error) {
    console.error("Error subiendo video de landing:", error);
    throw error;
  }
};
/**
 * Actualiza los productos destacados en draft (por defecto) o en published.
 */
export const updateFeaturedProducts = async (
  productIds: string[],
  version: "draft" | "published" = "draft"
) => {
  try {
    const landingRef = doc(db, "landingPage", "main");
    const key =
      version === "draft"
        ? "featuredProductsDraft"
        : "featuredProductsPublished";
    await updateDoc(landingRef, {
      [key]: productIds,
      updatedAt: Timestamp.now(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error actualizando productos destacados:", error);
    throw error;
  }
};

export const updateCategories = async (categoryIds) => {
  try {
    const landingRef = doc(db, "landingPage", "main");
    await updateDoc(landingRef, {
      categories: categoryIds,
      updatedAt: Timestamp.now()
    });
    return { success: true };
  } catch (error) {
    console.error("Error actualizando categorías:", error);
    throw error;
  }
};

export const updateBenefits = async (benefits) => {
  try {
    const landingRef = doc(db, "landingPage", "main");
    await updateDoc(landingRef, {
      benefits,
      updatedAt: Timestamp.now()
    });
    return { success: true };
  } catch (error) {
    console.error("Error actualizando beneficios:", error);
    throw error;
  }
};

export const updateTestimonials = async (testimonials) => {
  try {
    const landingRef = doc(db, "landingPage", "main");
    await updateDoc(landingRef, {
      testimonials,
      updatedAt: Timestamp.now()
    });
    return { success: true };
  } catch (error) {
    console.error("Error actualizando testimonios:", error);
    throw error;
  }
};

export const updateBrands = async (brands) => {
  try {
    const landingRef = doc(db, "landingPage", "main");
    await updateDoc(landingRef, {
      brands,
      updatedAt: Timestamp.now()
    });
    return { success: true };
  } catch (error) {
    console.error("Error actualizando marcas:", error);
    throw error;
  }
};

export const addSection = async (sectionData) => {
  try {
    const landingRef = doc(db, "landingPage", "main");
    const landing = await getLandingPage();
    const newSection = {
      id: `section-${Date.now()}`,
      title: sectionData.title,
      content: sectionData.content,
      image: sectionData.image || null,
      order: landing.sections?.length + 1 || 1
    };
    const sections = landing.sections || [];
    sections.push(newSection);
    await updateDoc(landingRef, {
      sections: sections,
      updatedAt: Timestamp.now()
    });
    return newSection;
  } catch (error) {
    console.error("Error añadiendo sección:", error);
    throw error;
  }
};

export const updateSection = async (sectionId, sectionData) => {
  try {
    const landing = await getLandingPage();
    const landingRef = doc(db, "landingPage", "main");
    const sections = landing.sections || [];
    const sectionIndex = sections.findIndex(s => s.id === sectionId);
    if (sectionIndex !== -1) {
      sections[sectionIndex] = {
        ...sections[sectionIndex],
        ...sectionData,
        id: sectionId
      };
      await updateDoc(landingRef, {
        sections: sections,
        updatedAt: Timestamp.now()
      });
      return sections[sectionIndex];
    }
    throw new Error("Sección no encontrada");
  } catch (error) {
    console.error("Error actualizando sección:", error);
    throw error;
  }
};

export const deleteSection = async (sectionId) => {
  try {
    // Esta función queda para compatibilidad pero el editor actual
    // trabaja sobre subcolecciones vía saveLandingSections.
    const landing = await getLandingByVersion("draft");
    const filtered = landing.sections?.filter((s) => s.id !== sectionId) || [];
    await saveLandingSections(filtered);
    return { success: true, sections: filtered };
  } catch (error) {
    console.error("Error eliminando sección:", error);
    throw error;
  }
};
/**
 * Guarda TODAS las secciones en la subcolección correspondiente (draft o published).
 * Se reemplaza por completo el contenido de la subcolección.
 */
export const saveLandingSections = async (
  sections: any[],
  version: "draft" | "published" = "draft"
) => {
  try {
    const landingRef = doc(db, "landingPage", "main");
    const colName =
      version === "draft" ? "sectionsDraft" : "sectionsPublished";
    const sectionsCol = collection(landingRef, colName);

    const existingSnap = await getDocs(sectionsCol);
    const batch = writeBatch(db);

    // Borrar secciones actuales
    existingSnap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    // Insertar nuevas secciones
    sections.forEach((section) => {
      if (!section || !section.id) return;
      const docRef = doc(sectionsCol, section.id);
      batch.set(docRef, section);
    });

    batch.update(landingRef, {
      updatedAt: Timestamp.now(),
    });

    await batch.commit();
    return { success: true, sections };
  } catch (error) {
    console.error("Error guardando secciones:", error);
    throw error;
  }
};

/**
 * Carga solo las secciones de una versión concreta.
 */
export const getLandingSections = async (
  version: "draft" | "published" = "draft"
) => {
  try {
    const landing = await getLandingByVersion(version);
    return landing.sections || [];
  } catch (error) {
    console.error("Error cargando secciones:", error);
    return [];
  }
};

/**
 * Copia el estado de draft a published (hero, destacados y secciones).
 */
export const publishLanding = async () => {
  try {
    const landingRef = doc(db, "landingPage", "main");
    const draft = await getLandingByVersion("draft");

    // Hero y destacados publicados + legacy para compatibilidad
    const updatePayload: any = {
      heroPublished: draft.hero,
      featuredProductsPublished: draft.featuredProducts || [],
      hero: draft.hero,
      featuredProducts: draft.featuredProducts || [],
      updatedAt: Timestamp.now(),
    };

    const publishedCol = collection(landingRef, "sectionsPublished");
    const draftCol = collection(landingRef, "sectionsDraft");
    const [publishedSnap, draftSnap] = await Promise.all([
      getDocs(publishedCol),
      getDocs(draftCol),
    ]);

    const batch = writeBatch(db);

    // Borrar secciones publicadas actuales
    publishedSnap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    // Copiar secciones de draft a published y mantener array legacy "sections"
    const newSections: any[] = [];
    draftSnap.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() };
      const targetRef = doc(publishedCol, docSnap.id);
      batch.set(targetRef, data);
      newSections.push(data);
    });

    updatePayload.sections = newSections;

    batch.update(landingRef, updatePayload);

    await batch.commit();
    return { success: true };
  } catch (error) {
    throw error;
  }
};
