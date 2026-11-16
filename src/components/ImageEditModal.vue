<script setup>
/**
 * Édition d'une image déjà enregistrée sur le serveur (logo, avatar, photo…) :
 * rogner, pivoter, retourner, redimensionner. Le traitement est fait par l'API
 * (POST /images/edit) sur le fichier d'origine, en pleine résolution.
 *
 *   <ImageEditModal :show="open" :src="client.avatar" @close="open = false" @saved="reload" />
 */
import { computed, ref, watch } from 'vue'
import { errorMessage } from '@/api/client'
import { editImage } from '@/api/dash3'
import AppModal from '@/components/AppModal.vue'
import ImageEditor from '@/components/ImageEditor.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  /** URL de l'image telle qu'affichée (ou chemin « storage/… ») */
  src: { type: String, default: '' },
  title: { type: String, default: "Modifier l'image" },
  /** Propose « Enregistrer une copie » (utile pour une galerie) */
  allowCopy: { type: Boolean, default: false },
  initialAspect: { type: Number, default: null },
})
const emit = defineEmits(['close', 'saved'])

const editor = ref(null)
const mode = ref('replace')
const saving = ref(false)
const error = ref('')
const stamp = ref(Date.now())

watch(
  () => props.show,
  (open) => {
    if (open) {
      mode.value = 'replace'
      error.value = ''
      stamp.value = Date.now()
    }
  },
)

// Toujours charger la version la plus récente du fichier (pas celle du cache)
const freshSrc = computed(() => {
  if (!props.src) return ''
  return props.src + (props.src.includes('?') ? '&' : '?') + 't=' + stamp.value
})

async function submit() {
  if (!editor.value?.hasChanges) return
  saving.value = true
  error.value = ''
  try {
    const result = await editImage(props.src, editor.value.operations(), mode.value)
    emit('saved', result)
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
    :title="title"
    size="modal-lg"
    :saving="saving"
    :can-submit="!!editor?.hasChanges"
    :error="error"
    :submit-label="mode === 'copy' ? 'Enregistrer la copie' : 'Enregistrer'"
    @close="emit('close')"
    @submit="submit"
  >
    <ImageEditor v-if="show" ref="editor" :src="freshSrc" :initial-aspect="initialAspect" @error="(m) => (error = m)" />

    <div v-if="allowCopy" class="mt-3">
      <label class="form-check form-check-inline mb-0">
        <input v-model="mode" class="form-check-input" type="radio" value="replace" />
        <span class="form-check-label">Remplacer l'image</span>
      </label>
      <label class="form-check form-check-inline mb-0">
        <input v-model="mode" class="form-check-input" type="radio" value="copy" />
        <span class="form-check-label">Enregistrer une copie (l'original est conservé)</span>
      </label>
    </div>
    <div v-else class="form-hint mt-3">L'image d'origine sera remplacée par la version modifiée.</div>
  </AppModal>
</template>
