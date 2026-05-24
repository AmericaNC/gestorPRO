import { useState, useEffect, Fragment } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import { logAction } from "../lib/logAction";
import "../styles/Page.css";

const API_URL_CONTRATOS = apiUrl('/api/contratos');
const API_URL_PAGOS     = apiUrl('/api/pagos');

const ESTADO_COLORS = {
  al_dia:   { color: '#16a34a', bg: '#f0fdf4' },
  parcial:  { color: '#d97706', bg: '#fffbeb' },
  pendiente:{ color: '#dc2626', bg: '#fef2f2' },
};

const fmt = (n) => `$${Number(n || 0).toLocaleString("es-MX")}`;

const fmtFecha = (f) => f
  ? new Date(f + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
  : "—";

// ── Estatus que aparecen en Expedientes (no archivados) ──────
const ESTATUS_EXPEDIENTE = ["vencido", "cancelado", "finalizado"];

export default function ExpedientesPage() {
  const [expedientes, setExpedientes]       = useState([]);
  const [archivados, setArchivados]         = useState([]);
  const [loading, setLoading]               = useState(true);
  const [loadingArchivados, setLoadingArchivados] = useState(false);
  const [error, setError]                   = useState(null);
  const [archivando, setArchivando]         = useState(null);
  const [restaurando, setRestaurando]       = useState(null);
  const [expandido, setExpandido]           = useState(null);
  const [pagosMap, setPagosMap]             = useState({});
  const [loadingPagos, setLoadingPagos]     = useState(null);
  const [verArchivados, setVerArchivados]   = useState(false); // ← toggle

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // ── Fetch expedientes activos (no archivados) ────────────────
  const fetchExpedientes = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const response = await fetch(API_URL_CONTRATOS, {
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
      });
      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json"))
        throw new Error("El servidor no respondió con JSON.");
      const result = await response.json();
      // El GET ya filtra archivado=false en el backend
      setExpedientes(
        (result.data || []).filter(c => ESTATUS_EXPEDIENTE.includes(c.estatus))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch archivados (endpoint separado con query param) ─────
  const fetchArchivados = async () => {
    setLoadingArchivados(true);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL_CONTRATOS}?archivados=true`, {
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
      });
      const result = await response.json();
      setArchivados(result.data || []);
    } catch (err) {
      console.error("Error cargando archivados:", err.message);
    } finally {
      setLoadingArchivados(false);
    }
  };

  // ── Toggle ver archivados ────────────────────────────────────
  const handleToggleArchivados = () => {
    const nuevo = !verArchivados;
    setVerArchivados(nuevo);
    if (nuevo && archivados.length === 0) fetchArchivados();
  };

  const fetchPagos = async (contrato_id) => {
    if (pagosMap[contrato_id]) return;
    setLoadingPagos(contrato_id);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL_PAGOS}?contrato_id=${contrato_id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const result = await response.json();
      setPagosMap(prev => ({ ...prev, [contrato_id]: result.data || [] }));
    } catch (err) {
      console.error("Error cargando pagos:", err.message);
    } finally {
      setLoadingPagos(null);
    }
  };

  const toggleExpansion = (id) => {
    if (expandido === id) { setExpandido(null); }
    else { setExpandido(id); fetchPagos(id); }
  };

  // ── Archivar (antes "eliminar") ──────────────────────────────
  const archivarContrato = async (c) => {
    const msg = `¿Archivar este contrato?\n\nLocal: ${c.locales?.numero ?? c.local_id}\nArrendatario: ${c.arrendatarios?.nombre ?? c.inquilino_id}\n\nEl contrato se moverá al archivo y sus datos se conservarán.`;
    if (!window.confirm(msg)) return;
    setArchivando(c.id);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL_CONTRATOS}?id=${c.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error al archivar");

      const { data: { user } } = await supabase.auth.getUser();
      await logAction({
        usuario_id: user?.id,
        usuario_email: user?.email,
        accion: "archivar",
        entidad: "contratos",
        entidad_id: c.id,
        descripcion: `Contrato Local #${c.locales?.numero ?? c.local_id} - ${c.arrendatarios?.nombre ?? c.inquilino_id} archivado`
      });

      fetchExpedientes();
      // Invalidar caché de archivados para que recargue si se abre
      setArchivados([]);
      setPagosMap(prev => { const n = { ...prev }; delete n[c.id]; return n; });
      if (expandido === c.id) setExpandido(null);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setArchivando(null);
    }
  };

  const restaurarContrato = async (c) => {
    if (!window.confirm(`¿Restaurar el contrato del local ${c.locales?.numero ?? c.local_id} a Activo?`)) return;
    setRestaurando(c.id);
    try {
      const token = await getToken();
      const response = await fetch(API_URL_CONTRATOS, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ id: c.id, estatus: "activo" })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error al restaurar");

      const { data: { user } } = await supabase.auth.getUser();
      await logAction({
        usuario_id: user?.id,
        usuario_email: user?.email,
        accion: "restaurar",
        entidad: "contratos",
        entidad_id: c.id,
        descripcion: `Contrato Local #${c.locales?.numero ?? c.local_id} - ${c.arrendatarios?.nombre ?? c.inquilino_id} restaurado a activo`
      });

      fetchExpedientes();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setRestaurando(null);
    }
  };

  useEffect(() => { fetchExpedientes(); }, []);

  // ── Sub-componente: tabla de pagos ───────────────────────────
  const TablaPagos = ({ contratoId }) => {
    const pagos = pagosMap[contratoId];
    if (loadingPagos === contratoId) return <p className="small-message">Cargando pagos…</p>;
    if (!pagos || pagos.length === 0) return <p className="small-message">Sin registros de pagos.</p>;
    return (
      <table className="payments-table">
        <thead>
          <tr>
            <th>Periodo</th><th>Esperado</th><th>Pagado</th>
            <th>Diferencia</th><th>Estado</th><th>Fecha pago</th><th>Método</th>
          </tr>
        </thead>
        <tbody>
          {pagos.map(p => {
            const estilo = ESTADO_COLORS[p.estado] || { color: "#888", bg: "#f3f4f6" };
            return (
              <tr key={p.id}>
                <td>{p.periodo}</td>
                <td>{fmt(p.monto_esperado)}</td>
                <td>{fmt(p.monto_pagado)}</td>
                <td className={p.diferencia < 0 ? "diff-negative" : "diff-positive"}>{fmt(p.diferencia)}</td>
                <td><span className="payment-status" style={{ color: estilo.color, background: estilo.bg }}>{p.estado}</span></td>
                <td>{p.fecha_pago || "—"}</td>
                <td>{p.metodo_pago || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const PagosMobile = ({ contratoId }) => {
    const pagos = pagosMap[contratoId];
    if (loadingPagos === contratoId) return <p className="small-message">Cargando pagos…</p>;
    if (!pagos || pagos.length === 0) return <p className="small-message">Sin registros de pagos.</p>;
    return pagos.map(p => {
      const estilo = ESTADO_COLORS[p.estado] || { color: "#888", bg: "#f3f4f6" };
      return (
        <div className="exp-pago-row" key={p.id}>
          <span className="exp-pago-periodo">{p.periodo}</span>
          <span className="exp-pago-monto">{fmt(p.monto_pagado)} / {fmt(p.monto_esperado)}</span>
          <span className="payment-status" style={{ color: estilo.color, background: estilo.bg }}>{p.estado}</span>
        </div>
      );
    });
  };

  // ── Renderiza filas — reutilizable para expedientes y archivados
  const renderFilaDesktop = (c, esArchivado = false) => (
    <Fragment key={c.id}>
      <tr
        className={`expandable-row ${expandido === c.id ? "expanded" : ""}`}
        onClick={() => toggleExpansion(c.id)}
      >
        <td className="expand-icon">{expandido === c.id ? "▼" : "▶"}</td>
        <td><strong>{c.locales?.numero ?? c.local_id}</strong></td>
        <td>{c.arrendatarios?.nombre ?? c.inquilino_id}</td>
        <td>{fmtFecha(c.fecha_inicio)}</td>
        <td>{fmtFecha(c.fecha_vencimiento)}</td>
        <td className="col-money">{fmt(c.renta)}</td>
        <td><span className={`status ${c.estatus?.toLowerCase()}`}>{c.estatus}</span></td>
        <td onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", gap: 8 }}>
            {c.contrato_pdf_url && (
              <button className="btn-edit" onClick={() => window.open(c.contrato_pdf_url, "_blank")}>
                Ver PDF
              </button>
            )}
            {/* Los archivados no se pueden restaurar ni archivar de nuevo */}
            {!esArchivado && (
  <>
    {c.estatus === 'cancelado' && (
      <button
        className="btn-expediente"
        onClick={() => restaurarContrato(c)}
        disabled={restaurando === c.id || archivando === c.id}
      >
        {restaurando === c.id ? "Restaurando…" : "← Restaurar"}
      </button>
    )}
    <button
      className="btn-danger"
      onClick={() => archivarContrato(c)}
      disabled={restaurando === c.id || archivando === c.id}
    >
      {archivando === c.id ? "Archivando…" : "Archivar"}
    </button>
  </>
)}
          </div>
        </td>
      </tr>
      {expandido === c.id && (
        <tr className="expanded-content-row">
          <td colSpan={8}>
            <div className="expanded-content">
              <h4>Historial de Pagos</h4>
              <TablaPagos contratoId={c.id} />
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );

  const renderCardMobile = (c, esArchivado = false) => (
    <div className="exp-card" key={c.id}>
      <div className="exp-card-header" onClick={() => toggleExpansion(c.id)}>
        <div className="exp-card-left">
          <div className="exp-card-title">
            <span className="exp-card-name">Local {c.locales?.numero ?? c.local_id}</span>
            <span className={`status ${c.estatus?.toLowerCase()}`}>{c.estatus}</span>
          </div>
          <span className="exp-card-sub">
            {c.arrendatarios?.nombre ?? c.inquilino_id} · {fmt(c.renta)}/mes
          </span>
        </div>
        <span className={`chevron ${expandido === c.id ? "open" : ""}`}>›</span>
      </div>
      {expandido === c.id && (
        <div className="exp-card-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Fecha inicio</span>
              <span className="detail-value">{fmtFecha(c.fecha_inicio)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Vencimiento</span>
              <span className="detail-value">{fmtFecha(c.fecha_vencimiento)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Renta mensual</span>
              <span className="detail-value highlight">{fmt(c.renta)}</span>
            </div>
            {c.contrato_pdf_url && (
              <div className="detail-item">
                <span className="detail-label">Contrato</span>
                <a href={c.contrato_pdf_url} target="_blank" rel="noopener noreferrer" className="ct-card-pdf-link">
                  Ver PDF
                </a>
              </div>
            )}
          </div>
          <p className="exp-pagos-title">Historial de pagos</p>
          <PagosMobile contratoId={c.id} />
          {!esArchivado && (
  <div className="exp-card-actions">
    {c.estatus === 'cancelado' && (
      <button
        className="btn-expediente"
        onClick={() => restaurarContrato(c)}
        disabled={restaurando === c.id || archivando === c.id}
      >
        {restaurando === c.id ? "Restaurando…" : "← Restaurar"}
      </button>
    )}
    <button
      className="btn-danger"
      onClick={() => archivarContrato(c)}
      disabled={restaurando === c.id || archivando === c.id}
    >
      {archivando === c.id ? "Archivando…" : "Archivar"}
    </button>
  </div>
)}
        </div>
      )}
    </div>
  );

  return (
    <div className="container">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Expedientes</h1>
          <p>Contratos vencidos, cancelados y finalizados</p>
        </div>
        {/* ── Toggle ver archivados ── */}
        <button
          className="btn-secondary"
          onClick={handleToggleArchivados}
        >
          {verArchivados ? "✕ Ocultar archivados" : " Ver archivados"}
        </button>
      </div>

      {/* ── Tabla principal ── */}
      <div className="table-card">
        {loading ? (
          <div className="state-message"><p>Cargando expedientes…</p></div>
        ) : error ? (
          <div className="state-message error"><p>{error}</p></div>
        ) : expedientes.length === 0 ? (
          <div className="state-message"><p>No hay expedientes por el momento.</p></div>
        ) : (
          <>
            <div className="exp-desktop table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}></th>
                    <th>Local</th><th>Arrendatario</th><th>Inicio</th>
                    <th>Vencimiento</th><th>Renta</th><th>Estatus</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>{expedientes.map(c => renderFilaDesktop(c, false))}</tbody>
              </table>
            </div>
            <div className="exp-mobile">
              {expedientes.map(c => renderCardMobile(c, false))}
            </div>
          </>
        )}
      </div>

      {/* ── Sección archivados (colapsable) ── */}
      {verArchivados && (
        <div className="table-card" style={{ marginTop: 24 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-secondary)" }}>
               Contratos archivados
            </h3>
          </div>

          {loadingArchivados ? (
            <div className="state-message"><p>Cargando archivados…</p></div>
          ) : archivados.length === 0 ? (
            <div className="state-message"><p>No hay contratos archivados.</p></div>
          ) : (
            <>
              <div className="exp-desktop table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }}></th>
                      <th>Local</th><th>Arrendatario</th><th>Inicio</th>
                      <th>Vencimiento</th><th>Renta</th><th>Estatus</th><th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>{archivados.map(c => renderFilaDesktop(c, true))}</tbody>
                </table>
              </div>
              <div className="exp-mobile">
                {archivados.map(c => renderCardMobile(c, true))}
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}