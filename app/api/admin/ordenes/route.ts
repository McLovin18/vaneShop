import { NextRequest, NextResponse } from "next/server";
import admin from "../../../lib/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const db = admin.firestore();
    const auth = admin.auth();

    // Obtener token del header
    const authHeader = req.headers.get("authorization");
    console.log("🔍 [ordenes] authHeader:", authHeader ? "present" : "missing");
    
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("❌ [ordenes] No autorizado - sin Bearer token");
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const token = authHeader.slice(7);
    console.log("🔍 [ordenes] Token length:", token.length);
    
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
      console.log("✅ [ordenes] Token verificado, uid:", decodedToken.uid);
      console.log("🔍 [ordenes] Claims:", decodedToken);
    } catch (err) {
      console.error("❌ [ordenes] Error verificando token:", err);
      return NextResponse.json(
        { error: "Token inválido" },
        { status: 401 }
      );
    }

    // Verificar que sea admin
    console.log("🔍 [ordenes] admin claim:", decodedToken.admin);
    if (!decodedToken.admin) {
      console.error("❌ [ordenes] Usuario no es admin");
      return NextResponse.json(
        { error: "No tiene permisos de administrador" },
        { status: 403 }
      );
    }

    // Obtener todas las órdenes
    console.log("🔍 [ordenes] Buscando órdenes en Firestore...");
    const ordenesSnap = await db.collection("ordenes").get();
    console.log("✅ [ordenes] Órdenes encontradas:", ordenesSnap.size);
    
    const ordenes = ordenesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    console.log("✅ [ordenes] Devolviendo", ordenes.length, "órdenes");
    return NextResponse.json(ordenes, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    });
  } catch (error: any) {
    console.error("❌ [ordenes] Error no capturado:", error);
    return NextResponse.json(
      { error: error.message || "Error al obtener órdenes" },
      { status: 500 }
    );
  }
}
