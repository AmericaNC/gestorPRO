import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  // ─────────────────────────────────────────
  // AUTH
  // ─────────────────────────────────────────

  const token =
    req.headers.authorization?.replace(
      "Bearer ",
      ""
    );

  if (!token) {

    return res.status(401).json({
      error: "No autorizado"
    });

  }

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(token);

  if (authError || !user) {

    return res.status(401).json({
      error: "Token inválido"
    });

  }

  // ─────────────────────────────────────────
  // GET
  // ─────────────────────────────────────────

  if (req.method === "GET") {

    const { data, error } = await supabase
      .from("gastos")
      .select("*")
      .order("fecha", {
        ascending: false
      });

    if (error) {

      return res.status(400).json({
        error: error.message
      });

    }

    return res.status(200).json({
      data
    });

  }

  // ─────────────────────────────────────────
  // POST
  // ─────────────────────────────────────────

  if (req.method === "POST") {

    const {
      local_id,
      categoria,
      concepto,
      monto,
      fecha,
      metodo_pago,
      notas
    } = req.body;

    if (
      !local_id ||
      !categoria ||
      !concepto ||
      !monto
    ) {

      return res.status(400).json({
        error: "Faltan campos requeridos"
      });

    }

    const { data, error } = await supabase
      .from("gastos")
      .insert({
        local_id,
        categoria,
        concepto,
        monto,
        fecha,
        metodo_pago,
        notas
      })
      .select()
      .single();

    if (error) {

      return res.status(400).json({
        error: error.message
      });

    }

    return res.status(201).json({
      data
    });

  }

  // ─────────────────────────────────────────
  // METHOD NOT ALLOWED
  // ─────────────────────────────────────────

  return res.status(405).json({
    error: "Método no permitido"
  });

}