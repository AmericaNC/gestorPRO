

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// ─────────────────────────────────────────────────────────────────
// Paleta de colores (ARGB sin #)
// ─────────────────────────────────────────────────────────────────
const C = {
  // Cabeceras principales
  headerDark:    'FF1A237E', // azul marino
  headerMid:     'FF283593', // azul medio
  headerLight:   'FFE8EAF6', // azul muy claro (fila sub-header)

  // Secciones por estatus
  bgActivo:      'FFE3F2FD', // azul claro
  bgVencido:     'FFFFF8E1', // amarillo suave
  bgCancelado:   'FFFCE4EC', // rosa suave

  // Filas
  rowAlterA:     'FFFAFAFA',
  rowAlterB:     'FFFFFFFF',

  // Estado de pago
  estadoPagado:  'FFE8F5E9',
  estadoParcial: 'FFFFF9C4',
  estadoPendiente:'FFFFEBEE',

  // Totales
  totalRow:      'FFECEFF1',
  resumenBg:     'FFF5F5F5',

  // Texto
  white:         'FFFFFFFF',
  dark:          'FF212121',
  muted:         'FF757575',
  danger:        'FFC62828',
  success:       'FF2E7D32',
  warning:       'FFF57F17',
};

// ─────────────────────────────────────────────────────────────────
// Helpers de estilo openpyxl-style → xlsx cell_styles
// ─────────────────────────────────────────────────────────────────
const font = (opts = {}) => ({
  name: 'Arial',
  sz: opts.sz || 10,
  bold: opts.bold || false,
  color: { argb: opts.color || C.dark },
  italic: opts.italic || false,
});

const fill = (argb) => ({
  patternType: 'solid',
  fgColor: { argb },
});

const border = (style = 'thin') => ({
  top:    { style, color: { argb: 'FFBDBDBD' } },
  bottom: { style, color: { argb: 'FFBDBDBD' } },
  left:   { style, color: { argb: 'FFBDBDBD' } },
  right:  { style, color: { argb: 'FFBDBDBD' } },
});

const align = (h = 'left', v = 'center', wrap = false) => ({
  horizontal: h,
  vertical: v,
  wrapText: wrap,
});

function applyStyle(ws, cellAddr, opts = {}) {
  if (!ws[cellAddr]) ws[cellAddr] = { t: 's', v: '' };
  ws[cellAddr].s = {
    font:      opts.font      || font(),
    fill:      opts.fill      || { patternType: 'none' },
    border:    opts.border    || border(),
    alignment: opts.alignment || align(),
    numFmt:    opts.numFmt    || '',
  };
}

function applyRangeStyle(ws, range, opts) {
  const decoded = XLSX.utils.decode_range(range);
  for (let R = decoded.s.r; R <= decoded.e.r; R++) {
    for (let C2 = decoded.s.c; C2 <= decoded.e.c; C2++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C2 });
      applyStyle(ws, addr, opts);
    }
  }
}

const fmtPeso = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
const fmtFecha = (s) => s ? new Date(s + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const hoyISO = () => new Date().toISOString().slice(0, 10);

// ─────────────────────────────────────────────────────────────────
// HOJA 1 — Resumen ejecutivo
// ─────────────────────────────────────────────────────────────────
function crearHojaResumen(wb, { contratos, pagos, gastos, detalleMantenimiento, finDesde, finHasta, totalPerdidasArchivadas = 0, totalCanceladosArchivados = 0, totalDeudaMuertaArchivados = 0 }) {

  const ws = {};
  const wsName = 'Resumen';
  let row = 1;

  // Anchos de columna
  ws['!cols'] = [
    { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
  ];

  // ── Título principal ──
  const titleCell = XLSX.utils.encode_cell({ r: row - 1, c: 0 });
  ws[titleCell] = { t: 's', v: 'REPORTE FINANCIERO — RESUMEN EJECUTIVO' };
  applyStyle(ws, titleCell, {
    font: font({ sz: 14, bold: true, color: C.white }),
    fill: fill(C.headerDark),
    alignment: align('center', 'center'),
    border: border('medium'),
  });
  ws['!merges'] = ws['!merges'] || [];
  ws['!merges'].push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 5 } });
  row++;

  // Fecha generación
  const dateCell = XLSX.utils.encode_cell({ r: row - 1, c: 0 });
  ws[dateCell] = { t: 's', v: `Generado: ${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })}  ·  Periodo mantenimiento: ${finDesde} al ${finHasta}` };
  applyStyle(ws, dateCell, {
    font: font({ sz: 9, italic: true, color: C.muted }),
    fill: fill(C.resumenBg),
    alignment: align('center'),
    border: border('thin'),
  });
  ws['!merges'].push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 5 } });
  row += 2;

  // ── Bloque KPIs ──
