"use client";

import { useEffect, useState } from "react";
import { obtenerTodasOrdenes, actualizarOrden, deducirStockOrden, devolverStockOrden } from "../../lib/ordenes-db";
import { useUser } from "../../context/UserContext";
import { auth } from "../../lib/firebase";
import { getIdToken } from "firebase/auth";

function getTodayYMD() {
	const now = new Date();
	return now.toISOString().slice(0, 10);
}

export default function PedidosAdminPage() {
	const { user } = useUser();
	const [ordenes, setOrdenes] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState<"pendientes" | "aprobadas">("pendientes");
	const [filtro, setFiltro] = useState("");
	const [clientesMap, setClientesMap] = useState<Record<string, { displayName: string | null; email: string | null }>>({});
	const [fechaDesde, setFechaDesde] = useState<string>("");
	const [fechaHasta, setFechaHasta] = useState<string>("");
	const [expandedTarjetas, setExpandedTarjetas] = useState(false);

	const loadOrdenes = async () => {
		setLoading(true);
		try {
			// Obtener token del usuario logueado actualmente
			const currentUser = auth.currentUser;
			console.log("🔍 loadOrdenes - currentUser:", currentUser?.uid);
			
			if (!currentUser) {
				console.error("❌ No hay usuario logueado");
				setOrdenes([]);
				setLoading(false);
				return;
			}

			const token = await getIdToken(currentUser);
			console.log("🔍 Token obtenido:", token.slice(0, 20) + "...");

			// Usar endpoint API para obtener órdenes
			console.log("🔍 Llamando a /api/admin/ordenes");
			const res = await fetch("/api/admin/ordenes", {
				headers: {
					"Authorization": `Bearer ${token}`,
				},
			});

			console.log("🔍 Response status:", res.status);
			
			if (!res.ok) {
				const errorText = await res.text();
				console.error("❌ Error al obtener órdenes:", res.status, errorText);
				throw new Error(`Error ${res.status}: ${errorText}`);
			}

			const data = await res.json();
			console.log("✅ Órdenes recibidas:", data.length, data);
			setOrdenes(Array.isArray(data) ? data : []);
		} catch (error) {
			console.error("❌ Error cargando órdenes:", error);
			setOrdenes([]);
		}

		try {
			const clientesRes = await fetch("/api/admin/clientes");
			if (!clientesRes.ok) throw new Error("Error al obtener clientes");
			
			const clientesData = await clientesRes.json();
			const map: Record<string, { displayName: string | null; email: string | null }> = {};
			for (const c of (clientesData.clientes || [])) {
				map[c.uid] = { displayName: c.displayName, email: c.email };
			}
			setClientesMap(map);
		} catch (error) {
			console.error("Error cargando clientes:", error);
		}

		setLoading(false);
	};

	useEffect(() => {
		if (user) {
			loadOrdenes();
		}
	}, [user]);

	const calcularSubtotalProducto = (p: any) => {
		const cantidad = Number(p.cantidad || 0);
		if (p.subtotal !== undefined) return Number(p.subtotal || 0);
		const basePrice = p.precioBase !== undefined ? Number(p.precioBase || 0) : Number(p.precio || 0);
		const discount = Number(p.descuento || 0);
		const hasDiscount = !isNaN(discount) && discount > 0 && discount < 100;
		const unitPrice = p.precioUnitario !== undefined
			? Number(p.precioUnitario || 0)
			: (hasDiscount ? basePrice * (1 - discount / 100) : basePrice);
		return unitPrice * cantidad;
	};

	const calcularTotalOrden = (orden: any) => {
		if (typeof orden.total === "number") return orden.total;
		return (orden.productos || []).reduce((sum: number, p: any) => sum + calcularSubtotalProducto(p), 0);
	};

	// Agrupar productos por tiempo de entrega
	const agruparPorTiempoEntrega = (productos: any[]) => {
		return productos.reduce((acc: Record<number, any[]>, p) => {
			const tiempo = p.tiempoEntrega || 72;
			if (!acc[tiempo]) acc[tiempo] = [];
			acc[tiempo].push(p);
			return acc;
		}, {});
	};

	// Obtener resumen de tiempos de entrega
	const obtenerResumenTiempos = (productos: any[]) => {
		const porTiempo = agruparPorTiempoEntrega(productos);
		const tiempos = Object.keys(porTiempo).map(Number).sort((a, b) => a - b);
		return tiempos;
	};

	const aprobarOrden = async (orden: any) => {
		try {
			setLoading(true);

			// Deducir stock cuando se aprueba y actualizar estado
			await deducirStockOrden(orden.id);
			await actualizarOrden(orden.id, { estado: "aprobada" });
			setOrdenes((prev) => prev.map((o) => o.id === orden.id ? { ...o, estado: "aprobada" } : o));
			alert("✅ Orden aprobada exitosamente");
		} catch (error: any) {
			console.error("Error al aprobar orden:", error);
			alert(`❌ Error: ${error.message || "No se pudo aprobar la orden"}`);
		} finally {
			setLoading(false);
		}
	};

	const rechazarOrden = async (orden: any) => {
		const motivo = prompt("Motivo de rechazo (opcional):");
		if (motivo === null) return; // Usuario canceló
		
		try {
			setLoading(true);
			
			// Usar endpoint genérico de rechazo
			const endpoint = "/api/admin/reject-order";
			
			const res = await fetch(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-admin-token": process.env.NEXT_PUBLIC_ADMIN_TOKEN || "",
				},
				body: JSON.stringify({
					orderId: orden.id,
					reason: motivo || "Rechazada por el administrador",
				}),
			});
			
			if (!res.ok) {
				const error = await res.json();
				throw new Error(error.error || `Error ${res.status}`);
			}
			
			const data = await res.json();
			
			// ✅ Actualizar UI localmente
			setOrdenes((prev) =>
				prev.map((o) =>
					o.id === orden.id
						? {
							...o,
							estado: "rechazada",
							motivoRechazo: motivo || "",
						}
						: o
				)
			);
			
			alert(`✅ ${data.message || "Orden rechazada exitosamente y stock devuelto"}`);
		} catch (error: any) {
			console.error("Error al rechazar orden:", error);
			alert(`❌ Error: ${error.message || "No se pudo rechazar la orden"}`);
		} finally {
			setLoading(false);
		}
	};

	// Filtro por rango de fechas de visita
	const estaEnRango = (visitaFecha: string | undefined) => {
		// Si no hay filtro de fechas, mostrar todas las órdenes (incluso sin visitaFecha)
		if (!fechaDesde && !fechaHasta) return true;
		
		// Si hay filtro pero la orden no tiene visitaFecha, no se puede filtrar → mostrar
		if (!visitaFecha) return true;
		
		// Si hay filtro, aplicarlo
		if (fechaDesde && visitaFecha < fechaDesde) return false;
		if (fechaHasta && visitaFecha > fechaHasta) return false;
		return true;
	};

	const matchesBusqueda = (o: any) => {
		if (!filtro.trim()) return true;
		const term = filtro.trim().toLowerCase();
		const clientInfo = o.userId ? clientesMap[o.userId] : null;
		return (
			(o.orderId || "").toLowerCase().includes(term) ||
			(o.userId || "").toLowerCase().includes(term) ||
			(o.guestEmail || "").toLowerCase().includes(term) ||
			(o.userEmail || "").toLowerCase().includes(term) ||
			(clientInfo?.displayName || "").toLowerCase().includes(term) ||
			(clientInfo?.email || "").toLowerCase().includes(term)
		);
	};

	const ordenesPendientes = ordenes.filter((o) =>
		(o.estado === "generada" || o.estado === "pendiente_pago" || o.estado === "pago_fallido") &&
		estaEnRango(o.visitaFecha) &&
		matchesBusqueda(o)
	);

	const ordenesAprobadas = ordenes.filter((o) =>
		o.estado === "aprobada" &&
		estaEnRango(o.visitaFecha) &&
		matchesBusqueda(o)
	);

	// (Stripe removed) - no filter for card payments

	const ordenesMostradas = tab === "pendientes" ? ordenesPendientes : ordenesAprobadas;

	const estadoBadge = (estado: string) => {
		const map: Record<string, { label: string; className: string }> = {
			generada:       { label: "✔ Generada",        className: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
			aprobada:       { label: "✅ Aprobada",        className: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" },
			pendiente_pago: { label: "⏳ Pago pendiente",  className: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300" },
			pago_fallido:   { label: "❌ Pago fallido",    className: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" },
			rechazada:      { label: "🚫 Rechazada",       className: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" },
		};
		const config = map[estado] || { label: estado, className: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" };
		return (
			<span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${config.className}`}>
				{config.label}
			</span>
		);
	};

	const clienteBadge = (orden: any) => {
		if (orden.userId) {
			const info = clientesMap[orden.userId];
			const label = info?.displayName || info?.email || orden.userEmail || orden.guestEmail || orden.userId;
			const badgeClass = orden.claimedFromGuest
				? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
				: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300";
			return (
				<span className="inline-flex items-center gap-1.5">
					<span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeClass}`}>
						{orden.claimedFromGuest ? "Registrado" : "Cliente"}
					</span>
					<span className="font-semibold">{label}</span>
				</span>
			);
		}
		if (orden.guestEmail) {
			return (
				<span className="inline-flex items-center gap-1.5">
					<span className="px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 text-xs font-bold">Invitado</span>
					<span className="font-semibold">{orden.guestEmail}</span>
				</span>
			);
		}
		return <span className="text-xs text-slate-400">Cliente invitado</span>;
	};

	const OrdenCard = ({ orden }: { orden: any }) => (
		<div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
			{/* Header */}
			<div className="flex justify-between items-start mb-3 flex-wrap gap-2">
				<div className="flex items-center gap-2">
					<span className="font-bold text-lg text-slate-800 dark:text-slate-100">
						{orden.orderId || `#${orden.id.slice(-6)}`}
					</span>
					{/* payment method badge removed (Stripe not used) */}
				</div>
				{estadoBadge(orden.estado)}
			</div>

			{/* Info */}
			<div className="space-y-1 mb-3 text-sm text-slate-600 dark:text-slate-300">
				<div>
					{clienteBadge(orden)}
				</div>
				<div className="text-xs text-slate-400 dark:text-slate-500">
					Creada: {orden.createdAt?.toDate
						? orden.createdAt.toDate().toLocaleString()
						: (orden.createdAt ? String(orden.createdAt) : "—")}
				</div>
				{orden.visitaFecha && (
					<div className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
						📅 Visita: <span className="font-semibold">{orden.visitaFecha}</span>
						{orden.visitaHora && <span>{orden.visitaHora}</span>}
					</div>
				)}
			</div>

			{/* Productos */}
			<ul className="border-t border-slate-100 dark:border-slate-700 pt-3 mb-3 space-y-2">
				{(orden.productos || []).map((p: any, idx: number) => (
					<li key={idx} className="space-y-1">
						<div className="flex justify-between text-sm">
							<span className="text-slate-700 dark:text-slate-300">
								{p.nombre} <span className="text-slate-400">×{p.cantidad}</span>
							</span>
							<span className="font-medium text-slate-800 dark:text-slate-100">
								${calcularSubtotalProducto(p).toFixed(2)}
							</span>
						</div>
						{/* Mostrar variantes si existen */}
						{p.selectedVariations && Object.keys(p.selectedVariations).length > 0 && (
							<div className="bg-slate-100 dark:bg-slate-900/20 rounded px-2 py-1.5 border-l-2 border-slate-400 text-xs space-y-0.5">
								<p className="font-semibold text-slate-700 dark:text-slate-300">📦 Variantes:</p>
								{/* Si tenemos los nombres, mostrarlos */}
								{p.selectedVariationsConNombres && Object.entries(p.selectedVariationsConNombres).map(([attrId, attrData]: [string, any]) => (
									<p key={attrId} className="text-slate-600 dark:text-slate-400">
										• <span className="font-semibold">{attrData.nombre}:</span> {attrData.valor}
									</p>
								))}
								{/* Fallback si no tenemos los nombres */}
								{!p.selectedVariationsConNombres && Object.entries(p.selectedVariations).map(([attrId, value]: [string, any]) => (
									<p key={attrId} className="text-slate-600 dark:text-slate-400">
										• {attrId}: {value}
									</p>
								))}
															{p.variacionPersonalizada && (
																<p className="text-slate-600 dark:text-slate-400">
																	• <span className="font-semibold">Nombre para grabado:</span> {p.variacionPersonalizada}
																</p>
															)}
							</div>
						)}
						{/* Mostrar personalización si existe */}
						{p.personalizacionValues && Object.keys(p.personalizacionValues).length > 0 && (
							<div className="bg-purple-50 dark:bg-purple-900/20 rounded px-2 py-1.5 border-l-2 border-purple-400 text-xs space-y-0.5">
								<p className="font-semibold text-purple-700 dark:text-purple-300">📝 Personalización:</p>
								{/* Si tenemos los nombres, mostrarlos */}
								{p.personalizacionValuesConNombres && Object.entries(p.personalizacionValuesConNombres).map(([fieldId, fieldData]: [string, any]) => (
									<p key={fieldId} className="text-purple-600 dark:text-purple-300">
										• <span className="font-semibold">{fieldData.nombre}:</span> {fieldData.valor}
									</p>
								))}
								{/* Fallback si no tenemos los nombres */}
								{!p.personalizacionValuesConNombres && Object.entries(p.personalizacionValues).map(([fieldId, value]: [string, any]) => (
									<p key={fieldId} className="text-purple-600 dark:text-purple-300">
										• {value}
									</p>
								))}
							</div>
						)}
					</li>
				))}
			</ul>

			{/* Delivery Time Summary */}
			<div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 mb-3 border border-blue-100 dark:border-blue-900/40 space-y-1">
				{obtenerResumenTiempos(orden.productos).map((tiempo) => (
					<div key={tiempo} className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
						<span>⏱️</span>
						<span>Entrega: máximo {tiempo}h</span>
					</div>
				))}
			</div>

			<div className="flex items-center justify-between">
				<div className="font-bold text-base text-slate-800 dark:text-slate-100">
					Total: <span className="text-purple-700 dark:text-purple-300">${calcularTotalOrden(orden).toFixed(2)}</span>
				</div>

				{/* Acciones - Mostrar botones si NO está ya aprobada/rechazada */}
				{orden.estado !== "aprobada" && orden.estado !== "rechazada" && (
					<div className="flex gap-2">
						<button
							onClick={() => rechazarOrden(orden)}
							className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-sm font-medium transition-colors"
						>
							🚫 Rechazar
						</button>

						<button
							onClick={() => aprobarOrden(orden)}
							className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors flex items-center gap-2"
						>
							<span>✅ Aprobar</span>
						</button>
					</div>
				)}
			</div>

			{orden.motivoRechazo && orden.estado === "rechazada" && (
				<div className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-100 dark:border-red-900/40">
					Motivo rechazo: {orden.motivoRechazo}
				</div>
			)}
		</div>
	);

	return (
		<div className="max-w-3xl mx-auto px-4 py-8">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Pedidos</h1>
				<button
					onClick={loadOrdenes}
					disabled={loading}
					className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium transition-colors"
				>
					<span className="material-icons-round text-sm">refresh</span>
					{loading ? "Cargando..." : "Refrescar"}
				</button>
			</div>

			{/* Filtros */}
			<div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 space-y-4">
				{/* Rango de fechas */}
				<div className="flex flex-wrap items-center gap-3">
					<span className="text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
						Fecha de visita:
					</span>
					<div className="flex items-center gap-2 flex-wrap">
						<div className="flex items-center gap-1.5">
							<label className="text-xs text-slate-500 dark:text-slate-400">Desde</label>
							<input
								type="date"
								value={fechaDesde}
								onChange={(e) => setFechaDesde(e.target.value)}
								className="border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
							/>
						</div>
						<span className="text-slate-400">→</span>
						<div className="flex items-center gap-1.5">
							<label className="text-xs text-slate-500 dark:text-slate-400">Hasta</label>
							<input
								type="date"
								value={fechaHasta}
								onChange={(e) => setFechaHasta(e.target.value)}
								className="border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
							/>
						</div>
						<button
							onClick={() => { setFechaDesde(getTodayYMD()); setFechaHasta(getTodayYMD()); }}
							className="text-xs px-2.5 py-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/60 font-medium transition-colors"
						>
							Hoy
						</button>
						<button
							onClick={() => { setFechaDesde(""); setFechaHasta(""); }}
							className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 font-medium transition-colors"
						>
							Ver todas
						</button>
					</div>
				</div>

				{/* Buscador */}
				<div className="relative">
					<span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
					<input
						type="text"
						placeholder="Buscar por cliente, email, ID de orden..."
						value={filtro}
						onChange={(e) => setFiltro(e.target.value)}
						className="w-full border border-slate-300 dark:border-slate-600 rounded-lg pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
					/>
				</div>
			</div>

			{/* Tabs */}
			<div className="flex gap-1 mb-5 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
				{(["pendientes", "aprobadas"] as const).map((t) => {
					const count = t === "pendientes" ? ordenesPendientes.length : ordenesAprobadas.length;
					return (
						<button
							key={t}
							onClick={() => setTab(t)}
							className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
								tab === t
									? "bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm"
									: "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
							}`}
						>
							{t === "pendientes" ? "Pendientes" : "Aprobadas"}
							<span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
								tab === t
									? (t === "pendientes" ? "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300" : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300")
									: "bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400"
							}`}>
								{count}
							</span>
						</button>
					);
				})}
			</div>



			{/* Contenido */}
			{loading ? (
				<div className="text-center py-16 text-slate-400 dark:text-slate-500">
					<div className="text-4xl mb-3">⏳</div>
					<p className="text-sm">Cargando órdenes...</p>
				</div>
			) : ordenesMostradas.length === 0 ? (
				<div className="text-center py-16 text-slate-400 dark:text-slate-500">
					<div className="text-4xl mb-3">📭</div>
					<p className="text-sm">No hay órdenes para mostrar en este rango de fechas.</p>
				</div>
			) : (
				<div className="space-y-4">
					{ordenesMostradas.map((orden) => (
						<OrdenCard key={orden.id} orden={orden} />
					))}
				</div>
			)}
		</div>
	);
}

