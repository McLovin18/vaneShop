// Layout para forzar renderizado dinámico en esta ruta API
export const dynamic = 'force-dynamic';

export default function ProductoIdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
