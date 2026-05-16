import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { logAction } from "../lib/logAction";
import { apiUrl } from "../lib/apiClient";
import "../styles/LocalDrawer.css";

const API_URL_ACTION = apiUrl('/api/pagos');

const fmt = (n) => `$${Number(n || 0).toLocaleString("es-MX")}`;

export default function PagoDrawer({ open, onClose, onSaved, pago = null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [form, setForm]       = useState({
    monto_pagado: "",
    fecha_pago:   "",
    metodo_pago:  "",
    notas:        ""
  });

  useEffect(() => {
    if (open && pago) {
      setForm({
        monto_pagado: pago.monto_pagado ?? "",
        fecha_pago:   pago.fecha_pago   || "",
        metodo_pago:  pago.metodo_pago  || "",
        notas:        pago.notas        || ""
      });
      setError("");
    }
  }, [open, pago]);

  const handleSubmit = async () => {
    setLoading(true);
    const monto = Number(form.monto_pagado);

    if (isNaN(monto) || monto < 0) {
      setError("Monto inválido");
      setLoading(false);
      return;
    }
    if (monto > pago.monto_esperado) {
      setError("El monto pagado no puede ser mayor al esperado");
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(API_URL_ACTION, {
        method: "PUT",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          id:           pago.id,
          monto_pagado: monto,
          fecha_pago:   form.fecha_pago  || null,
          metodo_pago:  form.metodo_pago || null,
          notas:        form.notas       || null
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error en la operación");

      const { data: { user } } = await supabase.auth.getUser();
      await logAction({
        usuario_id: user?.id,
        usuario_email: user?.email,
        accion: "registrar_pago",
        entidad: "pagos",
        entidad_id: pago.id,
        descripcion: `Pago del periodo ${pago.periodo} para local ${pago.locales?.numero ?? pago.local_id} registrado con ${fmt(monto)}`
      });

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!open || !pago) return null;

  return (
    <div className="drawer-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer-panel">

        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-header-text">
            <h2>Registrar pago</h2>
            <p>Periodo {pago.periodo} · Local {pago.locales?.numero ?? "—"}</p>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        {/* Info del pago */}
        <div className="drawer-hint">
          <span className="drawer-hint-icon">ℹ️</span>
          Monto esperado para este periodo: <strong>{fmt(pago.monto_esperado)}</strong>
        </div>

        {/* Campos */}
        <div className="drawer-fields">
          <div className="drawer-fields-grid">
            <div className="drawer-field">
              <label htmlFor="monto_pagado">Monto pagado</label>
              <input
                id="monto_pagado"
                type="number"
                placeholder="0"
                value={form.monto_pagado}
                onChange={e => setForm({ ...form, monto_pagado: e.target.value })}
              />
            </div>

            <div className="drawer-field">
              <label htmlFor="fecha_pago">Fecha de pago</label>
              <input
                id="fecha_pago"
                type="date"
                value={form.fecha_pago}
                onChange={e => setForm({ ...form, fecha_pago: e.target.value })}
              />
            </div>
          </div>

          <div className="drawer-field">
  <label htmlFor="metodo_pago">Método de pago</label>
  <select
    id="metodo_pago"
    value={form.metodo_pago}
    onChange={e => setForm({ ...form, metodo_pago: e.target.value })}
  >
    <option value="">Seleccionar método…</option>
    <option value="transferencia">Transferencia</option>
    <option value="efectivo">Efectivo</option>
    <option value="cheque">Cheque</option>
    <option value="otro">Otro</option>
  </select>
</div>

          <div className="drawer-field">
            <label htmlFor="notas">Notas</label>
            <input
              id="notas"
              type="text"
              placeholder="Opcional"
              value={form.notas}
              onChange={e => setForm({ ...form, notas: e.target.value })}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="drawer-error">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Acciones */}
        <div className="drawer-actions">
          <button className="drawer-btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="drawer-btn-save"
            onClick={handleSubmit}
            disabled={loading || !form.monto_pagado}
          >
            {loading ? "Guardando…" : "Confirmar pago"}
          </button>
        </div>

      </div>
    </div>
  );
}