// DESPUÉS — incluir finalizado y asegurar comparación de strings
const contratosCobrables = contratos.filter(c =>
  c.estatus === 'activo' ||
  c.estatus === 'vencido' ||
  c.estatus === 'finalizado'
);
const idsCob = new Set(contratosCobrables.map(c => String(c.id)));
const pagsCob = pagos.filter(p => idsCob.has(String(p.contrato_id)));
  const totalEsperado    = pagsCob.reduce((s, p) => s + Number(p.monto_esperado || 0), 0);
  const totalCobrado     = pagsCob.reduce((s, p) => s + Number(p.monto_pagado || 0), 0);
  const totalDiferencia  = totalCobrado - totalEsperado;
  const totalPendiente   = pagsCob.filter(p => p.estado === 'pendiente' || p.estado === 'parcial')
    .reduce((s, p) => s + (Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0)), 0);
  const totalMant        = detalleMantenimiento.reduce((a, c) => a + c.desglose.reduce((s, d) => s + d.monto, 0), 0);

  const kpis = [
    { label: 'Total Esperado',           valor: totalEsperado,   bgFill: 'FFE3F2FD', colorVal: C.dark },
    { label: 'Total Cobrado',            valor: totalCobrado,    bgFill: 'FFE8F5E9', colorVal: C.success },
    { label: 'Diferencia (Cobrado-Esp)', valor: totalDiferencia, bgFill: totalDiferencia < 0 ? 'FFFFEBEE' : 'FFE8F5E9', colorVal: totalDiferencia < 0 ? C.danger : C.success },
    { label: 'Pendiente por Cobrar',     valor: totalPendiente,  bgFill: 'FFFFF8E1', colorVal: C.warning },
    { label: 'Gastos Mantenimiento',     valor: totalMant,       bgFill: 'FFFCE4EC', colorVal: C.danger },
    { label: 'Neto (Cobrado - Mant.)',   valor: totalCobrado - totalMant, bgFill: 'FFF3E5F5', colorVal: (totalCobrado - totalMant) >= 0 ? C.success : C.danger },
  ];

  // Headers KPI
  ['Concepto', 'Monto', '', 'Concepto', 'Monto', ''].forEach((h, i) => {
    const c = XLSX.utils.encode_cell({ r: row - 1, c: i });
    ws[c] = { t: 's', v: h };
    applyStyle(ws, c, {
      font: font({ bold: true, color: C.white, sz: 9 }),
      fill: fill(C.headerMid),
      alignment: align('center'),
      border: border('medium'),
    });
  });
  row++;

  // Filas KPI en 2 columnas
  const kpiLeft  = kpis.slice(0, 3);
  const kpiRight = kpis.slice(3);
  kpiLeft.forEach((k, i) => {
    const kr = kpiRight[i];
    // Izquierda
    const labelL = XLSX.utils.encode_cell({ r: row - 1, c: 0 });
    const valL   = XLSX.utils.encode_cell({ r: row - 1, c: 1 });
    ws[labelL] = { t: 's', v: k.label };
    ws[valL]   = { t: 'n', v: k.valor, z: '"$"#,##0.00' };
    applyStyle(ws, labelL, { font: font({ sz: 10 }), fill: fill(k.bgFill), alignment: align('left'), border: border() });
    applyStyle(ws, valL,   { font: font({ sz: 11, bold: true, color: k.colorVal }), fill: fill(k.bgFill), alignment: align('right'), border: border(), numFmt: '"$"#,##0.00' });
    // Separador
    const sep = XLSX.utils.encode_cell({ r: row - 1, c: 2 });
    ws[sep] = { t: 's', v: '' };
    applyStyle(ws, sep, { fill: fill('FFFFFFFF'), border: { top: {}, bottom: {}, left: {}, right: {} } });
    // Derecha
    if (kr) {
      const labelR = XLSX.utils.encode_cell({ r: row - 1, c: 3 });
      const valR   = XLSX.utils.encode_cell({ r: row - 1, c: 4 });
      ws[labelR] = { t: 's', v: kr.label };
      ws[valR]   = { t: 'n', v: kr.valor, z: '"$"#,##0.00' };
      applyStyle(ws, labelR, { font: font({ sz: 10 }), fill: fill(kr.bgFill), alignment: align('left'), border: border() });
      applyStyle(ws, valR,   { font: font({ sz: 11, bold: true, color: kr.colorVal }), fill: fill(kr.bgFill), alignment: align('right'), border: border(), numFmt: '"$"#,##0.00' });
    }
    row++;
  });

  row += 2;

  // ── Pérdidas archivadas ─────────────────────────────────────────────────
  const perdas = [
    ['Pérdidas archivadas', fmtPeso(totalPerdidasArchivadas)],
    ['Pérdida por cancelación', fmtPeso(totalCanceladosArchivados)],
    ['Deuda muerta', fmtPeso(totalDeudaMuertaArchivados)],
  ];
  perdas.forEach(([label, value]) => {
    const labelCell = XLSX.utils.encode_cell({ r: row - 1, c: 0 });
    const valueCell = XLSX.utils.encode_cell({ r: row - 1, c: 1 });
    ws[labelCell] = { t: 's', v: label };
    ws[valueCell] = { t: 's', v: value };
    applyStyle(ws, labelCell, { font: font({ bold: true, color: C.dark }), fill: fill(C.rowAlterA), alignment: align('left'), border: border() });
    applyStyle(ws, valueCell, { font: font({ bold: true, color: C.dark }), fill: fill(C.rowAlterA), alignment: align('right'), border: border() });
    row++;
  });

  row += 1;

  // ── Tabla contratos activos por arrendatario ──
  const secTitleCell = XLSX.utils.encode_cell({ r: row - 1, c: 0 });
  ws[secTitleCell] = { t: 's', v: 'BALANCE POR ARRENDATARIO' };
  applyStyle(ws, secTitleCell, {
    font: font({ bold: true, color: C.white }),
    fill: fill(C.headerDark),
    alignment: align('center'),
    border: border('medium'),
  });
  ws['!merges'].push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 5 } });
  row++;

  const hdrs = ['Arrendatario', 'Esperado', 'Cobrado', 'Diferencia', 'Pendientes (pagos)', 'Estado general'];
  hdrs.forEach((h, i) => {
    const c = XLSX.utils.encode_cell({ r: row - 1, c: i });
    ws[c] = { t: 's', v: h };
    applyStyle(ws, c, {
      font: font({ bold: true, color: C.white, sz: 9 }),
      fill: fill(C.headerMid),
      alignment: align('center'),
      border: border('medium'),
    });
  });
  row++;

  const resumen = Object.values(
    pagsCob.reduce((acc, p) => {
      const nombre = p.contratos?.arrendatarios?.nombre ?? p.contrato_id;
      if (!acc[nombre]) acc[nombre] = { nombre, esp: 0, cob: 0, pend: 0 };
      acc[nombre].esp  += Number(p.monto_esperado || 0);
      acc[nombre].cob  += Number(p.monto_pagado || 0);
      if (p.estado === 'pendiente' || p.estado === 'parcial') acc[nombre].pend++;
      return acc;
    }, {})
  );

  resumen.forEach((r2, idx) => {
    const diff = r2.cob - r2.esp;
    const bgRow = idx % 2 === 0 ? C.rowAlterA : C.rowAlterB;
    const estado = diff >= 0 ? 'Al día' : r2.pend > 0 ? 'Con adeudo' : 'Balance negativo';
    const estadoColor = diff >= 0 ? C.success : C.danger;

    const rowData = [r2.nombre, r2.esp, r2.cob, diff, r2.pend, estado];
    rowData.forEach((val, ci) => {
      const cellAddr = XLSX.utils.encode_cell({ r: row - 1, c: ci });
      ws[cellAddr] = typeof val === 'number'
        ? { t: 'n', v: val }
        : { t: 's', v: String(val) };
      const isNum = ci >= 1 && ci <= 3;
      const isEstado = ci === 5;
      applyStyle(ws, cellAddr, {
        font: font({
          sz: 10,
          bold: isEstado,
          color: isEstado ? estadoColor : (ci === 3 ? (diff < 0 ? C.danger : C.success) : C.dark),
        }),
        fill: fill(bgRow),
        alignment: align(isNum ? 'right' : 'left'),
        border: border(),
        numFmt: isNum ? '"$"#,##0.00' : '',
      });
    });
    row++;
  });

  // Fila total
  const totals = ['TOTAL', totalEsperado, totalCobrado, totalDiferencia, '', ''];
  totals.forEach((val, ci) => {
    const cellAddr = XLSX.utils.encode_cell({ r: row - 1, c: ci });
    ws[cellAddr] = typeof val === 'number' ? { t: 'n', v: val } : { t: 's', v: String(val) };
    applyStyle(ws, cellAddr, {
      font: font({ bold: true, sz: 10, color: ci === 3 ? (totalDiferencia < 0 ? C.danger : C.success) : C.dark }),
      fill: fill(C.totalRow),
      alignment: align(ci >= 1 ? 'right' : 'left'),
      border: border('medium'),
      numFmt: ci >= 1 && ci <= 3 ? '"$"#,##0.00' : '',
    });
  });
  row++;

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: 5 } });
  wb.SheetNames.push(wsName);
  wb.Sheets[wsName] = ws;
}

