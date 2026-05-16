import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { logAction } from "../lib/logAction";
import { apiUrl } from "../lib/apiClient";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import "../styles/ReportesPage.css";

const API_URL_PAGOS       = apiUrl('/api/pagos');
const API_URL_CONTRATOS   = apiUrl('/api/contratos');
const API_URL_INCREMENTOS = apiUrl('/api/incrementos');
const API_URL_GASTOS      = apiUrl('/api/gastos');

const hoyISO     = () => new Date().toISOString().slice(0, 10);
const hace3Meses = () => {
  const d = new Date(); d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
};
const formatMXN  = (n) => `$${Number(n || 0).toLocaleString('es-MX')}`;
const formatDate = (s) => s ? new Date(s).toLocaleDateString('es-MX') : '—';

const getMonthsBetween = (start, end) => {
  const months = [];
  const d = new Date(start); d.setDate(1);
  const last = new Date(end); last.setDate(1);
  while (d <= last) {
    months.push(d.toISOString().slice(0, 7));
    d.setMonth(d.getMonth() + 1);
  }
  return months;
};

export default function ReportesPage() {
  const [pagos, setPagos]             = useState([]);
  const [contratos, setContratos]     = useState([]);
  const [incrementos, setIncrementos] = useState([]);
  const [gastos, setGastos]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const [mostrarDetalleMantenimiento, setMostrarDetalleMantenimiento] = useState(false);

  // Filtro de periodo — SOLO aplica a gastos de mantenimiento
  const [finDesde, setFinDesde] = useState(hace3Meses());
  const [finHasta, setFinHasta] = useState(hoyISO());

  const [contEstatus, setContEstatus] = useState("");
  const [contDesde, setContDesde]     = useState("");
  const [contHasta, setContHasta]     = useState("");

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const logPdfDownload = async (tipo) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await logAction({
        usuario_id: user?.id,
        usuario_email: user?.email,
        accion: "descargar_pdf",
        entidad: "reportes",
        entidad_id: tipo,
        descripcion: `Descarga de PDF de reporte ${tipo}`
      });
    } catch (err) {
      console.warn("No se pudo registrar log:", err.message);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
      const [pagRes, contRes, incRes, gasRes] = await Promise.all([
        fetch(API_URL_PAGOS,       { headers }),
        fetch(API_URL_CONTRATOS,   { headers }),
        fetch(API_URL_INCREMENTOS, { headers }),
        fetch(API_URL_GASTOS,      { headers }),
      ]);
      const [pagData, contData, incData, gasData] = await Promise.all([
        pagRes.json(), contRes.json(), incRes.json(), gasRes.json()
      ]);
      setPagos(pagData.data       || []);
      setContratos(contData.data  || []);
      setIncrementos(incData.data || []);
      setGastos(gasData.data      || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Totales siempre desde contratos activos (sin filtro de fecha) ──
  const contratosActivosIds = contratos.filter(c => c.estatus === 'activo').map(c => c.id);
  const pagosActivos        = pagos.filter(p => contratosActivosIds.includes(p.contrato_id));

  const totalEsperado   = pagosActivos.reduce((s, p) => s + Number(p.monto_esperado || 0), 0);
  const totalCobrado    = pagosActivos.reduce((s, p) => s + Number(p.monto_pagado   || 0), 0);
  const totalDiferencia = totalCobrado - totalEsperado;

  // ── Resumen por arrendatario — también desde contratos activos ──
  const resumenPorArrendatario = Object.values(
    pagosActivos.reduce((acc, pago) => {
      const nombre = pago.contratos?.arrendatarios?.nombre ?? pago.contrato_id;
      if (!acc[nombre]) acc[nombre] = { nombre, esperado: 0, cobrado: 0, pendientes: 0 };
      acc[nombre].esperado  += parseFloat(pago.monto_esperado ?? 0);
      acc[nombre].cobrado   += parseFloat(pago.monto_pagado   ?? 0);
      if (pago.estado === 'pendiente' || pago.estado === 'parcial') acc[nombre].pendientes++;
      return acc;
    }, {})
  );

  // ── Mantenimiento — SÍ usa filtro de periodo ──
  const detalleMantenimiento = contratos
    .filter(c => c.estatus === 'activo')
    .map(c => {
      const rangeStart = finDesde || c.fecha_inicio;
      const rangeEnd   = finHasta || c.fecha_vencimiento;
      const meses      = getMonthsBetween(rangeStart, rangeEnd);

      return {
        contrato: c,
        desglose: meses.map(mes => {
          const gastosDelMes = gastos.filter(g =>
            String(g.local_id) === String(c.local_id) &&
            g.fecha?.slice(0, 7) === mes
          );
          const hayGastosReales = gastosDelMes.length > 0;
          return {
            mes,
            tipo:   hayGastosReales ? "REAL" : "SIMULADO",
            monto:  hayGastosReales
              ? gastosDelMes.reduce((s, g) => s + Number(g.monto || 0), 0)
              : Number(c.locales?.mantenimiento_mensual || 0),
            gastos: gastosDelMes,
          };
        })
      };
    });

  const totalMantenimiento = detalleMantenimiento.reduce(
    (acc, c) => acc + c.desglose.reduce((s, d) => s + d.monto, 0),
    0
  );

  // ── Contratos filtrados ──
  const contratosReporte = contratos.filter(c => {
    if (contEstatus && c.estatus !== contEstatus) return false;
    if (contDesde && c.fecha_inicio < contDesde) return false;
    if (contHasta && c.fecha_vencimiento > contHasta) return false;
    return true;
  });

  const hoy  = new Date();
  const en90 = new Date(); en90.setDate(hoy.getDate() + 90);
  const proximosAVencer = contratos
    .filter(c => { const v = new Date(c.fecha_vencimiento); return c.estatus === 'activo' && v >= hoy && v <= en90; })
    .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));

  // ── PDF ──
  const descargarPDF = async (tipo) => {
    const doc = new jsPDF();
    const fechaGenerado = new Date().toLocaleDateString('es-MX', { dateStyle: 'long' });

    if (tipo === 'financiero') {
      doc.setFontSize(16); doc.text('Reporte Financiero', 14, 20);
      doc.setFontSize(10);
      doc.text(`Generado: ${fechaGenerado}`, 14, 28);
      doc.text('Ingresos y balance: todos los contratos activos (sin filtro de fecha)', 14, 34);
      doc.text(`Gastos de mantenimiento: periodo ${finDesde} al ${finHasta}`, 14, 40);

      autoTable(doc, {
        startY: 50,
        head: [['Concepto', 'Alcance', 'Monto']],
        body: [
          ['Total esperado',            'Contratos activos · acumulado', formatMXN(totalEsperado)],
          ['Total cobrado',             'Contratos activos · acumulado', formatMXN(totalCobrado)],
          ['Diferencia',                'Cobrado vs esperado',           formatMXN(totalDiferencia)],
          ['Gastos de mantenimiento',   `Periodo ${finDesde} – ${finHasta}`, formatMXN(totalMantenimiento)],
        ],
      });

      let y = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(12); doc.text('Detalle de Mantenimiento', 14, y); y += 6;
      doc.setFontSize(8);
      doc.text(`Periodo: ${finDesde} al ${finHasta}  ·  REAL = gasto registrado  |  SIMULADO = mantenimiento_mensual del local`, 14, y);

      autoTable(doc, {
        startY: y + 5,
        head: [['Local', 'Mes', 'Tipo', 'Monto', 'Concepto(s)']],
        body: detalleMantenimiento.flatMap(c =>
          c.desglose.map(d => [
            c.contrato.locales?.numero ?? c.contrato.local_id,
            d.mes,
            d.tipo,
            formatMXN(d.monto),
            d.tipo === 'REAL'
              ? d.gastos.map(g => `${g.categoria}: ${g.concepto}`).join(', ')
              : '—'
          ])
        ),
        bodyStyles: { fontSize: 8 },
      });

      doc.save(`reporte-financiero-${finDesde}-${finHasta}.pdf`);
      await logPdfDownload(tipo);

    } else if (tipo === 'contratos') {
      doc.setFontSize(16); doc.text('Reporte de Contratos', 14, 20);
      doc.setFontSize(10);
      doc.text(`Generado: ${fechaGenerado}`, 14, 28);
      if (contEstatus) doc.text(`Filtro estatus: ${contEstatus}`, 14, 34);
      autoTable(doc, {
        startY: 44,
        head: [['Local', 'Arrendatario', 'Inicio', 'Vencimiento', 'Renta mensual', 'Estatus']],
        body: contratosReporte.map(c => [
          c.locales?.numero ?? c.local_id,
          c.arrendatarios?.nombre ?? '—',
          c.fecha_inicio,
          c.fecha_vencimiento,
          formatMXN(c.renta),
          c.estatus,
        ]),
      });
      doc.save(`reporte-contratos-${hoyISO()}.pdf`);
      await logPdfDownload(tipo);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}><p>Cargando...</p></div>;
  if (error)   return <div style={{ padding: '20px' }}><p style={{ color: 'red' }}>{error}</p></div>;

  return (
    <div className="reportes-page">

      <h1 className="reportes-page-title">Reportes</h1>

      {/* ══ REPORTE FINANCIERO ══ */}
      <div className="reportes-section">

        <div className="reportes-header">
          <div>
            <p className="reportes-title">Reporte Financiero</p>
            <p className="reportes-subtitle">Resumen de ingresos, cobros y balances</p>
          </div>
          <button className="btn-primary" onClick={() => descargarPDF('financiero')}>
            ↓ Descargar PDF
          </button>
        </div>

        {/* ── Aviso de alcance ── */}
        <div className="reportes-scope-banner">
          <span className="reportes-scope-icon">ℹ</span>
          <span>
            <strong>Ingresos y balance</strong> consideran todos los contratos activos, sin importar las fechas seleccionadas.
            El filtro de periodo <strong>solo aplica a los gastos de mantenimiento</strong>.
          </span>
        </div>

        {/* Summary cards — sin filtro */}
        <div className="reportes-summary">
          <div className="reportes-card">
            <p className="reportes-card-label">
              Total esperado <span className="reportes-freq">· contratos activos · acumulado</span>
            </p>
            <p className="reportes-card-value">{formatMXN(totalEsperado)}</p>
          </div>

          <div className="reportes-card">
            <p className="reportes-card-label">
              Total cobrado <span className="reportes-freq">· contratos activos · acumulado</span>
            </p>
            <p className="reportes-card-value success">{formatMXN(totalCobrado)}</p>
          </div>

          <div className="reportes-card">
            <p className="reportes-card-label">
              Diferencia <span className="reportes-freq">· cobrado vs esperado</span>
            </p>
            <p className={`reportes-card-value ${totalDiferencia < 0 ? 'danger' : 'success'}`}>
              {formatMXN(totalDiferencia)}
            </p>
          </div>
        </div>

        {/* Tabla por arrendatario — sin filtro */}
        <div className="reportes-table-wrapper" style={{ marginBottom: '2rem' }}>
          <table className="reportes-table">
            <thead>
              <tr>
                <th className="reportes-th">Arrendatario</th>
                <th className="reportes-th">Esperado <span className="reportes-freq">· acumulado</span></th>
                <th className="reportes-th">Cobrado <span className="reportes-freq">· acumulado</span></th>
                <th className="reportes-th">Diferencia</th>
                <th className="reportes-th">Pendientes <span className="reportes-freq">· pagos sin completar</span></th>
              </tr>
            </thead>
            <tbody>
              {resumenPorArrendatario.map(r => {
                const diferencia = r.cobrado - r.esperado;
                return (
                  <tr key={r.nombre}>
                    <td className="reportes-td">{r.nombre}</td>
                    <td className="reportes-td">{formatMXN(r.esperado)}</td>
                    <td className="reportes-td">{formatMXN(r.cobrado)}</td>
                    <td className={`reportes-td ${diferencia < 0 ? 'reportes-danger' : 'reportes-success'}`}>
                      {formatMXN(diferencia)}
                    </td>
                    <td className={`reportes-td ${r.pendientes > 0 ? 'reportes-warning' : 'reportes-muted'}`}>
                      {r.pendientes}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Divisor mantenimiento ── */}
        <div className="reportes-divider">
          <span>Gastos de Mantenimiento</span>
        </div>

        {/* Filtro de periodo — SOLO para mantenimiento */}
        <p className="reportes-filter-note">
          El periodo seleccionado aplica únicamente al cálculo de gastos de mantenimiento.
          Si no hay gasto registrado en un mes, se usa el valor de <em>mantenimiento mensual</em> del local como referencia.
        </p>

        <div className="reportes-row">
          <div className="reportes-field">
            <label className="reportes-label">
              Desde <span className="reportes-freq">· periodo de mantenimiento</span>
            </label>
            <input type="date" value={finDesde} onChange={e => setFinDesde(e.target.value)} />
          </div>
          <div className="reportes-field">
            <label className="reportes-label">
              Hasta <span className="reportes-freq">· periodo de mantenimiento</span>
            </label>
            <input type="date" value={finHasta} onChange={e => setFinHasta(e.target.value)} />
          </div>
        </div>

        {/* Card mantenimiento — con filtro */}
        <div className="reportes-summary" style={{ marginBottom: '0.75rem' }}>
          <div className="reportes-card">
            <p className="reportes-card-label">
              Gastos de mantenimiento <span className="reportes-freq">· periodo seleccionado</span>
            </p>
            <p className="reportes-card-value danger">{formatMXN(totalMantenimiento)}</p>
          </div>
        </div>

        {/* Botón detalle */}
        <button
          className="btn-secondary"
          onClick={() => setMostrarDetalleMantenimiento(!mostrarDetalleMantenimiento)}
        >
          {mostrarDetalleMantenimiento
            ? "Ocultar detalle"
            : "Ver detalle por local y mes (real / simulado)"}
        </button>

        {/* Detalle colapsable */}
        {mostrarDetalleMantenimiento && (
          <div className="reportes-table-wrapper" style={{ marginTop: '1rem' }}>
            <table className="reportes-table">
              <thead>
                <tr>
                  <th className="reportes-th">Local</th>
                  <th className="reportes-th">Mes <span className="reportes-freq">· en periodo</span></th>
                  <th className="reportes-th">Tipo</th>
                  <th className="reportes-th">Monto</th>
                  <th className="reportes-th">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {detalleMantenimiento.map(c =>
                  c.desglose.map((d, i) => (
                    <tr key={`${c.contrato.id}-${i}`}>
                      <td className="reportes-td">
                        <strong>Local {c.contrato.locales?.numero ?? c.contrato.local_id}</strong>
                      </td>
                      <td className="reportes-td">{d.mes}</td>
                      <td className="reportes-td">
                        <span className={d.tipo === 'REAL' ? 'reportes-success' : 'reportes-warning'}>
                          {d.tipo}
                        </span>
                      </td>
                      <td className="reportes-td">{formatMXN(d.monto)}</td>
                      <td className="reportes-td reportes-muted" style={{ fontSize: '0.82rem' }}>
                        {d.tipo === 'REAL'
                          ? d.gastos.map(g => `${g.categoria}: ${g.concepto} (${formatMXN(g.monto)})`).join(' · ')
                          : `Estimado desde local · ${formatMXN(c.contrato.locales?.mantenimiento_mensual)}/mes`
                        }
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* ══ REPORTE CONTRATOS ══ */}
      <div className="reportes-section">

        <div className="reportes-header">
          <div>
            <p className="title">Reporte de Contratos</p>
            <p className="reportes-subtitle">Contratos activos, vencidos y próximos a vencer</p>
          </div>
          <button className="btn-primary" onClick={() => descargarPDF('contratos')}>
            ↓ Descargar PDF
          </button>
        </div>

        <div className="reportes-row">
          <div className="reportes-field">
            <label className="reportes-label">Estatus</label>
            <select value={contEstatus} onChange={e => setContEstatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="vencido">Vencido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          {/*
          <div className="reportes-field">
            <label className="reportes-label">Inicio desde <span className="reportes-freq">· por contrato</span></label>
            <input type="date" value={contDesde} onChange={e => setContDesde(e.target.value)} />
          </div>
          <div className="reportes-field">
            <label className="reportes-label">Vencimiento hasta <span className="reportes-freq">· por contrato</span></label>
            <input type="date" value={contHasta} onChange={e => setContHasta(e.target.value)} />
          </div>
          */}
        </div>

        {contratosReporte.length === 0 ? (
          <div className="reportes-empty-card">Sin resultados</div>
        ) : (
          <div className="reportes-contracts-grid">
            {contratosReporte.map(c => (
              <div key={c.id} className="reportes-contract-card">
                <div className="reportes-contract-header">
                  <div>
                    <div className="reportes-contract-local">Local {c.locales?.numero ?? c.local_id}</div>
                    <div className="reportes-contract-name">{c.arrendatarios?.nombre ?? '—'}</div>
                  </div>
                  <span className={`reportes-badge ${c.estatus}`}>{c.estatus}</span>
                </div>
                <div className="reportes-contract-grid">
                  <div className="reportes-contract-field">
                    <span className="reportes-contract-label">Fecha inicio <span className="reportes-freq">· por contrato</span></span>
                    <span className="reportes-contract-value">{formatDate(c.fecha_inicio)}</span>
                  </div>
                  <div className="reportes-contract-field">
                    <span className="reportes-contract-label">Vencimiento <span className="reportes-freq">· por contrato</span></span>
                    <span className="reportes-contract-value">{formatDate(c.fecha_vencimiento)}</span>
                  </div>
                  <div className="reportes-contract-field reportes-contract-renta">
                    <span className="reportes-contract-label">Renta <span className="reportes-freq">· mensual</span></span>
                    <span className="reportes-contract-value">{formatMXN(c.renta)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {proximosAVencer.length > 0 && (
          <>
            <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
              <p className="title">Próximos a vencer</p>
              <p className="reportes-subtitle">Contratos que vencen en los próximos 90 días</p>
            </div>
            <div className="reportes-contracts-grid">
              {proximosAVencer.map(c => {
                const dias = Math.ceil((new Date(c.fecha_vencimiento) - hoy) / (1000 * 60 * 60 * 24));
                return (
                  <div key={c.id} className="reportes-contract-card">
                    <div className="reportes-contract-header">
                      <div>
                        <div className="reportes-contract-local">Local {c.locales?.numero ?? c.local_id}</div>
                        <div className="reportes-contract-name">{c.arrendatarios?.nombre ?? '—'}</div>
                      </div>
                      <span className={`reportes-badge ${c.estatus}`}>{c.estatus}</span>
                    </div>
                    <div className="reportes-contract-grid">
                      <div className="reportes-contract-field">
                        <span className="reportes-contract-label">Vencimiento <span className="reportes-freq">· por contrato</span></span>
                        <span className="reportes-contract-value">{formatDate(c.fecha_vencimiento)}</span>
                      </div>
                      <div className="reportes-contract-field">
                        <span className="reportes-contract-label">Días restantes <span className="reportes-freq">· a partir de hoy</span></span>
                        <span className={`reportes-contract-value ${dias <= 30 ? 'reportes-danger' : dias <= 60 ? 'reportes-warning' : 'reportes-muted'}`}>
                          {dias} días
                        </span>
                      </div>
                      <div className="reportes-contract-field reportes-contract-renta">
                        <span className="reportes-contract-label">Renta <span className="reportes-freq">· mensual</span></span>
                        <span className="reportes-contract-value">{formatMXN(c.renta)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

      </div>

    </div>
  );
}