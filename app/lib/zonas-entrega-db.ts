import { db } from "./firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";

const CITIES_COLLECTION = "ciudadesEntrega";
const SETTINGS_DOCUMENT = ["configuracion", "entrega"] as const;

export interface ZonaEntrega {
  id: string;
  nombre: string;
  precio?: number;
}

export interface CiudadEntrega {
  id: string;
  nombre: string;
  precio: number;
  zonas: ZonaEntrega[];
}

export interface ConfiguracionEntrega {
  montoMinimoGratis: number;
}

const DEFAULT_SETTINGS: ConfiguracionEntrega = { montoMinimoGratis: 25 };

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `ciudad-${Date.now()}`;
}

export async function obtenerConfiguracionEntrega(): Promise<ConfiguracionEntrega> {
  const snapshot = await getDoc(doc(db, ...SETTINGS_DOCUMENT));
  return {
    ...DEFAULT_SETTINGS,
    ...(snapshot.exists() ? snapshot.data() : {}),
  } as ConfiguracionEntrega;
}

export async function guardarConfiguracionEntrega(configuracion: ConfiguracionEntrega) {
  await setDoc(doc(db, ...SETTINGS_DOCUMENT), {
    montoMinimoGratis: Math.max(0, Number(configuracion.montoMinimoGratis) || 0),
  }, { merge: true });
}

export async function obtenerCiudadesEntrega(): Promise<CiudadEntrega[]> {
  const snapshot = await getDocs(collection(db, CITIES_COLLECTION));
  return snapshot.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        nombre: String(data.nombre || "Ciudad sin nombre"),
        precio: Number(data.precio ?? 0),
        zonas: Array.isArray(data.zonas)
          ? data.zonas.map((zona: ZonaEntrega) => ({
              id: zona.id,
              nombre: String(zona.nombre || "Zona sin nombre"),
              ...(zona.precio === undefined ? {} : { precio: Number(zona.precio) || 0 }),
            }))
          : [],
      } as CiudadEntrega;
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function guardarCiudadEntrega(ciudad: Omit<CiudadEntrega, "id">, id?: string) {
  const cityId = id || slugify(ciudad.nombre);
  await setDoc(doc(db, CITIES_COLLECTION, cityId), {
    nombre: ciudad.nombre.trim(),
    precio: Math.max(0, Number(ciudad.precio) || 0),
    zonas: ciudad.zonas.map((zona) => {
      const savedZone: ZonaEntrega = {
        id: zona.id || slugify(zona.nombre),
        nombre: zona.nombre.trim(),
      };
      if (zona.precio !== undefined) savedZone.precio = Math.max(0, Number(zona.precio) || 0);
      return savedZone;
    }),
  });
  return cityId;
}

export async function eliminarCiudadEntrega(id: string) {
  await deleteDoc(doc(db, CITIES_COLLECTION, id));
}

export async function guardarZonaEntrega(cityId: string, zona: ZonaEntrega) {
  const cityRef = doc(db, CITIES_COLLECTION, cityId);
  const snapshot = await getDoc(cityRef);
  if (!snapshot.exists()) throw new Error("La ciudad no existe");
  const ciudad = snapshot.data() as Omit<CiudadEntrega, "id">;
  const zonas = Array.isArray(ciudad.zonas) ? ciudad.zonas : [];
  const nextZona: ZonaEntrega = {
    id: zona.id || slugify(zona.nombre),
    nombre: zona.nombre.trim(),
  };
  if (zona.precio !== undefined) nextZona.precio = Math.max(0, Number(zona.precio) || 0);
  const index = zonas.findIndex((item) => item.id === nextZona.id);
  if (index >= 0) zonas[index] = nextZona;
  else zonas.push(nextZona);
  await setDoc(cityRef, { zonas }, { merge: true });
}

export async function eliminarZonaEntrega(cityId: string, zonaId: string) {
  const cityRef = doc(db, CITIES_COLLECTION, cityId);
  const snapshot = await getDoc(cityRef);
  if (!snapshot.exists()) return;
  const ciudad = snapshot.data() as Omit<CiudadEntrega, "id">;
  await setDoc(cityRef, {
    zonas: (ciudad.zonas || []).filter((zona: ZonaEntrega) => zona.id !== zonaId),
  }, { merge: true });
}
