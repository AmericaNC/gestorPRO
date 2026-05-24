import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import { logAction } from "../lib/logAction";
import LocalDrawer from "../components/LocalDrawer";

import "../styles/Page.css";

const API_URL_GET = apiUrl('/api/locales');

const fmt = (n) =>
  n != null ? `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

const fmtM2 = (n) =>
  n != null ? `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/m²` : "—";

export default function LocalesPage() {
  const [locales, setLocales]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [selectedLocal, setSelectedLocal]   = useState(null);
  const [expandedRow, setExpandedRow]       = useState(null);
  const [verInactivos, setVerInactivos]     = useState(false);
  const [inactivos, setInactivos]           = useState([]);
  const [loadingInactivos, setLoadingInactivos] = useState(false);
  const [desactivando, setDesactivando]     = useState(null);

  // ── Fetch activos ──────────────────────────────────────────
  const fetchLocales = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(API_URL_GET, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Respuesta no válida del servidor:", text);
        throw new Error("El servidor no respondió con JSON.");
      }
      const result = await response.json();
      setLocales(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch inactivos ────────────────────────────────────────
  const fetchInactivos = async () => {
    setLoadingInactivos(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(`${API_URL_GET}?inactivos=true`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const result = await response.json();
      setInactivos(result.data || []);
    } catch (err) {
      console.error("Error cargando inactivos:", err.message);
    } finally {
      setLoadingInactivos(false);
    }
  };

  const handleToggleInactivos = () => {
    const nuevo = !verInactivos;
    setVerInactivos(nuevo);
    if (nuevo && inactivos.length === 0) fetchInactivos();
  };

  // ── Desactivar local ───────────────────────────────────────
  const desactivarLocal = async (local) => {
    if (!window.confirm(
      `¿Desactivar el local #${local.numero}?\n\nEl local quedará inactivo y no aparecerá en las listas. Sus registros históricos se conservan.`
    )) return;

    setDesactivando(local.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(API_URL_GET, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ action: "delete", id: local.id })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error al desactivar");

      const { data: { user } } = await supabase.auth.getUser();
      await logAction({
        usuario_id: user?.id,
        usuario_email: user?.email,
        accion: "desactivar",
        entidad: "locales",
        entidad_id: local.id,
        descripcion: `Local #${local.numero} desactivado`
      });

      fetchLocales();
      setInactivos([]); // invalida caché para que recargue al abrir
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setDesactivando(null);
    }
  };
