import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function UsersPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('lector')
  const [status, setStatus] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  const cargarUsuarios = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, email, rol')
      .order('email', { ascending: true })

    if (error) {
      setStatus({ type: 'error', message: `Error cargando usuarios: ${error.message}` })
      setUsers([])
    } else {
      setUsers(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    cargarUsuarios()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus({ type: 'info', message: 'Creando usuario...' })

    try {
      // Crea el usuario en Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) throw signUpError

      const newUser = signUpData.user
      if (!newUser) throw new Error('No se pudo crear el usuario en Auth')

      // Inserta el rol en la tabla usuarios
      const { error: insertError } = await supabase
        .from('usuarios')
        .insert({ id: newUser.id, email: newUser.email, rol: role })

      if (insertError) {
        throw insertError
      }

      setStatus({ type: 'success', message: 'Usuario creado correctamente' })
      setEmail('')
      setPassword('')
      setRole('lector')
      cargarUsuarios()
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Error al crear usuario' })
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

      <div style={{ marginTop: 24 }}>
        <h2>Usuarios registrados</h2>
        {loading ? (
          <p>Cargando usuarios...</p>
        ) : (
          <table style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 6 }}>Email</th>
                <th style={{ textAlign: 'left', padding: 6 }}>Rol</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ padding: 6 }}>No hay usuarios registrados.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ padding: 6 }}>{u.email}</td>
                    <td style={{ padding: 6 }}>{u.rol}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
