"use client";
import BottomBarPublic from "../../components/BottomBarPublic";
import ProductoCard from "../../components/ProductoCard";
import { Loading3DIcon } from "../../components/Loading3DIcon";

import { useEffect, useState, useMemo, useRef } from "react";

import { 
  obtenerProductosPorBodega
} from "../../lib/productos-db";
import { obtenerBodegas } from "../../lib/bodegas-db";
import {
  obtenerCategorias,
  mapCategorySnapshot,
  sortCategoriasByOrder,
  sameCategoryId,
} from "../../lib/categorias-db";
import { useUser } from "../../context/UserContext";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function NuevaColeccionPage() {
  const isLogged = useUser();

  // --- Estados de datos ---
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [bodegaNombre, setBodegaNombre] = useState("");
  const [categorias, setCategorias] = useState<any[]>([]);
  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  // --- Estados de filtros ---
  const [search, setSearch] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Mapeo de nombres de categorías
  const [catMap, setCatMap] = useState<any>({});
  
  function getCategoryName(id: string) {
    return catMap[id] || id;
  }

  // 1. Control de Montaje
  useEffect(() => {
    setIsMounted(true);
    const loggedIn = Boolean(localStorage.getItem("token"));
    setIsAuthenticated(loggedIn);
  }, []);

  // 2. Cargar categorías
  useEffect(() => {
    async function fetchCategorias() {
      const cats = await obtenerCategorias();
      const catObj: any = {};
      cats.forEach((cat: any) => {
        catObj[cat.id] = cat.nombre || cat.id;
      });
      setCatMap(catObj);
    }
    fetchCategorias();
  }, []);

  // 3. Cargar categorías en tiempo real
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "categorias"),
      (snap) => {
        setCategorias(sortCategoriasByOrder(mapCategorySnapshot(snap.docs)));
      }
    );
    return () => unsub();
  }, []);

  // 4. Fetch bodega Nueva Colección y luego productos
  useEffect(() => {
    async function fetchProductos() {
      setLoading(true);
      try {
        // Obtener todas las bodegas y buscar la que tiene esNuevaColeccion: true
        const bodegas = await obtenerBodegas();
        const bodegaNuevaColeccion = bodegas.find(b => b.esNuevaColeccion === true);
        
        if (bodegaNuevaColeccion) {
          setBodegaNombre(bodegaNuevaColeccion.nombre);
          // Obtener productos de esa bodega
          const prods = await obtenerProductosPorBodega(bodegaNuevaColeccion.id);
          setProductos(prods || []);
        } else {
          // Si no hay bodega marcada, mostrar vacío
          setProductos([]);
          setBodegaNombre("");
        }
      } catch (error) {
        console.error("Error fetching Nueva Colección:", error);
        setProductos([]);
      } finally {
        setLoading(false);
      }
    }
    fetchProductos();
  }, []);

  // 5. Filtrado (Memoizado)
  const productosFiltrados = useMemo(() => {
    let filtered = [...productos];
    
    // Filtro por búsqueda
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((p: any) =>
        (p.nombre?.toLowerCase() || "").includes(searchLower) ||
        (p.descripcion?.toLowerCase() || "").includes(searchLower)
      );
    }
    
    // Filtro por categoría
    if (categoriaId) {
      filtered = filtered.filter((p: any) =>
        sameCategoryId(p.categoria, categoriaId)
      );
    }
    
    return filtered;
  }, [productos, search, categoriaId]);

  // --- Paginación responsive: 10 productos en móvil, cols*3 en desktop ---
  const [currentPage, setCurrentPage] = useState(1);
  const getProductsPerPage = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) return 10; // móvil
      if (window.innerWidth >= 1024) return 4 * 3; // lg: 4 cols x 3 filas
      if (window.innerWidth >= 768) return 3 * 3; // md: 3 cols x 3 filas
      if (window.innerWidth >= 640) return 2 * 3; // sm: 2 cols x 3 filas
    }
    return 10;
  };
  const [productsPerPage, setProductsPerPage] = useState(getProductsPerPage());
  useEffect(() => {
    function handleResize() {
      setProductsPerPage(getProductsPerPage());
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const totalPages = Math.ceil(productosFiltrados.length / productsPerPage);
  
  // Resetear a página 1 cuando cambia el filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [productosFiltrados.length, search, categoriaId]);
  
  const paginatedProducts = useMemo(() => {
    return productosFiltrados.slice((currentPage - 1) * productsPerPage, currentPage * productsPerPage);
  }, [productosFiltrados, currentPage, productsPerPage]);

  // --- Helpers de Estilo ---
  const inputCls =
    "px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-#e8c862 transition-all";

  return (
    <div className="min-h-screen flex flex-col transition-colors" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <BottomBarPublic />

      <main className="max-w-350 mx-auto w-full px-3 sm:px-5 py-8 flex-1">
        {/* Cabecera */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-1">
            Nueva Colección
          </h1>
          {bodegaNombre && (
            <p className="text-sm text-slate-500 dark:text-white/50">
              {bodegaNombre}
            </p>
          )}
        </div>

        {/* Búsqueda */}
        <div className="dark:bg-white/3 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3.5 mb-5 shadow-sm">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-40 max-w-[min(75vw,300px)] sm:max-w-sm">
              <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 text-[17px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar productos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputCls} w-full pl-9 pr-8`}
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white/80">
                  <span className="material-icons-round text-[15px]">close</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Categorías Filter - Scroll Horizontal ────────────── */}
        {categorias.length > 0 && (
          <div className="mb-6 overflow-x-auto pb-2" ref={categoriesScrollRef}>
            <div className="flex gap-2 min-w-max">
              <button
                onClick={() => {
                  setCategoriaId("");
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium text-sm transition-all ${
                  !categoriaId
                    ? "shadow-sm scale-105 bg-black text-white border border-black"
                    : "bg-white text-slate-900 border border-slate-300 hover:border-black/60 hover:shadow-sm"
                }`}
              >
                Todas
              </button>
              {categorias.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setCategoriaId(cat.id);
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-full whitespace-nowrap font-medium text-sm transition-all ${
                    categoriaId === cat.id
                      ? "shadow-sm scale-105 bg-black text-white border border-black"
                      : "bg-white text-slate-900 border border-slate-300 hover:border-black/60 hover:shadow-sm"
                  }`}
                >
                  {cat.icono && <span className="mr-1">🏷️</span>}
                  {cat.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grid de productos o Loading */}
        {(!isMounted || loading) ? (
          <div className="flex flex-col items-center justify-center py-32 transition-opacity duration-500">
            <Loading3DIcon />
            <p className="text-xs text-slate-400 dark:text-white/20 mt-6 font-medium tracking-widest uppercase">Cargando catálogo</p>
          </div>
        ) : productosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
              <span className="material-icons-round text-3xl text-slate-300 dark:text-white/20">search_off</span>
            </div>
            <div>
              <p className="font-semibold text-slate-700 dark:text-white/80">Sin resultados</p>
              <p className="text-sm text-slate-400 dark:text-white/30 mt-1 max-w-60">Prueba otros términos o selecciona otra categoría</p>
            </div>
          </div>
        ) : (
          <>
            <div className={`grid grid-cols-2 gap-2 lg:grid-cols-5 animate-in fade-in duration-700`}>
              {paginatedProducts.map((p: any) => (
                <ProductoCard
                  key={p.id}
                  producto={p}
                  showCart
                  showEye
                  showFav={isAuthenticated}
                  isCompact={false}
                />
              ))}
            </div>
            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex flex-wrap justify-center items-center gap-2 mt-8 select-none w-full">
                <button
                  className="px-3 py-1.5 rounded border text-xs font-medium bg-white border-slate-300 text-slate-900 hover:border-black/60 transition-all disabled:opacity-40"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  &lt;
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    className={`px-3 py-1.5 rounded border text-xs font-medium transition-all ${currentPage === n ? 'bg-black border-black text-white shadow-sm' : 'bg-white border-slate-300 text-slate-900 hover:border-black/60'}`}
                    onClick={() => setCurrentPage(n)}
                  >
                    {n}
                  </button>
                ))}
                <button
                  className="px-3 py-1.5 rounded border text-xs font-medium bg-white border-slate-300 text-slate-900 hover:border-black/60 transition-all disabled:opacity-40"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  &gt;
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
