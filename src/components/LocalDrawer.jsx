import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

const API_URL_ACTION = "/api/locales";

export default function LocalDrawer({ open, onClose, onSaved, local = null }) {
  const esEdicion = local !== null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    numero: "",
    metros_cuadrados: "",
    estatus: "desocupado",
    renta: "",
    mantenimiento_mensual: ""
  });

  useEffect(() => {
    if (open) {
      setForm(local || {
        numero: "",
        metros_cuadrados: "",
        estatus: "desocupado",
        renta: "",
        mantenimiento_mensual: ""
      });
      setError("");
    }
  }, [open, local]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const payload = {
        ...form,
        numero: Number(form.numero),
        metros_cuadrados: Number(form.metros_cuadrados),
        renta: Number(form.renta),
        mantenimiento_mensual: Number(form.mantenimiento_mensual),
        estatus: "desocupado" // siempre desocupado al crear/editar manualmente
      };

      const response = await fetch(API_URL_ACTION, {
        method: esEdicion ? 'PUT' : 'POST',
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

  if (!open) return null;

  return (
    <div className="drawer-container">
      <h2>{esEdicion ? "Editar Local" : "Nuevo Local"}</h2>

      <input
        type="number"
        placeholder="Número"
        value={form.numero}
        onChange={e => setForm({ ...form, numero: e.target.value })}
      />

      <input
        type="number"
        placeholder="Metros²"
        value={form.metros_cuadrados}
        onChange={e => setForm({ ...form, metros_cuadrados: e.target.value })}
      />

      <input
        type="number"
        placeholder="Renta"
        value={form.renta}
        onChange={e => setForm({ ...form, renta: e.target.value })}
      />

      <input
        type="number"
        placeholder="Mantenimiento mensual"
        value={form.mantenimiento_mensual}
        onChange={e => setForm({ ...form, mantenimiento_mensual: e.target.value })}
      />

      {/* Estatus se maneja automáticamente via contratos, no se expone al usuario */}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button onClick={onClose}>Cancelar</button>
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}