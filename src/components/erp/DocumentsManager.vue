<script setup>
/**
 * Documents de tout type, classés par catégorie (catalogue, flyer, plan d'accès…) :
 * envoi (glisser-déposer ou sélection), filtre, renommage / reclassement, téléchargement, suppression.
 * Utilisé pour les projets (ProjetDocuments) et les fournisseurs.
 */
import { computed, onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { DOCUMENT_CATEGORIES, formatDate, formatSize } from '@/api/dash3'
import { cssUrl } from '@/utils/cssUrl'
import AppModal from '@/components/AppModal.vue'

const props = defineProps({
  /** () => Promise<doc[]> */
  fetch: { type: Function, required: true },
  /** (file, category) => Promise<doc> */
  upload: { type: Function, required: true },
  /** (id, { name, category }) => Promise<doc> */
  update: { type: Function, required: true },
  /** (doc) => Promise */
  remove: { type: Function, required: true },
  /** (doc) => Promise */
  download: { type: Function, required: true },
})
const emit = defineEmits(['changed'])

const docs = ref([])
const loading = ref(true)
const uploading = ref(0)
const error = ref('')
const dragging = ref(false)
const input = ref(null)
const uploadCategory = ref('')
const filter = ref('')

async function load() {
  loading.value = true
  try {
    docs.value = await props.fetch()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function send(files) {
  error.value = ''
  for (const f of files) {
    uploading.value++
    try {
      docs.value.unshift(await props.upload(f, uploadCategory.value))
      emit('changed', docs.value.length)
    } catch (e) {
      error.value = `${f.name} : ${errorMessage(e)}`
    } finally {
      uploading.value--
    }
  }
}
function onPick(e) {
  send([...e.target.files])
  e.target.value = ''
}
function onDrop(e) {
  dragging.value = false
  send([...e.dataTransfer.files])
}

const category = (value) => DOCUMENT_CATEGORIES.find((c) => c.value === value)
const counts = computed(() => {
  const c = {}
  for (const d of docs.value) c[d.category || ''] = (c[d.category || ''] || 0) + 1
  return c
})
const usedCategories = computed(() => DOCUMENT_CATEGORIES.filter((c) => counts.value[c.value]))
const visible = computed(() =>
  filter.value === '' ? docs.value : docs.value.filter((d) => (filter.value === '-' ? !d.category : d.category === filter.value)),
)

const ICONS = {
  pdf: 'ti-file-type-pdf text-red', doc: 'ti-file-type-doc text-blue', docx: 'ti-file-type-doc text-blue',
  xls: 'ti-file-type-xls text-green', xlsx: 'ti-file-type-xls text-green', csv: 'ti-file-type-csv text-green',
  ppt: 'ti-file-type-ppt text-orange', pptx: 'ti-file-type-ppt text-orange', zip: 'ti-file-zip', rar: 'ti-file-zip',
  png: 'ti-photo text-purple', jpg: 'ti-photo text-purple', jpeg: 'ti-photo text-purple', webp: 'ti-photo text-purple',
  dwg: 'ti-ruler-2 text-cyan', dxf: 'ti-ruler-2 text-cyan', txt: 'ti-file-text', mp4: 'ti-movie', mp3: 'ti-music',
}
const icon = (d) => ICONS[d.extension] || 'ti-file'
const isImage = (d) => ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(d.extension)

async function download(d) {
  try {
    await props.download(d)
  } catch (e) {
    error.value = errorMessage(e)
  }
}
async function removeDoc(d) {
  if (!confirm(`Supprimer le document « ${d.name} » ?`)) return
  try {
    await props.remove(d)
    docs.value = docs.value.filter((x) => x.id !== d.id)
    emit('changed', docs.value.length)
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// Renommage / changement de catégorie
const editing = ref(null)
const editForm = ref({ name: '', category: '' })
const editSaving = ref(false)
const editError = ref('')
function openEdit(d) {
  editing.value = d
  editForm.value = { name: d.name, category: d.category || '' }
  editError.value = ''
}
async function submitEdit() {
  editSaving.value = true
  editError.value = ''
  try {
    const updated = await props.update(editing.value.id, { name: editForm.value.name.trim(), category: editForm.value.category || null })
    Object.assign(editing.value, updated ?? { name: editForm.value.name.trim(), category: editForm.value.category || null })
    editing.value = null
  } catch (e) {
    editError.value = errorMessage(e)
  } finally {
    editSaving.value = false
  }
}
</script>

<template>
  <div>
    <div
      class="border border-2 border-dashed rounded p-3 mb-2 text-center"
      :class="{ 'border-primary bg-primary-lt': dragging }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <i class="ti ti-cloud-upload fs-1 text-secondary"></i>
      <div class="text-secondary">Glissez vos fichiers ici (tout type, 50 Mo max) ou</div>
      <div class="d-flex justify-content-center align-items-center gap-2 mt-2 flex-wrap">
        <select v-model="uploadCategory" class="form-select form-select-sm w-auto" title="Catégorie des fichiers envoyés">
          <option value="">Sans catégorie</option>
          <option v-for="c in DOCUMENT_CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
        <button class="btn btn-primary btn-sm" @click="input.click()"><i class="ti ti-upload"></i> Choisir des fichiers</button>
      </div>
      <input ref="input" type="file" multiple class="d-none" @change="onPick" />
      <div v-if="uploading" class="mt-2 small"><span class="spinner-border spinner-border-sm me-1"></span>Envoi en cours ({{ uploading }})…</div>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Filtre par catégorie -->
    <div v-if="usedCategories.length" class="d-flex flex-wrap gap-1 mb-2">
      <button class="btn btn-sm" :class="filter === '' ? 'btn-primary' : 'btn-outline-secondary'" @click="filter = ''">
        Tous <span class="badge ms-1" :class="filter === '' ? 'bg-white text-primary' : 'bg-secondary-lt'">{{ docs.length }}</span>
      </button>
      <button
        v-for="c in usedCategories"
        :key="c.value"
        class="btn btn-sm"
        :class="filter === c.value ? 'btn-primary' : 'btn-outline-secondary'"
        @click="filter = c.value"
      >
        <i :class="['ti me-1', c.icon]"></i>{{ c.label }}
        <span class="badge ms-1" :class="filter === c.value ? 'bg-white text-primary' : 'bg-secondary-lt'">{{ counts[c.value] }}</span>
      </button>
      <button v-if="counts['']" class="btn btn-sm" :class="filter === '-' ? 'btn-primary' : 'btn-outline-secondary'" @click="filter = '-'">
        Sans catégorie <span class="badge ms-1" :class="filter === '-' ? 'bg-white text-primary' : 'bg-secondary-lt'">{{ counts[''] }}</span>
      </button>
    </div>

    <div class="card">
      <div class="list-group list-group-flush">
        <div v-if="loading" class="list-group-item text-center"><div class="spinner-border spinner-border-sm"></div></div>
        <div v-else-if="!visible.length" class="list-group-item text-secondary">Aucun document</div>
        <div v-for="d in visible" :key="d.id" class="list-group-item">
          <div class="row align-items-center g-2">
            <div class="col-auto">
              <span v-if="isImage(d)" class="avatar rounded-2" :style="{ backgroundImage: cssUrl(d.url) }"></span>
              <span v-else class="avatar rounded-2 bg-transparent"><i :class="['ti fs-2', icon(d)]"></i></span>
            </div>
            <div class="col min-w-0">
              <a href="#" class="fw-medium text-reset text-truncate d-block" @click.prevent="download(d)">{{ d.name }}</a>
              <div class="text-secondary small">
                <span v-if="category(d.category)" class="badge bg-azure-lt me-1"><i :class="['ti me-1', category(d.category).icon]"></i>{{ category(d.category).label }}</span>
                <span class="text-uppercase">{{ d.extension || '—' }}</span> · {{ formatSize(d.size) }} · {{ formatDate(d.created_at) }}
              </div>
            </div>
            <div class="col-auto btn-list">
              <button class="btn btn-icon btn-ghost-primary" title="Télécharger" @click="download(d)"><i class="ti ti-download"></i></button>
              <div class="dropdown">
                <button class="btn btn-action" type="button" data-bs-toggle="dropdown" aria-label="Actions"><i class="ti ti-dots-vertical"></i></button>
                <div class="dropdown-menu dropdown-menu-end">
                  <button class="dropdown-item" type="button" @click="openEdit(d)"><i class="ti ti-edit me-1"></i> Renommer / classer</button>
                  <button class="dropdown-item text-danger" type="button" @click="removeDoc(d)"><i class="ti ti-trash me-1"></i> Supprimer</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <AppModal
    :show="!!editing"
    title="Modifier le document"
    :saving="editSaving"
    :can-submit="!!editForm.name.trim()"
    :error="editError"
    @close="editing = null"
    @submit="submitEdit"
  >
    <div class="mb-3">
      <label class="form-label required">Nom du document</label>
      <input v-model="editForm.name" class="form-control" required />
    </div>
    <div>
      <label class="form-label">Catégorie</label>
      <select v-model="editForm.category" class="form-select">
        <option value="">Sans catégorie</option>
        <option v-for="c in DOCUMENT_CATEGORIES" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
    </div>
  </AppModal>
</template>
