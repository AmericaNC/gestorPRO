import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const ok = (res, data = null, message = 'OK', status = 200) =>
  res.status(status).json({
    success: true,
    message,
    data,
    error: null
  });

const fail = (res, error = 'Error interno', status = 500) =>
  res.status(status).json({
    success: false,
    message: null,
    data: null,
    error
  });

const numeroValido = (n) =>
  Number.isInteger(Number(n)) && Number(n) > 0;

const decimalValido = (n) =>
  !isNaN(Number(n)) && Number(n) >= 0;

const limpiarNumero = (n) => Number(n);

// ─────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────

export default async function handler(req, res) {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {

    // ─────────────────────────────────────────
    // AUTH
    // ─────────────────────────────────────────

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return fail(res, 'No auth header', 401);
    }

    const token = authHeader.replace('Bearer ', '');

    const {
      data: authData,
      error: authError
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !authData?.user) {
      return fail(res, 'Invalid auth token', 401);
    }

    const { method } = req;

    // ─────────────────────────────────────────
    // GET
    // ─────────────────────────────────────────

    if (method === 'GET') {

      const { data, error } = await supabaseAdmin
        .from('locales')
        .select('*')
        .eq('activo', true)
        .order('numero');

      if (error) throw error;

      return ok(res, data);
    }

    // ─────────────────────────────────────────
    // POST
    // ─────────────────────────────────────────

    if (method === 'POST') {

      const {
        action,
        id,
        numero,
        metros_cuadrados,
        renta,
        mantenimiento_mensual
      } = req.body;

      // ───────────────────────────────────────
      // SOFT DELETE
      // ───────────────────────────────────────

      if (action === 'delete') {

        if (!id) {
          return fail(res, 'ID requerido', 400);
        }

        // obtener local
        const {
          data: local
        } = await supabaseAdmin
          .from('locales')
          .select('numero, estatus')
          .eq('id', id)
          .single();

        if (!local) {
          return fail(res, 'Local no encontrado', 404);
        }

        // impedir borrar locales activos
        if (local.estatus === 'rentado') {
          return fail(
            res,
            'No se puede eliminar un local rentado',
            400
          );
        }

        // verificar contratos
        const {
          count
        } = await supabaseAdmin
          .from('contratos')
          .select('*', { count: 'exact', head: true })
          .eq('local_id', local.numero);

        if (count > 0) {
          return fail(
            res,
            'No se puede eliminar: el local tiene contratos asociados',
            400
          );
        }

        const {
          error: deleteError
        } = await supabaseAdmin
          .from('locales')
          .update({
            activo: false,
            deleted_at: new Date().toISOString()
          })
          .eq('id', id);

        if (deleteError) throw deleteError;

        return ok(res, null, 'Local eliminado');
      }

      // ───────────────────────────────────────
      // VALIDACIONES
      // ───────────────────────────────────────

      if (!numeroValido(numero)) {
        return fail(res, 'Número inválido', 400);
      }

      if (!decimalValido(metros_cuadrados)) {
        return fail(res, 'Metros cuadrados inválidos', 400);
      }

      if (!decimalValido(renta)) {
        return fail(res, 'Renta inválida', 400);
      }

      if (!decimalValido(mantenimiento_mensual)) {
        return fail(res, 'Mantenimiento inválido', 400);
      }

      // verificar duplicado
      const {
        data: existente
      } = await supabaseAdmin
        .from('locales')
        .select('id')
        .eq('numero', numero)
        .maybeSingle();

      if (existente) {
        return fail(
          res,
          'Ya existe un local con ese número',
          409
        );
      }

      // insertar
      const {
        data,
        error
      } = await supabaseAdmin
        .from('locales')
        .insert([{
          numero: limpiarNumero(numero),
          metros_cuadrados: Number(metros_cuadrados),
          estatus: 'desocupado',
          renta: Number(renta),
          mantenimiento_mensual: Number(mantenimiento_mensual)
        }])
        .select()
        .single();

      if (error) throw error;

      return ok(
        res,
        data,
        'Local creado correctamente',
        201
      );
    }

    // ─────────────────────────────────────────
    // PUT
    // ─────────────────────────────────────────

    if (method === 'PUT') {

      const {
        id,
        metros_cuadrados,
        renta,
        mantenimiento_mensual
      } = req.body;

      if (!id) {
        return fail(res, 'ID requerido', 400);
      }

      if (!decimalValido(metros_cuadrados)) {
        return fail(res, 'Metros cuadrados inválidos', 400);
      }

      if (!decimalValido(renta)) {
        return fail(res, 'Renta inválida', 400);
      }

      if (!decimalValido(mantenimiento_mensual)) {
        return fail(res, 'Mantenimiento inválido', 400);
      }

      // obtener local actual
      const {
        data: localActual,
        error: localError
      } = await supabaseAdmin
        .from('locales')
        .select('*')
        .eq('id', id)
        .single();

      if (localError) throw localError;

      if (!localActual) {
        return fail(res, 'Local no encontrado', 404);
      }

      const nuevaRenta = Number(renta);

      // update local
      const {
        data,
        error
      } = await supabaseAdmin
        .from('locales')
        .update({
          metros_cuadrados: Number(metros_cuadrados),
          renta: nuevaRenta,
          mantenimiento_mensual: Number(mantenimiento_mensual)
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // sincronizar contratos activos
      const {
        data: contratosActivos,
        error: contratosError
      } = await supabaseAdmin
        .from('contratos')
        .select('id')
        .eq('local_id', localActual.numero)
        .eq('estatus', 'activo');

      if (contratosError) {
        console.error(contratosError);
      }

      if (contratosActivos?.length) {

        const contratoIds = contratosActivos.map(c => c.id);

        // update contratos
        await supabaseAdmin
          .from('contratos')
          .update({
            renta: nuevaRenta
          })
          .in('id', contratoIds);

        // update pagos pendientes futuros
        const hoy = new Date().toISOString().slice(0, 7);

        await supabaseAdmin
          .from('pagos')
          .update({
            monto_esperado: nuevaRenta
          })
          .in('contrato_id', contratoIds)
          .eq('estado', 'pendiente')
          .gte('periodo', hoy);
      }

      return ok(
        res,
        data,
        'Local actualizado correctamente'
      );
    }

    // ─────────────────────────────────────────
    // DELETE DESHABILITADO
    // ─────────────────────────────────────────

    if (method === 'DELETE') {
      return fail(
        res,
        'DELETE deshabilitado. Usa POST con action=delete',
        405
      );
    }

    // ─────────────────────────────────────────

    res.setHeader('Allow', ['GET', 'POST', 'PUT']);

    return fail(
      res,
      `Method ${method} Not Allowed`,
      405
    );

  } catch (error) {

    console.error('SERVER ERROR /api/locales:', error);

    return fail(
      res,
      error.message || 'Error interno',
      500
    );
  }
}