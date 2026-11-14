import axios from 'axios'

export const TOKEN_KEY = 'dash3.token'

/** Serveur Dash3 de production */
export const PRODUCTION_API_URL = 'https://dash3.yonkou.info/api/v1'

// En dev, /api/v1 passe par le proxy Vite (pas de CORS) ; en build, appel direct à la production.
const baseURL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api/v1' : PRODUCTION_API_URL)

const api = axios.create({
  baseURL,
  headers: { Accept: 'application/json' },
})

// Ajoute le token Sanctum à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Token expiré ou révoqué : on renvoie vers la page de connexion
let onUnauthorized = () => {}
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) onUnauthorized()
    return Promise.reject(error)
  },
)

/**
 * Les contrôleurs Dash3 ne renvoient pas tous la même forme :
 *  - { data: [...], meta: { current_page, last_page, total } }   (clients)
 *  - { data: { data: [...], current_page, last_page, total } }   (paginator brut)
 * Cette fonction ramène tout à { items, page, lastPage, total }.
 */
export function normalizeList(body) {
  const d = body?.data
  const items = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []
  const meta = body?.meta ?? (Array.isArray(d) ? {} : d) ?? {}
  return {
    items,
    page: meta.current_page ?? 1,
    lastPage: meta.last_page ?? 1,
    total: meta.total ?? items.length,
  }
}

/** Message d'erreur lisible à partir d'une réponse Laravel */
export function errorMessage(error) {
  const data = error?.response?.data
  if (data?.errors) return Object.values(data.errors).flat().join(' ')
  if (data?.message) return data.message
  if (error?.response?.status === 403) return "Vous n'avez pas la permission d'accéder à cette ressource."
  return error?.message || 'Une erreur est survenue.'
}

export default api
