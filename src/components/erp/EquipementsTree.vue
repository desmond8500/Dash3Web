<script setup>
/**
 * Systèmes d'un bâtiment › équipements de base › équipements secondaires.
 * Chaque équipement : article lié, icône (via les tags de l'article), local,
 * quantité et nombre déjà posé sur les plans ; modifier, dupliquer, supprimer.
 */
import { ref } from 'vue'
import api, { errorMessage } from '@/api/client'
import { deleteEquipement, deleteInstallationSysteme, saveInstallationSysteme } from '@/api/dash3'
import EquipementFormModal from '@/components/forms/EquipementFormModal.vue'
import AppModal from '@/components/AppModal.vue'

const props = defineProps({
  projetId: { type: [Number, String], required: true },
  building: { type: Object, default: null },
  systemes: { type: Array, default: () => [] },
  catalogue: { type: Array, default: () => [] },
  /** Niveaux et locaux du bâtiment */
  stages: { type: Array, default: () => [] },
})
const emit = defineEmits(['changed'])
const error = ref('')

const run = async (fn) => {
  error.value = ''
  try {
    await fn()
    emit('changed')
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Systèmes ----------
const systemeOpen = ref(false)
const editingSysteme = ref(null)
const systemeForm = ref({ name: '', systeme_id: null, description: '' })
const systemeSaving = ref(false)
const systemeError = ref('')
function openSysteme(s = null) {
  editingSysteme.value = s
  systemeForm.value = { name: s?.name ?? '', systeme_id: s?.systeme_id ?? null, description: s?.description ?? '' }
  systemeError.value = ''
  systemeOpen.value = true
}
function onCatalogue() {
  const c = props.catalogue.find((x) => x.id === systemeForm.value.systeme_id)
  if (c && !systemeForm.value.name.trim()) systemeForm.value.name = c.name
}
async function submitSysteme() {
  systemeSaving.value = true
  systemeError.value = ''
  try {
    const payload = { ...systemeForm.value, name: systemeForm.value.name.trim() }
    if (!editingSysteme.value) {
      payload.projet_id = Number(props.projetId)
      payload.building_id = props.building?.id ?? null
    }
    await saveInstallationSysteme(payload, editingSysteme.value?.id)
    systemeOpen.value = false
    emit('changed')
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
function onEquipSaved() {
  equipOpen.value = false
  emit('changed')
}
function removeEquip(e) {
  const extra = e.children?.length ? ` et ses ${e.children.length} équipement(s) rattaché(s)` : ''
  if (!confirm(`Supprimer « ${e.name} »${extra} ?`)) return
  run(() => deleteEquipement(e.id))
}
const duplicate = (e) => run(() => api.post(`/equipements/${e.id}/duplicate`))

const caracs = (e) => Object.entries(e.caracteristiques || {}).filter(([, v]) => v !== null && v !== '')
const count = (s) => (s.base_equipements || []).reduce((n, e) => n + (e.quantite || 1) + (e.children || []).reduce((m, c) => m + (c.quantite || 1), 0), 0)
const roomName = (e) => {
  for (const st of props.stages) {
    const r = (st.rooms || []).find((x) => x.id === e.room_id)
    if (r) return `${st.name} › ${r.name}`
    if (st.id === e.stage_id) return st.name
  }
  return null
}
const placedClass = (e) => (e.placed >= (e.quantite || 1) ? 'bg-green-lt' : e.placed ? 'bg-yellow-lt' : 'bg-secondary-lt')
defineExpose({ openSysteme })
</script>

<template>
  <div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-if="!systemes.length" class="text-secondary small">Aucun système.</div>

    <div v-for="s in systemes" :key="s.id" class="border rounded-2 mb-2">
      <div class="d-flex align-items-center p-2 bg-blue-lt rounded-top">
        <i class="ti ti-cpu me-1"></i>
        <b>{{ s.name }}</b>
        <span class="badge bg-blue text-white ms-2" title="Nombre d'équipements">{{ count(s) }}</span>
        <div class="ms-auto btn-list">
          <button class="btn btn-sm" @click="openEquip(s)"><i class="ti ti-plus"></i> Équipement</button>
          <div class="dropdown">
            <button class="btn btn-sm btn-action" type="button" data-bs-toggle="dropdown" aria-label="Actions du système"><i class="ti ti-dots-vertical"></i></button>
            <div class="dropdown-menu dropdown-menu-end">
              <button class="dropdown-item" type="button" @click="openSysteme(s)"><i class="ti ti-edit"></i> Modifier</button>
              <button class="dropdown-item text-danger" type="button" @click="removeSysteme(s)"><i class="ti ti-trash"></i> Supprimer</button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="s.description" class="px-2 pt-2 text-secondary small pre">{{ s.description }}</div>

      <div class="p-2">
        <div v-if="!s.base_equipements?.length" class="text-secondary small">Aucun équipement.</div>

        <template v-for="e in s.base_equipements" :key="e.id">
          <div class="equip">
            <div v-for="(item, level) in [e, ...(e.children || [])]" :key="item.id" class="d-flex align-items-start gap-2" :class="{ child: level > 0 }">
              <span
                class="avatar rounded-2"
                :class="[level ? 'avatar-xs' : 'avatar-sm', item.icon?.image_url ? '' : level ? 'bg-secondary-lt' : 'bg-primary-lt']"
                :style="item.icon?.image_url ? { backgroundImage: `url(${item.icon.image_url})` } : item.icon?.color ? { color: item.icon.color } : null"
              >
                <i v-if="!item.icon?.image_url" :class="['ti', item.icon?.tabler || (level ? 'ti-device-cctv' : 'ti-server')]"></i>
              </span>
              <div class="flex-fill min-w-0">
                <div>
                  <b v-if="!level">{{ item.name }}</b><span v-else>{{ item.name }}</span>
                  <span v-if="item.type" class="badge bg-secondary-lt ms-1">{{ item.type }}</span>
                  <span v-if="item.modele" class="text-secondary small ms-1">{{ item.modele }}</span>
                  <span class="badge ms-1" :class="placedClass(item)" title="Posés sur les plans / quantité">
                    <i class="ti ti-map-pin"></i> {{ item.placed ?? 0 }}/{{ item.quantite || 1 }}
                  </span>
                </div>
                <div class="small text-secondary">
                  <span v-if="item.article"><i class="ti ti-package"></i> {{ item.article.designation }}</span>
                  <span v-if="roomName(item)" class="ms-2"><i class="ti ti-door"></i> {{ roomName(item) }}</span>
                </div>
                <div v-if="caracs(item).length" class="caracs">
                  <span v-for="[k, v] in caracs(item)" :key="k"><small>{{ k }}</small> {{ v }}</span>
                </div>
              </div>
              <div class="btn-list flex-nowrap">
                <button v-if="!level" class="btn btn-sm btn-ghost-primary btn-icon" title="Ajouter un équipement rattaché" @click="openEquip(s, e)">
                  <i class="ti ti-plus"></i>
                </button>
                <div class="dropdown">
                  <button class="btn btn-sm btn-action" type="button" data-bs-toggle="dropdown" aria-label="Actions"><i class="ti ti-dots-vertical"></i></button>
                  <div class="dropdown-menu dropdown-menu-end">
                    <button class="dropdown-item" type="button" @click="openEquip(s, level ? e : null, item)"><i class="ti ti-edit me-1"></i> Modifier</button>
                    <button class="dropdown-item" type="button" @click="duplicate(item)"><i class="ti ti-copy me-1"></i> Dupliquer</button>
                    <button class="dropdown-item text-danger" type="button" @click="removeEquip(item)"><i class="ti ti-trash me-1"></i> Supprimer</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <AppModal
      :show="systemeOpen"
      :title="editingSysteme ? 'Modifier le système' : `Ajouter un système${building ? ' — ' + building.name : ''}`"
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
          <option v-for="c in catalogue" :key="c.id" :value="c.id">{{ c.name }}</option>
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
      :stages="stages"
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
.child {
  margin-left: 2.25rem;
  margin-top: 6px;
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
