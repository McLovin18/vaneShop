"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, AlertCircle, Loader } from "lucide-react";

type VerificationState = "loading" | "success" | "expired" | "error";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerificationState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const oobCode = searchParams.get("oobCode");

        if (!oobCode) {
          setState("error");
          setMessage("⚠️ No se proporcionó código de verificación. El enlace es inválido.");
          return;
        }

        // Aplicar el código de verificación
        const { applyActionCode, getAuth } = await import("firebase/auth");
        const auth = getAuth();
        await applyActionCode(auth, oobCode);

        setState("success");
        setMessage("✓ ¡Email verificado exitosamente!");

        // Redirigir a login después de 2 segundos
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } catch (error: any) {
        console.error("[verify-email] Error:", error);

        // Detectar tipo de error
        if (
          error.code === "auth/invalid-action-code" ||
          error.code === "auth/expired-action-code"
        ) {
          setState("expired");
          setMessage(
            "⏱️ El enlace de verificación ha expirado. Vuelve a /login para reenviar el correo."
          );
        } else {
          setState("error");
          setMessage(`❌ Error: ${error.message || "No se pudo verificar el email"}`);
        }
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-white text-gray-900"
      style={{ transition: "background-color 0.3s ease" }}
    >
      <div
        className="w-full max-w-md p-6 rounded-lg border bg-gray-50 border-gray-200"
        style={{ transition: "all 0.3s ease" }}
      >
        {/* Loading State */}
        {state === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader className="w-12 h-12 text-purple-600 animate-spin" />
            <h1 className="text-xl font-bold text-center text-gray-900">
              Verificando email...
            </h1>
            <p className="text-gray-600">
              Por favor, espera mientras procesamos tu verificación.
            </p>
          </div>
        )}

        {/* Success State */}
        {state === "success" && (
          <div className="flex flex-col items-center gap-4">
            <div className="p-2 rounded-full bg-green-100">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-center text-gray-900">
              ¡Email Verificado!
            </h1>
            <p className="text-gray-600">
              {message}
            </p>
            <p className="text-sm text-center text-gray-500">
              Redirigiendo a login en 2 segundos...
            </p>
          </div>
        )}

        {/* Expired State */}
        {state === "expired" && (
          <div className="flex flex-col items-center gap-4">
            <div className="p-2 rounded-full bg-yellow-100">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <h1 className="text-xl font-bold text-center text-gray-900">
              Link Expirado
            </h1>
            <p className="text-gray-600">
              {message}
            </p>
            <button
              onClick={() => router.push("/login")}
              className="mt-4 w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Volver a Login
            </button>
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="p-2 rounded-full bg-red-100">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-center text-gray-900">
              Error en Verificación
            </h1>
            <p className="text-gray-600">
              {message}
            </p>
            <button
              onClick={() => router.push("/login")}
              className="mt-4 w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Volver a Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

