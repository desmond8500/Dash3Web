<script setup>
/**
 * Éditeur d'image sans dépendance : pivoter, retourner, rogner (cadre déplaçable,
 * proportions libres ou imposées) et redimensionner.
 *
 * Ordre des opérations — le même que l'API Dash3 (POST /images/edit) :
 *   rotation → retournement → rognage (pixels de l'image pivotée) → redimensionnement
 *
 * Utilisation :
 *   <ImageEditor ref="editor" :src="url" />
 *   editor.value.operations()        → paramètres à envoyer à l'API (édition côté serveur)
 *   await editor.value.toBlob(type)  → image modifiée dans le navigateur (avant un envoi)
 *   editor.value.hasChanges / ready
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  /** Proportions imposées au départ (ex. 1 pour un logo carré) ; null = libre */
  initialAspect: { type: Number, default: null },
})
const emit = defineEmits(['loaded', 'error'])

const MAX_SIDE = 8000

const ASPECTS = [
  { label: 'Libre', value: null },
  { label: 'Original', value: 'original' },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
]
const QUICK_SIZES = [1920, 1280, 800, 400]
const HANDLES = ['n', 'e', 's', 'w', 'nw', 'ne', 'sw', 'se']

const stage = ref(null)
const wrap = ref(null)
const canvas = ref(null)

const img = shallowRef(null) // élément <img> natif : pas de proxy réactif (drawImage le refuserait)
const loading = ref(false)
const loadError = ref('')
const natural = reactive({ w: 0, h: 0 })

const rotate = ref(0) // 0 | 90 | 180 | 270, sens horaire
const flipH = ref(false)
const flipV = ref(false)
const aspectChoice = ref(null) // valeur de ASPECTS
const crop = reactive({ x: 0, y: 0, w: 0, h: 0 }) // pixels de l'image pivotée
const resize = reactive({ w: '', h: '', keep: true })

const stageWidth = ref(600)
const maxHeight = ref(420)

// ---------- Dimensions ----------

const ready = computed(() => natural.w > 0 && natural.h > 0)
const turned = computed(() => rotate.value % 180 !== 0)
const tw = computed(() => (turned.value ? natural.h : natural.w)) // largeur après rotation
const th = computed(() => (turned.value ? natural.w : natural.h))
const scale = computed(() => (ready.value ? Math.min(stageWidth.value / tw.value, maxHeight.value / th.value, 1) : 1))
const dispW = computed(() => Math.max(1, Math.round(tw.value * scale.value)))
const dispH = computed(() => Math.max(1, Math.round(th.value * scale.value)))

const aspect = computed(() => {
  if (aspectChoice.value === 'original') return ready.value ? tw.value / th.value : null
  return aspectChoice.value
})

const cropRounded = computed(() => {
  const x = Math.max(0, Math.round(crop.x))
  const y = Math.max(0, Math.round(crop.y))
  return {
    x,
    y,
    width: Math.max(1, Math.min(Math.round(crop.w), tw.value - x)),
    height: Math.max(1, Math.min(Math.round(crop.h), th.value - y)),
  }
})
const isFullCrop = computed(
  () => cropRounded.value.x === 0 && cropRounded.value.y === 0 && cropRounded.value.width === tw.value && cropRounded.value.height === th.value,
)

/** Taille finale après redimensionnement (null si pas de redimensionnement) */
const resizeTarget = computed(() => {
  const w = Number(resize.w) || null
  const h = Number(resize.h) || null
  if (!w && !h) return null
  const cw = cropRounded.value.width
  const ch = cropRounded.value.height
  const outW = w ?? Math.round((h * cw) / ch)
  const outH = h ?? Math.round((w * ch) / cw)
  if (outW === cw && outH === ch) return null
  return { width: Math.min(MAX_SIDE, Math.max(1, outW)), height: Math.min(MAX_SIDE, Math.max(1, outH)) }
})
const output = computed(() => resizeTarget.value ?? { width: cropRounded.value.width, height: cropRounded.value.height })

const hasChanges = computed(() => ready.value && (rotate.value !== 0 || flipH.value || flipV.value || !isFullCrop.value || !!resizeTarget.value))

// ---------- Chargement ----------

function resetState() {
  rotate.value = 0
  flipH.value = false
  flipV.value = false
  aspectChoice.value = props.initialAspect
  resize.w = ''
  resize.h = ''
  resize.keep = true
  resetCrop()
}

