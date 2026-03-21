import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

const DEV_ADMIN_EMAILS = ['usuario.prueba@gmail.com']

async function getRolFromDB(uid, email) {
  if (!uid) return DEV_ADMIN_EMAILS.includes(email?.toLowerCase()) ? 'admin' : 'lector'

  try {
    // Timeout de 5s para que nunca se quede colgado
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 5000)
    )

    const query = supabase
      .from('usuarios')
      .select('rol')
      .eq('id', uid)
      .single()

    const { data, error } = await Promise.race([query, timeout])

    if (error || !data?.rol) {
      return DEV_ADMIN_EMAILS.includes(email?.toLowerCase()) ? 'admin' : 'lector'
    }

    return data.rol
  } catch {
    return DEV_ADMIN_EMAILS.includes(email?.toLowerCase()) ? 'admin' : 'lector'
  }
}

async function buildUser(user) {
  if (!user) return null
  const role = await getRolFromDB(user.id, user.email)
  return { ...user, role }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          console.log('Auth event:', event, session?.user?.email) // 👈 para debug
          const enrichedUser = await buildUser(session?.user ?? null)
          if (mounted) setUser(enrichedUser)
        } catch (err) {
          console.error('onAuthStateChange error:', err)
          if (mounted) setUser(null)
        } finally {
          if (mounted) setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const login = async (email, password) => {
    try {
      setError(null)
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      const enrichedUser = await buildUser(data.user)
      setUser(enrichedUser)
      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    }
  }

  const signup = async (email, password, rol = 'lector') => {
    try {
      setError(null)
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) throw signUpError

      if (data.user) {
        const { error: insertError } = await supabase
          .from('usuarios')
          .insert([{ id: data.user.id, email: data.user.email, rol }])

        if (insertError) console.warn('Error al insertar usuario:', insertError.message)
      }

      return { success: true, data }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    }
  }

  const logout = async () => {
    try {
      setError(null)
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      setUser(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe ser usado dentro de AuthProvider')
  return context
}