import { NextRequest, NextResponse } from "next/server";
import { crearOrden } from "../../../lib/ordenes-db";
import { Resend } from "resend";
import { storage } from "../../../lib/firebase-admin";
import { getSnapshotPricing } from "../../../lib/pricing";
import { obtenerAtributos } from "../../../lib/atributos-db";

// Helper function to get variation text for display
async function getVariationText(p: any, atributosMap: Record<string, string>): Promise<string> {
  const parts: string[] = [];
  
  // Mostrar variaciones seleccionadas (formato: ID atributo -> valor)
  if (p.selectedVariations && typeof p.selectedVariations === 'object') {
    Object.entries(p.selectedVariations).forEach(([attrId, value]) => {
      if (value) {
        const attrName = atributosMap[attrId] || attrId;
        parts.push(`${attrName}: ${value}`);
      }
    });
  }
  
  // Mostrar variación personalizada si existe
  if (p.variacionPersonalizada && typeof p.variacionPersonalizada === 'string' && p.variacionPersonalizada.trim()) {
    parts.push(`Variación: ${p.variacionPersonalizada.trim()}`);
  }
  
  // Mostrar valores de personalización si existen
  if (p.personalizacionValues && typeof p.personalizacionValues === 'object') {
    Object.entries(p.personalizacionValues).forEach(([campoId, valor]) => {
      if (valor && typeof valor === 'string' && valor.trim()) {
        const campoName = atributosMap[campoId] || campoId;
        parts.push(`${campoName}: ${valor.trim()}`);
      }
    });
  }
  
  return parts.length > 0 ? `<br><span style="font-size:12px;color:#666;">${parts.join(' | ')}</span>` : '';
}

/**
 * 📧 ENDPOINT: Procesar pago por transferencia
 * 
 * Procesa una orden con pago por transferencia bancaria
 * Sube la evidencia de pago y crea la orden
 * Envía correo al dueño con la información
 */

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const evidencia = formData.get('evidencia') as File;
    const ordenData = JSON.parse(formData.get('ordenData') as string);

    // Validaciones
    if (!evidencia || !ordenData) {
      return NextResponse.json(
        { error: "Faltan datos requeridos" },
        { status: 400 }
      );
    }

    // Validar que sea una imagen
    if (!evidencia.type.startsWith('image/')) {
      return NextResponse.json(
        { error: "El archivo debe ser una imagen" },
        { status: 400 }
      );
    }

    // Validar tamaño máximo (5MB)
    if (evidencia.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "La imagen no puede exceder 5MB" },
        { status: 400 }
      );
    }

    // Subir imagen a Firebase Storage
    const bytes = await evidencia.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `evidencias/${Date.now()}_${evidencia.name}`;
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
    
    
    let evidenciaUrl: string;
    
    try {
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(fileName);

      await file.save(buffer, {
        metadata: {
          contentType: evidencia.type,
        },
      });

      // Hacer el archivo público
      await file.makePublic();
      
      // Generar URL firmada válida por 7 días como alternativa
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 días
      });
      
      // Verificar que el archivo sea realmente público
      const [metadata] = await file.getMetadata();
      
      // Usar URL pública, pero tener URL firmada como backup
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
      evidenciaUrl = publicUrl;
      ordenData.transferenciaInfo.evidenciaUrlFirmada = signedUrl; // Backup URL

      ordenData.transferenciaInfo.evidenciaMetodo = "storage";
    } catch (storageError: any) {
      // Fallback: usar base64 si Storage falla
      evidenciaUrl = `data:${evidencia.type};base64,${buffer.toString('base64')}`;
      ordenData.transferenciaInfo.evidenciaMetodo = "base64_fallback";
    }

    // Agregar evidencia a la orden
    ordenData.transferenciaInfo.evidencia = evidenciaUrl;
    ordenData.transferenciaInfo.evidenciaTipo = evidencia.type;
    ordenData.estado = "pendiente_aprobacion";

    // Crear la orden
    const orden = await crearOrden(ordenData);

    // Enviar correo al dueño
    await enviarCorreoAlDueño(orden);

    // Enviar correo al cliente
    await enviarCorreoAlCliente(orden);

    return NextResponse.json({
      success: true,
      orderId: orden.orderId,
      orden,
      message: "Orden creada exitosamente"
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Error al procesar la transferencia" },
      { status: 500 }
    );
  }
}

