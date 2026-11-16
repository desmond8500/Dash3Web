<script setup>
/**
 * Gestionnaire de badges d'un projet :
 * - formulaire des informations du badge (identité, fonction, service, matricule, photo) ;
 * - modèles de badge génériques ou propres au client du projet (image de fond, couleur,
 *   orientation, style CSS), avec aperçu de chaque badge dans son modèle ;
 * - impression des badges (une page prête à imprimer ou enregistrer en PDF).
 */
import { computed, onMounted, ref } from 'vue'
import { errorMessage } from '@/api/client'
import { badgeModeles, deleteBadge, deleteBadgeModele, projetBadges, saveBadge, saveBadgeModele, uploadImage } from '@/api/dash3'
import AppModal from '@/components/AppModal.vue'

const props = defineProps({
  projet: { type: Object, required: true },
})
const emit = defineEmits(['changed'])

const badges = ref([])
const modeles = ref([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [b, m] = await Promise.all([projetBadges(props.projet.id), badgeModeles(props.projet.client_id)])
    badges.value = b
    modeles.value = m
    emit('changed', b.length)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const clientModeles = computed(() => modeles.value.filter((m) => m.client_id && Number(m.client_id) === Number(props.projet.client_id)))
const genericModeles = computed(() => modeles.value.filter((m) => !m.client_id))
/** Modèle par défaut : le premier modèle du client, sinon le premier modèle générique */
const defaultModele = computed(() => clientModeles.value[0] ?? genericModeles.value[0] ?? null)
const modeleOf = (b) => modeles.value.find((m) => m.id === b.badge_modele_id) ?? defaultModele.value

const fullname = (b) => [b.prenom, b.nom].filter(Boolean).join(' ')
const search = ref('')
const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return badges.value
  return badges.value.filter((b) => [b.prenom, b.nom, b.fonction, b.service, b.direction, b.matricule].join(' ').toLowerCase().includes(q))
})

// ---------- Formulaire badge ----------
const EMPTY = { prenom: '', nom: '', fonction: '', service: '', direction: '', matricule: '', adresse: '', badge_modele_id: '' }
const badgeOpen = ref(false)
const editingBadge = ref(null)
const badgeForm = ref({ ...EMPTY })
const photo = ref(null)
const photoPreview = ref('')
const badgeSaving = ref(false)
const badgeError = ref('')
const keepOpen = ref(false)

function setPhoto(f) {
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photo.value = f
  photoPreview.value = f ? URL.createObjectURL(f) : ''
}
function openBadge(b = null) {
  editingBadge.value = b
  badgeForm.value = { ...EMPTY, ...(b ?? {}), badge_modele_id: b?.badge_modele_id ?? defaultModele.value?.id ?? '' }
  setPhoto(null)
  badgeError.value = ''
  badgeOpen.value = true
}
const canSaveBadge = computed(() => !!(badgeForm.value.prenom?.trim() || badgeForm.value.nom?.trim()))
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

async function submitBadge() {
  if (!canSaveBadge.value) return
  badgeSaving.value = true
  badgeError.value = ''
  try {
    const f = badgeForm.value
    const payload = {
      prenom: capitalize(f.prenom?.trim()) || null,
      nom: f.nom?.trim() ? f.nom.trim().toUpperCase() : null,
      fonction: capitalize(f.fonction?.trim()) || null,
      service: capitalize(f.service?.trim()) || null,
      direction: capitalize(f.direction?.trim()) || null,
      matricule: f.matricule?.trim() || null,
      adresse: f.adresse?.trim() || null,
      badge_modele_id: f.badge_modele_id || null,
    }
    const saved = await saveBadge(editingBadge.value ? payload : { ...payload, projet_id: props.projet.id }, editingBadge.value?.id)
    if (photo.value && saved?.id) await uploadImage(`/badges/${saved.id}/photo`, photo.value)
    await load()
    if (!editingBadge.value && keepOpen.value) {
      // Saisie en série : on garde le service, la direction et le modèle
      badgeForm.value = { ...EMPTY, service: f.service, direction: f.direction, badge_modele_id: f.badge_modele_id }
      setPhoto(null)
    } else {
      badgeOpen.value = false
    }
  } catch (e) {
    badgeError.value = errorMessage(e)
  } finally {
    badgeSaving.value = false
  }
}
async function removeBadge(b) {
  if (!confirm(`Supprimer le badge de « ${fullname(b)} » ?`)) return
  try {
    await deleteBadge(b.id)
    await load()
  } catch (e) {
    error.value = errorMessage(e)
  }
}

