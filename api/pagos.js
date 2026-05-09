import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const limpiarNumero = (valor) => {
  const numero = Number(valor);

  if (isNaN(numero)) return null;

  return numero;
};

const limpiarTexto = (valor) => {
  if (!valor) return null;

  const limpio = String(valor).trim();

  return limpio.length ? limpio : null;
};

const validarMetodoPago = (metodo) => {

  if (!metodo) return null;

  const permitidos = [
    'transferencia',
    'efectivo',
    'cheque',
    'otro'
  ];

  return permitidos.includes(metodo)
    ? metodo
    : null;
};

const calcularEstadoPago = (
  montoEsperado,
  montoPagado
) => {

  if (montoPagado <= 0) {
    return 'pendiente';
  }

  if (montoPagado < montoEsperado) {
    return 'parcial';
  }

  return 'pagado';
};

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

async function obtenerUsuario(req) {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new Error('No auth header');
  }

  const token = authHeader.replace('Bearer ', '');

  const {
    data: { user },
    error
  } = await supabaseAuth.auth.getUser(token);

  if (error || !user) {
    throw new Error('Token inválido');
  }

  return user;
}

// ─────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {

  // ─────────────────────────────────────────────────────────
  // CORS
  // ─────────────────────────────────────────────────────────

  res.setHeader('Access-Control-Allow-Origin', '*');

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,DELETE,OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {

    // ───────────────────────────────────────────────────────
    // AUTH
    // ───────────────────────────────────────────────────────

    await obtenerUsuario(req);

    const { method } = req;

    // ───────────────────────────────────────────────────────
    // GET
    // ───────────────────────────────────────────────────────

    if (method === 'GET') {

      const {
        contrato_id,
        estado,
        periodo
      } = req.query;

      let query = supabaseAdmin
        .from('pagos')
        .select(`
          *,
          contratos (
            inquilino_id,
            arrendatarios (
              nombre
            )
          ),
          locales (
            numero
          )
        `)
        .order('periodo', {
          ascending: true
        });

      // Filtros seguros
      if (contrato_id) {
        query = query.eq(
          'contrato_id',
          Number(contrato_id)
        );
      }

      if (estado) {
        query = query.eq(
          'estado',
          estado
        );
      }

      if (periodo) {
        query = query.eq(
          'periodo',
          periodo
        );
      }

      const {
        data,
        error
      } = await query;

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data
      });
    }

    // ───────────────────────────────────────────────────────
    // POST
    // ───────────────────────────────────────────────────────

    if (method === 'POST') {

      // Delete alternativo
      if (req.body.action === 'delete') {

        const id = Number(req.body.id);

        if (!id) {
          return res.status(400).json({
            error: 'ID inválido'
          });
        }

        const { error } = await supabaseAdmin
          .from('pagos')
          .delete()
          .eq('id', id);

        if (error) throw error;

        return res.status(200).json({
          success: true,
          message: 'Pago eliminado'
        });
      }

      // Crear manualmente pago
      // (caso administrativo)

      const {
        contrato_id,
        local_id,
        periodo,
        monto_esperado
      } = req.body;

      if (
        !contrato_id ||
        !local_id ||
        !periodo
      ) {
        return res.status(400).json({
          error: 'Faltan campos requeridos'
        });
      }

      const montoEsperado =
        limpiarNumero(monto_esperado);

      if (
        montoEsperado === null ||
        montoEsperado < 0
      ) {
        return res.status(400).json({
          error: 'Monto inválido'
        });
      }

      // Evitar duplicados
      const { data: existe } =
        await supabaseAdmin
          .from('pagos')
          .select('id')
          .eq('contrato_id', contrato_id)
          .eq('periodo', periodo)
          .maybeSingle();

      if (existe) {
        return res.status(400).json({
          error: 'Ya existe un pago para ese periodo'
        });
      }

      const {
        data,
        error
      } = await supabaseAdmin
        .from('pagos')
        .insert([{
          contrato_id: Number(contrato_id),
          local_id: Number(local_id),
          periodo,
          monto_esperado: montoEsperado,
          monto_pagado: 0,
          estado: 'pendiente'
        }])
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        data
      });
    }

    // ───────────────────────────────────────────────────────
    // PUT
    // ───────────────────────────────────────────────────────

    if (method === 'PUT') {

      const id = Number(req.body.id);

      if (!id) {
        return res.status(400).json({
          error: 'ID inválido'
        });
      }

      // Obtener pago actual
      const {
        data: pagoActual,
        error: pagoError
      } = await supabaseAdmin
        .from('pagos')
        .select('*')
        .eq('id', id)
        .single();

      if (pagoError) throw pagoError;

      // Sanitizar
      const montoPagado = limpiarNumero(
        req.body.monto_pagado
      );

      if (
        montoPagado === null ||
        montoPagado < 0
      ) {
        return res.status(400).json({
          error: 'Monto pagado inválido'
        });
      }

      const metodoPago =
        validarMetodoPago(
          req.body.metodo_pago
        );

      if (
        req.body.metodo_pago &&
        !metodoPago
      ) {
        return res.status(400).json({
          error: 'Método de pago inválido'
        });
      }

      // Calcular automáticamente
      const diferencia =
        redondear2(
          pagoActual.monto_esperado -
          montoPagado
        );

      const estado =
        calcularEstadoPago(
          pagoActual.monto_esperado,
          montoPagado
        );

      const updateData = {
        monto_pagado: montoPagado,
        fecha_pago: req.body.fecha_pago || null,
        metodo_pago: metodoPago,
        notas: limpiarTexto(req.body.notas),
        diferencia,
        estado
      };

      const {
        data,
        error
      } = await supabaseAdmin
        .from('pagos')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data
      });
    }

    // ───────────────────────────────────────────────────────
    // DELETE
    // ───────────────────────────────────────────────────────

    if (method === 'DELETE') {

      const id =
        Number(req.query.id) ||
        Number(req.body.id);

      if (!id) {
        return res.status(400).json({
          error: 'ID inválido'
        });
      }

      const { error } = await supabaseAdmin
        .from('pagos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        message: 'Pago eliminado'
      });
    }

    // ───────────────────────────────────────────────────────
    // METHOD NOT ALLOWED
    // ───────────────────────────────────────────────────────

    res.setHeader(
      'Allow',
      ['GET', 'POST', 'PUT', 'DELETE']
    );

    return res
      .status(405)
      .end(`Method ${method} Not Allowed`);

  } catch (error) {

    console.error(
      'SERVER ERROR /api/pagos:',
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────

function redondear2(numero) {
  return Math.round(numero * 100) / 100;
}