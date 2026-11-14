<script setup>
/** Documents d'un projet, de tout type : envoi (glisser-déposer ou sélection), renommage, téléchargement, suppression */
import { onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import {
  deleteProjetDocument,
  downloadProjetDocument,
  formatDate,
  formatSize,
  projetDocuments,
  renameProjetDocument,
  uploadProjetDocument,
} from '@/api/dash3'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'

const props = defineProps({ projetId: { type: [String, Number], required: true } })

const docs = ref([])
const loading = ref(true)
const uploading = ref(0)
const error = ref('')
const dragging = ref(false)
const input = ref(null)

async function load() {
  loading.value = true
  try {
    docs.value = await projetDocuments(props.projetId)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function upload(files) {
  error.value = ''
  for (const f of files) {
    uploading.value++
    try {
      docs.value.unshift(await uploadProjetDocument(props.projetId, f))
    } catch (e) {
      error.value = `${f.name} : ${errorMessage(e)}`
    } finally {
      uploading.value--
    }
  }
}
function onPick(e) {
  upload([...e.target.files])
  e.target.value = ''
}
function onDrop(e) {
  dragging.value = false
  upload([...e.dataTransfer.files])
}

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
    await downloadProjetDocument(d)
  } catch (e) {
    error.value = errorMessage(e)
  }
}
async function remove(d) {
  if (!confirm(`Supprimer le document « ${d.name} » ?`)) return
  try {
    await deleteProjetDocument(d.id)
    docs.value = docs.value.filter((x) => x.id !== d.id)
  } catch (e) {
    error.value = errorMessage(e)
  }
}

const renaming = ref(null)
const renameFields = [{ name: 'name', label: 'Nom du document', required: true }]
const submitRename = (v) => renameProjetDocument(renaming.value.id, v.name)
async function onRenamed() {
  renaming.value = null
  await load()
}
</script>

<template>
  <div>
    <div
      class="dropzone-area border border-2 border-dashed rounded p-3 mb-2 text-center"
      :class="{ 'border-primary bg-primary-lt': dragging }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <i class="ti ti-cloud-upload fs-1 text-secondary"></i>
      <div class="text-secondary">Glissez vos fichiers ici (tout type, 50 Mo max) ou</div>
      <button class="btn btn-primary btn-sm mt-2" @click="input.click()"><i class="ti ti-upload"></i> Choisir des fichiers</button>
      <input ref="input" type="file" multiple class="d-none" @change="onPick" />
      <div v-if="uploading" class="mt-2 small"><span class="spinner-border spinner-border-sm me-1"></span>Envoi en cours ({{ uploading }})…</div>
    </div>

    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <div class="card">
      <div class="list-group list-group-flush">
        <div v-if="loading" class="list-group-item text-center"><div class="spinner-border spinner-border-sm"></div></div>
        <div v-else-if="!docs.length" class="list-group-item text-secondary">Aucun document</div>
        <div v-for="d in docs" :key="d.id" class="list-group-item">
          <div class="row align-items-center g-2">
            <div class="col-auto">
              <span v-if="isImage(d)" class="avatar rounded-2" :style="{ backgroundImage: `url(${d.url})` }"></span>
              <span v-else class="avatar rounded-2 bg-transparent"><i :class="['ti fs-2', icon(d)]"></i></span>
            </div>
            <div class="col min-w-0">
              <a href="#" class="fw-medium text-reset text-truncate d-block" @click.prevent="download(d)">{{ d.name }}</a>
              <div class="text-secondary small">
                <span class="text-uppercase">{{ d.extension || '—' }}</span> · {{ formatSize(d.size) }} · {{ formatDate(d.created_at) }}
              </div>
            </div>
            <div class="col-auto btn-list">
              <button class="btn btn-icon btn-ghost-primary" title="Télécharger" @click="download(d)"><i class="ti ti-download"></i></button>
              <div class="dropdown">
                <button class="btn btn-action" type="button" data-bs-toggle="dropdown" aria-label="Actions"><i class="ti ti-dots-vertical"></i></button>
                <div class="dropdown-menu dropdown-menu-end">
                  <button class="dropdown-item" type="button" @click="renaming = d"><i class="ti ti-edit me-1"></i> Renommer</button>
                  <button class="dropdown-item text-danger" type="button" @click="remove(d)"><i class="ti ti-trash me-1"></i> Supprimer</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <NamedFormModal
    :show="!!renaming"
    title="Renommer le document"
    :fields="renameFields"
    :initial="renaming"
    :submit="submitRename"
    @close="renaming = null"
    @saved="onRenamed"
  />
</template>
