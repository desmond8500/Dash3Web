import api, { errorMessage, normalizeList } from '@/api/client'

// ---------- Recherche globale ----------

async function searchSection(endpoint, search) {
  try {
    const { data } = await api.get(endpoint, { params: { search, per_page: 8 } })
    const list = normalizeList(data)
    return { items: list.items, total: list.total, error: '' }
  } catch (e) {
    return { items: [], total: 0, error: errorMessage(e) }
  }
}

/** Recherche simultanée dans les clients, projets et devis */
export async function globalSearch(search) {
  const [clients, projets, devis] = await Promise.all([
    searchSection('/clients', search),
    searchSection('/projets', search),
    searchSection('/invoices', search),
  ])
  return { clients, projets, devis }
}

// ---------- Stock ----------

export async function listBrands(search = '') {
  const { data } = await api.get('/brands', { params: { search: search || undefined } })
  return data?.data ?? []
}

export async function listProviders(search = '') {
  const { data } = await api.get('/providers', { params: { search: search || undefined } })
  return data?.data ?? []
}

export async function listAchats() {
  const { data } = await api.get('/achats')
  return data?.data ?? []
}

// ---------- Comptabilité ----------

/** Devis facturés dans le mois (facture_date) */
export async function monthInvoices(month, year) {
  const { data } = await api.post('/get_month_invoices', { month, year })
  return data?.data ?? []
}

/** Devis payés dans le mois (paydate) */
export async function monthPaidInvoices(month, year) {
  const { data } = await api.post('/paid_invoices', { month, year })
  return data?.data ?? []
}

// ---------- Formatage ----------

export const formatAmount = (n) =>
  n === null || n === undefined || n === '' ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n)) + ' F'

export const formatDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—')

// ---------- Écriture (formulaires des pages ERP / Stock) ----------

/** Envoie une image (multipart, champ « image ») vers un endpoint de logo / avatar */
export async function uploadImage(endpoint, file) {
  const fd = new FormData()
  fd.append('image', file)
  const { data } = await api.post(endpoint, fd)
  return data?.data
}

// Clients
export const getClient = async (id) => (await api.get(`/clients/${id}`)).data?.data
export const saveClient = async (payload, id) => (id ? api.put(`/clients/${id}`, payload) : api.post('/clients', payload))
export const deleteClient = (id) => api.delete(`/clients/${id}`)
export const toggleClientFavorite = (id) => api.post(`/clients/${id}/favorite`)
export const clientTasks = async (id) => (await api.get(`/clients_tasks/${id}`)).data?.data ?? []

// Projets
export const getProjet = async (id) => (await api.get(`/projets/${id}`)).data?.data
export const saveProjet = async (payload, id) => (id ? api.put(`/projets/${id}`, payload) : api.post('/projets', payload))
export const deleteProjet = (id) => api.delete(`/projets/${id}`)
export const toggleProjetFavorite = (id) => api.post(`/projets/${id}/favorite`)

// Articles
export const saveArticle = async (payload, id) => (id ? api.put(`/items/${id}`, payload) : api.post('/items', payload))
export const deleteArticle = (id) => api.delete(`/items/${id}`)

// Marques / fournisseurs
export const saveBrand = async (payload, id) => (id ? api.put(`/brands/${id}`, payload) : api.post('/brands', payload))
export const deleteBrand = (id) => api.delete(`/brands/${id}`)
export const saveProvider = async (payload, id) => (id ? api.put(`/providers/${id}`, payload) : api.post('/providers', payload))
export const deleteProvider = (id) => api.delete(`/providers/${id}`)

/** Catégories d'articles (priority_id), comme dans le modèle Article de Dash3 */
export const PRIORITIES = [
  { id: 0, name: 'Centrale 1' },
  { id: 1, name: 'Centrale 2' },
  { id: 2, name: 'Organe 1' },
  { id: 3, name: 'Organe 2' },
  { id: 4, name: 'Organe 3' },
  { id: 5, name: 'Câble' },
  { id: 6, name: 'Accessoires' },
  { id: 7, name: 'Forfait' },
]
