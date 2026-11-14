<script setup>
/**
 * Page Projet, reprise de livewire/erp/projet-page.blade.php :
 * résumé du projet et bâtiments à gauche, onglets segmentés à droite.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { errorMessage } from '@/api/client'
import { createDevis, deleteJournal, formatDate, getProjet, projetBadges, saveJournal, toggleProjetFavorite } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'
import ProjetFormModal from '@/components/forms/ProjetFormModal.vue'
import ImageUploadModal from '@/components/ImageUploadModal.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import InstallationsTab from '@/components/InstallationsTab.vue'
import TaskList from '@/components/erp/TaskList.vue'
import ContactsGrid from '@/components/erp/ContactsGrid.vue'
import ProjetDocuments from '@/components/erp/ProjetDocuments.vue'

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
  badgesLoaded.value = notesLoaded.value = false
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
const tabs = computed(() => [
  { key: 'devis', label: 'Devis', count: projet.value?.invoices?.length },
  { key: 'taches', label: 'Tâches', count: pendingTasks.value },
  { key: 'contacts', label: 'Contacts', count: projet.value?.contacts?.length },
  { key: 'badges', label: 'Badges', count: badgesLoaded.value ? badges.value.length : null },
  { key: 'notes', label: 'Notes', count: notesLoaded.value ? notes.value.length : null },
  { key: 'journaux', label: 'Journaux', count: projet.value?.journals?.length },
  { key: 'documents', label: 'Documents', count: null },
  { key: 'installations', label: 'Installations', count: projet.value?.buildings?.length },
])

const badges = ref([])
const badgesLoaded = ref(false)
watch(tab, async (t) => {
  if (t !== 'badges' || badgesLoaded.value) return
  try {
    badges.value = await projetBadges(id.value)
  } catch (e) {
    error.value = errorMessage(e)
  }
  badgesLoaded.value = true
})

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
  { name: 'description', label: 'Description', type: 'textarea', required: true, placeholder: 'Objet du devis' },
  { name: 'modalite', label: 'Modalités de paiement', placeholder: 'Ex : 60 % à la commande, 40 % à la livraison' },
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
                  <div class="datagrid-title">Devis</div>
                  <div class="datagrid-content">{{ projet.invoices?.length ?? 0 }}</div>
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
        </div>

        <!-- Colonne droite : onglets -->
        <div class="col-md-8">
          <nav class="nav nav-segmented w-100 mb-2 border" role="tablist">
            <button
              v-for="t in tabs"
              :key="t.key"
              class="nav-link"
              :class="{ active: tab === t.key }"
              role="tab"
              :aria-selected="tab === t.key"
              @click="tab = t.key"
            >
              {{ t.label }}
              <span v-if="t.count" class="badge bg-primary-lt ms-1">{{ t.count }}</span>
            </button>
          </nav>

          <!-- Devis : consultation, création ; modification dans la page devis -->
          <div v-if="tab === 'devis'" class="card">
            <div class="card-header">
              <h3 class="card-title">Devis</h3>
              <button class="btn btn-primary btn-sm ms-auto" @click="devisOpen = true"><i class="ti ti-plus"></i> Devis</button>
            </div>
            <div class="table-responsive">
              <table class="table table-vcenter card-table">
                <thead><tr><th>Référence</th><th>Description</th><th>Statut</th><th class="w-1"></th></tr></thead>
                <tbody>
                  <tr v-if="!projet.invoices?.length"><td colspan="4" class="text-center text-secondary py-3">Aucun devis</td></tr>
                  <tr v-for="d in projet.invoices" :key="d.id">
                    <td class="fw-medium"><RouterLink :to="{ name: 'devis', params: { id: d.id } }">{{ d.reference }}</RouterLink></td>
                    <td class="text-secondary">{{ d.description }}</td>
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

          <!-- Journaux : frise chronologique -->
          <div v-else-if="tab === 'journaux'" class="card">
            <div class="card-header">
              <h3 class="card-title">Journaux</h3>
              <button class="btn btn-primary btn-sm ms-auto" @click="openJournal()"><i class="ti ti-plus"></i> Journal</button>
            </div>
            <div class="card-body">
              <div v-if="!sortedJournals.length" class="text-secondary">Aucun journal</div>
              <div v-else class="list list-timeline">
                <div v-for="j in sortedJournals" :key="j.id" class="list-timeline-item">
                  <div class="list-timeline-time text-nowrap">{{ formatDate(j.date) }}</div>
                  <div class="list-timeline-icon bg-primary"><i class="ti ti-notebook"></i></div>
                  <div class="list-timeline-content">
                    <div class="d-flex align-items-start">
                      <div class="min-w-0">
                        <div class="fw-bold">
                          {{ j.title }}
                          <span v-if="j.type" class="badge bg-azure-lt ms-1">{{ j.type }}</span>
                        </div>
                        <div v-if="j.description" class="text-secondary description">{{ j.description }}</div>
                      </div>
                      <div class="ms-auto dropdown">
                        <button class="btn btn-action" type="button" data-bs-toggle="dropdown" aria-label="Actions"><i class="ti ti-dots-vertical"></i></button>
                        <div class="dropdown-menu dropdown-menu-end">
                          <button class="dropdown-item" type="button" @click="openJournal(j)"><i class="ti ti-edit"></i> Éditer</button>
                          <button class="dropdown-item text-danger" type="button" @click="removeJournal(j)"><i class="ti ti-trash"></i> Supprimer</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Badges -->
          <div v-else-if="tab === 'badges'">
            <div v-if="!badgesLoaded" class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></div>
            <div v-else-if="!badges.length" class="card card-body text-secondary">Aucun badge</div>
            <div class="row g-2">
              <div v-for="b in badges" :key="b.id" class="col-md-4">
                <div class="card card-sm">
                  <div class="card-body text-center">
                    <span class="avatar avatar-lg rounded-2 mb-2" :style="b.photo ? { backgroundImage: `url(${b.photo})` } : null">
                      <i v-if="!b.photo" class="ti ti-id-badge-2"></i>
                    </span>
                    <div class="fw-bold">{{ [b.prenom, b.nom].filter(Boolean).join(' ') }}</div>
                    <div class="text-secondary small">{{ b.fonction }}</div>
                    <div class="text-secondary small">{{ [b.service, b.direction].filter(Boolean).join(' · ') }}</div>
                    <div v-if="b.matricule" class="badge bg-blue-lt mt-1">{{ b.matricule }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Installations : bâtiments › systèmes › équipements, plans -->
          <InstallationsTab v-else-if="tab === 'installations'" :key="`inst-${id}`" :projet-id="id" />

          <!-- Documents de tout type -->
          <ProjetDocuments v-else-if="tab === 'documents'" :key="`docs-${id}`" :projet-id="id" />
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
</style>
