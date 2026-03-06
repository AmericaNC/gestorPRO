import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import Icon from "./Icon";

const ESTATUS = {
  desocupado:            { label: "Desocupado",            color: "#3b82f6" },
  rentado:               { label: "Rentado",               color: "#22c55e" },
  propuesta_activa:      { label: "En propuesta activa",   color: "#f59e0b" },
  proximo_a_desocuparse: { label: "Próximo a desocuparse", color: "#f97316" },
};

const fmt = (n) =>
  n ? "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2 }) : "$0";

const EMPTY = {
  numero: "",
  metros_cuadrados: "",
  estatus: "desocupado",
  renta: "",
  mantenimiento_mensual: "",
};

export default function LocalDrawer({ open, onClose, onSaved, local = null }) {
  const esEdicion = local !== null;

  const [form, setForm]         = useState(EMPTY);
  const [imagenes, setImagenes] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (open && esEdicion) {
      setForm({
        numero:               local.numero            ?? "",
        metros_cuadrados:     local.metros_cuadrados  ?? "",
        estatus:              local.estatus           ?? "desocupado",
        renta:                local.renta             ?? "",
        mantenimiento_mensual: local.mantenimiento_mensual ?? "",
      });
    } else if (open && !esEdicion) {
      setForm(EMPTY);
    }
    setImagenes([]);
    setError("");
  }, [open, local]);

  const total = (Number(form.renta) || 0) + (Number(form.mantenimiento_mensual) || 0);
  const m2    = Number(form.metros_cuadrados) || 0;
  const set   = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleImagenes = (e) =>
    setImagenes((prev) => [...prev, ...Array.from(e.target.files)]);

  const removeImagen = (i) =>
    setImagenes((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError("");
    if (!form.numero)           return setError("El número de local es requerido.");
    if (!form.metros_cuadrados) return setError("Los metros cuadrados son requeridos.");

    setLoading(true);

    const payload = {
      numero:                Number(form.numero),
      metros_cuadrados:      Number(form.metros_cuadrados),
      estatus:               form.estatus,
      renta:                 Number(form.renta) || 0,
      mantenimiento_mensual: Number(form.mantenimiento_mensual) || 0,
    };

    let savedId = local?.id;

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (esEdicion) {
        // UPDATE
        payload.id = local.id;
        const response = await fetch('/api/locales', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        savedId = result.data.id;
      } else {
        // INSERT
        const response = await fetch('/api/locales', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        savedId = result.data.id;
      }

      // Subir imágenes nuevas (si las hay)
      for (const file of imagenes) {
        const ext  = file.name.split(".").pop();
        const path = `local-${savedId}/${Date.now()}.${ext}`;
        await supabase.storage.from("locales-imagenes").upload(path, file);
      }

      setLoading(false);
      onSaved();
      onClose();
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm(EMPTY);
    setImagenes([]);
    setError("");
    onClose();
  };

  if (!open) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={handleClose} />
      <div className="drawer">

        {/* Header */}
        <div className="drawer-header">
          <div>
            <h2 className="drawer-title">
              {esEdicion ? `Editar Local #${local.numero}` : "Nuevo Local"}
            </h2>
            <p className="drawer-subtitle">
              {esEdicion ? "Modifica los datos del local" : "Registrar nueva unidad"}
            </p>
          </div>
          <button className="drawer-close" onClick={handleClose}>
            <Icon name="close" />
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body">

          <div className="field">
            <label className="field-label">Número de local <span className="req">*</span></label>
            <input
              className="field-input"
              placeholder="Ej: 101"
              type="number"
              value={form.numero}
              onChange={(e) => set("numero", e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label">Metros cuadrados <span className="req">*</span></label>
            <input
              className="field-input"
              placeholder="Ej: 45"
              type="number"
              value={form.metros_cuadrados}
              onChange={(e) => set("metros_cuadrados", e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label">Estatus</label>
            <div className="select-wrap">
              <span className="select-dot" style={{ background: ESTATUS[form.estatus].color }} />
              <select
                className="field-select"
                value={form.estatus}
                onChange={(e) => set("estatus", e.target.value)}
              >
                {Object.entries(ESTATUS).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              <span className="select-chevron"><Icon name="chevron" /></span>
            </div>
          </div>

          <div className="drawer-section">
            <p className="drawer-section-title"> Información Financiera</p>
            <div className="field-row">
              <div className="field">
                <label className="field-label">Renta mensual</label>
                <input
                  className="field-input"
                  placeholder="$0"
                  type="number"
                  value={form.renta}
                  onChange={(e) => set("renta", e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label">Mantenimiento mensual</label>
                <input
                  className="field-input"
                  placeholder="$0"
                  type="number"
                  value={form.mantenimiento_mensual}
                  onChange={(e) => set("mantenimiento_mensual", e.target.value)}
                />
              </div>
            </div>
            <div className="totals-row">
              <span className="totals-label">Total mensual</span>
              <span className="totals-value">{fmt(total)}</span>
            </div>
            {m2 > 0 && (
              <>
                <div className="totals-row">
                  <span className="totals-label">Renta por m²</span>
                  <span className="totals-value">{fmt((Number(form.renta) || 0) / m2)}</span>
                </div>
                <div className="totals-row">
                  <span className="totals-label">Promedio por m²</span>
                  <span className="totals-value">{fmt(total / m2)}</span>
                </div>
              </>
            )}
          </div>

          <div className="drawer-section">
            <p className="drawer-section-title"> Imágenes del local</p>
            <label className="upload-zone">
              <Icon name="plus" />
              <span>Haz clic para agregar imágenes</span>
              <input type="file" accept="image/*" multiple
                style={{ display: "none" }} onChange={handleImagenes} />
            </label>
            {imagenes.length > 0 && (
              <div className="image-previews">
                {imagenes.map((file, i) => (
                  <div key={i} className="image-preview">
                    <img src={URL.createObjectURL(file)} alt={file.name} />
                    <button className="image-remove" onClick={() => removeImagen(i)}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="drawer-error">{error}</p>}
        </div>

        <div className="drawer-footer">
          <button className="btn-ghost" onClick={handleClose} disabled={loading}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading
              ? "Guardando..."
              : esEdicion ? "Guardar cambios" : "Guardar local"}
          </button>
        </div>

      </div>
    </>
  );
}