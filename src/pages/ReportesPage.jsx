import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { logAction } from "../lib/logAction";
import { apiUrl } from "../lib/apiClient";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import "../styles/ReportesPage.css";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import ExportarExcelReporte from "../components/Exportarexcelreporte";

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
  const d    = new Date(start + 'T12:00:00'); d.setDate(1);
  const last = new Date(end   + 'T12:00:00'); last.setDate(1);
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
const [contratosArchivados, setContratosArchivados] = useState([]);
  const [mostrarDetalleMantenimiento, setMostrarDetalleMantenimiento] = useState(false);

  const [finDesde, setFinDesde] = useState(hace3Meses());
  const [finHasta, setFinHasta] = useState(hoyISO());

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
    const [pagRes, contRes, contArchRes, incRes, gasRes] = await Promise.all([
      fetch(API_URL_PAGOS,                          { headers }),
      fetch(API_URL_CONTRATOS,                      { headers }),
      fetch(`${API_URL_CONTRATOS}?archivados=true`, { headers }), // ← nuevo
      fetch(API_URL_INCREMENTOS,                    { headers }),
      fetch(API_URL_GASTOS,                         { headers }),
    ]);
    const [pagData, contData, contArchData, incData, gasData] = await Promise.all([
      pagRes.json(), contRes.json(), contArchRes.json(), incRes.json(), gasRes.json()
    ]);
    setPagos(pagData.data          || []);
    setContratos(contData.data     || []);
    setContratosArchivados(contArchData.data || []); // ← nuevo state
    setIncrementos(incData.data    || []);
    setGastos(gasData.data         || []);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
  useEffect(() => { fetchData(); }, []);
// IDs de contratos archivados
const contratosArchivadosIds = contratosArchivados.map(c => c.id);

// Pagos cancelados que pertenecen a contratos archivados
const pagosPercididos = pagos.filter(p =>
  p.cancelado === true &&
  contratosArchivadosIds.includes(p.contrato_id)
);

// Total de pérdidas
const totalPerdidas = pagosPercididos.reduce(
  (s, p) => s + (Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0)),
  0
);

