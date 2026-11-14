<script setup>
/** Formulaire projet (création / modification). */
import { reactive, ref, watch } from 'vue'
import { errorMessage } from '@/api/client'
import { saveProjet } from '@/api/dash3'
import AppModal from '@/components/AppModal.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  projet: { type: Object, default: null },
  /** Client du nouveau projet */
  clientId: { type: [Number, String], default: null },
})
const emit = defineEmits(['close', 'saved'])

const form = reactive({ name: '', description: '', start_date: '', end_date: '' })
const saving = ref(false)
const error = ref('')

const day = (d) => (d ? String(d).slice(0, 10) : '')

watch(
  () => props.show,
  (open) => {
    if (!open) return
    Object.assign(form, {
      name: props.projet?.name ?? '',
      description: props.projet?.description ?? '',
      start_date: day(props.projet?.start_date),
      end_date: day(props.projet?.end_date),
    })
    error.value = ''
  },
)

async function submit() {
  saving.value = true
  error.value = ''
  try {
    await saveProjet(
      {
        client_id: Number(props.projet?.client_id ?? props.clientId),
        name: form.name.trim(),
        description: form.description || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        favorite: !!props.projet?.favorite,
      },
      props.projet?.id,
    )
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
    :title="projet ? 'Modifier le projet' : 'Ajouter un projet'"
    :saving="saving"
    :can-submit="!!form.name.trim() && !!(projet?.client_id ?? clientId)"
    :error="error"
    @close="emit('close')"
    @submit="submit"
  >
    <div class="row">
      <div class="col-12 mb-3">
        <label class="form-label required">Nom du projet</label>
        <input v-model="form.name" type="text" class="form-control" required />
      </div>
      <div class="col-md-6 mb-3">
        <label class="form-label">Début</label>
        <input v-model="form.start_date" type="date" class="form-control" />
      </div>
      <div class="col-md-6 mb-3">
        <label class="form-label">Fin</label>
        <input v-model="form.end_date" type="date" class="form-control" />
      </div>
      <div class="col-12">
        <label class="form-label">Description</label>
        <textarea v-model="form.description" class="form-control" rows="5"></textarea>
      </div>
      <div v-if="!(projet?.client_id ?? clientId)" class="col-12 mt-3 text-warning small">
        Ouvrez la page d'un client pour lui ajouter un projet.
      </div>
    </div>
  </AppModal>
</template>
