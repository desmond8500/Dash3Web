<script setup>
/**
 * Page Bâtiment : niveaux et locaux (à gauche), systèmes et équipements (à droite), plans du bâtiment.
 * Les équipements sont liés aux articles du stock et rattachés à un local.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { errorMessage } from '@/api/client'
import { deleteRoom, deleteStage, getBuilding, saveBuilding, saveRoom, saveStage, uploadPlan } from '@/api/dash3'
import PageHeader from '@/components/PageHeader.vue'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import EquipementsTree from '@/components/erp/EquipementsTree.vue'

const route = useRoute()
const projetId = computed(() => route.params.id)
const buildingId = computed(() => route.params.buildingId)

const data = ref(null)
const loading = ref(true)
const error = ref('')
const tree = ref(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await getBuilding(buildingId.value)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(buildingId, load)

const building = computed(() => data.value?.building)
const stages = computed(() => building.value?.stages ?? [])
const breadcrumbs = computed(() => {
  const p = data.value?.projet
  return [
    { name: 'ERP' },
    { name: 'Clients', to: { name: 'clients' } },
    p?.client ? { name: p.client.name, to: { name: 'projets', query: { client_id: p.client.id } } } : null,
    { name: p?.name || 'Projet', to: { name: 'projet', params: { id: projetId.value } } },
    { name: building.value?.name || 'Bâtiment' },
  ].filter(Boolean)
})

const run = async (fn) => {
  error.value = ''
  try {
    await fn()
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Formulaires : bâtiment, niveau, local ----------
const editor = ref(null) // { title, fields, initial, submit }
const baseFields = (label) => [
  { name: 'name', label, required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
]
function editBuilding() {
  editor.value = {
    title: 'Modifier le bâtiment',
    fields: baseFields('Nom du bâtiment'),
    initial: building.value,
    submit: (v) => saveBuilding(v, building.value.id),
  }
}
function editStage(st = null) {
  editor.value = {
    title: st ? 'Modifier le niveau' : 'Ajouter un niveau',
    fields: baseFields('Nom du niveau (RDC, R+1, Sous-sol…)'),
    initial: st,
    submit: (v) => saveStage(st ? v : { ...v, building_id: building.value.id }, st?.id),
  }
}
function editRoom(st, r = null) {
  editor.value = {
    title: r ? 'Modifier le local' : `Ajouter un local — ${st.name}`,
    fields: baseFields('Nom du local (Accueil, Bureau 1…)'),
    initial: r,
    submit: (v) => saveRoom(r ? v : { ...v, stage_id: st.id }, r?.id),
  }
}
async function onEditorSaved() {
  editor.value = null
  await load()
}
function removeStage(st) {
  if (!confirm(`Supprimer le niveau « ${st.name} » et ses locaux ? Les équipements resteront dans le bâtiment.`)) return
  run(() => deleteStage(st.id))
}
function removeRoom(r) {
  if (!confirm(`Supprimer le local « ${r.name} » ?`)) return
  run(() => deleteRoom(r.id))
}

// Nombre d'équipements par local
const perRoom = computed(() => {
  const m = {}
  const add = (e) => {
    if (e.room_id) m[e.room_id] = (m[e.room_id] || 0) + (e.quantite || 1)
  }
  for (const s of data.value?.systemes ?? []) for (const e of s.base_equipements ?? []) {
    add(e)
    ;(e.children ?? []).forEach(add)
  }
  return m
})

// ---------- Plans du bâtiment ----------
const uploading = ref(false)
async function onPlanFile(ev) {
  const file = ev.target.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    await uploadPlan(projetId.value, file, building.value.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    uploading.value = false
    ev.target.value = ''
  }
}
const planIcon = (k) => ({ pdf: 'ti-file-type-pdf', dwg: 'ti-ruler-2', image: 'ti-photo' })[k] || 'ti-file'
</script>

<template>
  <PageHeader :title="building ? `Bâtiment: ${building.name}` : 'Bâtiment'" :breadcrumbs="breadcrumbs" :loading="loading">
    <template #actions>
      <div v-if="building" class="btn-list">
        <button class="btn btn-icon" title="Actualiser" @click="load"><i class="ti ti-reload"></i></button>
        <button class="btn" @click="editBuilding"><i class="ti ti-edit"></i> Modifier</button>
        <button class="btn btn-primary" @click="tree?.openSysteme()"><i class="ti ti-plus"></i> Système</button>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-xl">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-if="data" class="row g-3">
        <!-- Niveaux et locaux -->
        <div class="col-lg-4">
          <div class="card mb-3">
            <div class="card-header">
              <h3 class="card-title"><i class="ti ti-stack-2 text-primary"></i>Niveaux et locaux</h3>
              <button class="btn btn-sm btn-primary ms-auto" @click="editStage()"><i class="ti ti-plus"></i> Niveau</button>
            </div>
            <div v-if="building.description" class="card-body py-2 text-secondary small pre">{{ building.description }}</div>
            <div class="list-group list-group-flush">
              <div v-if="!stages.length" class="list-group-item text-secondary small">Aucun niveau. Ajoutez RDC, R+1…</div>
              <div v-for="st in stages" :key="st.id" class="list-group-item">
                <div class="d-flex align-items-center">
                  <b><i class="ti ti-stack-2 text-secondary"></i> {{ st.name }}</b>
                  <div class="ms-auto btn-list flex-nowrap">
                    <button class="btn btn-sm btn-ghost-primary btn-icon" title="Ajouter un local" @click="editRoom(st)"><i class="ti ti-plus"></i></button>
                    <div class="dropdown">
                      <button class="btn btn-sm btn-action" type="button" data-bs-toggle="dropdown" aria-label="Actions du niveau"><i class="ti ti-dots-vertical"></i></button>
                      <div class="dropdown-menu dropdown-menu-end">
                        <button class="dropdown-item" type="button" @click="editStage(st)"><i class="ti ti-edit me-1"></i> Modifier</button>
                        <button class="dropdown-item text-danger" type="button" @click="removeStage(st)"><i class="ti ti-trash me-1"></i> Supprimer</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="!st.rooms?.length" class="text-secondary small ms-3">Aucun local</div>
                <div v-for="r in st.rooms" :key="r.id" class="room d-flex align-items-center">
                  <i class="ti ti-door me-1 text-secondary"></i>
                  <span>{{ r.name }}</span>
                  <span v-if="perRoom[r.id]" class="badge bg-azure-lt ms-2" title="Équipements">{{ perRoom[r.id] }}</span>
                  <div class="ms-auto dropdown">
                    <button class="btn btn-sm btn-action" type="button" data-bs-toggle="dropdown" aria-label="Actions du local"><i class="ti ti-dots"></i></button>
                    <div class="dropdown-menu dropdown-menu-end">
                      <button class="dropdown-item" type="button" @click="editRoom(st, r)"><i class="ti ti-edit me-1"></i> Modifier</button>
                      <button class="dropdown-item text-danger" type="button" @click="removeRoom(r)"><i class="ti ti-trash me-1"></i> Supprimer</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Plans du bâtiment -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><i class="ti ti-map text-primary"></i>Plans</h3>
              <label class="btn btn-sm btn-primary mb-0 ms-auto" :class="{ disabled: uploading }">
                <span v-if="uploading" class="spinner-border spinner-border-sm me-1"></span>
                <i v-else class="ti ti-upload"></i> Importer
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg" hidden @change="onPlanFile" />
              </label>
            </div>
            <div class="list-group list-group-flush">
              <div v-if="!data.plans?.length" class="list-group-item text-secondary small">Aucun plan pour ce bâtiment.</div>
              <div v-for="p in data.plans" :key="p.id" class="list-group-item d-flex align-items-center gap-2">
                <i :class="['ti fs-2', planIcon(p.kind)]"></i>
                <div class="flex-fill min-w-0 text-truncate">{{ p.name }}</div>
                <RouterLink v-if="p.viewable" class="btn btn-sm btn-primary" :to="{ name: 'plan', params: { id: projetId, planId: p.id } }">
                  <i class="ti ti-map-pin"></i> Placer
                </RouterLink>
                <span v-else class="badge bg-yellow-lt">Conversion</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Systèmes et équipements -->
        <div class="col-lg-8">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><i class="ti ti-cpu text-primary"></i>Systèmes et équipements</h3>
            </div>
            <div class="card-body">
              <EquipementsTree
                ref="tree"
                :projet-id="projetId"
                :building="building"
                :systemes="data.systemes"
                :catalogue="data.catalogue"
                :stages="stages"
                @changed="load"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <NamedFormModal
    :show="!!editor"
    :title="editor?.title || ''"
    :fields="editor?.fields || []"
    :initial="editor?.initial"
    :submit="editor?.submit || (() => {})"
    @close="editor = null"
    @saved="onEditorSaved"
  />
</template>

<style scoped>
.pre {
  white-space: pre-line;
}
.room {
  margin-left: 1rem;
  padding: 2px 0 2px 8px;
  border-left: 2px solid var(--tblr-border-color);
}
</style>
