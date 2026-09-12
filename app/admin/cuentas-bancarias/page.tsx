"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CuentaBancaria,
  crearCuentaBancaria,
  actualizarCuentaBancaria,
  eliminarCuentaBancaria,
  desactivarCuentaBancaria,
  obtenerCuentasBancarias,
} from "../../lib/cuentas-bancarias";

const emptyCuenta = {
  banco: "",
  tipo: "ahorros",
  numeroCuenta: "",
  titular: "",
  cedula: "",
  nombreParaTransferencia: "",
  activa: true,
};

export default function CuentasBancariasPage() {
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [cuentaForm, setCuentaForm] = useState(emptyCuenta);
  const [editingCuentaId, setEditingCuentaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const data = await obtenerCuentasBancarias();
      setCuentas(data);
    } catch (error) {
      setMessage("No se pudo cargar las cuentas bancarias.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSaveCuenta(event: FormEvent) {
    event.preventDefault();
    if (!cuentaForm.banco.trim() || !cuentaForm.numeroCuenta.trim()) return;
    
    setSaving(true);
    try {
      if (editingCuentaId) {
        await actualizarCuentaBancaria(editingCuentaId, cuentaForm);
        setMessage("Cuenta bancaria actualizada.");
      } else {
        await crearCuentaBancaria(cuentaForm);
        setMessage("Cuenta bancaria creada.");
      }
      await loadData();
      setCuentaForm(emptyCuenta);
      setEditingCuentaId(null);
    } catch (error) {
      setMessage("No se pudo guardar la cuenta bancaria.");
    } finally {
      setSaving(false);
    }
  }

  function editCuenta(cuenta: CuentaBancaria) {
    setEditingCuentaId(cuenta.id || null);
    setCuentaForm({
      banco: cuenta.banco,
      tipo: cuenta.tipo,
      numeroCuenta: cuenta.numeroCuenta,
      titular: cuenta.titular,
      cedula: cuenta.cedula,
      nombreParaTransferencia: cuenta.nombreParaTransferencia,
      activa: cuenta.activa !== false,
    });
  }

  async function removeCuenta(cuenta: CuentaBancaria) {
    if (!window.confirm(`¿Eliminar la cuenta de ${cuenta.banco}?`)) return;
    try {
      await eliminarCuentaBancaria(cuenta.id!);
      await loadData();
      setMessage("Cuenta bancaria eliminada.");
    } catch (error) {
      setMessage("No se pudo eliminar la cuenta bancaria.");
    }
  }

  async function toggleActivar(cuenta: CuentaBancaria) {
    try {
      if (cuenta.activa !== false) {
        await desactivarCuentaBancaria(cuenta.id!);
        setMessage("Cuenta bancaria desactivada.");
      } else {
        await actualizarCuentaBancaria(cuenta.id!, { activa: true });
        setMessage("Cuenta bancaria activada.");
      }
      await loadData();
    } catch (error) {
      setMessage("No se pudo cambiar el estado de la cuenta.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">Configuración</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Cuentas Bancarias</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Gestiona las cuentas bancarias para recibir pagos por transferencia. Los clientes podrán seleccionar entre estas cuentas al realizar su pedido.</p>
        </header>

        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(300px,0.6fr)_minmax(0,1.4fr)]">
          {/* Formulario */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editingCuentaId ? "Editar cuenta" : "Nueva cuenta"}
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                {cuentas.length}
              </span>
            </div>
            
            <form onSubmit={handleSaveCuenta} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Banco</label>
                <input
                  value={cuentaForm.banco}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, banco: e.target.value })}
                  placeholder="Ej. Banco Pichincha"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de cuenta</label>
                <select
                  value={cuentaForm.tipo}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, tipo: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  required
                >
                  <option value="ahorros">Ahorros</option>
                  <option value="corriente">Corriente</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Número de cuenta</label>
                <input
                  value={cuentaForm.numeroCuenta}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, numeroCuenta: e.target.value })}
                  placeholder="Ej. 1234567890"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Titular de la cuenta</label>
                <input
                  value={cuentaForm.titular}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, titular: e.target.value })}
                  placeholder="Nombre del titular"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Cédula del titular</label>
                <input
                  value={cuentaForm.cedula}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, cedula: e.target.value })}
                  placeholder="Ej. 1234567890"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre para transferencia</label>
                <input
                  value={cuentaForm.nombreParaTransferencia}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, nombreParaTransferencia: e.target.value })}
                  placeholder="Nombre exacto para transferir"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activa"
                  checked={cuentaForm.activa}
                  onChange={(e) => setCuentaForm({ ...cuentaForm, activa: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="activa" className="text-sm text-slate-700">Cuenta activa</label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {editingCuentaId ? "Actualizar" : "Crear cuenta"}
                </button>
                {editingCuentaId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCuentaId(null);
                      setCuentaForm(emptyCuenta);
                    }}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Lista de cuentas */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Cuentas configuradas</h2>
            
            {loading ? (
              <p className="text-sm text-slate-500">Cargando...</p>
            ) : cuentas.length === 0 ? (
              <p className="text-sm text-slate-500">No hay cuentas bancarias configuradas.</p>
            ) : (
              <div className="space-y-3">
                {cuentas.map((cuenta) => (
                  <div
                    key={cuenta.id}
                    className={`flex items-center justify-between rounded-xl border p-4 ${
                      cuenta.activa !== false
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-slate-50 opacity-60"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-slate-800">{cuenta.banco}</span>
                        <span className="text-xs bg-white px-2 py-0.5 rounded-full text-slate-600">
                          {cuenta.tipo}
                        </span>
                        {cuenta.activa !== false ? (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                            Activa
                          </span>
                        ) : (
                          <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                            No activa
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <p><strong>Cuenta:</strong> {cuenta.numeroCuenta}</p>
                        <p><strong>Titular:</strong> {cuenta.titular}</p>
                        <p><strong>Cédula:</strong> {cuenta.cedula}</p>
                        <p><strong>Para transferir a:</strong> {cuenta.nombreParaTransferencia}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => toggleActivar(cuenta)}
                        className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title={cuenta.activa !== false ? "Desactivar" : "Activar"}
                      >
                        <span className="material-icons-round">
                          {cuenta.activa !== false ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                      <button
                        onClick={() => editCuenta(cuenta)}
                        className="rounded-lg p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Editar"
                      >
                        <span className="material-icons-round">edit</span>
                      </button>
                      <button
                        onClick={() => removeCuenta(cuenta)}
                        className="rounded-lg p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <span className="material-icons-round">delete_outline</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}