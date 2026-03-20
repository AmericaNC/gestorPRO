import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { apiUrl } from '../lib/apiClient'

const API_USERS_URL = apiUrl('/api/users')

export default function UsersPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('lector')
  const [status, setStatus] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus({ type: 'info', message: 'Creando usuario...' })

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) {
      setStatus({ type: 'error', message: 'No hay token de sesión activo.' })
      return
    }

    try {
      const response = await fetch(API_USERS_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, role }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Error al crear usuario')
      }

      setStatus({ type: 'success', message: 'Usuario creado correctamente' })
      setEmail('')
      setPassword('')
      setRole('lector')
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Administración de Usuarios</h1>
      <p>Crea nuevos usuarios con rol admin/gestor/lector</p>
      <form onSubmit={handleSubmit} style={{ maxWidth: 420, marginTop: 15 }}>
        <div>
          <label>Email</label><br />
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
        </div>
        <div style={{ marginTop: 10 }}>
          <label>Password</label><br />
          <input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" />
        </div>
        <div style={{ marginTop: 10 }}>
          <label>Rol</label><br />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="admin">admin</option>
            <option value="gestor">gestor</option>
            <option value="lector">lector</option>
          </select>
        </div>
        <button type="submit" style={{ marginTop: 14 }} className="btn-primary">Crear usuario</button>
      </form>

      {status && (
        <p style={{ marginTop: 12, color: status.type === 'error' ? 'red' : status.type === 'success' ? 'green' : 'black' }}>
          {status.message}
        </p>
      )}
    </div>
  )
}
