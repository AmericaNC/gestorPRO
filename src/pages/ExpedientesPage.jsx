import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";

const API_URL_GET = apiUrl('/api/contratos');

export default function ExpedientesPage() {
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restaurando, setRestaurando] = useState(null); // id del contrato que se está restaurando

  const fetchExpedientes = async () => {
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
      // Solo mostramos los vencidos y cancelados
      const soloVencidos = (result.data || []).filter(
        c => c.estatus === 'vencido' || c.estatus === 'cancelado'
      );
      setExpedientes(soloVencidos);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const restaurarContrato = async (contrato) => {
    if (!window.confirm(`¿Restaurar el contrato del local ${contrato.locales?.numero ?? contrato.local_id} a Activo?`)) return;

    setRestaurando(contrato.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(API_URL_GET, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ id: contrato.id, estatus: "activo" })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Error al restaurar");

      fetchExpedientes();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setRestaurando(null);
    }
  };

  useEffect(() => {
    fetchExpedientes();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1>Expedientes</h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>
            Contratos vencidos y cancelados
          </p>
        </div>
      </div>

      {loading ? <p>Cargando...</p> : error ? <p style={{ color: 'red' }}>{error}</p> : (
        expedientes.length === 0 ? (
          <p style={{ color: '#888', marginTop: '40px', textAlign: 'center' }}>
            No hay expedientes por el momento.
          </p>
        ) : (
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
              {expedientes.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #eee', opacity: 0.85 }}>
                  <td>{c.locales?.numero ?? c.local_id}</td>
                  <td>{c.arrendatarios?.nombre ?? c.inquilino_id}</td>
                  <td>{c.fecha_inicio}</td>
                  <td>{c.fecha_vencimiento}</td>
                  <td>${c.renta}</td>
                  <td style={{ color: c.estatus === 'vencido' ? '#dc2626' : '#888' }}>
                    {c.estatus}
                  </td>
                  <td>
                    <button
                      onClick={() => restaurarContrato(c)}
                      disabled={restaurando === c.id}
                    >
                      {restaurando === c.id ? "Restaurando..." : "← Restaurar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}