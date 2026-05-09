import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import "../styles/ReportesPage.css";

const API_URL_PAGOS     = apiUrl('/api/pagos');
const API_URL_CONTRATOS = apiUrl('/api/contratos');
const API_URL_INCREMENTOS = apiUrl('/api/incrementos');

// ── Helpers ──
const hoyISO = () => new Date().toISOString().slice(0, 10);
const hace3Meses = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
};
const formatMXN = (n) => `$${Number(n || 0).toLocaleString('es-MX')}`;
const formatDate = (s) => s ? new Date(s).toLocaleDateString('es-MX') : '—';

export default function ReportesPage() {
  const [pagos, setPagos]           = useState([]);
  const [contratos, setContratos]   = useState([]);
  const [incrementos, setIncrementos] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  // Filtros reporte financiero
  const [finDesde, setFinDesde] = useState(hace3Meses());
  const [finHasta, setFinHasta] = useState(hoyISO());

  // Filtros reporte contratos
  const [contEstatus, setContEstatus] = useState("");
  const [contDesde, setContDesde]     = useState("");
  const [contHasta, setContHasta]     = useState("");

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

      const [pagRes, contRes, incRes] = await Promise.all([
        fetch(API_URL_PAGOS,      { headers }),
        fetch(API_URL_CONTRATOS,  { headers }),
        fetch(API_URL_INCREMENTOS,{ headers }),
      ]);
      const [pagData, contData, incData] = await Promise.all([
        pagRes.json(), contRes.json(), incRes.json()
      ]);

      setPagos(pagData.data         || []);
      setContratos(contData.data    || []);
      setIncrementos(incData.data   || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const contratosActivosIds = contratos
    .filter(c => c.estatus === 'activo')
    .map(c => c.id);

  const pagosActivos = pagos.filter(p =>
    contratosActivosIds.includes(p.contrato_id)
  );

const pagosFinanciero = pagos.filter(p => {
  if (!contratosActivosIds.includes(p.contrato_id)) return false;

  const periodo = p.periodo; // YYYY-MM

  const desde = finDesde?.slice(0, 7);
  const hasta = finHasta?.slice(0, 7);

  if (desde && periodo < desde) {
    return false;
  }

  if (hasta && periodo > hasta) {
    return false;
  }

  return true;
});

  // ── Datos reporte contratos filtrados ──
  const contratosReporte = contratos.filter(c => {
    if (contEstatus && c.estatus !== contEstatus) return false;
    if (contDesde && c.fecha_inicio < contDesde) return false;
    if (contHasta && c.fecha_vencimiento > contHasta) return false;
    return true;
  });

  const hoy = new Date();
  const en90 = new Date(); en90.setDate(hoy.getDate() + 90);
  const proximosAVencer = contratos.filter(c => {
    const v = new Date(c.fecha_vencimiento);
    return c.estatus === 'activo' && v >= hoy && v <= en90;
  }).sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));

  // ── Generar PDF ──
  const descargarPDF = (tipo) => {

  const doc = new jsPDF();

  const fechaGenerado =
    new Date().toLocaleDateString(
      'es-MX',
      { dateStyle: 'long' }
    );

  if (tipo === 'financiero') {

    doc.setFontSize(16);

    doc.text(
      'Reporte Financiero',
      14,
      20
    );

    doc.setFontSize(10);

    doc.text(
      `Generado: ${fechaGenerado}`,
      14,
      28
    );

    doc.text(
      `Periodo: ${finDesde} al ${finHasta}`,
      14,
      34
    );

    autoTable(doc, {
      startY: 50,
      head: [['Concepto', 'Monto']],
      body: [
        ['Total esperado', formatMXN(totalEsperado)],
        ['Total cobrado', formatMXN(totalCobrado)],
        ['Diferencia', formatMXN(totalDiferencia)],
      ],
    });

    doc.save(
      `reporte-financiero-${finDesde}-${finHasta}.pdf`
    );
    
  }
  else if (tipo === 'contratos') {

  doc.setFontSize(16);

  doc.text(
    'Reporte de Contratos',
    14,
    20
  );

  doc.setFontSize(10);

  doc.text(
    `Generado: ${fechaGenerado}`,
    14,
    28
  );

  if (contEstatus) {

    doc.text(
      `Filtro estatus: ${contEstatus}`,
      14,
      34
    );
  }

  autoTable(doc, {
    startY: 48,
    head: [[
      'Local',
      'Arrendatario',
      'Inicio',
      'Vencimiento',
      'Renta',
      'Estatus'
    ]],
    body: contratosReporte.map(c => [
      c.locales?.numero ?? c.local_id,
      c.arrendatarios?.nombre ?? '—',
      c.fecha_inicio,
      c.fecha_vencimiento,
      formatMXN(c.renta),
      c.estatus,
    ]),
  });

  doc.save(
    `reporte-contratos-${hoyISO()}.pdf`
  );
}
};
const totalEsperado = pagosActivos.reduce(
  (sum, p) => sum + Number(p.monto_esperado || 0),
  0
);

