// Layout para forzar renderizado dinámico en esta ruta
export const dynamic = 'force-dynamic';

export default function ProductDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
