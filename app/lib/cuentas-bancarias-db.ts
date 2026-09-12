import { db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";

const COLLECTION = "cuentasBancarias";

export interface CuentaBancaria {
  id?: string;
  banco: string;
  tipo: string; // "ahorros" | "corriente"
  numeroCuenta: string;
  titular: string;
  cedula: string;
  nombreParaTransferencia: string;
  activa: boolean;
  createdAt?: any;
}

export async function obtenerCuentasBancarias(): Promise<CuentaBancaria[]> {
  const q = query(collection(db, COLLECTION), orderBy("banco"));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as CuentaBancaria));
}

export async function obtenerCuentasBancariasActivas(): Promise<CuentaBancaria[]> {
  const q = query(collection(db, COLLECTION), orderBy("banco"));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as CuentaBancaria))
    .filter((cuenta) => cuenta.activa !== false); // Solo cuentas activas
}

export async function obtenerCuentaBancariaPorId(id: string): Promise<CuentaBancaria | null> {
  const ref = doc(db, COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as CuentaBancaria;
}

export async function crearCuentaBancaria(cuenta: Omit<CuentaBancaria, "id" | "createdAt">): Promise<string> {
  const payload = {
    ...cuenta,
    activa: cuenta.activa !== false, // Por defecto activa
    createdAt: new Date(),
  };
  const docRef = await addDoc(collection(db, COLLECTION), payload);
  return docRef.id;
}

export async function actualizarCuentaBancaria(id: string, cuenta: Partial<CuentaBancaria>): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await updateDoc(ref, cuenta);
}

export async function eliminarCuentaBancaria(id: string): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await deleteDoc(ref);
}

export async function desactivarCuentaBancaria(id: string): Promise<void> {
  await actualizarCuentaBancaria(id, { activa: false });
}