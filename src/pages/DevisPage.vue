<script setup>
/**
 * Page Devis, reprise de livewire/erp/invoice-page.blade.php et _erp/invoice/invoice_table :
 * tableau des sections et lignes (quantité / coef +−, priorité, sous-totaux par catégorie,
 * marge, taxe), modalités et notes ; à droite budget, acomptes, dépenses, documents.
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { errorMessage } from '@/api/client'
import {
  PRIORITIES,
  addAcompte,
  addSpent,
  deleteAcompte,
  deleteRow,
  deleteSection,
  deleteSpent,
  devisPdf,
  duplicateSection,
  formatAmount,
  formatDate,
  getDevis,
  saveRow,
  saveSection,
  toggleDevisFavorite,
  updateDevis,
} from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'
import AppModal from '@/components/AppModal.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import RowFormModal from '@/components/forms/RowFormModal.vue'

const route = useRoute()
const id = computed(() => route.params.id)

const devis = ref(null)
const loading = ref(true)
const error = ref('')
const layout = ref(0) // 0 : avec colonne de droite, 1 : pleine largeur

async function load() {
  loading.value = !devis.value
  error.value = ''
  try {
    devis.value = await getDevis(id.value)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(id, () => {
  devis.value = null
  load()
})

const run = async (fn) => {
  try {
    await fn()
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

const breadcrumbs = computed(() => [
  { name: 'ERP' },
  { name: 'Devis', to: { name: 'devis-list' } },
  ...(devis.value?.projet_id ? [{ name: devis.value.projet_name || 'Projet', to: { name: 'projet', params: { id: devis.value.projet_id } } }] : []),
  { name: devis.value ? `#${devis.value.reference}` : 'Devis' },
])

// ---------- Calculs (comme invoice_table.blade.php) ----------
const cat = (p) => (p >= 0 && p <= 4 ? 'materiel' : p === 5 ? 'cable' : p === 6 ? 'accessoires' : p === 7 ? 'mainoeuvre' : 'autre')
function sums(rows) {
  const s = { total: 0, marge: 0, bought: 0, materiel: 0, cable: 0, accessoires: 0, mainoeuvre: 0 }
  for (const r of rows) {
    const withCoef = r.quantite * r.coef * r.prix
    s.total += r.quantite * r.prix
    s.marge += withCoef
    s.bought += (r.bought || 0) * r.prix
    const c = cat(r.priorite_id)
    if (c in s) s[c] += withCoef
  }
  return s
}
const sections = computed(() => (devis.value?.sections || []).map((sec) => ({ ...sec, sums: sums(sec.rows) })))
const totals = computed(() => sums((devis.value?.sections || []).flatMap((sec) => (sec.show ? sec.rows : []))))
const taxRate = computed(() => (devis.value?.tax === 'tva' ? 0.18 : devis.value?.tax === 'brs' ? 0.05 : 0))
const taxAmount = computed(() => totals.value.marge * taxRate.value)
const grandTotal = computed(() => totals.value.marge + taxAmount.value)

const activeStatus = computed(() => !['Proforma', 'Nouveau', 'Annulé', 'En Pause'].includes(devis.value?.statut))
const statusColor = (s) =>
  ({ Proforma: 'bg-secondary', Nouveau: 'bg-blue', 'En Cours': 'bg-azure', 'En Pause': 'bg-yellow', Annulé: 'bg-red', 'Bl a faire': 'bg-orange', 'A Facturer': 'bg-purple', 'Paiement en attente': 'bg-pink', Terminé: 'bg-green' })[s] ||
  'bg-secondary'
const priorityName = (p) => PRIORITIES.find((x) => x.id === p)?.name ?? '—'
const fmt = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Number(n || 0))
const fmtQ = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(n || 0))

// ---------- En-tête : statut, favori, édition, PDF ----------
const setStatus = (statut) => run(() => updateDevis(devis.value.id, { statut }))
async function favorite() {
  try {
    const { data } = await toggleDevisFavorite(devis.value.id)
    devis.value.favorite = data?.data?.favorite ?? !devis.value.favorite
  } catch (e) {
    error.value = errorMessage(e)
  }
}

const editOpen = ref(false)
const editForm = reactive({ reference: '', description: '', tax: '', remise: 0, facture_date: '', paydate: '' })
const editSaving = ref(false)
const editError = ref('')
function openEdit() {
  const d = devis.value
  Object.assign(editForm, {
    reference: d.reference ?? '',
    description: d.description ?? '',
    tax: d.tax === 'tva' || d.tax === 'brs' ? d.tax : '',
    remise: Number(d.remise) || 0,
    facture_date: (d.facture_date || '').slice(0, 10),
    paydate: (d.paydate || '').slice(0, 10),
  })
  editError.value = ''
  editOpen.value = true
}
async function submitEdit() {
  editSaving.value = true
  editError.value = ''
  try {
    devis.value = await updateDevis(devis.value.id, {
      ...editForm,
      tax: editForm.tax || '',
      facture_date: editForm.facture_date || null,
      paydate: editForm.paydate || null,
    })
    editOpen.value = false
  } catch (e) {
    editError.value = errorMessage(e)
  } finally {
    editSaving.value = false
  }
}

const pdfOpen = ref(false)
const pdfLoading = ref('')
async function openPdf(type) {
  pdfLoading.value = type
  try {
    const blob = await devisPdf(devis.value.id, type)
    window.open(URL.createObjectURL(blob), '_blank')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    pdfLoading.value = ''
  }
}

// ---------- Sections ----------
const sectionFields = [
  { name: 'section', label: 'Titre de la section', required: true },
  { name: 'proposition', label: 'Proposition technique', type: 'textarea' },
]
const sectionOpen = ref(false)
const editingSection = ref(null)
function openSection(s = null) {
  editingSection.value = s
  sectionOpen.value = true
}
const submitSection = (v) => saveSection(editingSection.value ? v : { ...v, invoice_id: devis.value.id }, editingSection.value?.id)
const toggleShow = (s) => run(() => saveSection({ show: !s.show }, s.id))
const toggleProposition = (s) => run(() => saveSection({ status: !s.status }, s.id))
const dupSection = (s) => run(() => duplicateSection(s.id))
function removeSection(s) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette section ?')) return
  run(() => deleteSection(s.id))
}

// ---------- Lignes ----------
const rowOpen = ref(false)
const rowSection = ref(null)
const editingRow = ref(null)
function openRow(section, row = null) {
  rowSection.value = section
  editingRow.value = row
  rowOpen.value = true
}
async function onRowSaved() {
  rowOpen.value = false
  await load()
}
async function bump(row, field, delta) {
  const next = field === 'quantite' ? Math.max(0, row.quantite + delta) : Math.max(0, Math.round((row.coef + delta) * 100) / 100)
  const prev = row[field]
  row[field] = next // affichage immédiat
  try {
    await saveRow({ [field]: next }, row.id)
  } catch (e) {
    row[field] = prev
    error.value = errorMessage(e)
  }
}
const setPriority = (row, p) => run(() => saveRow({ priorite_id: p }, row.id))
function removeRow(row) {
  if (!confirm(`Supprimer « ${row.designation} » ?`)) return
  run(() => deleteRow(row.id))
}
function editComment(row) {
  const c = prompt('Commentaire de la ligne :', row.comment || '')
  if (c === null) return
  run(() => saveRow({ comment: c.trim() || null }, row.id))
}

// ---------- Modalités et notes ----------
function editText(field, label) {
  const v = prompt(label, devis.value[field] || '')
  if (v === null) return
  run(() => updateDevis(devis.value.id, { [field]: v.trim() || null }))
}

// ---------- Acomptes et dépenses ----------
const today = () => new Date().toISOString().slice(0, 10)
const moneyFields = [
  { name: 'name', label: 'Libellé', required: true },
  { name: 'montant', label: 'Montant (F)', type: 'number', required: true, col: 'col-md-6' },
  { name: 'date', label: 'Date', type: 'date', required: true, col: 'col-md-6' },
  { name: 'description', label: 'Description', type: 'textarea' },
]
const acompteOpen = ref(false)
const spentOpen = ref(false)
const submitAcompte = (v) => addAcompte({ ...v, invoice_id: devis.value.id })
const submitSpent = (v) => addSpent({ ...v, invoice_id: devis.value.id })
function removeAcompte(a) {
  if (!confirm(`Supprimer l'acompte « ${a.name} » ?`)) return
  run(() => deleteAcompte(a.id))
}
function removeSpent(s) {
  if (!confirm(`Supprimer la dépense « ${s.name} » ?`)) return
  run(() => deleteSpent(s.id))
}
const reste = computed(() => grandTotal.value - Number(devis.value?.acompte_total || 0))
const benefice = computed(() => totals.value.marge - Number(devis.value?.spent_total || 0))
</script>

<template>
  <PageHeader title="Devis" :breadcrumbs="breadcrumbs" :loading="loading">
    <template #actions>
      <div v-if="devis" class="btn-list">
        <div class="dropdown">
          <button class="btn btn-primary" type="button" data-bs-toggle="dropdown"><i class="ti ti-chevron-down"></i> Actions</button>
          <div class="dropdown-menu dropdown-menu-end">
            <button class="dropdown-item" type="button" @click="openSection()"><i class="ti ti-plus"></i> Section</button>
            <span class="dropdown-item disabled"><i class="ti ti-file-arrow-left"></i> Importer un devis (à venir)</span>
            <span class="dropdown-item disabled"><i class="ti ti-file"></i> Procès-verbal (à venir)</span>
          </div>
        </div>
        <button
          class="btn btn-icon"
          :class="devis.favorite ? 'btn-secondary' : 'btn-success'"
          :title="devis.favorite ? 'Supprimer des favoris' : 'Ajouter aux favoris'"
          @click="favorite"
        >
          <i class="ti ti-heart"></i>
        </button>
        <button class="btn btn-icon" :class="{ active: layout === 1 }" title="Pleine largeur" @click="layout = 1"><i class="ti ti-arrow-autofit-width"></i></button>
        <button class="btn btn-icon" :class="{ active: layout === 0 }" title="Avec colonne latérale" @click="layout = 0"><i class="ti ti-layout-sidebar-right"></i></button>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-if="devis" class="row g-2">
        <!-- Tableau du devis -->
        <div :class="layout === 0 ? 'col-lg-8' : 'col-12'">
          <div class="card">
            <div class="card-header align-items-start">
              <div class="card-title">
                <div>
                  <span title="Client">{{ devis.client_name }}</span> -
                  <RouterLink v-if="devis.projet_id" :to="{ name: 'projet', params: { id: devis.projet_id } }" title="Projet">{{ devis.projet_name }}</RouterLink>
                </div>
                <div class="text-primary">
                  #{{ devis.reference }}
                  <span class="fs-5 text-secondary" title="Date de création">{{ formatDate(devis.created_at) }}</span>
                </div>
                <div class="fw-normal pre" style="font-size: 13px">{{ devis.description }}</div>
                <div v-if="devis.paydate" class="text-purple fw-normal" style="font-size: 13px">Payé le {{ formatDate(devis.paydate) }}</div>
              </div>
              <div class="card-actions btn-list">
                <div class="dropdown">
                  <span class="badge text-white cursor-pointer" :class="statusColor(devis.statut)" data-bs-toggle="dropdown" title="Changer le statut">
                    {{ devis.statut }} <i class="ti ti-chevron-down"></i>
                  </span>
                  <div class="dropdown-menu dropdown-menu-end">
                    <button v-for="s in devis.statuses" :key="s" class="dropdown-item" :class="{ active: s === devis.statut }" type="button" @click="setStatus(s)">{{ s }}</button>
                  </div>
                </div>
                <button class="btn btn-primary btn-icon" title="Exporter en PDF" @click="pdfOpen = true"><i class="ti ti-file-type-pdf"></i></button>
                <button class="btn btn-primary btn-icon" title="Modifier le devis" @click="openEdit"><i class="ti ti-edit"></i></button>
              </div>
            </div>

            <div class="table-responsive">
              <table class="table table-vcenter mb-0">
                <thead>
                  <tr>
                    <th>Désignation</th>
                    <th class="text-center">Qte</th>
                    <th class="text-center">Coef</th>
                    <th class="text-center">Prix</th>
                    <th class="text-center">Total</th>
                    <th class="text-center">Marge</th>
                    <th class="text-center" style="width: 60px">_</th>
                  </tr>
                </thead>

                <template v-for="s in sections" :key="s.id">
                  <thead>
                    <tr>
                      <th class="bg-primary-lt" colspan="7">
                        <div class="row g-2 align-items-center">
                          <div class="col">
                            <div class="text-danger" style="font-size: 10px" title="Référence de la section">{{ s.id }}</div>
                            <div class="text-wrap">{{ s.section }}</div>
                          </div>
                          <div class="col-auto d-flex flex-wrap justify-content-end gap-1">
                            <button class="btn btn-sm rounded" :class="s.show ? 'btn-dark' : 'btn-success'" :title="s.show ? 'Cacher le contenu' : 'Afficher le contenu'" @click="toggleShow(s)">
                              <i :class="['ti', s.show ? 'ti-eye-off' : 'ti-eye']"></i>
                            </button>
                            <button
                              class="btn btn-sm rounded"
                              :class="s.status ? 'btn-success' : 'btn-dark'"
                              :title="s.status ? 'Retirer de la proposition technique' : 'Ajouter à la proposition technique'"
                              @click="toggleProposition(s)"
                            >
                              <i :class="['ti', s.status ? 'ti-circle-check' : 'ti-circle-x']"></i>
                            </button>
                            <button class="btn btn-sm p-1 rounded btn-primary" @click="openRow(s)"><i class="ti ti-plus"></i> Article</button>
                            <button class="btn btn-sm p-1 rounded btn-primary btn-icon" title="Modifier la section" @click="openSection(s)"><i class="ti ti-edit"></i></button>
                            <button v-if="!s.rows.length" class="btn btn-sm p-1 rounded btn-danger btn-icon" title="Supprimer la section" @click="removeSection(s)"><i class="ti ti-trash"></i></button>
                            <button class="btn btn-sm p-1 btn-primary rounded" title="Dupliquer la section" @click="dupSection(s)"><i class="ti ti-copy"></i></button>
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr v-if="s.proposition">
                      <td colspan="7"><div class="text-muted pre" style="font-size: 12px">{{ s.proposition }}</div></td>
                    </tr>

                    <template v-if="s.show">
                      <tr v-for="r in s.rows" :key="r.id" :class="{ 'text-danger': r.quantite == 0 || r.prix == 0 }">
                        <td>
                          <div class="d-flex align-items-start gap-2">
                            <i
                              class="ti ti-message cursor-pointer mt-1"
                              :class="{ 'text-success': r.comment }"
                              :title="r.comment || 'Ajouter un commentaire'"
                              @click="editComment(r)"
                            ></i>
                            <img v-if="r.image" :src="r.image" alt="" class="avatar avatar-sm rounded-2" style="object-fit: contain" />
                            <span v-else class="avatar avatar-sm rounded-2 bg-white border"><i class="ti ti-package"></i></span>
                            <div class="min-w-0">
                              <RouterLink v-if="r.article_id" :to="{ name: 'article', params: { id: r.article_id } }">{{ r.designation }}</RouterLink>
                              <span v-else>{{ r.designation }}</span>
                              <div v-if="r.reference && r.reference !== '_'" class="text-muted small pre">{{ r.reference }}</div>
                            </div>
                          </div>
                        </td>
                        <td class="text-center">
                          <div class="stepper">
                            <button class="btn btn-sm rounded" title="−1" @click="bump(r, 'quantite', -1)">−</button>
                            <span>{{ r.quantite }}</span>
                            <button class="btn btn-sm rounded" title="+1" @click="bump(r, 'quantite', 1)">+</button>
                          </div>
                        </td>
                        <td class="text-center">
                          <div class="stepper">
                            <button class="btn btn-sm rounded" title="−0,05" @click="bump(r, 'coef', -0.05)">−</button>
                            <span>{{ fmtQ(r.coef) }}</span>
                            <button class="btn btn-sm rounded" title="+0,05" @click="bump(r, 'coef', 0.05)">+</button>
                          </div>
                        </td>
                        <td class="text-center text-nowrap">{{ fmt(r.prix) }}</td>
                        <td class="text-center text-nowrap">
                          <div title="Prix total avec coefficient de marge">{{ fmt(r.prix * r.quantite * r.coef) }}</div>
                          <div class="text-muted small" title="Prix total sans coefficient">{{ fmt(r.prix * r.quantite) }}</div>
                        </td>
                        <td class="text-center">
                          <div class="dropdown">
                            <span class="badge bg-secondary-lt cursor-pointer" data-bs-toggle="dropdown">{{ priorityName(r.priorite_id) }}</span>
                            <div class="dropdown-menu">
                              <button v-for="p in PRIORITIES" :key="p.id" class="dropdown-item" type="button" @click="setPriority(r, p.id)">{{ p.name }}</button>
                            </div>
                          </div>
                        </td>
                        <td class="text-center">
                          <div class="dropdown">
                            <button class="btn btn-sm btn-action" data-bs-toggle="dropdown" aria-label="Actions"><i class="ti ti-dots-vertical"></i></button>
                            <div class="dropdown-menu dropdown-menu-end">
                              <button class="dropdown-item text-success" type="button" @click="openRow(s, r)"><i class="ti ti-edit"></i> Éditer</button>
                              <button class="dropdown-item text-danger" type="button" @click="removeRow(r)"><i class="ti ti-trash"></i> Supprimer</button>
                            </div>
                          </div>
                        </td>
                      </tr>

                      <!-- Sous-totaux de la section -->
                      <tr v-if="s.rows.length" class="small">
                        <td colspan="2" class="bg-indigo-lt">
                          <div><b>Matériel :</b> {{ fmt(s.sums.materiel) }} F</div>
                          <div><b>Câble :</b> {{ fmt(s.sums.cable) }} F</div>
                        </td>
                        <td colspan="2" class="text-end bg-indigo-lt">
                          <div><b>Accessoires :</b> {{ fmt(s.sums.accessoires) }} F</div>
                          <div><b>Main d'œuvre :</b> {{ fmt(s.sums.mainoeuvre) }} F</div>
                        </td>
                        <td class="bg-azure-lt">
                          <div>Sous-total</div>
                          <div>Sous-total achat</div>
                        </td>
                        <td colspan="2" class="text-end bg-azure-lt text-nowrap">
                          <div>{{ fmt(s.sums.marge) }} F</div>
                          <div>{{ fmt(s.sums.bought) }} F</div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </template>

                <thead>
                  <tr>
                    <th class="bg-primary-lt" colspan="7">
                      <button class="btn btn-primary" @click="openSection()"><i class="ti ti-plus"></i> Section</button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colspan="3">
                      <div><b>Matériel :</b> {{ fmt(totals.materiel) }} F</div>
                      <div><b>Câble :</b> {{ fmt(totals.cable) }} F</div>
                      <div><b>Accessoires :</b> {{ fmt(totals.accessoires) }} F</div>
                      <div><b>Main d'œuvre :</b> {{ fmt(totals.mainoeuvre) }} F</div>
                    </td>
                    <td colspan="4">
                      <div class="d-flex justify-content-between"><b>Total :</b> <span>{{ fmt(totals.total) }} F</span></div>
                      <div v-if="totals.marge - totals.total" class="d-flex justify-content-between"><b>Marge :</b> <span>{{ fmt(totals.marge - totals.total) }} F</span></div>
                      <div v-if="taxRate" class="d-flex justify-content-between">
                        <b>{{ devis.tax === 'tva' ? 'TVA (18 %)' : 'BRS (5 %)' }} :</b> <span>{{ fmt(taxAmount) }} F</span>
                      </div>
                      <div v-else class="text-secondary">Pas de taxe</div>
                      <div class="d-flex justify-content-between fs-3 fw-bold border-top mt-1 pt-1"><span>Montant :</span> <span>{{ fmt(grandTotal) }} F</span></div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Modalités et notes -->
          <div class="row g-2 mt-0">
            <div class="col-md-6">
              <div class="card h-100">
                <div class="card-header">
                  <h3 class="card-title">Modalités</h3>
                  <div class="card-actions"><button class="btn btn-sm btn-icon" title="Modifier" @click="editText('modalite', 'Modalités :')"><i class="ti ti-edit"></i></button></div>
                </div>
                <div class="card-body pre small">{{ devis.modalite || '—' }}</div>
              </div>
            </div>
            <div class="col-md-6">
              <div class="card h-100">
                <div class="card-header">
                  <h3 class="card-title">Notes</h3>
                  <div class="card-actions"><button class="btn btn-sm btn-icon" title="Modifier" @click="editText('note', 'Notes :')"><i class="ti ti-edit"></i></button></div>
                </div>
                <div class="card-body pre small">{{ devis.note || '—' }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Colonne de droite -->
        <div :class="layout === 0 ? 'col-lg-4' : 'col-12'">
          <!-- Budget -->
          <div v-if="activeStatus" class="card mb-2">
            <div class="card-header"><h3 class="card-title">Budget</h3></div>
            <div class="card-body">
              <div class="d-flex justify-content-between"><span>Montant du devis</span><b>{{ fmt(grandTotal) }} F</b></div>
              <div class="d-flex justify-content-between"><span>Acomptes reçus</span><span>{{ fmt(devis.acompte_total) }} F</span></div>
              <div class="d-flex justify-content-between"><span>Reste à encaisser</span><b :class="reste > 0 ? 'text-danger' : 'text-success'">{{ fmt(reste) }} F</b></div>
              <div class="d-flex justify-content-between border-top mt-2 pt-2"><span>Dépenses</span><span>{{ fmt(devis.spent_total) }} F</span></div>
              <div class="d-flex justify-content-between"><span>Bénéfice estimé</span><b>{{ fmt(benefice) }} F</b></div>
            </div>
          </div>

          <!-- Acomptes -->
          <div class="card mb-2">
            <div class="card-header">
              <h3 class="card-title">Acomptes</h3>
              <div class="card-actions"><button class="btn btn-sm btn-primary" @click="acompteOpen = true"><i class="ti ti-plus"></i> Acompte</button></div>
            </div>
            <div class="list-group list-group-flush">
              <div v-if="!devis.acomptes?.length" class="list-group-item text-secondary small">Aucun acompte</div>
              <div v-for="a in devis.acomptes" :key="a.id" class="list-group-item d-flex align-items-center gap-2">
                <div class="flex-fill">
                  <div class="fw-medium">{{ a.name }}</div>
                  <div class="text-secondary small">{{ formatDate(a.date) }}</div>
                </div>
                <b class="text-nowrap">{{ formatAmount(a.montant) }}</b>
                <button class="btn btn-sm btn-ghost-danger btn-icon" title="Supprimer" @click="removeAcompte(a)"><i class="ti ti-trash"></i></button>
              </div>
            </div>
          </div>

          <!-- Dépenses -->
          <div v-if="activeStatus" class="card mb-2">
            <div class="card-header">
              <h3 class="card-title">Dépenses</h3>
              <div class="card-actions"><button class="btn btn-sm btn-primary" @click="spentOpen = true"><i class="ti ti-plus"></i> Dépense</button></div>
            </div>
            <div class="list-group list-group-flush">
              <div v-if="!devis.spents?.length" class="list-group-item text-secondary small">Aucune dépense</div>
              <div v-for="s in devis.spents" :key="s.id" class="list-group-item d-flex align-items-center gap-2">
                <div class="flex-fill">
                  <div class="fw-medium">{{ s.name }}</div>
                  <div class="text-secondary small">{{ formatDate(s.date) }}</div>
                </div>
                <b class="text-nowrap">{{ formatAmount(s.montant) }}</b>
                <button class="btn btn-sm btn-ghost-danger btn-icon" title="Supprimer" @click="removeSpent(s)"><i class="ti ti-trash"></i></button>
              </div>
            </div>
          </div>

          <!-- Documents -->
          <div class="card mb-2">
            <div class="card-header"><h3 class="card-title">Documents</h3></div>
            <div class="list-group list-group-flush">
              <div v-if="!devis.documents?.length" class="list-group-item text-secondary small">Aucun document</div>
              <a v-for="d in devis.documents" :key="d.id" :href="d.url" target="_blank" rel="noopener" class="list-group-item list-group-item-action">
                <i class="ti ti-file-text me-1"></i>{{ d.name }} <span v-if="d.type" class="badge bg-secondary-lt ms-1">{{ d.type }}</span>
              </a>
            </div>
          </div>

          <!-- À venir -->
          <div class="card mb-2">
            <div class="card-body text-secondary small">
              <div><i class="ti ti-truck"></i> Bordereaux de livraison : à venir</div>
              <div><i class="ti ti-receipt"></i> Factures et acomptes facturés : à venir</div>
              <div><i class="ti ti-bulb"></i> Propositions : à venir</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Modifier le devis -->
  <AppModal :show="editOpen" title="Éditer un devis" :saving="editSaving" :can-submit="!!editForm.reference.trim()" :error="editError" @close="editOpen = false" @submit="submitEdit">
    <div class="row">
      <div class="col-md-6 mb-3">
        <label class="form-label required">Référence</label>
        <input v-model="editForm.reference" class="form-control" required />
      </div>
      <div class="col-md-6 mb-3">
        <label class="form-label">Taxe</label>
        <select v-model="editForm.tax" class="form-select">
          <option value="">Pas de taxe</option>
          <option value="tva">TVA 18 %</option>
          <option value="brs">BRS 5 %</option>
        </select>
      </div>
      <div class="col-12 mb-3">
        <label class="form-label">Description</label>
        <textarea v-model="editForm.description" class="form-control" rows="3"></textarea>
      </div>
      <div class="col-md-4 mb-3">
        <label class="form-label">Remise</label>
        <input v-model.number="editForm.remise" type="number" min="0" class="form-control" />
      </div>
      <div class="col-md-4 mb-3">
        <label class="form-label">Date de facture</label>
        <input v-model="editForm.facture_date" type="date" class="form-control" />
      </div>
      <div class="col-md-4 mb-3">
        <label class="form-label">Date de paiement</label>
        <input v-model="editForm.paydate" type="date" class="form-control" />
      </div>
    </div>
  </AppModal>

  <!-- Export PDF (documents générés par Dash3) -->
  <AppModal :show="pdfOpen" title="Exporter le devis" submit-label="Fermer" @close="pdfOpen = false" @submit="pdfOpen = false">
    <div class="d-grid gap-2">
      <button class="btn btn-primary" :disabled="!!pdfLoading" @click="openPdf('devis')"><span v-if="pdfLoading === 'devis'" class="spinner-border spinner-border-sm me-1"></span><i v-else class="ti ti-file-type-pdf"></i> Devis PDF</button>
      <button class="btn btn-success" :disabled="!!pdfLoading" @click="openPdf('proposition')"><span v-if="pdfLoading === 'proposition'" class="spinner-border spinner-border-sm me-1"></span><i v-else class="ti ti-file-type-pdf"></i> Proposition</button>
      <button class="btn btn-success" :disabled="!!pdfLoading" @click="openPdf('facture')"><span v-if="pdfLoading === 'facture'" class="spinner-border spinner-border-sm me-1"></span><i v-else class="ti ti-file-type-pdf"></i> Facture PDF</button>
      <button class="btn btn-purple" :disabled="!!pdfLoading" @click="openPdf('quantitatif')"><span v-if="pdfLoading === 'quantitatif'" class="spinner-border spinner-border-sm me-1"></span><i v-else class="ti ti-file-type-pdf"></i> Quantitatif PDF</button>
    </div>
  </AppModal>

  <NamedFormModal
    :show="sectionOpen"
    :title="editingSection ? 'Modifier la section' : 'Ajouter une section'"
    :fields="sectionFields"
    :initial="editingSection"
    :submit="submitSection"
    @close="sectionOpen = false"
    @saved="sectionOpen = false; load()"
  />
  <RowFormModal :show="rowOpen" :section-id="rowSection?.id ?? null" :row="editingRow" @close="rowOpen = false" @saved="onRowSaved" />
  <NamedFormModal :show="acompteOpen" title="Ajouter un acompte" :fields="moneyFields" :initial="{ date: today() }" :submit="submitAcompte" @close="acompteOpen = false" @saved="acompteOpen = false; load()" />
  <NamedFormModal :show="spentOpen" title="Ajouter une dépense" :fields="moneyFields" :initial="{ date: today() }" :submit="submitSpent" @close="spentOpen = false" @saved="spentOpen = false; load()" />
</template>

<style scoped>
.pre {
  white-space: pre-line;
}
.stepper {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.stepper .btn {
  min-width: 24px;
  padding: 0 6px;
  opacity: 0.35;
}
tr:hover .stepper .btn {
  opacity: 1;
}
</style>
