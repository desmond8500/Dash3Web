<script setup>
/**
 * Onglet Installations d'un projet : liste des bâtiments avec leurs niveaux et locaux
 * (chaque bâtiment ouvre sa page, où l'on gère systèmes et équipements),
 * systèmes sans bâtiment, et plans du projet (import PDF / image / DWG).
 */
import { onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import {
  convertPlan,
  deleteBuilding,
  deletePlan,
  getInstallations,
  listPlans,
  saveBuilding,
  uploadPlan,
} from '@/api/dash3'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import EquipementsTree from '@/components/erp/EquipementsTree.vue'

const props = defineProps({ projetId: { type: [Number, String], required: true } })

const data = ref(null)
const plans = ref([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [inst, pl] = await Promise.all([getInstallations(props.projetId), listPlans(props.projetId)])
    data.value = inst
    plans.value = pl
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const run = async (fn) => {
  try {
    await fn()
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Bâtiments ----------
const buildingFields = [
  { name: 'name', label: 'Nom du bâtiment', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
]
const buildingOpen = ref(false)
const editingBuilding = ref(null)
function openBuilding(b = null) {
  editingBuilding.value = b
  buildingOpen.value = true
}
const submitBuilding = (v) => saveBuilding({ ...v, projet_id: Number(props.projetId) }, editingBuilding.value?.id)
function removeBuilding(b) {
  if (!confirm(`Supprimer le bâtiment « ${b.name} » ? Ses systèmes seront détachés du bâtiment.`)) return
  run(() => deleteBuilding(b.id))
}

// Résumé d'un bâtiment : nombre de systèmes, d'équipements, de niveaux et de locaux
const equipCount = (systemes) =>
  systemes.reduce((n, s) => n + (s.base_equipements || []).reduce((m, e) => m + (e.quantite || 1) + (e.children || []).reduce((k, c) => k + (c.quantite || 1), 0), 0), 0)
const roomCount = (b) => (b.stages || []).reduce((n, st) => n + (st.rooms?.length || 0), 0)

// ---------- Plans ----------
const planUploading = ref(false)
const planBuilding = ref('')
async function onPlanFile(ev) {
  const file = ev.target.files?.[0]
  if (!file) return
  planUploading.value = true
  try {
    await uploadPlan(props.projetId, file, planBuilding.value || null)
    plans.value = await listPlans(props.projetId)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    planUploading.value = false
    ev.target.value = ''
  }
}
function removePlan(p) {
  if (!confirm(`Supprimer le plan « ${p.name} » ?`)) return
  run(() => deletePlan(p.id))
}
async function retryConvert(p) {
  try {
    await convertPlan(p.id)
    plans.value = await listPlans(props.projetId)
  } catch (e) {
    error.value = errorMessage(e)
  }
}
const convLabel = (p) =>
  ({ pending: 'Conversion en attente', processing: 'Conversion en cours', done: 'Converti en PDF', failed: 'Conversion échouée' })[p.conversion_status] || 'Non converti'
const convClass = (p) => ({ done: 'bg-green-lt', failed: 'bg-red-lt' })[p.conversion_status] || 'bg-yellow-lt'
const planIcon = (k) => ({ pdf: 'ti-file-type-pdf', dwg: 'ti-file-unknown', image: 'ti-photo' })[k] || 'ti-file'
const buildingName = (id) => data.value?.buildings.find((b) => b.id === id)?.name
</script>

<template>
  <div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Fil d'Ariane de la section, remonté en tête -->
    <div class="d-flex align-items-center mb-3">
      <ol class="breadcrumb breadcrumb-arrows m-0">
        <li class="breadcrumb-item"><i class="ti ti-building me-1"></i>Bâtiment</li>
        <li class="breadcrumb-item">Niveau</li>
        <li class="breadcrumb-item">Local</li>
        <li class="breadcrumb-item active">Équipements</li>
      </ol>
      <button class="btn btn-primary ms-auto" @click="openBuilding()"><i class="ti ti-plus"></i> Bâtiment</button>
    </div>

    <div v-if="loading" class="text-center py-4"><div class="spinner-border spinner-border-sm"></div></div>

    <template v-else>
      <div v-if="!data?.buildings?.length" class="card card-body text-secondary text-center mb-3">
        Aucun bâtiment. Ajoutez un bâtiment puis ouvrez-le pour gérer ses niveaux, locaux et équipements.
      </div>

      <!-- Bâtiments : niveaux et locaux, ouverture de la page Bâtiment -->
      <div class="row row-cards mb-3">
        <div v-for="b in data?.buildings" :key="b.id" class="col-md-6">
          <div class="card h-100">
            <div class="card-header">
              <RouterLink :to="{ name: 'batiment', params: { id: projetId, buildingId: b.id } }" class="card-title text-reset">
                <i class="ti ti-building text-primary"></i>{{ b.name }}
              </RouterLink>
              <div class="card-actions btn-list">
                <RouterLink :to="{ name: 'batiment', params: { id: projetId, buildingId: b.id } }" class="btn btn-sm btn-primary">
                  <i class="ti ti-arrow-right"></i> Ouvrir
                </RouterLink>
                <div class="dropdown">
                  <button class="btn btn-sm btn-action" type="button" data-bs-toggle="dropdown" aria-label="Actions du bâtiment"><i class="ti ti-dots-vertical"></i></button>
                  <div class="dropdown-menu dropdown-menu-end">
                    <button class="dropdown-item" type="button" @click="openBuilding(b)"><i class="ti ti-edit"></i> Renommer</button>
                    <button class="dropdown-item text-danger" type="button" @click="removeBuilding(b)"><i class="ti ti-trash"></i> Supprimer</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="card-body py-2">
              <div class="d-flex gap-3 small text-secondary mb-2">
                <span><i class="ti ti-stack-2"></i> {{ b.stages?.length || 0 }} niveau(x)</span>
                <span><i class="ti ti-door"></i> {{ roomCount(b) }} local(aux)</span>
                <span><i class="ti ti-cpu"></i> {{ b.systemes?.length || 0 }} système(s)</span>
                <span><i class="ti ti-device-cctv"></i> {{ equipCount(b.systemes || []) }} équipement(s)</span>
              </div>
              <div v-if="!b.stages?.length" class="text-secondary small">Aucun niveau.</div>
              <div v-for="st in b.stages" :key="st.id" class="mb-1">
                <div class="fw-medium small"><i class="ti ti-stack-2 text-secondary"></i> {{ st.name }}</div>
                <div class="ms-3">
                  <span v-for="r in st.rooms" :key="r.id" class="badge bg-azure-lt me-1 mb-1">{{ r.name }}</span>
                  <span v-if="!st.rooms?.length" class="text-secondary small">Aucun local</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Systèmes sans bâtiment -->
      <div v-if="data?.unassigned?.length" class="card mb-3">
        <div class="card-header"><h3 class="card-title"><i class="ti ti-building-off text-secondary"></i>Sans bâtiment</h3></div>
        <div class="card-body">
          <EquipementsTree :projet-id="projetId" :systemes="data.unassigned" :catalogue="data.catalogue" @changed="load" />
        </div>
      </div>

      <!-- Plans -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title"><i class="ti ti-map text-primary"></i>Plans</h3>
          <div class="card-actions d-flex gap-2">
            <select v-model="planBuilding" class="form-select form-select-sm w-auto" aria-label="Bâtiment du plan">
              <option value="">Tout le projet</option>
              <option v-for="b in data?.buildings" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
            <label class="btn btn-sm btn-primary mb-0" :class="{ disabled: planUploading }">
              <span v-if="planUploading" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="ti ti-upload"></i> Importer
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg" hidden @change="onPlanFile" />
            </label>
          </div>
        </div>
        <div class="list-group list-group-flush">
          <div v-if="!plans.length" class="list-group-item text-secondary small">Aucun plan. Formats : PDF, PNG, JPG, WEBP ou DWG.</div>
          <div v-for="p in plans" :key="p.id" class="list-group-item d-flex align-items-center gap-2">
            <i :class="['ti', planIcon(p.kind)]" style="font-size: 1.4rem"></i>
            <div class="flex-fill min-w-0">
              <a :href="p.url" target="_blank" rel="noopener" class="fw-medium">{{ p.name }}</a>
              <div class="text-secondary small">
                {{ p.kind.toUpperCase() }}<span v-if="p.building_id"> · {{ buildingName(p.building_id) }}</span>
                <span v-if="p.markers_count"> · {{ p.markers_count }} repère(s)</span>
              </div>
              <div v-if="p.kind === 'dwg' && p.conversion_status === 'failed' && p.conversion_error" class="text-danger small text-truncate" :title="p.conversion_error">
                {{ p.conversion_error }}
              </div>
            </div>
            <span v-if="p.kind === 'dwg'" class="badge" :class="convClass(p)">{{ convLabel(p) }}</span>
            <button v-if="p.kind === 'dwg' && p.conversion_status !== 'done'" class="btn btn-sm" title="Relancer la conversion" @click="retryConvert(p)">
              <i class="ti ti-refresh"></i>
            </button>
            <RouterLink v-if="p.viewable" class="btn btn-sm btn-primary" :to="{ name: 'plan', params: { id: projetId, planId: p.id } }">
              <i class="ti ti-map-pin"></i> Placer les équipements
            </RouterLink>
            <button class="btn btn-sm btn-ghost-danger btn-icon" title="Supprimer" @click="removePlan(p)"><i class="ti ti-trash"></i></button>
          </div>
        </div>
      </div>
    </template>

    <NamedFormModal
      :show="buildingOpen"
      :title="editingBuilding ? 'Renommer le bâtiment' : 'Ajouter un bâtiment'"
      :fields="buildingFields"
      :initial="editingBuilding"
      :submit="submitBuilding"
      @close="buildingOpen = false"
      @saved="buildingOpen = false; load()"
    />

  </div>
</template>

<style scoped>
.breadcrumb-item {
  font-weight: 500;
}
</style>
