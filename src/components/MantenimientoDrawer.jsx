// src/components/MantenimientoDrawer.jsx

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import { logAction } from "../lib/logAction";

const API_URL = apiUrl("/api/gastos");

const CATEGORIAS = [
  "mantenimiento",
  "reparacion",
  "limpieza",
  "servicios",
  "administrativo",
  "otro"
];

export default function MantenimientoDrawer({
  open,
  onClose,
  onSaved,
  locales = []
}) {

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const [form, setForm] = useState({
    local_id: "",
    categoria: "mantenimiento",
    concepto: "",
    monto: "",
    fecha: new Date().toISOString().slice(0, 10),
    metodo_pago: "",
    notas: ""
  });

  useEffect(() => {

    if (open) {

      setError("");

      setForm({
        local_id: "",
        categoria: "mantenimiento",
        concepto: "",
        monto: "",
        fecha: new Date().toISOString().slice(0, 10),
        metodo_pago: "",
        notas: ""
      });

    }

  }, [open]);

  const handleSubmit = async () => {

    setError("");

    if (!form.local_id)
      return setError("Selecciona un local");

    if (!form.concepto.trim())
      return setError("Ingresa un concepto");

    if (!form.monto || Number(form.monto) <= 0)
      return setError("Monto inválido");

    try {

      setLoading(true);

      const {
        data: { session }
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      const payload = {
        local_id: Number(form.local_id),
        categoria: form.categoria,
        concepto: form.concepto,
        monto: Number(form.monto),
        fecha: form.fecha,
        metodo_pago: form.metodo_pago || null,
        notas: form.notas || null
      };

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok)
        throw new Error(result.error || "Error al registrar gasto");

      // Usuario autenticado
      const {
        data: { user }
      } = await supabase.auth.getUser();

      // Log
      await logAction({
        usuario_id: user?.id,
        usuario_email: user?.email,
        accion: "registrar_gasto",
        entidad: "gastos",
        entidad_id: result.data?.id,
        descripcion: `${form.categoria} para local #${form.local_id} por $${Number(form.monto).toLocaleString("es-MX")}`
      });

      onSaved?.();
      onClose?.();

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }

  };

  if (!open) return null;

  return (

    <div
      className="drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget)
          onClose();
      }}
    >

      <div className="drawer-panel">

        {/* Header */}
        <div className="drawer-header">

          <div>
            <h2>Registrar gasto</h2>

            <p>
              Mantenimiento y gastos operativos
            </p>
          </div>

          <button
            className="drawer-close"
            onClick={onClose}
          >
            ✕
          </button>

        </div>

        {/* Fields */}
        <div className="drawer-fields">

          {/* Local */}
          <div className="drawer-field">

            <label>
              Local
            </label>

            <select
              value={form.local_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  local_id: e.target.value
                })
              }
            >

              <option value="">
                Selecciona un local
              </option>

              {locales.map(local => (

                <option
                  key={local.numero}
                  value={local.numero}
                >
                  Local #{local.numero}
                </option>

              ))}

            </select>

          </div>

          {/* Categoria */}
          <div className="drawer-field">

            <label>
              Categoría
            </label>

            <select
              value={form.categoria}
              onChange={(e) =>
                setForm({
                  ...form,
                  categoria: e.target.value
                })
              }
            >

              {CATEGORIAS.map(cat => (

                <option
                  key={cat}
                  value={cat}
                >
                  {cat}
                </option>

              ))}

            </select>

          </div>

          {/* Concepto */}
          <div className="drawer-field">

            <label>
              Concepto
            </label>

            <input
              type="text"
              placeholder="Ej. Reparación aire acondicionado"
              value={form.concepto}
              onChange={(e) =>
                setForm({
                  ...form,
                  concepto: e.target.value
                })
              }
            />

          </div>

          {/* Grid */}
          <div className="drawer-fields-grid">

            {/* Monto */}
            <div className="drawer-field">

              <label>
                Monto
              </label>

              <input
                type="number"
                placeholder="0.00"
                value={form.monto}
                onChange={(e) =>
                  setForm({
                    ...form,
                    monto: e.target.value
                  })
                }
              />

            </div>

            {/* Fecha */}
            <div className="drawer-field">

              <label>
                Fecha
              </label>

              <input
                type="date"
                value={form.fecha}
                onChange={(e) =>
                  setForm({
                    ...form,
                    fecha: e.target.value
                  })
                }
              />

            </div>

          </div>

         {/* Metodo pago */}
<div className="drawer-field">
  <label>
    Método de pago
  </label>

  <select
    value={form.metodo_pago}
    onChange={(e) =>
      setForm({
        ...form,
        metodo_pago: e.target.value
      })
    }
  >
    <option value="">Selecciona método de pago</option>
    <option value="transferencia">Transferencia</option>
    <option value="efectivo">Efectivo</option>
    <option value="cheque">Cheque</option>
  </select>
</div>
          {/* Notas */}
          <div className="drawer-field">

            <label>
              Notas
            </label>

            <textarea
              rows={4}
              placeholder="Notas adicionales..."
              value={form.notas}
              onChange={(e) =>
                setForm({
                  ...form,
                  notas: e.target.value
                })
              }
            />

          </div>

        </div>

        {/* Error */}
        {error && (

          <div className="drawer-error">
            {error}
          </div>

        )}

        {/* Actions */}
        <div className="drawer-actions">

          <button
            className="drawer-btn-cancel"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            className="drawer-btn-save"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? "Guardando..."
              : "Registrar gasto"}
          </button>

        </div>

      </div>

    </div>

  );

}