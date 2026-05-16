import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import { logAction } from "../lib/logAction";
import "../styles/LocalDrawer.css";

const API_URL_ACTION = apiUrl('/api/arrendatarios');

export default function ArrendatarioDrawer({ open, onClose, onSaved, arrendatario = null }) {
  const esEdicion = arrendatario !== null;
  const [loading, setLoading] = useState(false);
  const [eliminando, setEliminando] = useState(false);
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

  const validarTelefono = (telefono) => {
    if (!telefono) return null;
    const soloNumeros = telefono.replace(/[^0-9]/g, "");
    if (soloNumeros.length < 7 || soloNumeros.length > 15) {
      return "El teléfono debe tener entre 7 y 15 dígitos";
    }
    return null;
  };

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

    const telefonoError = validarTelefono(form.telefono);
    if (telefonoError) {
      setError(telefonoError);
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

    // Obtener información del usuario autenticado para el log
    const { data: { user } } = await supabase.auth.getUser();

    // Registrar la acción en los logs
    await logAction({
      usuario_id: user?.id,
      usuario_email: user?.email,
      accion: esEdicion ? "editar" : "crear",
      entidad: "arrendatarios",
      entidad_id: esEdicion ? arrendatario.id : (result.data?.id || ""),
      descripcion: `Arrendatario ${form.nombre} ${esEdicion ? "modificado" : "creado"}`
    });

    onSaved();
    onClose();

  } catch (err) {

    setError(err.message);

  } finally {

    setLoading(false);

  }
};

  const handleEliminar = async () => {
    const confirmacion = window.confirm(
      `¿Estás seguro de que deseas eliminar a ${arrendatario.nombre}? Esta acción no se puede deshacer.`
    );

    if (!confirmacion) return;

    setError("");
    setEliminando(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(API_URL_ACTION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'delete',
          id: arrendatario.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al eliminar");
      }

      // Obtener información del usuario autenticado para el log
      const { data: { user } } = await supabase.auth.getUser();

      // Registrar la acción en los logs
      await logAction({
        usuario_id: user?.id,
        usuario_email: user?.email,
        accion: "eliminar",
        entidad: "arrendatarios",
        entidad_id: arrendatario.id,
        descripcion: `Arrendatario ${arrendatario.nombre} eliminado`
      });

      onSaved();
      onClose();

    } catch (err) {
      setError(err.message);
    } finally {
      setEliminando(false);
    }
  };
  if (!open) return null;

  return (
  <div className="drawer-overlay">
    <div className="drawer-panel">

      <div className="drawer-header">
        <div className="drawer-header-text">
          <h2>
            {esEdicion
              ? "Editar Arrendatario"
              : "Nuevo Arrendatario"}
          </h2>

          <p>
            {esEdicion
              ? "Actualiza la información del arrendatario"
              : "Registra un nuevo arrendatario"}
          </p>
        </div>

        <button
          className="drawer-close"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="drawer-fields">

        <div className="drawer-field">
          <label>Nombre completo</label>

          <input
            type="text"
            placeholder="Ej. Juan Pérez"
            value={form.nombre}
            disabled={loading || eliminando}
            onChange={e =>
              setForm({
                ...form,
                nombre: e.target.value
              })
            }
          />
        </div>

        <div className="drawer-field">
          <label>Correo electrónico</label>

          <input
            type="email"
            placeholder="correo@ejemplo.com"
            value={form.email}
            disabled={loading || eliminando}
            onChange={e =>
              setForm({
                ...form,
                email: e.target.value
              })
            }
          />
        </div>

        <div className="drawer-field">
          <label>Teléfono</label>

          <input
            type="tel"
            placeholder="(664) 123 4567"
            value={form.telefono}
            disabled={loading || eliminando}
            onChange={e =>
              setForm({
                ...form,
                telefono: e.target.value
              })
            }
          />
        </div>

      </div>

      {error && (
        <div className="drawer-error">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      <div className="drawer-actions">

        <button
          className="drawer-btn-cancel"
          onClick={onClose}
          disabled={loading || eliminando}
        >
          Cancelar
        </button>

        {esEdicion && (
          <button
            onClick={handleEliminar}
            disabled={loading || eliminando}
            className="drawer-btn-cancel"
            style={{
              borderColor: "#fecaca",
              color: "#dc2626"
            }}
          >
            {eliminando
              ? "Eliminando..."
              : "Eliminar"}
          </button>
        )}

        <button
          className="drawer-btn-save"
          onClick={handleSubmit}
          disabled={loading || eliminando}
        >
          {loading
            ? "Guardando..."
            : "Guardar"}
        </button>

      </div>

    </div>
  </div>
);
}