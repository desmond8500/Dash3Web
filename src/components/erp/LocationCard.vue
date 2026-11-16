<script setup>
/**
 * Carte « Localisation » : adresse et coordonnées GPS, carte intégrée (OpenStreetMap),
 * liens Google Maps (ouvrir, itinéraire). Utilisée pour les projets et les fournisseurs.
 * Les mêmes champs (address, latitude, longitude) sont lus par Dash3Mobile.
 */
import { computed, ref } from 'vue'
import { errorMessage } from '@/api/client'
import AppModal from '@/components/AppModal.vue'

const props = defineProps({
  title: { type: String, default: 'Localisation' },
  address: { type: String, default: '' },
  latitude: { type: [Number, String], default: null },
  longitude: { type: [Number, String], default: null },
  /** ({ address, latitude, longitude }) => Promise */
  save: { type: Function, required: true },
})
const emit = defineEmits(['saved'])

const lat = computed(() => (props.latitude === null || props.latitude === '' ? null : Number(props.latitude)))
const lng = computed(() => (props.longitude === null || props.longitude === '' ? null : Number(props.longitude)))
const hasCoords = computed(() => Number.isFinite(lat.value) && Number.isFinite(lng.value))
const query = computed(() => (hasCoords.value ? `${lat.value},${lng.value}` : props.address || ''))

const embedUrl = computed(() => {
  if (hasCoords.value) {
    const d = 0.006
    const bbox = [lng.value - d, lat.value - d, lng.value + d, lat.value + d].map((n) => n.toFixed(6)).join(',')
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.value},${lng.value}`
  }
  if (props.address) return `https://maps.google.com/maps?q=${encodeURIComponent(props.address)}&z=15&output=embed`
  return ''
})
const mapsUrl = computed(() => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.value)}`)
const routeUrl = computed(() => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query.value)}`)

// ---------- Modification ----------
const open = ref(false)
const form = ref({ address: '', latitude: '', longitude: '', link: '' })
const saving = ref(false)
const error = ref('')
const locating = ref(false)

function edit() {
  form.value = { address: props.address || '', latitude: lat.value ?? '', longitude: lng.value ?? '', link: '' }
  error.value = ''
  open.value = true
}

/** Coordonnées tirées d'un lien Google Maps / OpenStreetMap ou d'un texte « 14.69, -17.44 » */
function parseCoords(text) {
  const patterns = [/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, /[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i, /mlat=(-?\d+(?:\.\d+)?).*mlon=(-?\d+(?:\.\d+)?)/, /^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return { latitude: Number(m[1]), longitude: Number(m[2]) }
  }
  return null
}
function onLink() {
  const c = parseCoords(form.value.link || '')
  if (c) Object.assign(form.value, c)
}

function useMyPosition() {
  if (!navigator.geolocation) {
    error.value = "La géolocalisation n'est pas disponible sur cet appareil."
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      form.value.latitude = Number(pos.coords.latitude.toFixed(7))
      form.value.longitude = Number(pos.coords.longitude.toFixed(7))
      locating.value = false
    },
    (e) => {
      error.value = `Position introuvable : ${e.message}`
      locating.value = false
    },
    { enableHighAccuracy: true, timeout: 15000 },
  )
}

const validCoords = computed(() => {
  const { latitude: a, longitude: b } = form.value
  if (a === '' && b === '') return true
  return a !== '' && b !== '' && Math.abs(Number(a)) <= 90 && Math.abs(Number(b)) <= 180
})

async function submit() {
  saving.value = true
  error.value = ''
  try {
    const f = form.value
    const payload = {
      address: f.address.trim() || null,
      latitude: f.latitude === '' ? null : Number(f.latitude),
      longitude: f.longitude === '' ? null : Number(f.longitude),
    }
    await props.save(payload)
    open.value = false
    emit('saved', payload)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="card">
    <div class="card-header">
      <h3 class="card-title"><i class="ti ti-map-pin"></i>{{ title }}</h3>
      <button class="btn btn-sm ms-auto" title="Modifier la localisation" @click="edit"><i class="ti ti-edit"></i></button>
    </div>
    <template v-if="embedUrl">
      <iframe :src="embedUrl" class="location-map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Carte"></iframe>
      <div class="card-body py-2">
        <div v-if="address" class="small"><i class="ti ti-map-pin me-1 text-secondary"></i>{{ address }}</div>
        <div v-if="hasCoords" class="small text-secondary">GPS : {{ lat.toFixed(5) }}, {{ lng.toFixed(5) }}</div>
        <div class="btn-list mt-2">
          <a :href="mapsUrl" target="_blank" rel="noopener" class="btn btn-sm"><i class="ti ti-external-link"></i> Google Maps</a>
          <a :href="routeUrl" target="_blank" rel="noopener" class="btn btn-sm"><i class="ti ti-route"></i> Itinéraire</a>
        </div>
      </div>
    </template>
    <div v-else class="card-body text-secondary">
      Aucune localisation.
      <a href="#" @click.prevent="edit">Ajouter une adresse ou une position GPS</a>
    </div>
  </div>

  <AppModal :show="open" :title="title" :saving="saving" :can-submit="validCoords" :error="error" @close="open = false" @submit="submit">
    <div class="mb-3">
      <label class="form-label">Adresse</label>
      <input v-model="form.address" class="form-control" placeholder="Rue, quartier, ville" />
    </div>
    <div class="mb-3">
      <label class="form-label">Lien de carte ou coordonnées</label>
      <input v-model="form.link" class="form-control" placeholder="Collez un lien Google Maps ou « 14.6928, -17.4467 »" @input="onLink" />
      <div class="form-hint">Les coordonnées sont extraites automatiquement du lien.</div>
    </div>
    <div class="row g-2 align-items-end">
      <div class="col">
        <label class="form-label">Latitude</label>
        <input v-model="form.latitude" type="number" step="any" min="-90" max="90" class="form-control" />
      </div>
      <div class="col">
        <label class="form-label">Longitude</label>
        <input v-model="form.longitude" type="number" step="any" min="-180" max="180" class="form-control" />
      </div>
      <div class="col-auto">
        <button type="button" class="btn" :disabled="locating" title="Utiliser la position de cet appareil" @click="useMyPosition">
          <span v-if="locating" class="spinner-border spinner-border-sm me-1"></span><i v-else class="ti ti-current-location"></i> Ma position
        </button>
      </div>
    </div>
    <div v-if="!validCoords" class="text-danger small mt-2">Renseignez la latitude et la longitude (ou laissez les deux vides).</div>
  </AppModal>
</template>

<style scoped>
.location-map {
  width: 100%;
  height: 220px;
  border: 0;
  display: block;
}
</style>