function load(src) {
  natural.w = 0
  natural.h = 0
  loadError.value = ''
  img.value = null
  if (!src) return
  loading.value = true
  const image = new Image()
  image.decoding = 'async'
  image.onload = () => {
    loading.value = false
    img.value = image
    natural.w = image.naturalWidth
    natural.h = image.naturalHeight
    resetState()
    emit('loaded', { width: natural.w, height: natural.h })
  }
  image.onerror = () => {
    loading.value = false
    loadError.value = "Impossible de charger l'image."
    emit('error', loadError.value)
  }
  image.src = src
}

watch(() => props.src, load)

// ---------- Rendu ----------

/** Dessine l'image pivotée / retournée sur toute la surface (outW × outH) du contexte */
function drawTransformed(ctx, outW, outH) {
  ctx.save()
  ctx.translate(outW / 2, outH / 2)
  ctx.scale(flipH.value ? -1 : 1, flipV.value ? -1 : 1)
  ctx.rotate((rotate.value * Math.PI) / 180)
  const dw = turned.value ? outH : outW
  const dh = turned.value ? outW : outH
  ctx.drawImage(img.value, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()
}

function render() {
  const c = canvas.value
  if (!c || !img.value) return
  const dpr = window.devicePixelRatio || 1
  c.width = Math.round(dispW.value * dpr)
  c.height = Math.round(dispH.value * dpr)
  const ctx = c.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.clearRect(0, 0, c.width, c.height)
  drawTransformed(ctx, c.width, c.height)
}

watch([img, rotate, flipH, flipV, dispW, dispH], () => requestAnimationFrame(render))

let observer = null
function measure() {
  if (stage.value) stageWidth.value = Math.max(200, stage.value.clientWidth - 16) // padding de la zone
  maxHeight.value = Math.max(220, Math.min(520, Math.round(window.innerHeight * 0.55)))
}
onMounted(() => {
  measure()
  observer = new ResizeObserver(measure)
  if (stage.value) observer.observe(stage.value)
  window.addEventListener('resize', measure)
  load(props.src)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', measure)
})

// ---------- Cadre de rognage ----------

const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

/** Plus grand cadre centré respectant les proportions (ou toute l'image) */
function resetCrop() {
  const W = tw.value
  const H = th.value
  if (!aspect.value) {
    Object.assign(crop, { x: 0, y: 0, w: W, h: H })
    return
  }
  let w = W
  let h = w / aspect.value
  if (h > H) {
    h = H
    w = h * aspect.value
  }
  Object.assign(crop, { x: (W - w) / 2, y: (H - h) / 2, w, h })
}

let keepCropOnce = false
watch(aspectChoice, () => {
  if (keepCropOnce) {
    keepCropOnce = false
    return
  }
  resetCrop()
})

/** Impose les proportions à un cadre redimensionné par la poignée `action` */
function applyAspect(r, action, start) {
  const a = aspect.value
  const W = tw.value
  const H = th.value
  const horiz = action.includes('e') || action.includes('w')
  const vert = action.includes('n') || action.includes('s')

  let w = r.w
  let h = r.h
  if (horiz && !vert) h = w / a
  else if (vert && !horiz) w = h * a
  else if (w / a >= h) h = w / a
  else w = h * a

  // Point fixe : côté opposé à la poignée, ou centre du cadre de départ
  const left = action.includes('e') ? r.x : null
  const right = action.includes('w') ? r.x + r.w : null
  const top = action.includes('s') ? r.y : null
  const bottom = action.includes('n') ? r.y + r.h : null
  const cx = start.x + start.w / 2
  const cy = start.y + start.h / 2

  const maxW = left !== null ? W - left : right !== null ? right : 2 * Math.min(cx, W - cx)
  const maxH = top !== null ? H - top : bottom !== null ? bottom : 2 * Math.min(cy, H - cy)
  if (w > maxW) {
    w = maxW
    h = w / a
  }
  if (h > maxH) {
    h = maxH
    w = h * a
  }

  const x = left !== null ? left : right !== null ? right - w : cx - w / 2
  const y = top !== null ? top : bottom !== null ? bottom - h : cy - h / 2
  return { x, y, w, h }
}

function resizeRect(start, action, dx, dy, min) {
  const W = tw.value
  const H = th.value
  let x1 = start.x
  let y1 = start.y
  let x2 = start.x + start.w
  let y2 = start.y + start.h
  if (action.includes('w')) x1 = clamp(start.x + dx, 0, x2 - min)
  if (action.includes('e')) x2 = clamp(start.x + start.w + dx, x1 + min, W)
  if (action.includes('n')) y1 = clamp(start.y + dy, 0, y2 - min)
  if (action.includes('s')) y2 = clamp(start.y + start.h + dy, y1 + min, H)
  const r = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
  return aspect.value ? applyAspect(r, action, start) : r
}

let drag = null

function pointerToImage(e) {
  const rect = wrap.value.getBoundingClientRect()
  return {
    x: clamp((e.clientX - rect.left) / scale.value, 0, tw.value),
    y: clamp((e.clientY - rect.top) / scale.value, 0, th.value),
  }
}

function onPointerDown(e) {
  if (!ready.value || e.button > 0) return
  e.preventDefault()
  const p = pointerToImage(e)
  const action = e.target?.dataset?.action || 'new'
  drag = { action, p0: p, start: { ...crop }, previous: { ...crop } }
  wrap.value.setPointerCapture?.(e.pointerId)
}

function onPointerMove(e) {
  if (!drag) return
  const p = pointerToImage(e)
  const dx = p.x - drag.p0.x
  const dy = p.y - drag.p0.y
  const min = Math.min(Math.max(10 / scale.value, 1), tw.value, th.value)

  if (drag.action === 'move') {
    crop.x = clamp(drag.start.x + dx, 0, tw.value - crop.w)
    crop.y = clamp(drag.start.y + dy, 0, th.value - crop.h)
    return
  }
  if (drag.action === 'new') {
    // Nouveau cadre tracé depuis le point de départ
    const handle = (dy < 0 ? 'n' : 's') + (dx < 0 ? 'w' : 'e')
    Object.assign(crop, resizeRect({ x: drag.p0.x, y: drag.p0.y, w: 0, h: 0 }, handle, dx, dy, 0))
    return
  }
  Object.assign(crop, resizeRect(drag.start, drag.action, dx, dy, min))
}

function onPointerUp(e) {
  if (!drag) return
  // Simple clic hors du cadre : on garde le cadre précédent
  if (drag.action === 'new' && (crop.w * scale.value < 6 || crop.h * scale.value < 6)) Object.assign(crop, drag.previous)
  drag = null
  wrap.value?.releasePointerCapture?.(e.pointerId)
}

/** Déplacement / taille du cadre au clavier (flèches, Maj = 10 px) */
function onKeydown(e) {
  const step = (e.shiftKey ? 10 : 1) / scale.value
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
  if (!moves[e.key]) return
  e.preventDefault()
  crop.x = clamp(crop.x + moves[e.key][0], 0, tw.value - crop.w)
  crop.y = clamp(crop.y + moves[e.key][1], 0, th.value - crop.h)
}

const boxStyle = computed(() => ({
  left: `${crop.x * scale.value}px`,
  top: `${crop.y * scale.value}px`,
  width: `${crop.w * scale.value}px`,
  height: `${crop.h * scale.value}px`,
}))

// ---------- Outils ----------

function turn(delta) {
  // Garde la zone choisie en la faisant pivoter avec l'image
  const W = tw.value
  const H = th.value
  const c = { ...crop }
  // La rotation est appliquée avant le miroir : avec un seul miroir actif,
  // tourner l'affichage vers la droite revient à tourner l'original vers la gauche.
  const internal = flipH.value !== flipV.value ? -delta : delta
  rotate.value = (((rotate.value + internal) % 360) + 360) % 360
  if (delta > 0) Object.assign(crop, { x: H - c.y - c.h, y: c.x, w: c.h, h: c.w })
  else Object.assign(crop, { x: c.y, y: W - c.x - c.w, w: c.h, h: c.w })
  if (typeof aspectChoice.value === 'number' && Math.abs(1 / aspectChoice.value - aspectChoice.value) > 1e-9) {
    keepCropOnce = true // le cadre vient d'être pivoté : il respecte déjà les nouvelles proportions
    aspectChoice.value = 1 / aspectChoice.value
  }
}

function toggleFlip(axis) {
  if (axis === 'h') {
    flipH.value = !flipH.value
    crop.x = tw.value - crop.x - crop.w
  } else {
    flipV.value = !flipV.value
    crop.y = th.value - crop.y - crop.h
  }
}

function setResizeW(v) {
  resize.w = v === '' || v === null ? '' : Math.min(MAX_SIDE, Math.max(1, Math.round(Number(v)) || 1))
  if (resize.keep) resize.h = resize.w === '' ? '' : Math.round((resize.w * cropRounded.value.height) / cropRounded.value.width)
}
function setResizeH(v) {
  resize.h = v === '' || v === null ? '' : Math.min(MAX_SIDE, Math.max(1, Math.round(Number(v)) || 1))
  if (resize.keep) resize.w = resize.h === '' ? '' : Math.round((resize.h * cropRounded.value.width) / cropRounded.value.height)
}
/** Limite le plus grand côté à `side` px (sans agrandir) */
function quickSize(side) {
  const { width, height } = cropRounded.value
  resize.keep = true
  if (width >= height) setResizeW(Math.min(side, width))
  else setResizeH(Math.min(side, height))
}
function clearResize() {
  resize.w = ''
  resize.h = ''
}

// La largeur saisie reste valable quand le cadre change : on recalcule la hauteur
watch(
  () => [cropRounded.value.width, cropRounded.value.height],
  () => {
    if (resize.keep && resize.w !== '') setResizeW(resize.w)
  },
)

function reset() {
  aspectChoice.value = props.initialAspect
  resetState()
}

// ---------- Sorties ----------

/** Paramètres pour POST /images/edit */
function operations() {
  const ops = { rotate: rotate.value, flip_h: flipH.value, flip_v: flipV.value }
  if (!isFullCrop.value) ops.crop = { ...cropRounded.value }
  if (resizeTarget.value) ops.resize = { ...resizeTarget.value }
  return ops
}

/** Image modifiée, produite dans le navigateur */
function toBlob(type = 'image/png', quality = 0.9) {
  if (!img.value) return Promise.reject(new Error('Image non chargée'))
  const full = document.createElement('canvas')
  full.width = tw.value
  full.height = th.value
  drawTransformed(full.getContext('2d'), full.width, full.height)

  const c = cropRounded.value
  const { width, height } = output.value
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(full, c.x, c.y, c.width, c.height, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Impossible d'exporter l'image"))), type, quality)
  })
}

