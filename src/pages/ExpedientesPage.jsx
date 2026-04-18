import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";

const API_URL_CONTRATOS = apiUrl('/api/contratos');
const API_URL_PAGOS     = apiUrl('/api/pagos');

const ESTADO_COLORS = {
  al_dia:   { color: '#16a34a', bg: '#f0fdf4' },
  parcial:  { color: '#d97706', bg: '#fffbeb' },
  pendiente:{ color: '#dc2626', bg: '#fef2f2' },
};

export default function ExpedientesPage() {
  const [expedientes, setExpedientes]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [restaurando, setRestaurando]   = useState(null);
  const [expandido, setExpandido]       = useState(null);   // contrato.id expandido
  const [pagosMap, setPagosMap]         = useState({});     // { contrato_id: pagos[] }
  const [loadingPagos, setLoadingPagos] = useState(null);   // contrato_id cargando

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const fetchExpedientes = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(API_URL_CONTRATOS, {
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("El servidor no respondió con JSON. Revisa la URL en Vercel.");
      }

      const result = await response.json();
      const soloVencidos = (result.data || []).filter(
        c => c.estatus === 'vencido' || c.estatus === 'cancelado'
      );
      setExpedientes(soloVencidos);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPagos = async (contrato_id) => {
    if (pagosMap[contrato_id]) return; // ya cargados
    setLoadingPagos(contrato_id);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL_PAGOS}?contrato_id=${contrato_id}`, {
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
      });
      const result = await response.json();
      setPagosMap(prev => ({ ...prev, [contrato_id]: result.data || [] }));
    } catch (err) {
      console.error('Error cargando pagos:', err.message);
    } finally {
      setLoadingPagos(null);
    }
  };

  const toggleExpansion = (contrato_id) => {
    if (expandido === contrato_id) {
      setExpandido(null);
    } else {
      setExpandido(contrato_id);
      fetchPagos(contrato_id);
    }
  };

  const restaurarContrato = async (contrato) => {
    if (!window.confirm(`¿Restaurar el contrato del local ${contrato.locales?.numero ?? contrato.local_id} a Activo?`)) return;
    setRestaurando(contrato.id);
    try {
      const token = await getToken();
      const response = await fetch(API_URL_CONTRATOS, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ id: contrato.id, estatus: "activo" })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error al restaurar");
      fetchExpedientes();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setRestaurando(null);
    }
  };

  useEffect(() => { fetchExpedientes(); }, []);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1>Expedientes</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>
          Contratos vencidos y cancelados — click en una fila para ver los pagos
        </p>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : expedientes.length === 0 ? (
        <p style={{ color: '#888', marginTop: '40px', textAlign: 'center' }}>
          No hay expedientes por el momento.
        </p>
      ) : (
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee' }}>
              <th style={{ width: '24px' }}></th>
              <th>Local</th>
              <th>Arrendatario</th>
              <th>Fecha Inicio</th>
              <th>Fecha Vencimiento</th>
              <th>Renta</th>
              <th>Estatus</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {expedientes.map((c) => (
              <>
                {/* ── Fila principal ── */}
                <tr
                  key={c.id}
                  onClick={() => toggleExpansion(c.id)}
                  style={{
                    borderBottom: expandido === c.id ? 'none' : '1px solid #eee',
                    cursor: 'pointer',
                    background: expandido === c.id ? '#fafafa' : 'transparent',
                    opacity: 0.9
                  }}
                >
                  <td style={{ textAlign: 'center', fontSize: '11px', color: '#aaa' }}>
                    {expandido === c.id ? '▼' : '▶'}
                  </td>
                  <td>{c.locales?.numero ?? c.local_id}</td>
                  <td>{c.arrendatarios?.nombre ?? c.inquilino_id}</td>
                  <td>{c.fecha_inicio}</td>
                  <td>{c.fecha_vencimiento}</td>
                  <td>${Number(c.renta).toLocaleString()}</td>
                  <td style={{ color: c.estatus === 'vencido' ? '#dc2626' : '#888' }}>
                    {c.estatus}
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => restaurarContrato(c)}
                      disabled={restaurando === c.id}
                    >
                      {restaurando === c.id ? "Restaurando..." : "← Restaurar"}
                    </button>
                  </td>
                </tr>

                {/* ── Fila expandida: pagos ── */}
                {expandido === c.id && (
                  <tr key={`${c.id}-pagos`} style={{ borderBottom: '1px solid #eee' }}>
                    <td colSpan={8} style={{ padding: '0 16px 16px 40px', background: '#fafafa' }}>
                      {loadingPagos === c.id ? (
                        <p style={{ fontSize: '13px', color: '#888', margin: '12px 0' }}>Cargando pagos...</p>
                      ) : !pagosMap[c.id] || pagosMap[c.id].length === 0 ? (
                        <p style={{ fontSize: '13px', color: '#888', margin: '12px 0' }}>Sin registros de pagos.</p>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginTop: '12px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
                              <th style={{ textAlign: 'left', paddingBottom: '6px', fontWeight: 500 }}>Periodo</th>
                              <th style={{ textAlign: 'right', paddingBottom: '6px', fontWeight: 500 }}>Esperado</th>
                              <th style={{ textAlign: 'right', paddingBottom: '6px', fontWeight: 500 }}>Pagado</th>
                              <th style={{ textAlign: 'right', paddingBottom: '6px', fontWeight: 500 }}>Diferencia</th>
                              <th style={{ textAlign: 'center', paddingBottom: '6px', fontWeight: 500 }}>Estado</th>
                              <th style={{ textAlign: 'left', paddingBottom: '6px', fontWeight: 500 }}>Fecha pago</th>
                              <th style={{ textAlign: 'left', paddingBottom: '6px', fontWeight: 500 }}>Método</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagosMap[c.id].map(p => {
                              const estilo = ESTADO_COLORS[p.estado] || { color: '#888', bg: 'transparent' };
                              return (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                  <td style={{ padding: '6px 0' }}>{p.periodo}</td>
                                  <td style={{ textAlign: 'right' }}>${Number(p.monto_esperado).toLocaleString()}</td>
                                  <td style={{ textAlign: 'right' }}>${Number(p.monto_pagado || 0).toLocaleString()}</td>
                                  <td style={{ textAlign: 'right', color: p.diferencia < 0 ? '#dc2626' : '#16a34a' }}>
                                    ${Number(p.diferencia || 0).toLocaleString()}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span style={{
                                      fontSize: '11px',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      color: estilo.color,
                                      background: estilo.bg,
                                      fontWeight: 500
                                    }}>
                                      {p.estado}
                                    </span>
                                  </td>
                                  <td>{p.fecha_pago || '—'}</td>
                                  <td>{p.metodo_pago || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}