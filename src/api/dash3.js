import api, { errorMessage, normalizeList } from '@/api/client'
import { markImageEdited } from '@/utils/imageVersions'

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

// ---------- Édition d'images (rogner, pivoter, redimensionner) ----------

/** Dimensions d'une image déjà enregistrée (path = URL affichée ou « storage/… ») */
export async function imageInfo(path) {
  const { data } = await api.get('/images/info', { params: { path } })
  return data?.data
}

/**
 * Modifie une image enregistrée sur le serveur.
 * ops : { rotate, flip_h, flip_v, crop: {x,y,width,height}, resize: {width,height}, quality }
 * mode : 'replace' (écrase, les liens restent valables) | 'copy' (nouveau fichier à côté)
 * Renvoie { path, url, width, height, size, version }
 */
export async function editImage(path, ops, mode = 'replace') {
  const { data } = await api.post('/images/edit', { path, ...ops, mode })
  const result = data?.data
  if (result?.path) markImageEdited(result.path, result.version)
  return result
}

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

// Onglets et actions ajoutés avec l'API Dash3 (contacts, badges, types, commandes)
export const clientContacts = async (id) => (await api.get(`/clients/${id}/contacts`)).data?.data ?? []
export const projetBadges = async (id) => (await api.get(`/projets/${id}/badges`)).data?.data ?? []
export const articleTypes = async () => (await api.get('/items_types')).data?.data ?? []
export const orderArticle = (id, quantity = 1) => api.post(`/items/${id}/commande`, { quantity })

// ---------- Page article ----------
export const getArticle = async (id) => (await api.get(`/items/${id}`)).data?.data
export const articleImages = async (id) => (await api.get(`/items_image/${id}`)).data?.data ?? []
export const articleLinks = async (id) => (await api.get(`/items_link/${id}`)).data?.data ?? []
export const articleDocuments = async (id) => (await api.get(`/items_document/${id}`)).data?.data ?? []
export const adjustArticleQuantity = async (id, delta) => (await api.post(`/items/${id}/quantity`, { delta })).data?.data
export const attachArticleTag = async (id, name) => (await api.post(`/items/${id}/tags`, { name })).data?.data ?? []
export const detachArticleTag = async (id, name) => (await api.delete(`/items/${id}/tags`, { params: { name } })).data?.data ?? []
export async function uploadArticleImages(id, files) {
  const fd = new FormData()
  for (const f of files) fd.append('images[]', f)
  return (await api.post(`/items/${id}/images`, fd)).data?.data ?? []
}
export const setArticleDefaultImage = (id, path) => api.post(`/items/${id}/image-default`, { path })
export const deleteArticleImage = async (id, path) => (await api.delete(`/items/${id}/images`, { params: { path } })).data?.data ?? []
export const articleDependances = async (id) => (await api.get(`/items/${id}/dependances`)).data?.data ?? []
export const addArticleDependance = async (id, dependenceId) =>
  (await api.post(`/items/${id}/dependances`, { dependence_id: dependenceId })).data?.data ?? []
export const adjustDependance = (depId, delta) => api.post(`/dependances/${depId}/quantity`, { delta })
export const removeDependance = (depId) => api.delete(`/dependances/${depId}`)

// ---------- Installations ----------
export const getInstallations = async (projetId) => (await api.get(`/projets/${projetId}/installations`)).data?.data
export const saveBuilding = (payload, id) => (id ? api.put(`/buildings/${id}`, payload) : api.post('/buildings', payload))
export const deleteBuilding = (id) => api.delete(`/buildings/${id}`)
export const saveInstallationSysteme = (payload, id) => (id ? api.put(`/installation_systemes/${id}`, payload) : api.post('/installation_systemes', payload))
export const deleteInstallationSysteme = (id) => api.delete(`/installation_systemes/${id}`)
export const saveEquipement = (payload, id) => (id ? api.put(`/equipements/${id}`, payload) : api.post('/equipements', payload))
export const deleteEquipement = (id) => api.delete(`/equipements/${id}`)
export const listPlans = async (projetId) => (await api.get(`/projets/${projetId}/plans`)).data?.data ?? []
export async function uploadPlan(projetId, file, buildingId = null, name = '') {
  const fd = new FormData()
  fd.append('projet_id', projetId)
  fd.append('file', file)
  if (buildingId) fd.append('building_id', buildingId)
  if (name) fd.append('name', name)
  return (await api.post('/plans', fd)).data?.data
}
export const deletePlan = (id) => api.delete(`/plans/${id}`)

