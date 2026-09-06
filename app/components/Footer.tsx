"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTracking } from "../lib/useAnalytics";
import WhatsAppFloatingButton from "./WhatsAppFloatingButton";
import styles from "./Footer.module.css";

const IconInstagram = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const IconFacebook = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
    <path d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.6 1.7-1.6h1.8V3.8c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V10H8v3h2.6v8h2.9z" />
  </svg>
);

const IconTikTok = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
    <path d="M15.6 3c.3 1.7 1.3 2.8 3 3v2.8a7.3 7.3 0 0 1-3-.8v6.2a5.2 5.2 0 1 1-4.5-5.1v2.9a2.4 2.4 0 1 0 1.7 2.2V3h2.8z" />
  </svg>
);

const IconLocation = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
    <path d="M12 2C7.589 2 4 5.589 4 9.995 4 15.991 12 22 12 22s8-6.009 8-12.005C20 5.589 16.411 2 12 2zm0 10.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
  </svg>
);

const IconWhatsApp = () => (
  <svg viewBox="0 0 32 32" width="15" height="15" fill="currentColor">
    <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.478-1.318.13-.33.244-.73.244-1.088 0-.058 0-.144-.03-.215-.1-.172-2.434-1.39-2.678-1.39zm-2.908 7.593c-1.747 0-3.48-.53-4.942-1.49L7.793 24.41l1.132-3.337a8.955 8.955 0 0 1-1.72-5.272c0-4.955 4.04-8.995 8.997-8.995S25.2 10.845 25.2 15.8c0 4.958-4.04 8.998-8.998 8.998zm0-19.798c-5.96 0-10.8 4.842-10.8 10.8 0 1.964.53 3.898 1.546 5.574L5 27.176l5.974-1.92a10.807 10.807 0 0 0 16.03-9.455c0-5.958-4.842-10.8-10.802-10.8z" />
  </svg>
);

// 👉 Información del negocio
const WHATSAPP_NUMBER = "593984880468"; // solo números, con código de país, sin '+' ni espacios
const WHATSAPP_DISPLAY = "+593 98 488 0468"; // como se muestra al usuario
const MAPS_URL = "https://l.instagram.com/?u=https%3A%2F%2Fmaps.app.goo.gl%2FB4LVAYLxvMuwXsuE9%3Fg_st%3Dic%26utm_source%3Dig%26utm_medium%3Dsocial%26utm_content%3Dlink_in_bio%26fbclid%3DPAZXh0bgNhZW0CMTEAc3J0YwZhcHBfaWQPOTM2NjE5NzQzMzkyNDU5AAGn_oqrYzsBMtPRc2N2aptDbGXg-iG5-VFhRCD6m4VnleH_jHY5zLezUdJza74_aem_B3z_UlltnRGnSSLfWrFf4w&e=AUD8pWkXfdA34eOteUrOjVR1HPRDj6F7-to54sCO4vLiuhm1_Mlp2-GkL3MlI46kCH00PHVdOMrM-W9V32NSvMywrrydKa5uKx-XFxb_vRVGZuWMIZrLC9G1j6ofwMn3GLJ2er0"; // enlace real de Google Maps

const socialLinks = [
  { href: "https://www.facebook.com/vaneseshop/", label: "Facebook", Icon: IconFacebook },
  { href: "https://www.instagram.com/vaneseshop/", label: "Instagram", Icon: IconInstagram },
  { href: "https://www.tiktok.com/@vaneseshop", label: "TikTok", Icon: IconTikTok },
];

const Footer: React.FC = () => {
  const pathname = usePathname();
  const { trackLinkClick } = useTracking();

  const showWhatsAppFloating = pathname && !pathname.startsWith("/admin");



  return (
    <>
      <footer className={styles.pdxFooter}>

        {/* Main row */}
        <div className={styles.ftMain}>
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 items-center">

            {/* Columna 1: Información de la tienda */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left gap-1">
              <span className="text-base font-bold" style={{ color: "#8a7556" }}>
                vaneseshop
              </span>

              <a
                href="https://www.instagram.com/vaneseshop/"
                target="_blank"
                rel="noreferrer"
                className="mt-1"
                style={{ color: "#8a7556" }}
                onClick={() => trackLinkClick().catch(console.error)}
              >
                <IconInstagram/>
              </a>

              <div className="text-xs mt-1 max-w-[220px]" style={{ color: "#8a7556" }}>
                <p>Vanessa Salazar | Artista Visual</p>
                <p>Piezas con identidad e historia</p>
                <p>Textil • Pintura • Sombreros de autor</p>
              </div>
            </div>

            {/* Columna 2: Redes sociales */}
            <div className="w-full flex justify-center">
              <div className="w-full flex items-center justify-center gap-3">
                <ul className={styles.ftSocials}>
                  {socialLinks.map(({ href, label, Icon }) => (
                    <li key={label}>
                      <a
                        href={href}
                        className="flex items-center justify-center w-9 h-9 rounded-full border transition-colors hover:bg-[#FF3D8A] hover:border-[#FF3D8A] hover:text-black"
                        style={{ borderColor: "rgba(138, 117, 86, 0.3)", color: "#8a7556" }}
                        target="_blank"
                        rel="noreferrer"
                        title={label}
                        onClick={() => trackLinkClick().catch(console.error)}
                      >
                        <Icon />
                      </a>
                    </li>
                  ))}
                </ul>

              </div>
            </div>
            {/* Columna 3: Contacto */}
            <div className="flex flex-col items-center md:items-end gap-2.5">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xl hover:text-[#FF3D8A] transition-colors"
                style={{ color: "#8a7556" }}
                onClick={() => trackLinkClick().catch(console.error)}
              >
                <span>{WHATSAPP_DISPLAY}</span>
                <IconWhatsApp />
              </a>
              <div className="flex items-center gap-1 text-xs" style={{ color: "#8a7556" }}>
                <IconLocation />
                <span>ɢʏᴇ - Via a la Costa</span>
              </div>

            </div>

          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10" />

        {/* Copyright row */}
        <div className={styles.ftCopyRow}>
          <p className="text-xs" style={{ color: "#8a7556" }}>
            © {new Date().getFullYear()} vaneseshop. Todos los derechos reservados.
          </p>
          <div className={styles.ftCopyRight}>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#8a7556" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF3D8A]" />
              Hecho en Ecuador
            </div>

            <a
              href="https://www.instagram.com/hector.cobena/"
              target="_blank"
              rel="noreferrer"
              className="text-xs hover:text-[#FF3D8A] transition-colors"
              style={{ color: "#8a7556" }}
              onClick={() => trackLinkClick().catch(console.error)}
            >
              Desarrollado por Héctor Cobeña
            </a>
          </div>
        </div>

      </footer>
      {showWhatsAppFloating && <WhatsAppFloatingButton />}
    </>
  );
};

export default Footer;