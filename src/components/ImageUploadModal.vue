<script setup>
/**
 * Remplacement d'un logo / avatar : choix du fichier, rognage / redimensionnement
 * dans le navigateur, puis envoi (multipart, champ « image »).
 * « Modifier l'image actuelle » retouche directement l'image enregistrée (API /images/edit).
 */
import { computed, ref, watch } from 'vue'
import { errorMessage } from '@/api/client'
import { editImage, uploadImage } from '@/api/dash3'
import AppModal from '@/components/AppModal.vue'
import ImageEditor from '@/components/ImageEditor.vue'
import { storagePath } from '@/utils/imageVersions'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: 'Éditer le logo' },
  endpoint: { type: String, default: '' },
  current: { type: String, default: '' },
  /** Proportions proposées au rognage (ex. 1 pour un carré) ; null = libre */
  aspect: { type: Number, default: null },
  /** Taille maximale acceptée par le serveur (Mo) */
  maxMb: { type: Number, default: 4 },
})
const emit = defineEmits(['close', 'saved'])

const view = ref('upload') // 'upload' | 'current'
const file = ref(null)
const preview = ref('')
const saving = ref(false)
const error = ref('')
const editor = ref(null)
const stamp = ref(Date.now())

watch(
  () => props.show,
  (open) => {
    if (open) {
      view.value = 'upload'
      setFile(null)
      error.value = ''
      stamp.value = Date.now()
    }
  },
)

function setFile(f) {
  file.value = f
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = f ? URL.createObjectURL(f) : ''
}

function onFile(e) {
  setFile(e.target.files?.[0] ?? null)
}

// Seules les images du stockage Dash3 sont modifiables (pas les images par défaut)
const currentEditable = computed(() => /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(storagePath(props.current) || ''))
const currentFresh = computed(() => (props.current ? props.current + (props.current.includes('?') ? '&' : '?') + 't=' + stamp.value : ''))
const modalTitle = computed(() => (view.value === 'current' ? "Modifier l'image actuelle" : props.title))
const canSubmit = computed(() => (view.value === 'current' ? !!editor.value?.hasChanges : !!file.value))

const OUTPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Fichier à envoyer : l'original, ou la version rognée / redimensionnée */
async function fileToSend() {
  if (!editor.value?.hasChanges) return file.value
  const type = OUTPUT_TYPES.includes(file.value.type) ? file.value.type : 'image/png'
  const blob = await editor.value.toBlob(type, 0.9)
  const base = file.value.name.replace(/\.[^.]+$/, '') || 'image'
  // Nom unique : le navigateur ne réaffichera pas une ancienne version en cache
  return new File([blob], `${base}-${Date.now()}.${EXT[type]}`, { type })
}

async function submit() {
  if (!canSubmit.value) return
  saving.value = true
  error.value = ''
  try {
    if (view.value === 'current') {
      const result = await editImage(props.current, editor.value.operations(), 'replace')
      emit('saved', result)
      return
    }
    const toSend = await fileToSend()
    if (toSend.size > props.maxMb * 1024 * 1024) {
      error.value = `L'image fait ${(toSend.size / 1024 / 1024).toFixed(1)} Mo (maximum ${props.maxMb} Mo) : réduisez sa taille ci-dessous.`
      return
    }
    const data = await uploadImage(props.endpoint, toSend)
    emit('saved', data)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal
    :show="show"
    :title="modalTitle"
    :size="preview || view === 'current' ? 'modal-lg' : ''"
    :saving="saving"
    :can-submit="canSubmit"
    :error="error"
    submit-label="Enregistrer"
    @close="emit('close')"
    @submit="submit"
  >
    <!-- Retouche de l'image enregistrée -->
    <template v-if="view === 'current'">
      <ImageEditor ref="editor" :src="currentFresh" :initial-aspect="aspect" @error="(m) => (error = m)" />
      <div class="d-flex align-items-center mt-3">
        <div class="form-hint">L'image enregistrée sera remplacée par la version modifiée.</div>
        <button type="button" class="btn btn-sm btn-ghost-secondary ms-auto" @click="view = 'upload'"><i class="ti ti-arrow-left me-1"></i> Envoyer une autre image</button>
      </div>
    </template>

    <!-- Nouvelle image -->
    <template v-else>
      <div v-if="!preview" class="text-center mb-3">
        <img v-if="current" :src="current" alt="" class="avatar avatar-xl rounded-2 p-1 bg-white border mb-2" style="object-fit: contain" />
        <div v-if="currentEditable" class="mb-3">
          <button type="button" class="btn btn-sm btn-outline-primary" @click="view = 'current'"><i class="ti ti-crop me-1"></i> Rogner / redimensionner l'image actuelle</button>
        </div>
      </div>
      <ImageEditor v-else ref="editor" :src="preview" :initial-aspect="aspect" @error="(m) => (error = m)" />
      <input type="file" class="form-control" :class="{ 'mt-3': preview }" accept="image/*" @change="onFile" />
      <div class="form-hint mt-2">
        Image de {{ maxMb }} Mo maximum.
        <template v-if="preview">Rognez ou réduisez l'image avant l'envoi si besoin.</template>
      </div>
    </template>
  </AppModal>
</template>
