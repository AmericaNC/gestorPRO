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
    telefono: ""
  });

  useEffect(() => {
    if (open) {
      if (arrendatario) {
        setForm({
          nombre: arrendatario.nombre || "",
          email: arrendatario.email || "",
          telefono: arrendatario.telefono || ""
        });
      } else {
        setForm({
          nombre: "",
          email: "",
          telefono: ""
        });
      }
      setError("");
    }
  }, [open, arrendatario]);

  const handleSubmit = async () => {

  if (loading) return;

  setError("");
  setLoading(true);

  try {

    if (!form.nombre.trim()) {
      setError("El nombre es requerido");
      setLoading(false);
      return;
    }

    if (
      form.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    ) {
      setError("Correo inválido");
      setLoading(false);
      return;
    }

    const {
      data: { session }
    } = await supabase.auth.getSession();

    const token = session?.access_token;

    const payload = {
      nombre: form.nombre.trim(),
      email: form.email?.trim() || null,
      telefono: form.telefono?.trim() || null
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

    if (!response.ok) {
      throw new Error(
        result.error ||
        result.message ||
        "Error en la operación"
      );
    }

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
        disabled={loading}
        onChange={e => setForm({ ...form, nombre: e.target.value })}
      />

      <input
        type="email"
        placeholder="Correo electrónico (opcional)"
        value={form.email}
        disabled={loading}
        onChange={e => setForm({ ...form, email: e.target.value })}
      />

      <input
        type="tel"
        placeholder="Teléfono (opcional)"
        value={form.telefono}
        disabled={loading}
        onChange={e => setForm({ ...form, telefono: e.target.value })}
      />

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button onClick={onClose} disabled={loading}>
        Cancelar
      </button>
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}