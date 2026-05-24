import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import ArrendatarioDrawer from "../components/ArrendatarioDrawer";

import "../styles/Page.css";
import "../styles/ArrendatarioPage.css";

const API_URL_GET = apiUrl('/api/arrendatarios');

export default function ArrendatariosPage() {
  const [arrendatarios, setArrendatarios]       = useState([]);
  const [inactivos, setInactivos]               = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState(null);
  const [drawerOpen, setDrawerOpen]             = useState(false);
  const [selectedArrendatario, setSelectedArrendatario] = useState(null);
  const [inactivosExpandido, setInactivosExpandido]     = useState(false);
  const [loadingInactivos, setLoadingInactivos]         = useState(false);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const fetchArrendatarios = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      const response = await fetch(API_URL_GET, { method: "GET", headers });
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("El servidor no respondió con JSON.");
      }
      const result = await response.json();
      setArrendatarios(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
const reactivarArrendatario = async (a) => {
  if (!window.confirm(
    `¿Reactivar a ${a.nombre}?\n\nVolverá a aparecer en la lista de arrendatarios activos.`
  )) return;

  try {
    const token = await getToken();
    const response = await fetch(API_URL_GET, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ action: "reactivar", id: a.id })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Error al reactivar");

    fetchArrendatarios();
    setInactivos([]); // forzar recarga
  } catch (err) {
    alert("Error: " + err.message);
  }
};
  const fetchInactivos = async () => {
    if (inactivos.length > 0) return; // ya cargados
    setLoadingInactivos(true);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL_GET}?inactivos=true`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const result = await response.json();
      setInactivos(result.data || []);
    } catch (err) {
      console.warn("Error cargando inactivos:", err.message);
    } finally {
      setLoadingInactivos(false);
    }
  };

  const toggleInactivos = () => {
    const nuevoEstado = !inactivosExpandido;
    setInactivosExpandido(nuevoEstado);
    if (nuevoEstado) fetchInactivos();
  };

  useEffect(() => { fetchArrendatarios(); }, []);

  // ── Tabla desktop ─────────────────────────────────────────
  const TablaDesktop = ({ lista, conAccion = true, onReactivar = null }) => (
  <div className="table-responsive">
    <table className="data-table desktop-table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Email</th>
          <th>Teléfono</th>
          <th>Local</th>
          {(conAccion || onReactivar) && <th>Acciones</th>}
        </tr>
      </thead>
      <tbody>
        {lista.map(a => (
          <tr key={a.id}>
            <td>{a.nombre}</td>
            <td>{a.email || '—'}</td>
            <td>{a.telefono || '—'}</td>
            <td>{a.locales?.numero ?? '—'}</td>
            {(conAccion || onReactivar) && (
              <td>
                {conAccion && (
                  <button
                    className="btn-edit"
                    onClick={() => { setSelectedArrendatario(a); setDrawerOpen(true); }}
                  >
                    Editar
                  </button>
                )}
                {onReactivar && (
                  <button
                    className="btn-edit"
                    onClick={() => onReactivar(a)}
                  >
                    Reactivar
                  </button>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

  // ── Cards mobile ──────────────────────────────────────────
 const CardsMobile = ({ lista, conAccion = true, onReactivar = null }) => (
  <div className="mobile-cards">
    {lista.map(a => (
      <div className="arrendatario-card" key={a.id}>
        <div className="card-header">
          <h3>{a.nombre}</h3>
        </div>
        <div className="card-body">
          <p><strong>Email:</strong> {a.email || '—'}</p>
          <p><strong>Teléfono:</strong> {a.telefono || '—'}</p>
          <p><strong>Local:</strong> {a.locales?.numero ?? '—'}</p>
        </div>
        {(conAccion || onReactivar) && (
          <div className="card-actions">
            {conAccion && (
              <button
                className="btn-edit"
                onClick={() => { setSelectedArrendatario(a); setDrawerOpen(true); }}
              >
                Editar
              </button>
            )}
            {onReactivar && (
              <button
                className="btn-edit"
                onClick={() => onReactivar(a)}
              >
                Reactivar
              </button>
            )}
          </div>
        )}
      </div>
    ))}
  </div>
);
  return (
    <div className="container">

      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión de Arrendatarios</h1>
          <p>Administra los arrendatarios registrados</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setSelectedArrendatario(null); setDrawerOpen(true); }}
        >
          + Nuevo Arrendatario
        </button>
      </div>

      {/* ── Activos ── */}
      <div className="table-card">
        {loading ? (
          <div className="state-message"><p>Cargando arrendatarios...</p></div>
        ) : error ? (
          <div className="state-message error"><p>{error}</p></div>
        ) : arrendatarios.length === 0 ? (
          <div className="state-message"><p>No hay arrendatarios registrados.</p></div>
        ) : (
          <>
            <TablaDesktop lista={arrendatarios} />
            <CardsMobile  lista={arrendatarios} />
          </>
        )}
      </div>

      {/* ── Inactivos colapsable ── */}
      <div className="table-card" style={{ marginTop: '1rem' }}>
        <button
          className="financiero-expand-btn"
          onClick={toggleInactivos}
        >
          <span className="financiero-icon">
            {inactivosExpandido ? '▼' : '▶'}
          </span>
          Arrendatarios inactivos
          {inactivos.length > 0 && (
            <span className="financiero-count" style={{ marginLeft: 'auto' }}>
              {inactivos.length} registros
            </span>
          )}
        </button>

       {inactivosExpandido && (
  loadingInactivos ? (
    <div className="state-message"><p>Cargando...</p></div>
  ) : inactivos.length === 0 ? (
    <div className="state-message"><p>Sin arrendatarios inactivos.</p></div>
  ) : (
    <>
      <TablaDesktop lista={inactivos} conAccion={false} onReactivar={reactivarArrendatario} />
      <CardsMobile  lista={inactivos} conAccion={false} onReactivar={reactivarArrendatario} />
    </>
  )
)}
      </div>

      <ArrendatarioDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        arrendatario={selectedArrendatario}
        onSaved={() => {
          fetchArrendatarios();
          setInactivos([]); // forzar recarga de inactivos al siguiente toggle
        }}
      />
    </div>
  );
}