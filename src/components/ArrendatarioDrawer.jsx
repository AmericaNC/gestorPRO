import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";

const API_URL_ACTION = apiUrl('/api/arrendatarios');

export default function ArrendatarioDrawer({ open, onClose, onSaved, arrendatario = null }) {
  const esEdicion = arrendatario !== null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    estado: "pendiente"
  });

  useEffect(() => {
    if (open) {
      if (arrendatario) {
        setForm({
          nombre: arrendatario.nombre || "",
          email: arrendatario.email || "",
          telefono: arrendatario.telefono || "",
          estado: arrendatario.estado || "pendiente"
        });
      } else {
        setForm({
          nombre: "",
          email: "",
          telefono: "",
          estado: "pendiente"
        });
      }
      setError("");
    }
  }, [open, arrendatario]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const payload = {
        nombre: form.nombre,
        email: form.email || null,
        telefono: form.telefono || null,
        estado: form.estado
        // local_id se asigna a través del contrato, no aquí
      };

      if (esEdicion) {
        payload.id = arrendatario.id;
      }

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
      <h2>{esEdicion ? "Editar Arrendatario" : "Nuevo Arrendatario"}</h2>

      <input
        type="text"
        placeholder="Nombre completo"
        value={form.nombre}
        onChange={e => setForm({ ...form, nombre: e.target.value })}
      />

      <input
        type="email"
        placeholder="Correo electrónico (opcional)"
        value={form.email}
        onChange={e => setForm({ ...form, email: e.target.value })}
      />

      <input
        type="tel"
        placeholder="Teléfono (opcional)"
        value={form.telefono}
        onChange={e => setForm({ ...form, telefono: e.target.value })}
      />

      <select
        value={form.estado}
        onChange={e => setForm({ ...form, estado: e.target.value })}
      >
        <option value="pendiente">Pendiente</option>
        <option value="al_dia">Al día</option>
        <option value="atrasado">Atrasado</option>
      </select>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button onClick={onClose}>Cancelar</button>
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}