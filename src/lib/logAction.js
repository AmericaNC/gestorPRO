// src/lib/logAction.js
import { supabase } from "./supabaseClient";

export async function logAction({
  usuario_id,
  usuario_email,
  accion,
  entidad,
  entidad_id,
  descripcion
}) {
  try {
    // Validaciones básicas
    if (!accion || !entidad) {
      console.warn("logAction: 'accion' y 'entidad' son requeridos");
      return;
    }

    const { error } = await supabase
      .from("logs")
      .insert({
        usuario_id,
        usuario_email,
        accion,
        entidad,
        entidad_id,
        descripcion
      });

    if (error) {
      console.error("Error al registrar log:", error);
    }
  } catch (err) {
    console.error("Error inesperado en logAction:", err);
  }
}