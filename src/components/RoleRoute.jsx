import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RoleRoute({ children, allowedRoles = [] }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const devAdminEmails = ['usuario.prueba@gmail.com']
  const roleFromMeta = user.role || user.user_metadata?.role
  const role = roleFromMeta || (devAdminEmails.includes(user.email?.toLowerCase()) ? 'admin' : 'lector')

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return children
}