// ─────────────────────────────────────────────────────────────────
// HOJA 2 — Detalle de pagos por contrato
// ─────────────────────────────────────────────────────────────────
function crearHojaPagos(wb, { contratos, pagos }) {
  const ws = {};
  const wsName = 'Pagos por Contrato';
  let row = 1;

  ws['!cols'] = [
    { wch: 8 },  // Local
    { wch: 24 }, // Arrendatario
    { wch: 12 }, // Estatus contrato
    { wch: 12 }, // Periodo
    { wch: 14 }, // Esperado
    { wch: 14 }, // Pagado
    { wch: 14 }, // Diferencia
    { wch: 14 }, // Estado pago
    { wch: 14 }, // Fecha pago
    { wch: 14 }, // Método
  ];

  // Título
  const titleAddr = XLSX.utils.encode_cell({ r: row - 1, c: 0 });
  ws[titleAddr] = { t: 's', v: 'DETALLE DE PAGOS POR CONTRATO' };
  applyStyle(ws, titleAddr, {
    font: font({ sz: 13, bold: true, color: C.white }),
    fill: fill(C.headerDark),
    alignment: align('center'),
    border: border('medium'),
  });
  ws['!merges'] = ws['!merges'] || [];
  ws['!merges'].push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 9 } });
  row += 2;

  // Agrupar contratos por estatus: activos primero, luego vencidos, cancelados, etc.
  const ordenEstatus = ['activo', 'vencido', 'en_negociacion', 'cancelado'];
  const contratosOrdenados = [...contratos].sort((a, b) => {
    const ia = ordenEstatus.indexOf(a.estatus);
    const ib = ordenEstatus.indexOf(b.estatus);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const estBgMap = {
    activo:         C.bgActivo,
    vencido:        C.bgVencido,
    cancelado:      C.bgCancelado,
    en_negociacion: 'FFEDE7F6',
  };

  contratosOrdenados.forEach((contrato) => {
 const pagosCont = pagos
  .filter(p => String(p.contrato_id) === String(contrato.id))  // ← String() en ambos
  .sort((a, b) => a.periodo.localeCompare(b.periodo));
    if (pagosCont.length === 0) return;

    const bgEstatus = estBgMap[contrato.estatus] || C.rowAlterA;
    const localNum = contrato.locales?.numero ?? contrato.local_id;
    const nombre   = contrato.arrendatarios?.nombre ?? '—';
    const estatusLabel = (contrato.estatus ?? '').replace(/_/g, ' ').toUpperCase();

    // ── Cabecera de contrato ──
    const cHdr = XLSX.utils.encode_cell({ r: row - 1, c: 0 });
    ws[cHdr] = { t: 's', v: `LOCAL ${localNum}  ·  ${nombre}  ·  Contrato ${estatusLabel}  ·  Renta: ${fmtPeso(contrato.renta)}/mes  ·  ${fmtFecha(contrato.fecha_inicio)} → ${fmtFecha(contrato.fecha_vencimiento)}` };
    applyStyle(ws, cHdr, {
      font: font({ bold: true, sz: 10, color: C.white }),
      fill: fill(contrato.estatus === 'activo' ? C.headerMid : 'FF546E7A'),
      alignment: align('left', 'center'),
      border: border('medium'),
    });
    ws['!merges'].push({ s: { r: row - 1, c: 0 }, e: { r: row - 1, c: 9 } });
    row++;

    // ── Sub-header columnas ──
    const colHdrs = ['Local', 'Arrendatario', 'Est. Contrato', 'Periodo', 'Esperado', 'Pagado', 'Diferencia', 'Estado Pago', 'Fecha Pago', 'Método'];
    colHdrs.forEach((h, i) => {
      const c = XLSX.utils.encode_cell({ r: row - 1, c: i });
      ws[c] = { t: 's', v: h };
      applyStyle(ws, c, {
        font: font({ bold: true, sz: 9, color: C.dark }),
        fill: fill(C.headerLight),
        alignment: align('center'),
        border: border('thin'),
      });
    });
    row++;

    // ── Filas de pago ──
    const estadoBg = { pagado: C.estadoPagado, parcial: C.estadoParcial, pendiente: C.estadoPendiente };
    const estadoColor = { pagado: C.success, parcial: C.warning, pendiente: C.danger };

    let espTotal = 0, pagTotal = 0;

    pagosCont.forEach((p, idx) => {
      const diff = Number(p.monto_pagado || 0) - Number(p.monto_esperado || 0);
      espTotal  += Number(p.monto_esperado || 0);
      pagTotal  += Number(p.monto_pagado || 0);
      const bg  = estadoBg[p.estado] || (idx % 2 === 0 ? C.rowAlterA : C.rowAlterB);
      const fColor = estadoColor[p.estado] || C.dark;

      const rowData = [
        localNum,
        nombre,
        contrato.estatus,
        p.periodo,
        Number(p.monto_esperado || 0),
        Number(p.monto_pagado   || 0),
        diff,
        (p.estado ?? 'pendiente').toUpperCase(),
        p.fecha_pago ? fmtFecha(p.fecha_pago) : '—',
        p.metodo_pago ?? '—',
      ];

      rowData.forEach((val, ci) => {
        const addr = XLSX.utils.encode_cell({ r: row - 1, c: ci });
        ws[addr] = typeof val === 'number' ? { t: 'n', v: val } : { t: 's', v: String(val) };
        const isNum = ci >= 4 && ci <= 6;
        applyStyle(ws, addr, {
          font: font({
            sz: 9,
            color: ci === 7 ? fColor : (ci === 6 ? (diff < 0 ? C.danger : C.success) : C.dark),
            bold: ci === 7,
          }),
          fill: fill(bg),
          alignment: align(isNum ? 'right' : ci === 3 ? 'center' : 'left'),
          border: border(),
          numFmt: isNum ? '"$"#,##0.00' : '',
        });
      });
      row++;
    });

    // ── Subtotal contrato ──
    const diffTotal = pagTotal - espTotal;
    const subTotals = ['', `Subtotal — ${nombre}`, '', '', espTotal, pagTotal, diffTotal, '', '', ''];
    subTotals.forEach((val, ci) => {
      const addr = XLSX.utils.encode_cell({ r: row - 1, c: ci });
      ws[addr] = typeof val === 'number' ? { t: 'n', v: val } : { t: 's', v: String(val) };
      applyStyle(ws, addr, {
        font: font({ bold: true, sz: 9, color: ci === 6 ? (diffTotal < 0 ? C.danger : C.success) : C.dark }),
        fill: fill(C.totalRow),
        alignment: align(ci >= 4 ? 'right' : 'left'),
        border: border('medium'),
        numFmt: (ci >= 4 && ci <= 6) ? '"$"#,##0.00' : '',
      });
    });
    row += 2; // Espacio entre contratos
  });

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row + 2, c: 9 } });
  wb.SheetNames.push(wsName);
  wb.Sheets[wsName] = ws;
}

