import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import ArrendatarioDrawer from "../components/ArrendatarioDrawer";

import "../styles/Page.css";

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
        throw new Error("El servidor no respondió con JSON.");
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
    <div className="container">

      <div className="page-header">
        <div>
          <h1>Gestión de Arrendatarios</h1>
          <p>Administra los arrendatarios registrados</p>
        </div>

        <button
          className="btn-primary"
          onClick={() => {
            setSelectedArrendatario(null);
            setDrawerOpen(true);
          }}
        >
          + Nuevo Arrendatario
        </button>
      </div>

      <div className="table-card">

        {loading ? (
          <div className="state-message">
            <p>Cargando arrendatarios...</p>
          </div>

        ) : error ? (
          <div className="state-message error">
            <p>{error}</p>
          </div>

        ) : (
          <table className="data-table">
            <thead>
              <tr>
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
                <tr key={a.id}>
                  <td>{a.nombre}</td>
                  <td>{a.email || '—'}</td>
                  <td>{a.telefono || '—'}</td>
                  <td>{a.locales?.numero ?? '—'}</td>

                  <td>
                    <span className={`status ${a.estado?.toLowerCase()}`}>
                      {a.estado}
                    </span>
                  </td>

                  <td>
                    <button
                      className="btn-edit"
                      onClick={() => {
                        setSelectedArrendatario(a);
                        setDrawerOpen(true);
                      }}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      </div>

      <ArrendatarioDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        arrendatario={selectedArrendatario}
        onSaved={fetchArrendatarios}
      />
    </div>
  );
}