<script setup>
/**
 * Page Journal, reprise de livewire/journal-page.blade.php :
 * informations, intervenants (contacts du projet et équipe), devis et tâches,
 * sections composées d'un titre, d'une description en markdown et de photos.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { errorMessage } from '@/api/client'
import {
  addIntervenant,
  captionJournalImage,
  attachJournalDevis,
  detachJournalDevis,
  journalDevisOptions,
  deleteJournalImage,
  deleteJournalSection,
  formatDate,
  getJournal,
  journalOptions,
  removeIntervenant,
  saveJournal,
  saveJournalSection,
  uploadSectionImages,
} from '@/api/dash3'
import { renderMarkdown } from '@/utils/markdown'
import PageHeader from '@/components/PageHeader.vue'
import AppModal from '@/components/AppModal.vue'
import ImageEditModal from '@/components/ImageEditModal.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import MarkdownEditor from '@/components/erp/MarkdownEditor.vue'
import TaskList from '@/components/erp/TaskList.vue'

const route = useRoute()
const id = computed(() => route.params.id)

const journal = ref(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    journal.value = await getJournal(id.value)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(id, load)

const breadcrumbs = computed(() => {
  const p = journal.value?.projet
  return [
    { name: 'ERP' },
    { name: 'Journaux', to: { name: 'journaux' } },
    p ? { name: p.name, to: { name: 'projet', params: { id: p.id }, query: { tab: 'journaux' } } } : null,
    { name: journal.value?.title || 'Journal' },
  ].filter(Boolean)
})

// ---------- Informations ----------
const journalFields = [
  { name: 'title', label: 'Titre', required: true, col: 'col-md-8' },
  { name: 'date', label: 'Date', type: 'date', required: true, col: 'col-md-4' },
  { name: 'type', label: 'Type', placeholder: 'Visite, réunion, intervention…' },
  { name: 'description', label: 'Description', type: 'textarea' },
]
const formOpen = ref(false)
const submitJournal = (v) => saveJournal(v, journal.value.id)
async function onJournalSaved() {
  formOpen.value = false
  await load()
}

// ---------- Intervenants ----------
const options = ref({ contacts: [], team: [] })
const intervenantOpen = ref(false)
const picked = ref('')
const saving = ref(false)
async function openIntervenants() {
  picked.value = ''
  intervenantOpen.value = true
  try {
    options.value = await journalOptions(id.value)
  } catch (e) {
    error.value = errorMessage(e)
  }
}
const intervenantName = (i) => {
  const p = i.contact || i.team
  return p ? [p.firstname, p.lastname].filter(Boolean).join(' ') : '—'
}
const intervenantRole = (i) => i.contact?.fonction || i.contact?.societe || i.team?.function || (i.team ? 'Équipe' : '')
async function addPicked() {
  if (!picked.value) return
  const [kind, value] = picked.value.split(':')
  saving.value = true
  try {
    await addIntervenant(id.value, kind === 'contact' ? { contact_id: Number(value) } : { team_id: Number(value) })
    intervenantOpen.value = false
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}
async function dropIntervenant(i) {
  if (!confirm(`Retirer ${intervenantName(i)} des intervenants ?`)) return
  try {
    await removeIntervenant(i.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Sections : titre, description markdown, photos ----------
const sectionOpen = ref(false)
const editingSection = ref(null)
const sectionForm = ref({ name: '', description: '' })
const sectionSaving = ref(false)
const sectionError = ref('')
function openSection(s = null) {
  editingSection.value = s
  sectionForm.value = { name: s?.name ?? '', description: s?.description ?? '' }
  sectionError.value = ''
  sectionOpen.value = true
}
async function submitSection() {
  const f = sectionForm.value
  if (!f.name.trim()) return
  sectionSaving.value = true
  sectionError.value = ''
  try {
    await saveJournalSection(editingSection.value ? { ...f } : { ...f, journal_id: Number(id.value) }, editingSection.value?.id)
    sectionOpen.value = false
    await load()
  } catch (e) {
    sectionError.value = errorMessage(e)
  } finally {
    sectionSaving.value = false
  }
}
async function removeSection(s) {
  if (!confirm(`Supprimer la section « ${s.name} » et ses photos ?`)) return
  try {
    await deleteJournalSection(s.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// Photos d'une section
const uploadingFor = ref(null)
const fileInput = ref(null)
const pendingSection = ref(null)
function pickPhotos(s) {
  pendingSection.value = s
  fileInput.value.click()
}
async function onPhotos(ev) {
  const files = Array.from(ev.target.files || [])
  ev.target.value = ''
  const s = pendingSection.value
  if (!files.length || !s) return
  uploadingFor.value = s.id
  try {
    s.images = await uploadSectionImages(s.id, files)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    uploadingFor.value = null
  }
}
/** Légende affichée sous la photo, reprise dans le rapport PDF */
async function editCaption(img) {
  const caption = prompt('Légende de la photo :', img.caption || '')
  if (caption === null) return
  try {
    await captionJournalImage(img.id, caption.trim())
    img.caption = caption.trim()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

async function removePhoto(s, img) {
  if (!confirm('Supprimer cette photo ?')) return
  try {
    await deleteJournalImage(img.id)
    s.images = s.images.filter((x) => x.id !== img.id)
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Devis rattachés ----------
const devisOpen = ref(false)
const devisOptions = ref([])
const pickedDevis = ref('')
const devisSaving = ref(false)
async function openDevis() {
  pickedDevis.value = ''
  devisOpen.value = true
  try {
    const liees = new Set((journal.value.invoices ?? []).map((d) => d.id))
    devisOptions.value = (await journalDevisOptions(id.value)).filter((d) => !liees.has(d.id))
  } catch (e) {
    error.value = errorMessage(e)
  }
}
async function addDevis() {
  if (!pickedDevis.value) return
  devisSaving.value = true
  try {
    await attachJournalDevis(id.value, Number(pickedDevis.value))
    devisOpen.value = false
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    devisSaving.value = false
  }
}
async function removeDevis(d) {
  if (!confirm(`Détacher le devis ${d.reference} de ce journal ?`)) return
  try {
    await detachJournalDevis(id.value, d.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

const viewer = ref(null)

// Retouche d'une photo (rogner, pivoter, redimensionner)
const editingPhoto = ref(null)
async function onPhotoEdited() {
  editingPhoto.value = null
  await load()
}
</script>

<template>
  <PageHeader :title="journal ? journal.title : 'Journal'" :breadcrumbs="breadcrumbs" :loading="loading">
    <template #actions>
      <div v-if="journal" class="btn-list">
        <button class="btn btn-icon" title="Actualiser" @click="load"><i class="ti ti-reload"></i></button>
        <button class="btn" @click="formOpen = true"><i class="ti ti-edit"></i> Modifier</button>
        <button class="btn btn-primary" @click="openSection()"><i class="ti ti-plus"></i> Section</button>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-if="journal" class="row g-3">
        <!-- Informations, intervenants, devis -->
        <div class="col-lg-4">
          <div class="card mb-3">
            <div class="card-header"><h3 class="card-title"><i class="ti ti-notebook text-primary"></i>Informations</h3></div>
            <div class="card-body">
              <div class="datagrid">
                <div class="datagrid-item">
                  <div class="datagrid-title">Date</div>
                  <div class="datagrid-content">{{ formatDate(journal.date) }}</div>
                </div>
                <div class="datagrid-item">
                  <div class="datagrid-title">Type</div>
                  <div class="datagrid-content">{{ journal.type || '—' }}</div>
                </div>
                <div class="datagrid-item">
                  <div class="datagrid-title">Client</div>
                  <div class="datagrid-content">
                    <RouterLink v-if="journal.projet?.client" :to="{ name: 'projets', query: { client_id: journal.projet.client.id } }">
                      {{ journal.projet.client.name }}
                    </RouterLink>
                    <span v-else>—</span>
                  </div>
                </div>
                <div class="datagrid-item">
                  <div class="datagrid-title">Projet</div>
                  <div class="datagrid-content">
                    <RouterLink v-if="journal.projet" :to="{ name: 'projet', params: { id: journal.projet.id } }">{{ journal.projet.name }}</RouterLink>
                    <span v-else>—</span>
                  </div>
                </div>
              </div>
              <div v-if="journal.description" class="mt-3 text-secondary description">{{ journal.description }}</div>
            </div>
          </div>

          <div class="card mb-3">
            <div class="card-header">
              <h3 class="card-title"><i class="ti ti-users text-primary"></i>Intervenants</h3>
              <button class="btn btn-sm btn-ghost-primary ms-auto" @click="openIntervenants"><i class="ti ti-plus"></i> Ajouter</button>
            </div>
            <div class="list-group list-group-flush">
              <div v-if="!journal.intervenants?.length" class="list-group-item text-secondary small">Aucun intervenant</div>
              <div v-for="i in journal.intervenants" :key="i.id" class="list-group-item d-flex align-items-center gap-2">
                <span class="avatar avatar-sm rounded-circle" :class="i.team ? 'bg-azure-lt' : 'bg-primary-lt'">
                  <i :class="['ti', i.team ? 'ti-user-check' : 'ti-user']"></i>
                </span>
                <div class="min-w-0">
                  <div class="fw-medium text-truncate">{{ intervenantName(i) }}</div>
                  <div class="text-secondary small text-truncate">{{ intervenantRole(i) }}</div>
                </div>
                <div class="ms-auto d-flex align-items-center">
                  <a v-if="i.contact?.phone" :href="`tel:${i.contact.phone}`" class="btn btn-icon btn-ghost-secondary" title="Appeler"><i class="ti ti-phone"></i></a>
                  <button class="btn btn-icon btn-ghost-danger" title="Retirer" @click="dropIntervenant(i)"><i class="ti ti-x"></i></button>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><i class="ti ti-file-invoice text-primary"></i>Devis</h3>
              <button class="btn btn-sm btn-ghost-primary ms-auto" @click="openDevis"><i class="ti ti-plus"></i> Lier</button>
            </div>
            <div class="list-group list-group-flush">
              <div v-if="!journal.invoices?.length" class="list-group-item text-secondary small">Aucun devis rattaché</div>
              <div v-for="d in journal.invoices" :key="d.id" class="list-group-item d-flex align-items-center">
                <RouterLink :to="{ name: 'devis', params: { id: d.id } }" class="min-w-0 text-reset">
                  <div class="fw-medium">
                    {{ d.reference }}
                    <span v-if="d.statut" class="badge bg-blue-lt ms-1">{{ d.statut }}</span>
                  </div>
                  <div class="text-secondary small text-truncate">{{ d.description }}</div>
                </RouterLink>
                <button class="btn btn-icon btn-ghost-danger ms-auto" title="Détacher" @click="removeDevis(d)"><i class="ti ti-unlink"></i></button>
              </div>
            </div>
          </div>
        </div>

        <!-- Sections et tâches -->
        <div class="col-lg-8">
          <div v-if="!journal.sections?.length" class="card card-body text-secondary text-center mb-3">
            Aucune section. Ajoutez-en une pour décrire l'intervention et joindre des photos.
          </div>

          <div v-for="s in journal.sections" :key="s.id" class="card mb-3">
            <div class="card-header">
              <h3 class="card-title">{{ s.name }}</h3>
              <div class="card-actions btn-list">
                <button class="btn btn-sm" :disabled="uploadingFor === s.id" @click="pickPhotos(s)">
                  <span v-if="uploadingFor === s.id" class="spinner-border spinner-border-sm me-1"></span>
                  <i v-else class="ti ti-camera"></i> Photos
                </button>
                <div class="dropdown">
                  <button class="btn btn-sm btn-action" type="button" data-bs-toggle="dropdown" aria-label="Actions"><i class="ti ti-dots-vertical"></i></button>
                  <div class="dropdown-menu dropdown-menu-end">
                    <button class="dropdown-item" type="button" @click="openSection(s)"><i class="ti ti-edit me-1"></i> Modifier</button>
                    <button class="dropdown-item text-danger" type="button" @click="removeSection(s)"><i class="ti ti-trash me-1"></i> Supprimer</button>
                  </div>
                </div>
              </div>
            </div>
            <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown échappe le texte avant le rendu -->
            <div v-if="s.description" class="card-body md-body" v-html="renderMarkdown(s.description)"></div>
            <div v-if="s.images?.length" class="card-body pt-0">
              <div class="row g-2">
                <div v-for="img in s.images" :key="img.id" class="col-6 col-md-3">
                  <div class="card card-sm h-100">
                    <img :src="img.url" :alt="img.caption || ''" class="card-img-top photo-img" loading="lazy" @click="viewer = img.url" />
                    <div class="card-body p-1 d-flex align-items-center">
                      <div class="small text-truncate" :class="{ 'text-secondary fst-italic': !img.caption }" :title="img.caption">
                        {{ img.caption || 'Sans légende' }}
                      </div>
                      <div class="ms-auto btn-list flex-nowrap">
                        <button class="btn btn-sm btn-icon" title="Légende" @click="editCaption(img)"><i class="ti ti-text-caption"></i></button>
                        <button class="btn btn-sm btn-icon" title="Rogner / redimensionner" @click="editingPhoto = img"><i class="ti ti-crop"></i></button>
                        <button class="btn btn-sm btn-icon btn-ghost-danger" title="Supprimer" @click="removePhoto(s, img)"><i class="ti ti-trash"></i></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <TaskList
            :tasks="journal.tasks ?? []"
            title="Tâches"
            :projet="journal.projet"
            :client="journal.projet?.client"
            :defaults="{ journal_id: Number(id), projet_id: journal.projet_id, client_id: journal.client_id }"
            @changed="load"
          />
        </div>
      </div>
    </div>
  </div>

  <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onPhotos" />

  <NamedFormModal
    :show="formOpen"
    title="Modifier le journal"
    :fields="journalFields"
    :initial="journal"
    :submit="submitJournal"
    @close="formOpen = false"
    @saved="onJournalSaved"
  />

  <AppModal
    :show="sectionOpen"
    :title="editingSection ? 'Modifier la section' : 'Ajouter une section'"
    size="modal-lg"
    :saving="sectionSaving"
    :can-submit="!!sectionForm.name.trim()"
    :error="sectionError"
    @close="sectionOpen = false"
    @submit="submitSection"
  >
    <div class="mb-3">
      <label class="form-label required">Titre</label>
      <input v-model="sectionForm.name" class="form-control" placeholder="Pose des caméras" required />
    </div>
    <div>
      <label class="form-label">Description</label>
      <MarkdownEditor v-model="sectionForm.description" :rows="10" placeholder="**Gras**, *italique*, - listes, # titres…" />
    </div>
  </AppModal>

  <AppModal
    :show="intervenantOpen"
    title="Ajouter un intervenant"
    :saving="saving"
    :can-submit="!!picked"
    submit-label="Ajouter"
    @close="intervenantOpen = false"
    @submit="addPicked"
  >
    <select v-model="picked" class="form-select">
      <option value="">—</option>
      <optgroup label="Contacts du projet">
        <option v-for="c in options.contacts" :key="`c${c.id}`" :value="`contact:${c.id}`">
          {{ [c.firstname, c.lastname].filter(Boolean).join(' ') }}{{ c.fonction ? ` — ${c.fonction}` : '' }}
        </option>
      </optgroup>
      <optgroup label="Équipe">
        <option v-for="t in options.team" :key="`t${t.id}`" :value="`team:${t.id}`">
          {{ [t.firstname, t.lastname].filter(Boolean).join(' ') }}{{ t.function ? ` — ${t.function}` : '' }}
        </option>
      </optgroup>
    </select>
  </AppModal>

  <AppModal
    :show="devisOpen"
    title="Lier un devis"
    :saving="devisSaving"
    :can-submit="!!pickedDevis"
    submit-label="Lier"
    @close="devisOpen = false"
    @submit="addDevis"
  >
    <select v-model="pickedDevis" class="form-select">
      <option value="">—</option>
      <option v-for="d in devisOptions" :key="d.id" :value="d.id">{{ d.reference }} — {{ d.description }}</option>
    </select>
    <div v-if="!devisOptions.length" class="form-hint mt-2">Aucun autre devis sur ce projet.</div>
  </AppModal>

  <ImageEditModal :show="!!editingPhoto" :src="editingPhoto?.url" title="Modifier la photo" @close="editingPhoto = null" @saved="onPhotoEdited" />

  <AppModal :show="!!viewer" title="Photo" size="modal-lg" hide-footer @close="viewer = null">
    <img v-if="viewer" :src="viewer" alt="" class="img-fluid rounded" />
  </AppModal>
</template>

<style scoped>
.description {
  white-space: pre-line;
}
.md-body :deep(p:last-child) {
  margin-bottom: 0;
}
.photo-img {
  height: 130px;
  object-fit: cover;
  cursor: zoom-in;
}
</style>
