// src/pages/MantenimientosPage.jsx

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";

import MantenimientoDrawer from "../components/MantenimientoDrawer";

import "../styles/Page.css";

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

    <div className="page-container">

      {/* Header */}
      <div className="page-header">

        <div>

          <h1 className="page-title">
            Mantenimientos
          </h1>

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

      {/* Summary */}
      <div
        style={{
          marginBottom: "1.5rem"
        }}
      >

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            padding: "1.2rem"
          }}
        >

          <p
            style={{
              fontSize: ".8rem",
              color: "#9ca3af",
              marginBottom: ".5rem"
            }}
          >
            Total gastos registrados
          </p>

          <h2
            style={{
              margin: 0,
              fontSize: "2rem"
            }}
          >
            {formatMXN(totalGastos)}
          </h2>

        </div>

      </div>

      {/* Error */}
      {error && (

        <div className="page-error">
          {error}
        </div>

      )}

      {/* Table */}
      <div className="table-wrapper">

        {loading ? (

          <p>
            Cargando...
          </p>

        ) : gastos.length === 0 ? (

          <p>
            No hay gastos registrados.
          </p>

        ) : (

          <table className="data-table">

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

              {gastos.map(gasto => (

                <tr key={gasto.id}>

                  <td>
                    {new Date(gasto.fecha)
                      .toLocaleDateString("es-MX")}
                  </td>

                  <td>
                    #{gasto.local_id}
                  </td>

                  <td>
                    {gasto.categoria}
                  </td>

                  <td>
                    {gasto.concepto}
                  </td>

                  <td>
                    {formatMXN(gasto.monto)}
                  </td>

                  <td>
                    {gasto.metodo_pago || "—"}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

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