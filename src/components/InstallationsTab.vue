<script setup>
/**
 * Onglet Installations d'un projet :
 *   Bâtiment › Système (ex. vidéosurveillance)
 *     › Équipement de base (ex. NVR : IP, modèle, ports)
 *       › Équipements secondaires (ex. caméras, disques durs)
 * + plans du projet (import PDF / image / DWG ; placement des équipements : étape suivante).
 */
import { computed, onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import {
  deleteBuilding,
  deleteEquipement,
  deleteInstallationSysteme,
  deletePlan,
  getInstallations,
  listPlans,
  saveBuilding,
  saveInstallationSysteme,
  uploadPlan,
} from '@/api/dash3'
import NamedFormModal from '@/components/forms/NamedFormModal.vue'
import EquipementFormModal from '@/components/forms/EquipementFormModal.vue'
import AppModal from '@/components/AppModal.vue'

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

const groups = computed(() => {
  if (!data.value) return []
  const list = data.value.buildings.map((b) => ({ building: b, systemes: b.systemes }))
  if (data.value.unassigned?.length) list.push({ building: null, systemes: data.value.unassigned })
  return list
})

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

// ---------- Systèmes ----------
const systemeOpen = ref(false)
const editingSysteme = ref(null)
const systemeBuilding = ref(null)
const systemeForm = ref({ name: '', systeme_id: null, description: '' })
const systemeSaving = ref(false)
const systemeError = ref('')
function openSysteme(building, s = null) {
  systemeBuilding.value = building
  editingSysteme.value = s
  systemeForm.value = { name: s?.name ?? '', systeme_id: s?.systeme_id ?? null, description: s?.description ?? '' }
  systemeError.value = ''
  systemeOpen.value = true
}
function onCatalogue() {
  const c = data.value?.catalogue?.find((x) => x.id === systemeForm.value.systeme_id)
  if (c && !systemeForm.value.name.trim()) systemeForm.value.name = c.name
}
async function submitSysteme() {
  systemeSaving.value = true
  systemeError.value = ''
  try {
    const payload = { ...systemeForm.value, name: systemeForm.value.name.trim() }
    if (!editingSysteme.value) {
      payload.projet_id = Number(props.projetId)
      payload.building_id = systemeBuilding.value?.id ?? null
    }
    await saveInstallationSysteme(payload, editingSysteme.value?.id)
    systemeOpen.value = false
    await load()
  } catch (e) {
    systemeError.value = errorMessage(e)
  } finally {
    systemeSaving.value = false
  }
}
function removeSysteme(s) {
  if (!confirm(`Supprimer le système « ${s.name} » et tous ses équipements ?`)) return
  run(() => deleteInstallationSysteme(s.id))
}

// ---------- Équipements ----------
const equipOpen = ref(false)
const equipEditing = ref(null)
const equipSysteme = ref(null)
const equipParent = ref(null)
function openEquip(systeme, parent = null, equipement = null) {
  equipSysteme.value = systeme
  equipParent.value = parent
  equipEditing.value = equipement
  equipOpen.value = true
}
async function onEquipSaved() {
  equipOpen.value = false
  await load()
}
function removeEquip(e) {
  const extra = e.children?.length ? ` et ses ${e.children.length} équipement(s) rattaché(s)` : ''
  if (!confirm(`Supprimer « ${e.name} »${extra} ?`)) return
  run(() => deleteEquipement(e.id))
}

const caracs = (e) => Object.entries(e.caracteristiques || {}).filter(([, v]) => v !== null && v !== '')
const count = (s) => (s.base_equipements || []).reduce((n, e) => n + 1 + (e.children?.length || 0), 0)

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
const planIcon = (k) => ({ pdf: 'ti-file-type-pdf', dwg: 'ti-file-unknown', image: 'ti-photo' })[k] || 'ti-file'
const buildingName = (id) => data.value?.buildings.find((b) => b.id === id)?.name
</script>

<template>
  <div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <div class="d-flex align-items-center mb-2">
      <div class="text-secondary small">Bâtiment › Système › Équipement de base › Équipements secondaires</div>
      <button class="btn btn-primary ms-auto" @click="openBuilding()"><i class="ti ti-plus"></i> Bâtiment</button>
    </div>

    <div v-if="loading" class="text-center py-4"><div class="spinner-border spinner-border-sm"></div></div>

    <template v-else>
      <div v-if="!groups.length" class="card card-body text-secondary text-center">
        Aucun bâtiment. Ajoutez un bâtiment puis ses systèmes et équipements.
      </div>

      <!-- Bâtiments -->
      <div v-for="g in groups" :key="g.building?.id ?? 'none'" class="card mb-3">
        <div class="card-header">
          <h3 class="card-title"><i class="ti ti-building text-primary"></i>{{ g.building?.name ?? 'Sans bâtiment' }}</h3>
          <div class="card-actions btn-list">
            <button v-if="g.building" class="btn btn-sm btn-primary" @click="openSysteme(g.building)"><i class="ti ti-plus"></i> Système</button>
            <div v-if="g.building" class="dropdown">
              <button class="btn btn-sm btn-action" type="button" data-bs-toggle="dropdown" aria-label="Actions du bâtiment"><i class="ti ti-dots-vertical"></i></button>
              <div class="dropdown-menu dropdown-menu-end">
                <button class="dropdown-item" type="button" @click="openBuilding(g.building)"><i class="ti ti-edit"></i> Renommer</button>
                <button class="dropdown-item text-danger" type="button" @click="removeBuilding(g.building)"><i class="ti ti-trash"></i> Supprimer</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card-body">
          <div v-if="!g.systemes.length" class="text-secondary small">Aucun système dans ce bâtiment.</div>

          <!-- Systèmes -->
          <div v-for="s in g.systemes" :key="s.id" class="border rounded-2 mb-2">
            <div class="d-flex align-items-center p-2 bg-blue-lt rounded-top">
              <i class="ti ti-cpu me-1"></i>
              <b>{{ s.name }}</b>
              <span class="badge bg-blue text-white ms-2">{{ count(s) }}</span>
              <div class="ms-auto btn-list">
                <button class="btn btn-sm" @click="openEquip(s)"><i class="ti ti-plus"></i> Équipement</button>
                <div class="dropdown">
                  <button class="btn btn-sm btn-action" type="button" data-bs-toggle="dropdown" aria-label="Actions du système"><i class="ti ti-dots-vertical"></i></button>
                  <div class="dropdown-menu dropdown-menu-end">
                    <button class="dropdown-item" type="button" @click="openSysteme(g.building, s)"><i class="ti ti-edit"></i> Modifier</button>
                    <button class="dropdown-item text-danger" type="button" @click="removeSysteme(s)"><i class="ti ti-trash"></i> Supprimer</button>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="s.description" class="px-2 pt-2 text-secondary small pre">{{ s.description }}</div>

            <div class="p-2">
              <div v-if="!s.base_equipements?.length" class="text-secondary small">Aucun équipement.</div>

              <!-- Équipements de base -->
              <div v-for="e in s.base_equipements" :key="e.id" class="equip">
                <div class="d-flex align-items-start gap-2">
                  <span class="avatar avatar-sm rounded-2 bg-primary-lt"><i class="ti ti-server"></i></span>
                  <div class="flex-fill min-w-0">
                    <div>
                      <b>{{ e.name }}</b>
                      <span v-if="e.type" class="badge bg-secondary-lt ms-1">{{ e.type }}</span>
                      <span v-if="e.modele" class="text-secondary small ms-1">{{ e.modele }}</span>
                    </div>
                    <div v-if="caracs(e).length" class="caracs">
                      <span v-for="[k, v] in caracs(e)" :key="k"><small>{{ k }}</small> {{ v }}</span>
                    </div>
                  </div>
                  <div class="btn-list flex-nowrap">
                    <button class="btn btn-sm btn-ghost-primary" title="Ajouter un équipement rattaché" @click="openEquip(s, e)"><i class="ti ti-plus"></i></button>
                    <button class="btn btn-sm btn-ghost-secondary btn-icon" title="Modifier" @click="openEquip(s, null, e)"><i class="ti ti-edit"></i></button>
                    <button class="btn btn-sm btn-ghost-danger btn-icon" title="Supprimer" @click="removeEquip(e)"><i class="ti ti-trash"></i></button>
                  </div>
                </div>

                <!-- Équipements secondaires -->
                <div v-for="c in e.children" :key="c.id" class="equip child d-flex align-items-start gap-2">
                  <span class="avatar avatar-xs rounded-2 bg-secondary-lt"><i class="ti ti-device-cctv"></i></span>
                  <div class="flex-fill min-w-0">
                    <div>
                      {{ c.name }}
                      <span v-if="c.type" class="badge bg-secondary-lt ms-1">{{ c.type }}</span>
                      <span v-if="c.modele" class="text-secondary small ms-1">{{ c.modele }}</span>
                    </div>
                    <div v-if="caracs(c).length" class="caracs">
                      <span v-for="[k, v] in caracs(c)" :key="k"><small>{{ k }}</small> {{ v }}</span>
                    </div>
                  </div>
                  <div class="btn-list flex-nowrap">
                    <button class="btn btn-sm btn-ghost-secondary btn-icon" title="Modifier" @click="openEquip(s, e, c)"><i class="ti ti-edit"></i></button>
                    <button class="btn btn-sm btn-ghost-danger btn-icon" title="Supprimer" @click="removeEquip(c)"><i class="ti ti-trash"></i></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
                <span v-if="p.kind === 'dwg'"> · à exporter en PDF pour l'annoter</span>
              </div>
            </div>
            <span class="badge bg-yellow-lt" title="Placement des équipements : prochaine étape">Placement à venir</span>
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

    <AppModal
      :show="systemeOpen"
      :title="editingSysteme ? 'Modifier le système' : `Ajouter un système${systemeBuilding ? ' — ' + systemeBuilding.name : ''}`"
      :saving="systemeSaving"
      :can-submit="!!systemeForm.name.trim()"
      :error="systemeError"
      @close="systemeOpen = false"
      @submit="submitSysteme"
    >
      <div class="mb-3">
        <label class="form-label">Type de système</label>
        <select v-model="systemeForm.systeme_id" class="form-select" @change="onCatalogue">
          <option :value="null">—</option>
          <option v-for="c in data?.catalogue" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>
      <div class="mb-3">
        <label class="form-label required">Nom</label>
        <input v-model="systemeForm.name" class="form-control" placeholder="Vidéosurveillance" required />
      </div>
      <div>
        <label class="form-label">Description</label>
        <textarea v-model="systemeForm.description" class="form-control" rows="3"></textarea>
      </div>
    </AppModal>

    <EquipementFormModal
      :show="equipOpen"
      :equipement="equipEditing"
      :systeme-id="equipSysteme?.id ?? null"
      :parent="equipParent"
      @close="equipOpen = false"
      @saved="onEquipSaved"
    />
  </div>
</template>

<style scoped>
.pre {
  white-space: pre-line;
}
.equip {
  padding: 8px 4px;
  border-bottom: 1px dashed var(--tblr-border-color);
}
.equip:last-child {
  border-bottom: 0;
}
.equip.child {
  margin-left: 2.25rem;
  padding: 6px 0;
  border-bottom: 0;
  border-left: 2px solid var(--tblr-border-color);
  padding-left: 10px;
}
.caracs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 0.8rem;
  margin-top: 2px;
}
.caracs small {
  color: var(--tblr-secondary);
}
</style>