// ---------- Plans : éditeur et export ----------
/** Fichier du plan servi par l'API (blob) ; variant 'pdf' = PDF converti d'un DWG */
export async function planFile(planId, variant = null) {
  const { data } = await api.get(`/plans/${planId}/file`, { params: { variant: variant || undefined }, responseType: 'blob' })
  return data
}
export const planMarkers = async (planId) => (await api.get(`/plans/${planId}/markers`)).data?.data
export const savePlanMarkers = async (planId, markers) => (await api.put(`/plans/${planId}/markers`, { markers })).data?.data
export const convertPlan = (planId) => api.post(`/plans/${planId}/convert`)

// ---------- Devis ----------
export const getDevis = async (id) => (await api.get(`/invoices/${id}`)).data?.data
export const updateDevis = async (id, payload) => (await api.put(`/invoices/${id}`, payload)).data?.data
export const toggleDevisFavorite = (id) => api.post(`/invoices/${id}/favorite`)
export const saveSection = (payload, id) => (id ? api.put(`/invoice_sections/${id}`, payload) : api.post('/invoice_sections', payload))
export const deleteSection = (id) => api.delete(`/invoice_sections/${id}`)
export const duplicateSection = (id) => api.post(`/invoice_sections/${id}/duplicate`)
export const saveRow = (payload, id) => (id ? api.put(`/invoice_rows/${id}`, payload) : api.post('/invoice_rows', payload))
export const deleteRow = (id) => api.delete(`/invoice_rows/${id}`)
export const addAcompte = (payload) => api.post('/invoice_acomptes', payload)
export const deleteAcompte = (id) => api.delete(`/invoice_acomptes/${id}`)
export const addSpent = (payload) => api.post('/invoice_spents', payload)
export const deleteSpent = (id) => api.delete(`/invoice_spents/${id}`)
/** PDF du devis généré par Dash3 : type devis | proposition | facture | quantitatif */
export async function devisPdf(id, type) {
  const { data } = await api.get(`/facture_pdf/${id}/${type}`, { responseType: 'blob' })
  return data
}
export async function listDevis(page = 1, search = '') {
  const { data } = await api.get('/invoices', { params: { page, per_page: 20, search: search || undefined } })
  return normalizeList(data)
}

// ---------- Projet : contacts, tâches, journaux, documents, création de devis ----------
export const projetContacts = async (projetId) => (await api.get('/contacts', { params: { projet_id: projetId } })).data?.data ?? []
export const saveContact = (payload, id) => (id ? api.put(`/contacts/${id}`, payload) : api.post('/contacts', payload))
export const deleteContact = (id) => api.delete(`/contacts/${id}`)

export const TASK_STATUTS = [
  { value: 1, label: 'Nouveau' },
  { value: 2, label: 'En cours' },
  { value: 3, label: 'En pause' },
  { value: 4, label: 'Terminé' },
  { value: 5, label: 'Clôturé' },
]
export const saveTask = (payload, id) => (id ? api.put(`/tasks/${id}`, payload) : api.post('/tasks', payload))
export const deleteTask = (id) => api.delete(`/tasks/${id}`)

export const saveJournal = (payload, id) => (id ? api.put(`/journaux/${id}`, payload) : api.post('/journaux', payload))
export const deleteJournal = (id) => api.delete(`/journaux/${id}`)

export const createDevis = async (payload) => (await api.post('/invoices', payload)).data?.data

