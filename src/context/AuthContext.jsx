import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

const DEFAULT_ADMIN_EMAILS = [
  'usuario.prueba@gmail.com',
]

function normalizeUser(user) {
  if (!user) return null

  const metadataRole = user.user_metadata?.role
  const email = user.email?.toLowerCase()
  const isDevAdmin = DEFAULT_ADMIN_EMAILS.includes(email)

  return {
    ...user,
    role: metadataRole || (isDevAdmin ? 'admin' : 'lector'),
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Verificar sesión actual al cargar
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(normalizeUser(session?.user ?? null))
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(normalizeUser(session?.user ?? null))
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  const login = async (email, password) => {
    try {
      setError(null)
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError
      setUser(normalizeUser(data.user))
      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    }
  }

  const signup = async (email, password) => {
    try {
      setError(null)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) throw signUpError
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
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider')
  }
  return context
}
