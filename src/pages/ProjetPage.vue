<script setup>
/**
 * Page Projet, reprise de livewire/erp/projet-page.blade.php :
 * résumé du projet et bâtiments à gauche, onglets segmentés à droite.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api, { errorMessage } from '@/api/client'
import { formatDate, getProjet, projetBadges, toggleProjetFavorite } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'
import ProjetFormModal from '@/components/forms/ProjetFormModal.vue'
import ImageUploadModal from '@/components/ImageUploadModal.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import InstallationsTab from '@/components/InstallationsTab.vue'

const route = useRoute()
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
  tab.value = 'devis'
  load()
})

const breadcrumbs = computed(() => [
  { name: 'ERP' },
  { name: 'Clients', to: { name: 'clients' } },
  { name: projet.value?.client_name || 'Client', to: projet.value ? { name: 'projets', query: { client_id: projet.value.client_id } } : null },
  { name: projet.value?.name || 'Projet' },
])

// ---------- Onglets ----------
const tabs = [
  { key: 'devis', label: 'Devis' },
  { key: 'taches', label: 'Taches' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'badges', label: 'Badges' },
  { key: 'notes', label: 'Notes' },
  { key: 'journaux', label: 'Journaux' },
  { key: 'documents', label: 'Documents' },
  { key: 'installations', label: 'Installations' },
]
const tab = ref('devis')

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

const statusBadge = (s) => ({ 1: 'bg-primary', 2: 'bg-warning', 3: 'bg-secondary', 4: 'bg-success' })[s] || 'bg-secondary'
const statusName = (s) => ({ 1: 'Nouveau', 2: 'En cours', 3: 'En pause', 4: 'Terminé', 5: 'Clôturé' })[s] || '—'
const contactName = (c) => [c.firstname, c.lastname].filter(Boolean).join(' ') || c.societe || '—'
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
              <div v-if="projet.description" class="mt-3 description">{{ projet.description }}</div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3 class="card-title"><i class="ti ti-building"></i>Bâtiments</h3></div>
            <div class="list-group list-group-flush">
              <div v-if="!projet.buildings?.length" class="list-group-item text-secondary">Aucun bâtiment</div>
              <div v-for="b in projet.buildings" :key="b.id" class="list-group-item">
                <div class="fw-medium">{{ b.name }}</div>
                <div v-if="b.description" class="text-secondary small">{{ b.description }}</div>
              </div>
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
            </button>
          </nav>

          <!-- Devis -->
          <div v-if="tab === 'devis'" class="card">
            <div class="table-responsive">
              <table class="table table-vcenter card-table">
                <thead><tr><th>Référence</th><th>Description</th><th>Statut</th></tr></thead>
                <tbody>
                  <tr v-if="!projet.invoices?.length"><td colspan="3" class="text-center text-secondary py-3">Aucun devis</td></tr>
                  <tr v-for="d in projet.invoices" :key="d.id">
                    <td class="fw-medium">{{ d.reference }}</td>
                    <td class="text-secondary">{{ d.description }}</td>
                    <td><span v-if="d.statut" class="badge bg-blue-lt">{{ d.statut }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Tâches -->
          <div v-else-if="tab === 'taches'" class="card">
            <div class="list-group list-group-flush">
              <div v-if="!projet.tasks?.length" class="list-group-item text-secondary">Aucune tâche</div>
              <div v-for="t in projet.tasks" :key="t.id" class="list-group-item">
                <div class="row align-items-center">
                  <div class="col">
                    <div class="fw-medium">{{ t.name }}</div>
                    <div v-if="t.description" class="text-secondary small text-truncate">{{ t.description }}</div>
                  </div>
                  <div class="col-auto text-secondary small">{{ formatDate(t.expiration_date) }}</div>
                  <div class="col-auto"><span class="badge text-white" :class="statusBadge(t.statut_id)">{{ statusName(t.statut_id) }}</span></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Contacts -->
          <div v-else-if="tab === 'contacts'" class="border border-primary p-2 rounded">
            <div v-if="!projet.contacts?.length" class="text-secondary p-2">Aucun contact</div>
            <div class="row g-2">
              <div v-for="c in projet.contacts" :key="c.id" class="col-md-6">
                <div class="card card-sm">
                  <div class="card-body">
                    <div class="fw-bold">{{ contactName(c) }}</div>
                    <div class="text-secondary small">{{ [c.fonction, c.societe].filter(Boolean).join(' · ') }}</div>
                    <div class="mt-1 small">
                      <a v-if="c.phone" :href="`tel:${c.phone}`" class="me-2"><i class="ti ti-phone"></i>{{ c.phone }}</a>
                      <a v-if="c.email" :href="`mailto:${c.email}`"><i class="ti ti-mail"></i>{{ c.email }}</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

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

          <!-- Journaux -->
          <div v-else-if="tab === 'journaux'" class="row g-2">
            <div v-if="!projet.journals?.length" class="col-12"><div class="card card-body text-secondary">Aucun journal</div></div>
            <div v-for="j in projet.journals" :key="j.id" class="col-md-6">
              <div class="card">
                <div class="card-body">
                  <div class="d-flex">
                    <h4 class="card-title mb-1">{{ j.title }}</h4>
                    <span class="ms-auto text-secondary small">{{ formatDate(j.date) }}</span>
                  </div>
                  <div class="text-secondary description">{{ j.description }}</div>
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

          <!-- Documents : à venir -->
          <div v-else class="card card-body text-center text-secondary">
            <i class="ti ti-tools" style="font-size: 2rem"></i>
            <div class="mt-2">{{ tabs.find((t) => t.key === tab)?.label }} : à venir.</div>
          </div>
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