// ---------- Modèles ----------
const modelesOpen = ref(false)
const modeleForm = ref(null)
const modeleImage = ref(null)
const modeleSaving = ref(false)
const modeleError = ref('')
function editModele(m = null) {
  modeleForm.value = {
    id: m?.id ?? null,
    name: m?.name ?? `Badge ${props.projet.client_name || ''}`.trim(),
    forClient: m ? !!m.client_id : true,
    orientation: m?.orientation ?? 'portrait',
    color: m?.color || '#1690b7',
    css: m?.css ?? '',
    file: m?.file ?? null,
  }
  modeleImage.value = null
  modeleError.value = ''
}
async function submitModele() {
  const f = modeleForm.value
  if (!f.name.trim()) return
  modeleSaving.value = true
  modeleError.value = ''
  try {
    const saved = await saveBadgeModele(
      {
        name: f.name.trim(),
        client_id: f.forClient ? props.projet.client_id : null,
        orientation: f.orientation,
        color: f.color || null,
        css: f.css?.trim() || null,
      },
      f.id,
    )
    if (modeleImage.value && saved?.id) await uploadImage(`/badge_modeles/${saved.id}/image`, modeleImage.value)
    modeleForm.value = null
    await load()
  } catch (e) {
    modeleError.value = errorMessage(e)
  } finally {
    modeleSaving.value = false
  }
}
async function removeModele(m) {
  if (!confirm(`Supprimer le modèle « ${m.name} » ? Ses ${m.badges_count} badge(s) seront conservés, sans modèle.`)) return
  try {
    await deleteBadgeModele(m.id)
    await load()
  } catch (e) {
    modeleError.value = errorMessage(e)
  }
}

// ---------- Aperçu / impression ----------
const SIZES = { portrait: { w: 54, h: 86 }, paysage: { w: 86, h: 54 } } // format carte de crédit (mm)
const sizeOf = (m) => SIZES[m?.orientation] ?? SIZES.portrait
const accentOf = (m) => m?.color || '#1690b7'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function badgeHtml(b) {
  const m = modeleOf(b)
  const { w, h } = sizeOf(m)
  const accent = accentOf(m)
  const landscape = m?.orientation === 'paysage'
  return `<div class="badge-card ${landscape ? 'landscape' : ''}" style="width:${w}mm;height:${h}mm;--accent:${esc(accent)};${esc(m?.css || '')}">
    ${m?.file ? `<img class="bg" src="${esc(m.file)}" alt="">` : '<div class="band"></div>'}
    <div class="content">
      ${b.photo ? `<img class="photo" src="${esc(b.photo)}" alt="">` : '<div class="photo empty"></div>'}
      <div class="info">
        <div class="name">${esc(fullname(b))}</div>
        ${b.fonction ? `<div class="fonction">${esc(b.fonction)}</div>` : ''}
        ${b.service || b.direction ? `<div class="service">${esc([b.service, b.direction].filter(Boolean).join(' · '))}</div>` : ''}
        ${b.matricule ? `<div class="matricule">${esc(b.matricule)}</div>` : ''}
      </div>
    </div>
  </div>`
}

const PRINT_CSS = `
  @page { margin: 8mm; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; }
  .grid { display: flex; flex-wrap: wrap; gap: 4mm; }
  .badge-card { position: relative; overflow: hidden; border: 0.2mm solid #ccc; border-radius: 3mm; background: #fff; break-inside: avoid; color: #1d273b; }
  .badge-card .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .badge-card .band { position: absolute; left: 0; right: 0; top: 0; height: 22%; background: var(--accent); }
  .badge-card .content { position: relative; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 4mm; box-sizing: border-box; gap: 2mm; }
  .badge-card.landscape .content { flex-direction: row; text-align: left; }
  .badge-card .photo { width: 24mm; height: 30mm; object-fit: cover; border-radius: 2mm; border: 0.6mm solid var(--accent); background: #f1f3f5; }
  .badge-card.landscape .photo { width: 22mm; height: 28mm; }
  .badge-card .name { font-weight: 700; font-size: 11pt; line-height: 1.15; }
  .badge-card .fonction { color: var(--accent); font-weight: 600; font-size: 8.5pt; }
  .badge-card .service { font-size: 7.5pt; color: #555; }
  .badge-card .matricule { display: inline-block; margin-top: 1mm; padding: 0.4mm 2mm; border-radius: 1mm; background: var(--accent); color: #fff; font-size: 7.5pt; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`
