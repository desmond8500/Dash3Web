<script setup>
/**
 * Formulaire simple pour les marques et fournisseurs.
 * `fields` : [{ name, label, type?: 'text'|'email'|'url'|'tel'|'textarea', required?, col? }]
 */
import { reactive, ref, watch } from 'vue'
import { errorMessage } from '@/api/client'
import AppModal from '@/components/AppModal.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, required: true },
  fields: { type: Array, required: true },
  initial: { type: Object, default: null },
  /** (values) => Promise */
  submit: { type: Function, required: true },
})
const emit = defineEmits(['close', 'saved'])

const values = reactive({})
const saving = ref(false)
const error = ref('')

watch(
  () => props.show,
  (open) => {
    if (!open) return
    for (const f of props.fields) values[f.name] = props.initial?.[f.name] ?? ''
    error.value = ''
  },
)

const canSubmit = () => props.fields.every((f) => !f.required || String(values[f.name] ?? '').trim())

async function onSubmit() {
  saving.value = true
  error.value = ''
  try {
    const payload = {}
    for (const f of props.fields) {
      const v = typeof values[f.name] === 'string' ? values[f.name].trim() : values[f.name]
      payload[f.name] = v === '' ? null : v
    }
    await props.submit(payload)
    emit('saved')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal :show="show" :title="title" :saving="saving" :can-submit="canSubmit()" :error="error" @close="emit('close')" @submit="onSubmit">
    <div class="row">
      <div v-for="f in fields" :key="f.name" :class="[f.col || 'col-12', 'mb-3']">
        <label class="form-label" :class="{ required: f.required }">{{ f.label }}</label>
        <textarea v-if="f.type === 'textarea'" v-model="values[f.name]" class="form-control" rows="4"></textarea>
        <input v-else v-model="values[f.name]" :type="f.type || 'text'" class="form-control" :required="f.required" />
      </div>
    </div>
  </AppModal>
</template>
