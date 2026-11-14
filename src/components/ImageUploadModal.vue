<script setup>
/** Remplacement d'un logo / avatar : aperçu puis envoi (multipart, champ « image »). */
import { ref, watch } from 'vue'
import { errorMessage } from '@/api/client'
import { uploadImage } from '@/api/dash3'
import AppModal from '@/components/AppModal.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: 'Éditer le logo' },
  endpoint: { type: String, default: '' },
  current: { type: String, default: '' },
})
const emit = defineEmits(['close', 'saved'])

const file = ref(null)
const preview = ref('')
const saving = ref(false)
const error = ref('')

watch(
  () => props.show,
  (open) => {
    if (open) {
      file.value = null
      preview.value = ''
      error.value = ''
    }
  },
)

function onFile(e) {
  file.value = e.target.files?.[0] ?? null
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = file.value ? URL.createObjectURL(file.value) : ''
}

async function submit() {
  if (!file.value) return
  saving.value = true
  error.value = ''
  try {
    const data = await uploadImage(props.endpoint, file.value)
    emit('saved', data)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal :show="show" :title="title" :saving="saving" :can-submit="!!file" :error="error" submit-label="Enregistrer" @close="emit('close')" @submit="submit">
    <div class="text-center mb-3">
      <img v-if="preview || current" :src="preview || current" alt="" class="avatar avatar-xl rounded-2 p-1 bg-white border mb-3" style="object-fit: contain" />
      <input type="file" class="form-control" accept="image/*" @change="onFile" />
      <div class="form-hint mt-2">Image de 4 Mo maximum.</div>
    </div>
  </AppModal>
</template>
