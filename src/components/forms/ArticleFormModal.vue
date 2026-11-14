<script setup>
/** Formulaire article (création, modification, duplication), champs de _form/article_form. */
import { reactive, ref, watch } from 'vue'
import { errorMessage } from '@/api/client'
import { PRIORITIES, saveArticle } from '@/api/dash3'
import AppModal from '@/components/AppModal.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  article: { type: Object, default: null },
  /** true : crée une copie de `article` */
  duplicate: { type: Boolean, default: false },
  brands: { type: Array, default: () => [] },
  providers: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'saved'])

const empty = () => ({
  designation: '',
  reference: '',
  priority_id: 1,
  brand_id: null,
  provider_id: null,
  price: 0,
  tva: null,
  quantity: 0,
  quantity_min: 0,
  weight: null,
  description: '',
  spec: '',
})
const form = reactive(empty())
const saving = ref(false)
const error = ref('')

watch(
  () => props.show,
  (open) => {
    if (!open) return
    Object.assign(form, empty())
    if (props.article) {
      for (const k of Object.keys(form)) {
        if (props.article[k] !== undefined && props.article[k] !== null) form[k] = props.article[k]
      }
      if (props.duplicate) form.designation = `${form.designation} (copie)`
    }
    error.value = ''
  },
)

const num = (v, int = false) => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isNaN(n) ? null : int ? Math.trunc(n) : n
}

async function submit() {
  saving.value = true
  error.value = ''
  try {
    await saveArticle(
      {
        ...form,
        designation: form.designation.trim(),
        reference: String(form.reference ?? '').trim(),
        price: num(form.price),
        tva: num(form.tva),
        quantity: num(form.quantity, true),
        quantity_min: num(form.quantity_min, true),
        weight: num(form.weight),
      },
      props.duplicate ? undefined : props.article?.id,
    )
    emit('saved')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

const title = () => (props.duplicate ? 'Dupliquer un article' : props.article ? 'Editer un article' : 'Ajouter un article')
</script>

<template>
  <AppModal
    :show="show"
    :title="title()"
    size="modal-lg"
    :saving="saving"
    :can-submit="!!form.designation.trim() && !!String(form.reference ?? '').trim()"
    :error="error"
    @close="emit('close')"
    @submit="submit"
  >
    <div class="row">
      <div class="col-md-8 mb-3">
        <label class="form-label required">Désignation</label>
        <input v-model="form.designation" class="form-control" required />
      </div>
      <div class="col-md-4 mb-3">
        <label class="form-label required">Référence</label>
        <input v-model="form.reference" class="form-control" required />
      </div>
      <div class="col-md-4 mb-3">
        <label class="form-label">Priorité</label>
        <select v-model.number="form.priority_id" class="form-select">
          <option v-for="p in PRIORITIES" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div class="col-md-4 mb-3">
        <label class="form-label">Marque</label>
        <select v-model="form.brand_id" class="form-select">
          <option :value="null">—</option>
          <option v-for="b in brands" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
      </div>
      <div class="col-md-4 mb-3">
        <label class="form-label">Fournisseur</label>
        <select v-model="form.provider_id" class="form-select">
          <option :value="null">—</option>
          <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div class="col-md-3 mb-3">
        <label class="form-label">Prix (F)</label>
        <input v-model="form.price" type="number" min="0" step="any" class="form-control" />
      </div>
      <div class="col-md-3 mb-3">
        <label class="form-label">TVA (%)</label>
        <input v-model="form.tva" type="number" min="0" step="any" class="form-control" />
      </div>
      <div class="col-md-2 mb-3">
        <label class="form-label">Quantité</label>
        <input v-model="form.quantity" type="number" min="0" step="1" class="form-control" />
      </div>
      <div class="col-md-2 mb-3">
        <label class="form-label">Qté min.</label>
        <input v-model="form.quantity_min" type="number" min="0" step="1" class="form-control" />
      </div>
      <div class="col-md-2 mb-3">
        <label class="form-label">Poids (kg)</label>
        <input v-model="form.weight" type="number" min="0" step="any" class="form-control" />
      </div>
      <div class="col-md-6 mb-3">
        <label class="form-label">Description</label>
        <textarea v-model="form.description" class="form-control" rows="4"></textarea>
      </div>
      <div class="col-md-6 mb-3">
        <label class="form-label">Caractéristiques</label>
        <textarea v-model="form.spec" class="form-control" rows="4"></textarea>
      </div>
    </div>
  </AppModal>
</template>
