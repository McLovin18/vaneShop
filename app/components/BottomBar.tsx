"use client";
import React from "react";
import Link from "next/link";
import { useUser } from "../context/UserContext";

const adminItems = [
  { name: "Dashboard", path: "/admin", icon: "dashboard" },
  { name: "Inventario", path: "/admin/inventario", icon: "inventory" },
  { name: "Landing", path: "/admin/edit-landing", icon: "edit" },
  { name: "Blogs", path: "/admin/edit-blogs", icon: "library_books" },
  { name: "Perfil", path: "/admin/perfil", icon: "person" },
  { name: "Entregas", path: "/admin/zonas-entrega", icon: "local_shipping" },
  { name: "Config", path: "/admin/config", icon: "settings" },
];


export default function BottomBar({ role = "admin" }) {
  const items = adminItems;
  const { carrito } = useUser();
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full flex overflow-x-auto z-50" style={{ background: "var(--primary)", borderColor: "var(--border)", borderTop: "1px solid var(--border)" }}>
      <ul className="flex w-full justify-between items-center">
        {items.map((item) => (
          <li key={item.path} className="flex-1">
            <Link href={item.path} className="flex flex-col items-center py-3 px-2 hover:bg-[color:var(--primaryHover)]/80 relative transition-colors" style={{ color: "var(--primaryForeground)" }}>
              <span className="material-icons-round text-xl">{item.icon}</span>
              {/* Badge solo para carrito */}
              {(item.icon === "shopping_bag" || item.icon === "shopping_cart") ? (
                carrito && carrito.length > 0 && (
                  <span className="absolute top-0 right-3 bg-[var(--secondary)] text-[var(--secondaryForeground)] text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 z-20" style={{ borderColor: "var(--primary)" }}>
                    {carrito.length}
                  </span>
                )
              ) : null}
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
