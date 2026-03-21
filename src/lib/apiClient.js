export const API_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL?.replace(/\/$/, '') || 'https://gestor-jqli2b9n1-fernandanevarez7171-gmailcoms-projects.vercel.app')

export function apiUrl(path) {
  if (!path) return API_BASE_URL
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${cleanPath}`
}
