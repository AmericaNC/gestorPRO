// src/pages/MantenimientosPage.jsx

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import "../styles/Page.css";
import "../styles/MantenimientosPage.css";
import MantenimientoDrawer from "../components/MantenimientoDrawer";

const API_URL_GASTOS  = apiUrl("/api/gastos");
const API_URL_LOCALES = apiUrl("/api/locales");

const formatMXN = (n) =>
  `$${Number(n || 0).toLocaleString("es-MX")}`;

export default function MantenimientosPage() {

  const [loading, setLoading] = useState(true);

  const [gastos, setGastos] = useState([]);

  const [locales, setLocales] = useState([]);

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [error, setError] = useState("");

  const getToken = async () => {

    const {
      data: { session }
    } = await supabase.auth.getSession();

    return session?.access_token;

  };

  const fetchData = async () => {

    try {

      setLoading(true);

      const token = await getToken();

      const headers = {
        Authorization: `Bearer ${token}`
      };

      const [gastosRes, localesRes] = await Promise.all([
        fetch(API_URL_GASTOS, { headers }),
        fetch(API_URL_LOCALES, { headers })
      ]);

      const gastosData  = await gastosRes.json();
      const localesData = await localesRes.json();

      setGastos(gastosData.data || []);

      setLocales(localesData.data || []);

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }

  };

  useEffect(() => {

    fetchData();

  }, []);

  const totalGastos = gastos.reduce(
    (acc, gasto) => acc + Number(gasto.monto || 0),
    0
  );

return (
  <div className="page-container mantenimientos-page">

    {/* Header */}
    <div className="page-header">
      <div>
        <h1 className="page-title">Mantenimientos</h1>
        <p className="page-subtitle">
          Registro de gastos operativos y mantenimiento
        </p>
      </div>
      <button
        className="btn-primary"
        onClick={() => setDrawerOpen(true)}
      >
        + Registrar gasto
      </button>
    </div>

    {/* Summary - Ahora limpio usando clases CSS */}
    <div className="summary-card">
      <p className="summary-title">Total gastos registrados</p>
      <h2 className="summary-value">{formatMXN(totalGastos)}</h2>
    </div>

    {/* Error */}
    {error && <div className="page-error">{error}</div>}

    {/* Table */}
    <div className="table-wrapper">
      {loading ? (
        <p style={{ padding: "1.5rem", color: "#64748b" }}>Cargando...</p>
      ) : gastos.length === 0 ? (
        <p style={{ padding: "1.5rem", color: "#64748b" }}>No hay gastos registrados.</p>
      ) : (
        <>
          <table className="data-table desktop-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Local</th>
                <th>Categoría</th>
                <th>Concepto</th>
                <th>Monto</th>
                <th>Método pago</th>
              </tr>
            </thead>
            <tbody>
              {gastos.map((gasto) => (
                <tr key={gasto.id}>
                  <td>
                    {new Date(gasto.fecha).toLocaleDateString("es-MX")}
                  </td>
                  {/* Agregamos text-bold para que el ID resalte como en tu imagen */}
                  <td className="text-bold">
                    #{gasto.local_id}
                  </td>
                  <td>
                    {/* Ejemplo de cómo usar las etiquetas de la imagen (Rojo/Verde) */}
                    <span className={`badge ${gasto.categoria === 'Mantenimiento urgente' ? 'badge-danger' : 'badge-success'}`}>
                      {gasto.categoria}
                    </span>
                  </td>
                  <td>{gasto.concepto}</td>
                  {/* Si quieres que el monto total se vea semi-negrita como la tabla original */}
                  <td className="text-bold">{formatMXN(gasto.monto)}</td>
                  <td>{gasto.metodo_pago || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mobile-cards">
            {gastos.map((gasto) => (
              <div key={gasto.id} className="mobile-card">
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Fecha</span>
                  <span className="mobile-card-value">{new Date(gasto.fecha).toLocaleDateString("es-MX")}</span>
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Local</span>
                  <span className="mobile-card-value text-bold">#{gasto.local_id}</span>
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Categoría</span>
                  <span className="mobile-card-value">
                    <span className={`badge ${gasto.categoria === 'Mantenimiento urgente' ? 'badge-danger' : 'badge-success'}`}>
                      {gasto.categoria}
                    </span>
                  </span>
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Concepto</span>
                  <span className="mobile-card-value">{gasto.concepto}</span>
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Monto</span>
                  <span className="mobile-card-value text-bold">{formatMXN(gasto.monto)}</span>
                </div>
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Método</span>
                  <span className="mobile-card-value">{gasto.metodo_pago || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>

    {/* Drawer */}
    <MantenimientoDrawer
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      onSaved={fetchData}
      locales={locales}
    />

  </div>
);

}