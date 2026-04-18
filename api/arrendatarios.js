import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  const { method } = req

  try {
    // 1. VALIDAR TOKEN
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'No auth header' })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

    // ==========================================
    // GET - Listar Arrendatarios
    // ==========================================
    if (method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('arrendatarios')
        .select('*, locales(numero)')
        .order('nombre')

      if (error) throw error
      return res.status(200).json({ success: true, data })
    }

    // ==========================================
    // POST - Crear o Borrar (Tunneling)
    // ==========================================
    if (method === 'POST') {
      const { action, id, nombre, local_id, email, telefono, estado } = req.body

      // LÓGICA DE BORRADO CON VALIDACIÓN DE CONTRATOS
      if (action === 'delete' && id) {
        const { count, error: countError } = await supabaseAdmin
          .from('contratos')
          .select('*', { count: 'exact', head: true })
          .eq('inquilino_id', id)

        if (countError) throw countError
        if (count > 0) {
          return res.status(400).json({ 
            error: `No se puede eliminar: El arrendatario tiene ${count} contrato(s) asociado(s).` 
          })
        }

        const { error: delError } = await supabaseAdmin.from('arrendatarios').delete().eq('id', id)
        if (delError) throw delError
        return res.status(200).json({ success: true, message: 'Arrendatario eliminado' })
      }

      // LÓGICA DE CREACIÓN — local_id es opcional, se asigna después via contrato
      if (!nombre) return res.status(400).json({ error: 'Nombre es requerido' })

      const { data, error } = await supabaseAdmin
        .from('arrendatarios')
        .insert([{ 
          nombre, 
          local_id: local_id ? Number(local_id) : null, 
          email, 
          telefono, 
          estado: estado || 'pendiente' 
        }])
        .select().single()

      if (error) throw error
      return res.status(200).json({ success: true, data })
    }

    // ==========================================
    // PUT - Actualizar
    // ==========================================
    if (method === 'PUT') {
      const { id, nombre, local_id, email, telefono, estado } = req.body
      if (!id) return res.status(400).json({ error: 'ID requerido' })

      const { data, error } = await supabaseAdmin
        .from('arrendatarios')
        .update({ nombre, local_id: local_id ? Number(local_id) : null, email, telefono, estado })
        .eq('id', id)
        .select().single()

      if (error) throw error
      return res.status(200).json({ success: true, data })
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT'])
    return res.status(405).end(`Method ${method} Not Allowed`)

  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}