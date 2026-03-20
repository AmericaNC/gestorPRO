import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.SUPABASE_ANON_KEY

console.log("SUPABASE_URL:", SUPABASE_URL)
console.log("SERVICE_KEY:", !!SERVICE_KEY)
console.log("ANON_KEY:", !!ANON_KEY)
// Cliente ADMIN (para base de datos)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Cliente AUTH (para validar tokens)
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {

  // CORS para llamadas desde http://localhost:5173 u otros orígenes
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  console.log("METHOD:", req.method)

  const { method } = req

  try {

    // =========================
    // VALIDAR TOKEN
    // =========================

    const authHeader = req.headers.authorization

    if (!authHeader) {
      return res.status(401).json({ error: 'No auth header' })
    }

    const token = authHeader.replace('Bearer ', '')

    const { data, error: userError } = await supabaseAuth.auth.getUser(token)

    if (userError || !data?.user) {
      console.error("Auth error:", userError)
      return res.status(401).json({ error: 'Invalid auth token' })
    }

    const user = data.user
    console.log("User authenticated:", user.id)

    // =========================
    // GET
    // =========================

    if (method === 'GET') {

      const { data, error } = await supabaseAdmin
        .from('locales')
        .select('*')
        .order('numero')

      if (error) throw error

      return res.status(200).json({
        success: true,
        data
      })

    }

 // =========================
    // POST (Soporta CREATE y DELETE vía action)
    // =========================
    if (method === 'POST') {
      const {
        id,
        action,
        numero,
        metros_cuadrados,
        estatus,
        renta,
        mantenimiento_mensual
      } = req.body

      // Lógica de Borrado Alternativa (Para cuando DELETE falla)
      if (action === 'delete' && id) {
        console.log("Eliminando local vía POST action:", id)
        
        const { error: deleteError } = await supabaseAdmin
          .from('locales')
          .delete()
          .eq('id', id)

        if (deleteError) throw deleteError

        return res.status(200).json({
          success: true,
          message: 'Local eliminado correctamente vía POST'
        })
      }

      // Lógica Normal de Creación
      if (!numero || !metros_cuadrados) {
        return res.status(400).json({
          error: 'Número y metros cuadrados son requeridos'
        })
      }

      const { data, error } = await supabaseAdmin
        .from('locales')
        .insert([{
          numero: Number(numero),
          metros_cuadrados: Number(metros_cuadrados),
          estatus,
          renta: Number(renta) || 0,
          mantenimiento_mensual: Number(mantenimiento_mensual) || 0
        }])
        .select()
        .single()

      if (error) throw error

      return res.status(200).json({
        success: true,
        data
      })
    }
    // =========================
    // PUT
    // =========================

    if (method === 'PUT') {

      const {
        id,
        numero,
        metros_cuadrados,
        estatus,
        renta,
        mantenimiento_mensual
      } = req.body

      if (!id || !numero || !metros_cuadrados) {
        return res.status(400).json({
          error: 'ID, número y metros cuadrados son requeridos'
        })
      }

      const { data, error } = await supabaseAdmin
        .from('locales')
        .update({
          numero: Number(numero),
          metros_cuadrados: Number(metros_cuadrados),
          estatus,
          renta: Number(renta) || 0,
          mantenimiento_mensual: Number(mantenimiento_mensual) || 0
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return res.status(200).json({
        success: true,
        data
      })

    }

    // =========================
    // DELETE
    // =========================

    if (method === 'DELETE') {

      const id = req.query.id || req.body.id

      if (!id) {
        return res.status(400).json({
          error: 'ID es requerido'
        })
      }

      const { error } = await supabaseAdmin
        .from('locales')
        .delete()
        .eq('id', id)

      if (error) throw error

      return res.status(200).json({
        success: true,
        message: 'Local eliminado'
      })

    }

    // =========================
    // MÉTODO NO PERMITIDO
    // =========================

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])

    return res.status(405).end(`Method ${method} Not Allowed`)

  } catch (error) {

    console.error("SERVER ERROR:", error)

    return res.status(500).json({
      error: error.message
    })

  }
}


