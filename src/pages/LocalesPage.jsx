import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import LocalDrawer from "../components/LocalDrawer";

import "../styles/Page.css";

const API_URL_GET = apiUrl('/api/locales');

const fmt = (n) =>
  n != null ? `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

const fmtM2 = (n) =>
  n != null ? `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/m²` : "—";

export default function LocalesPage() {
  const [locales, setLocales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLocal, setSelectedLocal] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

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

  useEffect(() => { fetchLocales(); }, []);

  const toggleRow = (id) => setExpandedRow(expandedRow === id ? null : id);

  return (
    <div className="container">

      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión de Locales</h1>
          <p>Administra los espacios y estatus de ocupación</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setSelectedLocal(null); setDrawerOpen(true); }}
        >
          + Nuevo Local
        </button>
      </div>

      {/* TABLA */}
      <div className="table-card">
        {loading ? (
          <div className="state-message"><p>Cargando locales...</p></div>
        ) : error ? (
          <div className="state-message error"><p>{error}</p></div>
        ) : locales.length === 0 ? (
          <div className="state-message"><p>No hay locales registrados.</p></div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="table-scroll">
              <table className="data-table">
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
                        <button
                          className="btn-edit"
                          onClick={() => { setSelectedLocal(l); setDrawerOpen(true); }}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mobile-cards">
              {locales.map((l) => (
                <div key={l.id} className="mobile-card">
                  <div
                    className="mobile-card-header"
                    onClick={() => toggleRow(l.id)}
                  >
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
                      <button
                        className="btn-edit btn-edit-full"
                        onClick={() => { setSelectedLocal(l); setDrawerOpen(true); }}
                      >
                        Editar local
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <LocalDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        local={selectedLocal}
        onSaved={fetchLocales}
      />
    </div>
  );
}