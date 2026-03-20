import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  const { method } = req

  // CORS (para desarrollo local y petición desde localhost)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (method === 'OPTIONS') {
    return res.status(200).end() // Preflight
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader) return res.status(401).json({ error: 'No auth header' })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) return res.status(401).json({ error: 'Token inválido' })

    const superAdminEmails = ['usuario.prueba@gmail.com']
    const userEmail = user.email?.toLowerCase()
    const role = user.user_metadata?.role || (superAdminEmails.includes(userEmail) ? 'admin' : undefined)
    if (role !== 'admin') return res.status(403).json({ error: 'Se requiere rol admin' })

    if (method === 'POST') {
      const { email, password, role: newRole } = req.body
      if (!email || !password || !newRole) return res.status(400).json({ error: 'email, password y role son requeridos' })

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: newRole }
      })

      if (error) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(200).json({ success: true, data })
    }

    if (method === 'GET') {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers()
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ success: true, data: data.users || data })
    }

    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).end(`Method ${method} Not Allowed`)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: error.message })
  }
}
