"use client";

import React from "react";

export default function ContactSection() {
  const whatsappNumber = "+593984880468";
  const whatsappLink = `https://wa.me/${whatsappNumber.replace(/\s/g, "")}`;

  return (
    <section className="relative overflow-hidden py-20 px-4 md:px-8" style={{ background: "linear-gradient(135deg, var(--color-mahogany) 0%, var(--color-tobacco) 100%)" }}>
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl opacity-20" style={{ backgroundColor: "var(--color-sand)" }} />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl opacity-20" style={{ backgroundColor: "var(--color-mountain)" }} />
      </div>

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6" style={{ color: "var(--color-vanilla)" }}>
            Contáctanos
          </h2>
          <p className="text-lg md:text-xl max-w-3xl mx-auto leading-relaxed" style={{ color: "var(--color-sand)" }}>
            ¿Te interesa alguna de mis piezas, deseas crear algo personalizado o tienes una propuesta de colaboración? 
            Escríbeme; estaré encantada de conocer tu idea y ayudarte a encontrar una creación que conecte contigo.
          </p>
        </div>

        {/* Contact Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* WhatsApp */}
          <div className="rounded-2xl p-6 border backdrop-blur-sm transition-all hover:scale-105" style={{ backgroundColor: "rgba(255, 255, 255, 0.1)", borderColor: "rgba(255, 255, 255, 0.2)" }}>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "#25D366" }}>
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2" style={{ color: "var(--color-vanilla)" }}>WhatsApp</h3>
              <p className="text-sm" style={{ color: "var(--color-sand)" }}>{whatsappNumber}</p>
            </div>
          </div>

          {/* Email */}
          <div className="rounded-2xl p-6 border backdrop-blur-sm transition-all hover:scale-105" style={{ backgroundColor: "rgba(255, 255, 255, 0.1)", borderColor: "rgba(255, 255, 255, 0.2)" }}>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "var(--color-mountain)" }}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2" style={{ color: "var(--color-vanilla)" }}>Correo</h3>
              <p className="text-sm" style={{ color: "var(--color-sand)" }}>contacto@vanessashop.com</p>
            </div>
          </div>

          {/* Location */}
          <div className="rounded-2xl p-6 border backdrop-blur-sm transition-all hover:scale-105" style={{ backgroundColor: "rgba(255, 255, 255, 0.1)", borderColor: "rgba(255, 255, 255, 0.2)" }}>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "var(--color-tobacco)" }}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2" style={{ color: "var(--color-vanilla)" }}>Ubicación</h3>
              <p className="text-sm" style={{ color: "var(--color-sand)" }}>Guayaquil, Ecuador</p>
            </div>
          </div>

          {/* Shipping */}
          <div className="rounded-2xl p-6 border backdrop-blur-sm transition-all hover:scale-105" style={{ backgroundColor: "rgba(255, 255, 255, 0.1)", borderColor: "rgba(255, 255, 255, 0.2)" }}>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: "#B59E7D" }}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-2" style={{ color: "var(--color-vanilla)" }}>Envíos</h3>
              <p className="text-sm" style={{ color: "var(--color-sand)" }}>A todo Ecuador</p>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex justify-center">
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 font-bold text-lg px-8 py-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
            style={{ backgroundColor: "#25D366", color: "white" }}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            <span>ESCRÍBEME POR WHATSAPP</span>
          </a>
        </div>
      </div>
    </section>
  );
}
