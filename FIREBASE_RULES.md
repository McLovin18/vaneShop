# Reglas de Firebase para el Sistema de Transferencias

## Reglas de Firestore

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Regla base: solo usuarios autenticados pueden leer/escribir
    match /{document=**} {
      allow read: if request.auth != null;
      allow write: if false; // Por defecto denegar escritura
    }
    
    // Colección de cuentas bancarias (lectura pública, escritura admin)
    match /cuentasBancarias/{cuentaId} {
      allow read: if true; // Cualquier persona puede leer (para seleccionar en transferencia)
      allow write: if request.auth != null && 
        request.auth.token.admin == true; // Solo admin puede escribir
    }
    
    // Colección de ciudades de entrega (solo admin)
    match /ciudadesEntrega/{ciudadId} {
      allow read: if request.auth != null; // Cualquier usuario autenticado puede leer
      allow write: if request.auth != null && 
        request.auth.token.admin == true; // Solo admin puede escribir
    }
    
    // Colección de órdenes
    match /ordenes/{ordenId} {
      // Lectura: pública (cualquiera puede ver las órdenes)
      // Si necesitas restringir por usuario, puedes implementar tokens temporales
      allow read: if true;
      
      // Creación: cualquier persona puede crear orden (sin autenticación)
      allow create: if true;
      
      // Actualización: solo admin puede actualizar (para aprobar/rechazar)
      allow update: if request.auth != null && 
        request.auth.token.admin == true;
      
      // Eliminación: solo admin puede eliminar
      allow delete: if request.auth != null && 
        request.auth.token.admin == true;
    }
    
    // Meta para contador de órdenes (solo admin)
    match /ordenes_meta/{docId} {
      allow read, write: if request.auth != null && 
        request.auth.token == true;
    }
    
    // Colección de productos (lectura pública, escritura admin)
    match /productos/{productoId} {
      allow read: if true; // Público puede leer
      allow write: if request.auth != null && 
        request.auth.token.admin == true;
    }
    
    // Colección de bodegas (lectura pública, escritura admin)
    match /bodegas/{bodegaId} {
      allow read: if true; // Público puede leer
      allow write: if request.auth != null && 
        request.auth.token.admin == true;
    }
    
    // Colección de atributos (lectura pública, escritura admin)
    match /atributos/{atributoId} {
      allow read: if true; // Público puede leer
      allow write: if request.auth != null && 
        request.auth.token.admin == true;
    }
    
    // Colección de reviews (lectura pública, escritura autenticados)
    match /reviews/{reviewId} {
      allow read: if true; // Público puede leer
      allow create: if request.auth != null; // Autenticados pueden crear
      allow update, delete: if request.auth != null && 
        (resource.data.userId == request.auth.uid || 
         request.auth.token.admin == true);
    }
  }
}
```

## Reglas de Storage

```storage
rules_version = '2';
service firebase.storage {
  match /b/{allPaths=**} {
    // Regla base: lectura pública, escritura autenticada
    allow read: if true;
    allow write: if request.auth != null;
  }
  
  // Bucket específico para evidencias de transferencia
  match /evidencias-transferencia/{ordenId}/{fileName} {
    // Lectura: pública (para que admin pueda ver)
    allow read: if true;
    
    // Escritura: pública (cualquiera puede subir evidencia)
    // En producción podrías querer restringir esto con tokens temporales
    allow write: if true;
  }
  
  // Bucket para imágenes de productos (solo admin)
  match /productos/{productoId}/{fileName} {
    allow read: if true; // Público puede leer
    allow write: if request.auth != null && 
      request.auth.token.admin == true;
  }
  
  // Bucket para imágenes generales
  match /images/{allPaths=**} {
    allow read: if true;
    allow write: if request.auth != null && 
      request.auth.token.admin == true;
  }
}
```

## Configuración de Claims Personalizados

Para que las reglas funcionen correctamente, necesitas configurar los claims personalizados en Firebase Authentication:

### Claim de Admin:
```javascript
// Agregar claim de admin a un usuario
const admin = require('firebase-admin');
admin.auth().setCustomUserClaims(uid, { admin: true });
```

### Verificación en tu aplicación:
```javascript
// En tu servidor API
const decodedToken = await admin.auth().verifyIdToken(idToken);
if (decodedToken.admin === true) {
  // El usuario es admin
}
```

## Variables de Entorno Necesarias

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id

# Resend (para correos)
RESEND_API_KEY=tu_clave_resend
OWNER_EMAIL=tu@email.com

# Admin Token (para operaciones de admin)
NEXT_PUBLIC_ADMIN_TOKEN=tu_token_secreto

# Dominio
NEXT_PUBLIC_DOMAIN=https://tu-dominio.com
```

## Notas Importantes

1. **Storage**: Actualmente estoy guardando las evidencias como base64 en Firestore. Si prefieres usar Storage, necesitarías:
   - Cambiar el endpoint para subir a Storage en lugar de base64
   - Ajustar las reglas de Storage según el path que uses
   - Actualizar el correo para mostrar la URL de Storage en lugar del base64

2. **Claims**: Las reglas asumen que tienes un sistema de claims personalizados para identificar admins. Si no lo tienes, necesitarás implementarlo o ajustar las reglas.

3. **Testing**: Antes de desplegar, prueba las reglas en Firebase Console usando el simulador de reglas.

4. **Seguridad**: Las reglas actuales permiten lectura pública de productos y bodegas. Si necesitas restringir esto, ajusta las reglas correspondientes.