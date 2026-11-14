<script setup>
/**
 * Éditeur de plan : afficher le plan (image ou PDF, DWG converti), placer les équipements
 * de l'installation dessus, les déplacer, enregistrer et exporter un PDF annoté.
 */
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { errorMessage } from '@/api/client'
import { duplicateEquipement, getInstallations, getProjet, planFile, planMarkers, savePlanMarkers } from '@/api/dash3'
import { PALETTE, exportAnnotatedPdf, loadPlan, pageSize, renderPage } from '@/utils/planRender'
import PageHeader from '@/components/PageHeader.vue'
import EquipementFormModal from '@/components/forms/EquipementFormModal.vue'

const route = useRoute()
const projetId = computed(() => route.params.id)
const planId = computed(() => route.params.planId)

const projet = ref(null)
const plan = ref(null)
// Document pdf.js / image : hors réactivité profonde de Vue. pdf.js utilise des champs
// privés (#…) qui ne sont pas accessibles à travers un proxy réactif
// (« can't access private field or method: object is not the right class »).
const doc = shallowRef(null)
const markers = ref([]) // { uid, equipement_id, page, x, y, label, color }
const tree = ref(null)
const loading = ref(true)
const rendering = ref(false)
const saving = ref(false)
const exporting = ref(false)
const dirty = ref(false)
const error = ref('')
const notice = ref('')

const page = ref(1)
const zoom = ref(1) // 1 = largeur du conteneur
const canvas = ref(null)
const stage = ref(null)
const area = ref(null)

let uidSeq = 0
const uid = () => ++uidSeq

// ---------- Chargement ----------
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [p, m, inst] = await Promise.all([getProjet(projetId.value), planMarkers(planId.value), getInstallations(projetId.value)])
    projet.value = p
    plan.value = m.plan
    tree.value = inst
    if (!m.plan.viewable) {
      error.value = m.plan.kind === 'dwg'
        ? `Ce plan DWG n'est pas encore converti en PDF (${m.plan.conversion_status || 'en attente'}). ${m.plan.conversion_error || ''}`
        : 'Ce plan ne peut pas être affiché.'
      return
    }
    markers.value = (m.markers || []).map((x) => ({ uid: uid(), equipement_id: x.equipement_id, page: x.page || 1, x: x.x, y: x.y, label: x.label, color: x.color }))
    // Emplacements de ce plan au chargement : le reste (placed - initial) est posé sur d'autres plans
    initialCount.value = countBy(markers.value)
    const blob = await planFile(planId.value, m.plan.kind === 'dwg' ? 'pdf' : null)
    doc.value = markRaw(await loadPlan(blob))
    await nextTick()
    await draw()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

// ---------- Équipements disponibles (couleur par système) ----------
const systemes = computed(() => {
  if (!tree.value) return []
  const list = []
  for (const b of tree.value.buildings) for (const s of b.systemes) list.push({ ...s, building: b.name })
  for (const s of tree.value.unassigned || []) list.push({ ...s, building: 'Sans bâtiment' })
  return list.map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }))
})
const equipIndex = computed(() => {
  const map = new Map()
  for (const s of systemes.value) {
    for (const e of s.base_equipements || []) {
      map.set(e.id, { ...e, systeme: s.name, systemeId: s.id, color: e.icon?.color || s.color, base: true, parentObj: null })
      for (const c of e.children || []) map.set(c.id, { ...c, systeme: s.name, systemeId: s.id, color: c.icon?.color || s.color, base: false, parentName: e.name, parentObj: e })
    }
  }
  return map
})
const countBy = (list) => list.reduce((acc, m) => (m.equipement_id ? ((acc[m.equipement_id] = (acc[m.equipement_id] || 0) + 1), acc) : acc), {})
const initialCount = ref({})
const placedHere = computed(() => countBy(markers.value))
const placedCount = (eid) => placedHere.value[eid] || 0
/** Décompte synchronisé : posés sur tous les plans / quantité prévue */
const totalPlaced = (e) => Math.max(0, (e.placed || 0) - (initialCount.value[e.id] || 0)) + placedCount(e.id)
const remaining = (e) => Math.max(0, (e.quantite || 1) - totalPlaced(e))
const counterClass = (e) => (remaining(e) === 0 ? 'bg-green-lt' : totalPlaced(e) ? 'bg-yellow-lt' : 'bg-secondary-lt')

