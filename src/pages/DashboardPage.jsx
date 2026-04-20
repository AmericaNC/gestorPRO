import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";

const API_URL_LOCALES      = apiUrl('/api/locales');
const API_URL_CONTRATOS    = apiUrl('/api/contratos');
const API_URL_ARRENDATARIOS = apiUrl('/api/arrendatarios');
const API_URL_PAGOS        = apiUrl('/api/pagos');
const API_URL_INCREMENTOS  = apiUrl('/api/incrementos');

export default function DashboardPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

      const [locRes, contRes, arrRes, pagRes, incRes] = await Promise.all([
        fetch(API_URL_LOCALES,       { headers }),
        fetch(API_URL_CONTRATOS,     { headers }),
        fetch(API_URL_ARRENDATARIOS, { headers }),
        fetch(API_URL_PAGOS,         { headers }),
        fetch(API_URL_INCREMENTOS,   { headers }),
      ]);

      const [locData, contData, arrData, pagData, incData] = await Promise.all([
        locRes.json(), contRes.json(), arrRes.json(), pagRes.json(), incRes.json()
      ]);

      setData({
        locales:       locData.data      || [],
        contratos:     contData.data     || [],
        arrendatarios: arrData.data      || [],
        pagos:         pagData.data      || [],
        incrementos:   incData.data      || [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  if (loading) return <div style={{ padding: '20px' }}><p>Cargando dashboard...</p></div>;
  if (error)   return <div style={{ padding: '20px' }}><p style={{ color: 'red' }}>{error}</p></div>;

  const { locales, contratos, arrendatarios, pagos, incrementos } = data;

  // ── Locales ──
  const localesRentados    = locales.filter(l => l.estatus === 'rentado');
  const localesDesocupados = locales.filter(l => l.estatus === 'desocupado');
  const rentaTotalEsperada = localesRentados.reduce((s, l) => s + Number(l.renta || 0), 0);

  // ── Contratos ──
  const contratosActivos   = contratos.filter(c => c.estatus === 'activo');
  const contratosVencidos  = contratos.filter(c => c.estatus === 'vencido');
  const contratosCancelados = contratos.filter(c => c.estatus === 'cancelado');

  const hoy = new Date();
  const en30  = new Date(); en30.setDate(hoy.getDate() + 30);
  const en60  = new Date(); en60.setDate(hoy.getDate() + 60);
  const en90  = new Date(); en90.setDate(hoy.getDate() + 90);

  const proximosAVencer = contratosActivos
    .filter(c => {
      const vence = new Date(c.fecha_vencimiento);
      return vence >= hoy && vence <= en90;
    })
    .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));

  const vencidosSinExpedir = contratosVencidos; 
  const arrAlDia    = arrendatarios.filter(a => a.estado === 'al_dia');
  const arrAtrasado = arrendatarios.filter(a => a.estado === 'atrasado');
  const arrPendiente = arrendatarios.filter(a => a.estado === 'pendiente');

  const periodoActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const pagosMesActual = pagos.filter(p => p.periodo === periodoActual);
  const pagosMesAlDia    = pagosMesActual.filter(p => p.estado === 'al_dia');
  const pagosMesParcial  = pagosMesActual.filter(p => p.estado === 'parcial');
  const pagosMesPendiente = pagosMesActual.filter(p => p.estado === 'pendiente');

  const totalCobradoMes   = pagosMesActual.reduce((s, p) => s + Number(p.monto_pagado || 0), 0);
  const totalEsperadoMes  = pagosMesActual.reduce((s, p) => s + Number(p.monto_esperado || 0), 0);

  const pagosConDiferenciaNegativa = pagos.filter(p => Number(p.diferencia || 0) < 0);

  const ultimoIncremento = incrementos[0] || null; 

  const diasParaVencer = (fecha) => {
    const diff = new Date(fecha) - hoy;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const S = { // estilos inline reutilizables
    section:  { marginBottom: '32px' },
    title:    { fontSize: '13px', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' },
    grid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' },
    card:     { padding: '14px', border: '1px solid #eee', borderRadius: '6px' },
    label:    { fontSize: '12px', color: '#888', margin: '0 0 4px 0' },
    value:    { fontSize: '22px', fontWeight: 700, margin: 0 },
    table:    { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
    th:       { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #ddd', fontWeight: 500, color: '#555' },
    td:       { padding: '6px 8px', borderBottom: '1px solid #f0f0f0' },
    badge:    (color, bg) => ({ fontSize: '11px', padding: '2px 7px', borderRadius: '4px', color, background: bg, fontWeight: 500 }),
    alert:    { fontSize: '13px', padding: '10px 14px', borderRadius: '6px', marginBottom: '8px' },
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1000px' }}>
      <h1 style={{ marginBottom: '28px' }}>Dashboard</h1>

      {/* ══ LOCALES ══ */}
      <div style={S.section}>
        <p style={S.title}>Locales</p>
        <div style={S.grid}>
          <div style={S.card}><p style={S.label}>Total</p><p style={S.value}>{locales.length}</p></div>
          <div style={S.card}><p style={S.label}>Rentados</p><p style={{ ...S.value, color: '#16a34a' }}>{localesRentados.length}</p></div>
          <div style={S.card}><p style={S.label}>Desocupados</p><p style={{ ...S.value, color: '#dc2626' }}>{localesDesocupados.length}</p></div>
          <div style={S.card}><p style={S.label}>Renta total mensual</p><p style={{ ...S.value, fontSize: '18px' }}>${rentaTotalEsperada.toLocaleString()}</p></div>
        </div>
      </div>

      {/* ══ CONTRATOS ══ */}
      <div style={S.section}>
        <p style={S.title}>Contratos</p>
        <div style={S.grid}>
          <div style={S.card}><p style={S.label}>Activos</p><p style={{ ...S.value, color: '#16a34a' }}>{contratosActivos.length}</p></div>
          <div style={S.card}><p style={S.label}>Vencidos</p><p style={{ ...S.value, color: '#dc2626' }}>{contratosVencidos.length}</p></div>
          <div style={S.card}><p style={S.label}>Cancelados</p><p style={{ ...S.value, color: '#888' }}>{contratosCancelados.length}</p></div>
        </div>

        {/* Próximos a vencer */}
        {proximosAVencer.length > 0 && (
          <>
            <p style={{ ...S.label, marginTop: '16px', marginBottom: '8px' }}>Próximos a vencer (90 días)</p>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Arrendatario</th>
                  <th style={S.th}>Local</th>
                  <th style={S.th}>Vence</th>
                  <th style={S.th}>Días restantes</th>
                </tr>
              </thead>
              <tbody>
                {proximosAVencer.map(c => {
                  const dias = diasParaVencer(c.fecha_vencimiento);
                  const color = dias <= 30 ? '#dc2626' : dias <= 60 ? '#d97706' : '#888';
                  return (
                    <tr key={c.id}>
                      <td style={S.td}>{c.arrendatarios?.nombre ?? '—'}</td>
                      <td style={S.td}>{c.locales?.numero ?? c.local_id}</td>
                      <td style={S.td}>{c.fecha_vencimiento}</td>
                      <td style={{ ...S.td, color, fontWeight: 600 }}>{dias} días</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {/* Vencidos sin expedir */}
        {vencidosSinExpedir.length > 0 && (
          <div style={{ ...S.alert, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', marginTop: '12px' }}>
            ⚠ {vencidosSinExpedir.length} contrato{vencidosSinExpedir.length > 1 ? 's' : ''} vencido{vencidosSinExpedir.length > 1 ? 's' : ''}:
            {' '}{vencidosSinExpedir.map(c => c.arrendatarios?.nombre ?? c.inquilino_id).join(', ')}
          </div>
        )}
      </div>

      {/* ══ ARRENDATARIOS ══ */}
      <div style={S.section}>
        <p style={S.title}>Arrendatarios</p>
        <div style={S.grid}>
          <div style={S.card}><p style={S.label}>Total</p><p style={S.value}>{arrendatarios.length}</p></div>
          <div style={S.card}><p style={S.label}>Al día</p><p style={{ ...S.value, color: '#16a34a' }}>{arrAlDia.length}</p></div>
          <div style={S.card}><p style={S.label}>Atrasados</p><p style={{ ...S.value, color: '#dc2626' }}>{arrAtrasado.length}</p></div>
          <div style={S.card}><p style={S.label}>Pendientes</p><p style={{ ...S.value, color: '#d97706' }}>{arrPendiente.length}</p></div>
        </div>

        {arrAtrasado.length > 0 && (
          <div style={{ ...S.alert, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
            ⚠ Arrendatarios atrasados: {arrAtrasado.map(a => a.nombre).join(', ')}
          </div>
        )}
      </div>

      {/* ══ PAGOS DEL MES ══ */}
      <div style={S.section}>
        <p style={S.title}>Pagos — {periodoActual}</p>
        <div style={S.grid}>
          <div style={S.card}><p style={S.label}>Esperado</p><p style={{ ...S.value, fontSize: '18px' }}>${totalEsperadoMes.toLocaleString()}</p></div>
          <div style={S.card}><p style={S.label}>Cobrado</p><p style={{ ...S.value, fontSize: '18px', color: '#16a34a' }}>${totalCobradoMes.toLocaleString()}</p></div>
          <div style={S.card}><p style={S.label}>Al día</p><p style={{ ...S.value, color: '#16a34a' }}>{pagosMesAlDia.length}</p></div>
          <div style={S.card}><p style={S.label}>Parciales</p><p style={{ ...S.value, color: '#d97706' }}>{pagosMesParcial.length}</p></div>
          <div style={S.card}><p style={S.label}>Pendientes</p><p style={{ ...S.value, color: '#dc2626' }}>{pagosMesPendiente.length}</p></div>
        </div>

        {/* Pagos con diferencia negativa */}
        {pagosConDiferenciaNegativa.length > 0 && (
          <>
            <p style={{ ...S.label, marginTop: '16px', marginBottom: '8px' }}>Pagos con saldo pendiente</p>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Arrendatario</th>
                  <th style={S.th}>Periodo</th>
                  <th style={S.th}>Esperado</th>
                  <th style={S.th}>Pagado</th>
                  <th style={S.th}>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {pagosConDiferenciaNegativa.map(p => (
                  <tr key={p.id}>
                    <td style={S.td}>{p.contratos?.arrendatarios?.nombre ?? '—'}</td>
                    <td style={S.td}>{p.periodo}</td>
                    <td style={S.td}>${Number(p.monto_esperado).toLocaleString()}</td>
                    <td style={S.td}>${Number(p.monto_pagado || 0).toLocaleString()}</td>
                    <td style={{ ...S.td, color: '#dc2626', fontWeight: 600 }}>${Number(p.diferencia).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ══ INCREMENTOS ══ */}
      <div style={S.section}>
        <p style={S.title}>Incrementos</p>
        <div style={S.grid}>
          <div style={S.card}><p style={S.label}>Total aplicados</p><p style={S.value}>{incrementos.length}</p></div>
          {ultimoIncremento && (
            <div style={S.card}>
              <p style={S.label}>Último incremento</p>
              <p style={{ ...S.value, fontSize: '16px' }}>{ultimoIncremento.porcentaje}%</p>
              <p style={{ fontSize: '12px', color: '#888', margin: '2px 0 0' }}>
                {new Date(ultimoIncremento.created_at).toLocaleDateString('es-MX')}
                {' — '}{ultimoIncremento.arrendatarios_afectados?.length ?? 0} arrendatario{ultimoIncremento.arrendatarios_afectados?.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}