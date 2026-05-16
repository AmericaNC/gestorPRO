// src/components/LogsPanel.jsx

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "../styles/LogsPanel.css";

export default function LogsPanel() {

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {

    setLoading(true);

    try {

      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(200);

      if (error) throw error;

      setLogs(data || []);

    } catch (err) {

      console.error(err);

    } finally {

      setLoading(false);

    }

  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatFecha = (fecha) => {

    return new Date(fecha).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short"
    });

  };

  return (

    <div className="logs-panel">

      <div className="logs-header">

        <div>
          <h2>Actividad del sistema</h2>
          <p>Últimos movimientos realizados por usuarios</p>
        </div>

        <button
          className="logs-refresh"
          onClick={fetchLogs}
        >
          Actualizar
        </button>

      </div>

      {loading ? (

        <div className="logs-empty">
          Cargando logs...
        </div>

      ) : logs.length === 0 ? (

        <div className="logs-empty">
          No hay registros.
        </div>

      ) : (

        <div className="logs-list">

          {logs.map(log => (

            <div
              key={log.id}
              className="logs-item"
            >

              <div className="logs-top">

                <span className={`logs-badge ${log.accion}`}>
                  {log.accion}
                </span>

                <span className="logs-date">
                  {formatFecha(log.fecha)}
                </span>

              </div>

              <div className="logs-description">
                {log.descripcion}
              </div>

              <div className="logs-meta">

                <span>
                   {log.usuario_email}
                </span>

                <span>
                   {log.entidad}
                </span>

              </div>

            </div>

          ))}

        </div>

      )}

    </div>

  );

}