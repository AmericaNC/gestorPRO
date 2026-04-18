import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";

const API_URL_ACTION = apiUrl('/api/pagos');

export default function PagoDrawer({ open, onClose, onSaved, pago = null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    monto_pagado: "",
    fecha_pago: "",
    metodo_pago: "",
    notas: ""
  });

  useEffect(() => {
    if (open && pago) {
      setForm({
        monto_pagado: pago.monto_pagado ?? "",
        fecha_pago: pago.fecha_pago || "",
        metodo_pago: pago.metodo_pago || "",
        notas: pago.notas || ""
      });
      setError("");
    }
  }, [open, pago]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const payload = {
        id: pago.id,
        monto_pagado: Number(form.monto_pagado),
        fecha_pago: form.fecha_pago || null,
        metodo_pago: form.metodo_pago || null,
        notas: form.notas || null
      };

      const response = await fetch(API_URL_ACTION, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error en la operación");

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
    <div className="drawer-container">
      <h2>Registrar Pago</h2>

      <p style={{ fontSize: '13px', color: '#888', marginBottom: '12px' }}>
        Periodo: <strong>{pago.periodo}</strong> — Local: <strong>{pago.local_id}</strong>
        <br />
        Monto esperado: <strong>${pago.monto_esperado}</strong>
      </p>

      <input
        type="number"
        placeholder="Monto pagado"
        value={form.monto_pagado}
        onChange={e => setForm({ ...form, monto_pagado: e.target.value })}
      />

      <input
        type="date"
        placeholder="Fecha de pago"
        value={form.fecha_pago}
        onChange={e => setForm({ ...form, fecha_pago: e.target.value })}
      />

      <select
        value={form.metodo_pago}
        onChange={e => setForm({ ...form, metodo_pago: e.target.value })}
      >
        <option value="">Método de pago (opcional)</option>
        <option value="transferencia">Transferencia</option>
        <option value="efectivo">Efectivo</option>
        <option value="cheque">Cheque</option>
        <option value="otro">Otro</option>
      </select>

      <input
        type="text"
        placeholder="Notas (opcional)"
        value={form.notas}
        onChange={e => setForm({ ...form, notas: e.target.value })}
      />

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button onClick={onClose}>Cancelar</button>
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Guardando..." : "Confirmar Pago"}
      </button>
    </div>
  );
}