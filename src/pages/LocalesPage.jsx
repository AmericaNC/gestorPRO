import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { apiUrl } from "../lib/apiClient";
import LocalDrawer from "../components/LocalDrawer";

import "../styles/Page.css";

const API_URL_GET = apiUrl('/api/locales');

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

      const {
        data: { session }
      } = await supabase.auth.getSession();

      const token = session?.access_token;

      const response = await fetch(API_URL_GET, {
        method: "GET",

        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      const contentType = response.headers.get("content-type");

      if (
        !contentType ||
        !contentType.includes("application/json")
      ) {

        const text = await response.text();

        console.error(
          "Respuesta no válida del servidor:",
          text
        );

        throw new Error(
          "El servidor no respondió con JSON."
        );
      }

      const result = await response.json();

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

    <div className="container">

      {/* HEADER */}

      <div className="page-header">

        <div>
          <h1>Gestión de Locales</h1>

          <p>
            Administra los espacios y estatus de ocupación
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={() => {
            setSelectedLocal(null);
            setDrawerOpen(true);
          }}
        >
          + Nuevo Local
        </button>

      </div>

      {/* TABLA */}

      <div className="table-card">

        {loading ? (

          <div className="state-message">
            <p>Cargando locales...</p>
          </div>

        ) : error ? (

          <div className="state-message error">
            <p>{error}</p>
          </div>

        ) : locales.length === 0 ? (

          <div className="state-message">
            <p>No hay locales registrados.</p>
          </div>

        ) : (

          <table className="data-table">

            <thead>
              <tr>
                <th>Número</th>
                <th>M²</th>
                <th>Estatus</th>
                <th>Renta</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>

              {locales.map((l) => (

                <tr key={l.id}>

                  <td>
                    {l.numero}
                  </td>

                  <td>
                    {l.metros_cuadrados} m²
                  </td>

                  <td>

                    <span
                      className={`status ${
                        l.estatus?.toLowerCase()
                      }`}
                    >
                      {l.estatus}
                    </span>

                  </td>

                  <td>
                    ${Number(l.renta).toLocaleString()}
                  </td>

                  <td>

                    <button
                      className="btn-edit"
                      onClick={() => {
                        setSelectedLocal(l);
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

      <LocalDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        local={selectedLocal}
        onSaved={fetchLocales}
      />

    </div>
  );
}