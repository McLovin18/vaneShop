import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSnapshotPricing } from "../../../lib/pricing";

/**
 * 📧 ENDPOINT: Enviar correo de orden con Resend
 * 
 * Usado cuando se crea una orden (proforma)
 * Envía información de la orden al cliente
 */

function buildOrderEmailHTML(orden: any): string {
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
        <!-- Header con gradiente púrpura -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%);border-radius:12px 12px 0 0;">
          <tr>
            <td style="padding:32px;text-align:center;color:white;">
              <h1 style="margin:0 0 8px;font-size:28px;font-weight:bold;">🛍️ VaneShop</h1>
              <p style="margin:0;font-size:14px;opacity:0.9;">Tu orden ha sido recibida</p>
            </td>
          </tr>
        </table>

        <!-- Número de orden y estado -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:24px 36px;">
              <div style="background:#f0f9ff;border-left:4px solid #6d28d9;padding:16px;border-radius:4px;">
                <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:bold;">Número de orden</p>
                <p style="margin:0;font-size:24px;font-weight:bold;color:#6d28d9;">${orden.orderId || "N/A"}</p>
                <p style="margin:8px 0 0;font-size:13px;color:#666;">Fecha: ${orden.createdAt ? new Date(orden.createdAt).toLocaleDateString("es-ES") : "N/A"}</p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Tabla de productos -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1f2937;">Tus productos</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <thead>
                  <tr style="background:#f3f4f6;border-bottom:2px solid #e5e7eb;">
                    <th style="padding:12px 8px;text-align:left;font-size:13px;font-weight:bold;color:#374151;">Producto</th>
                    <th style="padding:12px 8px;text-align:center;font-size:13px;font-weight:bold;color:#374151;width:60px;">Cant.</th>
                    <th style="padding:12px 8px;text-align:right;font-size:13px;font-weight:bold;color:#374151;width:100px;">Precio</th>
                    <th style="padding:12px 8px;text-align:right;font-size:13px;font-weight:bold;color:#374151;width:100px;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    orden.productos && Array.isArray(orden.productos)
                      ? orden.productos.map((p: any) => {
                          const { finalPrice: precioUnit, discount: descuento, hasDiscount: hasDescuento, fakeOldPrice } = getSnapshotPricing(p);
                          const cantidad = Number(p.cantidad || 1);
                          const subtotal = precioUnit * cantidad;
                          return `
                    <tr style="border-bottom:1px solid #e5e7eb;">
                      <td style="padding:12px 8px;font-size:13px;color:#374151;">
                        <strong>${p.nombre || "Producto"}</strong>
                        ${hasDescuento ? `<br><span style="font-size:11px;color:#dc2626;">-${Math.round(descuento)}%</span>` : ""}
                      </td>
                      <td style="padding:12px 8px;text-align:center;font-size:13px;color:#374151;">${cantidad}</td>
                      <td style="padding:12px 8px;text-align:right;font-size:13px;color:#374151;">$${precioUnit.toFixed(2)}</td>
                      <td style="padding:12px 8px;text-align:right;font-size:13px;font-weight:bold;color:#6d28d9;">$${subtotal.toFixed(2)}</td>
                    </tr>
                  `;
                        })
                      : "<tr><td colspan=4 style='padding:12px;text-align:center;color:#999;'>No hay productos</td></tr>"
                  }
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Totales -->
          <tr>
            <td style="padding:0 36px 24px;">
              <div style="background:#f9fafb;border-radius:8px;padding:16px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
                  <span style="color:#666;">Subtotal:</span>
                  <span style="color:#1f2937;font-weight:bold;">$${(orden.total || 0).toFixed(2)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
                  <span style="color:#666;">Envío:</span>
                  <span style="color:#16a34a;font-weight:bold;">Gratis</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:2px solid #e5e7eb;font-size:16px;font-weight:bold;">
                  <span style="color:#1f2937;">Total:</span>
                  <span style="color:#6d28d9;">$${(orden.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Info de visita -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:0 36px 24px;">
              <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;">
                <p style="margin:0 0 12px;font-size:14px;color:#92400e;font-weight:bold;">📅 Próximos pasos</p>
                <p style="margin:0 0 8px;font-size:14px;color:#92400e;">
                  Visita nuestro local el <strong>${orden.visitaFecha || "N/A"}</strong> a las <strong>${orden.visitaHora || "N/A"}</strong> para retirar tu pedido.
                </p>
                <p style="margin:0;font-size:14px;color:#92400e;">
                  <strong>Presenta:</strong> Este número de orden <strong>${orden.orderId}</strong> o tu documento
                </p>
                <p style="margin:12px 0 0;font-size:13px;color:#92400e;">
                  Para seguimiento: <a href="${process.env.NEXT_PUBLIC_DOMAIN || "https://vanessashop.com"}/home/ordenes" style="color:#6d28d9;font-weight:bold;text-decoration:none;">Ver mis órdenes</a>
                </p>
              </div>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 36px;text-align:center;border-top:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">Este correo fue enviado automáticamente por VanessaShop</p>
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

export async function POST(req: NextRequest) {
  try {
    const { orden, email } = await req.json();

    if (!orden || !email || typeof email !== "string" || email.trim() === "" || 
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json(
        { error: "Email inválido u orden incompleta" },
        { status: 400 }
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("[send-order-email] RESEND_API_KEY no configurado");
      return NextResponse.json(
        { error: "Servicio de email no disponible" },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);

    // Enviar email con Resend
    const emailResponse = await resend.emails.send({
      from: "pedidos@vanessashop.com",
      to: email.trim(),
      subject: `Tu pedido ${orden.orderId} ha sido recibido — VanessaShop`,
      html: buildOrderEmailHTML(orden),
      replyTo: "soporte@vanessashop.com",
    });

    if (emailResponse.error) {
      console.error("[send-order-email] Resend error:", emailResponse.error);
      return NextResponse.json(
        { error: "Error al enviar el correo" },
        { status: 500 }
      );
    }

    console.log(
      `✅ [ORDEN_EMAIL_ENVIADO] ${orden.orderId} | ` +
      `Email: ${email.trim()} | ` +
      `ResendId: ${emailResponse.data?.id}`
    );

    return NextResponse.json({
      success: true,
      message: `Pedido enviado a ${email.trim()}`,
      resendId: emailResponse.data?.id,
    });
  } catch (err: any) {
    console.error("[send-order-email] ❌ Error:", err);
    return NextResponse.json(
      { error: err.message || "Error al enviar el correo" },
      { status: 500 }
    );
  }
}
