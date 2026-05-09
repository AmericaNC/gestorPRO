import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import PagoDrawer from "../components/PagoDrawer";

import "../styles/Page.css";
import "../styles/FinancieroPage.css";

const API_URL_GET       = apiUrl('/api/pagos');
const API_URL_CONTRATOS = apiUrl('/api/contratos');

const ESTADO_LABELS = {
  al_dia: "Al día",
  parcial: "Parcial",
  pendiente: "Pendiente"
};

const ESTADO_COLORS = {
  al_dia: {
    color: '#16a34a',
    bg: '#f0fdf4'
  },

  parcial: {
    color: '#d97706',
    bg: '#fffbeb'
  },

  pendiente: {
    color: '#dc2626',
    bg: '#fef2f2'
  },
};

export default function FinancieroPage() {

  const [pagos, setPagos] = useState([]);

  const [contratos, setContratos] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [selectedPago, setSelectedPago] = useState(null);

  const [filtroEstado, setFiltroEstado] = useState("");

  const [filtroPeriodo, setFiltroPeriodo] = useState("");

  const [vencidosExpandido, setVencidosExpandido] = useState(false);

  const getToken = async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    return session?.access_token;
  };

  const fetchData = async () => {

    setLoading(true);
    setError(null);

    try {

      const token = await getToken();

      const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      };

      const params = new URLSearchParams();

      if (filtroEstado) {
        params.append('estado', filtroEstado);
      }

      if (filtroPeriodo) {
        params.append('periodo', filtroPeriodo);
      }

      const [pagosRes, contratosRes] = await Promise.all([
        fetch(
          `${API_URL_GET}${
            params.toString()
              ? '?' + params.toString()
              : ''
          }`,
          { headers }
        ),

        fetch(API_URL_CONTRATOS, { headers })
      ]);

      const [pagosData, contratosData] = await Promise.all([
        pagosRes.json(),
        contratosRes.json()
      ]);

      setPagos(pagosData.data || []);
      setContratos(contratosData.data || []);

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filtroEstado, filtroPeriodo]);

  const contratosActivosIds = contratos
    .filter(c => c.estatus === 'activo')
    .map(c => c.id);

  const contratosVencidosIds = contratos
    .filter(
      c =>
        c.estatus === 'vencido' ||
        c.estatus === 'cancelado'
    )
    .map(c => c.id);

  const pagosActivos = pagos.filter(
    p => contratosActivosIds.includes(p.contrato_id)
  );

  const pagosVencidos = pagos.filter(
    p => contratosVencidosIds.includes(p.contrato_id)
  );

  const totalEsperado = pagosActivos.reduce(
    (sum, p) => sum + Number(p.monto_esperado || 0),
    0
  );

  const totalPagado = pagosActivos.reduce(
    (sum, p) => sum + Number(p.monto_pagado || 0),
    0
  );

  const totalPendiente = pagosActivos.filter(
    p => p.estado === 'pendiente'
  ).length;

  const TablaPagos = ({ lista, conAccion = false }) => (

    <table className="data-table">

      <thead>
        <tr>
          <th>Periodo</th>
          <th>Local</th>
          <th>Arrendatario</th>
          <th>Esperado</th>
          <th>Pagado</th>
          <th>Diferencia</th>
          <th>Estado</th>
          <th>Fecha Pago</th>

          {conAccion && (
            <th>Acciones</th>
          )}
        </tr>
      </thead>

      <tbody>

        {lista.map((p) => {

          const estilo =
            ESTADO_COLORS[p.estado] || {
              color: '#888',
              bg: '#f3f4f6'
            };

          return (

            <tr key={p.id}>

              <td>{p.periodo}</td>

              <td>
                {p.locales?.numero ?? '—'}
              </td>

              <td>
                {p.contratos?.arrendatarios?.nombre || '—'}
              </td>

              <td>
                ${Number(
                  p.monto_esperado
                ).toLocaleString()}
              </td>

              <td>
                ${Number(
                  p.monto_pagado || 0
                ).toLocaleString()}
              </td>

              <td
                style={{
                  color:
                    p.diferencia < 0
                      ? '#dc2626'
                      : '#16a34a'
                }}
              >
                ${Number(
                  p.diferencia || 0
                ).toLocaleString()}
              </td>

              <td>

                <span
                  className="payment-status"
                  style={{
                    color: estilo.color,
                    background: estilo.bg
                  }}
                >
                  {ESTADO_LABELS[p.estado] || p.estado}
                </span>

              </td>

              <td>
                {p.fecha_pago || '—'}
              </td>

              {conAccion && (

                <td>

                  <button
                    className="btn-edit"
                    onClick={() => {
                      setSelectedPago(p);
                      setDrawerOpen(true);
                    }}
                  >
                    Registrar
                  </button>

                </td>
              )}

            </tr>
          );
        })}

      </tbody>

    </table>
  );

  return (

    <div className="container">

      {/* HEADER */}

      <div className="page-header">

        <div>
          <h1>Financiero</h1>

          <p>
            Gestión de pagos y estados financieros
          </p>
        </div>

      </div>

      {/* RESUMEN */}

      <div className="financiero-summary">

        <div className="table-card" style={{ padding: '20px' }}>
          <p className="summary-label">
            Total esperado
          </p>

          <p className="summary-value">
            ${totalEsperado.toLocaleString()}
          </p>
        </div>

        <div className="table-card" style={{ padding: '20px' }}>
          <p className="summary-label">
            Total cobrado
          </p>

          <p
            className="summary-value"
            style={{ color: '#16a34a' }}
          >
            ${totalPagado.toLocaleString()}
          </p>
        </div>

        <div className="table-card" style={{ padding: '20px' }}>
          <p className="summary-label">
            Pagos pendientes
          </p>

          <p
            className="summary-value"
            style={{ color: '#dc2626' }}
          >
            {totalPendiente}
          </p>
        </div>

      </div>

      {/* FILTROS */}

      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}
      >

        <select
          className="filter-input"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="">
            Todos los estados
          </option>

          <option value="pendiente">
            Pendiente
          </option>

          <option value="parcial">
            Parcial
          </option>

          <option value="al_dia">
            Al día
          </option>
        </select>

        <input
          className="filter-input"
          type="month"
          value={filtroPeriodo}
          onChange={(e) => setFiltroPeriodo(e.target.value)}
        />

        {(filtroEstado || filtroPeriodo) && (

          <button
            className="btn-edit"
            onClick={() => {
              setFiltroEstado("");
              setFiltroPeriodo("");
            }}
          >
            Limpiar filtros
          </button>
        )}

      </div>

      {/* CONTENIDO */}

      {loading ? (

        <div className="state-message">
          <p>Cargando pagos...</p>
        </div>

      ) : error ? (

        <div className="state-message error">
          <p>{error}</p>
        </div>

      ) : (

        <>

          {/* ACTIVOS */}

          <div style={{ marginBottom: '40px' }}>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px'
              }}
            >

              <h2 className="financiero-title">
                Contratos activos
              </h2>

              <span className="financiero-count">
                {pagosActivos.length} registros
              </span>

            </div>

            <div className="table-card">

              {pagosActivos.length === 0 ? (

                <div className="state-message">
                  <p>
                    No hay pagos para los filtros seleccionados.
                  </p>
                </div>

              ) : (

                <TablaPagos
                  lista={pagosActivos}
                  conAccion={true}
                />
              )}

            </div>

          </div>

          {/* VENCIDOS */}

          <div>

            <button className="financiero-expand-btn">
              <span className="financiero-icon">
                {vencidosExpandido ? '▼' : '▶'}
              </span>

              Contratos vencidos / cancelados

              <span className="financiero-count" style={{ color: '#9ca3af', fontWeight: 400 }}>
                {pagosVencidos.length} registros
              </span>

            </button>

            {vencidosExpandido && (

              <div
                className="table-card"
                style={{ opacity: 0.85 }}
              >

                {pagosVencidos.length === 0 ? (

                  <div className="state-message">
                    <p>Sin registros.</p>
                  </div>

                ) : (

                  <TablaPagos
                    lista={pagosVencidos}
                    conAccion={false}
                  />
                )}

              </div>
            )}

          </div>

        </>
      )}

      <PagoDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        pago={selectedPago}
        onSaved={fetchData}
      />

    </div>
  );
}