export const projetDocuments = async (projetId) => (await api.get(`/projets/${projetId}/documents`)).data?.data ?? []
export async function uploadProjetDocument(projetId, file, name = '', category = '') {
  const form = new FormData()
  form.append('projet_id', projetId)
  form.append('file', file)
  if (name) form.append('name', name)
  if (category) form.append('category', category)
  return (await api.post('/projet_documents', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data?.data
}
export const renameProjetDocument = (id, name) => api.put(`/projet_documents/${id}`, { name })
export const updateProjetDocument = async (id, payload) => (await api.put(`/projet_documents/${id}`, payload)).data?.data
export const deleteProjetDocument = (id) => api.delete(`/projet_documents/${id}`)
/** Téléchargement via l'API (jeton Bearer) puis enregistrement côté navigateur */
export const downloadProjetDocument = (doc) => downloadDocument(`/projet_documents/${doc.id}/file`, doc)
export async function downloadDocument(endpoint, doc) {
  const { data } = await api.get(endpoint, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = doc.name.includes('.') ? doc.name : `${doc.name}.${doc.extension}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const formatSize = (bytes) => {
  if (bytes == null) return '—'
  const u = ['o', 'Ko', 'Mo', 'Go']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`
}

// ---------- Bâtiment : niveaux, locaux, équipements ; icônes ----------
export const getBuilding = async (id) => (await api.get(`/buildings/${id}`)).data?.data
export const saveStage = (payload, id) => (id ? api.put(`/stages/${id}`, payload) : api.post('/stages', payload))
export const deleteStage = (id) => api.delete(`/stages/${id}`)
export const saveRoom = (payload, id) => (id ? api.put(`/rooms/${id}`, payload) : api.post('/rooms', payload))
export const deleteRoom = (id) => api.delete(`/rooms/${id}`)
export const duplicateEquipement = async (id) => (await api.post(`/equipements/${id}/duplicate`)).data?.data

export const listIcons = async () => (await api.get('/icons')).data?.data ?? []
export const saveIcon = (payload, id) => (id ? api.put(`/icons/${id}`, payload) : api.post('/icons', payload))
export const deleteIcon = (id) => api.delete(`/icons/${id}`)

// ---------- Article : liens et documents ----------
export const addArticleLink = async (id, payload) => (await api.post(`/items/${id}/links`, payload)).data?.data
export const deleteArticleLink = (linkId) => api.delete(`/items_link/${linkId}`)
export async function uploadArticleDocument(id, file, name = '') {
  const form = new FormData()
  form.append('file', file)
  if (name) form.append('name', name)
  return (await api.post(`/items/${id}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data?.data
}
export const deleteArticleDocument = (docId) => api.delete(`/items_document/${docId}`)

// ---------- Détail marque / fournisseur ----------
export const getBrand = async (id) => (await api.get(`/brands/${id}`)).data?.data
export const getProvider = async (id) => (await api.get(`/providers/${id}`)).data?.data
export const addBrandLink = async (id, payload) => (await api.post(`/brands/${id}/links`, payload)).data?.data
export const deleteBrandLink = (linkId) => api.delete(`/brand_links/${linkId}`)

// ---------- Commandes (réapprovisionnement) ----------
export const listCommandes = async () => (await api.get('/commandes')).data?.data ?? { commandes: [], low_stock: [] }
export const setCommandeQuantity = async (articleId, payload) => (await api.put(`/commandes/articles/${articleId}`, payload)).data?.data
export const removeCommande = (articleId) => api.delete(`/commandes/articles/${articleId}`)

// ---------- Journal détaillé ----------
export const getJournal = async (id) => (await api.get(`/journaux/${id}`)).data?.data
export const journalOptions = async (id) => (await api.get(`/journaux/${id}/options`)).data?.data ?? { contacts: [], team: [] }
export const journalDevisOptions = async (id) => (await api.get(`/journaux/${id}/devis`)).data?.data ?? []
export const attachJournalDevis = (id, invoiceId) => api.post(`/journaux/${id}/devis`, { invoice_id: invoiceId })
export const detachJournalDevis = (id, invoiceId) => api.delete(`/journaux/${id}/devis/${invoiceId}`)
export const addIntervenant = async (id, payload) => (await api.post(`/journaux/${id}/intervenants`, payload)).data?.data
export const removeIntervenant = (id) => api.delete(`/journal_intervenants/${id}`)
export const saveJournalSection = (payload, id) => (id ? api.put(`/journal_sections/${id}`, payload) : api.post('/journal_sections', payload))
export const deleteJournalSection = (id) => api.delete(`/journal_sections/${id}`)
export async function uploadSectionImages(sectionId, files) {
  const form = new FormData()
  files.forEach((f) => form.append('images[]', f))
  return (await api.post(`/journal_sections/${sectionId}/images`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data?.data
}
export const deleteJournalImage = (id) => api.delete(`/journal_images/${id}`)
export const captionJournalImage = (id, caption) => api.put(`/journal_images/${id}`, { caption })

// ---------- CV ----------
export const listCvs = async () => (await api.get('/cvs')).data?.data ?? []
export const getCv = async (id) => (await api.get(`/cvs/${id}`)).data?.data
export const saveCv = (payload, id) => (id ? api.put(`/cvs/${id}`, payload) : api.post('/cvs', payload))
export const deleteCv = (id) => api.delete(`/cvs/${id}`)
export const duplicateCv = async (id, name = '') => (await api.post(`/cvs/${id}/duplicate`, name ? { name } : {})).data?.data
export const saveCvSection = (payload, id) => (id ? api.put(`/cv_sections/${id}`, payload) : api.post('/cv_sections', payload))
export const deleteCvSection = (id) => api.delete(`/cv_sections/${id}`)
export const saveCvItem = (payload, id) => (id ? api.put(`/cv_items/${id}`, payload) : api.post('/cv_items', payload))
export const deleteCvItem = (id) => api.delete(`/cv_items/${id}`)

/** Types de section proposés, avec leur icône */
export const CV_SECTION_TYPES = [
  { value: 'experience', label: 'Expériences', icon: 'ti-briefcase' },
  { value: 'formation', label: 'Formations', icon: 'ti-school' },
  { value: 'competence', label: 'Compétences', icon: 'ti-stars' },
  { value: 'langue', label: 'Langues', icon: 'ti-language' },
  { value: 'libre', label: 'Section libre', icon: 'ti-list' },
]

/** Catégories proposées pour les documents (projets et fournisseurs) */
export const DOCUMENT_CATEGORIES = [
  { value: 'catalogue', label: 'Catalogue', icon: 'ti-book' },
  { value: 'flyer', label: 'Flyer', icon: 'ti-file-description' },
  { value: 'plan_acces', label: "Plan d'accès / adresse", icon: 'ti-map-2' },
  { value: 'fiche_technique', label: 'Fiche technique', icon: 'ti-file-settings' },
  { value: 'contrat', label: 'Contrat', icon: 'ti-file-certificate' },
  { value: 'photo', label: 'Photo', icon: 'ti-photo' },
  { value: 'autre', label: 'Autre', icon: 'ti-file' },
]

// ---------- Localisation (projets, fournisseurs) ----------
export const saveProjetLocation = async (id, payload) => (await api.put(`/projets/${id}/location`, payload)).data?.data

// ---------- Badges ----------
export const badgeModeles = async (clientId = null) =>
  (await api.get('/badge_modeles', { params: { client_id: clientId || undefined } })).data?.data ?? []
export const saveBadgeModele = async (payload, id) => (await (id ? api.put(`/badge_modeles/${id}`, payload) : api.post('/badge_modeles', payload))).data?.data
export const deleteBadgeModele = (id) => api.delete(`/badge_modeles/${id}`)
export const saveBadge = async (payload, id) => (await (id ? api.put(`/badges/${id}`, payload) : api.post('/badges', payload))).data?.data
export const deleteBadge = (id) => api.delete(`/badges/${id}`)

// ---------- Fournisseur : documents et liens ----------
export const providerDocuments = async (id) => (await api.get(`/providers/${id}/documents`)).data?.data ?? []
export async function uploadProviderDocument(id, file, name = '', category = '') {
  const form = new FormData()
  form.append('file', file)
  if (name) form.append('name', name)
  if (category) form.append('category', category)
  return (await api.post(`/providers/${id}/documents`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data?.data
}
export const updateProviderDocument = async (docId, payload) => (await api.put(`/provider_documents/${docId}`, payload)).data?.data
export const deleteProviderDocument = (docId) => api.delete(`/provider_documents/${docId}`)
export const downloadProviderDocument = (doc) => downloadDocument(`/provider_documents/${doc.id}/file`, doc)
export const saveProviderLink = async (providerId, payload, linkId) =>
  (await (linkId ? api.put(`/provider_links/${linkId}`, payload) : api.post(`/providers/${providerId}/links`, payload))).data?.data
export const deleteProviderLink = (linkId) => api.delete(`/provider_links/${linkId}`)
