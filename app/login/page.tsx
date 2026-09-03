"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomBarPublic from "../components/BottomBarPublic";
import { loginUser } from "../lib/firebase-auth";
import { Loading3DIcon } from "../components/Loading3DIcon";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showLoginPass, setShowLoginPass] = useState(false);
  
  // ← Estado para rate limiting
  const [rateLimitBlockedUntil, setRateLimitBlockedUntil] = useState<number | null>(null);
  const [rateLimitSecondsRemaining, setRateLimitSecondsRemaining] = useState<number>(0);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Auto-dismiss alert
  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 4000);
    return () => clearTimeout(t);
  }, [alert]);

  // ← Contador regresivo para rate limiting
  useEffect(() => {
    if (!rateLimitBlockedUntil) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((rateLimitBlockedUntil - now) / 1000));
      
      setRateLimitSecondsRemaining(remaining);
      
      if (remaining <= 0) {
        // Se desbloqueó
        setRateLimitBlockedUntil(null);
        setAlert({
          message: "✓ Puedes intentar iniciar sesión nuevamente",
          type: "success",
        });
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [rateLimitBlockedUntil]);

  // --- Handlers ---
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setAlert({ message: "Completa los campos", type: "error" });
      return;
    }
    
    // ← Evitar si está bloqueado por rate limiting
    if (rateLimitBlockedUntil && rateLimitSecondsRemaining > 0) {
      setAlert({
        message: `Espera ${rateLimitSecondsRemaining} segundos antes de intentar de nuevo.`,
        type: "error",
      });
      return;
    }
    
    try {
      setLoading(true);
      const result = await loginUser(loginEmail, loginPassword);
      if (result.success) {
        setAlert({ message: `Bienvenido ${result.user.displayName}`, type: "success" });
        const idToken = result.idToken;
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "No se pudo crear la sesión");
        }
        if (data?.role !== "admin") {
          throw new Error("Solo el administrador puede iniciar sesión en esta tienda.");
        }
        router.push("/admin");
      }
    } catch (error: any) {
      const errorMsg = error.message || "Error al iniciar sesión";
      setAlert({ message: errorMsg, type: "error" });
      
      // ← Detectar si es error de rate limiting y establecer bloqueoBLOQUEO
      if (errorMsg.includes("Demasiados intentos")) {
        // Extraer el tiempo restante de "Intenta nuevamente en X segundos"
        const secondsMatch = errorMsg.match(/(\d+)\s*segundos/);
        if (secondsMatch) {
          const secondsToWait = parseInt(secondsMatch[1], 10);
          const blockedUntil = Date.now() + (secondsToWait * 1000);
          setRateLimitBlockedUntil(blockedUntil);
          setRateLimitSecondsRemaining(secondsToWait);
        }
      }
      
      // Limpiar password pero mantener email por comodidad
      setLoginPassword("");
      try {
        await import("../lib/firebase-auth").then((m) => m.logoutUser());
      } catch {}
    } finally {
      setLoading(false);
    }
  }

  // --- Input class helper ---
  const inputClass =
    "w-full px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 " +
    "bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
    "placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      <BottomBarPublic />

      {/* Hero header */}
      <div className="w-full max-w-md mx-auto px-4 pt-10 pb-4 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500 mb-5 shadow-lg shadow-blue-500/30">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-slate-900 dark:text-white">
          Vanese-Shop
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-base">
          Acceso exclusivo para administración.
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md mx-auto px-4 pb-16 flex-1 flex flex-col justify-start">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">

          <div className="p-6 md:p-8">
            {/* Alert */}
            {alert && (
              <div
                className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-start gap-3 ${
                  alert.type === "success"
                    ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-100 dark:border-green-800"
                    : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-100 dark:border-red-800"
                }`}
              >
                <span className="text-base leading-none mt-0.5">
                  {alert.type === "success" ? "✓" : "!"}
                </span>
                {alert.message}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  placeholder="admin@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  autoComplete="email"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showLoginPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                    className={inputClass + " pr-12"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass(!showLoginPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showLoginPass ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <a
                  href="/recuperar-password"
                  className="text-sm text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <button
                type="submit"
                disabled={loading || (rateLimitBlockedUntil !== null && rateLimitSecondsRemaining > 0)}
                className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <Loading3DIcon />
                    <span>Ingresando...</span>
                  </>
                ) : rateLimitBlockedUntil !== null && rateLimitSecondsRemaining > 0 ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Espera {rateLimitSecondsRemaining}s</span>
                  </>
                ) : (
                  "Ingresar al panel"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
          Al continuar, aceptas nuestros{" "}
          <a href="/terminos" className="underline hover:text-slate-600 dark:hover:text-slate-400 transition-colors">
            Términos de uso
          </a>{" "}
          y{" "}
          <a href="/privacidad" className="underline hover:text-slate-600 dark:hover:text-slate-400 transition-colors">
            Política de privacidad
          </a>.
        </p>
      </div>
    </div>
  );
}
