// Este archivo ahora es un wrapper para las funciones de Firestore
// Mantenido por compatibilidad, pero las cuentas se gestionan en la base de datos
import { 
  obtenerCuentasBancarias as obtenerCuentasBancariasDB, 
  obtenerCuentasBancariasActivas as obtenerCuentasBancariasActivasDB,
  obtenerCuentaBancariaPorId as obtenerCuentaPorIdDB,
  crearCuentaBancaria as crearCuentaBancariaDB,
  actualizarCuentaBancaria as actualizarCuentaBancariaDB,
  eliminarCuentaBancaria as eliminarCuentaBancariaDB,
  desactivarCuentaBancaria as desactivarCuentaBancariaDB
} from "./cuentas-bancarias-db";

export interface CuentaBancaria {
  id?: string;
  banco: string;
  tipo: string; // "ahorros" | "corriente"
  numeroCuenta: string;
  titular: string;
  cedula: string;
  nombreParaTransferencia: string;
  activa?: boolean;
}

// Función para obtener todas las cuentas (incluyendo inactivas) - para admin
export async function obtenerCuentasBancarias(): Promise<CuentaBancaria[]> {
  return obtenerCuentasBancariasDB();
}

// Función para obtener solo cuentas activas - para carrito público
export async function obtenerCuentasBancariasActivas(): Promise<CuentaBancaria[]> {
  return obtenerCuentasBancariasActivasDB();
}

// Función para obtener cuenta por ID (desde Firestore)
export async function obtenerCuentaPorId(id: string): Promise<CuentaBancaria | undefined> {
  const cuenta = await obtenerCuentaPorIdDB(id);
  return cuenta || undefined;
}

// Funciones CRUD para cuentas bancarias
export async function crearCuentaBancaria(cuenta: any): Promise<string> {
  return crearCuentaBancariaDB(cuenta);
}

export async function actualizarCuentaBancaria(id: string, cuenta: any): Promise<void> {
  return actualizarCuentaBancariaDB(id, cuenta);
}

export async function eliminarCuentaBancaria(id: string): Promise<void> {
  return eliminarCuentaBancariaDB(id);
}

export async function desactivarCuentaBancaria(id: string): Promise<void> {
  return desactivarCuentaBancariaDB(id);
}