// ─────────────────────────────────────────────────────────────────
// HOJA 3 — Contratos
// ─────────────────────────────────────────────────────────────────
function crearHojaContratos(wb, { contratos }) {
  const ws = {};
  ws['!cols'] = [
    { wch: 8 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
  ];
  ws['!merges'] = [];
  let row = 1;

  // Título
  const t = XLSX.utils.encode_cell({ r: 0, c: 0 });
  ws[t] = { t: 's', v: 'CONTRATOS — LISTADO COMPLETO' };
  applyStyle(ws, t, { font: font({ sz: 13, bold: true, color: C.white }), fill: fill(C.headerDark), alignment: align('center'), border: border('medium') });
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });
  row = 2;

  const hdrs = ['Local', 'Arrendatario', 'Fecha Inicio', 'Vencimiento', 'Renta', 'Mant. Mensual', 'Total', 'Estatus'];
  hdrs.forEach((h, i) => {
    const c = XLSX.utils.encode_cell({ r: row - 1, c: i });
    ws[c] = { t: 's', v: h };
    applyStyle(ws, c, { font: font({ bold: true, color: C.white, sz: 9 }), fill: fill(C.headerMid), alignment: align('center'), border: border('medium') });
  });
  row++;

  const estBgMap = { activo: C.bgActivo, vencido: C.bgVencido, cancelado: C.bgCancelado, en_negociacion: 'FFEDE7F6' };
  const estColorMap = { activo: C.success, vencido: C.warning, cancelado: C.danger, en_negociacion: 'FF6A1B9A' };

  contratos.forEach((c, idx) => {
    const bg = estBgMap[c.estatus] || (idx % 2 === 0 ? C.rowAlterA : C.rowAlterB);
    const renta = Number(c.renta || 0);
    const mant  = Number(c.locales?.mantenimiento_mensual || 0);
    const rowData = [
      c.locales?.numero ?? c.local_id,
      c.arrendatarios?.nombre ?? '—',
      fmtFecha(c.fecha_inicio),
      fmtFecha(c.fecha_vencimiento),
      renta,
      mant,
      renta + mant,
      (c.estatus ?? '').replace(/_/g, ' ').toUpperCase(),
    ];
    rowData.forEach((val, ci) => {
      const addr = XLSX.utils.encode_cell({ r: row - 1, c: ci });
      ws[addr] = typeof val === 'number' ? { t: 'n', v: val } : { t: 's', v: String(val) };
      const isNum = ci >= 4 && ci <= 6;
      const isEst = ci === 7;
      applyStyle(ws, addr, {
        font: font({ sz: 9, bold: isEst, color: isEst ? (estColorMap[c.estatus] || C.dark) : C.dark }),
        fill: fill(bg),
        alignment: align(isNum ? 'right' : 'left'),
        border: border(),
        numFmt: isNum ? '"$"#,##0.00' : '',
      });
    });
    row++;
  });

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: 7 } });
  wb.SheetNames.push('Contratos');
  wb.Sheets['Contratos'] = ws;
}

