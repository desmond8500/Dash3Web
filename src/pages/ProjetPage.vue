<script setup>
/**
 * Page Projet, reprise de livewire/erp/projet-page.blade.php :
 * résumé du projet et bâtiments à gauche, onglets segmentés à droite.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { errorMessage } from '@/api/client'
import { createDevis, deleteJournal, formatAmount, formatDate, getProjet, saveJournal, saveProjetLocation, toggleProjetFavorite } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'
import ProjetFormModal from '@/components/forms/ProjetFormModal.vue'
import ImageUploadModal from '@/components/ImageUploadModal.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import InstallationsTab from '@/components/InstallationsTab.vue'
import TaskList from '@/components/erp/TaskList.vue'
import ContactsGrid from '@/components/erp/ContactsGrid.vue'
import ProjetDocuments from '@/components/erp/ProjetDocuments.vue'
import BadgesManager from '@/components/erp/BadgesManager.vue'
import LocationCard from '@/components/erp/LocationCard.vue'
import JournalCard from '@/components/cards/JournalCard.vue'

const route = useRoute()
const router = useRouter()
const id = computed(() => route.params.id)

const projet = ref(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    projet.value = await getProjet(id.value)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(id, () => {
  notesLoaded.value = false
  badgesCount.value = documentsCount.value = null
  tab.value = fromQuery()
  load()
})

const breadcrumbs = computed(() => [
  { name: 'ERP' },
  { name: 'Clients', to: { name: 'clients' } },
  { name: projet.value?.client_name || 'Client', to: projet.value ? { name: 'projets', query: { client_id: projet.value.client_id } } : null },
  { name: projet.value?.name || 'Projet' },
])

// ---------- Onglets ----------
// L'onglet actif est gardé dans l'URL (?tab=…) : il survit au rechargement
// et permet d'arriver directement sur un onglet depuis un lien.
const TAB_KEYS = ['devis', 'taches', 'contacts', 'badges', 'notes', 'journaux', 'documents', 'installations']
const fromQuery = () => (TAB_KEYS.includes(route.query.tab) ? route.query.tab : 'devis')
const tab = ref(fromQuery())
watch(tab, (t) => {
  if (t !== route.query.tab) router.replace({ query: { ...route.query, tab: t === 'devis' ? undefined : t } })
})
watch(() => route.query.tab, () => {
  if (route.name === 'projet') tab.value = fromQuery()
})

const pendingTasks = computed(() => (projet.value?.tasks ?? []).filter((t) => Number(t.statut_id) < 4).length)
// Quantités renvoyées par l'API (projet.counts), mises à jour par les onglets
const badgesCount = ref(null)
const documentsCount = ref(null)
const tabs = computed(() => [
  { key: 'devis', label: 'Devis', icon: 'ti-file-invoice', count: projet.value?.invoices?.length ?? 0 },
  { key: 'taches', label: 'Tâches', icon: 'ti-checkbox', count: pendingTasks.value, hint: `${pendingTasks.value} en cours sur ${projet.value?.tasks?.length ?? 0}` },
  { key: 'contacts', label: 'Contacts', icon: 'ti-address-book', count: projet.value?.contacts?.length ?? 0 },
  { key: 'badges', label: 'Badges', icon: 'ti-id-badge-2', count: badgesCount.value ?? projet.value?.counts?.badges ?? null },
  { key: 'notes', label: 'Notes', icon: 'ti-note', count: notesLoaded.value ? notes.value.length : projet.value?.counts?.notes ?? null },
  { key: 'journaux', label: 'Journaux', icon: 'ti-notebook', count: projet.value?.journals?.length ?? 0 },
  { key: 'documents', label: 'Documents', icon: 'ti-files', count: documentsCount.value ?? projet.value?.counts?.documents ?? null },
  { key: 'installations', label: 'Installations', icon: 'ti-building', count: projet.value?.buildings?.length ?? 0 },
])
const activeTab = computed(() => tabs.value.find((t) => t.key === tab.value))

const saveLocation = async (payload) => {
  const loc = await saveProjetLocation(projet.value.id, payload)
  Object.assign(projet.value, loc ?? payload)
}

const notes = ref([])
const notesLoaded = ref(false)
async function loadNotes() {
  try {
    const { data } = await api.get(`/get_projet_notes/${id.value}`)
    notes.value = data?.data ?? []
  } catch {
    notes.value = [] // l'API répond en erreur quand il n'y a aucune note
  }
  notesLoaded.value = true
}
watch(tab, (t) => {
  if (t === 'notes' && !notesLoaded.value) loadNotes()
})

// Ajout, modification, suppression des notes
const noteFields = [
  { name: 'titre', label: 'Titre', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
]
const noteOpen = ref(false)
const editingNote = ref(null)
function openNote(note = null) {
  editingNote.value = note
  noteOpen.value = true
}
function saveNote(values) {
  const payload = { ...values, projet_id: Number(id.value) }
  return editingNote.value ? api.put(`/projet_notes/${editingNote.value.id}`, payload) : api.post('/projet_notes', payload)
}
async function onNoteSaved() {
  noteOpen.value = false
  await loadNotes()
}
async function removeNote(note) {
  if (!confirm(`Supprimer la note « ${note.titre} » ?`)) return
  try {
    await api.delete(`/projet_notes/${note.id}`)
    await loadNotes()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Actions ----------
const formOpen = ref(false)
const logoOpen = ref(false)
async function onSaved() {
  formOpen.value = false
  logoOpen.value = false
  await load()
}
async function favorite() {
  try {
    const { data } = await toggleProjetFavorite(projet.value.id)
    projet.value.favorite = data?.data?.favorite ?? !projet.value.favorite
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Devis : création depuis le projet (la référence est calculée par Dash3) ----------
const devisFields = [
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    required: true,
    placeholder: 'Objet du devis',
    presets: ['Fourniture, Tirage, pose et connexion', "Extraction d'images", 'Tirage de cables'],
  },
  {
    name: 'modalite',
    label: 'Modalités de paiement',
    placeholder: 'Ex : 60 % à la commande, 40 % à la livraison',
    presets: [
      '60% à la commande et 40% à la livraison',
      '100% du matériel à la commande et le reliquat à la livraison',
      'Paiement complet avant exécution des travaux',
    ],
  },
  { name: 'note', label: 'Note', type: 'textarea' },
]
const devisOpen = ref(false)
let createdDevis = null
const submitDevis = async (v) => {
  createdDevis = await createDevis({ ...v, projet_id: Number(id.value) })
}
function onDevisCreated() {
  devisOpen.value = false
  if (createdDevis?.id) router.push({ name: 'devis', params: { id: createdDevis.id } })
}

// ---------- Journaux : ajout, modification, suppression ----------
const journalFields = [
  { name: 'title', label: 'Titre', required: true, col: 'col-md-8' },
  { name: 'date', label: 'Date', type: 'date', required: true, col: 'col-md-4', default: new Date().toISOString().slice(0, 10) },
  { name: 'type', label: 'Type', placeholder: 'Visite, réunion, intervention…' },
  { name: 'description', label: 'Description', type: 'textarea' },
]
const journalOpen = ref(false)
const editingJournal = ref(null)
function openJournal(j = null) {
  editingJournal.value = j
  journalOpen.value = true
}
const submitJournal = (v) => saveJournal(editingJournal.value ? v : { ...v, projet_id: Number(id.value) }, editingJournal.value?.id)
async function onJournalSaved() {
  journalOpen.value = false
  await load()
}
async function removeJournal(j) {
  if (!confirm(`Supprimer le journal « ${j.title} » ?`)) return
  try {
    await deleteJournal(j.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}
const sortedJournals = computed(() => [...(projet.value?.journals ?? [])].sort((a, b) => String(b.date).localeCompare(String(a.date))))

// ---------- Avancement : tâches terminées / total ----------
const progress = computed(() => {
  const all = projet.value?.tasks ?? []
  if (!all.length) return null
  const done = all.filter((t) => Number(t.statut_id) >= 4).length
  return { done, total: all.length, percent: Math.round((done / all.length) * 100) }
})
</script>

<template>
  <PageHeader :title="projet ? `Projet: ${projet.name}` : 'Projet'" :breadcrumbs="breadcrumbs" :loading="loading">
    <template #actions>
      <div v-if="projet" class="btn-list">
        <button class="btn btn-icon" title="Actualiser" @click="load"><i class="ti ti-reload"></i></button>
        <button
          class="btn btn-icon"
          :class="projet.favorite ? 'btn-ghost-danger' : 'btn-ghost-secondary'"
          :title="projet.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'"
          @click="favorite"
        >
          <i :class="['ti', projet.favorite ? 'ti-star-filled' : 'ti-star']"></i>
        </button>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <!-- Squelette pendant le premier chargement -->
      <div v-if="loading && !projet" class="row mb-3">
        <div class="col-md-4">
          <div class="card placeholder-glow">
            <div class="card-body">
              <div class="placeholder col-7 mb-3"></div>
              <div class="placeholder col-9 mb-2"></div>
              <div class="placeholder col-5 mb-2"></div>
              <div class="placeholder col-8"></div>
            </div>
          </div>
        </div>
        <div class="col-md-8">
          <div class="card placeholder-glow">
            <div class="card-body">
              <div class="placeholder col-12 mb-3" style="height: 2rem"></div>
              <div class="placeholder col-10 mb-2"></div>
              <div class="placeholder col-7 mb-2"></div>
              <div class="placeholder col-9"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="projet" class="row mb-3">
        <!-- Colonne gauche : résumé + bâtiments -->
        <div class="col-md-4">
          <div class="card mb-3">
            <div class="border rounded p-2">
              <div class="row align-items-center">
                <div class="col-auto">
                  <img class="avatar avatar-md rounded-2 border p-1" :src="projet.img" alt="" style="object-fit: contain" />
                </div>
                <div class="col text-center"><h3 class="fw-bold m-0">RESUME DU PROJET</h3></div>
                <div class="col-auto">
                  <div class="dropdown">
                    <button class="btn btn-action border" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions">
                      <i class="ti ti-dots-vertical"></i>
                    </button>
                    <div class="dropdown-menu dropdown-menu-end">
                      <button class="dropdown-item" type="button" @click="formOpen = true"><i class="ti ti-edit"></i> Éditer</button>
                      <button class="dropdown-item" type="button" @click="logoOpen = true"><i class="ti ti-photo-edit"></i> Éditer le logo</button>
                      <button class="dropdown-item" type="button" @click="favorite">
                        <span v-if="projet.favorite" class="text-danger"><i class="ti ti-heart-filled"></i> Favoris</span>
                        <span v-else class="text-muted"><i class="ti ti-heart"></i> Favoris</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="card-body">
              <div class="datagrid">
                <div class="datagrid-item">
                  <div class="datagrid-title">Client</div>
                  <div class="datagrid-content">
                    <RouterLink :to="{ name: 'projets', query: { client_id: projet.client_id } }">{{ projet.client_name }}</RouterLink>
                  </div>
                </div>
                <div class="datagrid-item">
                  <div class="datagrid-title">Début</div>
                  <div class="datagrid-content">{{ formatDate(projet.start_date) }}</div>
                </div>
                <div class="datagrid-item">
                  <div class="datagrid-title">Fin</div>
                  <div class="datagrid-content">{{ formatDate(projet.end_date) }}</div>
                </div>
              </div>
              <!-- Avancement des tâches -->
              <div v-if="progress" class="mt-3">
                <div class="d-flex mb-1 small">
                  <span class="text-secondary">Avancement des tâches</span>
                  <span class="ms-auto fw-medium">{{ progress.done }}/{{ progress.total }}</span>
                </div>
                <div class="progress progress-sm">
                  <div
                    class="progress-bar"
                    :class="progress.percent === 100 ? 'bg-success' : 'bg-primary'"
                    :style="{ width: progress.percent + '%' }"
                    role="progressbar"
                    :aria-valuenow="progress.percent"
                    :aria-label="`${progress.percent} %`"
                  ></div>
                </div>
              </div>
              <div v-if="projet.description" class="mt-3 description">{{ projet.description }}</div>
            </div>

            <!-- Onglets du projet, avec leurs quantités -->
            <div class="projet-tabs border-top">
              <button
                v-for="t in tabs"
                :key="t.key"
                type="button"
                class="projet-tab"
                :class="{ active: tab === t.key }"
                :title="t.hint || t.label"
                :aria-pressed="tab === t.key"
                @click="tab = t.key"
              >
                <i :class="['ti', t.icon]"></i>
                <span class="label">{{ t.label }}</span>
                <span class="count">{{ t.count ?? '—' }}</span>
              </button>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><i class="ti ti-building"></i>Bâtiments</h3>
              <button class="btn btn-sm ms-auto" title="Gérer les bâtiments" @click="tab = 'installations'"><i class="ti ti-settings"></i></button>
            </div>
            <div class="list-group list-group-flush">
              <div v-if="!projet.buildings?.length" class="list-group-item text-secondary">
                Aucun bâtiment.
                <a href="#" @click.prevent="tab = 'installations'">En ajouter un</a>
              </div>
              <RouterLink
                v-for="b in projet.buildings"
                :key="b.id"
                :to="{ name: 'batiment', params: { id, buildingId: b.id } }"
                class="list-group-item list-group-item-action d-flex align-items-center"
              >
                <div class="min-w-0">
                  <div class="fw-medium">{{ b.name }}</div>
                  <div v-if="b.description" class="text-secondary small text-truncate">{{ b.description }}</div>
                </div>
                <i class="ti ti-chevron-right ms-auto text-secondary"></i>
              </RouterLink>
            </div>
          </div>

          <!-- Localisation (aussi lue par Dash3Mobile) -->
          <LocationCard
            class="mt-3"
            :address="projet.address || ''"
            :latitude="projet.latitude"
            :longitude="projet.longitude"
            :save="saveLocation"
          />
        </div>

        <!-- Colonne droite : onglets -->
        <div class="col-md-8">
          <h3 v-if="activeTab" class="d-flex align-items-center gap-2 mb-2">
            <i :class="['ti text-primary', activeTab.icon]"></i>{{ activeTab.label }}
            <span v-if="activeTab.count" class="badge bg-primary-lt">{{ activeTab.count }}</span>
          </h3>

          <!-- Devis : consultation, création ; modification dans la page devis -->
          <div v-if="tab === 'devis'" class="card">
            <div class="card-header">
              <h3 class="card-title">Devis</h3>
              <button class="btn btn-primary btn-sm ms-auto" @click="devisOpen = true"><i class="ti ti-plus"></i> Devis</button>
            </div>
            <div class="table-responsive">
              <table class="table table-vcenter card-table">
                <thead><tr><th>Référence</th><th>Description</th><th>Montant</th><th>Paiement</th><th>Statut</th><th class="w-1"></th></tr></thead>
                <tbody>
                  <tr v-if="!projet.invoices?.length"><td colspan="6" class="text-center text-secondary py-3">Aucun devis</td></tr>
                  <tr v-for="d in projet.invoices" :key="d.id">
                    <td class="fw-medium"><RouterLink :to="{ name: 'devis', params: { id: d.id } }">{{ d.reference }}</RouterLink></td>
                    <td class="text-secondary">{{ d.description }}</td>
                    <td class="text-nowrap">{{ formatAmount(d.total) }}</td>
                    <td class="text-nowrap" :title="'Date de paiement'">{{ formatDate(d.paydate) }}</td>
                    <td><span v-if="d.statut" class="badge bg-blue-lt">{{ d.statut }}</span></td>
                    <td>
                      <RouterLink :to="{ name: 'devis', params: { id: d.id } }" class="btn btn-icon btn-ghost-primary" title="Ouvrir et modifier">
                        <i class="ti ti-edit"></i>
                      </RouterLink>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Tâches -->
          <TaskList
            v-else-if="tab === 'taches'"
            :tasks="projet.tasks ?? []"
            :projet="projet"
            :client="projet.client_id ? { id: projet.client_id, name: projet.client_name } : null"
            :defaults="{ projet_id: projet.id, client_id: projet.client_id }"
            @changed="load"
          />

          <!-- Contacts -->
          <ContactsGrid v-else-if="tab === 'contacts'" :contacts="projet.contacts ?? []" :defaults="{ projet_id: projet.id }" @changed="load" />

          <!-- Notes -->
          <div v-else-if="tab === 'notes'">
            <div class="d-flex mb-2">
              <button class="btn btn-primary ms-auto" @click="openNote()"><i class="ti ti-plus"></i> Note</button>
            </div>
            <div v-if="!notesLoaded" class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></div>
            <div v-else-if="!notes.length" class="card card-body text-secondary">Aucune note</div>
            <div class="row g-2">
              <div v-for="n in notes" :key="n.id" class="col-md-6">
                <div class="card">
                  <div class="card-header">
                    <h4 class="card-title">{{ n.titre }}</h4>
                    <div class="card-actions">
                      <div class="dropdown">
                        <button class="btn btn-action" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Actions">
                          <i class="ti ti-dots-vertical"></i>
                        </button>
                        <div class="dropdown-menu dropdown-menu-end">
                          <button class="dropdown-item" type="button" @click="openNote(n)"><i class="ti ti-edit"></i> Éditer</button>
                          <button class="dropdown-item text-danger" type="button" @click="removeNote(n)"><i class="ti ti-trash"></i> Supprimer</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="card-body text-secondary description">{{ n.description }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Journaux : cartes au style de Dash3 -->
          <div v-else-if="tab === 'journaux'">
            <div class="d-flex mb-2">
              <button class="btn btn-primary ms-auto" @click="openJournal()"><i class="ti ti-plus"></i> Journal</button>
            </div>
            <div v-if="!sortedJournals.length" class="card card-body text-secondary">Aucun journal</div>
            <div class="row g-2">
              <div v-for="j in sortedJournals" :key="j.id" class="col-md-6">
                <JournalCard :journal="{ ...j, projet: { id: projet.id, name: projet.name, client: projet.client_id ? { id: projet.client_id, name: projet.client_name } : null } }" @edit="openJournal(j)" @delete="removeJournal(j)" />
              </div>
            </div>
          </div>

          <!-- Badges -->
          <BadgesManager v-else-if="tab === 'badges'" :key="`badges-${id}`" :projet="projet" @changed="(n) => (badgesCount = n)" />

          <!-- Installations : bâtiments › systèmes › équipements, plans -->
          <InstallationsTab v-else-if="tab === 'installations'" :key="`inst-${id}`" :projet-id="id" />

          <!-- Documents de tout type -->
          <ProjetDocuments v-else-if="tab === 'documents'" :key="`docs-${id}`" :projet-id="id" @changed="(n) => (documentsCount = n)" />
        </div>
      </div>
    </div>
  </div>

  <ProjetFormModal :show="formOpen" :projet="projet" @close="formOpen = false" @saved="onSaved" />
  <NamedFormModal
    :show="noteOpen"
    :title="editingNote ? 'Modifier la note' : 'Ajouter une note'"
    :fields="noteFields"
    :initial="editingNote"
    :submit="saveNote"
    @close="noteOpen = false"
    @saved="onNoteSaved"
  />
  <NamedFormModal
    :show="devisOpen"
    title="Nouveau devis"
    :fields="devisFields"
    :submit="submitDevis"
    @close="devisOpen = false"
    @saved="onDevisCreated"
  />
  <NamedFormModal
    :show="journalOpen"
    :title="editingJournal ? 'Modifier le journal' : 'Ajouter un journal'"
    :fields="journalFields"
    :initial="editingJournal"
    :submit="submitJournal"
    @close="journalOpen = false"
    @saved="onJournalSaved"
  />
  <ImageUploadModal
    :show="logoOpen"
    title="Éditer le logo du projet"
    :endpoint="projet ? `/projets/${projet.id}/logo` : ''"
    :current="projet?.img"
    @close="logoOpen = false"
    @saved="onSaved"
  />
</template>

<style scoped>
.description {
  white-space: pre-line;
}
/* Onglets dans la carte résumé : grille de raccourcis avec quantités */
.projet-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}
.projet-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 0.5rem 0.25rem;
  border: 0;
  border-right: 1px solid var(--tblr-border-color);
  border-bottom: 1px solid var(--tblr-border-color);
  background: transparent;
  color: var(--tblr-secondary);
  font-size: 0.75rem;
  line-height: 1.2;
}
.projet-tab:nth-child(4n) {
  border-right: 0;
}
.projet-tab:nth-last-child(-n + 4) {
  border-bottom: 0;
}
.projet-tab .ti {
  font-size: 1.15rem;
}
.projet-tab .count {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--tblr-body-color);
}
.projet-tab:hover {
  background: var(--tblr-bg-surface-secondary);
}
.projet-tab.active {
  background: var(--tblr-primary-lt);
  color: var(--tblr-primary);
}
.projet-tab.active .count {
  color: var(--tblr-primary);
}
</style>
