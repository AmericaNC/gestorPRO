import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const ok = (res, data = null, message = 'OK', status = 200) =>
  res.status(status).json({
    success: true,
    message,
    data,
    error: null
  })

const fail = (res, error = 'Error interno', status = 500) =>
  res.status(status).json({
    success: false,
    message: null,
    data: null,
    error
  })

const limpiarTexto = (valor) => {
  if (typeof valor !== 'string') return null

  const limpio = valor.trim().replace(/\s+/g, ' ')
  return limpio.length ? limpio : null
}

const limpiarEmail = (email) => {
  const limpio = limpiarTexto(email)
  return limpio ? limpio.toLowerCase() : null
}

const limpiarTelefono = (telefono) => {
  const limpio = limpiarTexto(telefono)
  return limpio || null
}

const emailValido = (email) => {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const telefonoValido = (telefono) => {
  if (!telefono) return true
  return /^[0-9+\-\s()]+$/.test(telefono)
}

// ─────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {

  // ───────────────────────────────────────────────────────────
  // CORS
  // ───────────────────────────────────────────────────────────

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // ───────────────────────────────────────────────────────────
  // AUTH
  // ───────────────────────────────────────────────────────────

  try {

    const authHeader = req.headers.authorization

    if (!authHeader) {
      return fail(res, 'No auth header', 401)
    }

    const token = authHeader.replace('Bearer ', '')

    const {
      data: { user },
      error: authError
    } = await supabaseAuth.auth.getUser(token)

    if (authError || !user) {
      return fail(res, 'Token inválido', 401)
    }

    const { method } = req

    // ─────────────────────────────────────────────────────────
    // GET
    // ─────────────────────────────────────────────────────────

    if (method === 'GET') {

      const search = limpiarTexto(req.query.search)

      let query = supabaseAdmin
        .from('arrendatarios')
        .select(`
          *,
          locales(numero)
        `)
        .order('nombre', { ascending: true })

      // búsqueda opcional
      if (search) {
        query = query.ilike('nombre', `%${search}%`)
      }

      const { data, error } = await query

      if (error) throw error

      return ok(res, data)
    }

    // ─────────────────────────────────────────────────────────
    // POST
    // ─────────────────────────────────────────────────────────

    if (method === 'POST') {

      const { action, id } = req.body

      // ───────────────────────────────────────────────────────
      // SOFT DELETE
      // ───────────────────────────────────────────────────────

      if (action === 'delete') {

        if (!id) {
          return fail(res, 'ID requerido', 400)
        }

        // validar contratos asociados
        const {
          count,
          error: countError
        } = await supabaseAdmin
          .from('contratos')
          .select('*', { count: 'exact', head: true })
          .eq('inquilino_id', id)

        if (countError) throw countError

        if (count > 0) {
          return fail(
            res,
            `No se puede eliminar: el arrendatario tiene ${count} contrato(s) asociado(s).`,
            400
          )
        }

        // soft delete
        const {
          error: deleteError
        } = await supabaseAdmin
          .from('arrendatarios')
          .update({
            activo: false,
            deleted_at: new Date().toISOString()
          })
          .eq('id', id)

        if (deleteError) throw deleteError

        return ok(res, null, 'Arrendatario eliminado')
      }

      // ───────────────────────────────────────────────────────
      // CREAR
      // ───────────────────────────────────────────────────────

      let {
        nombre,
        email,
        telefono
      } = req.body

      nombre = limpiarTexto(nombre)
      email = limpiarEmail(email)
      telefono = limpiarTelefono(telefono)

      // validaciones
      if (!nombre) {
        return fail(res, 'Nombre requerido', 400)
      }

      if (!emailValido(email)) {
        return fail(res, 'Correo inválido', 400)
      }

      if (!telefonoValido(telefono)) {
        return fail(res, 'Teléfono inválido', 400)
      }

      // verificar duplicado aproximado
      const {
        data: existente
      } = await supabaseAdmin
        .from('arrendatarios')
        .select('id')
        .ilike('nombre', nombre)
        .maybeSingle()

      if (existente) {
        return fail(
          res,
          'Ya existe un arrendatario con ese nombre',
          409
        )
      }

      // insertar
      const {
        data,
        error
      } = await supabaseAdmin
        .from('arrendatarios')
        .insert([{
          nombre,
          email,
          telefono,
          estado: 'pendiente'
        }])
        .select()
        .single()

      if (error) throw error

      return ok(
        res,
        data,
        'Arrendatario creado correctamente',
        201
      )
    }

    // ─────────────────────────────────────────────────────────
    // PUT
    // ─────────────────────────────────────────────────────────

    if (method === 'PUT') {

      let {
        id,
        nombre,
        email,
        telefono
      } = req.body

      if (!id) {
        return fail(res, 'ID requerido', 400)
      }

      nombre = limpiarTexto(nombre)
      email = limpiarEmail(email)
      telefono = limpiarTelefono(telefono)

      if (!nombre) {
        return fail(res, 'Nombre requerido', 400)
      }

      if (!emailValido(email)) {
        return fail(res, 'Correo inválido', 400)
      }

      if (!telefonoValido(telefono)) {
        return fail(res, 'Teléfono inválido', 400)
      }

      // verificar existencia
      const {
        data: arrendatarioActual,
        error: existingError
      } = await supabaseAdmin
        .from('arrendatarios')
        .select('id')
        .eq('id', id)
        .maybeSingle()

      if (existingError) throw existingError

      if (!arrendatarioActual) {
        return fail(res, 'Arrendatario no encontrado', 404)
      }

      // verificar duplicados
      const {
        data: duplicado
      } = await supabaseAdmin
        .from('arrendatarios')
        .select('id')
        .ilike('nombre', nombre)
        .neq('id', id)
        .maybeSingle()

      if (duplicado) {
        return fail(
          res,
          'Ya existe otro arrendatario con ese nombre',
          409
        )
      }

      // update
      const {
        data,
        error
      } = await supabaseAdmin
        .from('arrendatarios')
        .update({
          nombre,
          email,
          telefono
          // estado NO se modifica aquí
          // local_id NO se modifica aquí
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return ok(
        res,
        data,
        'Arrendatario actualizado correctamente'
      )
    }

    // ─────────────────────────────────────────────────────────
    // DELETE
    // ─────────────────────────────────────────────────────────

    if (method === 'DELETE') {

      return fail(
        res,
        'DELETE deshabilitado. Usa POST con action=delete',
        405
      )
    }

    // ─────────────────────────────────────────────────────────
    // METHOD NOT ALLOWED
    // ─────────────────────────────────────────────────────────

    res.setHeader('Allow', ['GET', 'POST', 'PUT'])

    return fail(
      res,
      `Method ${method} Not Allowed`,
      405
    )

  } catch (error) {

    console.error('SERVER ERROR /api/arrendatarios:', error)

    return fail(
      res,
      error.message || 'Error interno del servidor',
      500
    )
  }
}