<script setup>
/**
 * Table d'icônes : chaque icône est liée aux articles par un tag (type d'article)
 * et matérialise les équipements correspondants sur les plans.
 */
import { computed, onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { articleTypes, deleteIcon, listIcons, saveIcon } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import ImageUploadModal from '@/components/ImageUploadModal.vue'

const icons = ref([])
const types = ref([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  try {
    ;[icons.value, types.value] = await Promise.all([listIcons(), articleTypes().catch(() => [])])
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

// Icônes Tabler courantes pour la sécurité électronique
const SUGGESTIONS = [
  'ti-device-cctv', 'ti-camera', 'ti-server', 'ti-server-2', 'ti-device-desktop', 'ti-router', 'ti-wifi', 'ti-network',
  'ti-plug', 'ti-bolt', 'ti-alarm', 'ti-bell-ringing', 'ti-speakerphone', 'ti-fingerprint', 'ti-id-badge-2', 'ti-lock',
  'ti-door', 'ti-key', 'ti-flame', 'ti-smoke', 'ti-sensor', 'ti-radar', 'ti-keyboard', 'ti-battery', 'ti-sun', 'ti-bulb',
]

const fields = computed(() => [
  { name: 'name', label: 'Nom', required: true, placeholder: 'Caméra dôme', col: 'col-md-6' },
  {
    name: 'tag',
    label: "Tag d'article",
    type: 'select',
    options: types.value.map((t) => ({ value: t.name, label: t.name })),
    col: 'col-md-6',
  },
  { name: 'tabler', label: 'Icône Tabler', placeholder: 'ti-device-cctv', col: 'col-md-8' },
  { name: 'color', label: 'Couleur', type: 'color', col: 'col-md-4', default: '#1690b7' },
])
const open = ref(false)
const editing = ref(null)
function edit(i = null) {
  editing.value = i
  open.value = true
}
const submit = (v) => saveIcon(v, editing.value?.id)
async function onSaved() {
  open.value = false
  await load()
}
async function remove(i) {
  if (!confirm(`Supprimer l'icône « ${i.name} » ?`)) return
  try {
    await deleteIcon(i.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

const imageFor = ref(null)
async function onImage() {
  imageFor.value = null
  await load()
}

async function quickTabler(i, cls) {
  try {
    await saveIcon({ tabler: cls }, i.id)
    i.tabler = cls
  } catch (e) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <PageHeader title="Icônes">
    <template #actions>
      <button class="btn btn-primary" @click="edit()"><i class="ti ti-plus"></i> Icône</button>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div class="alert alert-info">
        Une icône est liée aux articles portant son tag. Les équipements liés à ces articles l'utilisent sur les plans.
      </div>

      <div v-if="loading" class="text-center py-4"><div class="spinner-border spinner-border-sm"></div></div>
      <div v-else-if="!icons.length" class="card card-body text-secondary text-center">Aucune icône.</div>

      <div class="row row-cards">
        <div v-for="i in icons" :key="i.id" class="col-sm-6 col-lg-3">
          <div class="card h-100">
            <div class="card-body text-center">
              <span
                class="avatar avatar-xl rounded-circle mb-2"
                :style="i.image_url ? { backgroundImage: `url(${i.image_url})` } : { background: i.color || '#1690b7', color: '#fff' }"
              >
                <i v-if="!i.image_url" :class="['ti', i.tabler || 'ti-map-pin']" style="font-size: 2rem"></i>
              </span>
              <div class="fw-bold">{{ i.name }}</div>
              <div class="small text-secondary">
                <span v-if="i.tag" class="badge bg-azure-lt"><i class="ti ti-tag"></i> {{ i.tag }}</span>
                <span v-else>Sans tag</span>
              </div>
              <div class="small text-secondary mt-1"><code>{{ i.tabler || '—' }}</code></div>
            </div>
            <div class="card-footer d-flex">
              <div class="dropdown">
                <button class="btn btn-sm" type="button" data-bs-toggle="dropdown"><i class="ti ti-icons"></i> Choisir</button>
                <div class="dropdown-menu icon-grid p-2">
                  <button v-for="c in SUGGESTIONS" :key="c" type="button" class="btn btn-icon btn-ghost-secondary" :title="c" @click="quickTabler(i, c)">
                    <i :class="['ti', c]"></i>
                  </button>
                </div>
              </div>
              <div class="ms-auto btn-list">
                <button class="btn btn-sm btn-icon" title="Image" @click="imageFor = i"><i class="ti ti-photo"></i></button>
                <button class="btn btn-sm btn-icon" title="Modifier" @click="edit(i)"><i class="ti ti-edit"></i></button>
                <button class="btn btn-sm btn-icon btn-ghost-danger" title="Supprimer" @click="remove(i)"><i class="ti ti-trash"></i></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <NamedFormModal :show="open" :title="editing ? 'Modifier l\'icône' : 'Ajouter une icône'" :fields="fields" :initial="editing" :submit="submit" @close="open = false" @saved="onSaved" />
  <ImageUploadModal
    :show="!!imageFor"
    title="Image de l'icône"
    :endpoint="imageFor ? `/icons/${imageFor.id}/image` : ''"
    :current="imageFor?.image_url"
    @close="imageFor = null"
    @saved="onImage"
  />
</template>

<style scoped>
.icon-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 2px;
  width: 260px;
}
</style>
