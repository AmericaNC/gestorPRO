import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { logAction } from "../lib/logAction";
import { apiUrl } from "../lib/apiClient";
import ContratoDrawer from "../components/ContratoDrawer";

import "../styles/Page.css";
import "../styles/Modal.css";
import "../styles/ContratosPage.css";

const API_URL_GET = apiUrl('/api/contratos');

const fmt = (n) =>
  `$${Number(n || 0).toLocaleString("es-MX")}`;

const fmtFecha = (f) => f
  ? new Date(f + "T00:00:00").toLocaleDateString("es-MX", {
      day: "2-digit", month: "short", year: "numeric"
    })
  : "—";

export default function ContratosPage() {
  const [contratos, setContratos]           = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [selectedContrato, setSelectedContrato] = useState(null);
  const [enviando, setEnviando]             = useState(null);

  const fetchContratos = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch(API_URL_GET, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Respuesta no válida del servidor:", text);
        throw new Error("El servidor no respondió con JSON.");
      }
      const result = await response.json();
      setContratos(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
const enviarAExpediente = async (contrato) => {

  if (!window.confirm(
    `¿Enviar el contrato del local ${contrato.local_id} a Expedientes?`
  )) return;

  setEnviando(contrato.id);

  try {

    const hoy = new Date();

    const vencimiento = new Date(
      contrato.fecha_vencimiento + "T23:59:59"
    );

    const nuevoEstatus =
      hoy > vencimiento
        ? "vencido"
        : "cancelado";

    const { data: { session } } =
      await supabase.auth.getSession();

    const token = session?.access_token;

    const response = await fetch(API_URL_GET, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        id: contrato.id,
        estatus: nuevoEstatus
      })
    });

    const result = await response.json();

    if (!response.ok)
      throw new Error(result.error || "Error al actualizar");

    fetchContratos();

  } catch (err) {

    alert("Error: " + err.message);

  } finally {

    setEnviando(null);

  }
};

  const abrirEditar = (c) => {
    setSelectedContrato(c);
    setDrawerOpen(true);
  };

  useEffect(() => { fetchContratos(); }, []);

  const contratosActivos = contratos.filter(
    c => c.estatus !== "vencido" && c.estatus !== "cancelado"
  );

  return (
    <div className="container">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión de Contratos</h1>
          <p>Administra los contratos activos y negociaciones</p>
        </div>
        <button className="btn-primary" onClick={() => { setSelectedContrato(null); setDrawerOpen(true); }}>
          + Nuevo Contrato
        </button>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="state-message"><p>Cargando contratos…</p></div>
        ) : error ? (
          <div className="state-message error"><p>{error}</p></div>
        ) : contratosActivos.length === 0 ? (
          <div className="state-message"><p>No hay contratos activos.</p></div>
        ) : (
          <>
            {/* ── Desktop ── */}
            <div className="ct-desktop table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
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
                  {contratosActivos.map(c => (
                    <tr key={c.id}>
                      <td><strong>{c.locales?.numero ?? c.local_id}</strong></td>
                      <td>{c.arrendatarios?.nombre ?? c.inquilino_id}</td>
                      <td>{fmtFecha(c.fecha_inicio)}</td>
                      <td>{fmtFecha(c.fecha_vencimiento)}</td>
                      <td className="col-money">{fmt(c.renta)}</td>
                      <td>
                        <span className={`status ${c.estatus?.toLowerCase()}`}>
                          {c.estatus}
                        </span>
                      </td>
                      <td>
                        <div className="ct-actions">
                          <button className="btn-edit" onClick={() => abrirEditar(c)}>
                            Editar
                          </button>
                          {c.contrato_pdf_url && (
                            <button className="btn-edit" onClick={() => window.open(c.contrato_pdf_url, "_blank")}>
                              Ver PDF
                            </button>
                          )}
                          {c.estatus === "activo" && (
                            <button
                              className="btn-expediente"
                              onClick={() => enviarAExpediente(c)}
                              disabled={enviando === c.id}
                            >
                              {enviando === c.id ? "Enviando…" : "→ Expediente"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Móvil ── */}
            <div className="ct-mobile">
              {contratosActivos.map(c => (
                <div className="ct-card" key={c.id}>

                  {/* Cabecera: local + estatus */}
                  <div className="ct-card-header">
                    <div className="ct-card-title">
                      <span className="ct-card-local">Local {c.locales?.numero ?? c.local_id}</span>
                      <span className={`status ${c.estatus?.toLowerCase()}`}>
                        {c.estatus?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span className="ct-card-renta">{fmt(c.renta)}<span className="ct-card-renta-sub">/mes</span></span>
                  </div>

                  {/* Arrendatario */}
                  <div className="ct-card-arrendatario">
                    {c.arrendatarios?.nombre ?? c.inquilino_id}
                  </div>

                  {/* Grid de datos */}
                  <div className="ct-card-body">
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
                        <span className="detail-label">Documento</span>
                        <a
                          href={c.contrato_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ct-card-pdf-link"
                        >
                          📄 Ver PDF
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="ct-card-actions">
                    <button className="btn-edit" style={{ flex: 1 }} onClick={() => abrirEditar(c)}>
                      Editar
                    </button>
                    {c.estatus === "activo" && (
                      <button
                        className="btn-expediente"
                        style={{ flex: 1 }}
                        onClick={() => enviarAExpediente(c)}
                        disabled={enviando === c.id}
                      >
                        {enviando === c.id ? "Enviando…" : "→ Expediente"}
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ContratoDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        contrato={selectedContrato}
        onSaved={fetchContratos}
      />
    </div>
  );
}