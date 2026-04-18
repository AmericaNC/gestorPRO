import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import ContratoDrawer from "../components/ContratoDrawer";

const API_URL_GET = apiUrl('/api/contratos');

export default function ContratosPage() {
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState(null);
  const [enviando, setEnviando] = useState(null); // id del contrato que se está enviando

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
        throw new Error("El servidor no respondió con JSON. Revisa la URL en Vercel.");
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
        body: JSON.stringify({ id: contrato.id, estatus: "vencido" })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error al actualizar");

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

  // Solo mostramos contratos activos y en negociación en esta vista
  const contratosActivos = contratos.filter(c => c.estatus !== 'vencido' && c.estatus !== 'cancelado');

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1>Gestión de Contratos</h1>
        <button className="btn-primary" onClick={() => { setSelectedContrato(null); setDrawerOpen(true); }}>
          + Nuevo Contrato
        </button>
      </div>

      {loading ? <p>Cargando...</p> : error ? <p style={{ color: 'red' }}>{error}</p> : (
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee' }}>
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
              <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{c.locales?.numero ?? c.local_id}</td>
                <td>{c.arrendatarios?.nombre ?? c.inquilino_id}</td>
                <td>{c.fecha_inicio}</td>
                <td>{c.fecha_vencimiento}</td>
                <td>${c.renta}</td>
                <td>{c.estatus}</td>
                <td style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setSelectedContrato(c); setDrawerOpen(true); }}>
                    Editar
                  </button>
                  {c.estatus === 'activo' && (
                    <button
                      onClick={() => enviarAExpediente(c)}
                      disabled={enviando === c.id}
                      style={{ color: '#dc2626' }}
                    >
                      {enviando === c.id ? "Enviando..." : "→ Expediente"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ContratoDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        contrato={selectedContrato}
        onSaved={fetchContratos}
      />
    </div>
  );
}