defineExpose({ operations, toBlob, reset, hasChanges, ready, output })
</script>

<template>
  <div class="image-editor">
    <!-- Barre d'outils -->
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
      <div class="btn-group" role="group" aria-label="Rotation">
        <button type="button" class="btn btn-icon" title="Pivoter à gauche" :disabled="!ready" @click="turn(-90)"><i class="ti ti-rotate"></i></button>
        <button type="button" class="btn btn-icon" title="Pivoter à droite" :disabled="!ready" @click="turn(90)"><i class="ti ti-rotate-clockwise"></i></button>
      </div>
      <div class="btn-group" role="group" aria-label="Retourner">
        <button type="button" class="btn btn-icon" :class="{ active: flipH }" title="Miroir horizontal" :disabled="!ready" @click="toggleFlip('h')"><i class="ti ti-flip-vertical"></i></button>
        <button type="button" class="btn btn-icon" :class="{ active: flipV }" title="Miroir vertical" :disabled="!ready" @click="toggleFlip('v')"><i class="ti ti-flip-horizontal"></i></button>
      </div>
      <div class="btn-group flex-wrap" role="group" aria-label="Proportions du rognage">
        <button
          v-for="a in ASPECTS"
          :key="a.label"
          type="button"
          class="btn btn-sm"
          :class="aspectChoice === a.value || (a.value && aspectChoice && Math.abs(aspectChoice - a.value) < 0.001) ? 'btn-primary' : ''"
          :disabled="!ready"
          @click="aspectChoice = a.value"
        >
          {{ a.label }}
        </button>
      </div>
      <button type="button" class="btn btn-sm btn-ghost-secondary ms-auto" :disabled="!hasChanges" @click="reset"><i class="ti ti-refresh me-1"></i> Réinitialiser</button>
    </div>

    <!-- Zone de travail -->
    <div ref="stage" class="ie-stage" :style="{ minHeight: ready ? null : '200px' }">
      <div v-if="loading" class="text-center text-secondary py-5"><span class="spinner-border spinner-border-sm me-2"></span> Chargement…</div>
      <div v-else-if="loadError" class="alert alert-danger m-0">{{ loadError }}</div>
      <div
        v-show="ready && !loading"
        ref="wrap"
        class="ie-wrap"
        tabindex="0"
        :style="{ width: dispW + 'px', height: dispH + 'px' }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @keydown="onKeydown"
      >
        <canvas ref="canvas" :style="{ width: dispW + 'px', height: dispH + 'px' }"></canvas>
        <div class="ie-crop" :style="boxStyle" data-action="move">
          <span class="ie-grid ie-grid-v"></span>
          <span class="ie-grid ie-grid-h"></span>
          <span v-for="h in HANDLES" :key="h" class="ie-handle" :class="'ie-' + h" :data-action="h"></span>
        </div>
      </div>
    </div>

    <!-- Redimensionnement -->
    <div v-if="ready" class="row g-2 align-items-end mt-2">
      <div class="col-6 col-md-3">
        <label class="form-label mb-1">Largeur (px)</label>
        <input type="number" min="1" :max="MAX_SIDE" class="form-control form-control-sm" :placeholder="String(cropRounded.width)" :value="resize.w" @input="setResizeW($event.target.value)" @keydown.enter.prevent />
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label mb-1">Hauteur (px)</label>
        <input type="number" min="1" :max="MAX_SIDE" class="form-control form-control-sm" :placeholder="String(cropRounded.height)" :value="resize.h" @input="setResizeH($event.target.value)" @keydown.enter.prevent />
      </div>
      <div class="col-md-6">
        <label class="form-check form-switch mb-1">
          <input v-model="resize.keep" class="form-check-input" type="checkbox" />
          <span class="form-check-label">Conserver les proportions</span>
        </label>
        <div class="btn-list">
          <button v-for="s in QUICK_SIZES" :key="s" type="button" class="btn btn-sm btn-outline-secondary" :title="`Plus grand côté : ${s} px`" @click="quickSize(s)">{{ s }}</button>
          <button type="button" class="btn btn-sm btn-ghost-secondary" :disabled="!resize.w && !resize.h" @click="clearResize">Taille réelle</button>
        </div>
      </div>
    </div>

    <div v-if="ready" class="small text-secondary mt-2">
      Original : {{ natural.w }} × {{ natural.h }} px
      <i class="ti ti-arrow-right mx-1"></i>
      <strong :class="hasChanges ? 'text-primary' : ''">Résultat : {{ output.width }} × {{ output.height }} px</strong>
      <span v-if="!isFullCrop"> (rognage {{ cropRounded.width }} × {{ cropRounded.height }} à {{ cropRounded.x }}, {{ cropRounded.y }})</span>
    </div>
  </div>
