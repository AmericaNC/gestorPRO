import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RoleRoute({ children, allowedRoles = [] }) {
  const { user, loading, roleResolved } = useAuth()  // ← añadir roleResolved

  if (loading || !roleResolved) {   // ← mismo guard que ProtectedRoute
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!user.role) return <Navigate to="/sin-permisos" replace />
  if (!allowedRoles.includes(user.role)) return <Navigate to="/sin-permisos" replace />

  return children
}