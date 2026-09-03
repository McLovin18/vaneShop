"use client";

import React from "react";

const WhatsAppFloatingButton: React.FC = () => {
  return (
    <>
      <style>{`
        .wa-float {
          position: fixed;
          bottom: 5.25rem;
          right: 1.25rem;
          z-index: 50;

        }

        @media (min-width: 768px) {
          .wa-float {
            bottom: 1.75rem;
            right: 1.75rem;
          }
        }

        .wa-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .wa-btn {
          position: relative;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: #25D366;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1),
                      box-shadow 0.22s ease;
          box-shadow: 0 4px 16px rgba(37, 211, 102, 0.35);
        }

        @media (min-width: 768px) {
          .wa-btn {
            width: 58px;
            height: 58px;
          }
        }

        .wa-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 24px rgba(37, 211, 102, 0.45);
        }

        .wa-btn:active {
          transform: scale(0.95);
        }

        .wa-btn svg {
          width: 46px;
          height: 46px;
          fill: white;
          flex-shrink: 0;
        }

        @media (min-width: 768px) {
          .wa-btn svg {
            width: 52px;
            height: 52px;
          }
        }

        .wa-tooltip {
          position: absolute;
          right: calc(100% + 12px);
          top: 50%;
          transform: translateY(-50%) translateX(-4px);
          background: #111827;
          color: #f9fafb;
          font-family: var(--font-body-family);
          font-size: 12.5px;
          font-style: var(--font-body-style);
          font-weight: var(--font-body-weight);
          padding: 6px 12px;
          border-radius: 8px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.18s ease, transform 0.18s ease;
        }

        .wa-tooltip::before {
          content: '';
          position: absolute;
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          border: 5px solid transparent;
          border-left-color: #111827;
        }

        .wa-wrap:hover .wa-tooltip {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }
      `}</style>

      <a
        href="https://wa.me/593984880468"
        target="_blank"
        rel="noreferrer"
        aria-label="WhatsApp Marca Estilo"
        className="wa-float"
      >
        <div className="wa-wrap">
          <span className="wa-tooltip">Chatea con nosotros</span>

          <div className="wa-btn">
            <svg
              viewBox="0 0 32 32"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.478-1.318.13-.33.244-.73.244-1.088 0-.058 0-.144-.03-.215-.1-.172-2.434-1.39-2.678-1.39zm-2.908 7.593c-1.747 0-3.48-.53-4.942-1.49L7.793 24.41l1.132-3.337a8.955 8.955 0 0 1-1.72-5.272c0-4.955 4.04-8.995 8.997-8.995S25.2 10.845 25.2 15.8c0 4.958-4.04 8.998-8.998 8.998zm0-19.798c-5.96 0-10.8 4.842-10.8 10.8 0 1.964.53 3.898 1.546 5.574L5 27.176l5.974-1.92a10.807 10.807 0 0 0 16.03-9.455c0-5.958-4.842-10.8-10.802-10.8z" />
            </svg>
          </div>
        </div>
      </a>
    </>
  );
};




export default WhatsAppFloatingButton;