"use client";
import React from "react";
import Link from "next/link";

const Sidebar = ({ role = "admin" }) => {
  const adminItems = [
    { name: "Dashboard", path: "/admin", icon: "dashboard" },
    { name: "Inventario", path: "/admin/inventario", icon: "inventory" },
    { name: "Órdenes", path: "/admin/pedidos", icon: "receipt" },
    { name: "Cuentas bancarias", path: "/admin/cuentas-bancarias", icon: "account_balance" },
    { name: "Reseñas", path: "/admin/reviews", icon: "rate_review" },
    { name: "Editar landing", path: "/admin/edit-landing", icon: "edit" },
    { name: "Editar blogs", path: "/admin/edit-blogs", icon: "library_books" },
    { name: "Perfil", path: "/admin/perfil", icon: "person" },
    { name: "Zonas de entrega", path: "/admin/zonas-entrega", icon: "local_shipping" },
    { name: "Configuración", path: "/admin/config", icon: "settings" },
  ];
  const items = adminItems;
  return (
    <aside className="hidden lg:flex flex-col w-56 min-h-screen bg-white dark:bg-black border-r border-slate-200 dark:border-slate-700 shadow-md px-6 py-4">
      <ul className="space-y-2">
        {items.map((item) => {
          let onboardingAttr = {};
          if (item.name === "Productos") onboardingAttr = { 'data-onboarding': 'productos' };
          if (item.name === "Ordenes") onboardingAttr = { 'data-onboarding': 'ordenes' };
          if (item.name === "Configuración") onboardingAttr = { 'data-onboarding': 'configuracion' };
          if (item.name === "Favoritos") onboardingAttr = { 'data-onboarding': 'favoritos' };
          if (item.name === "Inicio") onboardingAttr = { 'data-onboarding': 'inicio' };
          return (
            <li key={item.path}>
              <Link href={item.path} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-[#3a1859] dark:text-white font-medium" {...onboardingAttr}>
                <span className="material-icons-round text-xl">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};

export default Sidebar;
