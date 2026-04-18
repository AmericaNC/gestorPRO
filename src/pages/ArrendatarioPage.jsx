import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import ArrendatarioDrawer from "../components/ArrendatarioDrawer";

const API_URL_GET = apiUrl('/api/arrendatarios');

export default function ArrendatariosPage() {
  const [arrendatarios, setArrendatarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedArrendatario, setSelectedArrendatario] = useState(null);

  const fetchArrendatarios = async () => {
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
      setArrendatarios(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArrendatarios();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1>Gestión de Arrendatarios</h1>
        <button
          className="btn-primary"
          onClick={() => { setSelectedArrendatario(null); setDrawerOpen(true); }}
        >
          + Nuevo Arrendatario
        </button>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : (
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee' }}>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Local</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {arrendatarios.map((a) => (
              <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{a.nombre}</td>
                <td>{a.email || '—'}</td>
                <td>{a.telefono || '—'}</td>
                <td>{a.local_id ?? '—'}</td>
                <td>{a.estado}</td>
                <td>
                  <button onClick={() => { setSelectedArrendatario(a); setDrawerOpen(true); }}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ArrendatarioDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        arrendatario={selectedArrendatario}
        onSaved={fetchArrendatarios}
      />
    </div>
  );
}