async function reloadTree() {
  tree.value = await getInstallations(projetId.value)
}

// ---------- Rendu ----------
const size = ref({ width: 0, height: 0 })
async function draw() {
  if (!doc.value || !canvas.value || !area.value) return
  rendering.value = true
  try {
    const natural = await pageSize(doc.value, page.value)
    const fit = (area.value.clientWidth - 2) / natural.width
    const dpr = window.devicePixelRatio || 1
    const scale = fit * zoom.value
    await renderPage(doc.value, page.value, canvas.value, scale * dpr)
    size.value = { width: Math.round(natural.width * scale), height: Math.round(natural.height * scale) }
    canvas.value.style.width = `${size.value.width}px`
    canvas.value.style.height = `${size.value.height}px`
  } finally {
    rendering.value = false
  }
}
watch([page, zoom], draw)
let resizeTimer
const onResize = () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(draw, 200)
}
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

// ---------- Numérotation (ordre de placement) ----------
const numbered = computed(() => {
  const seen = {}
  return markers.value.map((m, i) => {
    const e = m.equipement_id ? equipIndex.value.get(m.equipement_id) : null
    let label = m.label || e?.name || ''
    // Équipements identiques fusionnés : « Caméra 2/4 »
    if (e && !m.label && (e.quantite || 1) > 1) {
      seen[e.id] = (seen[e.id] || 0) + 1
      label = `${e.name} ${seen[e.id]}/${Math.max(e.quantite, totalPlaced(e))}`
    }
    return { ...m, number: i + 1, color: m.color || e?.color || PALETTE[9], label, equip: e, icon: e?.icon?.tabler || null }
  })
})
const pageMarkers = computed(() => numbered.value.filter((m) => (m.page || 1) === page.value))

// ---------- Placement ----------
const tool = ref(null) // { equipement_id } | { free: true }
const selected = ref(null) // uid
function pick(e) {
  tool.value = { equipement_id: e.id }
  selected.value = null
}
function pickFree() {
  const label = prompt('Libellé du repère :', '')
  if (label === null) return
  tool.value = { free: true, label: label.trim() }
  selected.value = null
}
function relPos(ev) {
  const r = stage.value.getBoundingClientRect()
  return {
    x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)),
  }
}
function onStageClick(ev) {
  if (dragging) return
  if (!tool.value) {
    selected.value = null
    return
  }
  const { x, y } = relPos(ev)
  const m = { uid: uid(), page: page.value, x, y, equipement_id: tool.value.equipement_id ?? null, label: tool.value.label ?? null, color: null }
  markers.value.push(m)
  selected.value = m.uid
  dirty.value = true
  if (tool.value.free) {
    tool.value = null // un repère libre à la fois
    return
  }
  // Décompte au fur et à mesure : l'outil s'arrête quand tous les exemplaires sont posés
  const e = equipIndex.value.get(m.equipement_id)
  if (e && remaining(e) === 0) {
    const over = totalPlaced(e) - (e.quantite || 1)
    notice.value = over > 0
      ? `${e.name} : ${totalPlaced(e)} posés pour ${e.quantite || 1} prévus, la quantité sera portée à ${totalPlaced(e)} à l'enregistrement.`
      : `${e.name} : tous les exemplaires sont posés.`
    setTimeout(() => (notice.value = ''), 4000)
    if (over === 0) tool.value = null
  }
}

// Déplacement à la souris / au doigt
let dragging = null
function startDrag(m, ev) {
  ev.stopPropagation()
  selected.value = m.uid
  dragging = { uid: m.uid, moved: false }
  ev.target.setPointerCapture?.(ev.pointerId)
}
function onPointerMove(ev) {
  if (!dragging) return
  const target = markers.value.find((x) => x.uid === dragging.uid)
  if (!target) return
  const { x, y } = relPos(ev)
  target.x = x
  target.y = y
  dragging.moved = true
  dirty.value = true
}
function endDrag() {
  // Laisse passer le clic qui suit la fin du glisser sans créer de repère
  setTimeout(() => (dragging = null), 0)
}

