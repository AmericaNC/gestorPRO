import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

import "../styles/Page.css";
import "../styles/DashboardPage.css";

const API_URL_LOCALES       = apiUrl('/api/locales');
const API_URL_CONTRATOS     = apiUrl('/api/contratos');
const API_URL_ARRENDATARIOS = apiUrl('/api/arrendatarios');
const API_URL_PAGOS         = apiUrl('/api/pagos');
const API_URL_INCREMENTOS   = apiUrl('/api/incrementos');

const fmt = (n) => `$${Number(n || 0).toLocaleString("es-MX")}`;

const fmtFecha = (f) => f
  ? new Date(f + "T00:00:00").toLocaleDateString("es-MX", {
      day: "2-digit", month: "short", year: "numeric"
    })
  : "—";

export default function DashboardPage() {

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // ── Colapso de secciones de contratos ────────────────────
  const [activosAbierto,    setActivosAbierto]    = useState(true);
  const [vencidosAbierto,   setVencidosAbierto]   = useState(false);
  const [canceladosAbierto, setCanceladosAbierto] = useState(false);
  const [mantenimientoAbierto, setMantenimientoAbierto] = useState(false);

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
        locales:       locData.data  || [],
        contratos:     contData.data || [],
        arrendatarios: arrData.data  || [],
        pagos:         pagData.data  || [],
        incrementos:   incData.data  || [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  if (loading) return <div className="container"><div className="state-message"><p>Cargando dashboard…</p></div></div>;
  if (error)   return <div className="container"><div className="state-message error"><p>{error}</p></div></div>;

  const { locales, contratos, arrendatarios, pagos, incrementos } = data;

  // ── Locales ───────────────────────────────────────────────
  const localesRentados    = locales.filter(l => l.estatus === 'rentado');
  const localesDesocupados = locales.filter(l => l.estatus === 'desocupado');

  const rentaTotalEsperada       = localesRentados.reduce((s, l) => s + Number(l.renta || 0), 0);
  const mantenimientoTotal       = localesRentados.reduce((s, l) => s + Number(l.mantenimiento_mensual || 0), 0);
  const totalGeneral             = rentaTotalEsperada + mantenimientoTotal;
  const promedioMantenimiento    = localesRentados.length
    ? mantenimientoTotal / localesRentados.length
    : 0;

  // ── Contratos ────────────────────────────────────────────
  const contratosActivos    = contratos.filter(c => c.estatus === 'activo');
  const contratosVencidos   = contratos.filter(c => c.estatus === 'vencido');
  const contratosCancelados = contratos.filter(c => c.estatus === 'cancelado');

  const hoy = new Date();
  const en90 = new Date(); en90.setDate(hoy.getDate() + 90);

  const proximosAVencer = contratosActivos
    .filter(c => { const v = new Date(c.fecha_vencimiento); return v >= hoy && v <= en90; })
    .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));

  const diasParaVencer = (f) => Math.ceil((new Date(f) - hoy) / (1000 * 60 * 60 * 24));

  // ── Arrendatarios ────────────────────────────────────────
  const arrAlDia    = arrendatarios.filter(a => a.estado === 'al_dia');
  const arrAtrasado = arrendatarios.filter(a => a.estado === 'atrasado');
  const arrPendiente= arrendatarios.filter(a => a.estado === 'pendiente');

  // ── Pagos ────────────────────────────────────────────────
  const periodoActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  const pagosMesActual   = pagos.filter(p => p.periodo === periodoActual);
  const totalCobradoMes  = pagosMesActual.reduce((s, p) => s + Number(p.monto_pagado  || 0), 0);
  const totalEsperadoMes = pagosMesActual.reduce((s, p) => s + Number(p.monto_esperado|| 0), 0);

  const pagosConDiferenciaNegativa = pagos.filter(p => Number(p.diferencia || 0) < 0);

  // ── Incrementos ──────────────────────────────────────────
  const ultimoIncremento = incrementos[0] || null;

  // ── Chart data ───────────────────────────────────────────
  const dataOcupacion = [
    { name: 'Rentados',    value: localesRentados.length,    color: '#10b981' },
    { name: 'Desocupados', value: localesDesocupados.length, color: '#ef4444' }
  ];
  const dataPagos = [{
    name: periodoActual,
    Cobrado:   totalCobradoMes,
    Pendiente: totalEsperadoMes - totalCobradoMes
  }];

  // ── Sub-componentes ──────────────────────────────────────
  const SummaryCard = ({ label, freq, value, color }) => (
    <div className="table-card dashboard-card">
      <p className="summary-label">
        {label}
        {freq && <span className="summary-freq"> · {freq}</span>}
      </p>
      <p className="summary-value" style={color ? { color } : {}}>{value}</p>
    </div>
  );

  const CollapseHeader = ({ title, count, badge, open, onToggle, badgeColor }) => (
    <button className="dash-collapse-btn" onClick={onToggle}>
      <span className="dash-collapse-icon">{open ? '▼' : '▶'}</span>
      <span className="dash-collapse-title">{title}</span>
      {count != null && (
        <span className="dash-collapse-badge" style={badgeColor ? { background: badgeColor + '20', color: badgeColor } : {}}>
          {count}
        </span>
      )}
      {badge && <span className="dash-collapse-extra">{badge}</span>}
    </button>
  );

  return (
    <div className="container">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p>Resumen general del sistema inmobiliario</p>
        </div>
      </div>

      {/* ── Locales ── */}
      <section className="dash-section">
        <h2 className="section-title">Locales</h2>
        <div className="dashboard-grid">
          <SummaryCard label="Total"         freq="acumulado"  value={locales.length} />
          <SummaryCard label="Rentados"      freq="actualmente" value={localesRentados.length}    color="#16a34a" />
          <SummaryCard label="Desocupados"   freq="actualmente" value={localesDesocupados.length} color="#dc2626" />
          <SummaryCard label="Renta esperada" freq="mensual"    value={fmt(rentaTotalEsperada)} />
        </div>
      </section>

      {/* ── Mantenimiento ── */}
      <section className="dash-section">
        <CollapseHeader
          title="Mantenimiento"
          count={localesRentados.length + " locales"}
          open={mantenimientoAbierto}
          onToggle={() => setMantenimientoAbierto(!mantenimientoAbierto)}
        />

        {/* Cards resumen siempre visibles */}
        <div className="dashboard-grid" style={{ marginTop: '0.875rem' }}>
          <SummaryCard label="Mantenimiento total"    freq="mensual"        value={fmt(mantenimientoTotal)} />
          <SummaryCard label="Promedio por local"     freq="mensual"        value={fmt(promedioMantenimiento)} />
          <SummaryCard label="Total renta + mant."    freq="mensual"        value={fmt(totalGeneral)} />
        </div>

        {/* Desglose por local — colapsable */}
        {mantenimientoAbierto && (
          <div className="table-card" style={{ marginTop: '0.875rem' }}>
            {localesRentados.length === 0 ? (
              <div className="state-message"><p>No hay locales rentados.</p></div>
            ) : (
              <>
                {/* Desktop */}
                <div className="dash-desktop table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Local</th>
                        <th>m²</th>
                        <th>Renta <span className="th-freq">mensual</span></th>
                        <th>Mantenimiento <span className="th-freq">mensual</span></th>
                        <th>Total <span className="th-freq">mensual</span></th>
                        <th>Mant./m² <span className="th-freq">mensual</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {localesRentados.map(l => (
                        <tr key={l.id}>
                          <td><strong>{l.numero}</strong></td>
                          <td>{l.metros_cuadrados} m²</td>
                          <td className="col-money">{fmt(l.renta)}</td>
                          <td className="col-money">{fmt(l.mantenimiento_mensual)}</td>
                          <td className="col-money col-total">{fmt(l.total)}</td>
                          <td className="col-money col-rate">
                            {l.mantenimiento_por_m2
                              ? `$${Number(l.mantenimiento_por_m2).toFixed(2)}/m²`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Móvil */}
                <div className="dash-mobile">
                  {localesRentados.map(l => (
                    <div className="mant-card" key={l.id}>
                      <div className="mant-card-header">
                        <span className="mant-card-local">Local {l.numero}</span>
                        <span className="mant-card-total">{fmt(l.total)}<span className="mant-card-sub">/mes</span></span>
                      </div>
                      <div className="mant-card-body">
                        <div className="detail-item">
                          <span className="detail-label">m²</span>
                          <span className="detail-value">{l.metros_cuadrados}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Renta</span>
                          <span className="detail-value">{fmt(l.renta)}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Mantenimiento</span>
                          <span className="detail-value">{fmt(l.mantenimiento_mensual)}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Mant./m²</span>
                          <span className="detail-value">
                            {l.mantenimiento_por_m2
                              ? `$${Number(l.mantenimiento_por_m2).toFixed(2)}`
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* ── Contratos ── */}
      <section className="dash-section">
        <h2 className="section-title">Contratos</h2>

        {/* Activos */}
        <div className="table-card dash-collapse-card">
          <CollapseHeader
            title="Activos"
            count={contratosActivos.length}
            badgeColor="#16a34a"
            open={activosAbierto}
            onToggle={() => setActivosAbierto(!activosAbierto)}
          />
          {activosAbierto && (
            contratosActivos.length === 0 ? (
              <div className="state-message"><p>Sin contratos activos.</p></div>
            ) : (
              <>
                <div className="dash-desktop table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Arrendatario</th>
                        <th>Local</th>
                        <th>Inicio <span className="th-freq">por contrato</span></th>
                        <th>Vencimiento <span className="th-freq">por contrato</span></th>
                        <th>Renta <span className="th-freq">mensual</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {contratosActivos.map(c => {
                        const dias = diasParaVencer(c.fecha_vencimiento);
                        const color = dias <= 30 ? '#dc2626' : dias <= 60 ? '#d97706' : undefined;
                        return (
                          <tr key={c.id}>
                            <td>{c.arrendatarios?.nombre ?? '—'}</td>
                            <td>{c.locales?.numero ?? c.local_id}</td>
                            <td>{fmtFecha(c.fecha_inicio)}</td>
                            <td style={color ? { color, fontWeight: 600 } : {}}>
                              {fmtFecha(c.fecha_vencimiento)}
                              {dias <= 90 && <span className="dash-dias-badge" style={{ color }}> · {dias}d</span>}
                            </td>
                            <td className="col-money">{fmt(c.renta)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="dash-mobile">
                  {contratosActivos.map(c => {
                    const dias = diasParaVencer(c.fecha_vencimiento);
                    const color = dias <= 30 ? '#dc2626' : dias <= 60 ? '#d97706' : '#6b7280';
                    return (
                      <div className="ct-dash-card" key={c.id}>
                        <div className="ct-dash-card-header">
                          <span className="ct-dash-name">{c.arrendatarios?.nombre ?? '—'}</span>
                          <span className="ct-dash-renta">{fmt(c.renta)}</span>
                        </div>
                        <div className="mant-card-body">
                          <div className="detail-item">
                            <span className="detail-label">Local</span>
                            <span className="detail-value">{c.locales?.numero ?? c.local_id}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Vencimiento</span>
                            <span className="detail-value" style={{ color, fontWeight: 600 }}>
                              {fmtFecha(c.fecha_vencimiento)} · {dias}d
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          )}
        </div>

        {/* Vencidos */}
        <div className="table-card dash-collapse-card" style={{ marginTop: '0.75rem' }}>
          <CollapseHeader
            title="Vencidos"
            count={contratosVencidos.length}
            badgeColor="#dc2626"
            open={vencidosAbierto}
            onToggle={() => setVencidosAbierto(!vencidosAbierto)}
          />
          {vencidosAbierto && (
            contratosVencidos.length === 0 ? (
              <div className="state-message"><p>Sin contratos vencidos.</p></div>
            ) : (
              <div className="dash-desktop table-scroll">
                <table className="data-table">
                  <thead><tr><th>Arrendatario</th><th>Local</th><th>Venció <span className="th-freq">por contrato</span></th><th>Renta <span className="th-freq">mensual</span></th></tr></thead>
                  <tbody>
                    {contratosVencidos.map(c => (
                      <tr key={c.id}>
                        <td>{c.arrendatarios?.nombre ?? '—'}</td>
                        <td>{c.locales?.numero ?? c.local_id}</td>
                        <td>{fmtFecha(c.fecha_vencimiento)}</td>
                        <td className="col-money">{fmt(c.renta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          {vencidosAbierto && contratosVencidos.length > 0 && (
            <div className="dash-mobile">
              {contratosVencidos.map(c => (
                <div className="ct-dash-card" key={c.id}>
                  <div className="ct-dash-card-header">
                    <span className="ct-dash-name">{c.arrendatarios?.nombre ?? '—'}</span>
                    <span className="ct-dash-renta">{fmt(c.renta)}</span>
                  </div>
                  <div className="mant-card-body">
                    <div className="detail-item">
                      <span className="detail-label">Local</span>
                      <span className="detail-value">{c.locales?.numero ?? c.local_id}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Venció</span>
                      <span className="detail-value" style={{ color: '#dc2626' }}>{fmtFecha(c.fecha_vencimiento)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cancelados */}
        <div className="table-card dash-collapse-card" style={{ marginTop: '0.75rem' }}>
          <CollapseHeader
            title="Cancelados"
            count={contratosCancelados.length}
            badgeColor="#6b7280"
            open={canceladosAbierto}
            onToggle={() => setCanceladosAbierto(!canceladosAbierto)}
          />
          {canceladosAbierto && (
            contratosCancelados.length === 0 ? (
              <div className="state-message"><p>Sin contratos cancelados.</p></div>
            ) : (
              <div className="dash-desktop table-scroll">
                <table className="data-table">
                  <thead><tr><th>Arrendatario</th><th>Local</th><th>Fecha <span className="th-freq">por contrato</span></th><th>Renta <span className="th-freq">mensual</span></th></tr></thead>
                  <tbody>
                    {contratosCancelados.map(c => (
                      <tr key={c.id}>
                        <td>{c.arrendatarios?.nombre ?? '—'}</td>
                        <td>{c.locales?.numero ?? c.local_id}</td>
                        <td>{fmtFecha(c.fecha_vencimiento)}</td>
                        <td className="col-money">{fmt(c.renta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          {canceladosAbierto && contratosCancelados.length > 0 && (
            <div className="dash-mobile">
              {contratosCancelados.map(c => (
                <div className="ct-dash-card" key={c.id}>
                  <div className="ct-dash-card-header">
                    <span className="ct-dash-name">{c.arrendatarios?.nombre ?? '—'}</span>
                    <span className="ct-dash-renta">{fmt(c.renta)}</span>
                  </div>
                  <div className="mant-card-body">
                    <div className="detail-item">
                      <span className="detail-label">Local</span>
                      <span className="detail-value">{c.locales?.numero ?? c.local_id}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Fecha</span>
                      <span className="detail-value">{fmtFecha(c.fecha_vencimiento)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Arrendatarios ── */}
      <section className="dash-section">
        <h2 className="section-title">Arrendatarios</h2>
        <div className="dashboard-grid">
          <SummaryCard label="Total"      freq="registrados"  value={arrendatarios.length} />
          <SummaryCard label="Al día"     freq="este periodo" value={arrAlDia.length}     color="#16a34a" />
          <SummaryCard label="Atrasados"  freq="este periodo" value={arrAtrasado.length}  color="#dc2626" />
          <SummaryCard label="Pendientes" freq="este periodo" value={arrPendiente.length} color="#d97706" />
        </div>
      </section>

      {/* ── Pagos ── */}
      <section className="dash-section">
        <h2 className="section-title">Pagos — {periodoActual}</h2>
        <div className="dashboard-grid">
          <SummaryCard label="Esperado"   freq="este periodo" value={fmt(totalEsperadoMes)} />
          <SummaryCard label="Cobrado"    freq="este periodo" value={fmt(totalCobradoMes)}  color="#16a34a" />
          <SummaryCard label="Pendientes" freq="por cobrar"   value={pagosMesActual.filter(p => p.estado === 'pendiente').length} color="#dc2626" />
          <SummaryCard label="Parciales"  freq="por completar" value={pagosMesActual.filter(p => p.estado === 'parcial').length}  color="#d97706" />
        </div>

        {pagosConDiferenciaNegativa.length > 0 && (
          <div className="table-card" style={{ marginTop: '0.875rem' }}>
            <div style={{ padding: '1rem 1rem 0' }}>
              <h3 style={{ fontSize: '0.875rem', color: '#374151', margin: 0 }}>Pagos con saldo pendiente</h3>
            </div>
            <div className="dash-desktop table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>Arrendatario</th><th>Periodo <span className="th-freq">mensual</span></th><th>Esperado <span className="th-freq">por periodo</span></th><th>Pagado <span className="th-freq">por periodo</span></th><th>Diferencia</th></tr>
                </thead>
                <tbody>
                  {pagosConDiferenciaNegativa.map(p => (
                    <tr key={p.id}>
                      <td>{p.contratos?.arrendatarios?.nombre ?? '—'}</td>
                      <td>{p.periodo}</td>
                      <td className="col-money">{fmt(p.monto_esperado)}</td>
                      <td className="col-money">{fmt(p.monto_pagado)}</td>
                      <td className="col-money diff-negative">{fmt(p.diferencia)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="dash-mobile">
              {pagosConDiferenciaNegativa.map(p => (
                <div className="ct-dash-card" key={p.id}>
                  <div className="ct-dash-card-header">
                    <span className="ct-dash-name">{p.contratos?.arrendatarios?.nombre ?? '—'}</span>
                    <span className="ct-dash-renta" style={{ color: '#dc2626' }}>{fmt(p.diferencia)}</span>
                  </div>
                  <div className="mant-card-body">
                    <div className="detail-item">
                      <span className="detail-label">Periodo</span>
                      <span className="detail-value">{p.periodo}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Esperado</span>
                      <span className="detail-value">{fmt(p.monto_esperado)}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Pagado</span>
                      <span className="detail-value">{fmt(p.monto_pagado)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Análisis visual ── */}
      <section className="dash-section">
        <h2 className="section-title">Análisis Visual</h2>
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div className="dashboard-card" style={{ height: '220px' }}>
            <p className="summary-label">Distribución de Locales</p>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataOcupacion} innerRadius={45} outerRadius={70} paddingAngle={5} dataKey="value">
                  {dataOcupacion.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="dashboard-card" style={{ height: '220px' }}>
            <p className="summary-label">Estado de Cobranza ($)</p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataPagos} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Cobrado"   fill="#10b981" radius={[4,4,0,0]} barSize={40} />
                <Bar dataKey="Pendiente" fill="#f59e0b" radius={[4,4,0,0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ── Incrementos ── */}
      <section className="dash-section">
        <h2 className="section-title">Incrementos</h2>
        <div className="dashboard-grid">
          <SummaryCard label="Total aplicados" freq="histórico" value={incrementos.length} />
          {ultimoIncremento && (
            <div className="table-card dashboard-card">
              <p className="summary-label">Último incremento</p>
              <p className="summary-value">{ultimoIncremento.porcentaje}%</p>
              <p style={{ marginTop: '6px', fontSize: '0.75rem', color: '#6b7280' }}>
                {new Date(ultimoIncremento.created_at).toLocaleDateString('es-MX')}
                {' · '}
                {ultimoIncremento.arrendatarios_afectados?.length ?? 0} arrendatarios
              </p>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}