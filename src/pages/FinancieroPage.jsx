import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import PagoDrawer from "../components/PagoDrawer";

const API_URL_GET         = apiUrl('/api/pagos');
const API_URL_CONTRATOS   = apiUrl('/api/contratos');

const ESTADO_LABELS = {
  al_dia:    "Al día",
  parcial:   "Parcial",
  pendiente: "Pendiente"
};

const ESTADO_COLORS = {
  al_dia:    { color: '#16a34a', bg: '#f0fdf4' },
  parcial:   { color: '#d97706', bg: '#fffbeb' },
  pendiente: { color: '#dc2626', bg: '#fef2f2' },
};

export default function FinancieroPage() {
  const [pagos, setPagos]           = useState([]);
  const [contratos, setContratos]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPago, setSelectedPago] = useState(null);

  // Filtros (solo aplican a pagos activos)
  const [filtroEstado, setFiltroEstado]   = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("");

  // Expansión de sección vencidos
  const [vencidosExpandido, setVencidosExpandido] = useState(false);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

      const params = new URLSearchParams();
      if (filtroEstado)  params.append('estado', filtroEstado);
      if (filtroPeriodo) params.append('periodo', filtroPeriodo);

      const [pagosRes, contratosRes] = await Promise.all([
        fetch(`${API_URL_GET}${params.toString() ? '?' + params.toString() : ''}`, { headers }),
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

  useEffect(() => { fetchData(); }, [filtroEstado, filtroPeriodo]);

  // IDs de contratos activos y vencidos
  const contratosActivosIds  = contratos.filter(c => c.estatus === 'activo').map(c => c.id);
  const contratosVencidosIds = contratos.filter(c => c.estatus === 'vencido' || c.estatus === 'cancelado').map(c => c.id);

  // Separar pagos por tipo de contrato
  const pagosActivos  = pagos.filter(p => contratosActivosIds.includes(p.contrato_id));
  const pagosVencidos = pagos.filter(p => contratosVencidosIds.includes(p.contrato_id));

  // Resumen solo sobre activos
  const totalEsperado  = pagosActivos.reduce((sum, p) => sum + Number(p.monto_esperado || 0), 0);
  const totalPagado    = pagosActivos.reduce((sum, p) => sum + Number(p.monto_pagado || 0), 0);
  const totalPendiente = pagosActivos.filter(p => p.estado === 'pendiente').length;

  const TablaPagos = ({ lista, conAccion = false }) => (
    <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #eee' }}>
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
        {lista.map((p) => {
          const estilo = ESTADO_COLORS[p.estado] || { color: '#888', bg: 'transparent' };
          return (
            <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{p.periodo}</td>
              <td>{p.local_id ?? '—'}</td>
              <td>{p.contratos?.arrendatarios?.nombre || '—'}</td>
              <td>${Number(p.monto_esperado).toLocaleString()}</td>
              <td>${Number(p.monto_pagado || 0).toLocaleString()}</td>
              <td style={{ color: p.diferencia < 0 ? '#dc2626' : '#16a34a' }}>
                ${Number(p.diferencia || 0).toLocaleString()}
              </td>
              <td>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  color: estilo.color,
                  background: estilo.bg,
                  fontWeight: 500
                }}>
                  {ESTADO_LABELS[p.estado] || p.estado}
                </span>
              </td>
              <td>{p.fecha_pago || '—'}</td>
              {conAccion && (
                <td>
                  <button onClick={() => { setSelectedPago(p); setDrawerOpen(true); }}>
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
    <div style={{ padding: '20px' }}>
      <h1 style={{ marginBottom: '20px' }}>Financiero</h1>

      {/* Resumen */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '16px', border: '1px solid #eee', borderRadius: '8px', flex: 1 }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Total esperado</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>${totalEsperado.toLocaleString()}</p>
        </div>
        <div style={{ padding: '16px', border: '1px solid #eee', borderRadius: '8px', flex: 1 }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Total cobrado</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#16a34a' }}>${totalPagado.toLocaleString()}</p>
        </div>
        <div style={{ padding: '16px', border: '1px solid #eee', borderRadius: '8px', flex: 1 }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>Pagos pendientes</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#dc2626' }}>{totalPendiente}</p>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="parcial">Parcial</option>
          <option value="al_dia">Al día</option>
        </select>
        <input
          type="month"
          value={filtroPeriodo}
          onChange={e => setFiltroPeriodo(e.target.value)}
        />
        {(filtroEstado || filtroPeriodo) && (
          <button onClick={() => { setFiltroEstado(""); setFiltroPeriodo(""); }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : (
        <>
          {/* ── Pagos de contratos activos ── */}
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '15px', marginBottom: '12px', color: '#333' }}>
              Contratos activos
              <span style={{ fontSize: '12px', color: '#888', fontWeight: 400, marginLeft: '8px' }}>
                {pagosActivos.length} registro{pagosActivos.length !== 1 ? 's' : ''}
              </span>
            </h2>
            {pagosActivos.length === 0 ? (
              <p style={{ color: '#888', fontSize: '13px' }}>No hay pagos para los filtros seleccionados.</p>
            ) : (
              <TablaPagos lista={pagosActivos} conAccion={true} />
            )}
          </div>

          {/* ── Pagos de contratos vencidos / cancelados ── */}
          <div>
            <button
              onClick={() => setVencidosExpandido(v => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 500,
                color: '#555',
                padding: '0 0 12px 0'
              }}
            >
              <span style={{ fontSize: '11px' }}>{vencidosExpandido ? '▼' : '▶'}</span>
              Contratos vencidos / cancelados
              <span style={{ fontSize: '12px', color: '#888', fontWeight: 400 }}>
                {pagosVencidos.length} registro{pagosVencidos.length !== 1 ? 's' : ''}
              </span>
            </button>

            {vencidosExpandido && (
              pagosVencidos.length === 0 ? (
                <p style={{ color: '#888', fontSize: '13px' }}>Sin registros.</p>
              ) : (
                <div style={{ opacity: 0.8 }}>
                  <TablaPagos lista={pagosVencidos} conAccion={false} />
                </div>
              )
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