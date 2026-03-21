// ✅ Siempre relativo, funciona en local y en cualquier deployment
export const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || ''

export function apiUrl(path) {
  if (!path) return API_BASE_URL
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${cleanPath}`
}