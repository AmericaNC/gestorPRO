import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const supabaseAuth  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

// Limpia local_id: solo acepta enteros positivos válidos, cualquier otra cosa → null
const limpiarLocalId = (local_id) =>
  local_id && Number(local_id) > 0 ? Number(local_id) : null;

export default async function handler(req, res) {
  // ─── CORS ────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // ─── AUTH ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'No auth header' })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

  const { method } = req

  try {
    // ─── GET ─────────────────────────────────────────────────────────────
    if (method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('arrendatarios')
        .select('*, locales(numero)')
        .order('nombre')

      if (error) throw error
      return res.status(200).json({ success: true, data })
    }

    // ─── POST ─────────────────────────────────────────────────────────────
    if (method === 'POST') {
      const { action, id, nombre, local_id, email, telefono, estado } = req.body

      // Borrado alternativo vía POST
      if (action === 'delete' && id) {
        // Verificar que no tenga contratos activos antes de eliminar
        const { count, error: countError } = await supabaseAdmin
          .from('contratos')
          .select('*', { count: 'exact', head: true })
          .eq('inquilino_id', id)

        if (countError) throw countError
        if (count > 0) {
          return res.status(400).json({
            error: `No se puede eliminar: el arrendatario tiene ${count} contrato(s) asociado(s).`
          })
        }

        const { error: delError } = await supabaseAdmin
          .from('arrendatarios')
          .delete()
          .eq('id', id)

        if (delError) throw delError
        return res.status(200).json({ success: true, message: 'Arrendatario eliminado' })
      }

      // Creación normal
      if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' })

      const { data, error } = await supabaseAdmin
        .from('arrendatarios')
        .insert([{
          nombre,
          local_id:  limpiarLocalId(local_id),  // ← FK-safe
          email:     email    || null,
          telefono:  telefono || null,
          estado:    estado   || 'pendiente'
        }])
        .select()
        .single()

      if (error) throw error
      return res.status(200).json({ success: true, data })
    }

    // ─── PUT ──────────────────────────────────────────────────────────────
    if (method === 'PUT') {
      const { id, nombre, local_id, email, telefono, estado } = req.body

      if (!id)     return res.status(400).json({ error: 'ID es requerido' })
      if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' })

      const { data, error } = await supabaseAdmin
        .from('arrendatarios')
        .update({
          nombre,
          local_id:  limpiarLocalId(local_id),  // ← FK-safe
          email:     email    || null,
          telefono:  telefono || null,
          estado:    estado   || 'pendiente'
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return res.status(200).json({ success: true, data })
    }

    // ─── DELETE ───────────────────────────────────────────────────────────
    if (method === 'DELETE') {
      const id = req.query.id || req.body.id
      if (!id) return res.status(400).json({ error: 'ID es requerido' })

      // Verificar contratos antes de eliminar
      const { count, error: countError } = await supabaseAdmin
        .from('contratos')
        .select('*', { count: 'exact', head: true })
        .eq('inquilino_id', id)

      if (countError) throw countError
      if (count > 0) {
        return res.status(400).json({
          error: `No se puede eliminar: el arrendatario tiene ${count} contrato(s) asociado(s).`
        })
      }

      const { error } = await supabaseAdmin
        .from('arrendatarios')
        .delete()
        .eq('id', id)

      if (error) throw error
      return res.status(200).json({ success: true, message: 'Arrendatario eliminado' })
    }

    // ─── MÉTODO NO PERMITIDO ──────────────────────────────────────────────
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
    return res.status(405).end(`Method ${method} Not Allowed`)

  } catch (error) {
    console.error('SERVER ERROR /api/arrendatarios:', error)
    return res.status(500).json({ error: error.message })
  }
}