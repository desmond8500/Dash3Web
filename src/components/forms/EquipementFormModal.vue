<script setup>
/**
 * Équipement d'un système : de base (ex. NVR) ou secondaire (ex. caméra, disque dur).
 * Les caractéristiques sont libres (nom / valeur), avec des suggestions selon le type.
 */
import { computed, reactive, ref, watch } from 'vue'
import { errorMessage } from '@/api/client'
import { saveEquipement } from '@/api/dash3'
import AppModal from '@/components/AppModal.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  equipement: { type: Object, default: null },
  systemeId: { type: Number, default: null },
  /** Équipement de base auquel rattacher un équipement secondaire */
  parent: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

// Caractéristiques proposées selon le type (modifiables)
const PRESETS = {
  nvr: ['Adresse IP', 'Masque', 'Passerelle', 'Nombre de ports', 'Identifiant', 'Mot de passe'],
  dvr: ['Adresse IP', 'Nombre de voies', 'Identifiant', 'Mot de passe'],
  'caméra': ['Type', 'Adresse IP', 'Masque', 'Port', 'Emplacement'],
  camera: ['Type', 'Adresse IP', 'Masque', 'Port', 'Emplacement'],
  'disque dur': ['Capacité', 'Numéro de série'],
  switch: ['Adresse IP', 'Nombre de ports', 'PoE'],
  centrale: ['Adresse IP', 'Nombre de zones', 'Code installateur'],
  'détecteur': ['Zone', 'Emplacement'],
  clavier: ['Adresse', 'Emplacement'],
}
const TYPES_BASE = ['NVR', 'DVR', 'Centrale', 'Switch', 'Serveur', 'Contrôleur']
const TYPES_SECONDARY = ['Caméra', 'Disque dur', 'Détecteur', 'Clavier', 'Sirène', 'Lecteur', 'Point d’accès']

const isSecondary = computed(() => !!(props.parent || props.equipement?.parent_id))
const typeSuggestions = computed(() => (isSecondary.value ? TYPES_SECONDARY : TYPES_BASE))

const form = reactive({ name: '', type: '', modele: '', description: '' })
const rows = ref([]) // [{ key, value }]
const saving = ref(false)
const error = ref('')

watch(
  () => props.show,
  (open) => {
    if (!open) return
    const e = props.equipement
    Object.assign(form, { name: e?.name ?? '', type: e?.type ?? '', modele: e?.modele ?? '', description: e?.description ?? '' })
    rows.value = Object.entries(e?.caracteristiques ?? {}).map(([key, value]) => ({ key, value: value ?? '' }))
    if (!rows.value.length) rows.value.push({ key: '', value: '' })
    error.value = ''
  },
)

// Ajoute les caractéristiques suggérées pour le type choisi (sans doublon)
function applyPreset() {
  const keys = PRESETS[form.type.trim().toLowerCase()] || []
  const existing = new Set(rows.value.map((r) => r.key.trim().toLowerCase()))
  rows.value = rows.value.filter((r) => r.key.trim() || r.value.trim())
  for (const k of keys) if (!existing.has(k.toLowerCase())) rows.value.push({ key: k, value: '' })
  if (!rows.value.length) rows.value.push({ key: '', value: '' })
}

async function submit() {
  saving.value = true
  error.value = ''
  try {
    const caracteristiques = {}
    for (const r of rows.value) if (r.key.trim()) caracteristiques[r.key.trim()] = r.value.trim() || null
    const payload = {
      name: form.name.trim(),
      type: form.type.trim() || null,
      modele: form.modele.trim() || null,
      description: form.description.trim() || null,
      caracteristiques,
    }
    if (!props.equipement) {
      payload.installation_systeme_id = props.systemeId
      payload.parent_id = props.parent?.id ?? null
    }
    await saveEquipement(payload, props.equipement?.id)
    emit('saved')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

const title = computed(() => {
  if (props.equipement) return "Modifier l'équipement"
  return props.parent ? `Équipement rattaché à ${props.parent.name}` : 'Équipement de base'
})
</script>

<template>
  <AppModal :show="show" :title="title" size="modal-lg" :saving="saving" :can-submit="!!form.name.trim()" :error="error" @close="emit('close')" @submit="submit">
    <div class="row">
      <div class="col-md-5 mb-3">
        <label class="form-label required">Nom</label>
        <input v-model="form.name" class="form-control" :placeholder="isSecondary ? 'Caméra entrée' : 'NVR principal'" required />
      </div>
      <div class="col-md-4 mb-3">
        <label class="form-label">Type</label>
        <div class="input-group">
          <input v-model="form.type" class="form-control" list="equipement-types" placeholder="Choisir ou saisir" />
          <button type="button" class="btn btn-icon" title="Ajouter les caractéristiques habituelles" @click="applyPreset"><i class="ti ti-wand"></i></button>
        </div>
        <datalist id="equipement-types">
          <option v-for="t in typeSuggestions" :key="t" :value="t" />
        </datalist>
      </div>
      <div class="col-md-3 mb-3">
        <label class="form-label">Modèle</label>
        <input v-model="form.modele" class="form-control" />
      </div>

      <div class="col-12 mb-2">
        <label class="form-label">Caractéristiques</label>
        <div v-for="(r, i) in rows" :key="i" class="row g-2 mb-2">
          <div class="col-5"><input v-model="r.key" class="form-control" placeholder="Adresse IP" /></div>
          <div class="col"><input v-model="r.value" class="form-control" placeholder="192.168.1.10" /></div>
          <div class="col-auto">
            <button type="button" class="btn btn-icon btn-ghost-danger" title="Retirer" @click="rows.splice(i, 1)"><i class="ti ti-x"></i></button>
          </div>
        </div>
        <button type="button" class="btn btn-sm" @click="rows.push({ key: '', value: '' })"><i class="ti ti-plus"></i> Caractéristique</button>
      </div>

      <div class="col-12 mt-2">
        <label class="form-label">Description</label>
        <textarea v-model="form.description" class="form-control" rows="2"></textarea>
      </div>
    </div>
  </AppModal>
</template>
