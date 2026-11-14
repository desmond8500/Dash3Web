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
