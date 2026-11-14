<script setup>
/**
 * Équipement d'un système : de base (ex. NVR) ou secondaire (ex. caméra, disque dur).
 * Les caractéristiques sont libres (nom / valeur), avec des suggestions selon le type.
 */
import { computed, reactive, ref, watch } from 'vue'
import api, { errorMessage, normalizeList } from '@/api/client'
import { saveEquipement } from '@/api/dash3'
import AppModal from '@/components/AppModal.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  equipement: { type: Object, default: null },
  systemeId: { type: Number, default: null },
  /** Équipement de base auquel rattacher un équipement secondaire */
  parent: { type: Object, default: null },
  /** Niveaux du bâtiment avec leurs locaux : [{ id, name, rooms: [{ id, name }] }] */
  stages: { type: Array, default: () => [] },
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

const form = reactive({ name: '', type: '', modele: '', description: '', quantite: 1, room_id: '', stage_id: '' })
const article = ref(null) // { id, designation, reference, image_url, tag_names }
const rows = ref([]) // [{ key, value }]
const saving = ref(false)
const error = ref('')

watch(
  () => props.show,
  (open) => {
    if (!open) return
    const e = props.equipement
    Object.assign(form, {
      name: e?.name ?? '',
      type: e?.type ?? '',
      modele: e?.modele ?? '',
      description: e?.description ?? '',
      quantite: e?.quantite ?? 1,
      room_id: e?.room_id ?? '',
      stage_id: e?.stage_id ?? '',
    })
    article.value = e?.article ?? null
    articleSearch.value = ''
    articleResults.value = []
    rows.value = Object.entries(e?.caracteristiques ?? {}).map(([key, value]) => ({ key, value: value ?? '' }))
    if (!rows.value.length) rows.value.push({ key: '', value: '' })
    error.value = ''
  },
)

// ---------- Article lié (stock) : le type vient de ses tags ----------
const articleSearch = ref('')
const articleResults = ref([])
const articleLoading = ref(false)
let articleTimer
watch(articleSearch, (q) => {
  clearTimeout(articleTimer)
  if (q.trim().length < 2) {
    articleResults.value = []
    return
  }
  articleTimer = setTimeout(async () => {
    articleLoading.value = true
    try {
      const { data } = await api.get('/items', { params: { search: q.trim(), per_page: 8 } })
      articleResults.value = normalizeList(data).items
    } catch {
      articleResults.value = []
    } finally {
      articleLoading.value = false
    }
  }, 300)
})
const tagsOf = (a) => a?.tag_names ?? (a?.tags ?? []).map((t) => (typeof t === 'string' ? t : t.name?.fr ?? t.name)).filter(Boolean)
function pickArticle(a) {
  article.value = {
    id: a.id,
    designation: a.designation,
    reference: a.reference,
    image_url: a.image_url ?? a.image ?? null,
    tag_names: tagsOf(a),
  }
  articleSearch.value = ''
  articleResults.value = []
  if (!form.name.trim()) form.name = a.designation
  if (!form.modele.trim() && a.reference) form.modele = a.reference
  const tag = article.value.tag_names[0]
  if (tag) {
    form.type = tag.charAt(0).toUpperCase() + tag.slice(1)
    applyPreset()
  }
}

// Niveau / local : choisir un local fixe le niveau
const rooms = computed(() => props.stages.flatMap((st) => (st.rooms ?? []).map((r) => ({ ...r, stage: st }))))
function onRoom() {
  const r = rooms.value.find((x) => x.id === form.room_id)
  if (r) form.stage_id = r.stage.id
}

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
      article_id: article.value?.id ?? null,
      quantite: Math.max(1, Number(form.quantite) || 1),
      stage_id: form.stage_id || null,
      room_id: form.room_id || null,
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
        <input v-model="form.name" class="form-control" placeholder="Nom équipement" required />
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

      <!-- Article du stock -->
      <div class="col-md-8 mb-3">
        <label class="form-label">Article lié</label>
        <div v-if="article" class="d-flex align-items-center gap-2 border rounded p-2">
          <span class="avatar avatar-sm rounded-2" :style="article.image_url ? { backgroundImage: `url(${article.image_url})` } : null">
            <i v-if="!article.image_url" class="ti ti-package"></i>
          </span>
          <div class="flex-fill min-w-0">
            <div class="fw-medium text-truncate">{{ article.designation }}</div>
            <div class="small text-secondary">
              {{ article.reference }}
              <span v-for="t in article.tag_names" :key="t" class="badge bg-azure-lt ms-1">{{ t }}</span>
            </div>
          </div>
          <button type="button" class="btn btn-icon btn-ghost-danger" title="Retirer l'article" @click="article = null"><i class="ti ti-x"></i></button>
        </div>
        <div v-else class="position-relative">
          <div class="input-icon">
            <span class="input-icon-addon"><i class="ti ti-search"></i></span>
            <input v-model="articleSearch" class="form-control" placeholder="Rechercher un article du stock" />
          </div>
          <div v-if="articleLoading || articleResults.length" class="dropdown-menu show w-100">
            <div v-if="articleLoading" class="dropdown-item text-secondary">Recherche…</div>
            <button v-for="a in articleResults" :key="a.id" type="button" class="dropdown-item" @click="pickArticle(a)">
              <span class="text-truncate">{{ a.designation }}</span>
              <span class="ms-auto text-secondary small">{{ a.reference }}</span>
            </button>
          </div>
        </div>
      </div>
      <div class="col-md-4 mb-3">
        <label class="form-label">Quantité</label>
        <input v-model.number="form.quantite" type="number" min="1" class="form-control" />
        <div class="form-hint">Synchronisée avec les plans</div>
      </div>

      <!-- Emplacement -->
      <div v-if="stages.length" class="col-md-6 mb-3">
        <label class="form-label">Local</label>
        <select v-model="form.room_id" class="form-select" @change="onRoom">
          <option value="">—</option>
          <optgroup v-for="st in stages" :key="st.id" :label="st.name">
            <option v-for="r in st.rooms" :key="r.id" :value="r.id">{{ r.name }}</option>
          </optgroup>
        </select>
      </div>
      <div v-if="stages.length" class="col-md-6 mb-3">
        <label class="form-label">Niveau</label>
        <select v-model="form.stage_id" class="form-select" :disabled="!!form.room_id">
          <option value="">—</option>
          <option v-for="st in stages" :key="st.id" :value="st.id">{{ st.name }}</option>
        </select>
      </div>

      <div class="col-12 mb-2">
        <label class="form-label">Caractéristiques</label>
        <div v-for="(r, i) in rows" :key="i" class="row g-2 mb-2">
          <div class="col-5"><input v-model="r.key" class="form-control" placeholder="Nom" /></div>
          <div class="col"><input v-model="r.value" class="form-control" placeholder="Valeur" /></div>
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
