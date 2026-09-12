import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "../../../lib/firebase-admin";
import { Resend } from "resend";

function buildVerificationEmailHTML(verificationLink: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Verifica tu correo — Vaneshop</title>
  <style>
    body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
    table { border-collapse: collapse; }
    a { color: inherit; }
  </style>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;padding:0;">
    <tr>
      <td align="center" style="padding:20px;">
        <table width="100%" maxwidth="500" cellpadding="0" cellspacing="0" style="max-width:500px;background:#fff;border:1px solid #ddd;border-radius:4px;">
          
          <!-- Header simple -->
          <tr>
            <td style="background:#6d28d9;padding:20px;text-align:center;color:#fff;">
              <h1 style="margin:0;font-size:24px;font-weight:bold;">VaneShop</h1>
            </td>
          </tr>

          <!-- Contenido -->
          <tr>
            <td style="padding:30px;color:#333;font-size:14px;line-height:1.6;">
              <p>Hola,</p>
              <p>Has solicitado verificar tu correo electrónico en VaneShop. Haz clic en el botón de abajo para confirmar tu identidad.</p>
              
              <!-- Botón simple -->
              <table cellpadding="0" cellspacing="0" style="margin:20px 0;">
                <tr>
                  <td style="background:#6d28d9;padding:12px 30px;border-radius:4px;">
                    <a href="${verificationLink}" style="color:#fff;text-decoration:none;font-weight:bold;display:block;">
                      Verificar correo
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#666;font-size:12px;">O accede aquí: <a href="${verificationLink}" style="color:#6d28d9;word-break:break-all;">${verificationLink}</a></p>
              
              <p style="color:#999;font-size:12px;margin-top:20px;padding-top:20px;border-top:1px solid #eee;">
                Este enlace expirará en 24 horas. Si no lo solicitaste, ignora este mensaje.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:15px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;">
              © ${new Date().getFullYear()} VaneShop. No responder a este correo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email es requerido" },
        { status: 400 }
      );
    }

    // Generar el link de verificación usando Firebase Admin SDK
    const firebaseLink = await adminAuth.generateEmailVerificationLink(email);
    
    // Extraer el oobCode del link de Firebase
    const url = new URL(firebaseLink);
    const oobCode = url.searchParams.get("oobCode");
    
    // Crear nuestro propio link personalizado
    // Usar el dominio actual o un dominio hardcodeado de producción
    const host = req.headers.get("host") || process.env.NEXT_PUBLIC_DOMAIN || "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const verificationLink = `${protocol}://${host}/auth/verify-email?oobCode=${oobCode}`;

    // Inicializar Resend
    const resend = new Resend(process.env.RESEND_API_KEY);

    console.log("[send-verification-email] Iniciando envío:", {
      to: email,
      from: "noreply@vaneshopart.com",
      apiKeyExists: !!process.env.RESEND_API_KEY,
    });

    // Enviar SOLO con el dominio verificado
    const emailResponse = await resend.emails.send({
      from: "noreply@vaneshopart.com",
      to: email,
      subject: "Verifica tu cuenta",
      html: buildVerificationEmailHTML(verificationLink),
      headers: {
        "X-Priority": "3",
        "X-MSMail-Priority": "Normal",
        "Precedence": "transactional",
        "X-Mailer": "Resend",
        "List-Unsubscribe": "<mailto:unsubscribe@vaneshopart.com>",
        "X-Entity-Ref-ID": "transactional",
        "X-Auto-Response-Suppress": "All",
      },
      replyTo: "soporte@vaneshopart.com",
    });

    console.log("[send-verification-email] Respuesta de Resend:", emailResponse);

    if (emailResponse.error) {
      throw new Error(`Resend error: ${JSON.stringify(emailResponse.error)}`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[send-verification-email] Error:", err);
    return NextResponse.json(
      { error: err.message || "Error al enviar correo de verificación" },
      { status: 500 }
    );
  }
}
