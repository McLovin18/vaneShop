// Layout para forzar renderizado dinámico en esta ruta
export const dynamic = 'force-dynamic';

export default function SearchResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
