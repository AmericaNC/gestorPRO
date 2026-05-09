import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import ContratoDrawer from "../components/ContratoDrawer";

import "../styles/Page.css";
import "../styles/Modal.css";

const API_URL_GET = apiUrl('/api/contratos');

export default function ContratosPage() {
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState(null);
  const [enviando, setEnviando] = useState(null);

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
    if (!window.confirm(`¿Enviar el contrato del local ${contrato.local_id} a Expedientes?`)) return;

    setEnviando(contrato.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(API_URL_GET, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          id: contrato.id,
          estatus: "vencido"
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al actualizar");
      }

      fetchContratos();

    } catch (err) {
      alert("Error: " + err.message);

    } finally {
      setEnviando(null);
    }
  };

  useEffect(() => {
    fetchContratos();
  }, []);

  const contratosActivos = contratos.filter(
    c => c.estatus !== 'vencido' && c.estatus !== 'cancelado'
  );

  return (
    <div className="container">

      <div className="page-header">
        <div>
          <h1>Gestión de Contratos</h1>
          <p>Administra los contratos activos y negociaciones</p>
        </div>

        <button
          className="btn-primary"
          onClick={() => {
            setSelectedContrato(null);
            setDrawerOpen(true);
          }}
        >
          + Nuevo Contrato
        </button>
      </div>

      <div className="table-card">

        {loading ? (
          <div className="state-message">
            <p>Cargando contratos...</p>
          </div>

        ) : error ? (
          <div className="state-message error">
            <p>{error}</p>
          </div>

        ) : (
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
              {contratosActivos.map((c) => (
                <tr key={c.id}>
                  <td>{c.locales?.numero ?? c.local_id}</td>

                  <td>
                    {c.arrendatarios?.nombre ?? c.inquilino_id}
                  </td>

                  <td>{c.fecha_inicio}</td>

                  <td>{c.fecha_vencimiento}</td>

                  <td>
                    ${Number(c.renta).toLocaleString()}
                  </td>

                  <td>
                    <span className={`status ${c.estatus?.toLowerCase()}`}>
                      {c.estatus}
                    </span>
                  </td>

                  <td>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>

                      <button
                        className="btn-edit"
                        onClick={() => {
                          setSelectedContrato(c);
                          setDrawerOpen(true);
                        }}
                      >
                        Editar
                      </button>

                      {c.contrato_pdf_url && (
                        <button
                          className="btn-edit"
                          onClick={() => window.open(c.contrato_pdf_url, "_blank")}
                        >
                          Ver PDF
                        </button>
                      )}

                      {c.estatus === 'activo' && (
                        <button
                          className="btn-expediente"
                          onClick={() => enviarAExpediente(c)}
                          disabled={enviando === c.id}
                        >
                          {enviando === c.id
                            ? "Enviando..."
                            : "→ Expediente"}
                        </button>
                      )}

                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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