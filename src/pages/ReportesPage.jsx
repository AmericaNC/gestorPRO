import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";

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

  // ── Datos reporte financiero filtrados ──
  const pagosFinanciero = pagos.filter(p => {
    const periodo = p.periodo; // YYYY-MM
    const desde   = finDesde?.slice(0, 7);
    const hasta   = finHasta?.slice(0, 7);
    if (desde && periodo < desde) return false;
    if (hasta && periodo > hasta) return false;
    return true;
  });

  const totalEsperado  = pagosFinanciero.reduce((s, p) => s + Number(p.monto_esperado || 0), 0);
  const totalCobrado   = pagosFinanciero.reduce((s, p) => s + Number(p.monto_pagado   || 0), 0);
  const totalDiferencia = totalCobrado - totalEsperado;

  const resumenPorArrendatario = Object.values(
    pagosFinanciero.reduce((acc, p) => {
      const nombre = p.contratos?.arrendatarios?.nombre ?? p.contrato_id;
      if (!acc[nombre]) acc[nombre] = { nombre, esperado: 0, cobrado: 0, pendientes: 0 };
      acc[nombre].esperado  += Number(p.monto_esperado || 0);
      acc[nombre].cobrado   += Number(p.monto_pagado   || 0);
      if (p.estado === 'pendiente' || p.estado === 'parcial') acc[nombre].pendientes++;
      return acc;
    }, {})
  );

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
  const descargarPDF = async (tipo) => {
    // Importar jsPDF dinámicamente
    const { jsPDF } = await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    const { default: autoTable } = await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');

    const doc = new jsPDF();
    const fechaGenerado = new Date().toLocaleDateString('es-MX', { dateStyle: 'long' });

    if (tipo === 'financiero') {
      doc.setFontSize(16);
      doc.text('Reporte Financiero', 14, 20);
      doc.setFontSize(10);
      doc.text(`Generado: ${fechaGenerado}`, 14, 28);
      doc.text(`Periodo: ${finDesde} al ${finHasta}`, 14, 34);

      // Resumen general
      doc.setFontSize(12);
      doc.text('Resumen general', 14, 46);
      autoTable(doc, {
        startY: 50,
        head: [['Concepto', 'Monto']],
        body: [
          ['Total esperado',  formatMXN(totalEsperado)],
          ['Total cobrado',   formatMXN(totalCobrado)],
          ['Diferencia',      formatMXN(totalDiferencia)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 50] },
      });

      // Por arrendatario
      doc.text('Detalle por arrendatario', 14, doc.lastAutoTable.finalY + 12);
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 16,
        head: [['Arrendatario', 'Esperado', 'Cobrado', 'Diferencia', 'Pagos pendientes/parciales']],
        body: resumenPorArrendatario.map(r => [
          r.nombre,
          formatMXN(r.esperado),
          formatMXN(r.cobrado),
          formatMXN(r.cobrado - r.esperado),
          r.pendientes,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [50, 50, 50] },
      });

      // Detalle de pagos
      doc.addPage();
      doc.setFontSize(12);
      doc.text('Detalle de pagos', 14, 20);
      autoTable(doc, {
        startY: 24,
        head: [['Periodo', 'Arrendatario', 'Esperado', 'Pagado', 'Diferencia', 'Estado', 'Método']],
        body: pagosFinanciero.map(p => [
          p.periodo,
          p.contratos?.arrendatarios?.nombre ?? '—',
          formatMXN(p.monto_esperado),
          formatMXN(p.monto_pagado),
          formatMXN(p.diferencia),
          p.estado,
          p.metodo_pago ?? '—',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [50, 50, 50] },
        styles: { fontSize: 8 },
      });

      doc.save(`reporte-financiero-${finDesde}-${finHasta}.pdf`);

    } else if (tipo === 'contratos') {
      doc.setFontSize(16);
      doc.text('Reporte de Contratos', 14, 20);
      doc.setFontSize(10);
      doc.text(`Generado: ${fechaGenerado}`, 14, 28);
      if (contEstatus) doc.text(`Filtro estatus: ${contEstatus}`, 14, 34);

      // Listado de contratos
      doc.setFontSize(12);
      doc.text('Contratos', 14, 44);
      autoTable(doc, {
        startY: 48,
        head: [['Local', 'Arrendatario', 'Inicio', 'Vencimiento', 'Renta', 'Estatus']],
        body: contratosReporte.map(c => [
          c.locales?.numero ?? c.local_id,
          c.arrendatarios?.nombre ?? '—',
          c.fecha_inicio,
          c.fecha_vencimiento,
          formatMXN(c.renta),
          c.estatus,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [50, 50, 50] },
        styles: { fontSize: 9 },
      });

      // Próximos a vencer
      if (proximosAVencer.length > 0) {
        doc.text('Próximos a vencer (90 días)', 14, doc.lastAutoTable.finalY + 12);
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 16,
          head: [['Arrendatario', 'Local', 'Vencimiento', 'Días restantes']],
          body: proximosAVencer.map(c => {
            const dias = Math.ceil((new Date(c.fecha_vencimiento) - hoy) / (1000 * 60 * 60 * 24));
            return [
              c.arrendatarios?.nombre ?? '—',
              c.locales?.numero ?? c.local_id,
              c.fecha_vencimiento,
              `${dias} días`,
            ];
          }),
          theme: 'striped',
          headStyles: { fillColor: [50, 50, 50] },
        });
      }

      // Historial de incrementos
      if (incrementos.length > 0) {
        doc.addPage();
        doc.setFontSize(12);
        doc.text('Historial de incrementos', 14, 20);
        autoTable(doc, {
          startY: 24,
          head: [['Fecha', 'Porcentaje', 'Arrendatarios afectados', 'Contratos', 'Pagos actualizados']],
          body: incrementos.map(i => [
            formatDate(i.created_at),
            `${i.porcentaje}%`,
            i.arrendatarios_afectados?.length ?? 0,
            i.contratos_afectados?.length ?? 0,
            i.pagos_actualizados,
          ]),
          theme: 'striped',
          headStyles: { fillColor: [50, 50, 50] },
        });
      }

      doc.save(`reporte-contratos-${hoyISO()}.pdf`);
    }
  };

  // ── Estilos ──
  const S = {
    section: { marginBottom: '36px', padding: '20px', border: '1px solid #eee', borderRadius: '8px' },
    title:   { fontSize: '15px', fontWeight: 600, marginBottom: '16px', margin: '0 0 16px 0' },
    label:   { fontSize: '12px', color: '#888', margin: '0 0 4px 0' },
    row:     { display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '16px', flexWrap: 'wrap' },
    field:   { display: 'flex', flexDirection: 'column', gap: '4px' },
    table:   { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
    th:      { textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #ddd', fontWeight: 500, color: '#555' },
    td:      { padding: '6px 8px', borderBottom: '1px solid #f0f0f0' },
    summary: { display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' },
    card:    { padding: '12px 16px', border: '1px solid #eee', borderRadius: '6px', minWidth: '140px' },
  };

  if (loading) return <div style={{ padding: '20px' }}><p>Cargando...</p></div>;
  if (error)   return <div style={{ padding: '20px' }}><p style={{ color: 'red' }}>{error}</p></div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1000px' }}>
      <h1 style={{ marginBottom: '28px' }}>Reportes</h1>

      {/* ══ REPORTE FINANCIERO ══ */}
      <div style={S.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <p style={{ ...S.title, margin: 0 }}>Reporte Financiero</p>
          <button className="btn-primary" onClick={() => descargarPDF('financiero')}>
            ↓ Descargar PDF
          </button>
        </div>

        {/* Filtros */}
        <div style={S.row}>
          <div style={S.field}>
            <label style={S.label}>Desde</label>
            <input type="date" value={finDesde} onChange={e => setFinDesde(e.target.value)} />
          </div>
          <div style={S.field}>
            <label style={S.label}>Hasta</label>
            <input type="date" value={finHasta} onChange={e => setFinHasta(e.target.value)} />
          </div>
        </div>

        {/* Resumen */}
        <div style={S.summary}>
          <div style={S.card}><p style={S.label}>Total esperado</p><p style={{ margin: 0, fontWeight: 700, fontSize: '18px' }}>{formatMXN(totalEsperado)}</p></div>
          <div style={S.card}><p style={S.label}>Total cobrado</p><p style={{ margin: 0, fontWeight: 700, fontSize: '18px', color: '#16a34a' }}>{formatMXN(totalCobrado)}</p></div>
          <div style={S.card}><p style={S.label}>Diferencia</p><p style={{ margin: 0, fontWeight: 700, fontSize: '18px', color: totalDiferencia < 0 ? '#dc2626' : '#16a34a' }}>{formatMXN(totalDiferencia)}</p></div>
        </div>

        {/* Tabla por arrendatario */}
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Arrendatario</th>
              <th style={S.th}>Esperado</th>
              <th style={S.th}>Cobrado</th>
              <th style={S.th}>Diferencia</th>
              <th style={S.th}>Pagos pendientes/parciales</th>
            </tr>
          </thead>
          <tbody>
            {resumenPorArrendatario.map(r => (
              <tr key={r.nombre}>
                <td style={S.td}>{r.nombre}</td>
                <td style={S.td}>{formatMXN(r.esperado)}</td>
                <td style={S.td}>{formatMXN(r.cobrado)}</td>
                <td style={{ ...S.td, color: r.cobrado - r.esperado < 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                  {formatMXN(r.cobrado - r.esperado)}
                </td>
                <td style={{ ...S.td, color: r.pendientes > 0 ? '#d97706' : '#888' }}>{r.pendientes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ══ REPORTE DE CONTRATOS ══ */}
      <div style={S.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <p style={{ ...S.title, margin: 0 }}>Reporte de Contratos</p>
          <button className="btn-primary" onClick={() => descargarPDF('contratos')}>
            ↓ Descargar PDF
          </button>
        </div>

        {/* Filtros */}
        <div style={S.row}>
          <div style={S.field}>
            <label style={S.label}>Estatus</label>
            <select value={contEstatus} onChange={e => setContEstatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="vencido">Vencido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div style={S.field}>
            <label style={S.label}>Inicio desde</label>
            <input type="date" value={contDesde} onChange={e => setContDesde(e.target.value)} />
          </div>
          <div style={S.field}>
            <label style={S.label}>Vencimiento hasta</label>
            <input type="date" value={contHasta} onChange={e => setContHasta(e.target.value)} />
          </div>
        </div>

        {/* Tabla contratos */}
        <table style={{ ...S.table, marginBottom: '24px' }}>
          <thead>
            <tr>
              <th style={S.th}>Local</th>
              <th style={S.th}>Arrendatario</th>
              <th style={S.th}>Inicio</th>
              <th style={S.th}>Vencimiento</th>
              <th style={S.th}>Renta</th>
              <th style={S.th}>Estatus</th>
            </tr>
          </thead>
          <tbody>
            {contratosReporte.length === 0 ? (
              <tr><td colSpan={6} style={{ ...S.td, color: '#888', textAlign: 'center' }}>Sin resultados</td></tr>
            ) : contratosReporte.map(c => (
              <tr key={c.id}>
                <td style={S.td}>{c.locales?.numero ?? c.local_id}</td>
                <td style={S.td}>{c.arrendatarios?.nombre ?? '—'}</td>
                <td style={S.td}>{c.fecha_inicio}</td>
                <td style={S.td}>{c.fecha_vencimiento}</td>
                <td style={S.td}>{formatMXN(c.renta)}</td>
                <td style={S.td}>{c.estatus}</td>
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
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Arrendatario</th>
                  <th style={S.th}>Local</th>
                  <th style={S.th}>Vencimiento</th>
                  <th style={S.th}>Días restantes</th>
                </tr>
              </thead>
              <tbody>
                {proximosAVencer.map(c => {
                  const dias = Math.ceil((new Date(c.fecha_vencimiento) - hoy) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={c.id}>
                      <td style={S.td}>{c.arrendatarios?.nombre ?? '—'}</td>
                      <td style={S.td}>{c.locales?.numero ?? c.local_id}</td>
                      <td style={S.td}>{c.fecha_vencimiento}</td>
                      <td style={{ ...S.td, color: dias <= 30 ? '#dc2626' : dias <= 60 ? '#d97706' : '#888', fontWeight: 600 }}>
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