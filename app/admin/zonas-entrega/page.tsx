"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CiudadEntrega,
  ZonaEntrega,
  eliminarCiudadEntrega,
  eliminarZonaEntrega,
  guardarCiudadEntrega,
  guardarZonaEntrega,
  obtenerCiudadesEntrega,
} from "../../lib/zonas-entrega-db";

const emptyCity = { nombre: "", precio: "", montoMinimoGratis: "" };
const emptyZone = { nombre: "", precio: "", cobroFijo: "" };

export default function ZonasEntregaPage() {
  const [ciudades, setCiudades] = useState<CiudadEntrega[]>([]);
  const [cityForm, setCityForm] = useState(emptyCity);
  const [editingCityId, setEditingCityId] = useState<string | null>(null);
  const [zoneForm, setZoneForm] = useState(emptyZone);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    const nextCities = await obtenerCiudadesEntrega();
    setCiudades(nextCities);
    setSelectedCityId((current) => current && nextCities.some((city) => city.id === current) ? current : nextCities[0]?.id || null);
    setLoading(false);
  }

  useEffect(() => {
    loadData().catch(() => {
      setMessage("No se pudo cargar la configuración de entregas.");
      setLoading(false);
    });
  }, []);

  async function handleSaveCity(event: FormEvent) {
    event.preventDefault();
    if (!cityForm.nombre.trim()) return;
    setSaving(true);
    try {
      const current = ciudades.find((city) => city.id === editingCityId);
      const id = await guardarCiudadEntrega({
        nombre: cityForm.nombre,
        precio: Number(cityForm.precio) || 0,
        montoMinimoGratis: Number(cityForm.montoMinimoGratis) || 25,
        zonas: current?.zonas || [],
      }, editingCityId || undefined);
      await loadData();
      setSelectedCityId(id);
      setCityForm(emptyCity);
      setEditingCityId(null);
      setMessage("Ciudad guardada.");
    } catch {
      setMessage("No se pudo guardar la ciudad.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveZone(event: FormEvent) {
    event.preventDefault();
    if (!selectedCityId || !zoneForm.nombre.trim()) return;
    setSaving(true);
    try {
      await guardarZonaEntrega(selectedCityId, {
        id: editingZoneId || "",
        nombre: zoneForm.nombre,
        ...(zoneForm.precio.trim() ? { precio: Number(zoneForm.precio) || 0 } : {}),
        ...(zoneForm.cobroFijo.trim() ? { cobroFijo: Number(zoneForm.cobroFijo) || 0 } : {}),
      });
      await loadData();
      setZoneForm(emptyZone);
      setEditingZoneId(null);
      setMessage("Zona guardada.");
    } catch {
      setMessage("No se pudo guardar la zona.");
    } finally {
      setSaving(false);
    }
  }

  function editCity(city: CiudadEntrega) {
    setEditingCityId(city.id);
    setCityForm({ nombre: city.nombre, precio: String(city.precio), montoMinimoGratis: String(city.montoMinimoGratis) });
    setSelectedCityId(city.id);
  }

  function editZone(zone: ZonaEntrega) {
    setEditingZoneId(zone.id);
    setZoneForm({ nombre: zone.nombre, precio: String(zone.precio), cobroFijo: String(zone.cobroFijo || "") });
  }

  async function removeCity(city: CiudadEntrega) {
    if (!window.confirm(`¿Eliminar ${city.nombre} y todas sus zonas?`)) return;
    await eliminarCiudadEntrega(city.id);
    await loadData();
    setMessage("Ciudad eliminada.");
  }

  async function removeZone(zone: ZonaEntrega) {
    if (!selectedCityId || !window.confirm(`¿Eliminar ${zone.nombre}?`)) return;
    await eliminarZonaEntrega(selectedCityId, zone.id);
    await loadData();
    setMessage("Zona eliminada.");
  }

  const selectedCity = ciudades.find((city) => city.id === selectedCityId);
  const selectedCityPrice = Number(selectedCity?.precio ?? 0);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-600">Logística Ecuador</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Zonas de entrega</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Configura precios por ciudad y zonas. Cada ciudad tiene su propio monto mínimo para envío gratis. El cobro fijo de zona es opcional y se aplica cuando el pedido alcanza el mínimo (útil para zonas lejanas). Una zona con precio propio siempre tiene prioridad sobre el precio de su ciudad.</p>
        </header>

        {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{message}</div>}



        <section className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">Ciudades</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{ciudades.length}</span></div>
            <form onSubmit={handleSaveCity} className="mb-5 space-y-3 rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-bold text-slate-700">{editingCityId ? "Editar ciudad" : "Nueva ciudad"}</p>
              <input value={cityForm.nombre} onChange={(event) => setCityForm({ ...cityForm, nombre: event.target.value })} placeholder="Ej. Guayaquil" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
              <label className="block text-xs font-semibold text-slate-500">Precio base de ciudad (USD)
                <input value={cityForm.precio} onChange={(event) => setCityForm({ ...cityForm, precio: event.target.value })} type="number" min="0" step="0.01" placeholder="5.00" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
              </label>
              <label className="block text-xs font-semibold text-slate-500">Monto mínimo para envío gratis (USD)
                <input value={cityForm.montoMinimoGratis} onChange={(event) => setCityForm({ ...cityForm, montoMinimoGratis: event.target.value })} type="number" min="0" step="0.01" placeholder="25.00" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" required />
              </label>
              <div className="flex gap-2"><button disabled={saving} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{editingCityId ? "Actualizar" : "Agregar ciudad"}</button>{editingCityId && <button type="button" onClick={() => { setEditingCityId(null); setCityForm(emptyCity); }} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500">Cancelar</button>}</div>
            </form>
            <div className="space-y-2">
              {loading ? <p className="text-sm text-slate-500">Cargando...</p> : ciudades.length === 0 ? <p className="text-sm text-slate-500">Todavía no hay ciudades configuradas.</p> : ciudades.map((city) => <div key={city.id} className={`flex items-center gap-2 rounded-xl border p-3 ${selectedCityId === city.id ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}><button onClick={() => setSelectedCityId(city.id)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-bold text-slate-800">{city.nombre}</p><p className="text-xs text-slate-500">${city.precio.toFixed(2)} · Gratis desde $${city.montoMinimoGratis.toFixed(2)} · {city.zonas?.length || 0} zonas</p></button><button title="Editar ciudad" onClick={() => editCity(city)} className="material-icons-round text-lg text-slate-400 hover:text-slate-900">edit</button><button title="Eliminar ciudad" onClick={() => removeCity(city)} className="material-icons-round text-lg text-slate-400 hover:text-red-600">delete_outline</button></div>)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4"><h2 className="text-lg font-bold text-slate-900">Zonas de {selectedCity?.nombre || "la ciudad seleccionada"}</h2><p className="mt-1 text-sm text-slate-500">El precio de una zona reemplaza al precio base de la ciudad solo para esa zona. El cobro fijo es opcional y se aplica cuando el pedido alcanza el mínimo de envío gratis.</p></div>
            {selectedCity ? <><form onSubmit={handleSaveZone} className="mb-5 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_120px_120px_auto]"><input value={zoneForm.nombre} onChange={(event) => setZoneForm({ ...zoneForm, nombre: event.target.value })} placeholder="Ej. Ceibos Norte" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" required /><input value={zoneForm.precio} onChange={(event) => setZoneForm({ ...zoneForm, precio: event.target.value })} type="number" min="0" step="0.01" placeholder={`Precio ($${selectedCityPrice.toFixed(2)})`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><input value={zoneForm.cobroFijo} onChange={(event) => setZoneForm({ ...zoneForm, cobroFijo: event.target.value })} type="number" min="0" step="0.01" placeholder="Cobro fijo (opcional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><button disabled={saving} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{editingZoneId ? "Actualizar" : "Agregar zona"}</button></form><div className="grid gap-3 sm:grid-cols-2">{(selectedCity.zonas || []).map((zone) => <div key={zone.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><div><p className="font-bold text-slate-800">{zone.nombre}</p><p className="text-sm text-amber-700">{zone.precio === undefined ? `Usa precio ciudad ($${selectedCityPrice.toFixed(2)})` : `$${zone.precio.toFixed(2)} por entrega`}{zone.cobroFijo !== undefined && zone.cobroFijo > 0 ? ` · Cobro fijo al alcanzar mínimo: $${zone.cobroFijo.toFixed(2)}` : ""}</p></div><div className="flex gap-2"><button title="Editar zona" onClick={() => editZone(zone)} className="material-icons-round text-lg text-slate-400 hover:text-slate-900">edit</button><button title="Eliminar zona" onClick={() => removeZone(zone)} className="material-icons-round text-lg text-slate-400 hover:text-red-600">delete_outline</button></div></div>)}{(selectedCity.zonas || []).length === 0 && <p className="text-sm text-slate-500">Agrega zonas específicas o usa el precio base de la ciudad.</p>}</div></> : <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">Primero crea o selecciona una ciudad.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
