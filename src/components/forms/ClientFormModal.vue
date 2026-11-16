<script setup>
/** Formulaire client (création / modification), champs de _form/client_form.blade.php. */
import { reactive, ref, watch } from 'vue'
import { errorMessage } from '@/api/client'
import { saveClient, uploadImage } from '@/api/dash3'
import AppModal from '@/components/AppModal.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  client: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const form = reactive({ name: '', type: 'Entreprise', address: '', description: '' })
const saving = ref(false)
const image = ref(null)
const imagePreview = ref('')
const MAX_MB = 4

function setImage(f) {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  image.value = f
  imagePreview.value = f ? URL.createObjectURL(f) : ''
}
function onImage(e) {
  const f = e.target.files?.[0] ?? null
  if (f && f.size > MAX_MB * 1024 * 1024) {
    error.value = `L'image fait ${(f.size / 1024 / 1024).toFixed(1)} Mo (maximum ${MAX_MB} Mo).`
    e.target.value = ''
    return
  }
  error.value = ''
  setImage(f)
}
const error = ref('')

watch(
  () => props.show,
  (open) => {
    if (!open) return
    Object.assign(form, {
      name: props.client?.name ?? '',
      type: props.client?.type ?? 'Entreprise',
      address: props.client?.address ?? '',
      description: props.client?.description ?? '',
    })
    setImage(null)
    error.value = ''
  },
)

async function submit() {
  saving.value = true
  error.value = ''
  try {
    const res = await saveClient({ ...form, name: form.name.trim() }, props.client?.id)
    const id = props.client?.id ?? res?.data?.data?.id
    if (image.value && id) await uploadImage(`/clients/${id}/avatar`, image.value)
    emit('saved')
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
    :title="client ? 'Modifier un client' : 'Ajouter un client'"
    :saving="saving"
    :can-submit="!!form.name.trim()"
    :error="error"
    @close="emit('close')"
    @submit="submit"
  >
    <div class="row">
      <div class="col-md-8 mb-3">
        <label class="form-label required">Nom du client</label>
        <input v-model="form.name" type="text" class="form-control" required />
      </div>
      <div class="col-md-4 mb-3">
        <label class="form-label">Type de client</label>
        <select v-model="form.type" class="form-select">
          <option value="Entreprise">Entreprise</option>
          <option value="Particulier">Particulier</option>
        </select>
      </div>
      <div class="col-12 mb-3">
        <label class="form-label">Adresse</label>
        <input v-model="form.address" type="text" class="form-control" placeholder="Adresse du client" />
      </div>
      <div class="col-12 mb-3">
        <label class="form-label">Logo / image</label>
        <div class="d-flex align-items-center gap-3">
          <img
            v-if="imagePreview || client?.avatar"
            :src="imagePreview || client.avatar"
            alt=""
            class="avatar avatar-lg rounded-2 p-1 bg-white border"
            style="object-fit: contain"
          />
          <div class="flex-fill">
            <input type="file" class="form-control" accept="image/*" @change="onImage" />
            <div class="form-hint">Image de {{ MAX_MB }} Mo maximum<template v-if="client">, remplace l'image actuelle</template>.</div>
          </div>
        </div>
      </div>
      <div class="col-12">
        <label class="form-label">Description</label>
        <textarea v-model="form.description" class="form-control" rows="5" placeholder="Description du client"></textarea>
      </div>
    </div>
  </AppModal>
</template>
