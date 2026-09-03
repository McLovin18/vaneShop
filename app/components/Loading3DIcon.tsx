"use client";

import React from "react";
import Image from "next/image";

export function Loading3DIcon() {
  return (
    <div className="flex flex-col items-center justify-center py-10 select-none">

      {/* CONTENEDOR */}
      <div
        className="relative w-40 h-40 flex items-center justify-center"
        style={{ perspective: "1000px" }}
      >

        {/* Glow principal */}
        <div className="
          absolute inset-0
          bg-black/15
          blur-3xl
          rounded-full
          animate-pulse
        " />

        {/* Ring exterior */}
        <div className="
          absolute inset-2
          rounded-full
          border border-black/15
        " />

        {/* Ring animado */}
        <div
          className="
            absolute inset-0
            rounded-full
            border-2 border-transparent
            border-t-black
            animate-spin
          "
          style={{ animationDuration: "2.5s" }}
        />

        {/* Balde flotando y rotando en 3D */}
        <div
          className="relative w-24 h-24 balde-spin"
          style={{ transformStyle: "preserve-3d" }}
        >
          <Image
            src="/logo_vs.png"
            alt="Balde de la marca"
            fill
            className="object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.30)]"
            priority
          />
        </div>

        {/* Sombra de contacto que "respira" con el giro */}
        <div className="absolute -bottom-3 w-20 h-3 bg-black/25 rounded-full blur-md balde-shadow" />
      </div>

      {/* Texto */}
      <div className="mt-6 flex flex-col items-center">

        <span className="
          text-[11px]
          font-bold
          tracking-[0.35em]
          uppercase
          text-black
        ">
          Vane's Shop
        </span>

        <div className="flex gap-1.5 mt-3 items-center">
          <div className="flex gap-1.5 animate-loadingSteps">
            <div className="w-1.5 h-1.5 rounded-full bg-black" />
            <div className="w-1.5 h-1.5 rounded-full bg-black" />
            <div className="w-1.5 h-1.5 rounded-full bg-black" />
          </div>
        </div>
      </div>
    </div>
  );
}