// Agrupar por contrato para el detalle
const perdidasPorContrato = contratosArchivados
  .map(c => {
    const pagosDelContrato = pagosPercididos.filter(p => p.contrato_id === c.id);
    if (pagosDelContrato.length === 0) return null;
    return {
      contrato: c,
      pagos: pagosDelContrato,
      total: pagosDelContrato.reduce(
        (s, p) => s + (Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0)),
        0
      )
    };
  })
  .filter(Boolean) // quitar contratos sin pérdidas
  .sort((a, b) => b.total - a.total); // mayor pérdida primero

  const pagosArchivados = pagos.filter(p => contratosArchivadosIds.includes(p.contrato_id));
  const pagosCanceladosArchivados = pagosArchivados.filter(p => p.cancelado === true);
  const totalCanceladosArchivados = pagosCanceladosArchivados.reduce(
    (s, p) => s + (Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0)),
    0
  );
  const pagosDeudaMuertaArchivados = pagosArchivados.filter(
    p => !p.cancelado && (p.estado === 'pendiente' || p.estado === 'parcial')
  );
  const totalDeudaMuertaArchivados = pagosDeudaMuertaArchivados.reduce(
    (s, p) => s + (Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0)),
    0
  );
  const totalPerdidasArchivadas = totalCanceladosArchivados + totalDeudaMuertaArchivados;
  const perdidasArchivadasPorContrato = contratosArchivados
    .map(c => {
      const pagosDelContrato = pagosArchivados.filter(p => p.contrato_id === c.id);
      if (pagosDelContrato.length === 0) return null;
      const cancelados = pagosDelContrato
        .filter(p => p.cancelado === true)
        .reduce((s, p) => s + (Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0)), 0);
      const deudaMuerta = pagosDelContrato
        .filter(p => !p.cancelado && (p.estado === 'pendiente' || p.estado === 'parcial'))
        .reduce((s, p) => s + (Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0)), 0);
      return {
        contrato: c,
        local: c.locales?.numero ?? c.local_id,
        arrendatario: c.arrendatarios?.nombre ?? '—',
        total: cancelados + deudaMuerta,
        cancelados,
        deudaMuerta
      };
    })
    .filter(Boolean);
  // ── Contratos cobrables ───────────────────────────────────
  const contratosCobrables = contratos.filter(c =>
    !c.archivado && 
    c.estatus === 'activo' ||
    c.estatus === 'vencido' ||
    c.estatus === 'finalizado'
  );

  const contratosCobrablesIds = contratosCobrables.map(c => c.id);

  const pagosCobrables = pagos.filter(p =>
    contratosCobrablesIds.includes(p.contrato_id)
  );

  const totalEsperado = pagosCobrables.reduce(
    (s, p) => s + Number(p.monto_esperado || 0), 0
  );

  const totalCobrado = pagosCobrables.reduce(
    (s, p) => s + Number(p.monto_pagado || 0), 0
  );

  const totalDiferencia = totalCobrado - totalEsperado;

  const totalPendiente = pagosCobrables
    .filter(p => p.estado === 'pendiente' || p.estado === 'parcial')
    .reduce((s, p) =>
      s + (Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0)),
    0);

  // ── Pérdida por cancelación ───────────────────────────────
  const pagosCancelados     = pagos.filter(p => p.cancelado === true);
  const perdidaCancelacion  = pagosCancelados.reduce(
    (s, p) => s + (Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0)), 0
  );
  const contratosCancelados = [...new Set(pagosCancelados.map(p => p.contrato_id))].length;

  // ── Resumen por arrendatario ──────────────────────────────
  const resumenPorArrendatario = Object.values(
    pagosCobrables.reduce((acc, pago) => {
      const nombre = pago.contratos?.arrendatarios?.nombre ?? pago.contrato_id;
      if (!acc[nombre]) acc[nombre] = { nombre, esperado: 0, cobrado: 0, pendientes: 0 };
      acc[nombre].esperado  += parseFloat(pago.monto_esperado ?? 0);
      acc[nombre].cobrado   += parseFloat(pago.monto_pagado ?? 0);
      if (pago.estado === 'pendiente' || pago.estado === 'parcial') acc[nombre].pendientes++;
      return acc;
    }, {})
  );

  // ── Mantenimiento ─────────────────────────────────────────