// ─────────────────────────────────────────────────────────────────
// HOJA 4 — Mantenimiento detallado
// ─────────────────────────────────────────────────────────────────
function crearHojaMantenimiento(wb, { detalleMantenimiento, finDesde, finHasta }) {
  const ws = {};
  ws['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 48 }];
  ws['!merges'] = [];
  let row = 1;

  const t = XLSX.utils.encode_cell({ r: 0, c: 0 });
  ws[t] = { t: 's', v: `GASTOS DE MANTENIMIENTO — Periodo: ${finDesde} al ${finHasta}` };
  applyStyle(ws, t, { font: font({ sz: 13, bold: true, color: C.white }), fill: fill(C.headerDark), alignment: align('center'), border: border('medium') });
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } });
  row = 2;

  ['Local', 'Mes', 'Tipo', 'Monto', 'Detalle'].forEach((h, i) => {
    const c = XLSX.utils.encode_cell({ r: row - 1, c: i });
    ws[c] = { t: 's', v: h };
    applyStyle(ws, c, { font: font({ bold: true, color: C.white, sz: 9 }), fill: fill(C.headerMid), alignment: align('center'), border: border('medium') });
  });
  row++;

  let totalMant = 0;
  detalleMantenimiento.forEach((c) => {
    c.desglose.forEach((d, idx) => {
      const bg  = d.tipo === 'REAL' ? C.estadoPagado : C.estadoPendiente;
      const detalle = d.tipo === 'REAL'
        ? d.gastos.map(g => `[${g.categoria}] ${g.concepto} — ${fmtPeso(g.monto)}`).join('  ·  ')
        : `Estimado: mantenimiento mensual del local`;
      totalMant += d.monto;

      const rowData = [
        `Local ${c.contrato.locales?.numero ?? c.contrato.local_id}`,
        d.mes,
        d.tipo,
        d.monto,
        detalle,
      ];
      rowData.forEach((val, ci) => {
        const addr = XLSX.utils.encode_cell({ r: row - 1, c: ci });
        ws[addr] = typeof val === 'number' ? { t: 'n', v: val } : { t: 's', v: String(val) };
        applyStyle(ws, addr, {
          font: font({ sz: 9, color: ci === 2 ? (d.tipo === 'REAL' ? C.success : C.warning) : C.dark, bold: ci === 2 }),
          fill: fill(idx % 2 === 0 ? bg : C.rowAlterB),
          alignment: align(ci === 3 ? 'right' : 'left', 'top', ci === 4),
          border: border(),
          numFmt: ci === 3 ? '"$"#,##0.00' : '',
        });
      });
      row++;
    });
  });

  // Total
  ['TOTAL', '', '', totalMant, ''].forEach((val, ci) => {
    const addr = XLSX.utils.encode_cell({ r: row - 1, c: ci });
    ws[addr] = typeof val === 'number' ? { t: 'n', v: val } : { t: 's', v: String(val) };
    applyStyle(ws, addr, {
      font: font({ bold: true, sz: 10, color: C.danger }),
      fill: fill(C.totalRow),
      alignment: align(ci === 3 ? 'right' : 'left'),
      border: border('medium'),
      numFmt: ci === 3 ? '"$"#,##0.00' : '',
    });
  });
  row++;

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: 4 } });
  wb.SheetNames.push('Mantenimiento');
  wb.Sheets['Mantenimiento'] = ws;
}