async function enviarCorreoAlDueño(orden: any) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return;
    }

    const ownerEmail = process.env.OWNER_EMAIL;
    if (!ownerEmail) {
      return;
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || "pedidos@vanessashop.com";

    // Cargar atributos para mostrar nombres en lugar de IDs
    const atributos = await obtenerAtributos();
    const atributosMap: Record<string, string> = {};
    atributos.forEach((attr: any) => {
      atributosMap[attr.id] = attr.nombre;
    });

    const resend = new Resend(resendApiKey);
    const emailHTML = await buildTransferenciaEmailHTML(orden, atributosMap);

    // Preparar adjuntos si hay evidencia (siempre adjuntar para garantizar visualización)
    const attachments: any[] = [];
    if (orden.transferenciaInfo?.evidencia) {
      // Si es base64, adjuntar directamente
      if (orden.transferenciaInfo.evidencia.startsWith('data:')) {
        const base64Data = orden.transferenciaInfo.evidencia.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        attachments.push({
          filename: `evidencia_orden_${orden.orderId}.jpg`,
          content: buffer,
        });
      } else if (orden.transferenciaInfo.evidencia.startsWith('http')) {
        // Si es URL, descargar y adjuntar
        try {
          const response = await fetch(orden.transferenciaInfo.evidencia);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          attachments.push({
            filename: `evidencia_orden_${orden.orderId}.jpg`,
            content: buffer,
          });
        } catch (downloadError) {
        }
      }
    }

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: ownerEmail,
      subject: `Nueva transferencia pendiente - Orden ${orden.orderId}`,
      html: emailHTML,
      attachments: attachments.length > 0 ? attachments : undefined,
      replyTo: orden.transferenciaInfo?.correo || orden.userEmail,
    });

    if (emailResponse.error) {
      throw new Error(emailResponse.error?.message || "Error de Resend");
    }


  } catch (error) {
    throw error; // Re-lanzar para que se capture en el try principal
  }
}

async function enviarCorreoAlCliente(orden: any) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return;
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || "pedidos@vanessashop.com";
    const customerEmail = orden.transferenciaInfo?.correo || orden.userEmail;

    if (!customerEmail) {
      return;
    }


    const resend = new Resend(resendApiKey);
    const emailHTML = buildClienteEmailHTML(orden);

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: customerEmail,
      subject: `Confirmación de pedido ${orden.orderId} - VaneShop`,
      html: emailHTML,
      replyTo: fromEmail,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
      },
    });

    if (emailResponse.error) {
      throw new Error(emailResponse.error?.message || "Error de Resend");
    }


  } catch (error) {
    throw error; // Re-lanzar para que se capture en el try principal
  }
}

