// Inicialización de Firebase para el cliente (navegador)
import { initializeApp, getApps, getApp } from "firebase/app";

import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  enableIndexedDbPersistence,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Solo inicializa si no hay apps
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export { app };

export const auth = getAuth(app);
export const storage = getStorage(app);

// IMPORTANTE: usamos initializeFirestore (no getFirestore) para poder
// forzar long-polling automático. Firestore usa streaming por defecto
// (WebChannel), y los WebViews embebidos de Instagram, TikTok y Facebook
// en iOS suelen bloquear o cortar las respuestas en streaming, dejando
// las peticiones "colgadas" para siempre sin lanzar ningún error.
// "experimentalAutoDetectLongPolling" detecta ese caso y cambia a
// long-polling automáticamente, sin afectar el rendimiento en navegadores
// normales (Safari, Chrome, etc.), donde sigue usando streaming.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

// Habilitar persistencia offline para Firestore.
// Debe llamarse DESPUÉS de initializeFirestore y antes de cualquier otra
// operación sobre "db". Si falla (varias pestañas abiertas, navegador sin
// soporte, IndexedDB bloqueado por el WebView), simplemente no habrá caché
// offline — la app sigue funcionando en modo online normal.
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    // failed-precondition: múltiples pestañas abiertas a la vez.
    // unimplemented: el navegador/WebView no soporta las funciones requeridas.
    // En ambos casos, no es un error fatal: Firestore sigue funcionando sin caché offline.
    console.warn("No se pudo habilitar la persistencia offline de Firestore:", err?.code || err);
  });
}