</template>

<style scoped>
.ie-stage {
  display: flex;
  justify-content: center;
  align-items: center;
  background: repeating-conic-gradient(#e9ecef 0% 25%, #fff 0% 50%) 50% / 16px 16px;
  border-radius: 6px;
  padding: 8px;
  overflow: hidden;
}
.ie-wrap {
  position: relative;
  touch-action: none;
  user-select: none;
  cursor: crosshair;
  overflow: hidden;
  outline: none;
}
.ie-wrap canvas {
  display: block;
}
.ie-crop {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid #fff;
  outline: 1px solid rgba(0, 0, 0, 0.5);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  cursor: move;
}
.ie-grid {
  position: absolute;
  pointer-events: none;
  border-color: rgba(255, 255, 255, 0.55);
  border-style: dashed;
  border-width: 0;
}
.ie-grid-v {
  top: 0;
  bottom: 0;
  left: 33.333%;
  width: 33.333%;
  border-left-width: 1px;
  border-right-width: 1px;
}
.ie-grid-h {
  left: 0;
  right: 0;
  top: 33.333%;
  height: 33.333%;
  border-top-width: 1px;
  border-bottom-width: 1px;
}
.ie-handle {
  position: absolute;
  width: 14px;
  height: 14px;
  margin: -7px 0 0 -7px;
  background: #fff;
  border: 1px solid #206bc4;
  border-radius: 3px;
}
.ie-n { left: 50%; top: 0; cursor: ns-resize; }
.ie-s { left: 50%; top: 100%; cursor: ns-resize; }
.ie-e { left: 100%; top: 50%; cursor: ew-resize; }
.ie-w { left: 0; top: 50%; cursor: ew-resize; }
.ie-nw { left: 0; top: 0; cursor: nwse-resize; }
.ie-se { left: 100%; top: 100%; cursor: nwse-resize; }
.ie-ne { left: 100%; top: 0; cursor: nesw-resize; }
.ie-sw { left: 0; top: 100%; cursor: nesw-resize; }
.ie-wrap:focus-visible .ie-crop {
  border-color: #206bc4;
}
</style>