// ─────────────────────────────────────────────────────────────────
// Función principal exportar
// ─────────────────────────────────────────────────────────────────
export function exportarExcelCompleto({ pagos, contratos, contratosArchivados, gastos, detalleMantenimiento, finDesde, finHasta }) {
  const wb = { SheetNames: [], Sheets: {} };

  const contratosArchivadosIds = (contratosArchivados || []).map(c => String(c.id));
  const pagosArchivados = pagos.filter(p => contratosArchivadosIds.includes(String(p.contrato_id)));
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
  const perdidasArchivadasPorContrato = (contratosArchivados || [])
    .map(c => {
      const pagosDelContrato = pagosArchivados.filter(p => String(p.contrato_id) === String(c.id));
      if (pagosDelContrato.length === 0) return null;
      const cancelados = pagosDelContrato
        .filter(p => p.cancelado === true)
        .reduce((s, p) => s + (Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0)), 0);
      const deudaMuerta = pagosDelContrato
        .filter(p => !p.cancelado && (p.estado === 'pendiente' || p.estado === 'parcial'))
        .reduce((s, p) => s + (Number(p.monto_esperado || 0) - Number(p.monto_pagado || 0)), 0);
      return {
        Local: c.locales?.numero ?? c.local_id,
        Arrendatario: c.arrendatarios?.nombre ?? '—',
        Contrato: c.id,
        Cancelados: cancelados,
        DeudaMuerta: deudaMuerta,
        Total: cancelados + deudaMuerta,
      };
    })
    .filter(Boolean);

  crearHojaResumen(wb,        { contratos, pagos, gastos, detalleMantenimiento, finDesde, finHasta, totalPerdidasArchivadas, totalCanceladosArchivados, totalDeudaMuertaArchivados });
  crearHojaPagos(wb,          { contratos, pagos });
  crearHojaContratos(wb,      { contratos });
  crearHojaMantenimiento(wb,  { detalleMantenimiento, finDesde, finHasta });
  if (perdidasArchivadasPorContrato.length > 0) {
    const sheet = XLSX.utils.json_to_sheet(perdidasArchivadasPorContrato.map(r => ({
      Local: r.Local,
      Arrendatario: r.Arrendatario,
      Contrato: r.Contrato,
      'Pérdida cancelada': r.Cancelados,
      'Deuda muerta': r.DeudaMuerta,
      Total: r.Total,
    })));
    XLSX.utils.book_append_sheet(wb, sheet, 'Pérdidas');
  }

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `reporte-completo-${hoyISO()}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────
// Componente React (botón reutilizable)
// ─────────────────────────────────────────────────────────────────
export default function ExportarExcelReporte({
  pagos = [],
  contratos = [],
  contratosArchivados = [],
  gastos = [],
  detalleMantenimiento = [],
  finDesde = '',
  finHasta = '',
  className = '',
}) {
  const handleClick = () => {
    exportarExcelCompleto({ pagos, contratos, contratosArchivados, gastos, detalleMantenimiento, finDesde, finHasta });
  };

  return (
    <button
      className={className || 'btn-secondary'}
      onClick={handleClick}
      title="Exportar reporte completo a Excel con formato profesional"
    >
      ↓ Excel Completo
    </button>
  );
}