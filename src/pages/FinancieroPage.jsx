import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import PagoDrawer from "../components/PagoDrawer";

import "../styles/Page.css";
import "../styles/FinancieroPage.css";

const API_URL_GET       = apiUrl('/api/pagos');
const API_URL_CONTRATOS = apiUrl('/api/contratos');

const ESTADO_LABELS = {
  pagado:   "Pagado",
  parcial:  "Parcial",
  pendiente:"Pendiente"
};

const ESTADO_COLORS = {
  pagado:   { color: '#16a34a', bg: '#f0fdf4' },
  parcial:  { color: '#d97706', bg: '#fffbeb' },
  pendiente:{ color: '#dc2626', bg: '#fef2f2' },
};

const fmt = (n) =>
  `$${Number(n || 0).toLocaleString("es-MX")}`;

export default function FinancieroPage() {

  const [pagos, setPagos]           = useState([]);
  const [contratos, setContratos]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPago, setSelectedPago]           = useState(null);
  const [filtroEstado, setFiltroEstado]           = useState("");
  const [fechaDesde, setFechaDesde]               = useState("");
  const [fechaHasta, setFechaHasta]               = useState("");
  const [vencidosExpandido, setVencidosExpandido] = useState(false);
  const [expandido, setExpandido]                 = useState({});

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
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
      const [pagosRes, contratosRes] = await Promise.all([
        fetch(API_URL_GET,       { headers }),
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

  useEffect(() => { fetchData(); }, []);

  // ── Filtros ──────────────────────────────────────────────
  const pagosFiltrados = pagos.filter(p => {
    if (filtroEstado && p.estado !== filtroEstado) return false;
    if (fechaDesde   && p.periodo < fechaDesde)   return false;
    if (fechaHasta   && p.periodo > fechaHasta)   return false;
    return true;
  });

  const contratosActivosIds  = contratos
    .filter(c => c.estatus === 'activo')
    .map(c => c.id);

  const contratosVencidosIds = contratos
    .filter(c => c.estatus === 'vencido' || c.estatus === 'cancelado')
    .map(c => c.id);

  const pagosActivos  = pagosFiltrados.filter(p => contratosActivosIds.includes(p.contrato_id));
  const pagosVencidos = pagosFiltrados.filter(p => contratosVencidosIds.includes(p.contrato_id));

  // ── Resumen ──────────────────────────────────────────────
  const totalEsperado  = pagosActivos.reduce((s, p) => s + Number(p.monto_esperado || 0), 0);
  const totalPagado    = pagosActivos.reduce((s, p) => s + Number(p.monto_pagado   || 0), 0);
  const totalPendiente = pagosActivos.filter(p => p.estado === 'pendiente').length;

  // ── Agrupación ───────────────────────────────────────────
  const pagosAgrupados = pagosActivos.reduce((acc, pago) => {
    const nombre = pago.contratos?.arrendatarios?.nombre || 'Sin nombre';
    if (!acc[nombre]) acc[nombre] = [];
    acc[nombre].push(pago);
    return acc;
  }, {});

  const toggleGrupo = (nombre) =>
    setExpandido(prev => ({ ...prev, [nombre]: !prev[nombre] }));

  // ── Tabla desktop ─────────────────────────────────────────
  const TablaPagosDesktop = ({ lista, conAccion = false }) => (
    <div className="fin-desktop table-scroll">
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
            {conAccion && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {lista.map(p => {
            const estilo = ESTADO_COLORS[p.estado] || { color: '#888', bg: '#f3f4f6' };
            return (
              <tr key={p.id}>
                <td>{p.periodo}</td>
                <td>{p.locales?.numero ?? '—'}</td>
                <td>{p.contratos?.arrendatarios?.nombre || '—'}</td>
                <td className="col-money">{fmt(p.monto_esperado)}</td>
                <td className="col-money">{fmt(p.monto_pagado)}</td>
                <td className={`col-money ${Number(p.diferencia) < 0 ? 'diff-negative' : 'diff-positive'}`}>
                  {fmt(p.diferencia)}
                </td>
                <td>
                  <span className="payment-status" style={{ color: estilo.color, background: estilo.bg }}>
                    {ESTADO_LABELS[p.estado] || p.estado}
                  </span>
                </td>
                <td>{p.fecha_pago || '—'}</td>
                {conAccion && (
                  <td>
                    <button className="btn-edit"
                      onClick={() => { setSelectedPago(p); setDrawerOpen(true); }}>
                      Registrar
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // ── Cards móvil ───────────────────────────────────────────
  const TablaPagosMobile = ({ lista, conAccion = false }) => (
    <div className="fin-mobile">
      {lista.map(p => {
        const estilo = ESTADO_COLORS[p.estado] || { color: '#888', bg: '#f3f4f6' };
        const diff   = Number(p.diferencia || 0);
        return (
          <div className="pago-card" key={p.id}>
            <div className="pago-card-header">
              <span className="pago-card-periodo">{p.periodo}</span>
              <span className="payment-status" style={{ color: estilo.color, background: estilo.bg }}>
                {ESTADO_LABELS[p.estado] || p.estado}
              </span>
            </div>

            <div className="pago-card-arrendatario">
              Local {p.locales?.numero ?? '—'} · {p.contratos?.arrendatarios?.nombre || '—'}
            </div>

            <div className="pago-card-body">
              <div className="pago-card-item">
                <span className="pago-card-item-label">Esperado</span>
                <span className="pago-card-item-value">{fmt(p.monto_esperado)}</span>
              </div>
              <div className="pago-card-item">
                <span className="pago-card-item-label">Pagado</span>
                <span className="pago-card-item-value">{fmt(p.monto_pagado)}</span>
              </div>
              <div className="pago-card-item">
                <span className="pago-card-item-label">Diferencia</span>
                <span className={`pago-card-item-value ${diff < 0 ? 'red' : 'green'}`}>
                  {fmt(diff)}
                </span>
              </div>
              <div className="pago-card-item">
                <span className="pago-card-item-label">Fecha pago</span>
                <span className="pago-card-item-value">{p.fecha_pago || '—'}</span>
              </div>
            </div>

            {conAccion && (
              <div className="pago-card-footer">
                <button className="btn-edit btn-edit-full"
                  onClick={() => { setSelectedPago(p); setDrawerOpen(true); }}>
                  Registrar pago
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="container">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Financiero</h1>
          <p>Gestión de pagos y estados financieros</p>
        </div>
      </div>

      {/* Resumen */}
      <div className="financiero-summary">
        <div className="table-card summary-card">
          <p className="summary-label">Total esperado</p>
          <p className="summary-value">{fmt(totalEsperado)}</p>
        </div>
        <div className="table-card summary-card">
          <p className="summary-label">Total cobrado</p>
          <p className="summary-value green">{fmt(totalPagado)}</p>
        </div>
        <div className="table-card summary-card">
          <p className="summary-label">Pagos pendientes</p>
          <p className="summary-value red">{totalPendiente}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="financiero-filters">
        <select className="filter-input" value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="parcial">Parcial</option>
          <option value="pagado">Pagado</option>
        </select>

        <input className="filter-input" type="month" value={fechaDesde}
          onChange={e => setFechaDesde(e.target.value)} />
        <input className="filter-input" type="month" value={fechaHasta}
          onChange={e => setFechaHasta(e.target.value)} />

        {(filtroEstado || fechaDesde || fechaHasta) && (
          <button className="btn-edit"
            onClick={() => { setFiltroEstado(""); setFechaDesde(""); setFechaHasta(""); }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="state-message"><p>Cargando pagos…</p></div>
      ) : error ? (
        <div className="state-message error"><p>{error}</p></div>
      ) : (
        <>
          {/* Activos */}
          <div className="financiero-section">
            <div className="financiero-section-header">
              <h2 className="financiero-title">Contratos activos</h2>
              <span className="financiero-count">{pagosActivos.length} registros</span>
            </div>

            {Object.entries(pagosAgrupados).map(([nombre, lista]) => (
              <div key={nombre} className="table-card financiero-group">
                <button className="financiero-expand-btn" onClick={() => toggleGrupo(nombre)}>
                  <span className="financiero-icon">{expandido[nombre] ? '▼' : '▶'}</span>
                  {nombre}
                  <span className="financiero-count" style={{ marginLeft: 'auto' }}>
                    {lista.length} pagos
                  </span>
                </button>

                {expandido[nombre] && (
                  <>
                    <TablaPagosDesktop lista={lista} conAccion />
                    <TablaPagosMobile  lista={lista} conAccion />
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Vencidos */}
          <div>
            <div className="table-card financiero-group">
              <button className="financiero-expand-btn"
                onClick={() => setVencidosExpandido(!vencidosExpandido)}>
                <span className="financiero-icon">{vencidosExpandido ? '▼' : '▶'}</span>
                Contratos vencidos / cancelados
                <span className="financiero-count" style={{ marginLeft: 'auto' }}>
                  {pagosVencidos.length} registros
                </span>
              </button>

              {vencidosExpandido && (
                pagosVencidos.length === 0 ? (
                  <div className="state-message"><p>Sin registros.</p></div>
                ) : (
                  <>
                    <TablaPagosDesktop lista={pagosVencidos} />
                    <TablaPagosMobile  lista={pagosVencidos} />
                  </>
                )
              )}
            </div>
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