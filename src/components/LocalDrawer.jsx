import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { logAction } from "../lib/logAction";
import "../styles/LocalDrawer.css";

const API_URL_ACTION = "/api/locales";

export default function LocalDrawer({ open, onClose, onSaved, local = null }) {
  const esEdicion = local !== null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    numero: "",
    metros_cuadrados: "",
    renta: "",
    mantenimiento_mensual: "",
  });

  useEffect(() => {
    if (open) {
      setForm(
        local || {
          numero: "",
          metros_cuadrados: "",
          renta: "",
          mantenimiento_mensual: "",
        }
      );
      setError("");
    }
  }, [open, local]);

  const handleSubmit = async () => {
    if (!esEdicion && (!form.numero || Number(form.numero) <= 0))
      return setError("Número de local inválido");
    if (!form.metros_cuadrados || Number(form.metros_cuadrados) <= 0)
      return setError("Metros cuadrados inválidos");
    if (form.renta === "" || Number(form.renta) < 0)
      return setError("Renta inválida");
    if (form.mantenimiento_mensual === "" || Number(form.mantenimiento_mensual) < 0)
      return setError("Mantenimiento mensual inválido");

    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const payload = {
        metros_cuadrados: Number(form.metros_cuadrados),
        renta: Number(form.renta),
        mantenimiento_mensual: Number(form.mantenimiento_mensual),
      };

      if (!esEdicion) {
        payload.numero = Number(form.numero);
      } else {
        payload.id = local.id;
      }

      const response = await fetch(API_URL_ACTION, {
        method: esEdicion ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error en la operación");

      // Obtener información del usuario autenticado para el log
      const { data: { user } } = await supabase.auth.getUser();

      // Registrar la acción en los logs
      await logAction({
        usuario_id: user?.id,
        usuario_email: user?.email,
        accion: esEdicion ? "editar" : "crear",
        entidad: "locales",
        entidad_id: esEdicion ? local.id : (result.data?.id || ""),
        descripcion: `Local #${esEdicion ? local.numero : form.numero} ${esEdicion ? "modificado" : "creado"}`
      });

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Cerrar al hacer clic en el overlay
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={handleOverlayClick}>
      <div className="drawer-panel" role="dialog" aria-modal="true">

        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-header-text">
            <h2>{esEdicion ? "Editar Local" : "Nuevo Local"}</h2>
            <p>{esEdicion ? `Modificando local #${local.numero}` : "Completa los datos del nuevo espacio"}</p>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {/* Fields */}
        <div className="drawer-fields">

          {/* Número — solo en creación */}
          {!esEdicion && (
            <div className="drawer-field">
              <label htmlFor="numero">Número de local</label>
              <input
                id="numero"
                type="number"
                placeholder="Ej. 12"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
              />
            </div>
          )}

          {/* Metros cuadrados */}
          <div className="drawer-field">
            <label htmlFor="m2">Metros cuadrados</label>
            <input
              id="m2"
              type="number"
              placeholder="Ej. 45.5"
              value={form.metros_cuadrados}
              onChange={(e) => setForm({ ...form, metros_cuadrados: e.target.value })}
            />
          </div>

          {/* Renta y mantenimiento — side by side */}
          <div className="drawer-fields-grid">
            <div className="drawer-field">
              <label htmlFor="renta">Renta mensual ($)</label>
              <input
                id="renta"
                type="number"
                placeholder="Ej. 8500"
                value={form.renta}
                onChange={(e) => setForm({ ...form, renta: e.target.value })}
              />
            </div>

            <div className="drawer-field">
              <label htmlFor="mant">Mantenimiento ($)</label>
              <input
                id="mant"
                type="number"
                placeholder="Ej. 1200"
                value={form.mantenimiento_mensual}
                onChange={(e) =>
                  setForm({ ...form, mantenimiento_mensual: e.target.value })
                }
              />
            </div>
          </div>

        </div>

        {/* Hint campos calculados */}
        <div className="drawer-hint">
          <span className="drawer-hint-icon">ℹ</span>
          <span>
            El estatus, total y métricas por m² se calculan automáticamente a partir de contratos y los valores ingresados.
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="drawer-error">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="drawer-actions">
          <button className="drawer-btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="drawer-btn-save"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Guardando…" : esEdicion ? "Guardar cambios" : "Crear local"}
          </button>
        </div>

      </div>
    </div>
  );
}