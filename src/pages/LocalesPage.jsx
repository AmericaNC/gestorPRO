import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import LocalDrawer from "../components/LocalDrawer";

// URL de CONSULTA según tus documentos
const API_URL_GET = "https://gestor-2h2k71rv7-fernandanevarez7171-gmailcoms-projects.vercel.app/api/locales";

export default function LocalesPage() {
  const [locales, setLocales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLocal, setSelectedLocal] = useState(null);

  const fetchLocales = async () => {
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

      // Validar si la respuesta es JSON antes de procesar
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text(); // Ver qué envió realmente el servidor
        console.error("Respuesta no válida del servidor:", text);
        throw new Error("El servidor no respondió con JSON. Revisa la URL en Vercel.");
      }

      const result = await response.json();
      // En tu API, los datos vienen dentro de la propiedad 'data'
      setLocales(result.data || []); 
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocales();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1>Gestión de Locales</h1>
        <button className="btn-primary" onClick={() => { setSelectedLocal(null); setDrawerOpen(true); }}>
          + Nuevo Local
        </button>
      </div>

      {loading ? <p>Cargando...</p> : error ? <p style={{color: 'red'}}>{error}</p> : (
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee' }}>
              <th>Número</th>
              <th>M²</th>
              <th>Estatus</th>
              <th>Renta</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {locales.map((l) => (
              <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{l.numero}</td>
                <td>{l.metros_cuadrados}</td>
                <td>{l.estatus}</td>
                <td>${l.renta}</td>
                <td>
                  <button onClick={() => { setSelectedLocal(l); setDrawerOpen(true); }}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <LocalDrawer 
        open={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        local={selectedLocal}
        onSaved={fetchLocales} 
      />
    </div>
  );
}