const reactivarLocal = async (local) => {
  if (!window.confirm(
    `¿Reactivar el local #${local.numero}?\n\nVolverá a aparecer en las listas con estatus "desocupado".`
  )) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const response = await fetch(API_URL_GET, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ action: "reactivar", id: local.id })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Error al reactivar");

    const { data: { user } } = await supabase.auth.getUser();
    await logAction({
      usuario_id:    user?.id,
      usuario_email: user?.email,
      accion:        "reactivar",
      entidad:       "locales",
      entidad_id:    local.id,
      descripcion:   `Local #${local.numero} reactivado`
    });

    fetchLocales();
    setInactivos([]); // forzar recarga de inactivos
  } catch (err) {
    alert("Error: " + err.message);
  }
};
  useEffect(() => { fetchLocales(); }, []);

  const toggleRow = (id) => setExpandedRow(expandedRow === id ? null : id);

  return (
    <div className="container">

      {/* ── HEADER ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión de Locales</h1>
          <p>Administra los espacios y estatus de ocupación</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-secondary" onClick={handleToggleInactivos}>
            {verInactivos ? "✕ Ocultar inactivos" : " Ver inactivos"}
          </button>
          <button
            className="btn-primary"
            onClick={() => { setSelectedLocal(null); setDrawerOpen(true); }}
          >
            + Nuevo Local
          </button>
        </div>
      </div>

      {/* ── TABLA ACTIVOS ── */}
      <div className="table-card">
        {loading ? (
          <div className="state-message"><p>Cargando locales...</p></div>
        ) : error ? (
          <div className="state-message error"><p>{error}</p></div>
        ) : locales.length === 0 ? (
          <div className="state-message"><p>No hay locales registrados.</p></div>
        ) : (
          <>
            {/* Desktop */}
            <div className="table-scroll">
              <table className="data-table desktop-table">
                <thead>
                  <tr>
                    <th>Núm.</th>
                    <th>m²</th>
                    <th>Estatus</th>
                    <th className="col-money">Renta</th>
                    <th className="col-money">Mantenimiento</th>
                    <th className="col-money">Total</th>
                    <th className="col-money">Renta/m²</th>
                    <th className="col-money">Mant./m²</th>
                    <th className="col-money">Promedio/m²</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {locales.map((l) => (
                    <tr key={l.id}>
                      <td><strong>{l.numero}</strong></td>
                      <td>{l.metros_cuadrados} m²</td>
                      <td>
                        <span className={`status ${l.estatus?.toLowerCase()}`}>
                          {l.estatus?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="col-money">{fmt(l.renta)}</td>
                      <td className="col-money">{fmt(l.mantenimiento_mensual)}</td>
                      <td className="col-money col-total">{fmt(l.total)}</td>
                      <td className="col-money col-rate">{fmtM2(l.renta_por_m2)}</td>
                      <td className="col-money col-rate">{fmtM2(l.mantenimiento_por_m2)}</td>
                      <td className="col-money col-rate">{fmtM2(l.promedio_por_m2)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn-edit"
                            onClick={() => { setSelectedLocal(l); setDrawerOpen(true); }}
                          >
                            Editar
                          </button>
                          <button
                            className="btn-danger"
                            onClick={() => desactivarLocal(l)}
                            disabled={desactivando === l.id || l.estatus === 'rentado'}
                            title={l.estatus === 'rentado'
                              ? 'No se puede desactivar un local rentado'
                              : 'Desactivar local'}
                          >
                            {desactivando === l.id ? "..." : "Desactivar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="mobile-cards">
              {locales.map((l) => (
                <div key={l.id} className="mobile-card">
                  <div className="mobile-card-header" onClick={() => toggleRow(l.id)}>
                    <div className="mobile-card-title">
                      <span className="local-number">Local {l.numero}</span>
                      <span className="local-m2">{l.metros_cuadrados} m²</span>
                      <span className={`status ${l.estatus?.toLowerCase()}`}>
                        {l.estatus?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="mobile-card-right">
                      <span className="mobile-total">{fmt(l.total)}</span>
                      <span className={`chevron ${expandedRow === l.id ? "open" : ""}`}>›</span>
                    </div>
                  </div>

                  {expandedRow === l.id && (
                    <div className="mobile-card-body">
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">Renta</span>
                          <span className="detail-value">{fmt(l.renta)}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Mantenimiento</span>
                          <span className="detail-value">{fmt(l.mantenimiento_mensual)}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Total mensual</span>
                          <span className="detail-value highlight">{fmt(l.total)}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Renta / m²</span>
                          <span className="detail-value">{fmtM2(l.renta_por_m2)}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Mant. / m²</span>
                          <span className="detail-value">{fmtM2(l.mantenimiento_por_m2)}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Promedio / m²</span>
                          <span className="detail-value">{fmtM2(l.promedio_por_m2)}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button
                          className="btn-edit"
                          style={{ flex: 1 }}
                          onClick={() => { setSelectedLocal(l); setDrawerOpen(true); }}
                        >
                          Editar local
                        </button>
                        <button
                          className="btn-danger"
                          style={{ flex: 1 }}
                          onClick={() => desactivarLocal(l)}
                          disabled={desactivando === l.id || l.estatus === 'rentado'}
                        >
                          {desactivando === l.id ? "..." : "Desactivar"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── SECCIÓN INACTIVOS (fuera del table-card de activos) ── */}
      {verInactivos && (
        <div className="table-card" style={{ marginTop: 24 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-secondary)" }}>
               Locales inactivos
            </h3>
          </div>

          {loadingInactivos ? (
            <div className="state-message"><p>Cargando inactivos…</p></div>
          ) : inactivos.length === 0 ? (
            <div className="state-message"><p>No hay locales inactivos.</p></div>
          ) : (
            <>
              {/* Desktop */}
              <div className="table-scroll">
                <table className="data-table desktop-table">
                  <thead>
                    <tr>
                      <th>Núm.</th>
                      <th>m²</th>
                      <th>Estatus</th>
                      <th className="col-money">Renta</th>
                      <th className="col-money">Mantenimiento</th>
                      <th className="col-money">Total</th>
                      <th>Desactivado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactivos.map(l => (
                      <tr key={l.id} style={{ opacity: 0.6 }}>
                        <td><strong>{l.numero}</strong></td>
                        <td>{l.metros_cuadrados} m²</td>
                        <td><span className="status desocupado">inactivo</span></td>
                        <td className="col-money">{fmt(l.renta)}</td>
                        <td className="col-money">{fmt(l.mantenimiento_mensual)}</td>
                        <td className="col-money">{fmt(l.total)}</td>
                        <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                          {l.deleted_at
                            ? new Date(l.deleted_at).toLocaleDateString("es-MX")
                            : "—"}
                        </td>
                        <td>
      <button
        className="btn-edit"
        onClick={() => reactivarLocal(l)}
      >
        Reactivar
      </button>
    </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="mobile-cards">
                {inactivos.map(l => (
                  <div key={l.id} className="mobile-card" style={{ opacity: 0.6 }}>
                    <div className="mobile-card-header">
                      <div className="mobile-card-title">
                        <span className="local-number">Local {l.numero}</span>
                        <span className="local-m2">{l.metros_cuadrados} m²</span>
                        <span className="status desocupado">inactivo</span>
                      </div>
                      <div className="mobile-card-right">
                        <span className="mobile-total">{fmt(l.total)}</span>
                      </div>
                      <td>
      <button
        className="btn-edit"
        onClick={() => reactivarLocal(l)}
      >
        Reactivar
      </button>
    </td>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <LocalDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        local={selectedLocal}
        onSaved={fetchLocales}
      />
    </div>
  );
}