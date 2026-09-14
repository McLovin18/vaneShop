import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "./firebase";

/**
 * Sube una imagen o video a Firebase Storage y retorna la URL pública.
 * @param file Archivo de imagen o video a subir
 * @param path Ruta en Storage (ej: 'productos/nombre.jpg' o 'productos/nombre.mp4')
 * @returns URL pública del archivo
 */
export async function uploadImageAndGetUrl(file: File, path: string): Promise<string> {
  const storage = getStorage(app);
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
}
