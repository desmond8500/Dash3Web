<script setup>
/** Formulaire client (création / modification), champs de _form/client_form.blade.php. */
import { reactive, ref, watch } from 'vue'
import { errorMessage } from '@/api/client'
import { saveClient } from '@/api/dash3'
import AppModal from '@/components/AppModal.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  client: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const form = reactive({ name: '', type: 'Entreprise', address: '', description: '' })
const saving = ref(false)
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
    error.value = ''
  },
)

async function submit() {
  saving.value = true
  error.value = ''
  try {
    await saveClient({ ...form, name: form.name.trim() }, props.client?.id)
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
      <div class="col-12">
        <label class="form-label">Description</label>
        <textarea v-model="form.description" class="form-control" rows="5" placeholder="Description du client"></textarea>
      </div>
    </div>
  </AppModal>
</template>