function removeSelected() {
  markers.value = markers.value.filter((m) => m.uid !== selected.value)
  selected.value = null
  dirty.value = true
}
const selectedMarker = computed(() => numbered.value.find((m) => m.uid === selected.value))
function onKey(ev) {
  if ((ev.key === 'Delete' || ev.key === 'Backspace') && selected.value && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
    removeSelected()
  }
  if (ev.key === 'Escape') {
    tool.value = null
    selected.value = null
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// ---------- Clic droit sur un repère : modifier, dupliquer ----------
const ctx = ref(null) // { uid, x, y }
function openContext(m, ev) {
  selected.value = m.uid
  const r = area.value.getBoundingClientRect()
  ctx.value = { uid: m.uid, x: ev.clientX - r.left + area.value.scrollLeft, y: ev.clientY - r.top + area.value.scrollTop }
}
const closeContext = () => (ctx.value = null)
onMounted(() => window.addEventListener('click', closeContext))
onBeforeUnmount(() => window.removeEventListener('click', closeContext))
const ctxMarker = computed(() => numbered.value.find((m) => m.uid === ctx.value?.uid))

const equipFormOpen = ref(false)
const equipEditing = ref(null)
function ctxEdit() {
  const m = ctxMarker.value
  closeContext()
  if (!m) return
  if (m.equip) {
    equipEditing.value = m.equip
    equipFormOpen.value = true
    return
  }
  const label = prompt('Libellé du repère :', m.label || '')
  if (label === null) return
  const target = markers.value.find((x) => x.uid === m.uid)
  target.label = label.trim()
  dirty.value = true
}
async function onEquipSaved() {
  equipFormOpen.value = false
  try {
    await reloadTree()
  } catch (e) {
    error.value = errorMessage(e)
  }
}
const offset = (v) => Math.min(1, v + 0.02)
/** Dupliquer le repère : un exemplaire de plus du même équipement, posé à côté */
function ctxDuplicateMarker() {
  const m = markers.value.find((x) => x.uid === ctx.value?.uid)
  closeContext()
  if (!m) return
  const copy = { ...m, uid: uid(), x: offset(m.x), y: offset(m.y) }
  markers.value.push(copy)
  selected.value = copy.uid
  dirty.value = true
}
/** Dupliquer l'équipement : nouvel équipement (copie, avec ses rattachés), posé à côté */
async function ctxDuplicateEquipement() {
  const m = markers.value.find((x) => x.uid === ctx.value?.uid)
  closeContext()
  if (!m?.equipement_id) return
  try {
    const copy = await duplicateEquipement(m.equipement_id)
    await reloadTree()
    const n = { uid: uid(), page: m.page, x: offset(m.x), y: offset(m.y), equipement_id: copy.id, label: null, color: null }
    markers.value.push(n)
    selected.value = n.uid
    dirty.value = true
  } catch (e) {
    error.value = errorMessage(e)
  }
}
function ctxRemove() {
  selected.value = ctx.value?.uid
  closeContext()
  removeSelected()
}
const editStages = computed(() => {
  const e = equipEditing.value
  if (!e || !tree.value) return []
  const b = tree.value.buildings.find((x) => (x.systemes || []).some((s) => s.id === e.systemeId))
  return b?.stages ?? []
})

// ---------- Enregistrement ----------
async function save() {
  saving.value = true
  error.value = ''
  try {
    await savePlanMarkers(
      planId.value,
      markers.value.map((m) => ({
        equipement_id: m.equipement_id,
        page: m.page,
        x: Number(m.x.toFixed(6)),
        y: Number(m.y.toFixed(6)),
        label: m.equipement_id ? null : m.label,
        color: m.color,
      })),
    )
    dirty.value = false
    notice.value = 'Emplacements enregistrés.'
    setTimeout(() => (notice.value = ''), 3000)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}
onBeforeRouteLeave(() => (dirty.value ? confirm('Des emplacements ne sont pas enregistrés. Quitter quand même ?') : true))

// ---------- Export ----------
async function exportPdf() {
  if (!doc.value) return
  exporting.value = true
  try {
    const legend = numbered.value.map((m) => {
      const e = m.equip
      const details = e
        ? [e.modele, ...Object.entries(e.caracteristiques || {}).filter(([, v]) => v).map(([k, v]) => `${k} : ${v}`), e.parentName ? `rattaché à ${e.parentName}` : '']
            .filter(Boolean)
            .join(' · ')
        : ''
      return { number: m.number, name: m.label, type: e?.type, systeme: e?.systeme, details, color: m.color }
    })
    await exportAnnotatedPdf({
      doc: doc.value,
      markers: numbered.value,
      legend,
      title: `${projet.value?.name ?? 'Projet'} — ${plan.value?.name ?? 'Plan'}`,
      filename: `${(plan.value?.name || 'plan').replace(/[^\w-]+/g, '_')}-annote.pdf`,
    })
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    exporting.value = false
  }
}

async function downloadSource(variant) {
  try {
    const blob = await planFile(planId.value, variant)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(plan.value?.name || 'plan').replace(/[^\w-]+/g, '_')}.${variant === 'pdf' ? 'pdf' : (plan.value?.file || '').split('.').pop()}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  } catch (e) {
    error.value = errorMessage(e)
  }
}

const breadcrumbs = computed(() => [
  { name: 'ERP' },
  { name: projet.value?.client_name || 'Client', to: projet.value ? { name: 'projets', query: { client_id: projet.value.client_id } } : null },
  { name: projet.value?.name || 'Projet', to: { name: 'projet', params: { id: projetId.value } } },
  { name: plan.value?.name || 'Plan' },
])
</script>

<template>
  <PageHeader :title="plan ? `Plan : ${plan.name}` : 'Plan'" :breadcrumbs="breadcrumbs" :loading="loading || rendering">
    <template #actions>
      <div class="btn-list">
        <button class="btn btn-primary" :disabled="saving || !dirty" @click="save">
          <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span><i v-else class="ti ti-device-floppy"></i>
          Enregistrer<span v-if="dirty">*</span>
        </button>
        <button class="btn" :disabled="exporting || !doc" @click="exportPdf">
          <span v-if="exporting" class="spinner-border spinner-border-sm me-1"></span><i v-else class="ti ti-file-type-pdf"></i>
          Exporter en PDF
        </button>
        <div class="dropdown">
          <button class="btn btn-icon" data-bs-toggle="dropdown" title="Télécharger"><i class="ti ti-download"></i></button>
          <div class="dropdown-menu dropdown-menu-end">
            <button class="dropdown-item" @click="downloadSource(null)"><i class="ti ti-file"></i> Fichier d'origine</button>
            <button v-if="plan?.kind === 'dwg' && plan?.conversion_status === 'done'" class="dropdown-item" @click="downloadSource('pdf')">
              <i class="ti ti-file-type-pdf"></i> DWG converti en PDF
            </button>
          </div>
        </div>
      </div>
    </template>
  </PageHeader>

  <div class="page-body">
    <div class="container-fluid">
      <div v-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-if="notice" class="alert alert-success">{{ notice }}</div>

      <div class="row g-2">
        <!-- Équipements à placer -->
        <div class="col-lg-3 col-md-4">
          <div class="card sticky-side">
            <div class="card-header">
              <h3 class="card-title">Équipements</h3>
              <div class="card-actions">
                <button class="btn btn-sm" title="Repère libre (texte)" @click="pickFree"><i class="ti ti-map-pin"></i> Libre</button>
              </div>
            </div>
            <div class="card-body p-2 side-list">
              <div v-if="tool" class="alert alert-info py-2 mb-2 small">
                Cliquez sur le plan pour placer
                <b>{{ tool.free ? tool.label || 'le repère' : equipIndex.get(tool.equipement_id)?.name }}</b>
                <template v-if="!tool.free && equipIndex.get(tool.equipement_id)"> — reste {{ remaining(equipIndex.get(tool.equipement_id)) }}</template>.
                <a href="#" @click.prevent="tool = null">Terminer</a>
              </div>
              <div v-if="!systemes.length" class="text-secondary small">Aucun équipement : ajoutez-en dans l'onglet Installations.</div>
              <div v-for="s in systemes" :key="s.id" class="mb-2">
                <div class="small fw-bold mb-1"><span class="dot" :style="{ background: s.color }"></span>{{ s.name }} <span class="text-secondary fw-normal">· {{ s.building }}</span></div>
                <template v-for="e in s.base_equipements" :key="e.id">
                  <button
                    v-for="(item, level) in [e, ...(e.children || [])]"
                    :key="item.id"
                    class="equip-btn"
                    :class="{ active: tool?.equipement_id === item.id, child: level > 0, done: remaining(item) === 0 }"
                    :title="`${totalPlaced(item)} posé(s) sur ${item.quantite || 1} — reste ${remaining(item)}`"
                    @click="pick(item)"
                  >
                    <i :class="['ti', item.icon?.tabler || (level ? 'ti-device-cctv' : 'ti-server')]" :style="item.icon?.color ? { color: item.icon.color } : null"></i>
                    <span class="text-truncate">{{ item.name }}</span>
                    <span class="badge ms-auto" :class="counterClass(item)">{{ totalPlaced(item) }}/{{ item.quantite || 1 }}</span>
                  </button>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Plan -->
        <div class="col-lg-9 col-md-8">
          <div class="card">
            <div class="card-header py-2">
              <div class="btn-list align-items-center">
                <template v-if="doc?.pages > 1">
                  <button class="btn btn-sm btn-icon" :disabled="page <= 1" title="Page précédente" @click="page--"><i class="ti ti-chevron-left"></i></button>
                  <span class="small">Page {{ page }} / {{ doc.pages }}</span>
                  <button class="btn btn-sm btn-icon" :disabled="page >= doc.pages" title="Page suivante" @click="page++"><i class="ti ti-chevron-right"></i></button>
                  <span class="mx-1 text-secondary">|</span>
                </template>
                <button class="btn btn-sm btn-icon" title="Zoom arrière" :disabled="zoom <= 0.5" @click="zoom = Math.max(0.5, zoom - 0.25)"><i class="ti ti-zoom-out"></i></button>
                <span class="small">{{ Math.round(zoom * 100) }} %</span>
                <button class="btn btn-sm btn-icon" title="Zoom avant" :disabled="zoom >= 4" @click="zoom = Math.min(4, zoom + 0.25)"><i class="ti ti-zoom-in"></i></button>
                <button class="btn btn-sm" title="Ajuster à la largeur" @click="zoom = 1">Ajuster</button>
              </div>
              <div class="ms-auto small text-secondary">{{ markers.length }} repère(s)</div>
            </div>

            <div ref="area" class="plan-area">
              <div v-if="loading" class="text-center py-5"><div class="spinner-border text-secondary"></div></div>
              <div
                v-show="!loading && doc"
                ref="stage"
                class="stage"
                :class="{ placing: !!tool }"
                :style="{ width: size.width + 'px', height: size.height + 'px' }"
                @click="onStageClick"
                @pointermove="onPointerMove"
                @pointerup="endDrag"
              >
                <canvas ref="canvas"></canvas>
                <div
                  v-for="m in pageMarkers"
                  :key="m.uid"
                  class="marker"
                  :class="{ selected: m.uid === selected }"
                  :style="{ left: m.x * 100 + '%', top: m.y * 100 + '%', background: m.color }"
                  :title="m.label"
                  @pointerdown.left="startDrag(m, $event)"
                  @click.stop="selected = m.uid"
                  @contextmenu.prevent.stop="openContext(m, $event)"
                >
                  <i v-if="m.icon" :class="['ti', m.icon]"></i>
                  <span v-else>{{ m.number }}</span>
                  <span v-if="m.label" class="marker-label">{{ m.icon ? `${m.number}. ` : '' }}{{ m.label }}</span>
                </div>
              </div>

              <!-- Menu contextuel du repère -->
              <div v-if="ctxMarker" class="dropdown-menu show ctx-menu" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }" @click.stop>
                <span class="dropdown-header">{{ ctxMarker.number }}. {{ ctxMarker.label || 'Repère' }}</span>
                <button class="dropdown-item" type="button" @click="ctxEdit"><i class="ti ti-edit me-2"></i>Modifier</button>
                <button class="dropdown-item" type="button" @click="ctxDuplicateMarker">
                  <i class="ti ti-copy me-2"></i>Dupliquer<span v-if="ctxMarker.equip" class="text-secondary small ms-1">(même équipement)</span>
                </button>
                <button v-if="ctxMarker.equip" class="dropdown-item" type="button" @click="ctxDuplicateEquipement">
                  <i class="ti ti-copy-plus me-2"></i>Dupliquer l'équipement
                </button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item text-danger" type="button" @click="ctxRemove"><i class="ti ti-trash me-2"></i>Retirer du plan</button>
              </div>
            </div>

            <div v-if="selectedMarker" class="card-footer d-flex align-items-center gap-2">
              <span class="dot" :style="{ background: selectedMarker.color }"></span>
              <b>{{ selectedMarker.number }}.</b> {{ selectedMarker.label || '—' }}
              <span v-if="selectedMarker.equip" class="text-secondary small">{{ selectedMarker.equip.type }} · {{ selectedMarker.equip.systeme }}</span>
              <button class="btn btn-sm btn-outline-danger ms-auto" @click="removeSelected"><i class="ti ti-trash"></i> Retirer du plan</button>
            </div>
            <div v-else class="card-footer small text-secondary">
              Choisissez un équipement à gauche puis cliquez sur le plan (le décompte indique posés / prévus). Glissez un repère pour le déplacer,
              clic droit pour le modifier ou le dupliquer, Suppr pour le retirer, Échap pour arrêter.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <EquipementFormModal
    :show="equipFormOpen"
    :equipement="equipEditing"
    :systeme-id="equipEditing?.systemeId ?? null"
    :parent="equipEditing?.parentObj ?? null"
    :stages="editStages"
    @close="equipFormOpen = false"
    @saved="onEquipSaved"
  />
</template>

<style scoped>
.plan-area {
  position: relative;
  overflow: auto;
  max-height: calc(100vh - 260px);
  min-height: 300px;
  background: var(--tblr-bg-surface-secondary, #f6f8fb);
  padding: 1px;
}
.stage {
  position: relative;
  margin: 0 auto;
  touch-action: none;
  user-select: none;
}
.stage.placing {
  cursor: crosshair;
}
.stage canvas {
  display: block;
}
.marker {
  position: absolute;
  transform: translate(-50%, -50%);
  min-width: 24px;
  height: 24px;
  padding: 0 4px;
  border-radius: 12px;
  border: 2px solid #fff;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
  cursor: grab;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
.marker.selected {
  outline: 3px solid rgba(32, 107, 196, 0.5);
  z-index: 2;
}
.marker-label {
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 4px;
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  color: #1d273b;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
}
.sticky-side {
  position: sticky;
  top: 70px;
}
.side-list {
  max-height: calc(100vh - 220px);
  overflow: auto;
}
.equip-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  border: 1px solid transparent;
  background: none;
  padding: 4px 6px;
  border-radius: 6px;
  text-align: left;
  font-size: 0.85rem;
}
.equip-btn:hover {
  background: var(--tblr-bg-surface-secondary, #f6f8fb);
}
.equip-btn.active {
  border-color: var(--tblr-primary);
  background: var(--tblr-primary-lt, #e8f1fb);
}
.equip-btn.child {
  padding-left: 22px;
}
.equip-btn.done {
  opacity: 0.6;
}
.ctx-menu {
  position: absolute;
  z-index: 10;
}
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}
</style>