const totalCobrado = pagosActivos.reduce(
  (sum, p) => sum + Number(p.monto_pagado || 0),
  0
);

const totalDiferencia =
  totalCobrado - totalEsperado;
const resumenPorArrendatario = Object.values(

  pagosFinanciero.reduce((acc, pago) => {

    const nombre =
      pago.contratos?.arrendatarios?.nombre
      ?? pago.contrato_id;

    // crear acumulador
    if (!acc[nombre]) {

      acc[nombre] = {
        nombre,
        esperado: 0,
        cobrado: 0,
        pendientes: 0
      };
    }

    // sumar montos
    acc[nombre].esperado += parseFloat(
      pago.monto_esperado ?? 0
    );

    acc[nombre].cobrado += parseFloat(
      pago.monto_pagado ?? 0
    );

    // contar pendientes/parciales
    // OJO:
    // Tu DB usa:
    // pendiente
    // parcial
    // al_dia

    if (
      pago.estado === 'pendiente' ||
      pago.estado === 'parcial'
    ) {

      acc[nombre].pendientes++;
    }

    return acc;

  }, {})

);
  // ── Estilos ──
  // Moved to ReportesPage.css

  if (loading) return <div style={{ padding: '20px' }}><p>Cargando...</p></div>;
  if (error)   return <div style={{ padding: '20px' }}><p style={{ color: 'red' }}>{error}</p></div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1000px' }}>
      <h1 style={{ marginBottom: '28px' }}>Reportes</h1>

      {/* ══ REPORTE FINANCIERO ══ */}
      <div className="reportes-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <p className="reportes-title" style={{ margin: 0 }}>Reporte Financiero</p>
          <button className="btn-primary" onClick={() => descargarPDF('financiero')}>
            ↓ Descargar PDF
          </button>
        </div>

        {/* Filtros */}
        <div className="reportes-row">
          <div className="reportes-field">
            <label className="reportes-label">Desde</label>
            <input type="date" value={finDesde} onChange={e => setFinDesde(e.target.value)} />
          </div>
          <div className="reportes-field">
            <label className="reportes-label">Hasta</label>
            <input type="date" value={finHasta} onChange={e => setFinHasta(e.target.value)} />
          </div>
        </div>

        {/* Resumen */}
        <div className="reportes-summary">
          <div className="reportes-card"><p className="reportes-label">Total esperado</p><p style={{ margin: 0, fontWeight: 700, fontSize: '18px' }}>{formatMXN(totalEsperado)}</p></div>
          <div className="reportes-card"><p className="reportes-label">Total cobrado</p><p style={{ margin: 0, fontWeight: 700, fontSize: '18px', color: '#16a34a' }}>{formatMXN(totalCobrado)}</p></div>
          <div className="reportes-card"><p className="reportes-label">Diferencia</p><p style={{ margin: 0, fontWeight: 700, fontSize: '18px', color: totalDiferencia < 0 ? '#dc2626' : '#16a34a' }}>{formatMXN(totalDiferencia)}</p></div>
        </div>

        {/* Tabla por arrendatario */}
        <table className="reportes-table">
          <thead>
            <tr>
              <th className="reportes-th">Arrendatario</th>
              <th className="reportes-th">Esperado</th>
              <th className="reportes-th">Cobrado</th>
              <th className="reportes-th">Diferencia</th>
              <th className="reportes-th">Pagos pendientes/parciales</th>
            </tr>
          </thead>
          <tbody>
            {resumenPorArrendatario.map(r => (
              <tr key={r.nombre}>
                <td className="reportes-td">{r.nombre}</td>
                <td className="reportes-td">{formatMXN(r.esperado)}</td>
                <td className="reportes-td">{formatMXN(r.cobrado)}</td>
                <td className="reportes-td" style={{ color: r.cobrado - r.esperado < 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                  {formatMXN(r.cobrado - r.esperado)}
                </td>
                <td className="reportes-td" style={{ color: r.pendientes > 0 ? '#d97706' : '#888' }}>{r.pendientes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ══ REPORTE DE CONTRATOS ══ */}
      <div className="reportes-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <p className="reportes-title" style={{ margin: 0 }}>Reporte de Contratos</p>
          <button className="btn-primary" onClick={() => descargarPDF('contratos')}>
            ↓ Descargar PDF
          </button>
        </div>

        {/* Filtros */}
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
          <div className="reportes-field">
            <label className="reportes-label">Inicio desde</label>
            <input type="date" value={contDesde} onChange={e => setContDesde(e.target.value)} />
          </div>
          <div className="reportes-field">
            <label className="reportes-label">Vencimiento hasta</label>
            <input type="date" value={contHasta} onChange={e => setContHasta(e.target.value)} />
          </div>
        </div>

        {/* Tabla contratos */}
        <table className="reportes-table" style={{ marginBottom: '24px' }}>
          <thead>
            <tr>
              <th className="reportes-th">Local</th>
              <th className="reportes-th">Arrendatario</th>
              <th className="reportes-th">Inicio</th>
              <th className="reportes-th">Vencimiento</th>
              <th className="reportes-th">Renta</th>
              <th className="reportes-th">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {contratosReporte.length === 0 ? (
              <tr><td colSpan={6} className="reportes-td" style={{ color: '#888', textAlign: 'center' }}>Sin resultados</td></tr>
            ) : contratosReporte.map(c => (
              <tr key={c.id}>
                <td className="reportes-td">{c.locales?.numero ?? c.local_id}</td>
                <td className="reportes-td">{c.arrendatarios?.nombre ?? '—'}</td>
                <td className="reportes-td">{c.fecha_inicio}</td>
                <td className="reportes-td">{c.fecha_vencimiento}</td>
                <td className="reportes-td">{formatMXN(c.renta)}</td>
                <td className="reportes-td">{c.estatus}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Próximos a vencer */}
        {proximosAVencer.length > 0 && (
          <>
            <p style={{ fontSize: '13px', fontWeight: 500, color: '#555', marginBottom: '8px' }}>
              Próximos a vencer (90 días)
            </p>
            <table className="reportes-table">
              <thead>
                <tr>
                  <th className="reportes-th">Arrendatario</th>
                  <th className="reportes-th">Local</th>
                  <th className="reportes-th">Vencimiento</th>
                  <th className="reportes-th">Días restantes</th>
                </tr>
              </thead>
              <tbody>
                {proximosAVencer.map(c => {
                  const dias = Math.ceil((new Date(c.fecha_vencimiento) - hoy) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={c.id}>
                      <td className="reportes-td">{c.arrendatarios?.nombre ?? '—'}</td>
                      <td className="reportes-td">{c.locales?.numero ?? c.local_id}</td>
                      <td className="reportes-td">{c.fecha_vencimiento}</td>
                      <td className="reportes-td" style={{ color: dias <= 30 ? '#dc2626' : dias <= 60 ? '#d97706' : '#888', fontWeight: 600 }}>
                        {dias} días
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}