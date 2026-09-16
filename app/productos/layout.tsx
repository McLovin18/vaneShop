// Layout para forzar renderizado dinámico en esta ruta
export const dynamic = 'force-dynamic';

export default function ProductosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