async function buildTransferenciaEmailHTML(orden: any, atributosMap: Record<string, string>): Promise<string> {
  const cuentaInfo = orden.transferenciaInfo?.cuentaInfo || {};
  const userInfo = orden.transferenciaInfo || {};

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
</head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:white;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr>
      <td>
        <!-- Header con gradiente verde -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);border-radius:12px 12px 0 0;">
          <tr>
            <td style="padding:32px;text-align:center;color:white;">
              <h1 style="margin:0 0 8px;font-size:28px;font-weight:bold;">💰 Nueva Transferencia</h1>
              <p style="margin:0;font-size:14px;opacity:0.9;">Orden pendiente de aprobación</p>
            </td>
          </tr>
        </table>

        <!-- Número de orden -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:24px 36px;">
              <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:16px;border-radius:4px;">
                <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:bold;">Número de orden</p>
                <p style="margin:0;font-size:24px;font-weight:bold;color:#10b981;">${orden.orderId || "N/A"}</p>
                <p style="margin:8px 0 0;font-size:13px;color:#666;">Fecha: ${new Date().toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short" })}</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Información del cliente -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1f2937;">Información del cliente</h2>
              <div style="background:#f9fafb;border-radius:8px;padding:16px;">
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Nombre o razón social:</strong> ${userInfo.nombre || "N/A"}</p>
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Cédula/RUC:</strong> ${userInfo.cedulaRuc || "N/A"}</p>
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Teléfono:</strong> ${userInfo.telefono || "N/A"}</p>
                <p style="margin:0;font-size:14px;color:#374151;"><strong>Correo:</strong> ${userInfo.correo || "N/A"}</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Información de envío -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1f2937;">Información de envío</h2>
              <div style="background:#f9fafb;border-radius:8px;padding:16px;">
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Nombre para envío:</strong> ${orden.nombreEnvio || "N/A"}</p>
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Ciudad:</strong> ${orden.ciudadEntrega || "N/A"}</p>
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Zona:</strong> ${orden.zonaEntrega || "N/A"}</p>
                <p style="margin:0;font-size:14px;color:#374151;"><strong>Dirección:</strong> ${orden.direccionEnvio || "N/A"}</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Información de transferencia -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1f2937;">Información de transferencia</h2>
              <div style="background:#f9fafb;border-radius:8px;padding:16px;">
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Banco:</strong> ${cuentaInfo.banco || "N/A"}</p>
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Tipo:</strong> ${cuentaInfo.tipo || "N/A"}</p>
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Número de cuenta:</strong> ${cuentaInfo.numeroCuenta || "N/A"}</p>
                <p style="margin:0;font-size:14px;color:#374151;"><strong>Para transferir a:</strong> ${cuentaInfo.nombreParaTransferencia || "N/A"}</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Evidencia de pago -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1f2937;">Evidencia de pago</h2>
              <div style="background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
                ${orden.transferenciaInfo?.evidencia ? 
                  `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="text-align:center;padding:8px;">
                        <img src="${orden.transferenciaInfo.evidenciaUrlFirmada || orden.transferenciaInfo.evidencia}" alt="Evidencia de pago" style="max-width:100%;max-height:400px;border-radius:8px;border:1px solid #e5e7eb;display:block;margin:0 auto;">
                      </td>
                    </tr>
                    <tr>
                      <td style="text-align:center;padding:8px 0 0;">
                        <a href="${orden.transferenciaInfo.evidenciaUrlFirmada || orden.transferenciaInfo.evidencia}" target="_blank" style="color:#3b82f6;text-decoration:underline;font-size:12px;">Ver imagen en tamaño completo</a>
                      </td>
                    </tr>
                  </table>` : 
                  '<p style="margin:0;color:#666;">No se adjuntó evidencia</p>'
                }
              </div>
            </td>
          </tr>
        </table>

        <!-- Resumen de productos -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1f2937;">Resumen del pedido</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <thead>
                  <tr style="background:#f3f4f6;border-bottom:2px solid #e5e7eb;">
                    <th style="padding:12px 8px;text-align:left;font-size:13px;font-weight:bold;color:#374151;">Producto</th>
                    <th style="padding:12px 8px;text-align:center;font-size:13px;font-weight:bold;color:#374151;width:60px;">Cant.</th>
                    <th style="padding:12px 8px;text-align:right;font-size:13px;font-weight:bold;color:#374151;width:100px;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    orden.productos && Array.isArray(orden.productos)
                      ? (await Promise.all(orden.productos.map(async (p: any) => {
                          const { finalPrice } = getSnapshotPricing(p);
                          const variationText = await getVariationText(p, atributosMap);
                          return `
                        <tr style="border-bottom:1px solid #e5e7eb;">
                          <td style="padding:12px 8px;font-size:13px;color:#374151;">
                            <strong>${p.nombre || "Producto"}</strong>${variationText}
                          </td>
                          <td style="padding:12px 8px;text-align:center;font-size:13px;color:#374151;">${p.cantidad}</td>
                          <td style="padding:12px 8px;text-align:right;font-size:13px;font-weight:bold;color:#10b981;">$${(finalPrice * (p.cantidad || 1)).toFixed(2)}</td>
                        </tr>
                      `;
                        }))).join('')
                      : "<tr><td colspan=3 style='padding:12px;text-align:center;color:#999;'>No hay productos</td></tr>"
                  }
                </tbody>
              </table>
            </td>
          </tr>
        </table>

        <!-- Totales -->
        <tr>
          <td style="padding:0 36px 24px;">
            <div style="background:#f9fafb;border-radius:8px;padding:16px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
                <span style="color:#666;">Subtotal:</span>
                <span style="color:#1f2937;font-weight:bold;">$${(orden.productos && Array.isArray(orden.productos) ? orden.productos.reduce((sum: number, p: any) => { const { finalPrice } = getSnapshotPricing(p); return sum + finalPrice * (p.cantidad || 1); }, 0) : 0).toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
                <span style="color:#666;">Envío:</span>
                <span style="color:#1f2937;font-weight:bold;">$${(orden.costoEnvio || 0).toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:2px solid #e5e7eb;font-size:16px;font-weight:bold;">
                <span style="color:#1f2937;">Total:</span>
                <span style="color:#10b981;">$${((orden.productos && Array.isArray(orden.productos) ? orden.productos.reduce((sum: number, p: any) => { const { finalPrice } = getSnapshotPricing(p); return sum + finalPrice * (p.cantidad || 1); }, 0) : 0) + (orden.costoEnvio || 0)).toFixed(2)}</span>
              </div>
            </div>
          </td>
        </tr>

        <!-- Call to action -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;">
                <p style="margin:0 0 12px;font-size:14px;color:#92400e;font-weight:bold;">⚠️ Requerido: Revisión</p>
                <p style="margin:0 0 8px;font-size:14px;color:#92400e;">
                  Revisa la evidencia de pago y la información del cliente en el panel de administración.
                </p>
                <p style="margin:0;font-size:14px;color:#92400e;">
                  <strong>Acciones:</strong> Aprobar o rechazar la orden según corresponda.
                </p>
                <p style="margin:12px 0 0;font-size:13px;color:#92400e;">
                  <a href="${process.env.NEXT_PUBLIC_DOMAIN || "https://vaneshop.com"}/admin/pedidos" style="color:#92400e;font-weight:bold;text-decoration:none;">Ir al panel de administración</a>
                </p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 36px;text-align:center;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">Este correo fue enviado automáticamente por VaneShop</p>
            <p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} VanessaShop. Todos los derechos reservados.</p>
          </td>
        </tr>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function buildClienteEmailHTML(orden: any): string {
  const userInfo = orden.transferenciaInfo || {};

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
</head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:white;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr>
      <td>
        <!-- Header con gradiente azul -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);border-radius:12px 12px 0 0;">
          <tr>
            <td style="padding:32px;text-align:center;color:white;">
              <h1 style="margin:0 0 8px;font-size:28px;font-weight:bold;">🛍️ Tu pedido ha sido recibido</h1>
              <p style="margin:0;font-size:14px;opacity:0.9;">Orden pendiente de aprobación</p>
            </td>
          </tr>
        </table>

        <!-- Número de orden -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:24px 36px;">
              <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px;border-radius:4px;">
                <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:bold;">Número de orden</p>
                <p style="margin:0;font-size:24px;font-weight:bold;color:#3b82f6;">${orden.orderId || "N/A"}</p>
                <p style="margin:8px 0 0;font-size:13px;color:#666;">Fecha: ${orden.createdAt ? new Date(orden.createdAt).toLocaleDateString("es-ES") : "N/A"}</p>
                <p style="margin:8px 0 0;font-size:13px;color:#666;">Estado: <strong>Pendiente de aprobación</strong></p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Información de envío -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1f2937;">Información de envío</h2>
              <div style="background:#f9fafb;border-radius:8px;padding:16px;">
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Ciudad:</strong> ${orden.ciudadEntrega || "N/A"}</p>
                <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Zona:</strong> ${orden.zonaEntrega || "N/A"}</p>
                <p style="margin:0;font-size:14px;color:#374151;"><strong>Dirección:</strong> ${orden.direccionEnvio || "N/A"}</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Resumen de productos -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1f2937;">Resumen del pedido</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <thead>
                  <tr style="background:#f3f4f6;border-bottom:2px solid #e5e7eb;">
                    <th style="padding:12px 8px;text-align:left;font-size:13px;font-weight:bold;color:#374151;">Producto</th>
                    <th style="padding:12px 8px;text-align:center;font-size:13px;font-weight:bold;color:#374151;width:60px;">Cant.</th>
                    <th style="padding:12px 8px;text-align:right;font-size:13px;font-weight:bold;color:#374151;width:100px;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    orden.productos && Array.isArray(orden.productos)
                      ? orden.productos.map((p: any) => `
                        <tr style="border-bottom:1px solid #e5e7eb;">
                          <td style="padding:12px 8px;font-size:13px;color:#374151;">
                            <strong>${p.nombre || "Producto"}</strong>
                          </td>
                          <td style="padding:12px 8px;text-align:center;font-size:13px;color:#374151;">${p.cantidad}</td>
                          <td style="padding:12px 8px;text-align:right;font-size:13px;font-weight:bold;color:#3b82f6;">$${(p.subtotal || 0).toFixed(2)}</td>
                        </tr>
                      `).join('')
                      : "<tr><td colspan=3 style='padding:12px;text-align:center;color:#999;'>No hay productos</td></tr>"
                  }
                </tbody>
              </table>
            </td>
          </tr>
        </table>

        <!-- Totales -->
        <tr>
          <td style="padding:0 36px 24px;">
            <div style="background:#f9fafb;border-radius:8px;padding:16px;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
                <span style="color:#666;">Subtotal:</span>
                <span style="color:#1f2937;font-weight:bold;">$${(orden.total || 0).toFixed(2)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:2px solid #e5e7eb;font-size:16px;font-weight:bold;">
                <span style="color:#1f2937;">Total:</span>
                <span style="color:#3b82f6;">$${(orden.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </td>
        </tr>

        <!-- Información importante -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;">
                <p style="margin:0 0 12px;font-size:14px;color:#92400e;font-weight:bold;">⏳ Próximos pasos</p>
                <p style="margin:0 0 8px;font-size:14px;color:#92400e;">
                  Tu pedido está siendo revisado. Te notificaremos cuando sea aprobado.
                </p>
                <p style="margin:0;font-size:14px;color:#92400e;">
                  El tiempo de estimación de aprobación es de 24-48 horas hábiles.
                </p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 36px;text-align:center;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">Este correo fue enviado automáticamente por VaneShop</p>
            <p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} VaneShop. Todos los derechos reservados.</p>
          </td>
        </tr>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}