const localIdsConContrato = contratos
  .filter(c =>
    !c.archivado &&  // ← agregar
    (c.estatus === 'activo' || c.estatus === 'vencido' || c.estatus === 'finalizado')
  )
  .map(c => c.local_id);

  const gastosHuerfanos = gastos.filter(g => {
    const enPeriodo = (!finDesde || g.fecha >= finDesde) && (!finHasta || g.fecha <= finHasta);
    return !localIdsConContrato.includes(g.local_id) && enPeriodo;
  });

  const gastosHuerfanosPorLocal = gastosHuerfanos.reduce((acc, g) => {
    if (!acc[g.local_id]) acc[g.local_id] = [];
    acc[g.local_id].push(g);
    return acc;
  }, {});

  const detalleMantenimiento = [
    ...contratos
       .filter(c =>
      !c.archivado &&  // ← agregar
      (c.estatus === 'activo' || c.estatus === 'vencido' || c.estatus === 'finalizado')
    )
      .map(c => {
        const rangeStart = finDesde || c.fecha_inicio;
        const rangeEnd   = finHasta || c.fecha_vencimiento;
        const meses      = getMonthsBetween(rangeStart, rangeEnd);
        return {
          contrato: c,
          desglose: meses.map(mes => {
            const gastosDelMes    = gastos.filter(g => g.local_id === c.local_id && g.fecha?.slice(0, 7) === mes);
            const hayGastosReales = gastosDelMes.length > 0;
            return {
              mes,
              tipo:  hayGastosReales ? "REAL" : "SIMULADO",
              monto: hayGastosReales
                ? gastosDelMes.reduce((s, g) => s + Number(g.monto || 0), 0)
                : Number(c.locales?.mantenimiento_mensual || 0),
              gastos: gastosDelMes,
            };
          })
        };
      }),
    ...Object.entries(gastosHuerfanosPorLocal).map(([localId, gastosLocal]) => {
      const mesesConGastos = [...new Set(gastosLocal.map(g => g.fecha?.slice(0, 7)))];
      return {
        contrato: {
          id: `huerfano-${localId}`,
          local_id: Number(localId),
          locales: { numero: Number(localId) },
          arrendatarios: null,
        },
        desglose: mesesConGastos.map(mes => {
          const gastosDelMes = gastosLocal.filter(g => g.fecha?.slice(0, 7) === mes);
          return {
            mes,
            tipo: "REAL",
            monto: gastosDelMes.reduce((s, g) => s + Number(g.monto || 0), 0),
            gastos: gastosDelMes,
          };
        })
      };
    })
  ];

  const totalMantenimiento = detalleMantenimiento.reduce(
    (acc, c) => acc + c.desglose.reduce((s, d) => s + d.monto, 0), 0
  );

  // ── Contratos filtrados ───────────────────────────────────
  const contratosReporte = contratos.filter(c => {
    if (contEstatus && c.estatus !== contEstatus) return false;
    if (contDesde && c.fecha_inicio < contDesde)  return false;
    if (contHasta && c.fecha_vencimiento > contHasta) return false;
    return true;
  });

  const hoy  = new Date();
  const en90 = new Date(); en90.setDate(hoy.getDate() + 90);
  const proximosAVencer = contratos
    .filter(c => {
      const v = new Date(c.fecha_vencimiento);
      return (c.estatus === 'activo' || c.estatus === 'vencido') && v >= hoy && v <= en90;
    })
    .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento));

  // ── Log ───────────────────────────────────────────────────
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

  // ── Excel ─────────────────────────────────────────────────
  const descargarExcel = async (tipo) => {
    const wb = XLSX.utils.book_new();

    if (tipo === 'financiero') {
      const resumenData = [
        { Concepto: 'Total esperado',          Monto: totalEsperado },
        { Concepto: 'Total cobrado',           Monto: totalCobrado },
        { Concepto: 'Diferencia',              Monto: totalDiferencia },
        { Concepto: 'Pendiente por cobrar',    Monto: totalPendiente },
        { Concepto: 'Gastos mantenimiento',    Monto: totalMantenimiento },
        { Concepto: 'Pérdida por cancelación', Monto: perdidaCancelacion },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenData), 'Resumen');

      const arrendatariosData = resumenPorArrendatario.map(r => ({
        Arrendatario: r.nombre,
        Esperado:     r.esperado,
        Cobrado:      r.cobrado,
        Diferencia:   r.cobrado - r.esperado,
        Pendientes:   r.pendientes,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(arrendatariosData), 'Arrendatarios');

      const mantenimientoData = detalleMantenimiento.flatMap(c =>
        c.desglose.map(d => ({
          Local:   c.contrato.locales?.numero ?? c.contrato.local_id,
          Mes:     d.mes,
          Tipo:    d.tipo,
          Monto:   d.monto,
          Detalle: d.tipo === 'REAL'
            ? d.gastos.map(g => `${g.categoria}: ${g.concepto}`).join(' | ')
            : 'SIMULADO'
        }))
      );
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mantenimientoData), 'Mantenimiento');

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(
        new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `reporte-financiero-${hoyISO()}.xlsx`
      );

    } else if (tipo === 'contratos') {
      const contratosData = contratosReporte.map(c => ({
        Local:         c.locales?.numero ?? c.local_id,
        Arrendatario:  c.arrendatarios?.nombre ?? '—',
        Inicio:        c.fecha_inicio,
        Vencimiento:   c.fecha_vencimiento,
        Renta:         c.renta,
        Estatus:       c.estatus,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contratosData), 'Contratos');

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(
        new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `reporte-contratos-${hoyISO()}.xlsx`
      );
    }
  };

  // ── PDF ───────────────────────────────────────────────────
  const descargarPDF = async (tipo) => {
    const doc = new jsPDF();
    const fechaGenerado = new Date().toLocaleDateString('es-MX', { dateStyle: 'long' });

    if (tipo === 'financiero') {
      doc.setFontSize(16); doc.text('Reporte Financiero', 14, 20);
      doc.setFontSize(10);
      doc.text(`Generado: ${fechaGenerado}`, 14, 28);
      doc.text('Ingresos y balance: todos los contratos activos y vencidos (sin filtro de fecha)', 14, 34);
      doc.text(`Gastos de mantenimiento: periodo ${finDesde} al ${finHasta}`, 14, 40);

      autoTable(doc, {
        startY: 50,
        head: [['Concepto', 'Alcance', 'Monto']],
        body: [
          ['Total esperado',          'Contratos activos y vencidos · acumulado', formatMXN(totalEsperado)],
          ['Total cobrado',           'Contratos activos y vencidos · acumulado', formatMXN(totalCobrado)],
          ['Diferencia',              'Cobrado vs esperado',                       formatMXN(totalDiferencia)],
          ['Pendiente por cobrar',    'Pagos sin completar',                       formatMXN(totalPendiente)],
          ['Gastos de mantenimiento', `Periodo ${finDesde} – ${finHasta}`,         formatMXN(totalMantenimiento)],
          ['Pérdidas archivadas',      'Contratos archivados',                      formatMXN(totalPerdidasArchivadas)],
          ['Pérdida por cancelación', `${contratosCancelados} contrato(s) cancelado(s)`, formatMXN(totalCanceladosArchivados)],
          ['Deuda muerta',            'Contratos archivados',                      formatMXN(totalDeudaMuertaArchivados)],
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

      let y2 = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(12);
      doc.text('Pérdidas archivadas', 14, y2);
      y2 += 6;
      if (perdidasArchivadasPorContrato.length === 0) {
        doc.setFontSize(10);
        doc.text('No hay pérdidas registradas en contratos archivados.', 14, y2);
      } else {
        autoTable(doc, {
          startY: y2,
          head: [['Local', 'Arrendatario', 'Contrato', 'Cancelados', 'Deuda muerta', 'Total']],
          body: perdidasArchivadasPorContrato.map(p => [
            p.local,
            p.arrendatario,
            p.contrato.id,
            formatMXN(p.cancelados),
            formatMXN(p.deudaMuerta),
            formatMXN(p.total)
          ]),
          bodyStyles: { fontSize: 8 },
        });
      }

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

      let y3 = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(12);
      doc.text('Pérdidas archivadas', 14, y3);
      y3 += 6;

      if (perdidasArchivadasPorContrato.length === 0) {
        doc.setFontSize(10);
        doc.text('No hay pérdidas registradas en contratos archivados.', 14, y3);
      } else {
        autoTable(doc, {
          startY: y3,
          head: [['Local', 'Arrendatario', 'Contrato', 'Cancelados', 'Deuda muerta', 'Total']],
          body: perdidasArchivadasPorContrato.map(p => [
            p.local,
            p.arrendatario,
            p.contrato.id,
            formatMXN(p.cancelados),
            formatMXN(p.deudaMuerta),
            formatMXN(p.total)
          ]),
          bodyStyles: { fontSize: 8 },
        });
      }

      doc.save(`reporte-contratos-${hoyISO()}.pdf`);
      await logPdfDownload(tipo);
    }
  };

  // ── Guards ────────────────────────────────────────────────
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
          <ExportarExcelReporte
            pagos={pagos}
            contratos={contratos}
            contratosArchivados={contratosArchivados}
            gastos={gastos}
            detalleMantenimiento={detalleMantenimiento}
            finDesde={finDesde}
            finHasta={finHasta}
          />
        </div>

        <div className="reportes-scope-banner">
          <span className="reportes-scope-icon">ℹ</span>
          <span>
            <strong>Ingresos y balance</strong> consideran todos los contratos activos y vencidos, sin importar las fechas seleccionadas.
            El filtro de periodo <strong>solo aplica a los gastos de mantenimiento</strong>.
          </span>
        </div>

        {/* ── Tarjetas resumen ── */}
        <div className="reportes-summary">

          <div className="reportes-card">
            <p className="reportes-card-label">
              Total esperado <span className="reportes-freq">· contratos activos y vencidos acumulado</span>
            </p>
            <p className="reportes-card-value">{formatMXN(totalEsperado)}</p>
          </div>

          <div className="reportes-card">
            <p className="reportes-card-label">
              Total cobrado <span className="reportes-freq">· contratos activos y vencidos acumulado</span>
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

          <div className="reportes-card">
            <p className="reportes-card-label">
              Pendiente por cobrar <span className="reportes-freq">· pagos sin completar</span>
            </p>
            <p className="reportes-card-value danger">{formatMXN(totalPendiente)}</p>
          </div>

          {perdidaCancelacion > 0 && (
            <div className="reportes-card">
              <p className="reportes-card-label">
                Pérdida por cancelación
                <span className="reportes-freq">
                  · {contratosCancelados} contrato{contratosCancelados !== 1 ? 's' : ''} cancelado{contratosCancelados !== 1 ? 's' : ''}
                </span>
              </p>
              <p className="reportes-card-value danger">{formatMXN(perdidaCancelacion)}</p>
            </div>
          )}

        </div>
       {/* ══ PÉRDIDAS ══ */}
<div className="reportes-section">

  <div className="reportes-header">
    <div>
      <p className="reportes-title">Pérdidas por contratos archivados</p>
      <p className="reportes-subtitle">
        Incluye pagos cancelados (meses no cobrados al desalojar) y deudas pendientes dejadas morir
      </p>
    </div>
  </div>

  {/* ── Cálculo combinado ── */}
  {(() => {
    // Todos los pagos de contratos archivados
    const pagosDeArchivados = pagos.filter(p =>
      contratosArchivadosIds.includes(p.contrato_id)
    );

    // Cancelados: meses que no se cobraron al desalojar
    const pagosCancelados = pagosDeArchivados.filter(p => p.cancelado === true);
    const totalCancelados = pagosCancelados.reduce(
      (s, p) => s + (Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0)), 0
    );

    // Deuda muerta: pendientes o parciales no cancelados (se decidió no cobrar)
    const pagosDeudaMuerta = pagosDeArchivados.filter(
      p => !p.cancelado && (p.estado === 'pendiente' || p.estado === 'parcial')
    );
    const totalDeudaMuerta = pagosDeudaMuerta.reduce(
      (s, p) => s + (Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0)), 0
    );

    const totalPerdidasCombinado = totalCancelados + totalDeudaMuerta;

    // Agrupar por contrato
    const perdidasCombinadas = contratosArchivados
      .map(c => {
        const cancelados   = pagosCancelados.filter(p => p.contrato_id === c.id);
        const deudaMuerta  = pagosDeudaMuerta.filter(p => p.contrato_id === c.id);
        const todos        = [...cancelados, ...deudaMuerta];
        if (todos.length === 0) return null;
        return {
          contrato: c,
          cancelados,
          deudaMuerta,
          todos,
          total: todos.reduce(
            (s, p) => s + (Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0)), 0
          )
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.total - a.total);

    return (
      <>
        {/* Tarjetas resumen */}
        <div className="reportes-summary" style={{ marginBottom: '1.5rem' }}>
          <div className="reportes-card">
            <p className="reportes-card-label">
              Total pérdidas
              <span className="reportes-freq">· cancelados + deuda muerta</span>
            </p>
            <p className="reportes-card-value danger">{formatMXN(totalPerdidasCombinado)}</p>
          </div>
          <div className="reportes-card">
            <p className="reportes-card-label">
              Meses no cobrados
              <span className="reportes-freq">· pagos cancelados al desalojar</span>
            </p>
            <p className="reportes-card-value danger">{formatMXN(totalCancelados)}</p>
          </div>
          <div className="reportes-card">
            <p className="reportes-card-label">
              Deuda dejada morir
              <span className="reportes-freq">· pendientes sin recuperar</span>
            </p>
            <p className="reportes-card-value danger">{formatMXN(totalDeudaMuerta)}</p>
          </div>
          <div className="reportes-card">
            <p className="reportes-card-label">
              Contratos con pérdidas
              <span className="reportes-freq">· archivados</span>
            </p>
            <p className="reportes-card-value danger">{perdidasCombinadas.length}</p>
          </div>
        </div>

        {perdidasCombinadas.length === 0 ? (
          <div className="reportes-empty-card">No hay pérdidas registradas en contratos archivados.</div>
        ) : (
          <div className="reportes-table-wrapper">
            <table className="reportes-table">
              <thead>
                <tr>
                  <th className="reportes-th">Local</th>
                  <th className="reportes-th">Arrendatario</th>
                  <th className="reportes-th">Periodo</th>
                  <th className="reportes-th">Tipo</th>
                  <th className="reportes-th">Esperado</th>
                  <th className="reportes-th">Pagado</th>
                  <th className="reportes-th">Pérdida</th>
                </tr>
              </thead>
              <tbody>
                {perdidasCombinadas.map(({ contrato, todos: ps }) =>
                  ps.map((p, i) => {
                    const perdida  = Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0);
                    const tipo     = p.cancelado ? 'No cobrado' : 'Deuda muerta';
                    const tipoCss  = p.cancelado ? 'reportes-warning' : 'reportes-danger';
                    return (
                      <tr key={p.id}>
                        {i === 0 && (
                          <>
                            <td className="reportes-td" rowSpan={ps.length}>
                              <strong>Local {contrato.locales?.numero ?? contrato.local_id}</strong>
                            </td>
                            <td className="reportes-td" rowSpan={ps.length}>
                              {contrato.arrendatarios?.nombre ?? '—'}
                            </td>
                          </>
                        )}
                        <td className="reportes-td">{p.periodo}</td>
                        <td className="reportes-td">
                          <span className={tipoCss} style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                            {tipo}
                          </span>
                        </td>
                        <td className="reportes-td">{formatMXN(p.monto_esperado)}</td>
                        <td className="reportes-td">{formatMXN(p.monto_pagado)}</td>
                        <td className="reportes-td reportes-danger">
                          <strong>{formatMXN(perdida)}</strong>
                        </td>
                      </tr>
                    );
                  })
                )}
                <tr style={{ borderTop: '2px solid var(--border)' }}>
                  <td className="reportes-td" colSpan={6}><strong>Total pérdidas</strong></td>
                  <td className="reportes-td reportes-danger">
                    <strong>{formatMXN(totalPerdidasCombinado)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  })()}

</div>

        {/* ── Tabla por arrendatario ── */}
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

        {/* ── Mantenimiento ── */}
        <div className="reportes-divider">
          <span>Gastos de Mantenimiento</span>
        </div>

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

        <div className="reportes-summary" style={{ marginBottom: '0.75rem' }}>
          <div className="reportes-card">
            <p className="reportes-card-label">
              Gastos de mantenimiento <span className="reportes-freq">· periodo seleccionado</span>
            </p>
            <p className="reportes-card-value danger">{formatMXN(totalMantenimiento)}</p>
          </div>
        </div>

        <button
          className="btn-secondary"
          onClick={() => setMostrarDetalleMantenimiento(!mostrarDetalleMantenimiento)}
        >
          {mostrarDetalleMantenimiento ? "Ocultar detalle" : "Ver detalle por local y mes (real / simulado)"}
        </button>

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
              <option value="finalizado">Finalizado</option>
            </select>
          </div>
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