function printBadges(list = visible.value) {
  if (!list.length) return
  const win = window.open('', '_blank')
  if (!win) {
    error.value = "La fenêtre d'impression a été bloquée par le navigateur."
    return
  }
  win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Badges — ${esc(props.projet.name)}</title><style>${PRINT_CSS}</style></head>
    <body><div class="grid">${list.map(badgeHtml).join('')}</div>
    <script>window.addEventListener('load', () => setTimeout(() => window.print(), 300))<\/script></body></html>`)
  win.document.close()
}
</script>

<template>
  <div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <div class="d-flex flex-wrap gap-2 mb-2 align-items-center">
      <div class="input-icon flex-fill" style="max-width: 280px">
        <span class="input-icon-addon"><i class="ti ti-search"></i></span>
        <input v-model="search" class="form-control" placeholder="Nom, service, matricule…" />
      </div>
      <div class="ms-auto btn-list">
        <button class="btn" :disabled="!visible.length" title="Imprimer ou enregistrer en PDF" @click="printBadges()"><i class="ti ti-printer"></i> Imprimer</button>
        <button class="btn" @click="modelesOpen = true; modeleForm = null"><i class="ti ti-template"></i> Modèles</button>
        <button class="btn btn-primary" @click="openBadge()"><i class="ti ti-plus"></i> Badge</button>
      </div>
    </div>

    <div v-if="!loading && !clientModeles.length" class="alert alert-info py-2">
      Aucun modèle de badge propre à {{ projet.client_name || 'ce client' }}.
      <a href="#" @click.prevent="modelesOpen = true; editModele()">Créer un modèle au format du client</a>
    </div>

    <div v-if="loading" class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></div>
    <div v-else-if="!visible.length" class="card card-body text-secondary">{{ badges.length ? 'Aucun badge trouvé' : 'Aucun badge' }}</div>

    <div class="badge-grid">
      <div v-for="b in visible" :key="b.id" class="badge-item">
        <!-- Aperçu dans le modèle -->
        <div
          class="badge-preview"
          :class="{ landscape: modeleOf(b)?.orientation === 'paysage' }"
          :style="{ '--accent': accentOf(modeleOf(b)) }"
          :title="modeleOf(b)?.name || 'Sans modèle'"
          @click="openBadge(b)"
        >
          <img v-if="modeleOf(b)?.file" :src="modeleOf(b).file" alt="" class="bg" />
          <div v-else class="band"></div>
          <div class="content">
            <img v-if="b.photo" :src="b.photo" alt="" class="photo" />
            <div v-else class="photo empty"><i class="ti ti-user"></i></div>
            <div class="info">
              <div class="name">{{ fullname(b) }}</div>
              <div v-if="b.fonction" class="fonction">{{ b.fonction }}</div>
              <div v-if="b.service || b.direction" class="service">{{ [b.service, b.direction].filter(Boolean).join(' · ') }}</div>
              <div v-if="b.matricule" class="matricule">{{ b.matricule }}</div>
            </div>
          </div>
        </div>
        <div class="d-flex justify-content-center gap-1 mt-1">
          <button class="btn btn-sm btn-icon" title="Modifier" @click="openBadge(b)"><i class="ti ti-edit"></i></button>
          <button class="btn btn-sm btn-icon" title="Imprimer ce badge" @click="printBadges([b])"><i class="ti ti-printer"></i></button>
          <button class="btn btn-sm btn-icon btn-ghost-danger" title="Supprimer" @click="removeBadge(b)"><i class="ti ti-trash"></i></button>
        </div>
      </div>
    </div>
  </div>

  <!-- Formulaire du badge -->
  <AppModal
    :show="badgeOpen"
    :title="editingBadge ? 'Modifier le badge' : 'Nouveau badge'"
    size="modal-lg"
    :saving="badgeSaving"
    :can-submit="canSaveBadge"
    :error="badgeError"
    @close="badgeOpen = false"
    @submit="submitBadge"
  >
    <div class="row">
      <div class="col-md-8">
        <div class="row">
          <div class="col-md-6 mb-3">
            <label class="form-label">Prénom</label>
            <input v-model="badgeForm.prenom" class="form-control" autofocus />
          </div>
          <div class="col-md-6 mb-3">
            <label class="form-label">Nom</label>
            <input v-model="badgeForm.nom" class="form-control" />
          </div>
          <div class="col-md-6 mb-3">
            <label class="form-label">Fonction</label>
            <input v-model="badgeForm.fonction" class="form-control" placeholder="Agent de sécurité" />
          </div>
          <div class="col-md-6 mb-3">
            <label class="form-label">Matricule</label>
            <input v-model="badgeForm.matricule" class="form-control" />
          </div>
          <div class="col-md-6 mb-3">
            <label class="form-label">Service</label>
            <input v-model="badgeForm.service" class="form-control" />
          </div>
          <div class="col-md-6 mb-3">
            <label class="form-label">Direction</label>
            <input v-model="badgeForm.direction" class="form-control" />
          </div>
          <div class="col-12 mb-3">
            <label class="form-label">Adresse</label>
            <input v-model="badgeForm.adresse" class="form-control" />
          </div>
          <div class="col-12">
            <label class="form-label">Modèle</label>
            <select v-model="badgeForm.badge_modele_id" class="form-select">
              <option value="">Sans modèle</option>
              <optgroup v-if="clientModeles.length" :label="projet.client_name || 'Client'">
                <option v-for="m in clientModeles" :key="m.id" :value="m.id">{{ m.name }}</option>
              </optgroup>
              <optgroup v-if="genericModeles.length" label="Modèles génériques">
                <option v-for="m in genericModeles" :key="m.id" :value="m.id">{{ m.name }}</option>
              </optgroup>
            </select>
          </div>
        </div>
      </div>
      <div class="col-md-4 text-center">
        <label class="form-label">Photo</label>
        <img v-if="photoPreview || editingBadge?.photo" :src="photoPreview || editingBadge.photo" alt="" class="badge-photo-preview rounded mb-2" />
        <div v-else class="badge-photo-preview rounded mb-2 d-flex align-items-center justify-content-center bg-secondary-lt mx-auto">
          <i class="ti ti-user" style="font-size: 2.5rem"></i>
        </div>
        <input type="file" accept="image/*" class="form-control form-control-sm" @change="setPhoto($event.target.files?.[0] ?? null)" />
        <div class="form-hint">Photo d'identité, 4 Mo max.</div>
      </div>
    </div>
    <label v-if="!editingBadge" class="form-check mt-3 mb-0">
      <input v-model="keepOpen" type="checkbox" class="form-check-input" />
      <span class="form-check-label">Saisie en série (garder la fenêtre ouverte après l'enregistrement)</span>
    </label>
  </AppModal>

  <!-- Modèles de badge -->
  <AppModal :show="modelesOpen" title="Modèles de badge" size="modal-lg" hide-footer :error="modeleError" @close="modelesOpen = false">
    <template v-if="!modeleForm">
      <div class="d-flex mb-2">
        <div class="text-secondary small">Les modèles du client ne sont proposés que pour ses projets ; les modèles génériques partout.</div>
        <button class="btn btn-primary btn-sm ms-auto" @click="editModele()"><i class="ti ti-plus"></i> Modèle</button>
      </div>
      <div class="list-group">
        <div v-if="!modeles.length" class="list-group-item text-secondary">Aucun modèle</div>
        <div v-for="m in [...clientModeles, ...genericModeles]" :key="m.id" class="list-group-item d-flex align-items-center gap-2">
          <img v-if="m.file" :src="m.file" alt="" class="avatar rounded-2" style="object-fit: cover" />
          <span v-else class="avatar rounded-2" :style="{ background: m.color || '#1690b7', color: '#fff' }"><i class="ti ti-id-badge-2"></i></span>
          <div class="min-w-0">
            <div class="fw-medium text-truncate">{{ m.name }}</div>
            <div class="text-secondary small">
              <span v-if="m.client_id" class="badge bg-green-lt me-1">{{ m.client_name || projet.client_name }}</span>
              <span v-else class="badge bg-secondary-lt me-1">Générique</span>
              {{ m.orientation === 'paysage' ? 'Paysage' : 'Portrait' }} · {{ m.badges_count }} badge(s)
            </div>
          </div>
          <div class="ms-auto btn-list flex-nowrap">
            <button class="btn btn-sm btn-icon" title="Modifier" @click="editModele(m)"><i class="ti ti-edit"></i></button>
            <button class="btn btn-sm btn-icon btn-ghost-danger" title="Supprimer" @click="removeModele(m)"><i class="ti ti-trash"></i></button>
          </div>
        </div>
      </div>
    </template>

    <!-- Pas de <form> ici : AppModal en contient déjà un -->
    <div v-else>
      <div class="row">
        <div class="col-md-7 mb-3">
          <label class="form-label required">Nom du modèle</label>
          <input v-model="modeleForm.name" class="form-control" required />
        </div>
        <div class="col-md-5 mb-3">
          <label class="form-label">Orientation</label>
          <select v-model="modeleForm.orientation" class="form-select">
            <option value="portrait">Portrait (54 × 86 mm)</option>
            <option value="paysage">Paysage (86 × 54 mm)</option>
          </select>
        </div>
        <div class="col-md-7 mb-3">
          <label class="form-label">Image de fond (charte du client)</label>
          <input type="file" accept="image/*" class="form-control" @change="modeleImage = $event.target.files?.[0] ?? null" />
          <div class="form-hint">Fond complet du badge au bon format ; laissez vide pour un bandeau de couleur.</div>
        </div>
        <div class="col-md-5 mb-3">
          <label class="form-label">Couleur d'accent</label>
          <input v-model="modeleForm.color" type="color" class="form-control form-control-color" />
        </div>
        <div class="col-12 mb-3">
          <label class="form-label">Style CSS (avancé)</label>
          <input v-model="modeleForm.css" class="form-control font-monospace" placeholder="color: #fff; font-family: Georgia;" />
        </div>
        <div class="col-12">
          <label class="form-check">
            <input v-model="modeleForm.forClient" type="checkbox" class="form-check-input" />
            <span class="form-check-label">Modèle propre à {{ projet.client_name || 'ce client' }}</span>
          </label>
        </div>
      </div>
      <div class="d-flex gap-2 mt-3">
        <button type="button" class="btn" @click="modeleForm = null"><i class="ti ti-arrow-left"></i> Retour</button>
        <button type="button" class="btn btn-primary ms-auto" :disabled="modeleSaving || !modeleForm.name.trim()" @click="submitModele">
          <span v-if="modeleSaving" class="spinner-border spinner-border-sm me-1"></span>Enregistrer
        </button>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
.badge-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
/* Aperçu à l'échelle : 54 × 86 mm ≈ 162 × 258 px */
.badge-preview {
  --w: 162px;
  --h: 258px;
  position: relative;
  width: var(--w);
  height: var(--h);
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid var(--tblr-border-color);
  background: #fff;
  color: #1d273b;
  cursor: pointer;
  box-shadow: var(--tblr-box-shadow-card);
}
.badge-preview.landscape {
  --w: 258px;
  --h: 162px;
}
.badge-preview .bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.badge-preview .band {
  position: absolute;
  inset: 0 0 auto 0;
  height: 22%;
  background: var(--accent);
}
.badge-preview .content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 10px;
  gap: 6px;
}
.badge-preview.landscape .content {
  flex-direction: row;
  text-align: left;
}
.badge-preview .photo {
  width: 72px;
  height: 90px;
  object-fit: cover;
  border-radius: 6px;
  border: 2px solid var(--accent);
  background: #f1f3f5;
  flex-shrink: 0;
}
.badge-preview .photo.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: #adb5bd;
}
.badge-preview .name {
  font-weight: 700;
  line-height: 1.15;
}
.badge-preview .fonction {
  color: var(--accent);
  font-weight: 600;
  font-size: 0.8rem;
}
.badge-preview .service {
  font-size: 0.7rem;
  color: #555;
}
.badge-preview .matricule {
  display: inline-block;
  margin-top: 2px;
  padding: 0 6px;
  border-radius: 3px;
  background: var(--accent);
  color: #fff;
  font-size: 0.7rem;
}
.badge-photo-preview {
  width: 120px;
  height: 150px;
  object-fit: cover;
  display: block;
  margin: 0 auto;
}
</style>
