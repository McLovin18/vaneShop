import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedisClient(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error("❌ Variables de entorno faltantes");
    }

    redis = new Redis({ url, token });
  }
  return redis;
}

export function normalizeIp(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  return ip.split(":")[0].trim();
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
  reason?: string;
  blockedUntilTimestamp?: number; // ← Agregado: timestamp opcional para mostrar cuándo se desbloquea
}

/**
 * MULTI-CAPA RATE LIMITING - SEGURIDAD AVANZADA
 * 
 * ✅ CAPA 1: EMAIL (PRIMARIA - FUENTE DE VERDAD)
 *    - 3 intentos fallidos en 5 minutos → bloquear 5 minutos
 *    - Email es verificable y único
 *    - Es el FACTOR DE IDENTIDAD REAL
 * 
 * ⚠️ CAPA 2: IP (SECUNDARIA - MACRO)
 *    - 10 intentos fallidos en 30 minutos → bloquear 5 minutos
 *    - Impide ataques distribuidos
 *    - Menos restrictivo (múltiples usuarios en misma red)
 * 
 * ℹ️ CAPA 3: DEVICE (TERCIARIA - TELEMETRÍA)
 *    - Solo para análisis y logging
 *    - No afecta la decisión final
 * 
 * 🛡️ ANTI-BYPASS:
 *    - NO resetear historial en login exitoso
 *    - Bloqueo PROGRESIVO
 *    - Email bloqueado permanentemente hasta expiración
 */
export async function checkRateLimit(
  email: string,
  ip: string = "unknown",
  action: string = "register"
): Promise<RateLimitResult> {
  ip = normalizeIp(ip);
  
  try {
    const redisClient = getRedisClient();
    
    // ============================================
    // CAPA 1: EMAIL (PRIMARIA)
    // ============================================
    const emailKey = `rl:${action}:email:${email.toLowerCase()}`;
    const emailCount = await redisClient.incr(emailKey);
    const emailTtl = await redisClient.ttl(emailKey);
    
    if (emailCount === 1) {
      // Primer intento: ventana de 5 minutos (300 segundos)
      await redisClient.expire(emailKey, 300);
    }
    
    // Límite: 5 intentos en 5 minutos
    if (emailCount > 5) {
      const remainingSeconds = emailTtl > 0 ? emailTtl : 300;
      const blockedUntil = Date.now() + (remainingSeconds * 1000);
      
      return {
        allowed: false,
        remaining: 0,
        retryAfter: remainingSeconds,
        blockedUntilTimestamp: blockedUntil,
        reason: `Demasiados intentos. Intenta nuevamente en ${remainingSeconds} segundos.`,
      };
    }
    
    // ============================================
    // CAPA 2: IP (SECUNDARIA)
    // ============================================
    if (ip !== "unknown") {
      const ipKey = `rl:${action}:ip:${ip}`;
      const ipCount = await redisClient.incr(ipKey);
      const ipTtl = await redisClient.ttl(ipKey);
      
      if (ipCount === 1) {
        // Primer intento: ventana de 30 minutos (1800 segundos)
        await redisClient.expire(ipKey, 1800);
      }
      
      // Límite: 10 intentos en 30 minutos
      if (ipCount > 10) {
        const remainingSeconds = ipTtl > 0 ? ipTtl : 1800;
        const blockedUntil = Date.now() + (remainingSeconds * 1000);
        
        return {
          allowed: false,
          remaining: 0,
          retryAfter: remainingSeconds,
          blockedUntilTimestamp: blockedUntil,
          reason: `Demasiados intentos desde esta red. Intenta en ${remainingSeconds} segundos.`,
        };
      }
      
    }
    
    // ✅ PERMITIDO
    return {
      allowed: true,
      remaining: Math.max(0, 3 - emailCount),
    };
    
  } catch (err: any) {
    // FAIL-SAFE: Denegar
    return {
      allowed: false,
      remaining: 0,
      retryAfter: 60,
      reason: "Error temporal. Intenta más tarde.",
    };
  }
}

/**
 * Marcar REGISTRO como exitoso (NO para login)
 * BLOQUEA email por 7 días para anti-spam
 * NO limpia el contador de intentos fallidos
 */
export async function markRegistrationSuccess(
  email: string,
  blockDays: number = 7
): Promise<void> {
  const key = `rl:register:email:${email.toLowerCase()}:blocked`;
  
  try {
    const redisClient = getRedisClient();
    await redisClient.setex(
      key,
      blockDays * 86400, // 7 días = 604800 segundos
      "blocked"
    );
  } catch (err: any) {
  }
}

/**
 * Verificar si email está bloqueado por registro previo
 */
export async function isEmailRegistrationBlocked(email: string): Promise<boolean> {
  const key = `rl:register:email:${email.toLowerCase()}:blocked`;
  
  try {
    const redisClient = getRedisClient();
    const blocked = await redisClient.exists(key);
    return blocked === 1;
  } catch (err: any) {
    console.error("[rate-limit] Error isEmailRegistrationBlocked:", err.message);
    return false;
  }
}

/**
 * Información del rate limit (para debugging/admin)
 */
export async function getRateLimitInfo(
  email: string,
  ip: string = "unknown",
  action: string = "register"
) {
  ip = normalizeIp(ip);
  
  try {
    const redisClient = getRedisClient();
    
    const emailKey = `rl:${action}:email:${email.toLowerCase()}`;
    const blockedKey = `rl:${action}:email:${email.toLowerCase()}:blocked`;
    const ipKey = `rl:${action}:ip:${ip}`;
    
    const [emailCount, emailTtl, emailBlocked, ipCount, ipTtl] = await Promise.all([
      redisClient.get(emailKey),
      redisClient.ttl(emailKey),
      redisClient.exists(blockedKey),
      redisClient.get(ipKey),
      redisClient.ttl(ipKey),
    ]);
    
    return {
      email: {
        count: emailCount || 0,
        ttl: Math.max(0, emailTtl || 0),
        blocked: emailBlocked === 1,
      },
      ip: {
        count: ipCount || 0,
        ttl: Math.max(0, ipTtl || 0),
      },
    };
  } catch (err: any) {
    console.error("[rate-limit] Error en getRateLimitInfo:", err.message);
    return null;
  }
}
