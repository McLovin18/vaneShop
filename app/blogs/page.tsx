"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loading3DIcon } from "../components/Loading3DIcon";
import type { Blog } from "../lib/blog-types";
import BottomBarPublic from "../components/BottomBarPublic";

export default function BlogsPage() {
  const router = useRouter();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { getPublishedBlogs } = await import("../lib/blogs-db");
        setBlogs(await getPublishedBlogs());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleBlogClick(id: string) {
    const { trackClick } = await import("../lib/analytics-db");
    trackClick("blogClick").catch(console.error);
    router.push(`/blogs/${id}`);
  }

  const featured = blogs.find((b) => b.featured);
  const others = blogs.filter((b) => !b.featured);

  return (
    <div
      style={{
        background: "var(--bg)",
        color: "var(--text)",
      }}
      className="min-h-screen flex flex-col"
    >
      <main className="max-w-6xl mx-auto px-4 py-8 lg:px-6 flex-1">
        <BottomBarPublic/>
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--text)" }}>
          Blog de Juliana Basics
        </h1>
        <p
          className="mb-12"
          style={{ color: "var(--textSecondary)" }}
        >
          Artículos, tutoriales y noticias sobre tecnología
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loading3DIcon />
          </div>
        ) : blogs.length === 0 ? (
          <div className="text-center py-12">
            <span
              className="material-icons-round text-6xl opacity-30"
              style={{ color: "var(--textSecondary)" }}
            >
              article
            </span>
            <h3 className="text-xl font-semibold mt-4" style={{ color: "var(--text)" }}>
              No hay artículos disponibles
            </h3>
          </div>
        ) : (
          <>
            {featured && (
              <section className="mb-12">
                <h2 className="text-2xl font-semibold mb-4">Blog destacado</h2>
                <button
                  type="button"
                  onClick={() => handleBlogClick(featured.id)}
                  className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition flex flex-col md:flex-row"
                >
                  {featured.blocks?.some((b) => b.type === "image") && (
                    <div className="w-full md:w-1/3 h-48 md:h-auto flex-shrink-0">
                      {featured.blocks
                        .find((b) => b.type === "image")
                        ?.type === "image" && (
                        <img
                          src={
                            featured.blocks.find((b) => b.type === "image")?.type === "image"
                              ? featured.blocks.find((b) => b.type === "image")?.url
                              : ""
                          }
                          alt={
                            featured.blocks.find((b) => b.type === "image")?.type === "image"
                              ? featured.blocks.find((b) => b.type === "image")?.alt || featured.title
                              : ""
                          }
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  )}
                  <div className="p-6 flex flex-col justify-center flex-1">
                    <h3 className="text-xl font-bold mb-2">{featured.title}</h3>
                    {featured.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">
                        {featured.description}
                      </p>
                    )}
                    <div className="inline-flex items-center gap-1 text-sm text-#E0A11A dark:text-#f5d890 mt-1 w-fit">
                      <span className="material-icons-round text-base">visibility</span>
                      <span>Leer artículo completo</span>
                    </div>
                  </div>
                </button>
              </section>
            )}

            {others.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4">Todos los artículos</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {others.map((b) => {
                    const imageBlock = b.blocks?.find((block) => block.type === "image");
                    return (
                      <article
                        key={b.id}
                        onClick={() => handleBlogClick(b.id)}
                        className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm flex flex-col cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition"
                      >
                        {imageBlock && imageBlock.type === "image" && (
                          <div className="w-full h-40 overflow-hidden">
                            <img
                              src={imageBlock.url}
                              alt={imageBlock.alt || b.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-4 flex flex-col flex-1">
                          <h3 className="text-lg font-semibold mb-2">{b.title}</h3>
                          {b.description && (
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-3 flex-1">
                              {b.description}
                            </p>
                          )}
                          <div className="inline-flex items-center gap-1 text-xs text-#E0A11A dark:text-#f5d890 mt-auto">
                            <span className="material-icons-round text-sm">arrow_forward</span>
                            <span>Ver más</span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

