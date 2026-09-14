"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

const Contacto: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const x = (clientX / innerWidth - 0.5) * 20;
      const y = (clientY / innerHeight - 0.5) * 20;
      heroRef.current.style.setProperty("--mx", `${x}px`);
      heroRef.current.style.setProperty("--my", `${y}px`);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const copyEmail = () => {
    // TODO: confirmar el correo real de vaneseshop — este es un placeholder
    navigator.clipboard.writeText("hola@vaneseshop.com");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600&family=Cormorant+Garamond:ital,wght@1,300;1,400&display=swap');

        /* ─── ROOT ─── */
        .ct-root {
          background: var(--bg);
          min-height: 100vh;
          font-family: 'Outfit', sans-serif;
          color: var(--text);
          overflow-x: hidden;
        }

        /* ─── NOISE ─── */
        .ct-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
        }

        /* ─── HERO ─── */
        .ct-hero {
          position: relative;
          min-height: 52vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 80px 24px 60px;
          overflow: hidden;
          --mx: 0px;
          --my: 0px;
        }

        /* Orb dorado */
        .ct-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          transform: translate(var(--mx), var(--my));
          transition: transform 0.8s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .ct-orb-1 {
          width: 600px;
          height: 600px;
          top: -200px;
          left: 50%;
          margin-left: -300px;
          background: radial-gradient(circle, rgba(220,180,50,0.1) 0%, transparent 65%);
        }

        .ct-orb-2 {
          width: 300px;
          height: 300px;
          top: -60px;
          left: 50%;
          margin-left: -150px;
          background: radial-gradient(circle, rgba(220,180,50,0.16) 0%, transparent 60%);
        }

        /* Líneas de fondo decorativas */
        .ct-grid-lines {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(220,180,50,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(220,180,50,0.03) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 0%, black 0%, transparent 100%);
        }

        .ct-badge {
          position: relative;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid color-mix(in srgb, var(--secondary) 35%, transparent);
          color: var(--secondary);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          padding: 5px 14px;
          border-radius: 2px;
          margin-bottom: 28px;
        }

        .ct-badge-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--secondary);
          animation: ct-pulse 2s ease-in-out infinite;
        }

        @keyframes ct-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }

        .ct-title {
          position: relative;
          z-index: 2;
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(70px, 14vw, 130px);
          letter-spacing: 0.05em;
          line-height: 0.88;
          color: #3d2b20;
          margin-bottom: 20px;
        }

        .ct-title span {
          color: var(--secondary);
          font-style: italic;
          font-family: 'Cormorant Garamond', serif;
          font-size: 0.75em;
          display: block;
          letter-spacing: 0.02em;
        }

        .ct-subtitle {
          position: relative;
          z-index: 2;
          color: color-mix(in srgb, #3d2b20 70%, transparent);
          font-size: 13px;
          font-weight: 300;
          max-width: 380px;
          line-height: 1.7;
        }

        .ct-divider {
          position: relative;
          z-index: 2;
          width: 60px;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--secondary), transparent);
          margin: 28px auto;
        }

        /* ─── MAIN GRID ─── */
        .ct-main {
          position: relative;
          z-index: 1;
          max-width: 960px;
          margin: 0 auto;
          padding: 0 24px 100px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        @media (min-width: 640px) {
          .ct-main {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (min-width: 960px) {
          .ct-main {
            grid-template-columns: 1.4fr 1fr 1fr;
          }
        }

        /* ─── CARD BASE ─── */
        .ct-card {
          border-radius: 14px;
          border: 1px solid rgba(247,237,227,0.08);
          background: #3d2b20;
          padding: 28px;
          cursor: pointer;
          transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s;
          text-decoration: none;
          color: inherit;
          display: flex;
          flex-direction: column;
          gap: 12px;
          opacity: 0;
          animation: ct-fadeUp 0.5s ease forwards;
        }

        .ct-card:hover {
          border-color: color-mix(in srgb, var(--secondary) 30%, transparent);
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--secondary) 10%, transparent), 0 24px 60px rgba(0,0,0,0.6);
          transform: translateY(-3px);
        }

        @keyframes ct-fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .ct-card:nth-child(1) { animation-delay: 0.05s; }
        .ct-card:nth-child(2) { animation-delay: 0.12s; }
        .ct-card:nth-child(3) { animation-delay: 0.19s; }
        .ct-card:nth-child(4) { animation-delay: 0.26s; }
        .ct-card:nth-child(5) { animation-delay: 0.33s; }

        /* ─── CARD WHATSAPP — FEATURED ─── */
        .ct-card-wa {
          grid-column: 1 / -1;
          background: linear-gradient(135deg, #3d2b20 0%, #2f2118 100%);
          border-color: rgba(220,180,50,0.18);
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
        }

        @media (min-width: 960px) {
          .ct-card-wa {
            grid-column: 1 / 2;
            grid-row: 1 / 3;
            flex-direction: column;
            align-items: flex-start;
            justify-content: space-between;
          }
        }

        .ct-card-wa:hover {
          border-color: color-mix(in srgb, var(--secondary) 40%, transparent);
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--secondary) 15%, transparent), 0 30px 80px rgba(0,0,0,0.7), inset 0 1px 0 color-mix(in srgb, var(--secondary) 10%, transparent);
        }

        /* ─── ICON ─── */
        .ct-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          border: 1px solid color-mix(in srgb, var(--secondary) 20%, transparent);
          background: color-mix(in srgb, var(--secondary) 6%, transparent);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--secondary);
          flex-shrink: 0;
        }

        .ct-card-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: color-mix(in srgb, #f7ede3 70%, transparent);
        }

        .ct-card-value {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 28px;
          letter-spacing: 0.04em;
          color: #f7ede3;
          line-height: 1;
        }

        .ct-card-value-lg {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(32px, 5vw, 44px);
          letter-spacing: 0.04em;
          color: #f7ede3;
          line-height: 1;
        }

        .ct-card-sub {
          font-size: 12px;
          color: color-mix(in srgb, #f7ede3 70%, transparent);
          font-weight: 300;
          line-height: 1.5;
        }

        .ct-card-sub strong {
          color: var(--secondary);
          font-weight: 500;
        }

        /* ─── CTA BUTTON ─── */
        .ct-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--secondary);
          color: var(--secondaryForeground);
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 12px 22px;
          border-radius: 6px;
          text-decoration: none;
          transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
          border: none;
          cursor: pointer;
          width: fit-content;
        }

        .ct-cta:hover {
          background: var(--secondaryHover);
          transform: translateY(-1px);
          box-shadow: 0 8px 24px color-mix(in srgb, var(--secondary) 30%, transparent);
        }

        /* ─── COPY BTN ─── */
        .ct-copy-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: 1px solid color-mix(in srgb, var(--secondary) 25%, transparent);
          color: var(--secondary);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.08em;
          padding: 7px 14px;
          border-radius: 5px;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
          font-family: 'Outfit', sans-serif;
          width: fit-content;
        }

        .ct-copy-btn:hover {
          background: color-mix(in srgb, var(--secondary) 8%, transparent);
          border-color: color-mix(in srgb, var(--secondary) 50%, transparent);
        }

        /* ─── HORARIO ─── */
        .ct-horario-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid rgba(247,237,227,0.06);
          font-size: 12px;
        }

        .ct-horario-row:last-child { border-bottom: none; }

        .ct-horario-day { color: color-mix(in srgb, #f7ede3 70%, transparent); font-weight: 400; }
        .ct-horario-time { color: #f7ede3; font-weight: 500; }
        .ct-horario-closed { color: color-mix(in srgb, #f7ede3 45%, transparent); }

        /* ─── SOCIAL LINK ─── */
        .ct-social-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(247,237,227,0.06);
          text-decoration: none;
          transition: padding-left 0.2s;
          color: inherit;
        }

        .ct-social-link:last-child { border-bottom: none; }

        .ct-social-link:hover {
          padding-left: 6px;
        }

        .ct-social-platform {
          font-size: 11px;
          color: color-mix(in srgb, #f7ede3 70%, transparent);
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          width: 70px;
          flex-shrink: 0;
        }

        .ct-social-handle {
          font-size: 13px;
          color: #f7ede3;
          font-weight: 400;
        }

        .ct-social-arrow {
          margin-left: auto;
          color: var(--secondary);
          font-size: 16px;
          opacity: 0;
          transform: translateX(-4px);
          transition: opacity 0.2s, transform 0.2s;
        }

        .ct-social-link:hover .ct-social-arrow {
          opacity: 1;
          transform: translateX(0);
        }

        /* ─── LOCATION CARD ─── */
        .ct-location-card {
          background: linear-gradient(135deg, #3d2b20, #2f2118);
        }

        .ct-location-pin {
          font-size: 32px;
          line-height: 1;
        }

        .ct-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          color: var(--secondary);
          border: 1px solid color-mix(in srgb, var(--secondary) 25%, transparent);
          padding: 3px 10px;
          border-radius: 20px;
          font-weight: 500;
          letter-spacing: 0.05em;
          margin-top: 4px;
          width: fit-content;
        }

        /* ─── FOOTER ─── */
        .ct-footer {
          position: relative;
          z-index: 1;
          text-align: center;
          border-top: 1px solid rgba(247,237,227,0.06);
          padding: 40px 24px;
          margin-top: 10px;
        }

        .ct-footer p {
          font-size: 12px;
          color: color-mix(in srgb, #3d2b20 60%, transparent);
          margin-bottom: 16px;
          font-weight: 300;
        }

        .ct-footer a {
          color: var(--secondary);
          font-size: 12px;
          text-decoration: none;
          letter-spacing: 0.05em;
        }

        .ct-footer a:hover { text-decoration: underline; }
      `}</style>

      <div className="ct-root">

        {/* ── HERO ── */}
        <div className="ct-hero" ref={heroRef}>
          <div className="ct-grid-lines" />
          <div className="ct-orb ct-orb-1" />
          <div className="ct-orb ct-orb-2" />

          <div className="ct-badge">
            <div className="ct-badge-dot" />
            vaneshop · Guayaquil
          </div>

          <h1 className="ct-title">
            CONTÁCTANOS
            <span>piezas con identidad e historia</span>
          </h1>

          <div className="ct-divider" />

          <p className="ct-subtitle">
            Cuéntanos qué buscas y te ayudamos a encontrar o crear la pieza ideal. Respuesta rápida por WhatsApp.
          </p>
        </div>

        {/* ── GRID ── */}
        <div className="ct-main">

          {/* WHATSAPP — featured */}
          <a
            href="https://wa.me/593984880468"
            target="_blank"
            rel="noreferrer"
            className="ct-card ct-card-wa"
          >
            <div>
              <div className="ct-icon-wrap" style={{ marginBottom: 16 }}>
                {/* WhatsApp icon */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.564 4.14 1.546 5.877L.057 23.57a.75.75 0 0 0 .921.921l5.694-1.489A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.699 9.699 0 0 1-4.966-1.366l-.356-.211-3.682.963.982-3.587-.232-.37A9.695 9.695 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
                </svg>
              </div>

              <div className="ct-card-label" style={{ marginBottom: 8 }}>WhatsApp directo</div>
              <div className="ct-card-value-lg">+593 98 488 0468</div>
              <p className="ct-card-sub" style={{ marginTop: 10 }}>
                La forma más rápida de contactarnos.<br />
                <strong>Respuesta en minutos</strong> durante horario de atención.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
              <div className="ct-cta">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.564 4.14 1.546 5.877L.057 23.57a.75.75 0 0 0 .921.921l5.694-1.489A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.699 9.699 0 0 1-4.966-1.366l-.356-.211-3.682.963.982-3.587-.232-.37A9.695 9.695 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
                </svg>
                Abrir WhatsApp
              </div>
              <p style={{ fontSize: 10, color: "color-mix(in srgb, #f7ede3 30%, transparent)", letterSpacing: "0.05em" }}>
                También puedes escanearnos desde otro dispositivo
              </p>
            </div>
          </a>

          {/* HORARIO */}
          <div className="ct-card" style={{ animationDelay: "0.12s" }}>
            <div className="ct-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div className="ct-card-label">Horario de atención</div>

            {/* TODO: confirmar horario real de vaneseshop — se mantiene el de referencia por ahora */}
            <div style={{ marginTop: 4 }}>
              {[
                { day: "Lunes – Viernes", time: "9:00 – 18:00" },
                { day: "Sábados", time: "9:00 – 13:00" },
                { day: "Domingos", time: null },
                { day: "Feriados", time: null },
              ].map((row) => (
                <div className="ct-horario-row" key={row.day}>
                  <span className="ct-horario-day">{row.day}</span>
                  {row.time
                    ? <span className="ct-horario-time">{row.time}</span>
                    : <span className="ct-horario-closed">Cerrado</span>
                  }
                </div>
              ))}
            </div>

            <p className="ct-card-sub" style={{ marginTop: 6 }}>
              Fuera de horario respondemos al siguiente día hábil.
            </p>
          </div>

          {/* CORREO */}
          <div className="ct-card" style={{ animationDelay: "0.19s" }}>
            <div className="ct-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </div>
            <div className="ct-card-label">Correo electrónico</div>
            {/* TODO: confirmar el correo real — este es un placeholder */}
            <div className="ct-card-value" style={{ fontSize: "16px", wordBreak: "break-all" }}>
              hola@vaneseshop.com
            </div>
            <p className="ct-card-sub">Para consultas formales, pedidos personalizados y garantías.</p>
            <button className="ct-copy-btn" onClick={copyEmail}>
              {copied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  ¡Copiado!
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copiar correo
                </>
              )}
            </button>
          </div>

          {/* REDES SOCIALES */}
          <div className="ct-card" style={{ animationDelay: "0.26s" }}>
            <div className="ct-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </div>
            <div className="ct-card-label">Redes sociales</div>

            <div style={{ marginTop: 4 }}>
              <a
                href="https://www.instagram.com/vaneseshop/"
                target="_blank"
                rel="noreferrer"
                className="ct-social-link"
              >
                <span className="ct-social-platform">Instagram</span>
                <span className="ct-social-handle">@vaneseshop</span>
                <span className="ct-social-arrow">→</span>
              </a>
              <a
                href="https://www.facebook.com/vaneseshop/"
                target="_blank"
                rel="noreferrer"
                className="ct-social-link"
              >
                <span className="ct-social-platform">Facebook</span>
                <span className="ct-social-handle">vaneseshop</span>
                <span className="ct-social-arrow">→</span>
              </a>
              <a
                href="https://www.tiktok.com/@vaneseshop"
                target="_blank"
                rel="noreferrer"
                className="ct-social-link"
              >
                <span className="ct-social-platform">TikTok</span>
                <span className="ct-social-handle">@vaneseshop</span>
                <span className="ct-social-arrow">→</span>
              </a>
            </div>

            <p className="ct-card-sub" style={{ marginTop: 8 }}>
              Síguenos para ver las nuevas piezas y lanzamientos.
            </p>
          </div>

          {/* UBICACIÓN */}
          <div className="ct-card ct-location-card" style={{ animationDelay: "0.33s" }}>
            <div className="ct-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div className="ct-card-label">Ubicación</div>
            <div className="ct-card-value" style={{ fontSize: "22px" }}>Guayaquil, Ecuador</div>
            <div className="ct-tag">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Envíos a todo Ecuador
            </div>
            <p className="ct-card-sub" style={{ marginTop: 8 }}>
              Piezas hechas a mano bajo el Método TransformArte, con envío por courier a todo el país.
            </p>
          </div>

        </div>

        {/* ── FOOTER ── */}
        <div className="ct-footer">
          <p>© {new Date().getFullYear()} vaneshop. Todos los derechos reservados.</p>
          <Link href="/">← Volver al inicio</Link>
        </div>

      </div>
    </>
  );
};

export default Contacto;